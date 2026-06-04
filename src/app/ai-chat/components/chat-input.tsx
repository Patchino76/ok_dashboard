"use client";

import React, {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { useChatStore } from "../stores/chat-store";
import SettingsPanel from "./settings-panel";

export default function ChatInput() {
  const isLoading = useChatStore((s) => s.isLoading);
  const sendAnalysis = useChatStore((s) => s.sendAnalysis);
  const sendFollowUp = useChatStore((s) => s.sendFollowUp);
  const cancelCurrent = useChatStore((s) => s.cancelCurrent);
  const activeConversation = useChatStore((s) => s.activeConversation);
  const conv = activeConversation();

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Routing rule: a conversation that already has an analysisId is locked
    // to follow-ups only. Starting a fresh analysis is exclusively done via
    // the "Нов анализ" button or by clicking a suggestion / template card.
    setInput("");
    if (conv && conv.analysisId) {
      sendFollowUp(trimmed);
    } else {
      sendAnalysis(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Audio recording for Whisper transcription ──────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [micError, setMicError] = useState<string | null>(null);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.requestData();
        recorder.stop();
      }
      return;
    }

    setMicError(null);

    // Enumerate devices first so we have IDs for fallback
    let audioInputs: MediaDeviceInfo[] = [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      audioInputs = devices.filter((d) => d.kind === "audioinput");
      console.log(
        `[Mic] Found ${audioInputs.length} audio input device(s):`,
        audioInputs.map((d) => ({
          label: d.label || "(no label)",
          id: d.deviceId.slice(0, 8) + "...",
          groupId: d.groupId?.slice(0, 4) || "",
        })),
      );
    } catch (enumErr) {
      console.warn("[Mic] enumerateDevices failed:", enumErr);
    }

    const requestMic = async (
      constraints: MediaStreamConstraints,
      attemptLabel: string,
    ): Promise<MediaStream> => {
      console.log("[Mic] Trying:", attemptLabel, constraints);
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    let stream: MediaStream | null = null;

    // Tier 1: advanced constraints
    try {
      stream = await requestMic(
        {
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            channelCount: { ideal: 1 },
          },
        },
        "advanced constraints",
      );
    } catch (err1) {
      console.warn("[Mic] Tier 1 failed:", err1);
    }

    // Tier 2: bare-minimum audio
    if (!stream) {
      try {
        stream = await requestMic({ audio: true }, "basic constraints");
      } catch (err2) {
        console.warn("[Mic] Tier 2 failed:", err2);
      }
    }

    // Tier 3: explicit deviceId from enumerateDevices
    // Some drivers reject {audio:true} but accept a specific deviceId
    if (!stream && audioInputs.length > 0) {
      const defaultDevice =
        audioInputs.find((d) => d.deviceId === "default") ||
        audioInputs.find((d) => d.deviceId === "communications") ||
        audioInputs[0];
      try {
        stream = await requestMic(
          {
            audio: {
              deviceId: { ideal: defaultDevice.deviceId },
              channelCount: { ideal: 1 },
            },
          },
          `explicit deviceId (${defaultDevice.label || defaultDevice.deviceId.slice(0, 8)})`,
        );
      } catch (err3) {
        console.warn("[Mic] Tier 3 failed:", err3);
      }
    }

    // Tier 4: retry basic after a short delay (device may be briefly in use)
    if (!stream) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        stream = await requestMic({ audio: true }, "retry basic after delay");
      } catch (err4) {
        console.warn("[Mic] Tier 4 failed:", err4);
      }
    }

    if (!stream) {
      console.error("[Mic] All tiers failed.");
      setMicError(
        "Микрофонът не е намерен от браузъра. Проверете: (1) Windows Settings → Privacy → Microphone, (2) Sound Settings → изберете Default микрофон, (3) ако използвате Remote Desktop/VM — включете Audio Input Redirection. Понякога помага рестарт на браузъра.",
      );
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

    console.log("[Mic] Using MIME type:", mimeType);
    const recorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      console.log("[Mic] Chunk received, size:", e.data.size);
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      setIsRecording(false);

      console.log(
        "[Mic] Recording stopped, chunks:",
        audioChunksRef.current.length,
      );
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      console.log("[Mic] Blob size:", blob.size, "bytes");
      if (blob.size === 0) {
        console.warn("[Mic] Empty recording, skipping transcription");
        return;
      }

      setIsTranscribing(true);
      try {
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (res.ok && data.text) {
          setInput((prev) => (prev ? prev + " " + data.text : data.text));
        } else {
          console.error("[Transcribe]", data.error || "Unknown error");
        }
      } catch (err) {
        console.error("[Transcribe] Failed:", err);
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.start(250);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    console.log("[Mic] Recording started");
  }, [isRecording]);

  const handleCancel = async () => {
    setInput("");
    await cancelCurrent();
  };

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-gray-50">
      <SettingsPanel />
      <div className="flex items-end gap-2.5 bg-white border-2 border-gray-300 rounded-2xl px-5 py-3 shadow-md focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 hover:border-gray-400 transition-all max-w-6xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            conv && conv.analysisId
              ? "Задайте допълнителен въпрос за доклада..."
              : "Задайте въпрос за мелничните данни..."
          }
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none bg-transparent text-[15px] text-gray-900 placeholder:text-gray-500 outline-none py-1.5 max-h-40 disabled:opacity-50 leading-relaxed"
        />
        <button
          onClick={toggleRecording}
          disabled={isLoading || isTranscribing}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600 animate-pulse shadow"
              : isTranscribing
                ? "bg-amber-500 text-white cursor-wait shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 border border-gray-200"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={
            isRecording
              ? "Спри записа"
              : isTranscribing
                ? "Транскрибиране..."
                : "Запис с микрофон"
          }
        >
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRecording ? (
            <Square className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
        {/* Cancel running analysis / follow-up; otherwise Send */}
        {isLoading ? (
          <button
            onClick={handleCancel}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-rose-600 text-white hover:bg-rose-700 shadow-md transition-colors"
            title="Прекъсни изпълнението"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-md disabled:shadow-none transition-colors"
            title="Изпрати"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
      {micError && (
        <p className="text-center text-[11px] text-red-500 mt-1.5 font-medium">
          {micError}
        </p>
      )}
      <p className="text-center text-[10px] text-gray-400 mt-2">
        {conv && conv.analysisId
          ? 'Този разговор е заключен към избрания анализ — въпросите се изпращат като допълнителни. За нов анализ натиснете „Нов анализ".'
          : "Анализът може да отнеме 2-5 минути. Агентите зареждат данни, анализират и генерират доклад."}
      </p>
    </div>
  );
}
