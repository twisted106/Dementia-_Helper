# SecondSight — AR Cognitive & Memory Assistant for Dementia

SecondSight is a real-time smart glasses & AR companion application engineered to support individuals with dementia, Alzheimer's, or memory impairment.

It combines real-time facial biometric recognition, streaming live speech transcription, and intelligent cognitive memory extraction into a calm, distraction-free frosted glassmorphic HUD.

---

## Key Features

- **Real-Time Facial Recognition**: Identifies family members, friends, and doctors using 128-dimensional face descriptor embeddings with pgvector similarity matching.
- **Audio Memory Prompting (Whisper)**: Automatically speaks gentle memory cues into the wearer's audio output when a known person enters the frame after a 30-minute break.
- **Cognitive Memory Extraction**: Automatically summarizes conversations to capture critical real-world facts:
  - Item & object locations (*e.g., "Keys on kitchen counter"*)
  - Plans & schedules (*e.g., "Doctor visit Friday at 10 AM"*)
  - Meaningful emotional moments and family news
- **Low-Latency Streaming Transcription**: Real-time word-by-word streaming using 16-bit PCM WebSocket audio.
- **Warm Glassmorphic Interface**: Soft, empathetic visual aesthetics without neon glare or cyber clutter.
- **Zero API Key Leakage**: Server-side proxying for all LLM and STT operations.

---

## Architecture & Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, Shadcn UI
- **Vision**: `@vladmandic/face-api` (TinyFaceDetector, FaceLandmarks, FaceRecognitionNet)
- **Database**: Supabase (PostgreSQL with `pgvector` extension for vector similarity matching)
- **Speech-to-Text**: Deepgram Nova-2 (Raw 16-bit PCM WebSocket streaming via Web Audio API)
- **Cognitive Summarization**: Groq (Llama 3.3 70B Versatile)
- **Voice Synthesis (TTS)**: OpenAI TTS (alloy/shimmer) with browser Web Speech API fallback

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ and npm installed

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/twisted106/dimentia-patients.git
cd dimentia-patients

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
# Supabase
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-Side Keys (Protected)
GROQ_API_KEY=your_groq_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENAI_API_KEY=your_openai_api_key
```

### 4. Running Locally
```bash
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser with camera and microphone permissions enabled.

---

## License
MIT
