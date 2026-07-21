/** Kairos' board digest — tries the AI pass first (lib/ai/insight.ts) and
 *  falls back to the heuristic modules below when it's unavailable, fails,
 *  or returns nothing usable. See types.ts for the full rationale; this
 *  file used to be "pure heuristic, no AI call, no side effects" — the
 *  heuristic modules are unchanged, just demoted to fallback. */
import { isOverdue } from "@/lib/board/service";
import type { BoardData, Task } from "@/lib/board/types";
import { aiDigestCards } from "@/lib/ai/insight";
import type { Digest, ReportCard } from "./types";

const DUE_SOON_DAYS = 7;
const STALE_DAYS = 3;
const COMPLETED_SINCE_DAYS = 7;
const SAMPLE_SIZE = 3;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function overdueCard(tasks: Task[], today: string): ReportCard | null {
  const list = tasks.filter((t) => isOverdue(t, today));
  if (list.length === 0) return null;
  return { kind: "overdue", severity: "warning", count: list.length, sample: list.slice(0, SAMPLE_SIZE).map((t) => t.title) };
}

function dueSoonCard(tasks: Task[], today: string): ReportCard | null {
  const limit = addDays(today, DUE_SOON_DAYS);
  const list = tasks
    .filter((t) => t.status !== "done" && t.dueDate && t.dueDate >= today && t.dueDate <= limit)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  if (list.length === 0) return null;
  return { kind: "dueSoon", severity: "insight", count: list.length, sample: list.slice(0, SAMPLE_SIZE).map((t) => t.title) };
}

function staleCard(tasks: Task[], today: string): ReportCard | null {
  const cutoff = addDays(today, -STALE_DAYS);
  const list = tasks.filter((t) => t.status === "doing" && t.updatedAt.slice(0, 10) <= cutoff);
  if (list.length === 0) return null;
  return { kind: "stale", severity: "warning", count: list.length, sample: list.slice(0, SAMPLE_SIZE).map((t) => t.title) };
}

function completedCard(tasks: Task[], today: string): ReportCard | null {
  const since = addDays(today, -COMPLETED_SINCE_DAYS);
  const list = tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 10) >= since);
  if (list.length === 0) return null;
  return { kind: "completed", severity: "positive", count: list.length };
}

/** The project with the most overdue work, if any project has 2+ overdue tasks. */
function imbalanceCard(data: BoardData, tasks: Task[], today: string): ReportCard | null {
  const byProject = data.projects
    .filter((p) => !p.archivedAt)
    .map((p) => ({ project: p, overdueCount: tasks.filter((t) => t.projectId === p.id && isOverdue(t, today)).length }))
    .filter((p) => p.overdueCount >= 2)
    .sort((a, b) => b.overdueCount - a.overdueCount);
  const top = byProject[0];
  if (!top) return null;
  return { kind: "imbalance", severity: "insight", projectName: top.project.name, overdueCount: top.overdueCount };
}

function heuristicCards(data: BoardData, today: string): ReportCard[] {
  const tasks = data.tasks.filter((t) => !t.archivedAt);
  return [
    overdueCard(tasks, today),
    staleCard(tasks, today),
    dueSoonCard(tasks, today),
    imbalanceCard(data, tasks, today),
    completedCard(tasks, today),
  ].filter((c): c is ReportCard => c !== null);
}

export async function generateDigest(
  data: BoardData,
  localeLabel: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<Digest> {
  const ai = await aiDigestCards(data, localeLabel);
  if (ai && ai.length > 0) {
    return {
      date: today,
      generatedAt: new Date().toISOString(),
      cards: ai.map((c): ReportCard => ({ kind: "ai", title: c.title, body: c.body, severity: c.severity })),
      generatedBy: "ai",
    };
  }
  return {
    date: today,
    generatedAt: new Date().toISOString(),
    cards: heuristicCards(data, today),
    generatedBy: "heuristic",
  };
}
