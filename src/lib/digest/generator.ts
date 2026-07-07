/** Pure heuristic modules over BoardData — no AI call, no side effects, so
 *  the digest works with zero setup and is trivial to test. Each module
 *  looks at one dimension of the board; generateDigest orders the findings
 *  by urgency (overdue and stale work first, good news last). */
import { isOverdue } from "@/lib/board/service";
import type { BoardData, Task } from "@/lib/board/types";
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

export function generateDigest(data: BoardData, today = new Date().toISOString().slice(0, 10)): Digest {
  const tasks = data.tasks.filter((t) => !t.archivedAt);

  const cards = [
    overdueCard(tasks, today),
    staleCard(tasks, today),
    dueSoonCard(tasks, today),
    imbalanceCard(data, tasks, today),
    completedCard(tasks, today),
  ].filter((c): c is ReportCard => c !== null);

  return { date: today, generatedAt: new Date().toISOString(), cards };
}
