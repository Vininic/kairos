import { describe, expect, it } from "vitest";
import {
  addLabel,
  archiveTask,
  archivedTasksFor,
  checklistProgress,
  createProject,
  createTask,
  deleteLabel,
  deleteProject,
  deleteTask,
  isOverdue,
  migrate,
  moveTask,
  projectStats,
  taskColor,
  tasksFor,
  unarchiveTask,
  updateLabel,
  updateTask,
} from "./service";
import { BOARD_VERSION, emptyBoard, type BoardData } from "./types";

function seed(): { data: BoardData; projectId: string; ids: string[] } {
  let { data, id: projectId } = createProject(emptyBoard(), { name: "Atlas" });
  const ids: string[] = [];
  for (const title of ["a", "b", "c"]) {
    const res = createTask(data, { projectId, title });
    data = res.data;
    ids.push(res.id);
  }
  return { data, projectId, ids };
}

describe("projects", () => {
  it("creates a project with defaults", () => {
    const { data, id } = createProject(emptyBoard(), { name: "  Atlas  " });
    const project = data.projects.find((p) => p.id === id)!;
    expect(project.name).toBe("Atlas");
    expect(project.color).toBe("#B96A82");
    expect(project.labels).toEqual([]);
  });

  it("falls back to a name when blank", () => {
    const { data, id } = createProject(emptyBoard(), { name: "   " });
    expect(data.projects.find((p) => p.id === id)!.name).toBe("Untitled project");
  });

  it("deleting a project cascades to its tasks", () => {
    const { data, projectId } = seed();
    const next = deleteProject(data, projectId);
    expect(next.projects).toHaveLength(0);
    expect(next.tasks).toHaveLength(0);
  });
});

describe("tasks", () => {
  it("appends new tasks to the end of their column", () => {
    const { data, projectId, ids } = seed();
    expect(tasksFor(data, projectId, "todo").map((t) => t.id)).toEqual(ids);
    expect(tasksFor(data, projectId, "todo").map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it("reorders within a column", () => {
    const { data, projectId, ids } = seed();
    const next = moveTask(data, ids[2], "todo", 0);
    expect(tasksFor(next, projectId, "todo").map((t) => t.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(tasksFor(next, projectId, "todo").map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it("moves across columns and stamps completedAt on done", () => {
    const { data, projectId, ids } = seed();
    const next = moveTask(data, ids[0], "done", 0);
    const moved = next.tasks.find((t) => t.id === ids[0])!;
    expect(moved.status).toBe("done");
    expect(moved.completedAt).toBeTruthy();
    expect(tasksFor(next, projectId, "todo").map((t) => t.order)).toEqual([0, 1]);
  });

  it("clears completedAt when leaving done", () => {
    const { data, ids } = seed();
    const done = moveTask(data, ids[0], "done", 0);
    const back = moveTask(done, ids[0], "doing", 0);
    expect(back.tasks.find((t) => t.id === ids[0])!.completedAt).toBeUndefined();
  });

  it("clamps the target index", () => {
    const { data, projectId, ids } = seed();
    const next = moveTask(data, ids[0], "doing", 99);
    expect(tasksFor(next, projectId, "doing").map((t) => t.id)).toEqual([ids[0]]);
  });

  it("updateTask with a status change lands at the end of the target column", () => {
    const { data, projectId, ids } = seed();
    const withOne = moveTask(data, ids[0], "doing", 0);
    const next = updateTask(withOne, ids[1], { status: "doing" });
    expect(tasksFor(next, projectId, "doing").map((t) => t.id)).toEqual([ids[0], ids[1]]);
  });

  it("updateTask patches fields without touching order", () => {
    const { data, ids } = seed();
    const next = updateTask(data, ids[1], { title: "renamed", priority: "urgent", dueDate: "2026-07-10" });
    const task = next.tasks.find((t) => t.id === ids[1])!;
    expect(task.title).toBe("renamed");
    expect(task.priority).toBe("urgent");
    expect(task.order).toBe(1);
  });

  it("deleteTask closes the gap in its column", () => {
    const { data, projectId, ids } = seed();
    const next = deleteTask(data, ids[1]);
    expect(tasksFor(next, projectId, "todo").map((t) => t.id)).toEqual([ids[0], ids[2]]);
    expect(tasksFor(next, projectId, "todo").map((t) => t.order)).toEqual([0, 1]);
  });
});

describe("labels", () => {
  it("adds, renames and recolors a label", () => {
    const { data, projectId } = seed();
    const { data: withLabel, id } = addLabel(data, projectId, { name: "design", color: "#7D4E8C" });
    expect(withLabel.projects[0].labels).toEqual([{ id, name: "design", color: "#7D4E8C" }]);
    const renamed = updateLabel(withLabel, projectId, id, { name: "ui", color: "#35558E" });
    expect(renamed.projects[0].labels[0]).toEqual({ id, name: "ui", color: "#35558E" });
  });

  it("the first label colors the card", () => {
    const { data, projectId, ids } = seed();
    const { data: withLabel, id } = addLabel(data, projectId, { name: "api", color: "#B7863B" });
    const next = updateTask(withLabel, ids[0], { labels: [id] });
    const task = next.tasks.find((t) => t.id === ids[0])!;
    expect(taskColor(task, next.projects[0])).toBe("#B7863B");
    expect(taskColor(next.tasks.find((t) => t.id === ids[1])!, next.projects[0])).toBeUndefined();
  });

  it("deleting a label strips it from tasks", () => {
    const { data, projectId, ids } = seed();
    const { data: withLabel, id } = addLabel(data, projectId, { name: "api", color: "#B7863B" });
    const tagged = updateTask(withLabel, ids[0], { labels: [id] });
    const next = deleteLabel(tagged, projectId, id);
    expect(next.projects[0].labels).toEqual([]);
    expect(next.tasks.find((t) => t.id === ids[0])!.labels).toEqual([]);
  });
});

describe("archive", () => {
  it("archiving removes the task from the board and closes the gap", () => {
    const { data, projectId, ids } = seed();
    const next = archiveTask(data, ids[0]);
    expect(tasksFor(next, projectId, "todo").map((t) => t.id)).toEqual([ids[1], ids[2]]);
    expect(tasksFor(next, projectId, "todo").map((t) => t.order)).toEqual([0, 1]);
    expect(archivedTasksFor(next, projectId).map((t) => t.id)).toEqual([ids[0]]);
    expect(projectStats(next, projectId, "2026-06-01").total).toBe(2);
  });

  it("unarchive restores the task to the end of its column", () => {
    const { data, projectId, ids } = seed();
    const restored = unarchiveTask(archiveTask(data, ids[0]), ids[0]);
    expect(tasksFor(restored, projectId, "todo").map((t) => t.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(archivedTasksFor(restored, projectId)).toEqual([]);
  });

  it("deleting near an archived task does not disturb it", () => {
    const { data, projectId, ids } = seed();
    const next = deleteTask(archiveTask(data, ids[0]), ids[1]);
    expect(tasksFor(next, projectId, "todo").map((t) => t.id)).toEqual([ids[2]]);
    expect(archivedTasksFor(next, projectId).map((t) => t.id)).toEqual([ids[0]]);
  });
});

describe("checklist", () => {
  it("persists through updateTask and reports progress", () => {
    const { data, ids } = seed();
    const next = updateTask(data, ids[0], {
      checklist: [
        { id: "c1", text: "spec", done: true },
        { id: "c2", text: "build", done: false },
      ],
    });
    const task = next.tasks.find((t) => t.id === ids[0])!;
    expect(checklistProgress(task)).toEqual({ done: 1, total: 2 });
  });

  it("migrate coerces malformed checklist entries", () => {
    const { data } = seed();
    const dirty = {
      ...data,
      tasks: [
        { ...data.tasks[0], checklist: [{ text: "ok", done: 1 }, "bad", { id: 5 }] },
        ...data.tasks.slice(1),
      ],
    };
    const clean = migrate(dirty);
    expect(clean.tasks[0].checklist).toEqual([{ id: expect.any(String), text: "ok", done: true }]);
    expect(clean.tasks[1].checklist).toEqual([]);
  });
});

describe("deadlines & stats", () => {
  it("isOverdue is true only for past-due, not-done tasks", () => {
    const { data, ids } = seed();
    const withDue = updateTask(data, ids[0], { dueDate: "2026-01-01" });
    const task = withDue.tasks.find((t) => t.id === ids[0])!;
    expect(isOverdue(task, "2026-06-01")).toBe(true);
    expect(isOverdue(task, "2026-01-01")).toBe(false);
    const done = moveTask(withDue, ids[0], "done", 0);
    expect(isOverdue(done.tasks.find((t) => t.id === ids[0])!, "2026-06-01")).toBe(false);
  });

  it("projectStats counts totals, done and overdue", () => {
    const { data, projectId, ids } = seed();
    let next = updateTask(data, ids[0], { dueDate: "2026-01-01" });
    next = moveTask(next, ids[1], "done", 0);
    expect(projectStats(next, projectId, "2026-06-01")).toEqual({ total: 3, done: 1, overdue: 1 });
  });
});

describe("migrate", () => {
  it("coerces garbage to an empty board", () => {
    expect(migrate(null)).toEqual(emptyBoard());
    expect(migrate("nope")).toEqual(emptyBoard());
    expect(migrate(42).meta.version).toBe(BOARD_VERSION);
  });

  it("round-trips a valid board", () => {
    const { data } = seed();
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("migrates a v1 board: tones become hex colors, label names become project labels", () => {
    const v1 = {
      meta: { version: 1 },
      projects: [{ id: "p1", name: "Atlas", tone: "garnet", createdAt: "2026-01-01T00:00:00Z" }],
      tasks: [
        {
          id: "t1", projectId: "p1", title: "a", status: "todo", priority: "high",
          dueDate: "2026-07-10", labels: ["design", "api"], order: 0,
          createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };
    const board = migrate(v1);
    expect(board.meta.version).toBe(BOARD_VERSION);
    expect(board.projects[0].color).toBe("#9C3541");
    expect(board.projects[0].labels.map((l) => l.name)).toEqual(["design", "api"]);
    const task = board.tasks[0];
    expect(task.labels).toEqual(board.projects[0].labels.map((l) => l.id));
    expect(taskColor(task, board.projects[0])).toBe(board.projects[0].labels[0].color);
  });

  it("drops orphan tasks and clamps invalid enums", () => {
    const { data, projectId } = seed();
    const dirty = {
      ...data,
      tasks: [
        { ...data.tasks[0], status: "bogus", priority: "asap" },
        { ...data.tasks[1], projectId: "ghost-project" },
        "not-a-task",
      ],
    };
    const clean = migrate(dirty);
    expect(clean.tasks).toHaveLength(1);
    expect(clean.tasks[0].projectId).toBe(projectId);
    expect(clean.tasks[0].status).toBe("todo");
    expect(clean.tasks[0].priority).toBe("none");
  });
});
