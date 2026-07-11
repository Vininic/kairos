/** Aetheris ⇄ board protocol.
 *
 *  Provider-agnostic function calling: the system prompt teaches the model to
 *  emit a fenced ```actions block of JSON operations alongside its prose. We
 *  parse, validate against the domain, and apply through the same pure service
 *  the UI uses — with user confirmation unless autonomy is "auto".
 */
import {
  addLabel,
  archiveTask,
  createProject,
  createTask,
  deleteTask,
  moveTask,
  tasksFor,
  updateTask,
} from "@/lib/board/service";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type BoardData,
  type Project,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/board/types";
import { PALETTE } from "@/lib/color";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type AetherisAction =
  | { type: "create_project"; name: string; description?: string; color?: string }
  | {
      type: "create_task";
      project: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string;
      labels?: string[];
    }
  | {
      type: "update_task";
      id: string;
      title?: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      labels?: string[];
    }
  | { type: "move_task"; id: string; status: TaskStatus }
  | { type: "archive_task"; id: string }
  | { type: "delete_task"; id: string };

const ACTION_TYPES = ["create_project", "create_task", "update_task", "move_task", "archive_task", "delete_task"];

/** Split a model reply into prose and validated actions. Invalid entries are
 *  dropped rather than failing the whole block. */
export function parseActions(reply: string): { prose: string; actions: AetherisAction[] } {
  const match = reply.match(/```actions\s*([\s\S]*?)```/);
  if (!match) return { prose: reply.trim(), actions: [] };
  const prose = reply.replace(match[0], "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return { prose, actions: [] };
  }
  if (!Array.isArray(raw)) return { prose, actions: [] };
  const actions = raw.filter(
    (a): a is AetherisAction =>
      !!a && typeof a === "object" && ACTION_TYPES.includes((a as { type?: string }).type ?? ""),
  );
  return { prose, actions };
}

export function findProject(data: BoardData, ref: string): Project | undefined {
  return data.projects.find((p) => p.id === ref) ?? data.projects.find((p) => p.name.toLowerCase() === ref.toLowerCase());
}

/** Resolve label names to ids on a project, creating missing ones. */
function resolveLabels(data: BoardData, project: Project, names: string[]): { data: BoardData; ids: string[] } {
  let next = data;
  const ids: string[] = [];
  for (const name of names) {
    let current = next.projects.find((p) => p.id === project.id)!;
    const existing = current.labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      ids.push(existing.id);
    } else {
      const res = addLabel(next, project.id, { name, color: PALETTE[(current.labels.length + 2) % PALETTE.length].hex });
      next = res.data;
      ids.push(res.id);
    }
  }
  return { data: next, ids };
}

const clampPriority = (p?: TaskPriority) => (p && TASK_PRIORITIES.includes(p) ? p : undefined);
const clampStatus = (s?: TaskStatus) => (s && TASK_STATUSES.includes(s) ? s : undefined);

/** Apply one action; returns the new board or an error string. */
export function applyAction(data: BoardData, action: AetherisAction): BoardData | string {
  switch (action.type) {
    case "create_project": {
      if (!action.name?.trim()) return "create_project needs a name";
      return createProject(data, { name: action.name, description: action.description, color: action.color }).data;
    }
    case "create_task": {
      const project = findProject(data, action.project);
      if (!project) return `No project matches "${action.project}"`;
      if (!action.title?.trim()) return "create_task needs a title";
      let next = data;
      let labelIds: string[] = [];
      if (action.labels?.length) {
        const resolved = resolveLabels(next, project, action.labels);
        next = resolved.data;
        labelIds = resolved.ids;
      }
      return createTask(next, {
        projectId: project.id,
        title: action.title,
        description: action.description,
        status: clampStatus(action.status),
        priority: clampPriority(action.priority),
        dueDate: action.dueDate,
        labels: labelIds,
      }).data;
    }
    case "update_task": {
      const task = data.tasks.find((t) => t.id === action.id);
      if (!task) return `No task with id "${action.id}"`;
      let next = data;
      let labelIds: string[] | undefined;
      if (action.labels) {
        const project = data.projects.find((p) => p.id === task.projectId)!;
        const resolved = resolveLabels(next, project, action.labels);
        next = resolved.data;
        labelIds = resolved.ids;
      }
      return updateTask(next, action.id, {
        title: action.title,
        description: action.description,
        priority: clampPriority(action.priority),
        dueDate: action.dueDate === null ? undefined : action.dueDate,
        labels: labelIds,
      });
    }
    case "move_task": {
      const task = data.tasks.find((t) => t.id === action.id);
      if (!task) return `No task with id "${action.id}"`;
      const status = clampStatus(action.status);
      if (!status) return `Invalid status "${action.status}"`;
      return moveTask(data, action.id, status, tasksFor(data, task.projectId, status).length);
    }
    case "archive_task": {
      if (!data.tasks.some((t) => t.id === action.id)) return `No task with id "${action.id}"`;
      return archiveTask(data, action.id);
    }
    case "delete_task": {
      if (!data.tasks.some((t) => t.id === action.id)) return `No task with id "${action.id}"`;
      return deleteTask(data, action.id);
    }
  }
}

/** One human-readable line per action, for the proposal cards — localized via
 *  the active dictionary rather than hardcoded English. */
export function describeAction(data: BoardData, action: AetherisAction, K: Dictionary["kairos"]): string {
  const taskTitle = (id: string) => data.tasks.find((t) => t.id === id)?.title ?? id;
  switch (action.type) {
    case "create_project":
      return K.aetheris.describeCreateProject(action.name);
    case "create_task":
      return K.aetheris.describeCreateTask(
        action.title,
        findProject(data, action.project)?.name ?? action.project,
        action.dueDate,
        action.priority && action.priority !== "none" ? K.priority[action.priority] : undefined,
      );
    case "update_task":
      return K.aetheris.describeUpdateTask(taskTitle(action.id));
    case "move_task":
      return K.aetheris.describeMoveTask(taskTitle(action.id), K.status[action.status] ?? action.status);
    case "archive_task":
      return K.aetheris.describeArchiveTask(taskTitle(action.id));
    case "delete_task":
      return K.aetheris.describeDeleteTask(taskTitle(action.id));
  }
}
