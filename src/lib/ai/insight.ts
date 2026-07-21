/** AI-generated board digest — tried first, with the deterministic modules
 *  in lib/digest/generator.ts as the fallback when it's unavailable or
 *  fails. Same "AI-first, heuristic-fallback" shape as Chronos'
 *  lib/digest/generator.ts (Kairos' own generator.ts previously documented
 *  itself as "deliberately deterministic, no AI call" — a real design
 *  choice, just not the one the suite has settled on: an LLM can notice
 *  things a fixed rule set can't, like a project drifting off pace across
 *  weeks, while the heuristic still guarantees the digest is never empty
 *  and never blocks on a slow/unavailable provider). Every call is wrapped
 *  so a failure here is silent to the caller — null just means "use the
 *  heuristic", not an error state to surface. */
import { serializeBoard } from "./context";
import { streamChat, type ChatMessage } from "./providers";
import { loadAiSettings } from "./settings";
import type { BoardData } from "@/lib/board/types";

export interface AiDigestCard {
  title: string;
  body: string;
  severity: "warning" | "positive" | "insight";
}

export async function aiDigestCards(data: BoardData, localeLabel: string): Promise<AiDigestCard[] | null> {
  try {
    const settings = loadAiSettings();
    const system = `You are Aetheris, analyzing this Kanban board for Kairos' digest report. Reply in ${localeLabel}.
Return ONLY a fenced \`\`\`digest block containing a JSON array of up to 5 objects, most important first: {"title": string, "body": string, "severity": "warning"|"positive"|"insight"}. Look beyond fixed rules — a project drifting off pace across weeks, a pattern in what keeps going stale, priorities worth flagging, anything a person reviewing their own board would actually want to know. No prose outside the block.`;
    const user = `THE BOARD:\n${serializeBoard(data)}`;
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const raw = await streamChat(settings, messages, () => {});
    const match = raw.match(/```digest\s*([\s\S]*?)```/);
    if (!match) return null;
    const parsed = JSON.parse(match[1]) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (c): c is AiDigestCard =>
        !!c &&
        typeof c === "object" &&
        typeof (c as AiDigestCard).title === "string" &&
        typeof (c as AiDigestCard).body === "string" &&
        ["warning", "positive", "insight"].includes((c as AiDigestCard).severity),
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}
