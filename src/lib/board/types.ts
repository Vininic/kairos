/** Kairos domain — projects and tasks on a status board.
 *  Deliberately NOT the Chronos Commitment model: a task has a lifecycle
 *  (status/priority/deadline), not a time window. Color follows the Chronos
 *  block language: labels own color, cards wear it as a wash. */

export const BOARD_VERSION = 3;

export const TASK_STATUSES = ["backlog", "todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

export const TASK_PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** A project-owned label: the color source for task cards, like Chronos
 *  categories are for blocks. */
export interface ProjectLabel {
  id: string;
  name: string;
  /** Hex color, e.g. "#3E8A80". */
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Hex accent color for the project itself (dots, headers). */
  color: string;
  labels: ProjectLabel[];
  createdAt: string;
  archivedAt?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Deadline as "yyyy-MM-dd"; ISO strings compare lexically. */
  dueDate?: string;
  /** Ids of ProjectLabels on the owning project. The first label colors the card. */
  labels: string[];
  checklist: ChecklistItem[];
  /** Position within its (project, status) column. */
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /** Archived tasks leave the board but keep their history; restore any time. */
  archivedAt?: string;
}

export interface BoardData {
  meta: { version: number };
  projects: Project[];
  tasks: Task[];
}

export function emptyBoard(): BoardData {
  return { meta: { version: BOARD_VERSION }, projects: [], tasks: [] };
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** v1 boards stored named tones on projects; kept only for migration. */
export const LEGACY_TONE_HEX: Record<string, string> = {
  verdigris: "#3E8A80",
  ochre: "#B7863B",
  garnet: "#9C3541",
  indigo: "#35558E",
  plum: "#7D4E8C",
  slate: "#5E6B77",
};
