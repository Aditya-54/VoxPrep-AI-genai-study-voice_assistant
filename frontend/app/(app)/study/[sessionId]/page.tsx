"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mic, Sparkles, Type } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionCard } from "@/components/study/QuestionCard";
import { VerdictBadge } from "@/components/study/VerdictBadge";
import { VoiceRecorderButton } from "@/components/voice/VoiceRecorderButton";
import { useQuizSession } from "@/hooks/useQuizSession";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { getQuizSession } from "@/lib/api/quiz";

export default function ActiveStudySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = Number(params.sessionId);

  const { data: session, isLoading } = useQuery({
    queryKey: ["quiz-session", sessionId],
    queryFn: () => getQuizSession(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const mode = session?.mode ?? "text";
  const {
    activeQuestion,
    feedback,
    isGenerating,
    isGrading,
    isCheckingVague,
    followUp,
    error,
    generateQuestion,
    submitAnswer,
  } = useQuizSession(sessionId, mode, session?.topic);

  const recorder = useVoiceRecorder();
  const { isSpeaking, speak } = useAudioPlayback();
  const [textAnswer, setTextAnswer] = useState("");
  const lastSpokenRef = useRef<string | null>(null);

  // Auto-speak the question (and any follow-up) when in viva mode.
  useEffect(() => {
    if (mode !== "viva") return;
    const toSpeak = followUp ?? activeQuestion?.question;
    if (toSpeak && lastSpokenRef.current !== toSpeak) {
      lastSpokenRef.current = toSpeak;
      speak(toSpeak);
    }
  }, [mode, activeQuestion, followUp, speak]);

  // Auto-speak the grading verdict in viva mode.
  useEffect(() => {
    if (mode === "viva" && feedback?.status === "success") {
      speak(`Your answer was graded as ${feedback.verdict}. ${feedback.explanation}`);
    }
  }, [mode, feedback, speak]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  async function handleVivaStop() {
    const transcript = await recorder.stop();
    if (transcript) {
      await submitAnswer(transcript);
    }
  }

  function handleTextSubmit() {
    if (!textAnswer.trim()) {
      toast.error("Please type an answer first.");
      return;
    }
    submitAnswer(textAnswer.trim());
  }

  function handleNextQuestion() {
    setTextAnswer("");
    generateQuestion();
  }

  if (isLoading) {
    return (
      <>
        <TopBar title="Study Session" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <TopBar title="Study Session" />
        <div className="p-6 text-sm text-muted-foreground">Session not found.</div>
      </>
    );
  }

  return (
    <>
      <TopBar title={session.title} description={session.topic ?? "Smart weighted across your library"} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push("/study")}>
            <ArrowLeft className="size-4" /> Back to Study Center
          </Button>
          <Badge variant="secondary" className="gap-1.5">
            {mode === "viva" ? <Mic className="size-3.5" /> : <Type className="size-3.5" />}
            {mode === "viva" ? "Spoken Viva" : "Text Quiz"}
          </Badge>
        </div>

        {session.attempts.length > 0 && !activeQuestion && (
          <Card>
            <CardContent className="space-y-3 py-4">
              <p className="text-sm font-medium text-muted-foreground">Session transcript</p>
              <ul className="space-y-3">
                {session.attempts.map((a) => (
                  <li key={a.id} className="rounded-lg border p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{a.question}</p>
                      <VerdictBadge verdict={a.verdict} className="shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground">{a.explanation}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!activeQuestion ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Sparkles className="size-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                {session.attempts.length > 0 ? "Ready for another question?" : "Generate your first question to begin."}
              </p>
              <Button onClick={generateQuestion} disabled={isGenerating} className="gap-2">
                {isGenerating && <Loader2 className="size-4 animate-spin" />}
                {isGenerating ? "Retrieving..." : "Generate Question"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <QuestionCard
              question={activeQuestion.question ?? ""}
              metadata={activeQuestion.source_metadata}
              isSpeaking={isSpeaking}
              onSpeak={() => speak(activeQuestion.question ?? "")}
            />

            {followUp && (
              <Card className="border-verdict-partial/40 bg-verdict-partial/5">
                <CardContent className="py-4">
                  <p className="text-sm font-medium text-verdict-partial">Proctor follow-up</p>
                  <p className="mt-1 text-sm">{followUp}</p>
                </CardContent>
              </Card>
            )}

            {!feedback && (
              <Card>
                <CardContent className="py-5">
                  {mode === "text" ? (
                    <div className="flex flex-col gap-3">
                      <Textarea
                        placeholder="Type your detailed answer here..."
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        className="min-h-32"
                        disabled={isGrading}
                      />
                      <Button onClick={handleTextSubmit} disabled={isGrading} className="gap-2 self-end">
                        {isGrading && <Loader2 className="size-4 animate-spin" />}
                        {isGrading ? "Grading..." : "Submit Answer"}
                      </Button>
                    </div>
                  ) : (
                    <VoiceRecorderButton
                      state={
                        isCheckingVague || isGrading
                          ? "transcribing"
                          : recorder.state
                      }
                      seconds={recorder.seconds}
                      onStart={recorder.start}
                      onStop={handleVivaStop}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {feedback && (
              <Card
                className={
                  feedback.verdict === "Correct"
                    ? "border-verdict-correct/40"
                    : feedback.verdict === "Incorrect"
                    ? "border-verdict-incorrect/40"
                    : "border-verdict-partial/40"
                }
              >
                <CardContent className="space-y-3 py-5">
                  <div className="flex items-center justify-between">
                    <VerdictBadge verdict={feedback.verdict} />
                  </div>
                  <p className="text-sm">{feedback.explanation}</p>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Context Citation
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{feedback.cited_source}</p>
                  </div>
                  <Button onClick={handleNextQuestion} disabled={isGenerating} className="gap-2">
                    {isGenerating && <Loader2 className="size-4 animate-spin" />}
                    Next Question
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
