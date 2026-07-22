import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { ChatSession, ChatSessionDetail, ResearchQueryResult } from "./types";

export function getChatSessions(): Promise<ChatSession[]> {
  return apiGet<ChatSession[]>("/chat/sessions");
}

export function createChatSession(): Promise<ChatSessionDetail> {
  return apiPost<ChatSessionDetail>("/chat/sessions");
}

export function getChatSession(sessionId: number): Promise<ChatSessionDetail> {
  return apiGet<ChatSessionDetail>(`/chat/sessions/${sessionId}`);
}

export function renameChatSession(sessionId: number, title: string): Promise<ChatSessionDetail> {
  return apiPatch<ChatSessionDetail>(`/chat/sessions/${sessionId}`, { title });
}

export function deleteChatSession(sessionId: number): Promise<{ status: string; message: string }> {
  return apiDelete(`/chat/sessions/${sessionId}`);
}

export function sendResearchQuery(query: string, sessionId?: number): Promise<ResearchQueryResult> {
  return apiPost<ResearchQueryResult>("/research/query", { query, session_id: sessionId ?? null });
}
