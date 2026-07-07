/** Board ⇄ Markdown, for editing a project with a text editor or an agent
 *  instead of the UI. Export produces plain GFM task lists; import re-parses
 *  them and *merges* into the existing board (matched by project/task title)
 *  rather than replacing it — so "export, hand to an agent, reimport" is a
 *  diff-apply, not a destructive overwrite.
 *
 *  Headings are always the English STATUS_LABELS, regardless of UI locale —
 *  one canonical vocabulary keeps export→import round-trips unambiguous,
 *  the same choice context.ts makes for the AI-facing board serialization. */
import { addLabel, createProject, createTask, tasksFor, updateTask } from "./service";
import { STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type BoardData, type Project, type TaskPriority, type TaskStatus } from "./types";
import { PALETTE } from "@/lib/color";

function labelToTag(name: string): string {
  return `#${name.trim().replace(/\s+/g, "-")}`;
}

function tagToLabel(tag: string): string {
  return tag.replace(/^#/, "").replace(/-/g, " ");
}

export function exportProjectMarkdown(data: BoardData, projectId: string): string {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return "";
  const lines: string[] = [`# ${project.name}`];
  if (project.description) lines.push("", `> ${project.description}`);

  for (const status of TASK_STATUSES) {
    lines.push("", `## ${STATUS_LABELS[status]}`);
    for (const task of tasksFor(data, projectId, status)) {
      const bits: string[] = [];
      if (task.dueDate) bits.push(`\`${task.dueDate}\``);
      if (task.priority !== "none") bits.push(`\`${task.priority}\``);
      const tags = task.labels
        .map((id) => project.labels.find((l) => l.id === id))
        .filter((l): l is Project["labels"][number] => !!l)
        .map((l) => labelToTag(l.name));
      const meta = [...bits, ...tags].join(" ");
      lines.push(`- [${task.status === "done" ? "x" : " "}] ${task.title}${meta ? ` ${meta}` : ""}`);
      for (const item of task.checklist) {
        lines.push(`  - [${item.done ? "x" : " "}] ${item.text}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Every active project, one after another. Archived projects are skipped —
 *  same convention as the board's own views. */
export function exportBoardMarkdown(data: BoardData): string {
  return data.projects
    .filter((p) => !p.archivedAt)
    .map((p) => exportProjectMarkdown(data, p.id))
    .join("\n---\n\n");
}

interface ParsedTaskLine {
  title: string;
  done: boolean;
  priority?: TaskPriority;
  dueDate?: string;
  labels: string[];
}

function parseTaskLine(line: string): ParsedTaskLine | null {
  const m = /^-\s\[([ xX])\]\s+(.+)$/.exec(line);
  if (!m) return null;
  const done = m[1].toLowerCase() === "x";
  let rest = m[2];
  const labels: string[] = [];
  let priority: TaskPriority | undefined;
  let dueDate: string | undefined;

  rest = rest.replace(/`(\d{4}-\d{2}-\d{2})`/, (_, d: string) => { dueDate = d; return ""; });
  rest = rest.replace(new RegExp(`\`(${TASK_PRIORITIES.filter((p) => p !== "none").join("|")})\``, "i"), (_, p: string) => {
    priority = p.toLowerCase() as TaskPriority;
    return "";
  });
  rest = rest.replace(/#(\S+)/g, (tag: string) => { labels.push(tagToLabel(tag)); return ""; });

  return { title: rest.trim(), done, priority, dueDate, labels };
}

const STATUS_BY_HEADING = new Map(TASK_STATUSES.map((s) => [STATUS_LABELS[s].toLowerCase(), s]));

function importProjectBlock(block: string, data: BoardData): BoardData {
  const lines = block.split("\n");
  const titleLine = lines.find((l) => l.startsWith("# "));
  if (!titleLine) return data;
  const name = titleLine.slice(2).trim();
  if (!name) return data;

  let board = data;
  let project = board.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!project) {
    const res = createProject(board, { name });
    board = res.data;
    project = board.projects.find((p) => p.id === res.id)!;
  }
  const projectId = project.id;

  let currentStatus: TaskStatus | null = null;
  let pendingTaskId: string | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentStatus = STATUS_BY_HEADING.get(line.slice(3).trim().toLowerCase()) ?? null;
      pendingTaskId = null;
      continue;
    }
    if (currentStatus === null) continue;

    const step = /^\s{2,}-\s\[([ xX])\]\s+(.+)$/.exec(line);
    if (step && pendingTaskId) {
      const done = step[1].toLowerCase() === "x";
      const text = step[2].trim();
      const task = board.tasks.find((t) => t.id === pendingTaskId)!;
      const existing = task.checklist.find((i) => i.text === text);
      const checklist = existing
        ? task.checklist.map((i) => (i.id === existing.id ? { ...i, done } : i))
        : [...task.checklist, { id: crypto.randomUUID(), text, done }];
      board = updateTask(board, pendingTaskId, { checklist });
      continue;
    }

    const parsed = parseTaskLine(line);
    if (!parsed || !parsed.title) continue;

    const labelIds: string[] = [];
    for (const labelName of parsed.labels) {
      let current = board.projects.find((p) => p.id === projectId)!;
      let label = current.labels.find((l) => l.name.toLowerCase() === labelName.toLowerCase());
      if (!label) {
        const res = addLabel(board, projectId, { name: labelName, color: PALETTE[(current.labels.length + 2) % PALETTE.length].hex });
        board = res.data;
        current = board.projects.find((p) => p.id === projectId)!;
        label = current.labels.find((l) => l.id === res.id)!;
      }
      labelIds.push(label.id);
    }

    const status: TaskStatus = parsed.done ? "done" : currentStatus;
    const existingTask = board.tasks.find((t) => t.projectId === projectId && !t.archivedAt && t.title === parsed.title);
    if (existingTask) {
      board = updateTask(board, existingTask.id, { status, priority: parsed.priority ?? "none", dueDate: parsed.dueDate, labels: labelIds });
      pendingTaskId = existingTask.id;
    } else {
      const res = createTask(board, { projectId, title: parsed.title, status, priority: parsed.priority, dueDate: parsed.dueDate, labels: labelIds });
      board = res.data;
      pendingTaskId = res.id;
    }
  }

  return board;
}

/** Parse one or more `# Project` blocks (separated by a `---` line, matching
 *  the export format) and merge them into `data` — existing projects/tasks
 *  are matched by exact title and updated in place; new ones are created.
 *  Throws if the file has no recognizable `# Project` heading at all, rather
 *  than silently no-oping and letting the caller report a false success. */
export function importMarkdown(md: string, data: BoardData): BoardData {
  const blocks = md.split(/\n-{3,}\n/).map((b) => b.trim()).filter(Boolean);
  const hasHeading = blocks.some((b) => b.split("\n").some((l) => l.startsWith("# ") && l.slice(2).trim()));
  if (!hasHeading) throw new Error("No recognizable '# Project' heading found");
  return blocks.reduce((board, block) => importProjectBlock(block, board), data);
}
