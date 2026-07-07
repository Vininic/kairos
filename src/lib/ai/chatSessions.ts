/** Aetheris chat sessions — multiple named threads, mirroring Chronos' chat
 *  store but scoped to what Kairos actually needs (no attachments/tool audit).
 *  Local-first: lives entirely in this browser's localStorage. */

export interface UiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  /** Empty until the first user message names it. */
  title: string;
  messages: UiMessage[];
  createdAt: string;
}

const KEY = "kairos.chat-sessions.v1";
const MAX_SESSIONS = 20;
const MAX_MESSAGES = 40;

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newSession(): ChatSession {
  return { id: makeSessionId(), title: "", messages: [], createdAt: new Date().toISOString() };
}

export function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    const trimmed = sessions
      .slice(0, MAX_SESSIONS)
      .map((s) => ({ ...s, messages: s.messages.slice(-MAX_MESSAGES) }));
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or unavailable — keep running in memory */
  }
}
