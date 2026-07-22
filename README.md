<img src="docs/banner.png" width="380" alt="VoxPrep AI Header Banner">

# VoxPrep AI

[Key Features](#key-features) | [Architecture](#architecture) | [Installation](#installation) | [Running the App](#running-the-app)

[![Python Version](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100%2B-green.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg)](https://nextjs.org/)
[![Groq LLM](https://img.shields.io/badge/LLM-Groq%20Llama%203.3-orange.svg)](https://groq.com/)
[![ASR Engine](https://img.shields.io/badge/ASR-Faster%20Whisper-blueviolet.svg)](https://github.com/SYSTRAN/faster-whisper)
[![Chroma DB](https://img.shields.io/badge/VectorDB-Chroma-red.svg)](https://www.trychroma.com/)

VoxPrep AI is a voice-interactive exam preparation assistant and RAG research workspace. It ingests course materials (PDF, DOCX, PPTX), generates grounded study questions, evaluates answers with source citations, and provides a research chat that queries both your documents and personal notes.

---

## Key Features

* **Multi-Format Ingestion** — Parses PDFs page-by-page, DOCX in 350-word pages, and PPTX slide-by-slide for citation precision.
* **RAG-Grounded Quizzing** — Generates conceptual questions from your material via Groq, self-checked to reject anything unanswerable from the text.
* **Smart Question Selection** — Weights questions toward your weakest pages and steers the model away from repeating recently asked questions, with no extra API calls.
* **Spoken Viva Mode** — Reads questions aloud (Edge-TTS), transcribes your spoken answer locally (Faster-Whisper), and asks a clarifying follow-up if the answer is too vague.
* **Research Chat with History** — Multi-turn RAG conversations over your documents and notes, saved and resumable like a chat app.
* **Study Session History** — Quiz/viva attempts are grouped into resumable session threads instead of a flat log.
* **Analytics Dashboard** — Topic accuracy and performance-over-time charts.

---

## Architecture

The backend and frontend run as two separate local processes:

- **Backend** (`server.py`) — FastAPI, API-only. Handles document ingestion, embeddings (ChromaDB + `sentence-transformers`), question generation/grading (Groq), voice transcription/TTS, and SQLite-backed session history.
- **Frontend** (`frontend/`) — Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. Proxies `/api/*` to the FastAPI backend via `next.config.ts` rewrites, so no CORS setup is needed.

```
frontend/  (Next.js — UI, :3000)
   │  proxies /api/*
   ▼
server.py (FastAPI — API only, :8000)
   │
   ├── ChromaDB (vector_store/) — document + note embeddings
   ├── SQLite (db/database.db) — attempts, sessions, chats, notes
   └── Groq — question generation, grading, research chat
```

There's also a standalone CLI (`main.py`) for terminal-based ingestion, quizzing, and a viva session — independent of the web app.

---

## Installation

### Prerequisites
- Python 3.11 or 3.12
- Node.js 18+ and npm
- A microphone (for Spoken Viva Mode)

### 1. Backend setup
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.template` to `.env` and add your Groq API key:
```powershell
copy .env.template .env
```
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
TTS_VOICE=en-US-GuyNeural
```

### 2. Frontend setup
```powershell
cd frontend
npm install
```

---

## Running the App

Run both processes (separate terminals):

```powershell
# Terminal 1 — backend API on :8000
.venv\Scripts\python -m uvicorn server:app --reload --port 8000

# Terminal 2 — frontend on :3000
cd frontend
npm run dev
```

Open **http://localhost:3000**.

### Basic workflow
1. **Library** — upload PDFs/DOCX/PPTX; they're parsed, chunked, and embedded automatically.
2. **Study Center** — start a text or spoken viva session, weighted toward your weakest topics/pages.
3. **Research** — ask conceptual questions across your documents and notes; conversations are saved and resumable.
4. **Notes** — write personal notes; they're indexed automatically so Research can search them.
5. **History / Analytics** — review past sessions and accuracy trends over time.
