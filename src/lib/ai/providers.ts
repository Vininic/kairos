/** Streaming chat over the user's own provider — the same BYO philosophy as
 *  Chronos' Aetheris, in a compact single-file adapter layer. All requests go
 *  straight from the browser to the provider; nothing proxies through us,
 *  EXCEPT "gemini-hosted", which routes through the suite's shared ai-proxy
 *  Supabase Edge Function (same one Chronos uses) so Aetheris works with zero
 *  setup. That key is a server secret and never reaches this bundle. */
import { loadSupabaseConfig } from "@/lib/supabase/client";
import { modelOf, type AiSettings } from "./settings";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) yield trimmed.slice(5).trim();
    }
  }
}

async function throwHttpError(res: Response): Promise<never> {
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 300);
  } catch { /* ignore */ }
  throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
}

/* ── OpenAI-compatible (OpenAI, OpenRouter, Ollama) ────────────────────────── */

function openAiBase(s: AiSettings): { url: string; headers: Record<string, string> } {
  if (s.provider === "openai") {
    return { url: "https://api.openai.com/v1", headers: { Authorization: `Bearer ${s.apiKey}` } };
  }
  if (s.provider === "openrouter") {
    return { url: "https://openrouter.ai/api/v1", headers: { Authorization: `Bearer ${s.apiKey}` } };
  }
  const base = s.baseUrl.trim().replace(/\/$/, "") || "http://localhost:11434";
  return { url: `${base}/v1`, headers: {} };
}

async function streamOpenAi(s: AiSettings, messages: ChatMessage[], onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const { url, headers } = openAiBase(s);
  const res = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model: modelOf(s), messages, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) await throwHttpError(res);
  let full = "";
  for await (const data of sseLines(res)) {
    if (data === "[DONE]") break;
    try {
      const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
      if (delta) { full += delta; onDelta(delta); }
    } catch { /* keep-alive noise */ }
  }
  return full;
}

/* ── Anthropic ─────────────────────────────────────────────────────────────── */

async function streamAnthropic(s: AiSettings, messages: ChatMessage[], onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": s.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelOf(s),
      max_tokens: 2048,
      system: system || undefined,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal,
  });
  if (!res.ok || !res.body) await throwHttpError(res);
  let full = "";
  for await (const data of sseLines(res)) {
    try {
      const evt = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
      if (evt.type === "content_block_delta" && evt.delta?.text) {
        full += evt.delta.text;
        onDelta(evt.delta.text);
      }
    } catch { /* ignore */ }
  }
  return full;
}

/* ── Gemini ────────────────────────────────────────────────────────────────── */

async function streamGemini(s: AiSettings, messages: ChatMessage[], onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelOf(s)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(s.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      }),
      signal,
    },
  );
  if (!res.ok || !res.body) await throwHttpError(res);
  let full = "";
  for await (const data of sseLines(res)) {
    try {
      const chunk = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (text) { full += text; onDelta(text); }
    } catch { /* ignore */ }
  }
  return full;
}

/* ── Gemini, hosted (shared ai-proxy, no key) ─────────────────────────────── */

/** The proxy takes one flat prompt (no message array) and returns a full
 *  completion, not SSE — same contract as Chronos' geminiProxy adapter. */
function flattenHistory(messages: ChatMessage[]): { systemPrompt?: string; prompt: string } {
  const systemPrompt = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || undefined;
  const turns = messages.filter((m) => m.role !== "system");
  const prompt = turns.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n\n");
  return { systemPrompt, prompt };
}

async function callAiProxy(
  provider: "gemini" | "openrouter",
  s: AiSettings,
  messages: ChatMessage[],
  onDelta: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const cfg = loadSupabaseConfig();
  if (!cfg) throw new Error("The hosted AI isn't available (no Supabase project configured). Add your own key in Settings instead.");
  const { systemPrompt, prompt } = flattenHistory(messages);

  let res: Response;
  try {
    res = await fetch(`${cfg.url.replace(/\/$/, "")}/functions/v1/ai-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
      body: JSON.stringify({ provider, prompt, systemPrompt, temperature: 0.5, maxTokens: 2048, model: modelOf(s) }),
      signal,
    });
  } catch {
    throw new Error("The hosted AI isn't reachable right now. Add your own API key in Settings instead.");
  }
  if (!res.ok) {
    let detail = "";
    try { detail = ((await res.json()) as { error?: string }).error ?? ""; } catch { /* ignore */ }
    if (res.status === 429) throw new Error("The shared hosted AI hit its rate limit — try again in a minute, or add your own key in Settings.");
    throw new Error(detail || `Hosted AI error ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  const text = data.text ?? "";
  onDelta(text);
  return text;
}

/* ── Entry point ───────────────────────────────────────────────────────────── */

export async function streamChat(
  settings: AiSettings,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  switch (settings.provider) {
    case "gemini-hosted":
      return callAiProxy("gemini", settings, messages, onDelta, signal);
    case "openrouter-hosted":
      return callAiProxy("openrouter", settings, messages, onDelta, signal);
    case "anthropic":
      return streamAnthropic(settings, messages, onDelta, signal);
    case "gemini":
      return streamGemini(settings, messages, onDelta, signal);
    default:
      return streamOpenAi(settings, messages, onDelta, signal);
  }
}
