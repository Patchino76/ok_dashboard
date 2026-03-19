"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./page.module.css";

type Language = "bg" | "en";
type Status = "idle" | "recording" | "processing" | "done" | "error";

export default function Home() {
  const [language, setLanguage] = useState<Language>("bg");
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });

      console.log("[Frontend] Audio stream obtained, constraints:", stream.getAudioTracks()[0].getSettings());

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      console.log("[Frontend] Using MIME type:", mimeType);

      const recorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log("[Frontend] Audio chunk received, size:", e.data.size);
        }
      };

      recorder.onstop = async () => {
        console.log("[Frontend] Recording stopped, total chunks:", chunksRef.current.length);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log("[Frontend] Blob created, size:", blob.size, "bytes, type:", blob.type);
        await transcribe(blob);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setStatus("recording");
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error("[Frontend] Microphone access error:", err);
      setErrorMsg("Microphone access denied. Please allow microphone permissions.");
      setStatus("error");
    }
  }, [language]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
      setStatus("processing");
    }
  }, [status]);

  const transcribe = async (blob: Blob) => {
    try {
      console.log("[Frontend] Starting transcription, blob size:", blob.size, "bytes");
      
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("language", language);

      console.log("[Frontend] Sending request to /api/transcribe");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      console.log("[Frontend] Response status:", res.status);
      const data = await res.json();
      console.log("[Frontend] Response data:", data);

      if (!res.ok) {
        const errorMsg = data.details ? `${data.error}: ${JSON.stringify(data.details)}` : data.error;
        throw new Error(errorMsg);
      }

      if (!data.text) {
        throw new Error("No transcription text returned from API");
      }

      console.log("[Frontend] Transcription successful, length:", data.text.length);
      setTranscript(data.text);
      setStatus("done");
    } catch (err: any) {
      console.error("[Frontend] Transcription error:", err);
      const errorMsg = err.message || "Something went wrong during transcription";
      setErrorMsg(errorMsg);
      setStatus("error");
    }
  };

  const handleMicClick = () => {
    if (status === "recording") {
      stopRecording();
    } else if (status !== "processing") {
      startRecording();
    }
  };

  const reset = () => {
    setTranscript("");
    setStatus("idle");
    setErrorMsg("");
  };

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const statusLabel = {
    idle: "Ready to record",
    recording: `Recording — ${formatDuration(duration)}`,
    processing: "Transcribing…",
    done: "Transcription complete",
    error: "Error occurred",
  }[status];

  return (
    <main className={styles.main}>
      <div className={styles.container}>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            <span className={styles.logoText}>VOICESCRIPT</span>
          </div>
          <p className={styles.tagline}>Whisper-large-v3 · Groq</p>
          <button 
            className={styles.testBtn}
            onClick={async () => {
              try {
                const res = await fetch("/api/health");
                const data = await res.json();
                alert(`API Status: ${data.status}\nMessage: ${data.message}\nWhisper Models: ${data.whisperModels?.join(", ") || "None"}`);
              } catch (err) {
                alert("Failed to check API health");
              }
            }}
          >
            Test API
          </button>
        </header>

        {/* Language Toggle */}
        <div className={styles.langToggle}>
          <button
            className={`${styles.langBtn} ${language === "bg" ? styles.langActive : ""}`}
            onClick={() => setLanguage("bg")}
            disabled={status === "recording" || status === "processing"}
          >
            <span className={styles.langFlag}>🇧🇬</span>
            <span>Bulgarian</span>
          </button>
          <div className={styles.langDivider} />
          <button
            className={`${styles.langBtn} ${language === "en" ? styles.langActive : ""}`}
            onClick={() => setLanguage("en")}
            disabled={status === "recording" || status === "processing"}
          >
            <span className={styles.langFlag}>🇬🇧</span>
            <span>English</span>
          </button>
        </div>

        {/* Mic Area */}
        <div className={styles.micArea}>
          {status === "recording" && (
            <div className={styles.rippleWrapper}>
              <div className={styles.ripple} />
              <div className={`${styles.ripple} ${styles.ripple2}`} />
              <div className={`${styles.ripple} ${styles.ripple3}`} />
            </div>
          )}

          <button
            className={`${styles.micBtn} ${styles[`micBtn_${status}`]}`}
            onClick={handleMicClick}
            disabled={status === "processing"}
            aria-label={status === "recording" ? "Stop recording" : "Start recording"}
          >
            {status === "processing" ? (
              <svg className={styles.spinner} viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
              </svg>
            ) : status === "recording" ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Status */}
        <p className={`${styles.statusText} ${styles[`status_${status}`]}`}>
          {statusLabel}
        </p>

        {/* Transcript Box */}
        <div className={styles.transcriptWrapper}>
          <div className={styles.transcriptHeader}>
            <span className={styles.transcriptLabel}>TRANSCRIPT</span>
            {transcript && (
              <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(transcript)}>
                Copy
              </button>
            )}
          </div>
          <textarea
            className={styles.transcriptArea}
            value={status === "error" ? errorMsg : transcript}
            readOnly
            placeholder={
              status === "processing"
                ? "Processing audio…"
                : "Your transcription will appear here…"
            }
            data-error={status === "error"}
          />
          {(status === "done" || status === "error") && (
            <button className={styles.resetBtn} onClick={reset}>
              ↺ New Recording
            </button>
          )}
        </div>

        <p className={styles.hint}>
          {status === "idle" && "Click the mic to start · Click again to stop"}
          {status === "recording" && "Speak clearly · Click the square to stop"}
          {status === "processing" && "Sending to Groq Whisper…"}
        </p>
      </div>
    </main>
  );
}
