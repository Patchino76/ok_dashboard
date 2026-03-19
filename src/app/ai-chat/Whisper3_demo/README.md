# VoiceScript — Groq Whisper Transcriber

A Next.js app for recording voice in Bulgarian or English and transcribing it via Groq's `whisper-large-v3` model.

## Setup

```bash
npm install
npm run dev
```

The app runs on http://localhost:3000

## How it works

1. Select language (Bulgarian 🇧🇬 or English 🇬🇧)
2. Click the microphone button to start recording
3. Click the stop (square) button to finish
4. The audio is sent to `/api/transcribe` which calls Groq Whisper
5. The transcript appears in the text field

## API Route

`POST /api/transcribe`
- Accepts `multipart/form-data` with:
  - `audio` — audio blob (webm/ogg)
  - `language` — `"bg"` or `"en"`
- Returns `{ text: string }`

## Environment

`.env.local` is already configured with the Groq API key.
