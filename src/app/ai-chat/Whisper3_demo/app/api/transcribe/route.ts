import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    console.log("[Transcribe] Starting transcription request");
    
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const language = (formData.get("language") as string) || "bg";

    if (!audioFile) {
      console.error("[Transcribe] No audio file provided");
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    console.log(`[Transcribe] Audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);
    console.log(`[Transcribe] Language: ${language}`);

    // Validate audio file size (max 25MB for Groq)
    if (audioFile.size > 25 * 1024 * 1024) {
      console.error("[Transcribe] Audio file too large");
      return NextResponse.json({ error: "Audio file too large (max 25MB)" }, { status: 400 });
    }

    // Validate audio file type (extract base MIME type before any parameters like ;codecs=opus)
    const baseMimeType = audioFile.type.split(';')[0].trim();
    const validTypes = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/x-wav'];
    if (!validTypes.includes(baseMimeType)) {
      console.error(`[Transcribe] Invalid audio type: ${audioFile.type} (base: ${baseMimeType})`);
      return NextResponse.json({ error: `Invalid audio type: ${baseMimeType}` }, { status: 400 });
    }

    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "recording.webm");
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("language", language);
    groqFormData.append("response_format", "json");

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[Transcribe] GROQ_API_KEY not found in environment");
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    console.log("[Transcribe] Sending request to Groq API");
    
    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqFormData,
      }
    );

    console.log(`[Transcribe] Groq API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Transcribe] Groq API error:", errorText);
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(
          { error: "Transcription failed", details: errorJson },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { error: "Transcription failed", details: errorText },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log("[Transcribe] Groq API response:", JSON.stringify(data, null, 2));
    
    if (!data.text) {
      console.error("[Transcribe] No text in response:", data);
      return NextResponse.json({ error: "No transcription returned" }, { status: 500 });
    }
    
    console.log(`[Transcribe] Transcription successful, length: ${data.text.length}`);
    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error("[Transcribe] Server error:", err);
    return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 });
  }
}
