import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Check, ChevronDown, ChevronRight, Cloud, Layers, LogOut,
  MonitorSmartphone, Pencil, RotateCcw, Trash2, Upload, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth";
import { migrate } from "@/lib/board/service";
import { useBoard } from "@/lib/board/store";
import { emptyBoard, type BoardData } from "@/lib/board/types";
import { useDateFormat, useT } from "@/lib/i18n/I18nProvider";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A single-profile snapshot of the board — no carousel/multi-slot switching:
 *  the suite account is one identity, and this dialog is its one home. */
function boardSnapshot(data: BoardData) {
  const today = new Date().toISOString().slice(0, 10);
  const active = data.projects.filter((p) => !p.archivedAt);
  const activeTasks = data.tasks.filter((t) => !t.archivedAt);
  const done = activeTasks.filter((t) => t.status === "done").length;
  const dueSoon = activeTasks
    .filter((t) => t.dueDate && t.status !== "done")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 4);
  const byProject = active
    .map((p) => ({ project: p, count: activeTasks.filter((t) => t.projectId === p.id).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const score = activeTasks.length === 0 ? 0 : Math.round((done / activeTasks.length) * 100);
  return { today, activeTasks, done, dueSoon, byProject, projects: active, score };
}

export default function ProfileDialog({ open, onOpenChange }: Props) {
  const { data, replaceBoard } = useBoard();
  const { session, signOut, updateName } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const fmt = useDateFormat();
  const L = t.kairos.profile;
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [dataOpen, setDataOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<BoardData | null>(null);

  const cloud = !!session?.email;
  const snap = boardSnapshot(data);

  function startEditing() {
    setNameDraft(session?.name ?? "");
    setEditing(true);
  }
  function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed) void updateName(trimmed);
    setEditing(false);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const board = migrate(JSON.parse(await file.text()));
      if (board.projects.length === 0 && board.tasks.length === 0) {
        toast(t.kairos.settings.importNothing, { description: t.kairos.settings.importNothingDesc });
        return;
      }
      setPendingImport(board);
    } catch {
      toast(t.kairos.settings.importFailed, { description: t.kairos.settings.importFailedDesc });
    }
  }

  if (!session) return null;
  const initial = session.name.trim().charAt(0).toUpperCase() || "K";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <div className="shrink-0 p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rosegold text-base font-semibold text-primary-deep">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                    className="w-36 rounded border border-sidebar-border bg-sidebar-accent/60 px-2 py-0.5 font-display text-sm text-sidebar-accent-foreground outline-none"
                  />
                  <button onClick={saveName} className="p-0.5 text-secondary hover:text-secondary/80"><Check className="h-3 w-3" /></button>
                  <button onClick={() => setEditing(false)} className="p-0.5 text-sidebar-foreground/50 hover:text-sidebar-foreground/80"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <span className="font-display truncate text-sm text-sidebar-accent-foreground">{session.name}</span>
                  <button onClick={startEditing} className="p-0.5 text-sidebar-foreground/40 opacity-0 transition-all hover:text-secondary/80 group-hover:opacity-100">
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
                {cloud ? <Cloud className="h-2.5 w-2.5" /> : <MonitorSmartphone className="h-2.5 w-2.5" />}
                {cloud ? t.common.suiteAccount : t.common.thisBrowser}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              <Calendar className="h-3 w-3 text-secondary" />
              {L.dueSoon}
              <span className="ml-auto num">{L.tasksCount(snap.activeTasks.length)}</span>
            </div>
            {snap.dueSoon.length === 0 ? (
              <div className="flex gap-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="min-w-[3rem] rounded border border-dashed border-sidebar-border px-2 py-1.5 text-center opacity-30">
                    <div className="text-[8px] text-sidebar-foreground/30">—</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {snap.dueSoon.map((tk) => {
                  const project = data.projects.find((p) => p.id === tk.projectId);
                  const overdue = !!tk.dueDate && tk.dueDate < snap.today;
                  return (
                    <div
                      key={tk.id}
                      className="flex items-center gap-1.5 rounded px-2.5 py-1"
                      style={{
                        backgroundColor: overdue ? "rgba(178,58,46,0.12)" : `${project?.color ?? "#999"}16`,
                        border: `1px solid ${overdue ? "rgba(178,58,46,0.35)" : `${project?.color ?? "#999"}33`}`,
                      }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project?.color ?? "#999" }} />
                      <span className="max-w-[6rem] truncate text-[9px] font-medium text-sidebar-accent-foreground">{tk.title}</span>
                      <span className="num text-[8px] text-sidebar-foreground/50">{tk.dueDate ? fmt.short(tk.dueDate) : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              <Layers className="h-3 w-3 text-secondary" />
              {L.projects}
              <span className="ml-auto num">{snap.projects.length}</span>
            </div>
            {snap.byProject.length === 0 ? (
              <div className="flex gap-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="min-w-[2.5rem] rounded border border-dashed border-sidebar-border px-2 py-2 opacity-30" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {snap.byProject.map(({ project, count }) => (
                  <div key={project.id} className="flex items-center gap-1.5 rounded px-2.5 py-1" style={{ backgroundColor: `${project.color}16`, border: `1px solid ${project.color}33` }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project.color }} />
                    <span className="max-w-[5rem] truncate text-[9px] text-sidebar-foreground/70">{project.name}</span>
                    <span className="num text-[8px] text-sidebar-foreground/40">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-sidebar-foreground/50">{L.tasks}</div>
              <div className="font-display num mt-0.5 text-base text-sidebar-accent-foreground">{snap.activeTasks.length}</div>
            </div>
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-sidebar-foreground/50">{L.projects}</div>
              <div className="font-display num mt-0.5 text-base text-sidebar-accent-foreground">{snap.projects.length}</div>
            </div>
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-sidebar-foreground/50">{L.done}</div>
              <div className="font-display num mt-0.5 text-base text-sidebar-accent-foreground">{snap.score}%</div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
            <button
              onClick={() => setDataOpen(!dataOpen)}
              className="flex w-full items-center gap-2 py-1 text-left text-xs text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground"
            >
              {dataOpen ? <ChevronDown className="h-3.5 w-3.5 text-secondary" /> : <ChevronRight className="h-3.5 w-3.5 text-secondary" />}
              <RotateCcw className="h-3 w-3 text-secondary" />
              <span>{L.boardData}</span>
            </button>
            {dataOpen && (
              <div className="flex flex-wrap gap-1.5 pb-0.5 pt-1.5">
                <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void onImportFile(e)} />
                <Button size="sm" variant="outline" className="h-7 flex-1 bg-sidebar/50 text-[10px]" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-3 w-3" /> {L.import}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 flex-1 bg-sidebar/50 text-[10px]" style={{ borderColor: "rgba(178,58,46,0.35)", color: "rgba(224,120,105,0.9)" }}>
                      <Trash2 className="mr-1.5 h-3 w-3" /> {L.reset}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.kairos.settings.resetTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.kairos.settings.resetDesc.replace("{cloud}", cloud ? t.kairos.settings.resetCloudSuffix : "")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { replaceBoard(emptyBoard()); toast(t.kairos.settings.boardReset); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {t.kairos.settings.resetBoard}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            <div className="border-t border-sidebar-border" />
            <Button
              variant="outline"
              className="h-8 w-full bg-sidebar/50 text-xs"
              style={{ borderColor: "rgba(178,58,46,0.4)", color: "rgba(224,120,105,1)" }}
              onClick={() => { void signOut(); navigate("/login"); onOpenChange(false); }}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> {L.signOut}
            </Button>
          </div>
        </div>

        <AlertDialog open={!!pendingImport} onOpenChange={(o) => { if (!o) setPendingImport(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.kairos.settings.importTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.kairos.settings.importDescPrefix} {pendingImport?.projects.length ?? 0} {t.kairos.settings.projectWord(pendingImport?.projects.length ?? 0)} {t.kairos.settings.importDescMiddle}{" "}
                {pendingImport?.tasks.length ?? 0} {t.kairos.settings.taskWord(pendingImport?.tasks.length ?? 0)}. {t.kairos.settings.importDescSuffix.replace("{cloud}", cloud ? t.kairos.settings.importCloudSuffix : "")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (pendingImport) replaceBoard(pendingImport); setPendingImport(null); onOpenChange(false); toast(t.kairos.settings.boardImported); }}
                className="bg-primary text-primary-foreground hover:bg-primary-deep"
              >
                {t.kairos.settings.importAndReplace}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
