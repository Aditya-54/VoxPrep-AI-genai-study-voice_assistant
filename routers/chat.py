import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class RenameSessionRequest(BaseModel):
    title: str


@router.get("/sessions")
def list_chat_sessions():
    """Lists all research chat sessions, most recently updated first."""
    return db.get_chat_sessions()


@router.post("/sessions")
def create_chat_session():
    """Creates a new, empty research chat session (used for an explicit 'New Chat')."""
    session_id = db.create_chat_session()
    return db.get_chat_session(session_id)


@router.get("/sessions/{session_id}")
def get_chat_session(session_id: int):
    """Retrieves a single chat session along with its full ordered message history."""
    session = db.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return session


@router.patch("/sessions/{session_id}")
def rename_chat_session(session_id: int, payload: RenameSessionRequest):
    """Renames a chat session."""
    if not db.get_chat_session(session_id):
        raise HTTPException(status_code=404, detail="Chat session not found.")
    db.rename_chat_session(session_id, payload.title)
    return db.get_chat_session(session_id)


@router.delete("/sessions/{session_id}")
def delete_chat_session(session_id: int):
    """Deletes a chat session and all of its messages."""
    if not db.get_chat_session(session_id):
        raise HTTPException(status_code=404, detail="Chat session not found.")
    db.delete_chat_session(session_id)
    return {"status": "success", "message": "Chat session deleted."}
