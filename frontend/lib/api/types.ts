export interface FileEntry {
  name: string;
  size: number;
}

export interface SourceMetadata {
  source_file: string;
  page_number: number;
  chunk_index?: number;
  is_note?: boolean;
  note_id?: number;
}

export interface QuestionResult {
  status: "success" | "error";
  message?: string;
  question?: string;
  source_chunk?: string;
  source_metadata?: SourceMetadata;
}

export type Verdict = "Correct" | "Partially Correct" | "Incorrect";

export interface GradeResult {
  status: "success" | "error";
  verdict: Verdict;
  explanation: string;
  cited_source: string;
}

export interface VagueCheckResult {
  is_vague: boolean;
  follow_up: string;
}

export interface Note {
  id: number;
  timestamp: string;
  title: string;
  content: string;
  topic: string;
}

export interface Citation {
  source: string;
  page: number | string;
  text_excerpt: string;
}

export interface ResearchQueryResult {
  answer: string;
  citations: Citation[];
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export type QuizMode = "text" | "viva";

export interface QuizSession {
  id: number;
  title: string;
  mode: QuizMode;
  topic: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attempt {
  id: number;
  timestamp: string;
  topic: string;
  question: string;
  user_answer: string;
  verdict: Verdict;
  explanation: string;
  source_file: string;
  page_number: number;
  session_id?: number | null;
}

export interface QuizSessionDetail extends QuizSession {
  attempts: Attempt[];
}

export interface TopicStat {
  topic: string;
  total_attempts: number;
  accuracy: number;
}

export interface StatsSummary {
  total_attempts: number;
  average_accuracy: number;
  weakest_topic: string;
  strongest_topic: string;
  topic_stats: TopicStat[];
  recent_attempts: Attempt[];
}

export interface TimelinePoint {
  timestamp: string;
  topic: string;
  score: number;
}

export interface TranscriptionResult {
  status: "success" | "error";
  transcription: string;
}
