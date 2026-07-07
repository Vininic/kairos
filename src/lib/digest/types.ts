/** A heuristic summary of the board — Kairos' equivalent of Chronos' digest,
 *  scoped to projects/tasks instead of a schedule. Deliberately deterministic
 *  (no AI call): every card is derived straight from board state, so it works
 *  the moment a board exists, with no provider key required.
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

export type ReportCard = OverdueCard | DueSoonCard | StaleCard | CompletedCard | ImbalanceCard;

export interface Digest {
  /** yyyy-MM-dd, the day this digest was generated. */
  date: string;
  generatedAt: string;
  cards: ReportCard[];
}
