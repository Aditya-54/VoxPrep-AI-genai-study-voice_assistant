<img src="static/voxprep_banner.png" width="380" alt="VoxPrep AI Header Banner">

# VoxPrep AI

[Key Features](#key-features) | [Latency & Efficiency Optimizations](#latency--efficiency-optimizations) | [Installation](#installation) | [Quick Start](#quick-start)

[![Python Version](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100%2B-green.svg)](https://fastapi.tiangolo.com/)
[![Groq LLM](https://img.shields.io/badge/LLM-Groq%20Llama%203.3-orange.svg)](https://groq.com/)
[![ASR Engine](https://img.shields.io/badge/ASR-Faster%20Whisper-blueviolet.svg)](https://github.com/SYSTRAN/faster-whisper)
[![Chroma DB](https://img.shields.io/badge/VectorDB-Chroma-red.svg)](https://www.trychroma.com/)

VoxPrep AI is a voice-interactive exam preparation assistant and Generative AI research workspace. It ingests course materials (PDF, DOCX, PPTX), generates RAG-grounded study questions, evaluates user answers with citation references, and hosts a split-screen research environment featuring instant note-taking and cross-document query capabilities.

---

## Key Features

* **Multi-Format Ingestion**: Parses PDFs page-by-page, DOCX in 350-word pages, and PPTX slide-by-slide to ensure citation precision.
* **RAG-Grounded Quizzing**: Generates conceptual study questions using Groq and filters out administrative metadata via a self-check audit.
* **Spoken Viva Mode**: Reads questions using Edge-TTS, records/transcribes microphone input locally using Faster-Whisper, and asks clarifying follow-ups for vague answers.
* **Research & Notes Suite**: A dual-panel dashboard. Personal notes taken in the editor are indexed on the fly, allowing RAG query chat to search both notes and textbook documents.

---

## Latency & Efficiency Optimizations

* **Faster-Whisper (CTranslate2)**: Uses CPU-quantized `int8` local speech-to-text inference to bypass cloud ASR network latency.
* **Edge-TTS Audio Streaming**: Streams audio chunks directly to the browser as binary MP3 streams, avoiding local disk write and execution blocks.
* **Manual Embeddings**: Embeds text blocks using a single cached `SentenceTransformer` locally to prevent Chroma from downloading separate ONNX models.
* **Asynchronous Dashboards**: Attempts logging and dashboard regeneration runs in background worker threads, keeping API response times instant.

---

## Installation

### Prerequisites
- Python 3.11 or Python 3.12 installed on Windows.
- A functional microphone connected to your system.

### 1. Initialize Project Environment
Clone or navigate to your project directory, create a virtual environment, and activate it:
```powershell
# Create local virtual environment
python -m venv .venv

# Activate virtual environment
.venv\Scripts\Activate.ps1
```

### 2. Install Package Dependencies
Install the package requirements listed in `requirements.txt`:
```powershell
pip install -r requirements.txt
```

### 3. Setup Configurations
Copy the `.env.template` into a new file named `.env` and enter your Groq API key:
```powershell
copy .env.template .env
```
Open `.env` in a text editor and enter your parameters:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
TTS_VOICE=en-US-GuyNeural
```

---

## Quick Start

### 1. Launch the Server
Start the FastAPI server:
```powershell
.venv\Scripts\python server.py
```
Open your browser and navigate to:
```
http://localhost:8000
```

### 2. Upload Notes and Slides
In the **Dashboard & Library** tab, upload your PDFs, DOCX files, or PPTX slides. The backend will parse, chunk, and index them into the Chroma vector database.

### 3. Self-Quiz
Go to the **Study Center** tab, choose a topic or leave it on weighted mode, select **Text Quiz** or **Spoken Viva Mode**, and start practice.
- In Viva mode, click the microphone button, speak, and press `Enter` to submit.

### 4. Note-Taking & Chat Research
Go to the **Research & Notes** tab:
- Use the editor on the right to summarize your notes. Click **Save & Index Note**.
- Use the chat panel on the left to ask questions. The assistant searches both your uploaded files and your handwritten notes to provide answers with source citations.
