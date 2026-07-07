import { AlertTriangle, CalendarDays, CheckCircle2, ListChecks, SignalHigh, SignalLow, SignalMedium, Text } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { checklistProgress, isOverdue, labelsOf, taskColor } from "@/lib/board/service";
import { useBoard } from "@/lib/board/store";
import type { Project, Task, TaskPriority } from "@/lib/board/types";
import { alpha } from "@/lib/color";
import { useDateFormat, useT } from "@/lib/i18n/I18nProvider";
import { PRIORITY_HEX } from "./priority";
import { cn } from "@/lib/utils";

/** How many open checklist steps to surface directly on the card before
 *  collapsing the rest into a "+N" tail — enough to act on without opening
 *  the dialog, not so many the card outgrows the column. */
const VISIBLE_STEPS = 3;

/** Signal bars read as "priority level" unambiguously (Linear/Jira convention);
 *  a flag icon is too easily mistaken for "flagged/bookmarked". Urgent breaks
 *  the pattern on purpose — it's not just "one level up", it's an alert. */
const PRIORITY_ICON: Record<TaskPriority, typeof SignalLow | null> = {
  none: null,
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
  urgent: AlertTriangle,
};

interface TaskCardProps {
  task: Task;
  project: Project;
  today: string;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dragging: boolean;
}

/** A board card in the Chronos block language: the card *wears* its color as a
 *  translucent wash (first label), exactly like timeline blocks wear their
 *  category — no stripes, no spines. */
export default function TaskCard({ task, project, today, onOpen, onDragStart, onDragEnd, dragging }: TaskCardProps) {
  const t = useT();
  const fmt = useDateFormat();
  const { updateTask } = useBoard();
  const color = taskColor(task, project);
  const labels = labelsOf(task, project);
  const overdue = isOverdue(task, today);
  const done = task.status === "done";
  const flag = PRIORITY_HEX[task.priority];
  const PriorityIcon = PRIORITY_ICON[task.priority];
  const steps = checklistProgress(task);
  const openSteps = task.checklist.filter((i) => !i.done);

  function toggleStep(id: string) {
    updateTask(task.id, { checklist: task.checklist.map((i) => (i.id === id ? { ...i, done: true } : i)) });
  }

  return (
    <div
      data-task-card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative cursor-grab select-none rounded-lg border bg-card p-3 text-left shadow-soft transition-shadow",
        "hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-40",
        done && "opacity-75",
      )}
      style={color ? { backgroundColor: alpha(color, "1C"), borderColor: alpha(color, "4D") } : undefined}
    >
      <div className="flex items-start gap-2">
        <div className={cn("flex-1 text-sm font-medium leading-snug text-card-foreground", done && "line-through decoration-muted-foreground/50")}>
          {task.title}
        </div>
        {flag && PriorityIcon && (
          <PriorityIcon
            aria-label={t.kairos.priority[task.priority]}
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: flag }}
          />
        )}
      </div>

      {(task.dueDate || task.description || labels.length > 0 || steps.total > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className={cn("num inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
              {done ? <CheckCircle2 className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
              {fmt.short(task.dueDate)}
            </span>
          )}
          {steps.total > 0 && (
            <span className={cn("num inline-flex items-center gap-1", steps.done === steps.total && "text-secondary")}>
              <ListChecks className="h-3 w-3" />
              {steps.done}/{steps.total}
            </span>
          )}
          {task.description && <Text className="h-3 w-3" aria-label={t.common.hasDescription} />}
          {labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: alpha(label.color, "26"), color: "inherit" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: label.color }} />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {!done && openSteps.length > 0 && (
        <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          {openSteps.slice(0, VISIBLE_STEPS).map((item) => (
            <label key={item.id} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
              <Checkbox checked={false} onCheckedChange={() => toggleStep(item.id)} className="h-3.5 w-3.5" aria-label={item.text} />
              <span className="truncate">{item.text}</span>
            </label>
          ))}
          {openSteps.length > VISIBLE_STEPS && (
            <div className="pl-5 text-[10px] text-muted-foreground/60">+{openSteps.length - VISIBLE_STEPS}</div>
          )}
        </div>
      )}
    </div>
  );
}
