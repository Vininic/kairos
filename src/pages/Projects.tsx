import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { KairosMark } from "@/components/KairosLogo";
import ProjectDialog from "@/components/board/ProjectDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { projectStats } from "@/lib/board/service";
import { useBoard } from "@/lib/board/store";
import type { Project } from "@/lib/board/types";
import { useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const { data, updateProject } = useBoard();
  const navigate = useNavigate();
  const t = useT();
  const L = t.kairos.projects;
  const today = format(new Date(), "yyyy-MM-dd");
  const stats = projectStats(data, project.id, today);
  const archived = !!project.archivedAt;
  const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/projects/${project.id}`); }}
      className={cn(
        "kairos-card group cursor-pointer p-5 transition-shadow hover:shadow-elevated",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        archived && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display truncate text-lg text-card-foreground">{project.name}</h2>
            {archived && <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider">{L.archived}</Badge>}
          </div>
          {project.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label={L.projectActions} className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> {t.common.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateProject(project.id, { archivedAt: archived ? undefined : new Date().toISOString() })}
            >
              {archived ? <><ArchiveRestore className="mr-2 h-3.5 w-3.5" /> {L.restore}</> : <><Archive className="mr-2 h-3.5 w-3.5" /> {L.archive}</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> {L.deleteProject}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Progress value={pct} aria-label={t.common.percentComplete(pct)} className="mt-4 h-1.5" />
      <div className="num mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{stats.total} {L.tasksLabel(stats.total)} · {stats.done} {L.doneLabel}</span>
        {stats.overdue > 0 && <span className="font-medium text-destructive">{stats.overdue} {L.overdueLabel}</span>}
      </div>
    </div>
  );
}

export default function Projects() {
  const { data, deleteProject } = useBoard();
  const t = useT();
  const L = t.kairos.projects;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const active = data.projects.filter((p) => !p.archivedAt);
  const archived = data.projects.filter((p) => !!p.archivedAt);
  const ordered = [...active, ...archived];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.eyebrow}</div>
          <h1 className="font-display mt-1 text-3xl text-primary">{L.title}</h1>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary-deep">
          <Plus className="mr-1.5 h-4 w-4" /> {L.newProject}
        </Button>
      </div>

      {ordered.length === 0 ? (
        <div className="kairos-card mt-10 flex flex-col items-center px-8 py-16 text-center">
          <KairosMark className="h-12 w-12 text-secondary" />
          <h2 className="font-display mt-5 text-xl text-card-foreground">{L.emptyTitle}</h2>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{L.emptyLead}</p>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="mt-6 bg-primary text-primary-foreground hover:bg-primary-deep">
            <Plus className="mr-1.5 h-4 w-4" /> {L.newProject}
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => { setEditing(p); setDialogOpen(true); }}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} project={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.deleteTitle(deleting?.name ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>{L.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleting) deleteProject(deleting.id); setDeleting(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {L.deleteProject}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
