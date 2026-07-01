import os
import glob
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import chromadb
import doc_parser

# Load environment variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))

# Configuration
DATA_DIR = "data"
VECTOR_DB_DIR = "vector_store"
COLLECTION_NAME = "course_notes"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VECTOR_DB_DIR, exist_ok=True)


def ingest_documents():
    """
    Extracts text from all PDFs, Word Docs (DOCX), and PowerPoint slides (PPTX)
    in the data folder, chunks them, generates embeddings locally,
    and stores them in the persistent Chroma DB.
    """
    print(f"Checking for supported documents in folder: '{DATA_DIR}'...")
    
    supported_extensions = ["*.pdf", "*.docx", "*.pptx"]
    doc_files = []
    for ext in supported_extensions:
        # Match case-insensitively by checking both lower and uppercase
        doc_files.extend(glob.glob(os.path.join(DATA_DIR, ext)))
        doc_files.extend(glob.glob(os.path.join(DATA_DIR, ext.upper())))
        
    # Deduplicate files
    doc_files = list(set(doc_files))
    
    if not doc_files:
        print(f"\n[Warning] No study documents (.pdf, .docx, .pptx) found in '{DATA_DIR}'.")
        print("Please place your study notes in the 'data/' folder and run ingestion.")
        return
        
    print(f"Found {len(doc_files)} document(s) to process.")
    
    # 1. Initialize local embedding model
    print(f"Loading local embedding model '{EMBEDDING_MODEL_NAME}'...")
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    
    # 2. Initialize Chroma client
    print(f"Connecting to Chroma database at '{VECTOR_DB_DIR}'...")
    chroma_client = chromadb.PersistentClient(path=VECTOR_DB_DIR)
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )
    
    # 3. Process each document
    for doc_path in doc_files:
        filename = os.path.basename(doc_path)
        print(f"\nProcessing '{filename}'...")
        
        try:
            # Parse document using the custom multi-format doc_parser
            chunks_data = doc_parser.parse_document(doc_path)
            
            if not chunks_data:
                print(f"No text could be extracted from '{filename}'. File might be empty, password-protected, or unsupported.")
                continue
                
            all_documents = []
            all_metadatas = []
            all_ids = []
            
            for idx, c in enumerate(chunks_data):
                # Unique ID: filename + paragraph index
                chunk_id = f"{filename}_c{idx}"
                all_documents.append(c["text"])
                all_metadatas.append(c["metadata"])
                all_ids.append(chunk_id)
                
            # Generate embeddings
            print(f"Generating embeddings for {len(all_documents)} chunks...")
            embeddings = embedding_model.encode(all_documents, show_progress_bar=True)
            
            # Upsert into Chroma
            print("Storing chunks in Chroma...")
            collection.upsert(
                ids=all_ids,
                embeddings=embeddings.tolist(),
                documents=all_documents,
                metadatas=all_metadatas
            )
            print(f"Successfully ingested '{filename}' ({len(all_documents)} chunks).")
            
        except Exception as e:
            print(f"Error processing '{filename}': {str(e)}")
            
    print(f"\nIngestion complete. Total items in collection '{COLLECTION_NAME}': {collection.count()}")


if __name__ == "__main__":
    ingest_documents()
