/** Pure board operations. Every function takes BoardData and returns a new one;
 *  the store is a thin React wrapper and the tests run against this file. */
import { DEFAULT_PROJECT_COLOR, PALETTE } from "@/lib/color";
import {
  BOARD_VERSION,
  LEGACY_TONE_HEX,
  TASK_PRIORITIES,
  TASK_STATUSES,
  emptyBoard,
  makeId,
  type BoardData,
  type ChecklistItem,
  type Project,
  type ProjectLabel,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./types";

const now = () => new Date().toISOString();

/* ── Queries ───────────────────────────────────────────────────────────────── */

/** Tasks of one column, in board order. Archived tasks never appear on the board. */
export function tasksFor(data: BoardData, projectId: string, status: TaskStatus): Task[] {
  return data.tasks
    .filter((t) => t.projectId === projectId && t.status === status && !t.archivedAt)
    .sort((a, b) => a.order - b.order);
}

/** Archived tasks of a project, most recently archived first. */
export function archivedTasksFor(data: BoardData, projectId: string): Task[] {
  return data.tasks
    .filter((t) => t.projectId === projectId && !!t.archivedAt)
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
}

export function checklistProgress(task: Task): { done: number; total: number } {
  return { done: task.checklist.filter((i) => i.done).length, total: task.checklist.length };
}

/** Deadline passed and the task is not done. ISO dates compare lexically. */
export function isOverdue(task: Task, today: string): boolean {
  return !!task.dueDate && task.dueDate < today && task.status !== "done";
}

export function projectStats(data: BoardData, projectId: string, today: string) {
  const tasks = data.tasks.filter((t) => t.projectId === projectId && !t.archivedAt);
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
  };
}

/** Resolve a task's labels against its project, in task order. */
export function labelsOf(task: Task, project: Project | undefined): ProjectLabel[] {
  if (!project) return [];
  return task.labels
    .map((id) => project.labels.find((l) => l.id === id))
    .filter((l): l is ProjectLabel => !!l);
}

/** The color a card wears: its first label's, like Chronos blocks wear their category's. */
export function taskColor(task: Task, project: Project | undefined): string | undefined {
  return labelsOf(task, project)[0]?.color;
}

/* ── Projects ──────────────────────────────────────────────────────────────── */

export interface ProjectInput {
  name: string;
  description?: string;
  color?: string;
}

export function createProject(data: BoardData, input: ProjectInput, id = makeId()): { data: BoardData; id: string } {
  const project: Project = {
    id,
    name: input.name.trim() || "Untitled project",
    description: input.description?.trim() || undefined,
    color: input.color ?? DEFAULT_PROJECT_COLOR,
    labels: [],
    createdAt: now(),
  };
  return { data: { ...data, projects: [...data.projects, project] }, id };
}

export function updateProject(
  data: BoardData,
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "color" | "archivedAt">>,
): BoardData {
  return {
    ...data,
    projects: data.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/** Removes the project AND its tasks. */
export function deleteProject(data: BoardData, id: string): BoardData {
  return {
    ...data,
    projects: data.projects.filter((p) => p.id !== id),
    tasks: data.tasks.filter((t) => t.projectId !== id),
  };
}

/* ── Labels ────────────────────────────────────────────────────────────────── */

export function addLabel(
  data: BoardData,
  projectId: string,
  input: { name: string; color: string },
  id = makeId(),
): { data: BoardData; id: string } {
  const label: ProjectLabel = { id, name: input.name.trim() || "Label", color: input.color };
  return {
    data: {
      ...data,
      projects: data.projects.map((p) => (p.id === projectId ? { ...p, labels: [...p.labels, label] } : p)),
    },
    id,
  };
}

export function updateLabel(
  data: BoardData,
  projectId: string,
  labelId: string,
  patch: Partial<Pick<ProjectLabel, "name" | "color">>,
): BoardData {
  return {
    ...data,
    projects: data.projects.map((p) =>
      p.id === projectId
        ? { ...p, labels: p.labels.map((l) => (l.id === labelId ? { ...l, ...patch } : l)) }
        : p,
    ),
  };
}

/** Removes the label from the project and from every task that wears it. */
export function deleteLabel(data: BoardData, projectId: string, labelId: string): BoardData {
  return {
    ...data,
    projects: data.projects.map((p) =>
      p.id === projectId ? { ...p, labels: p.labels.filter((l) => l.id !== labelId) } : p,
    ),
    tasks: data.tasks.map((t) =>
      t.projectId === projectId && t.labels.includes(labelId)
        ? { ...t, labels: t.labels.filter((id) => id !== labelId) }
        : t,
    ),
  };
}

/* ── Tasks ─────────────────────────────────────────────────────────────────── */

export interface TaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  labels?: string[];
  checklist?: ChecklistItem[];
}

export function createTask(data: BoardData, input: TaskInput, id = makeId()): { data: BoardData; id: string } {
  const status = input.status ?? "todo";
  const column = tasksFor(data, input.projectId, status);
  const stamp = now();
  const task: Task = {
    id,
    projectId: input.projectId,
    title: input.title.trim() || "Untitled task",
    description: input.description?.trim() || undefined,
    status,
    priority: input.priority ?? "none",
    dueDate: input.dueDate,
    labels: input.labels ?? [],
    checklist: input.checklist ?? [],
    order: column.length,
    createdAt: stamp,
    updatedAt: stamp,
    completedAt: status === "done" ? stamp : undefined,
  };
  return { data: { ...data, tasks: [...data.tasks, task] }, id };
}

/** Move a task to (status, index) within its project, reindexing both columns.
 *  Entering "done" stamps completedAt; leaving clears it. */
export function moveTask(data: BoardData, id: string, toStatus: TaskStatus, toIndex: number): BoardData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;

  const source = tasksFor(data, task.projectId, task.status).filter((t) => t.id !== id);
  const target = toStatus === task.status ? source : tasksFor(data, task.projectId, toStatus);
  const index = Math.max(0, Math.min(toIndex, target.length));

  const moved: Task = {
    ...task,
    status: toStatus,
    updatedAt: now(),
    completedAt: toStatus === "done" ? (task.completedAt ?? now()) : undefined,
  };
  const targetOrdered = [...target.slice(0, index), moved, ...target.slice(index)];

  const orders = new Map<string, number>();
  source.forEach((t, i) => orders.set(t.id, i));
  targetOrdered.forEach((t, i) => orders.set(t.id, i));

  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id === id) return { ...moved, order: orders.get(id) ?? moved.order };
      const order = orders.get(t.id);
      return order !== undefined && order !== t.order ? { ...t, order } : t;
    }),
  };
}

export function updateTask(
  data: BoardData,
  id: string,
  patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "dueDate" | "labels" | "checklist">>,
): BoardData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;

  // A status change is a move to the end of the target column.
  let next = data;
  if (patch.status && patch.status !== task.status) {
    next = moveTask(data, id, patch.status, tasksFor(data, task.projectId, patch.status).length);
  }
  const { status: _status, ...rest } = patch;
  if (Object.keys(rest).length === 0) return next;

  return {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            ...rest,
            title: rest.title !== undefined ? rest.title.trim() || t.title : t.title,
            updatedAt: now(),
          }
        : t,
    ),
  };
}

/** Close the ordering gap a task leaves behind in its (project, status) column. */
function reindexColumn(tasks: Task[], projectId: string, status: TaskStatus): Task[] {
  const column = tasks
    .filter((t) => t.projectId === projectId && t.status === status && !t.archivedAt)
    .sort((a, b) => a.order - b.order);
  const orders = new Map(column.map((t, i) => [t.id, i] as const));
  return tasks.map((t) => {
    const order = orders.get(t.id);
    return order !== undefined && order !== t.order ? { ...t, order } : t;
  });
}

export function deleteTask(data: BoardData, id: string): BoardData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;
  return {
    ...data,
    tasks: reindexColumn(data.tasks.filter((t) => t.id !== id), task.projectId, task.status),
  };
}

/** Take a task off the board without losing it. */
export function archiveTask(data: BoardData, id: string): BoardData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task || task.archivedAt) return data;
  const stamp = now();
  const tasks = data.tasks.map((t) => (t.id === id ? { ...t, archivedAt: stamp, updatedAt: stamp } : t));
  return { ...data, tasks: reindexColumn(tasks, task.projectId, task.status) };
}

/** Restore an archived task to the end of its status column. */
export function unarchiveTask(data: BoardData, id: string): BoardData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task || !task.archivedAt) return data;
  const column = tasksFor(data, task.projectId, task.status);
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === id ? { ...t, archivedAt: undefined, order: column.length, updatedAt: now() } : t,
    ),
  };
}

/* ── Persistence guard ─────────────────────────────────────────────────────── */

interface V1Project {
  id: string;
  name: string;
  description?: string;
  tone?: string;
  createdAt?: string;
  archivedAt?: string;
}

/** Coerce anything (old versions, foreign writes, garbage) into a valid board. */
export function migrate(raw: unknown): BoardData {
  if (!raw || typeof raw !== "object") return emptyBoard();
  const obj = raw as Partial<BoardData> & { meta?: { version?: number } };
  const version = typeof obj.meta?.version === "number" ? obj.meta.version : 0;

  const projects: Project[] = Array.isArray(obj.projects)
    ? obj.projects
        .filter((p): p is Project & V1Project => !!p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string")
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: typeof p.description === "string" ? p.description : undefined,
          color:
            typeof p.color === "string" && p.color.startsWith("#")
              ? p.color
              : LEGACY_TONE_HEX[(p as V1Project).tone ?? ""] ?? DEFAULT_PROJECT_COLOR,
          labels: Array.isArray(p.labels)
            ? p.labels.filter(
                (l): l is ProjectLabel =>
                  !!l && typeof l === "object" && typeof l.id === "string" &&
                  typeof l.name === "string" && typeof l.color === "string",
              )
            : [],
          createdAt: typeof p.createdAt === "string" ? p.createdAt : now(),
          archivedAt: typeof p.archivedAt === "string" ? p.archivedAt : undefined,
        }))
    : [];

  const projectById = new Map(projects.map((p) => [p.id, p] as const));
  let tasks: Task[] = Array.isArray(obj.tasks)
    ? obj.tasks
        .filter(
          (t): t is Task =>
            !!t && typeof t === "object" && typeof t.id === "string" && typeof t.title === "string" &&
            typeof t.projectId === "string" && projectById.has(t.projectId),
        )
        .map((t, i) => ({
          ...t,
          status: TASK_STATUSES.includes(t.status) ? t.status : "todo",
          priority: TASK_PRIORITIES.includes(t.priority) ? t.priority : "none",
          labels: Array.isArray(t.labels) ? t.labels.filter((l): l is string => typeof l === "string") : [],
          checklist: Array.isArray(t.checklist)
            ? t.checklist
                .filter((c): c is ChecklistItem => !!c && typeof c === "object" && typeof c.text === "string")
                .map((c) => ({ id: typeof c.id === "string" ? c.id : makeId(), text: c.text, done: !!c.done }))
            : [],
          order: typeof t.order === "number" ? t.order : i,
          createdAt: typeof t.createdAt === "string" ? t.createdAt : now(),
          updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : now(),
          archivedAt: typeof t.archivedAt === "string" ? t.archivedAt : undefined,
        }))
    : [];

  // v1 → v2: task labels were free-form names. Promote them to project labels
  // (palette colors round-robin) and rewrite tasks to reference ids.
  if (version < 2) {
    for (const project of projects) {
      const nameToId = new Map<string, string>();
      for (const task of tasks) {
        if (task.projectId !== project.id) continue;
        for (const name of task.labels) {
          if (!nameToId.has(name)) {
            const id = makeId();
            project.labels.push({ id, name, color: PALETTE[(project.labels.length + 2) % PALETTE.length].hex });
            nameToId.set(name, id);
          }
        }
      }
      if (nameToId.size > 0) {
        tasks = tasks.map((t) =>
          t.projectId === project.id ? { ...t, labels: t.labels.map((n) => nameToId.get(n) ?? n) } : t,
        );
      }
    }
  }

  // Drop label ids that don't exist on the owning project.
  tasks = tasks.map((t) => {
    const project = projectById.get(t.projectId);
    const valid = new Set((project?.labels ?? []).map((l) => l.id));
    const labels = t.labels.filter((id) => valid.has(id));
    return labels.length === t.labels.length ? t : { ...t, labels };
  });

  return { meta: { version: BOARD_VERSION }, projects, tasks };
}
