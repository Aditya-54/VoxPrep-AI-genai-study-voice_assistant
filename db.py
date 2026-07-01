import os
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
    
    conn.commit()
    conn.close()


def log_attempt(topic: str, question: str, user_answer: str, verdict: str, explanation: str, source_file: str, page_number: int) -> int:
    """
    Logs an exam attempt to the SQLite database.
    Returns the ID of the inserted row.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO attempts (topic, question, user_answer, verdict, explanation, source_file, page_number)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (topic, question, user_answer, verdict, explanation, source_file, page_number))
    
    inserted_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return inserted_id


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
