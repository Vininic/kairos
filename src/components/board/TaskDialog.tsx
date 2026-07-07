import { useEffect, useState } from "react";
import { Archive, CalendarDays, Check, Hourglass, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/lib/board/store";
import {
  TASK_PRIORITIES, TASK_STATUSES, makeId,
  type ChecklistItem, type Project, type Task, type TaskPriority, type TaskStatus,
} from "@/lib/board/types";
import { PALETTE, alpha } from "@/lib/color";
import { sendToChronos } from "@/lib/bridge";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";
import { useDateFormat, useT } from "@/lib/i18n/I18nProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIORITY_HEX } from "./priority";
import { cn } from "@/lib/utils";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  /** When set, edits the task; otherwise creates one in `defaultStatus`. */
  task?: Task | null;
  defaultStatus?: TaskStatus;
}

export default function TaskDialog({ open, onOpenChange, project, task, defaultStatus = "todo" }: TaskDialogProps) {
  const { createTask, updateTask, deleteTask, archiveTask, unarchiveTask, addLabel } = useBoard();
  const { session } = useAuth();
  const t = useT();
  const fmt = useDateFormat();
  const L = t.kairos.taskDialog;
  const cloud = !!session?.email;
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? defaultStatus);
      setPriority(task?.priority ?? "none");
      setDueDate(task?.dueDate);
      setLabelIds(task?.labels ?? []);
      setNewLabel("");
      setChecklist(task?.checklist ?? []);
      setNewItem("");
    }
  }, [open, task, defaultStatus]);

  function addChecklistItem() {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((items) => [...items, { id: makeId(), text, done: false }]);
    setNewItem("");
  }

  function toggleLabel(id: string) {
    setLabelIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function createLabel() {
    const name = newLabel.trim();
    if (!name) return;
    const color = PALETTE[(project.labels.length + 2) % PALETTE.length].hex;
    const id = addLabel(project.id, { name, color });
    setLabelIds((ids) => [...ids, id]);
    setNewLabel("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const fields = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      dueDate,
      labels: labelIds,
      checklist: checklist.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text),
    };
    if (task) updateTask(task.id, fields);
    else createTask({ projectId: project.id, ...fields });
    onOpenChange(false);
  }

  function removeTask() {
    if (!task) return;
    deleteTask(task.id);
    onOpenChange(false);
  }

  function archive() {
    if (!task) return;
    const id = task.id;
    archiveTask(id);
    onOpenChange(false);
    toast(L.archived, {
      description: task.title,
      action: { label: L.undo, onClick: () => unarchiveTask(id) },
    });
  }

  async function bridgeToChronos() {
    if (!task) return;
    setSending(true);
    try {
      const err = await sendToChronos(task, project);
      if (err) toast(err);
      else toast(L.sendToChronosSuccess, { description: L.sendToChronosSuccessDesc });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{task ? L.editTitle : L.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.title}</Label>
            <Input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L.titlePlaceholder} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.description}</Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={L.descriptionPlaceholder} rows={3} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {L.checklist}{checklist.length > 0 && (
                <span className="num ml-1.5 normal-case tracking-normal">
                  {checklist.filter((i) => i.done).length}/{checklist.length}
                </span>
              )}
            </Label>
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(v) =>
                      setChecklist((items) => items.map((i) => (i.id === item.id ? { ...i, done: v === true } : i)))
                    }
                    aria-label={item.text}
                  />
                  <Input
                    value={item.text}
                    onChange={(e) =>
                      setChecklist((items) => items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))
                    }
                    className={cn("h-8 flex-1", item.done && "text-muted-foreground line-through")}
                    aria-label={L.checklist}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t.common.remove} ${item.text}`}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setChecklist((items) => items.filter((i) => i.id !== item.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="w-4" />
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                  placeholder={L.addStep}
                  className="h-8 flex-1"
                />
                <Button type="button" variant="ghost" size="icon" aria-label={L.addStep} className="h-8 w-8" onClick={addChecklistItem} disabled={!newItem.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.status}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t.kairos.status[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.priority}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: PRIORITY_HEX[p] ?? "transparent", boxShadow: PRIORITY_HEX[p] ? undefined : "inset 0 0 0 1px hsl(var(--border))" }}
                        />
                        {t.kairos.priority[p]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.deadline}</Label>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="num w-full justify-start font-normal">
                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                    {dueDate ? fmt.medium(dueDate) : L.noDeadline}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                    onSelect={(d) => setDueDate(d ? d.toISOString().slice(0, 10) : undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button type="button" variant="ghost" size="icon" aria-label={L.clearDeadline} onClick={() => setDueDate(undefined)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.labels}</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {project.labels.map((label) => {
                const on = labelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLabel(label.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "text-card-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    style={on ? { backgroundColor: alpha(label.color, "26"), borderColor: alpha(label.color, "66") } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: label.color }} />
                    {label.name}
                    {on && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border pl-2.5 pr-1">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: PALETTE[(project.labels.length + 2) % PALETTE.length].hex }}
                  aria-hidden
                />
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createLabel(); } }}
                  placeholder={L.newLabel}
                  className="h-6 w-24 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                />
                <Button type="button" variant="ghost" size="icon" aria-label={L.createLabel} className="h-6 w-6 shrink-0" onClick={createLabel} disabled={!newLabel.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{L.labelsHint}</p>
          </div>

          <DialogFooter className="flex-wrap gap-2 pt-2 sm:justify-between">
            {task ? (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={!cloud || sending}
                        onClick={() => void bridgeToChronos()}
                        className="text-secondary hover:bg-secondary/10 hover:text-secondary"
                      >
                        <Hourglass className="mr-1.5 h-3.5 w-3.5" /> {L.sendToChronos}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {cloud ? L.sendToChronosHintOn : L.sendToChronosHintOff}
                  </TooltipContent>
                </Tooltip>
              <Button
                type="button"
                variant="ghost"
                onClick={archive}
                className="text-muted-foreground hover:text-foreground"
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" /> {L.archiveAction}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={L.deleteAction} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{L.deleteTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{L.deleteDesc(task.title)}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={removeTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {L.deleteAction}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              </div>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
              <Button type="submit" disabled={!title.trim()} className="bg-primary text-primary-foreground hover:bg-primary-deep">
                {task ? L.saveChanges : L.addTask}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
