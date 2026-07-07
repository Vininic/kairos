/** Board ⇄ XLSX — a spreadsheet-native export/import, colored like the
 *  Chronos day-planner workbook: the "Board" sheet renders each project's
 *  columns as actual colored blocks, while "Projects"/"Tasks" carry the
 *  machine-readable data that import reconstructs the board from. Unlike
 *  Markdown import (which merges by title), XLSX import replaces the board
 *  wholesale — same semantics as JSON import. */
import ExcelJS from "exceljs";
import { addLabel, createProject, createTask, tasksFor } from "./service";
import {
  TASK_PRIORITIES, TASK_STATUSES, STATUS_LABELS, emptyBoard,
  type BoardData, type ChecklistItem, type TaskPriority, type TaskStatus,
} from "./types";
import { DEFAULT_PROJECT_COLOR } from "@/lib/color";
import type { Locale } from "@/lib/i18n/dictionaries";

export const KAIROS_XLSX_FORMAT = "kairos-xlsx-v1";

const THIN = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F2937" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
  });
}

function hex6(input: string | undefined): string {
  const h = (input ?? DEFAULT_PROJECT_COLOR).replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : DEFAULT_PROJECT_COLOR.replace("#", "");
}
const argb = (h: string) => `FF${h}`;
function readableText(h: string): string {
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "FF1A1A1A" : "FFFFFFFF";
}

function labels(locale: Locale) {
  const pt = locale === "pt";
  return {
    sheet: {
      board: pt ? "Quadro" : "Board",
      projects: pt ? "Projetos" : "Projects",
      tasks: pt ? "Tarefas" : "Tasks",
      meta: pt ? "Metadados" : "Metadata",
    },
    h: {
      id: pt ? "ID" : "ID",
      project: pt ? "Projeto" : "Project",
      name: pt ? "Nome" : "Name",
      description: pt ? "Descrição" : "Description",
      color: pt ? "Cor" : "Color",
      labelsList: pt ? "Etiquetas" : "Labels",
      title: pt ? "Título" : "Title",
      status: pt ? "Status" : "Status",
      priority: pt ? "Prioridade" : "Priority",
      dueDate: pt ? "Prazo" : "Due date",
      checklist: pt ? "Checklist" : "Checklist",
      createdAt: pt ? "Criado em" : "Created",
      updatedAt: pt ? "Atualizado em" : "Updated",
      completedAt: pt ? "Concluído em" : "Completed",
    },
    meta: {
      format: pt ? "Formato Kairos" : "Kairos format",
      exported: pt ? "Exportado em" : "Exported",
      projects: pt ? "Projetos" : "Projects",
      tasks: pt ? "Tarefas" : "Tasks",
    },
  };
}

export function buildStyledWorkbook(data: BoardData, locale: Locale = "en"): ExcelJS.Workbook {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kairos";
  wb.created = new Date();

  const activeProjects = data.projects.filter((p) => !p.archivedAt);

  /* ── 1. Board: colored blocks, one project group at a time ─────────────── */
  const board = wb.addWorksheet(L.sheet.board, { views: [{ state: "frozen", ySplit: 0 }] });
  TASK_STATUSES.forEach((_, i) => { board.getColumn(1 + i).width = 26; });

  let row = 1;
  for (const project of activeProjects) {
    const headerRow = board.getRow(row);
    TASK_STATUSES.forEach((status, i) => { headerRow.getCell(1 + i).value = `${project.name} — ${STATUS_LABELS[status]}`; });
    const projHex = hex6(project.color);
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(projHex) } };
      cell.font = { bold: true, color: { argb: readableText(projHex) }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    });
    headerRow.height = 20;
    row += 1;

    const columns = TASK_STATUSES.map((status) => tasksFor(data, project.id, status));
    const maxRows = Math.max(1, ...columns.map((c) => c.length));
    for (let r = 0; r < maxRows; r++) {
      const dataRow = board.getRow(row + r);
      columns.forEach((tasks, i) => {
        const task = tasks[r];
        const cell = dataRow.getCell(1 + i);
        cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
        if (!task) return;
        const label = task.labels.map((id) => project.labels.find((l) => l.id === id)).find(Boolean);
        const hex = hex6(label?.color ?? project.color);
        cell.value = task.title;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } };
        cell.font = { color: { argb: readableText(hex) }, size: 9 };
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      });
    }
    row += maxRows + 1;
  }

  /* ── 2. Projects (machine-readable) ─────────────────────────────────────── */
  const projSheet = wb.addWorksheet(L.sheet.projects);
  projSheet.columns = [
    { header: L.h.id, key: "id", width: 24 },
    { header: L.h.name, key: "name", width: 24 },
    { header: L.h.description, key: "description", width: 40 },
    { header: L.h.color, key: "color", width: 12 },
    { header: L.h.labelsList, key: "labels", width: 46 },
  ];
  styleHeaderRow(projSheet.getRow(1));
  for (const p of activeProjects) {
    projSheet.addRow({
      id: p.id, name: p.name, description: p.description ?? "", color: p.color,
      labels: p.labels.map((l) => `${l.name}:${l.color}`).join("; "),
    });
  }

  /* ── 3. Tasks (machine-readable, drives round-trip import) ─────────────── */
  const taskSheet = wb.addWorksheet(L.sheet.tasks);
  taskSheet.columns = [
    { header: L.h.project, key: "project", width: 20 },
    { header: L.h.title, key: "title", width: 32 },
    { header: L.h.description, key: "description", width: 36 },
    { header: L.h.status, key: "status", width: 12 },
    { header: L.h.priority, key: "priority", width: 12 },
    { header: L.h.dueDate, key: "dueDate", width: 12 },
    { header: L.h.labelsList, key: "labels", width: 24 },
    { header: L.h.checklist, key: "checklist", width: 40 },
    { header: L.h.createdAt, key: "createdAt", width: 20 },
    { header: L.h.updatedAt, key: "updatedAt", width: 20 },
    { header: L.h.completedAt, key: "completedAt", width: 20 },
  ];
  styleHeaderRow(taskSheet.getRow(1));
  for (const project of activeProjects) {
    for (const status of TASK_STATUSES) {
      for (const task of tasksFor(data, project.id, status)) {
        taskSheet.addRow({
          project: project.name,
          title: task.title,
          description: task.description ?? "",
          status,
          priority: task.priority,
          dueDate: task.dueDate ?? "",
          labels: task.labels
            .map((id) => project.labels.find((l) => l.id === id)?.name)
            .filter(Boolean)
            .join("; "),
          checklist: task.checklist.map((c) => `${c.text}:${c.done ? "x" : " "}`).join("; "),
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt ?? "",
        });
      }
    }
  }

  /* ── 4. Metadata (carries the round-trip marker) ────────────────────────── */
  const meta = wb.addWorksheet(L.sheet.meta);
  meta.columns = [{ header: "Field", key: "key", width: 22 }, { header: "Value", key: "value", width: 44 }];
  styleHeaderRow(meta.getRow(1));
  meta.addRow({ key: L.meta.format, value: KAIROS_XLSX_FORMAT });
  meta.addRow({ key: L.meta.projects, value: activeProjects.length });
  meta.addRow({ key: L.meta.tasks, value: data.tasks.filter((t) => !t.archivedAt).length });
  meta.addRow({ key: L.meta.exported, value: new Date().toISOString() });

  return wb;
}

export async function exportToXLSX(data: BoardData, locale: Locale = "en", filename = "kairos-board.xlsx") {
  const wb = buildStyledWorkbook(data, locale);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in (v as { text?: string })) return (v as { text: string }).text ?? "";
  return String(v);
}

function parseChecklist(raw: string): ChecklistItem[] {
  if (!raw.trim()) return [];
  return raw.split(";").map((s) => s.trim()).filter(Boolean).map((entry) => {
    const idx = entry.lastIndexOf(":");
    const text = idx === -1 ? entry : entry.slice(0, idx);
    const done = idx !== -1 && entry.slice(idx + 1).trim().toLowerCase() === "x";
    return { id: crypto.randomUUID(), text: text.trim(), done };
  });
}

/** Rebuild a board from a Kairos-exported workbook. Throws if the expected
 *  sheets aren't present, so the caller can show a failure toast rather than
 *  silently importing nothing. */
export async function importXlsx(buffer: ArrayBuffer): Promise<BoardData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const projSheet = wb.worksheets.find((s) => s.name === "Projetos" || s.name === "Projects");
  const taskSheet = wb.worksheets.find((s) => s.name === "Tarefas" || s.name === "Tasks");
  if (!projSheet || !taskSheet) throw new Error("Missing Projects/Tasks sheets");

  let board = emptyBoard();
  const projectIdByName = new Map<string, string>();
  const labelIdByProjectAndName = new Map<string, Map<string, string>>();

  projSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(2).value).trim();
    if (!name) return;
    const description = cellText(row.getCell(3).value).trim() || undefined;
    const color = cellText(row.getCell(4).value).trim() || DEFAULT_PROJECT_COLOR;
    const res = createProject(board, { name, description, color });
    board = res.data;
    projectIdByName.set(name, res.id);
    const labelMap = new Map<string, string>();
    const rawLabels = cellText(row.getCell(5).value);
    for (const entry of rawLabels.split(";").map((s) => s.trim()).filter(Boolean)) {
      const idx = entry.lastIndexOf(":");
      if (idx === -1) continue;
      const labelName = entry.slice(0, idx).trim();
      const labelColor = entry.slice(idx + 1).trim();
      const labelRes = addLabel(board, res.id, { name: labelName, color: labelColor });
      board = labelRes.data;
      labelMap.set(labelName, labelRes.id);
    }
    labelIdByProjectAndName.set(res.id, labelMap);
  });

  taskSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const projectName = cellText(row.getCell(1).value).trim();
    const title = cellText(row.getCell(2).value).trim();
    const projectId = projectIdByName.get(projectName);
    if (!projectId || !title) return;
    const description = cellText(row.getCell(3).value).trim() || undefined;
    const statusRaw = cellText(row.getCell(4).value).trim() as TaskStatus;
    const status = TASK_STATUSES.includes(statusRaw) ? statusRaw : "todo";
    const priorityRaw = cellText(row.getCell(5).value).trim() as TaskPriority;
    const priority = TASK_PRIORITIES.includes(priorityRaw) ? priorityRaw : "none";
    const dueDate = cellText(row.getCell(6).value).trim() || undefined;
    const labelMap = labelIdByProjectAndName.get(projectId) ?? new Map();
    const labelNames = cellText(row.getCell(7).value).split(";").map((s) => s.trim()).filter(Boolean);
    const labelIds = labelNames.map((n) => labelMap.get(n)).filter((id): id is string => !!id);
    const checklist = parseChecklist(cellText(row.getCell(8).value));

    const res = createTask(board, { projectId, title, description, status, priority, dueDate, labels: labelIds, checklist });
    board = res.data;
  });

  return board;
}
