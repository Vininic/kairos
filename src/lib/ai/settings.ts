/** Aetheris settings — stored ONLY in this browser.
 *  The board sync engine mirrors a single localStorage key (the board), so
 *  these settings — and any BYO API key — never leave the device. */

export type AiProvider = "gemini-hosted" | "openrouter-hosted" | "gemini" | "openai" | "anthropic" | "openrouter" | "ollama";
export type AiAutonomy = "suggest" | "auto";

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
  /** Ollama only. */
  baseUrl: string;
  autonomy: AiAutonomy;
}

const KEY = "kairos.ai-settings.v1";

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  "gemini-hosted": "Gemini (Hosted, free)",
  "openrouter-hosted": "OpenRouter (Hosted, free)",
  gemini: "Google Gemini (own key)",
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter (own key)",
  ollama: "Ollama (local)",
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  "gemini-hosted": "gemini-3.1-flash-lite",
  "openrouter-hosted": "meta-llama/llama-3.3-70b-instruct:free",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
  openrouter: "google/gemini-2.5-flash",
  ollama: "llama3.1",
};

/** Zero-setup default: routes through the suite's shared ai-proxy, same as
 *  Chronos' "Gemini (Hosted)" option — no key, no signup, works immediately. */
export function defaultAiSettings(): AiSettings {
  return { provider: "gemini-hosted", apiKey: "", model: "", baseUrl: "", autonomy: "suggest" };
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultAiSettings();
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return { ...defaultAiSettings(), ...parsed };
  } catch {
    return defaultAiSettings();
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

const NO_KEY_PROVIDERS: AiProvider[] = ["ollama", "gemini-hosted", "openrouter-hosted"];

/** Ollama and the hosted proxies need no key; everything else does. */
export function isConfigured(s: AiSettings): boolean {
  return NO_KEY_PROVIDERS.includes(s.provider) ? true : s.apiKey.trim().length > 0;
}

export function modelOf(s: AiSettings): string {
  return s.model.trim() || DEFAULT_MODELS[s.provider];
}
