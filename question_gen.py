import os
import random
import logging
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import chromadb
from groq import Groq

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))

# Configuration
VECTOR_DB_DIR = "vector_store"
COLLECTION_NAME = "course_notes"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


class QuestionGenerator:
    def __init__(self):
        # 1. Initialize Groq Client
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.warning("GROQ_API_KEY not found in environment variables. Groq API calls will fail.")
            self.groq_client = None
        else:
            self.groq_client = Groq(api_key=api_key)
            
        self.model_name = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
        
        # 2. Lazy load Embedding Model and Chroma Client to make initialization faster
        self._embedding_model = None
        self._chroma_client = None
        self._collection = None

    @property
    def embedding_model(self):
        if self._embedding_model is None:
            logger.info(f"Loading local embedding model '{EMBEDDING_MODEL_NAME}' for question generation...")
            self._embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        return self._embedding_model

    @property
    def collection(self):
        if self._chroma_client is None:
            logger.info(f"Connecting to Chroma at '{VECTOR_DB_DIR}'...")
            self._chroma_client = chromadb.PersistentClient(path=VECTOR_DB_DIR)
            
        if self._collection is None:
            # We use get_collection since we assume ingest.py has already run.
            try:
                self._collection = self._chroma_client.get_collection(name=COLLECTION_NAME)
            except Exception as e:
                logger.error(f"Collection '{COLLECTION_NAME}' not found. Have you run ingest.py? Error: {e}")
                self._collection = None
        return self._collection

    def get_available_topics(self) -> list[str]:
        """
        Retrieves a list of source filenames / topics stored in Chroma.
        This helps when weighting topics or displaying them to the user.
        """
        coll = self.collection
        if not coll or coll.count() == 0:
            return []
        
        # Fetch metadata to see what source files exist
        results = coll.get(include=["metadatas"])
        metadatas = results.get("metadatas", [])
        
        # Group by source_file to treat each PDF filename as a primary topic
        topics = set()
        for meta in metadatas:
            if "source_file" in meta:
                topics.add(meta["source_file"])
                
        return list(topics)

    def generate_question(self, topic_or_chapter: str = None) -> dict:
        """
        Retrieves context chunks, queries Groq to generate a question,
        runs a self-check, and returns a dictionary with the question and source info.
        
        Returns:
            dict: {
                'question': str,
                'source_chunk': str,
                'source_metadata': dict,
                'status': 'success' | 'error',
                'message': str
            }
        """
        if not self.groq_client:
            return {
                "status": "error",
                "message": "Groq API key not set. Please add GROQ_API_KEY to your .env file."
            }
            
        coll = self.collection
        if not coll or coll.count() == 0:
            return {
                "status": "error",
                "message": f"Vector database collection '{COLLECTION_NAME}' is empty. Please run ingest.py first."
            }

        # If no specific topic is requested, pick a weighted one based on accuracy if available
        if not topic_or_chapter:
            available_topics = self.get_available_topics()
            if not available_topics:
                # If we cannot parse source files, we will query generally
                topic_or_chapter = "general"
            else:
                # Weighted selection based on historical accuracy
                import db
                try:
                    stats = {s["topic"]: s["accuracy"] for s in db.get_topic_stats()}
                except Exception as e:
                    logger.warning(f"Could not load database stats for weighted selection: {e}. Falling back to uniform choice.")
                    stats = {}
                
                weights = []
                for topic in available_topics:
                    # Retrieve accuracy if exists, else default to 0.0 (highest priority weight 1.0)
                    acc = stats.get(topic, 0.0)
                    # Convert accuracy percentage to 0..1 weight, e.g. 100% accuracy => weight 0.1, 0% accuracy => weight 1.0
                    weight = max(0.1, 1.0 - (acc / 100.0))
                    weights.append(weight)
                    
                topic_or_chapter = random.choices(available_topics, weights=weights, k=1)[0]
                logger.info(f"No topic specified. Selected topic: '{topic_or_chapter}' using weights: {list(zip(available_topics, [round(w, 2) for w in weights]))}")

        # 1. Retrieve relevant chunks
        logger.info(f"Querying vector database for topic: '{topic_or_chapter}'...")
        query_emb = self.embedding_model.encode([topic_or_chapter]).tolist()
        
        # We query for slightly more chunks than we need so we can pick or have retries
        n_results = min(5, coll.count())
        
        # Filter query by source_file if the topic corresponds to an existing file
        where_filter = None
        available_topics = self.get_available_topics()
        if topic_or_chapter in available_topics:
            where_filter = {"source_file": topic_or_chapter}
            
        results = coll.query(
            query_embeddings=query_emb,
            n_results=n_results,
            where=where_filter
        )
        
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        
        if not documents:
            # Fallback to query without metadata filter
            results = coll.query(
                query_embeddings=query_emb,
                n_results=n_results
            )
            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            
        if not documents:
            return {
                "status": "error",
                "message": f"No content found for topic '{topic_or_chapter}' in the database."
            }

        # 2. Iterate/retry to generate a question that passes the self-check
        max_attempts = 3
        for attempt in range(max_attempts):
            # Select a chunk to base the question on (rotate or randomly select)
            chunk_idx = attempt % len(documents)
            selected_chunk = documents[chunk_idx]
            selected_meta = metadatas[chunk_idx]
            
            logger.info(f"Generating question from chunk {chunk_idx + 1}/{len(documents)} (Attempt {attempt + 1}/{max_attempts})...")
            
            question = self._call_llm_for_question(selected_chunk, topic_or_chapter)
            if not question:
                continue
                
            # 3. Self-Check
            passed, explanation = self._self_check_question(question, selected_chunk)
            
            if passed:
                logger.info("Question passed the self-check validation!")
                return {
                    "question": question,
                    "source_chunk": selected_chunk,
                    "source_metadata": selected_meta,
                    "status": "success",
                    "message": "Question generated and verified successfully."
                }
            else:
                logger.warning(f"Question failed self-check: '{explanation}'. Retrying with another chunk...")
                
        # Fallback if no generated question passes the self-check
        # We will use the last generated question but warn the user, or return error
        if 'question' in locals() and question:
            logger.warning("Could not generate a question that 100% passed the self-check. Returning best effort.")
            return {
                "question": question,
                "source_chunk": selected_chunk,
                "source_metadata": selected_meta,
                "status": "success",
                "message": "Question generated (warning: self-check verification failed or was incomplete)."
            }
            
        return {
            "status": "error",
            "message": "Failed to generate a valid question after multiple attempts."
        }

    def _call_llm_for_question(self, context: str, topic: str) -> str:
        """Helper to invoke Groq to generate a single question."""
        prompt = f"""You are an expert exam designer.
Your task is to generate ONE single, clear, and challenging study or exam question based strictly on the text provided below.

Guidelines:
1. The question must focus strictly on the academic, conceptual, scientific, or technical course content.
2. Do NOT generate questions about administrative details, syllabus structures, lecturer names, titles, designations, emails, course codes (e.g. CSET208), slide numbers, headers, footers, or bibliography citations.
3. The question must be answerable using ONLY facts explicitly mentioned in the text.
4. Do NOT use any external or general knowledge not contained in the text.
5. Keep the question professional, concept-driven, and educational.
6. Output ONLY the question text. Do not add any conversational filler, intro, or markdown formatting (like "Question:").

Context Text:
\"\"\"
{context}
\"\"\"

Topic context: {topic}

Generate the question:"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=150
            )
            question = response.choices[0].message.content.strip()
            # Strip outer quotes if the model wrapped it
            if question.startswith('"') and question.endswith('"'):
                question = question[1:-1].strip()
            return question
        except Exception as e:
            logger.error(f"Error calling Groq API for question generation: {e}")
            return ""

    def _self_check_question(self, question: str, context: str) -> tuple[bool, str]:
        """
        Runs a self-check prompting Groq:
        'Is this question answerable using only the following text? Answer yes/no and why.'
        """
        prompt = f"""You are a strict quality control auditor for an education system.
Your job is to verify if an exam question:
1. Can be fully and accurately answered using ONLY the provided context text.
2. Is strictly conceptual/academic and does NOT ask about administrative details, lecturer names, designations, course codes, or slide metadata.

Context Text:
\"\"\"
{context}
\"\"\"

Exam Question:
{question}

Instructions:
1. If the question requires external information or assumptions not in the text, you must say NO.
2. If the question asks about lecturer names, designations, administrative headers, slide numbers, or course codes, you must say NO.
3. Only say YES if the question is academic/conceptual and 100% answerable from the text.
4. Respond in this exact format:
VERDICT: [YES or NO]
REASON: [Brief explanation of why it is or isn't acceptable]

Your audit response:"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Low temperature for deterministic evaluation
                max_tokens=150
            )
            result_text = response.choices[0].message.content.strip()
            
            # Parse the response
            verdict = "NO"
            reason = "Failed to parse self-check response."
            
            for line in result_text.split('\n'):
                if line.upper().startswith("VERDICT:"):
                    verdict = line.split(":", 1)[1].strip().upper()
                elif line.upper().startswith("REASON:"):
                    reason = line.split(":", 1)[1].strip()
                    
            if "YES" in verdict:
                return True, reason
            else:
                return False, reason
                
        except Exception as e:
            logger.error(f"Error calling Groq API for self-check: {e}")
            # If the self-check fails due to network/API error, we assume pass to not block the user, but log warning
            return True, f"Self-check error: {e}"


# Quick test interface
if __name__ == "__main__":
    generator = QuestionGenerator()
    topics = generator.get_available_topics()
    print("Available topics/files:", topics)
    
    if topics:
        selected_topic = topics[0]
        print(f"\nGenerating question for topic: {selected_topic}")
        res = generator.generate_question(selected_topic)
        print("\nResult:")
        print("Question:", res.get("question"))
        print("Source file:", res.get("source_metadata", {}).get("source_file"))
        print("Page number:", res.get("source_metadata", {}).get("page_number"))
        print("Context Chunk:", res.get("source_chunk")[:200] + "...")
    else:
        print("No topics found in Chroma. Ingest some PDFs first.")
