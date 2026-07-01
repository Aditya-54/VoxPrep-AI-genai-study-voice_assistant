import os
import logging
from dotenv import load_dotenv
from question_gen import QuestionGenerator
from grader import AnswerGrader
from voice import VoiceManager
import db
import dashboard

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))


class VivaMode:
    def __init__(self):
        self.question_gen = QuestionGenerator()
        self.grader = AnswerGrader()
        self.voice_mgr = VoiceManager()
        
    def check_if_vague(self, question: str, answer: str) -> tuple[bool, str]:
        """
        Asks the Groq LLM if the user's answer is too vague or incomplete.
        Returns:
            (is_vague: bool, follow_up_question: str)
        """
        if not self.question_gen.groq_client:
            return False, ""
            
        prompt = f"""You are a supportive oral exam proctor.
Evaluate the Student's Answer to the Exam Question.
Determine if the answer is too brief, vague, or missing specific details to be graded accurately, but could be answered with a quick clarification.

Rules:
1. If the student clearly answered correctly, or clearly answered incorrectly, or is completely off-topic, respond with "NO". Do not ask a follow-up.
2. If the student's answer is partially correct but lacks detail/specificity (e.g. they say "it increases it" without explaining what "it" is or how), and you need just a small detail to grade them fairly, ask ONE brief, simple follow-up question.
3. Keep the follow-up extremely brief, supportive, and under 15 words.

Exam Question:
{question}

Student's Answer:
{answer}

Format your response in one of these two ways:
- If vague: FOLLOW_UP: [Your short follow-up question]
- If NOT vague: NO

Response:"""

        try:
            response = self.question_gen.groq_client.chat.completions.create(
                model=self.question_gen.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=60
            )
            resp_text = response.choices[0].message.content.strip()
            
            if resp_text.upper().startswith("FOLLOW_UP:"):
                follow_up = resp_text[len("FOLLOW_UP:"):].strip()
                return True, follow_up
            return False, ""
        except Exception as e:
            logger.error(f"Error checking for vague answer: {e}")
            return False, ""

    def run_viva_session(self, selected_topic: str = None):
        """Runs a single viva oral exam question-and-answer loop."""
        db.init_db()
        
        # 1. Generate a question
        print("\nSelecting a question from your course material...")
        res = self.question_gen.generate_question(selected_topic)
        
        if res.get("status") == "error":
            print(f"\n[Error] {res.get('message')}")
            return
            
        question_text = res["question"]
        source_chunk = res["source_chunk"]
        metadata = res["source_metadata"]
        topic = metadata.get("source_file", "General")
        page_num = metadata.get("page_number", 0)
        
        print(f"\n--- New Question (Topic: {topic}, Page: {page_num}) ---")
        
        # 2. Speak the question aloud
        self.voice_mgr.speak(question_text)
        
        # 3. Record and transcribe response
        user_answer = ""
        success = self.voice_mgr.record_voice()
        if success:
            user_answer = self.voice_mgr.transcribe_voice()
            print(f"You said: '{user_answer}'")
        
        # Fallback to typing if speech capture fails or transcription is empty
        if not user_answer.strip():
            print("\nSpeech capture was empty or failed. Please type your answer below:")
            user_answer = input("Your Answer: ").strip()
            
        if not user_answer:
            print("No answer provided. Skipping question.")
            return

        # 4. Check if vague and ask for follow-up (max 1 follow-up)
        is_vague, follow_up_q = self.check_if_vague(question_text, user_answer)
        
        final_answer = user_answer
        if is_vague and follow_up_q:
            print(f"\n[Follow-up triggered: Answer is vague/incomplete]")
            # Speak follow-up
            self.voice_mgr.speak(follow_up_q)
            
            # Record follow-up answer
            follow_up_success = self.voice_mgr.record_voice()
            follow_up_answer = ""
            if follow_up_success:
                follow_up_answer = self.voice_mgr.transcribe_voice()
                print(f"You said (clarification): '{follow_up_answer}'")
                
            if not follow_up_answer.strip():
                print("\nSpeech capture was empty. Please type your clarification below:")
                follow_up_answer = input("Clarification: ").strip()
                
            if follow_up_answer:
                final_answer = f"{user_answer} (Clarification: {follow_up_answer})"
            
        # 5. Grade the final answer
        print("\nGrading your answer...")
        grade_res = self.grader.grade_answer(res, final_answer)
        
        verdict = grade_res.get("verdict", "Incorrect")
        explanation = grade_res.get("explanation", "Could not compile explanation.")
        citation = grade_res.get("cited_source", "No citation generated.")
        
        # 6. Speak the verdict and brief explanation
        feedback_speech = f"Your answer was graded as {verdict}. {explanation}"
        self.voice_mgr.speak(feedback_speech)
        
        # 7. Print the citation
        print(f"\nCitation from Notes:")
        print(f"  {citation}")
        
        # 8. Log the attempt to SQLite
        try:
            attempt_id = db.log_attempt(
                topic=topic,
                question=question_text,
                user_answer=final_answer,
                verdict=verdict,
                explanation=explanation,
                source_file=topic,
                page_number=page_num
            )
            logger.info(f"Attempt logged to database (ID: {attempt_id}).")
            
            # 9. Re-generate the dashboard HTML report
            dashboard.generate_dashboard()
            
        except Exception as e:
            logger.error(f"Failed to log attempt or generate dashboard: {e}")


if __name__ == "__main__":
    viva = VivaMode()
    viva.run_viva_session()
