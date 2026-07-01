import os
import sys

def test_imports():
    print("Checking library imports...")
    
    modules = [
        ("groq", "Groq Client"),
        ("pypdf", "PDF Reader"),
        ("sentence_transformers", "Sentence Transformers"),
        ("chromadb", "Chroma DB"),
        ("faster_whisper", "Faster Whisper"),
        ("edge_tts", "Edge TTS"),
        ("sounddevice", "Sound Device"),
        ("numpy", "NumPy"),
        ("scipy", "SciPy"),
        ("matplotlib", "Matplotlib"),
        ("dotenv", "Python Dotenv")
    ]
    
    all_passed = True
    for mod_name, desc in modules:
        try:
            __import__(mod_name)
            print(f"  [PASS] {desc} ({mod_name}) imported successfully.")
        except ImportError as e:
            print(f"  [FAIL] {desc} ({mod_name}) failed to import: {e}")
            all_passed = False
            
    return all_passed

def test_local_db():
    print("\nTesting SQLite database...")
    try:
        import db
        db.init_db()
        # Log a dummy attempt
        row_id = db.log_attempt(
            topic="Test Topic",
            question="What is 1+1?",
            user_answer="2",
            verdict="Correct",
            explanation="The answer is correct.",
            source_file="test.pdf",
            page_number=1
        )
        print(f"  [PASS] Logged dummy attempt successfully. Row ID: {row_id}")
        
        # Read it back
        attempts = db.get_all_attempts(limit=1)
        if len(attempts) > 0 and attempts[0]["topic"] == "Test Topic":
            print("  [PASS] Read dummy attempt from DB successfully.")
        else:
            print("  [FAIL] Failed to read back matching attempt from DB.")
            
        # Topic stats
        stats = db.get_topic_stats()
        if len(stats) > 0 and stats[0]["topic"] == "Test Topic":
            print("  [PASS] Topic stats computed successfully.")
        else:
            print("  [FAIL] Topic stats empty or incorrect.")
            
        # Clean up database test entries
        conn = db.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attempts WHERE topic = 'Test Topic'")
        conn.commit()
        conn.close()
        print("  [PASS] SQLite database cleaned up successfully.")
        
    except Exception as e:
        print(f"  [FAIL] SQLite database test failed: {e}")

def test_chroma():
    print("\nTesting Chroma database initialization with manual embeddings...")
    try:
        import chromadb
        from sentence_transformers import SentenceTransformer
        
        # Load local embedding model
        model = SentenceTransformer("all-MiniLM-L6-v2")
        doc_emb = model.encode(["This is a test document."]).tolist()
        query_emb = model.encode(["test document"]).tolist()
        
        client = chromadb.PersistentClient(path="test_vector_store")
        collection = client.get_or_create_collection("test_coll")
        
        collection.add(
            embeddings=doc_emb,
            documents=["This is a test document."],
            metadatas=[{"source": "test"}],
            ids=["doc1"]
        )
        
        res = collection.query(query_embeddings=query_emb, n_results=1)
        if res and len(res["documents"][0]) > 0:
            print("  [PASS] Chroma DB with manual embeddings queried successfully.")
        else:
            print("  [FAIL] Chroma DB query returned empty results.")
            
        # Delete collection instead of directory to avoid Windows process file locking
        try:
            client.delete_collection("test_coll")
            print("  [PASS] Chroma test collection cleared.")
        except Exception as e:
            print(f"  [WARNING] Failed to delete test collection: {e}")
            
    except Exception as e:
        print(f"  [FAIL] Chroma DB test failed: {e}")

def check_env():
    print("\nChecking Groq API Configuration...")
    from dotenv import load_dotenv
    load_dotenv()
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        # Hide characters for privacy
        masked_key = api_key[:6] + "..." + api_key[-4:] if len(api_key) > 10 else "..."
        print(f"  [PASS] GROQ_API_KEY found: {masked_key}")
    else:
        print("  [WARNING] GROQ_API_KEY not found in environment. Call options 2, 3, and viva will fail.")

if __name__ == "__main__":
    print("=== Exam Prep Assistant Verification Test ===\n")
    imports_ok = test_imports()
    test_local_db()
    test_chroma()
    check_env()
    print("\nVerification Test Completed.")
