import os
import sys
from dotenv import load_dotenv

# Ensure the project path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental variables from absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(script_dir, '.env'))

import db
import ingest
import dashboard
from question_gen import QuestionGenerator
from grader import AnswerGrader
from viva_mode import VivaMode


def print_banner():
    print("""
===========================================================
  🔊  VOICE-BASED EXAM PREP ASSISTANT (GROQ + RAG)  🔊
===========================================================
    """)


def show_console_stats():
    """Prints a quick summarized readout of stats directly in the terminal."""
    print("\n--- Current Study Statistics ---")
    stats = db.get_topic_stats()
    
    if not stats:
        print("No attempts logged yet. Start a quiz to populate statistics!")
        return
        
    print(f"{'Topic (Source File)':<35} | {'Attempts':<10} | {'Accuracy':<10}")
    print("-" * 65)
    
    total_attempts = 0
    accuracy_sum = 0
    
    for s in stats:
        topic_short = s["topic"]
        if len(topic_short) > 33:
            topic_short = topic_short[:30] + "..."
            
        print(f"{topic_short:<35} | {s['total_attempts']:<10} | {s['accuracy']}%")
        total_attempts += s["total_attempts"]
        accuracy_sum += s["accuracy"] * s["total_attempts"]
        
    avg_accuracy = round(accuracy_sum / total_attempts, 1) if total_attempts > 0 else 0.0
    print("-" * 65)
    print(f"{'OVERALL SUMMARY':<35} | {total_attempts:<10} | {avg_accuracy}%")


def text_quiz_loop(selected_topic: str = None):
    """Runs a standard text-based Q&A session."""
    db.init_db()
    generator = QuestionGenerator()
    grader = AnswerGrader()
    
    print("\nSelecting a question from your course material...")
    res = generator.generate_question(selected_topic)
    
    if res.get("status") == "error":
        print(f"\n[Error] {res.get('message')}")
        return
        
    question_text = res["question"]
    metadata = res["source_metadata"]
    topic = metadata.get("source_file", "General")
    page_num = metadata.get("page_number", 0)
    
    print(f"\n--- Question (Topic: {topic}, Page: {page_num}) ---")
    print(question_text)
    print("-" * 50)
    
    user_answer = input("\nYour Answer: ").strip()
    if not user_answer:
        print("Empty answer. Skipping question.")
        return
        
    print("\nGrading your answer...")
    grade_res = grader.grade_answer(res, user_answer)
    
    if grade_res.get("status") == "error":
        print(f"[Error] {grade_res.get('explanation')}")
        return
        
    print(f"\nGrade: {grade_res['verdict']}")
    print(f"Explanation: {grade_res['explanation']}")
    print(f"Citation: {grade_res['cited_source']}")
    
    # Log attempt
    try:
        db.log_attempt(
            topic=topic,
            question=question_text,
            user_answer=user_answer,
            verdict=grade_res["verdict"],
            explanation=grade_res["explanation"],
            source_file=topic,
            page_number=page_num
        )
        print("\nAttempt successfully logged to database.")
        
        # Refresh dashboard
        dashboard.generate_dashboard()
    except Exception as e:
        print(f"Error logging attempt: {e}")


def choose_topic() -> str:
    """Lets the user select a topic from those available in Chroma, or return None for weighted selection."""
    generator = QuestionGenerator()
    topics = generator.get_available_topics()
    
    if not topics:
        return None
        
    print("\n--- Available Topics ---")
    print("0. Random / Smart Weighted (Focuses on weaker areas)")
    for idx, t in enumerate(topics, 1):
        print(f"{idx}. {t}")
        
    try:
        choice = int(input("\nSelect a topic number: "))
        if choice == 0 or choice < 1 or choice > len(topics):
            return None
        return topics[choice - 1]
    except (ValueError, IndexError):
        print("Invalid choice. Using smart weighted selection.")
        return None


def main():
    db.init_db()
    
    # Create the data directory at startup if missing
    os.makedirs("data", exist_ok=True)
    
    # Check for Groq API key
    if not os.getenv("GROQ_API_KEY"):
        print("[Warning] GROQ_API_KEY environment variable is not set.")
        print("Please create a '.env' file based on '.env.template' and insert your API key.")
        print("Most features will fail until this is set.\n")

    while True:
        print_banner()
        print("1. Ingest Course Notes (Process PDFs in 'data/' folder)")
        print("2. Start Text Quiz (Type answers)")
        print("3. Start Viva Oral Exam (Speak answers aloud)")
        print("4. View Study Statistics (Terminal readout)")
        print("5. Generate Progress Dashboard (HTML report)")
        print("6. Exit")
        
        choice = input("\nSelect an option (1-6): ").strip()
        
        if choice == "1":
            print("\n--- Running PDF Ingest ---")
            ingest.ingest_pdfs()
            input("\nPress Enter to return to main menu...")
            
        elif choice == "2":
            topic = choose_topic()
            text_quiz_loop(topic)
            input("\nPress Enter to return to main menu...")
            
        elif choice == "3":
            topic = choose_topic()
            print("\n--- Starting Spoken Viva Session ---")
            print("Note: Microphone is required. Speak clearly when recording starts.")
            try:
                viva = VivaMode()
                viva.run_viva_session(topic)
            except Exception as e:
                print(f"\n[Error] Failed to run Viva Session: {e}")
            input("\nPress Enter to return to main menu...")
            
        elif choice == "4":
            show_console_stats()
            input("\nPress Enter to return to main menu...")
            
        elif choice == "5":
            print("\nGenerating dashboard...")
            try:
                path = dashboard.generate_dashboard()
                print(f"Success! Dashboard written to: {os.path.abspath(path)}")
                print("Double-click this file to open it in your web browser.")
            except Exception as e:
                print(f"Error generating dashboard: {e}")
            input("\nPress Enter to return to main menu...")
            
        elif choice == "6":
            print("\nThank you for using the Voice-Based Exam Prep Assistant! Keep studying!")
            sys.exit(0)
            
        else:
            print("\nInvalid choice. Please select between 1 and 6.")
            input("\nPress Enter to retry...")


if __name__ == "__main__":
    main()
