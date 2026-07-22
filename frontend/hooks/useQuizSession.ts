"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { checkVague, gradeAnswer, getQuestion } from "@/lib/api/quiz";
import type { GradeResult, QuestionResult, QuizMode } from "@/lib/api/types";

export function useQuizSession(sessionId: number, mode: QuizMode, topic?: string | null) {
  const queryClient = useQueryClient();

  const [activeQuestion, setActiveQuestion] = useState<QuestionResult | null>(null);
  const [feedback, setFeedback] = useState<GradeResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isCheckingVague, setIsCheckingVague] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [originalAnswer, setOriginalAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generateQuestion = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setFeedback(null);
    setFollowUp(null);
    setOriginalAnswer("");
    try {
      const res = await getQuestion(topic ?? undefined);
      if (res.status === "success") {
        setActiveQuestion(res);
      } else {
        setError(res.message ?? "Failed to load question.");
        setActiveQuestion(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load question.");
    } finally {
      setIsGenerating(false);
    }
  }, [topic]);

  const finalizeGrade = useCallback(
    async (finalAnswer: string) => {
      if (!activeQuestion) return;
      setIsGrading(true);
      try {
        const result = await gradeAnswer(activeQuestion, finalAnswer, sessionId);
        setFeedback(result);
        queryClient.invalidateQueries({ queryKey: ["quiz-session", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to grade answer.");
      } finally {
        setIsGrading(false);
      }
    },
    [activeQuestion, sessionId, queryClient]
  );

  // Viva mode: run a vague-answer check before grading, allowing one clarifying follow-up.
  const submitVivaAnswer = useCallback(
    async (answerText: string) => {
      if (!activeQuestion?.question) return;

      if (followUp) {
        // This is the clarification response to a previously asked follow-up.
        const combined = `${originalAnswer} (Clarification: ${answerText})`;
        setFollowUp(null);
        await finalizeGrade(combined);
        return;
      }

      setOriginalAnswer(answerText);
      setIsCheckingVague(true);
      try {
        const res = await checkVague(activeQuestion.question, answerText);
        if (res.is_vague && res.follow_up) {
          setFollowUp(res.follow_up);
        } else {
          await finalizeGrade(answerText);
        }
      } catch {
        await finalizeGrade(answerText);
      } finally {
        setIsCheckingVague(false);
      }
    },
    [activeQuestion, followUp, originalAnswer, finalizeGrade]
  );

  const submitTextAnswer = useCallback(
    async (answerText: string) => {
      await finalizeGrade(answerText);
    },
    [finalizeGrade]
  );

  const submitAnswer = useCallback(
    (answerText: string) => (mode === "viva" ? submitVivaAnswer(answerText) : submitTextAnswer(answerText)),
    [mode, submitVivaAnswer, submitTextAnswer]
  );

  return {
    activeQuestion,
    feedback,
    isGenerating,
    isGrading,
    isCheckingVague,
    followUp,
    error,
    generateQuestion,
    submitAnswer,
  };
}
