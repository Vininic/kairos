import { describe, expect, it } from "vitest";
import { addLabel, createProject, createTask } from "./service";
import { buildStyledWorkbook, importXlsx } from "./xlsx";
import { emptyBoard, type BoardData } from "./types";

function seed(): BoardData {
  let { data, id: projectId } = createProject(emptyBoard(), { name: "Atlas", description: "Launch work", color: "#3E8A80" });
  const label = addLabel(data, projectId, { name: "Design Review", color: "#B96A82" });
  data = label.data;
  const a = createTask(data, {
    projectId, title: "Ship the deck", status: "todo", priority: "high", dueDate: "2026-07-10",
    labels: [label.id], checklist: [{ id: "c1", text: "outline", done: true }],
  });
  data = a.data;
  const b = createTask(data, { projectId, title: "Sleep", status: "done" });
  data = b.data;
  return data;
}

describe("xlsx round-trip", () => {
  it("survives a build → load cycle with projects, tasks, labels and checklist intact", async () => {
    const data = seed();
    const wb = buildStyledWorkbook(data, "en");
    const buf = await wb.xlsx.writeBuffer();
    const imported = await importXlsx(buf as unknown as ArrayBuffer);

    expect(imported.projects).toHaveLength(1);
    expect(imported.projects[0].name).toBe("Atlas");
    expect(imported.projects[0].description).toBe("Launch work");
    expect(imported.projects[0].labels.map((l) => l.name)).toEqual(["Design Review"]);

    expect(imported.tasks).toHaveLength(2);
    const ship = imported.tasks.find((t) => t.title === "Ship the deck")!;
    expect(ship.status).toBe("todo");
    expect(ship.priority).toBe("high");
    expect(ship.dueDate).toBe("2026-07-10");
    expect(ship.checklist).toEqual([{ id: expect.any(String), text: "outline", done: true }]);
    const projectLabelId = imported.projects[0].labels[0].id;
    expect(ship.labels).toEqual([projectLabelId]);

    const sleep = imported.tasks.find((t) => t.title === "Sleep")!;
    expect(sleep.status).toBe("done");
  });

  it("throws when the workbook has no recognizable Projects/Tasks sheets", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Nothing here");
    const buf = await wb.xlsx.writeBuffer();
    await expect(importXlsx(buf as unknown as ArrayBuffer)).rejects.toThrow();
  });
});
