import os
import json
import re
import logging
from dotenv import load_dotenv
from groq import Groq

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


class AnswerGrader:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.warning("GROQ_API_KEY not found in environment variables. Groq API calls will fail.")
            self.groq_client = None
        else:
            self.groq_client = Groq(api_key=api_key)
            
        self.model_name = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)

    def grade_answer(self, question_dict: dict, user_answer: str) -> dict:
        """
        Grades the user's answer against the original source chunk context.
        
        Args:
            question_dict (dict): Contains 'question', 'source_chunk', 'source_metadata'
            user_answer (str): The text of the user's answer.
            
        Returns:
            dict: {
                'verdict': 'Correct' | 'Partially Correct' | 'Incorrect',
                'explanation': str,
                'cited_source': str,
                'status': 'success' | 'error'
            }
        """
        if not self.groq_client:
            return {
                "status": "error",
                "verdict": "Incorrect",
                "explanation": "Groq API key not set. Could not complete grading.",
                "cited_source": "N/A"
            }
            
        question = question_dict.get("question")
        context = question_dict.get("source_chunk")
        metadata = question_dict.get("source_metadata", {})
        source_file = metadata.get("source_file", "Unknown File")
        page_num = metadata.get("page_number", "Unknown Page")
        
        prompt = f"""You are an objective exam grader.
You will evaluate the Student's Answer to the Exam Question based strictly on the provided Context Text.

Exam Question:
{question}

Context Text:
\"\"\"
{context}
\"\"\"

Student's Answer:
\"\"\"
{user_answer}
\"\"\"

Grading Instructions:
1. Compare the Student's Answer to the information in the Context Text.
2. Determine if the answer is:
   - "Correct": The answer correctly addresses the question and is fully supported by the text.
   - "Partially Correct": The answer contains some correct elements but is incomplete or has minor inaccuracies compared to the text.
   - "Incorrect": The answer is wrong, irrelevant, or unsupported by the text.
3. Formulate a short, helpful explanation (1-3 sentences) detailing why this grade was given.
4. Extract a direct citation (exact quote) from the Context Text that validates the correct answer. Do not paraphrase this citation.
5. Format your entire output as a valid JSON object matching the JSON schema below. Do NOT output any preamble, extra text, or explanations outside the JSON object.

JSON Schema:
{{
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "explanation": "Brief explanation detailing why the student is correct/partially correct/incorrect.",
  "cited_source": "Exact direct quote from the Context Text that validates this topic."
}}

Grade the student's answer and output ONLY the JSON:"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2, # Lower temperature for objective grading
                response_format={"type": "json_object"} if "llama3" in self.model_name or "llama-3" in self.model_name or "mixtral" in self.model_name else None
            )
            
            response_text = response.choices[0].message.content.strip()
            result = self._parse_json_response(response_text)
            
            # Append file citation metadata to the cited source string for clear UI output
            citation_suffix = f" (Source: {source_file}, Page: {page_num})"
            if result.get("cited_source"):
                result["cited_source"] = f'"{result["cited_source"].strip()}"{citation_suffix}'
            else:
                result["cited_source"] = f"Unavailable{citation_suffix}"
                
            result["status"] = "success"
            return result
            
        except Exception as e:
            logger.error(f"Error grading answer: {e}")
            return {
                "status": "error",
                "verdict": "Incorrect",
                "explanation": f"Grading failed due to an error: {str(e)}",
                "cited_source": f"Unavailable (Source: {source_file}, Page: {page_num})"
            }

    def _parse_json_response(self, text: str) -> dict:
        """Attempts to parse JSON from the response text, with robust fallbacks."""
        # Try direct parsing first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
            
        # Try extracting JSON code fence
        match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
                
        # Try locating any block bounded by curly braces
        match = re.search(r"(\{.*\})", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
                
        # Fallback to manual parsing using simple regex
        logger.warning("Failed to parse LLM grading response as JSON. Falling back to regex extraction.")
        verdict = "Incorrect"
        explanation = "Could not parse LLM output."
        cited_source = ""
        
        v_match = re.search(r'"verdict"\s*:\s*"([^"]+)"', text)
        if v_match:
            verdict = v_match.group(1)
            
        e_match = re.search(r'"explanation"\s*:\s*"([^"]+)"', text)
        if e_match:
            explanation = e_match.group(1)
            
        c_match = re.search(r'"cited_source"\s*:\s*"([^"]+)"', text)
        if c_match:
            cited_source = c_match.group(1)
            
        return {
            "verdict": verdict,
            "explanation": explanation,
            "cited_source": cited_source
        }


# Quick test interface
if __name__ == "__main__":
    grader = AnswerGrader()
    dummy_question = {
        "question": "What is the capital of France?",
        "source_chunk": "France is a country in Europe. Its capital city is Paris, which is known for art and history.",
        "source_metadata": {
            "source_file": "geography.pdf",
            "page_number": 4
        }
    }
    
    test_answers = [
        "The capital of France is Paris.",
        "I think it's Lyon or maybe London?",
        "Paris is the capital, and it is located in Germany."
    ]
    
    for ans in test_answers:
        print(f"\nStudent Answer: '{ans}'")
        res = grader.grade_answer(dummy_question, ans)
        print("Verdict:", res.get("verdict"))
        print("Explanation:", res.get("explanation"))
        print("Citation:", res.get("cited_source"))
