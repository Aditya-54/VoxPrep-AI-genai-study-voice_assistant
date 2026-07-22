import os
import json
import sqlite3
from datetime import datetime

DB_DIR = "db"
DB_FILE = os.path.join(DB_DIR, "database.db")


def get_db_connection():
    """Establishes and returns a connection to the SQLite database."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # Access columns by name like dict
    return conn


def init_db():
    """Initializes the database schema if it doesn't already exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create the attempts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            topic TEXT,
            question TEXT,
            user_answer TEXT,
            verdict TEXT,        -- 'Correct', 'Partially Correct', 'Incorrect'
            explanation TEXT,
            source_file TEXT,
            page_number INTEGER
        )
    """)
    
    # Create the notes table for research features
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            title TEXT,
            content TEXT,
            topic TEXT
        )
    """)

    # Research chat sessions (resumable multi-turn RAG conversations)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT 'New Chat',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            citations_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        )
    """)

    # Quiz/Viva study sessions (groups attempts into resumable threads)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT 'Study Session',
            mode TEXT DEFAULT 'text',
            topic TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Idempotent migration: add nullable session_id FK to the existing attempts table
    cursor.execute("PRAGMA table_info(attempts)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "session_id" not in existing_columns:
        cursor.execute("ALTER TABLE attempts ADD COLUMN session_id INTEGER")

    conn.commit()
    conn.close()


def log_attempt(topic: str, question: str, user_answer: str, verdict: str, explanation: str, source_file: str, page_number: int, session_id: int = None) -> int:
    """
    Logs an exam attempt to the SQLite database.
    Returns the ID of the inserted row.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO attempts (topic, question, user_answer, verdict, explanation, source_file, page_number, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (topic, question, user_answer, verdict, explanation, source_file, page_number, session_id))

    inserted_id = cursor.lastrowid
    conn.commit()

    if session_id is not None:
        cursor.execute("UPDATE quiz_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
        conn.commit()

    conn.close()

    return inserted_id


def get_attempts_by_session(session_id: int) -> list[dict]:
    """Retrieves all attempts belonging to a quiz/viva session thread, chronologically."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, timestamp, topic, question, user_answer, verdict, explanation, source_file, page_number, session_id
        FROM attempts
        WHERE session_id = ?
        ORDER BY timestamp ASC
    """, (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_recent_questions(source_file: str, limit: int = 5) -> list[str]:
    """Retrieves the most recent question texts asked for a given topic/source file."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT question
        FROM attempts
        WHERE topic = ? OR source_file = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (source_file, source_file, limit))
    rows = cursor.fetchall()
    conn.close()
    return [row["question"] for row in rows if row["question"]]


def get_page_stats() -> list[dict]:
    """
    Computes accuracy metrics grouped by (source_file, page_number), for page-level
    question-selection weighting within a topic.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            source_file,
            page_number,
            COUNT(*) as total_attempts,
            SUM(CASE WHEN verdict = 'Correct' THEN 1.0
                     WHEN verdict = 'Partially Correct' THEN 0.5
                     ELSE 0.0 END) as score_sum
        FROM attempts
        GROUP BY source_file, page_number
    """)

    rows = cursor.fetchall()
    conn.close()

    stats = []
    for row in rows:
        total = row["total_attempts"]
        score_sum = row["score_sum"]
        accuracy = (score_sum / total) * 100 if total > 0 else 0.0
        stats.append({
            "source_file": row["source_file"],
            "page_number": row["page_number"],
            "total_attempts": total,
            "accuracy": round(accuracy, 1)
        })

    return stats


# Quiz/Viva Session Management
def create_quiz_session(mode: str = "text", topic: str = None, title: str = None) -> int:
    """Creates a new quiz/viva study session thread and returns its ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    session_title = title or f"{'Viva' if mode == 'viva' else 'Quiz'} Session"
    cursor.execute("""
        INSERT INTO quiz_sessions (title, mode, topic)
        VALUES (?, ?, ?)
    """, (session_title, mode, topic))
    inserted_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return inserted_id


def get_quiz_sessions() -> list[dict]:
    """Retrieves all quiz/viva sessions, most recently updated first."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, mode, topic, created_at, updated_at
        FROM quiz_sessions
        ORDER BY updated_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_quiz_session(session_id: int) -> dict:
    """Retrieves a single quiz session by ID, including its attempts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, mode, topic, created_at, updated_at
        FROM quiz_sessions
        WHERE id = ?
    """, (session_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    session = dict(row)
    session["attempts"] = get_attempts_by_session(session_id)
    return session


def delete_quiz_session(session_id: int):
    """Deletes a quiz session and detaches (nulls out) its attempts' session_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE attempts SET session_id = NULL WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM quiz_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


# Research Chat Session Management
def create_chat_session(title: str = "New Chat") -> int:
    """Creates a new research chat session and returns its ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO chat_sessions (title) VALUES (?)", (title,))
    inserted_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return inserted_id


def get_chat_sessions() -> list[dict]:
    """Retrieves all chat sessions, most recently updated first."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, created_at, updated_at
        FROM chat_sessions
        ORDER BY updated_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_chat_session(session_id: int) -> dict:
    """Retrieves a single chat session with its full ordered message history."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    session = dict(row)
    session["messages"] = get_chat_messages(session_id)
    return session


def rename_chat_session(session_id: int, title: str):
    """Renames a chat session (e.g. a manual rename, or auto-titling on first message)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, session_id))
    conn.commit()
    conn.close()


def delete_chat_session(session_id: int):
    """Deletes a chat session and all of its messages."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


def add_chat_message(session_id: int, role: str, content: str, citations: list = None) -> int:
    """Appends a message to a chat session and bumps the session's updated_at timestamp."""
    conn = get_db_connection()
    cursor = conn.cursor()
    citations_json = json.dumps(citations) if citations is not None else None
    cursor.execute("""
        INSERT INTO chat_messages (session_id, role, content, citations_json)
        VALUES (?, ?, ?, ?)
    """, (session_id, role, content, citations_json))
    inserted_id = cursor.lastrowid
    cursor.execute("UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return inserted_id


def get_chat_messages(session_id: int) -> list[dict]:
    """Retrieves all messages for a chat session in chronological order."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, session_id, role, content, citations_json, created_at
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC, id ASC
    """, (session_id,))
    rows = cursor.fetchall()
    conn.close()

    messages = []
    for row in rows:
        msg = dict(row)
        msg["citations"] = json.loads(msg["citations_json"]) if msg["citations_json"] else []
        del msg["citations_json"]
        messages.append(msg)
    return messages


def get_all_attempts(limit: int = 100) -> list[dict]:
    """Retrieves the list of past attempts, sorted by timestamp descending."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, timestamp, topic, question, user_answer, verdict, explanation, source_file, page_number
        FROM attempts
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def get_topic_stats() -> list[dict]:
    """
    Computes summary metrics for each topic:
    - Number of attempts
    - Accuracy percentage (treating 'Correct' as 1.0, 'Partially Correct' as 0.5, 'Incorrect' as 0.0)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            topic,
            COUNT(*) as total_attempts,
            SUM(CASE WHEN verdict = 'Correct' THEN 1.0 
                     WHEN verdict = 'Partially Correct' THEN 0.5 
                     ELSE 0.0 END) as score_sum
        FROM attempts
        GROUP BY topic
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    stats = []
    for row in rows:
        total = row["total_attempts"]
        score_sum = row["score_sum"]
        accuracy = (score_sum / total) * 100 if total > 0 else 0.0
        stats.append({
            "topic": row["topic"],
            "total_attempts": total,
            "accuracy": round(accuracy, 1)
        })
        
    return stats


def get_accuracy_over_time() -> list[dict]:
    """
    Fetches attempts sorted chronologically to evaluate student improvement.
    Returns:
        list of dicts containing timestamp, topic, numeric score (0, 0.5, or 1.0)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT timestamp, topic, verdict
        FROM attempts
        ORDER BY timestamp ASC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        verdict = row["verdict"]
        score = 0.0
        if verdict == "Correct":
            score = 1.0
        elif verdict == "Partially Correct":
            score = 0.5
            
        history.append({
            "timestamp": row["timestamp"],
            "topic": row["topic"],
            "score": score
        })
        
    return history


# Note Management CRUD
def save_note(title: str, content: str, topic: str, note_id: int = None) -> int:
    """
    Inserts a new note or updates an existing note.
    Returns the note ID.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if note_id is not None:
        cursor.execute("""
            UPDATE notes
            SET title = ?, content = ?, topic = ?, timestamp = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (title, content, topic, note_id))
        inserted_id = note_id
    else:
        cursor.execute("""
            INSERT INTO notes (title, content, topic)
            VALUES (?, ?, ?)
        """, (title, content, topic))
        inserted_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return inserted_id


def delete_note(note_id: int):
    """Deletes a note from SQLite by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()


def get_note(note_id: int) -> dict:
    """Retrieves a single note by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, title, content, topic FROM notes WHERE id = ?", (note_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_notes() -> list[dict]:
    """Retrieves all notes, ordered by timestamp descending."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, title, content, topic FROM notes ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# Automatically initialize database when db.py is run directly
if __name__ == "__main__":
    print(f"Initializing SQLite database at: {DB_FILE}")
    init_db()
    print("Database initialized successfully.")
