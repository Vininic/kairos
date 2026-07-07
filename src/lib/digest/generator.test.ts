import { describe, expect, it } from "vitest";
import { createProject, createTask, moveTask } from "@/lib/board/service";
import { emptyBoard, type BoardData } from "@/lib/board/types";
import { generateDigest } from "./generator";

const TODAY = "2026-07-07";

function seed(): { data: BoardData; projectId: string } {
  const { data, id: projectId } = createProject(emptyBoard(), { name: "Atlas" });
  return { data, projectId };
}

describe("generateDigest", () => {
  it("returns no cards for an empty board", () => {
    const digest = generateDigest(emptyBoard(), TODAY);
    expect(digest.cards).toEqual([]);
    expect(digest.date).toBe(TODAY);
  });

  it("flags overdue tasks", () => {
    let { data, projectId } = seed();
    data = createTask(data, { projectId, title: "Late thing", status: "todo", dueDate: "2026-07-01" }).data;
    const digest = generateDigest(data, TODAY);
    const card = digest.cards.find((c) => c.kind === "overdue");
    expect(card).toMatchObject({ kind: "overdue", count: 1, sample: ["Late thing"] });
  });

  it("does not flag a done task as overdue", () => {
    let { data, projectId } = seed();
    data = createTask(data, { projectId, title: "Finished", status: "done", dueDate: "2026-07-01" }).data;
    const digest = generateDigest(data, TODAY);
    expect(digest.cards.find((c) => c.kind === "overdue")).toBeUndefined();
  });

  it("flags deadlines inside the due-soon window (7 days) but not further out", () => {
    let { data, projectId } = seed();
    data = createTask(data, { projectId, title: "Soon", status: "todo", dueDate: "2026-07-13" }).data;
    data = createTask(data, { projectId, title: "Far", status: "todo", dueDate: "2026-08-01" }).data;
    const digest = generateDigest(data, TODAY);
    const card = digest.cards.find((c) => c.kind === "dueSoon");
    expect(card).toMatchObject({ kind: "dueSoon", count: 1, sample: ["Soon"] });
  });

  it("flags a task stuck in doing past the stale window", () => {
    let { data, projectId } = seed();
    const created = createTask(data, { projectId, title: "Stuck", status: "todo" });
    data = created.data;
    data = moveTask(data, created.id, "doing", 0);
    data = {
      ...data,
      tasks: data.tasks.map((t) => (t.id === created.id ? { ...t, updatedAt: "2026-07-01T00:00:00.000Z" } : t)),
    };
    const digest = generateDigest(data, TODAY);
    expect(digest.cards.find((c) => c.kind === "stale")).toMatchObject({ count: 1, sample: ["Stuck"] });
  });

  it("counts tasks completed within the window as a positive card", () => {
    let { data, projectId } = seed();
    const created = createTask(data, { projectId, title: "Done today", status: "todo" });
    data = created.data;
    data = moveTask(data, created.id, "done", 0);
    data = {
      ...data,
      tasks: data.tasks.map((t) => (t.id === created.id ? { ...t, completedAt: `${TODAY}T10:00:00.000Z` } : t)),
    };
    const digest = generateDigest(data, TODAY);
    expect(digest.cards.find((c) => c.kind === "completed")).toMatchObject({ kind: "completed", count: 1 });
  });

  it("flags a project with 2+ overdue tasks as imbalanced", () => {
    let { data, projectId } = seed();
    data = createTask(data, { projectId, title: "A", status: "todo", dueDate: "2026-07-01" }).data;
    data = createTask(data, { projectId, title: "B", status: "todo", dueDate: "2026-07-02" }).data;
    const digest = generateDigest(data, TODAY);
    expect(digest.cards.find((c) => c.kind === "imbalance")).toMatchObject({ projectName: "Atlas", overdueCount: 2 });
  });

  it("ignores archived tasks entirely", () => {
    let { data, projectId } = seed();
    const created = createTask(data, { projectId, title: "Archived overdue", status: "todo", dueDate: "2026-07-01" });
    data = { ...created.data, tasks: created.data.tasks.map((t) => (t.id === created.id ? { ...t, archivedAt: TODAY } : t)) };
    const digest = generateDigest(data, TODAY);
    expect(digest.cards).toEqual([]);
  });
});
