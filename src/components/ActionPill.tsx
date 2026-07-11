import type { LucideIcon } from "lucide-react";
import { ArrowRight, Archive, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { describeAction, findProject, type AetherisAction } from "@/lib/ai/actions";
import { alpha, PALETTE } from "@/lib/color";
import type { BoardData } from "@/lib/board/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const DEFAULT_COLOR = PALETTE[0].hex;

const ACTION_ICONS: Record<AetherisAction["type"], LucideIcon> = {
  create_project: Layers,
  create_task: Plus,
  update_task: Pencil,
  move_task: ArrowRight,
  archive_task: Archive,
  delete_task: Trash2,
};

function resolveColor(data: BoardData, action: AetherisAction): string {
  switch (action.type) {
    case "create_project":
      return action.color ?? DEFAULT_COLOR;
    case "create_task":
      return findProject(data, action.project)?.color ?? DEFAULT_COLOR;
    case "update_task":
    case "move_task":
    case "archive_task":
    case "delete_task": {
      const task = data.tasks.find((t) => t.id === action.id);
      const project = task ? data.projects.find((p) => p.id === task.projectId) : undefined;
      return project?.color ?? DEFAULT_COLOR;
    }
    default:
      return DEFAULT_COLOR;
  }
}

interface ActionPillProps {
  action: AetherisAction;
  data: BoardData;
  K: Dictionary["kairos"];
}

/** One proposed action as a colored chip — same visual language as the
 *  project/task chips already used in Aetheris' sidebar (dot + colored
 *  wash), resolving color from the actually-referenced project so a
 *  proposed change looks like the real thing it will create, instead of a
 *  generic bullet. Mirrors Chronos' BlockPill pattern and Pluto's own
 *  ActionPill (same idea, ported per-domain). */
export default function ActionPill({ action, data, K }: ActionPillProps) {
  const Icon = ACTION_ICONS[action.type];
  const color = resolveColor(data, action);

  return (
    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: alpha(color, "16"), border: `1px solid ${alpha(color, "33")}` }}>
      <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: alpha(color, "33"), color }}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="flex-1 text-sm text-card-foreground">{describeAction(data, action, K)}</span>
    </div>
  );
}
