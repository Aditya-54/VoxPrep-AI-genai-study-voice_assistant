import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


class CreateQuizSessionRequest(BaseModel):
    mode: str = "text"
    topic: str = None
    title: str = None


@router.get("/sessions")
def list_quiz_sessions():
    """Lists all quiz/viva study session threads, most recently updated first."""
    return db.get_quiz_sessions()


@router.post("/sessions")
def create_quiz_session(payload: CreateQuizSessionRequest):
    """Starts a new quiz/viva study session thread."""
    session_id = db.create_quiz_session(mode=payload.mode, topic=payload.topic, title=payload.title)
    return db.get_quiz_session(session_id)


@router.get("/sessions/{session_id}")
def get_quiz_session(session_id: int):
    """Retrieves a quiz/viva session thread with its full attempt transcript."""
    session = db.get_quiz_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Quiz session not found.")
    return session


@router.delete("/sessions/{session_id}")
def delete_quiz_session(session_id: int):
    """Deletes a quiz/viva session thread (its attempts are kept but detached)."""
    if not db.get_quiz_session(session_id):
        raise HTTPException(status_code=404, detail="Quiz session not found.")
    db.delete_quiz_session(session_id)
    return {"status": "success", "message": "Quiz session deleted."}
