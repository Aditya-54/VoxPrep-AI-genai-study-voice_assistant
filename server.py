import os
import shutil
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import chromadb
import edge_tts
from faster_whisper import WhisperModel

# Import local modules
import db
import doc_parser
import question_gen
import grader
from routers import chat as chat_router
from routers import quiz as quiz_router

# Load environment variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))

# Logging setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Voice-Based Exam Prep & Research Assistant API")
app.include_router(chat_router.router)
app.include_router(quiz_router.router)

# Setup directories
DATA_DIR = "data"
VECTOR_DB_DIR = "vector_store"
COLLECTION_NAME = "course_notes"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VECTOR_DB_DIR, exist_ok=True)

# Global models (loaded lazily)
_embedding_model = None
_whisper_model = None


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        logger.info("Loading embedding model...")
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        model_name = os.getenv("WHISPER_MODEL", "base")
        device = os.getenv("WHISPER_DEVICE", "cpu")
        logger.info(f"Loading Whisper model '{model_name}' on '{device}'...")
        _whisper_model = WhisperModel(model_name, device=device, compute_type="int8")
    return _whisper_model


# Helpers
def index_file_in_chroma(file_path: str):
    """Parses, embeds, and uploads a single file to Chroma DB."""
    filename = os.path.basename(file_path)
    chunks_data = doc_parser.parse_document(file_path)
    
    if not chunks_data:
        return 0
        
    all_documents = []
    all_metadatas = []
    all_ids = []
    
    for idx, c in enumerate(chunks_data):
        chunk_id = f"{filename}_c{idx}"
        all_documents.append(c["text"])
        all_metadatas.append(c["metadata"])
        all_ids.append(chunk_id)
        
    model = get_embedding_model()
    embeddings = model.encode(all_documents)
    
    chroma_client = chromadb.PersistentClient(path=VECTOR_DB_DIR)
    collection = chroma_client.get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
    
    # Delete existing index for this file to prevent duplicates on re-upload
    collection.delete(where={"source_file": filename})
    
    collection.upsert(
        ids=all_ids,
        embeddings=embeddings.tolist(),
        documents=all_documents,
        metadatas=all_metadatas
    )
    return len(all_documents)


def index_note_in_chroma(note_id: int, title: str, content: str, topic: str):
    """Parses, chunks, and embeds a personal note into Chroma so RAG research finds it."""
    source_name = f"UserNote_{note_id}_{title.replace(' ', '_')}.txt"
    chunks = doc_parser.chunk_text(content)
    
    if not chunks or not content.strip():
        return
        
    all_documents = []
    all_metadatas = []
    all_ids = []
    
    for idx, chunk in enumerate(chunks):
        chunk_id = f"note_{note_id}_c{idx}"
        all_documents.append(chunk)
        all_metadatas.append({
            "source_file": source_name,
            "page_number": 1,
            "chunk_index": idx,
            "is_note": True,
            "note_id": note_id
        })
        all_ids.append(chunk_id)
        
    model = get_embedding_model()
    embeddings = model.encode(all_documents)
    
    chroma_client = chromadb.PersistentClient(path=VECTOR_DB_DIR)
    collection = chroma_client.get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
    
    # Delete previous index for this note
    collection.delete(where={"note_id": note_id})
    
    collection.upsert(
        ids=all_ids,
        embeddings=embeddings.tolist(),
        documents=all_documents,
        metadatas=all_metadatas
    )


# Request Pydantic Schemas
class GradeRequest(BaseModel):
    question_dict: dict
    user_answer: str
    session_id: int = None


class NoteRequest(BaseModel):
    title: str
    content: str
    topic: str
    note_id: int = None


class QueryRequest(BaseModel):
    query: str
    session_id: int = None


class VagueRequest(BaseModel):
    question: str
    answer: str


# ==========================================
# API ROUTING
# ==========================================

@app.on_event("startup")
def startup_event():
    db.init_db()


# 1. FILE UPLOAD & MANAGEMENT
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx", ".pptx"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, DOCX, or PPTX.")
        
    file_path = os.path.join(DATA_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Immediately run ingestion
        num_chunks = index_file_in_chroma(file_path)
        return {
            "status": "success",
            "filename": file.filename,
            "chunks": num_chunks,
            "message": f"Successfully uploaded and ingested '{file.filename}'."
        }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload and index document: {str(e)}")


@app.get("/api/files")
def get_files():
    """Returns lists of uploaded notes and documents."""
    files_list = []
    for f in os.listdir(DATA_DIR):
        if os.path.isfile(os.path.join(DATA_DIR, f)):
            files_list.append({
                "name": f,
                "size": os.path.getsize(os.path.join(DATA_DIR, f))
            })
    return files_list


@app.delete("/api/files/{filename}")
def delete_file(filename: str):
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")
        
    try:
        os.remove(file_path)
        # Delete from Chroma index
        chroma_client = chromadb.PersistentClient(path=VECTOR_DB_DIR)
        collection = chroma_client.get_or_create_collection(COLLECTION_NAME)
        collection.delete(where={"source_file": filename})
        return {"status": "success", "message": f"Successfully deleted '{filename}' from library."}
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 2. QUIZ GENERATION & GRADING
@app.get("/api/question")
def get_question(topic: str = None):
    q_generator = question_gen.QuestionGenerator()
    res = q_generator.generate_question(topic)
    return res


@app.post("/api/grade")
def grade_quiz(payload: GradeRequest):
    ans_grader = grader.AnswerGrader()
    res = ans_grader.grade_answer(payload.question_dict, payload.user_answer)
    
    if res.get("status") == "success":
        # Log attempt to SQLite
        try:
            db.log_attempt(
                topic=payload.question_dict.get("source_metadata", {}).get("source_file", "General"),
                question=payload.question_dict.get("question"),
                user_answer=payload.user_answer,
                verdict=res.get("verdict"),
                explanation=res.get("explanation"),
                source_file=payload.question_dict.get("source_metadata", {}).get("source_file", "General"),
                page_number=payload.question_dict.get("source_metadata", {}).get("page_number", 0),
                session_id=payload.session_id
            )
        except Exception as e:
            logger.error(f"Error logging attempt: {e}")
            
    return res


@app.post("/api/vague_check")
def vague_check(payload: VagueRequest):
    """Invokes Viva proctor check to evaluate if response is too vague."""
    from viva_mode import VivaMode
    viva = VivaMode()
    is_vague, follow_up = viva.check_if_vague(payload.question, payload.answer)
    return {"is_vague": is_vague, "follow_up": follow_up}


# 3. VOICE SPEECH API (ASR / TTS)
@app.post("/api/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribes client WAV/WEBM audio blobs using local Faster-Whisper."""
    temp_audio_path = "temp_upload.webm"
    try:
        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        model = get_whisper_model()
        segments, info = model.transcribe(temp_audio_path, beam_size=5)
        text = "".join([segment.text for segment in segments]).strip()
        
        # Clean up
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
            
        return {"status": "success", "transcription": text}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        raise HTTPException(status_code=500, detail=f"ASR Transcription failed: {str(e)}")


@app.get("/api/voice/speak")
async def speak_text(text: str):
    """Streams spoken audio back to browser directly using edge-tts."""
    voice = os.getenv("TTS_VOICE", "en-US-GuyNeural")
    try:
        communicate = edge_tts.Communicate(text, voice)
        
        async def generator():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
                    
        return StreamingResponse(generator(), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS streaming error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS stream generation failed: {str(e)}")


# 4. RESEARCH NOTES CRUD
@app.get("/api/notes")
def get_notes():
    return db.get_all_notes()


@app.post("/api/notes")
def save_user_note(payload: NoteRequest):
    note_id = db.save_note(payload.title, payload.content, payload.topic, payload.note_id)
    # Index notes in Chroma vector database for instant RAG search query
    try:
        index_note_in_chroma(note_id, payload.title, payload.content, payload.topic)
    except Exception as e:
        logger.error(f"Failed to index note in Chroma: {e}")
    return {"status": "success", "note_id": note_id, "message": "Note successfully saved and indexed."}


@app.delete("/api/notes/{note_id}")
def delete_user_note(note_id: int):
    db.delete_note(note_id)
    # Clean from Chroma index
    try:
        chroma_client = chromadb.PersistentClient(path=VECTOR_DB_DIR)
        collection = chroma_client.get_or_create_collection(COLLECTION_NAME)
        collection.delete(where={"note_id": note_id})
    except Exception as e:
        logger.warning(f"Chroma clean-up failed during note deletion: {e}")
    return {"status": "success", "message": "Note deleted successfully."}


# 5. RESEARCH INTERACTIVE RAG CHAT
@app.post("/api/research/query")
def research_query(payload: QueryRequest):
    """
    RAG research assistant: queries course material AND user notes
    to answer conceptual queries with citations.
    """
    q_generator = question_gen.QuestionGenerator()
    coll = q_generator.collection

    # Persist the user's message immediately if this query belongs to a chat session
    if payload.session_id is not None:
        try:
            db.add_chat_message(payload.session_id, "user", payload.query)
            session = db.get_chat_session(payload.session_id)
            if session and session.get("title") == "New Chat":
                auto_title = payload.query.strip()[:40] + ("..." if len(payload.query.strip()) > 40 else "")
                db.rename_chat_session(payload.session_id, auto_title)
        except Exception as e:
            logger.error(f"Failed to persist user chat message: {e}")

    if not coll or coll.count() == 0:
        answer = "No study materials or notes have been uploaded to search."
        if payload.session_id is not None:
            try:
                db.add_chat_message(payload.session_id, "assistant", answer)
            except Exception as e:
                logger.error(f"Failed to persist assistant chat message: {e}")
        return {"answer": answer, "citations": []}

    # Embed search query
    model = get_embedding_model()
    query_emb = model.encode([payload.query]).tolist()
    
    # Query Chroma
    results = coll.query(query_embeddings=query_emb, n_results=4)
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    
    if not documents:
        answer = "I couldn't find any relevant details in your files or notes to answer that question."
        if payload.session_id is not None:
            try:
                db.add_chat_message(payload.session_id, "assistant", answer)
            except Exception as e:
                logger.error(f"Failed to persist assistant chat message: {e}")
        return {"answer": answer, "citations": []}

    # Build prompt context
    context_blocks = []
    citations = []
    for doc, meta in zip(documents, metadatas):
        source = meta.get("source_file", "Unknown Source")
        page = meta.get("page_number", "N/A")
        context_blocks.append(f"[Source: {source}, Page: {page}]\n{doc}")
        citations.append({"source": source, "page": page, "text_excerpt": doc[:150] + "..."})
        
    context_text = "\n\n".join(context_blocks)
    
    prompt = f"""You are a helpful, brilliant academic research assistant.
Your task is to answer the User's Research Query based strictly on the Context Text provided below.
The Context Text contains both official study PDFs/documents and the user's personal handwritten research notes.

Instructions:
1. Provide a comprehensive, structured, and informative answer to the query.
2. Rely only on facts found in the Context Text. If the text does not contain enough information to answer, mention that.
3. Be clear, professional, and reference which sources (e.g. course notes, slides, or user notes) were used.
4. Output your answer using clean, readable Markdown.

Context Text:
\"\"\"
{context_text}
\"\"\"

User's Research Query:
{payload.query}

Academic Answer:"""

    try:
        response = q_generator.groq_client.chat.completions.create(
            model=q_generator.model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        answer = response.choices[0].message.content.strip()
        if payload.session_id is not None:
            try:
                db.add_chat_message(payload.session_id, "assistant", answer, citations=citations)
            except Exception as e:
                logger.error(f"Failed to persist assistant chat message: {e}")
        return {"answer": answer, "citations": citations}
    except Exception as e:
        logger.error(f"Research query generation error: {e}")
        error_answer = f"Error running research query: {str(e)}"
        if payload.session_id is not None:
            try:
                db.add_chat_message(payload.session_id, "assistant", error_answer)
            except Exception as db_e:
                logger.error(f"Failed to persist assistant error chat message: {db_e}")
        return {"answer": error_answer, "citations": []}


# 6. STATS & ANALYTICS
@app.get("/api/stats")
def get_stats():
    """Exposes statistics, progress trends, and diagnostic info for dashboard cards."""
    attempts = db.get_all_attempts(limit=10)
    topic_stats = db.get_topic_stats()
    total_attempts = len(db.get_all_attempts(limit=10000))
    
    avg_accuracy = 0.0
    weakest_topic = "N/A"
    strongest_topic = "N/A"
    
    if topic_stats:
        total_score_pct = sum([s["accuracy"] * s["total_attempts"] for s in topic_stats])
        avg_accuracy = round(total_score_pct / total_attempts, 1) if total_attempts > 0 else 0.0
        
        sorted_stats = sorted(topic_stats, key=lambda x: x["accuracy"])
        weakest_topic = sorted_stats[0]["topic"]
        strongest_topic = sorted_stats[-1]["topic"]
        
    return {
        "total_attempts": total_attempts,
        "average_accuracy": avg_accuracy,
        "weakest_topic": weakest_topic,
        "strongest_topic": strongest_topic,
        "topic_stats": topic_stats,
        "recent_attempts": attempts
    }


@app.get("/api/stats/timeline")
def get_stats_timeline():
    """Exposes chronological accuracy history for trend charts (analytics page)."""
    return db.get_accuracy_over_time()


if __name__ == "__main__":
    import uvicorn
    # Start web server on port 8000
    print("Launching FastAPI Web Server on http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
