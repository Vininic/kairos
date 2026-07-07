import { useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArchiveRestore, ArrowLeft, Download, Package, Pencil, Trash2, Upload } from "lucide-react";
import BoardColumn, { type DropTarget } from "@/components/board/BoardColumn";
import ProjectDialog from "@/components/board/ProjectDialog";
import TaskDialog from "@/components/board/TaskDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import { exportProjectMarkdown, importMarkdown } from "@/lib/board/markdown";
import { archivedTasksFor, projectStats, tasksFor } from "@/lib/board/service";
import { useBoard } from "@/lib/board/store";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/board/types";
import { useDateFormat, useT } from "@/lib/i18n/I18nProvider";

export default function Board() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, createTask, moveTask, unarchiveTask, deleteTask, replaceBoard } = useBoard();
  const t = useT();
  const L = t.kairos.board;
  const fmt = useDateFormat();
  const mdFileRef = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; task: Task | null; status: TaskStatus }>({
    open: false,
    task: null,
    status: "todo",
  });

  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return <Navigate to="/projects" replace />;

  const today = format(new Date(), "yyyy-MM-dd");
  const stats = projectStats(data, project.id, today);
  const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
  const archived = archivedTasksFor(data, project.id);

  function clearDrag() {
    setDragId(null);
    setDropTarget(null);
  }

  function handleDrop(target: DropTarget) {
    if (!dragId || !project) return;
    // The service inserts into the column *without* the dragged task; when the
    // pointer index counted the dragged card above the slot, shift down by one.
    const column = tasksFor(data, project.id, target.status);
    const current = column.findIndex((t) => t.id === dragId);
    const index = current !== -1 && current < target.index ? target.index - 1 : target.index;
    moveTask(dragId, target.status, index);
    clearDrag();
  }

  function exportMarkdown() {
    const md = exportProjectMarkdown(data, project.id);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.trim().toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importMarkdownFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      replaceBoard(importMarkdown(await file.text(), data));
      toast(L.markdownImported);
    } catch {
      toast(L.markdownImportFailed);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={L.allProjects} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
        <h1 className="font-display text-2xl text-primary">{project.name}</h1>
        <Button variant="ghost" size="icon" aria-label={L.editProject} onClick={() => setEditOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {project.archivedAt && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t.kairos.projects.archived}</Badge>}
        <input ref={mdFileRef} type="file" accept=".md,text/markdown" hidden onChange={(e) => void importMarkdownFile(e)} />
        <Button variant="ghost" size="icon" aria-label={L.exportMarkdown} title={L.exportMarkdown} onClick={exportMarkdown} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={L.importMarkdown} title={L.importMarkdown} onClick={() => mdFileRef.current?.click()} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />
        </Button>
        {/* Repeated in the Topbar breadcrumb at lg+, where this row would be redundant. */}
        <div className="ml-auto flex items-center gap-3 lg:hidden">
          {stats.overdue > 0 && (
            <span className="num text-xs font-medium text-destructive">{stats.overdue} {L.overdue}</span>
          )}
          <span className="num text-xs text-muted-foreground">{stats.done}/{stats.total}</span>
          <Progress value={pct} aria-label={t.common.percentComplete(pct)} className="h-1.5 w-28" />
        </div>
      </div>
      {project.description && (
        <p className="mt-1.5 pl-11 text-sm text-muted-foreground">{project.description}</p>
      )}

      <div className="mt-6 flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
        {TASK_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            project={project}
            tasks={tasksFor(data, project.id, status)}
            today={today}
            dragId={dragId}
            dropTarget={dropTarget}
            onDragStart={setDragId}
            onDragEnd={clearDrag}
            onDragOver={setDropTarget}
            onDrop={handleDrop}
            onOpenTask={(task) => setTaskDialog({ open: true, task, status: task.status })}
            onQuickAdd={(title) => createTask({ projectId: project.id, title, status })}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setArchiveOpen(true)}
            className="num text-muted-foreground hover:text-foreground"
          >
            <Package className="mr-1.5 h-3.5 w-3.5" /> {L.archivedCount(archived.length)}
          </Button>
        </div>
      )}

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{L.archivedTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {archived.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{L.archivedEmpty}</p>
            )}
            {archived.map((tk) => (
              <div key={tk.id} className="flex items-center gap-3 rounded-md border border-border/60 bg-surface-raised p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-card-foreground">{tk.title}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    {t.kairos.status[tk.status]}{tk.archivedAt ? ` · ${fmt.short(tk.archivedAt.slice(0, 10))}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => { unarchiveTask(tk.id); toast(L.taskRestored, { description: tk.title }); }}
                >
                  <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> {L.restore}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={L.deleteTask(tk.title)}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => { deleteTask(tk.id); toast(L.taskDeleted, { description: tk.title }); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
        project={project}
        task={taskDialog.task}
        defaultStatus={taskDialog.status}
      />
    </div>
  );
}
