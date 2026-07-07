import { describe, expect, it } from "vitest";
import { addLabel, createProject, createTask } from "./service";
import { exportBoardMarkdown, exportProjectMarkdown, importMarkdown } from "./markdown";
import { emptyBoard, type BoardData } from "./types";

function seed(): { data: BoardData; projectId: string } {
  let { data, id: projectId } = createProject(emptyBoard(), { name: "Atlas" });
  const a = createTask(data, { projectId, title: "Ship the deck", status: "todo", priority: "high", dueDate: "2026-07-10" });
  data = a.data;
  const b = createTask(data, { projectId, title: "Sleep", status: "done" });
  data = b.data;
  return { data, projectId };
}

describe("exportProjectMarkdown", () => {
  it("renders one heading per status with checkbox lines", () => {
    const { data, projectId } = seed();
    const md = exportProjectMarkdown(data, projectId);
    expect(md).toContain("# Atlas");
    expect(md).toContain("## To do");
    expect(md).toContain("- [ ] Ship the deck `2026-07-10` `high`");
    expect(md).toContain("## Done");
    expect(md).toContain("- [x] Sleep");
  });

  it("includes checklist items and labels", () => {
    let { data, id: projectId } = createProject(emptyBoard(), { name: "Atlas" });
    const label = addLabel(data, projectId, { name: "Design Review", color: "#3E8A80" });
    data = label.data;
    const created = createTask(data, {
      projectId, title: "Draft", status: "backlog", labels: [label.id],
      checklist: [{ id: "c1", text: "outline", done: true }, { id: "c2", text: "polish", done: false }],
    });
    data = created.data;
    const md = exportProjectMarkdown(data, projectId);
    expect(md).toContain("#Design-Review");
    expect(md).toContain("  - [x] outline");
    expect(md).toContain("  - [ ] polish");
  });
});

describe("importMarkdown", () => {
  it("throws instead of silently no-oping when there's no recognizable heading", () => {
    expect(() => importMarkdown("just some notes, no heading here", emptyBoard())).toThrow();
    expect(() => importMarkdown("## Backlog\n- [ ] orphaned task, no # Project above it", emptyBoard())).toThrow();
  });

  it("creates a new project and tasks from scratch", () => {
    const md = "# Fresh Project\n\n## Backlog\n- [ ] First task `medium` #Ideas\n\n## To do\n\n## In progress\n\n## Done\n- [x] Already shipped\n";
    const board = importMarkdown(md, emptyBoard());
    const project = board.projects.find((p) => p.name === "Fresh Project");
    expect(project).toBeTruthy();
    const tasks = board.tasks.filter((t) => t.projectId === project!.id);
    expect(tasks).toHaveLength(2);
    const first = tasks.find((t) => t.title === "First task")!;
    expect(first.status).toBe("backlog");
    expect(first.priority).toBe("medium");
    const shipped = tasks.find((t) => t.title === "Already shipped")!;
    expect(shipped.status).toBe("done");
  });

  it("updates an existing task matched by title instead of duplicating it", () => {
    const { data, projectId } = seed();
    const md = exportProjectMarkdown(data, projectId).replace("- [ ] Ship the deck", "- [x] Ship the deck");
    const next = importMarkdown(md, data);
    const tasks = next.tasks.filter((t) => t.projectId === projectId);
    expect(tasks).toHaveLength(2); // no duplicate created
    const shipped = tasks.find((t) => t.title === "Ship the deck")!;
    expect(shipped.status).toBe("done");
  });

  it("round-trips a whole-board export back through import without duplicating", () => {
    const { data } = seed();
    const md = exportBoardMarkdown(data);
    const reimported = importMarkdown(md, data);
    expect(reimported.tasks).toHaveLength(data.tasks.length);
    expect(reimported.projects).toHaveLength(data.projects.length);
  });

  it("merges checklist items by text, preserving already-done state for untouched ones", () => {
    let { data, id: projectId } = createProject(emptyBoard(), { name: "Atlas" });
    const created = createTask(data, {
      projectId, title: "Draft", status: "backlog",
      checklist: [{ id: "c1", text: "outline", done: true }],
    });
    data = created.data;
    const md = "# Atlas\n\n## Backlog\n- [ ] Draft\n  - [x] outline\n  - [ ] polish\n\n## To do\n\n## In progress\n\n## Done\n";
    const next = importMarkdown(md, data);
    const task = next.tasks.find((t) => t.title === "Draft")!;
    expect(task.checklist).toHaveLength(2);
    expect(task.checklist.find((i) => i.text === "outline")?.done).toBe(true);
    expect(task.checklist.find((i) => i.text === "polish")?.done).toBe(false);
  });
});
