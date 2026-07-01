![VoxPrep AI Header Banner](static/voxprep_banner.png)

# VoxPrep AI

[Key Features](#key-features) | [Performance and Latency Optimizations](#performance-and-latency-optimizations) | [Installation](#installation) | [Quick Start](#quick-start) | [Dependencies](#dependencies)

[![Python Version](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100%2B-green.svg)](https://fastapi.tiangolo.com/)
[![Groq LLM](https://img.shields.io/badge/LLM-Groq%20Llama%203.3-orange.svg)](https://groq.com/)
[![ASR Engine](https://img.shields.io/badge/ASR-Faster%20Whisper-blueviolet.svg)](https://github.com/SYSTRAN/faster-whisper)
[![Chroma DB](https://img.shields.io/badge/VectorDB-Chroma-red.svg)](https://www.trychroma.com/)

VoxPrep AI is a voice-interactive exam preparation assistant and Generative AI research workspace. It ingests course materials (PDF, DOCX, PPTX), generates RAG-grounded study questions, evaluates user answers with citation references, and hosts a split-screen research environment featuring instant note-taking and cross-document query capabilities.

---

## Key Features

1. **Multi-Format Document Parsing**
   Extracts text page-by-page from PDFs, approximates text-block pagination from Word documents (DOCX), and parses PowerPoint slides (PPTX) slide-by-slide to maintain accurate citations.

2. **RAG-Grounded Question Generation**
   Queries the local Chroma vector index to select context chunks and uses Groq to generate challenging exam questions. Runs an automated self-check audit to reject questions that require external knowledge or refer to administrative metadata.

3. **Spoken Viva Mode**
   An oral examination loop that speaks questions aloud, transcribes microphone input locally, evaluates answers, and triggers a single guiding follow-up question if the first response is vague or incomplete.

4. **Split-Screen Research Chat & Notes**
   A dual-panel interface. On the right, users take and save personal study summaries. These notes are immediately chunked and indexed. On the left, users query both official course notes and their handwritten notes in a single RAG chat.

---

## Performance and Latency Optimizations

VoxPrep AI utilizes several architectural optimizations to ensure fast response times and low latency while relying entirely on free tools:

* **CTranslate2 Local ASR Acceleration**: Text transcription is performed locally using the `faster-whisper` package. It utilizes CTranslate2 (a fast inference engine for Transformer models) and CPU-optimized `int8` quantization, reducing unzipping/inference latency by up to 4x compared to default Whisper implementations.
* **Non-Blocking TTS Audio Streaming**: Instead of generating, saving, and launching player subprocesses for speech files (which blocks the application runtime and causes disk latency), `edge-tts` streams chunked binary audio directly over the network to the browser using FastAPI's `StreamingResponse`. The browser decodes and plays the audio buffer on the fly.
* **Manual Vector Embeddings Passing**: To prevent Chroma from downloading separate ONNX models and initializing duplicated processes (which causes CPU bottlenecks on Windows), VoxPrep AI embeds all text blocks locally using a single cached instance of `SentenceTransformer` and passes raw float arrays to Chroma's CRUD API.
* **FastAPI RELOAD & Relational SQLite Logging**: Grading operations log attempts asynchronously into SQLite. Matplotlib dashboard updates run in background worker threads, allowing FastAPI endpoints to return grades and citations to the client instantly.

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

---

## Dependencies

VoxPrep AI is built on the following primary libraries:
- `fastapi` & `uvicorn` - Web server routing and deployment
- `groq` - LLM API interaction
- `pypdf` - PDF parsing
- `python-docx` & `python-pptx` - Microsoft Word and PowerPoint parsing
- `sentence-transformers` - Local vector embedding generation
- `chromadb` - Persistent vector indexing and retrieval
- `faster-whisper` - Quantized local speech-to-text inference
- `edge-tts` - Free asynchronous text-to-speech audio streams
- `sounddevice` & `numpy` - Client audio recording and data handling
- `matplotlib` - Analytical progress chart generation
- `python-dotenv` - Environment configurations handling
