import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { type Project, type Task, type TaskStatus } from "@/lib/board/types";
import { useT } from "@/lib/i18n/I18nProvider";
import TaskCard from "./TaskCard";
import { cn } from "@/lib/utils";

export interface DropTarget {
  status: TaskStatus;
  index: number;
}

interface BoardColumnProps {
  status: TaskStatus;
  project: Project;
  tasks: Task[];
  today: string;
  dragId: string | null;
  dropTarget: DropTarget | null;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (target: DropTarget) => void;
  onDrop: (target: DropTarget) => void;
  onOpenTask: (task: Task) => void;
  onQuickAdd: (title: string) => void;
}

function DropLine({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("h-0.5 rounded-full transition-colors", active ? "bg-secondary" : "bg-transparent")}
    />
  );
}

export default function BoardColumn({
  status, project, tasks, today, dragId, dropTarget,
  onDragStart, onDragEnd, onDragOver, onDrop, onOpenTask, onQuickAdd,
}: BoardColumnProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  /** Insertion index from pointer Y: the count of cards whose midpoint is above. */
  function indexFromPointer(clientY: number): number {
    const cards = listRef.current?.querySelectorAll<HTMLElement>("[data-task-card]");
    if (!cards) return tasks.length;
    let index = 0;
    cards.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) index += 1;
    });
    return index;
  }

  function handleDragOver(e: React.DragEvent) {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const index = indexFromPointer(e.clientY);
    if (dropTarget?.status !== status || dropTarget.index !== index) {
      onDragOver({ status, index });
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (!dragId) return;
    e.preventDefault();
    onDrop({ status, index: indexFromPointer(e.clientY) });
  }

  function submitQuickAdd() {
    const trimmed = title.trim();
    if (trimmed) onQuickAdd(trimmed);
    setTitle("");
    if (!trimmed) setAdding(false);
  }

  const isTarget = dropTarget?.status === status;

  return (
    <section
      className={cn(
        "flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-surface-veil/40 transition-colors",
        isTarget && "border-secondary/50 bg-surface-veil/70",
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label={t.kairos.status[status]}
    >
      <header className="flex shrink-0 items-baseline justify-between px-3 pb-1 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t.kairos.status[status]}
        </h2>
        <span className="num text-xs text-muted-foreground/70">{tasks.length}</span>
      </header>
      <div className="horizon-rule mx-3 shrink-0" />

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {tasks.map((task, i) => (
          <div key={task.id} className="flex flex-col gap-1">
            <DropLine active={isTarget && dropTarget!.index === i} />
            <TaskCard
              task={task}
              project={project}
              today={today}
              dragging={dragId === task.id}
              onOpen={() => onOpenTask(task)}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", task.id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart(task.id);
              }}
              onDragEnd={onDragEnd}
            />
          </div>
        ))}
        <DropLine active={isTarget && dropTarget!.index >= tasks.length} />

        {adding ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submitQuickAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuickAdd();
              if (e.key === "Escape") { setTitle(""); setAdding(false); }
            }}
            placeholder={t.kairos.board.addTaskPlaceholder}
            className="kairos-card w-full px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> {t.kairos.board.addTask}
          </button>
        )}
      </div>
    </section>
  );
}
