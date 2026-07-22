import { apiDelete, apiGet, apiPost } from "./client";
import type {
  GradeResult,
  QuestionResult,
  QuizMode,
  QuizSession,
  QuizSessionDetail,
  VagueCheckResult,
} from "./types";

export function getQuestion(topic?: string): Promise<QuestionResult> {
  const query = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return apiGet<QuestionResult>(`/question${query}`);
}

export function gradeAnswer(
  questionDict: QuestionResult,
  userAnswer: string,
  sessionId?: number
): Promise<GradeResult> {
  return apiPost<GradeResult>("/grade", {
    question_dict: questionDict,
    user_answer: userAnswer,
    session_id: sessionId ?? null,
  });
}

export function checkVague(question: string, answer: string): Promise<VagueCheckResult> {
  return apiPost<VagueCheckResult>("/vague_check", { question, answer });
}

export function getQuizSessions(): Promise<QuizSession[]> {
  return apiGet<QuizSession[]>("/quiz/sessions");
}

export function createQuizSession(mode: QuizMode, topic?: string): Promise<QuizSessionDetail> {
  return apiPost<QuizSessionDetail>("/quiz/sessions", { mode, topic: topic ?? null });
}

export function getQuizSession(sessionId: number): Promise<QuizSessionDetail> {
  return apiGet<QuizSessionDetail>(`/quiz/sessions/${sessionId}`);
}

export function deleteQuizSession(sessionId: number): Promise<{ status: string; message: string }> {
  return apiDelete(`/quiz/sessions/${sessionId}`);
}
