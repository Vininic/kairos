/** A summary of the board — Kairos' equivalent of Chronos' digest, scoped
 *  to projects/tasks instead of a schedule. Tries the AI pass
 *  (lib/ai/insight.ts) first, same AI-first/heuristic-fallback shape as
 *  Chronos' own lib/digest/generator.ts; the heuristic cards below are the
 *  fallback, not the primary path (previously documented here as
 *  "deliberately deterministic, no AI call" — a real design choice at the
 *  time, just not the one the suite settled on). The heuristic guarantees
 *  the digest is never empty and never blocks on a slow/unavailable
 *  provider, so it works the moment a board exists, with no provider key
 *  required.
 *
 *  Unlike Chronos' digest, this has no daily/weekly mode: overdue, stale and
 *  imbalance findings are facts about the board right now, not something a
 *  calendar period changes. Only the due-soon and completed-lately windows
 *  are time-bounded, and those use one fixed, sensible horizon. */

export interface OverdueCard { kind: "overdue"; severity: "warning"; count: number; sample: string[] }
export interface DueSoonCard { kind: "dueSoon"; severity: "insight"; count: number; sample: string[] }
export interface StaleCard { kind: "stale"; severity: "warning"; count: number; sample: string[] }
export interface CompletedCard { kind: "completed"; severity: "positive"; count: number }
export interface ImbalanceCard { kind: "imbalance"; severity: "insight"; projectName: string; overdueCount: number }
/** AI-narrated card — title/body come straight from the model instead of an
 *  i18n template. */
export interface AiCard { kind: "ai"; title: string; body: string; severity: "warning" | "positive" | "insight" }

export type ReportCard = OverdueCard | DueSoonCard | StaleCard | CompletedCard | ImbalanceCard | AiCard;

export interface Digest {
  /** yyyy-MM-dd, the day this digest was generated. */
  date: string;
  generatedAt: string;
  cards: ReportCard[];
  /** Whether this run's cards came from the AI attempt or the deterministic
   *  fallback — surfaced in the UI as a small badge, same convention as
   *  Chronos' digest cards. */
  generatedBy: "ai" | "heuristic";
}
