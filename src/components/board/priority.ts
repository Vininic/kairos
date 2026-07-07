import type { TaskPriority } from "@/lib/board/types";

/** Priority hues for flags and pickers. "none" draws nothing. Urgent is the
 *  house destructive red; high is ochre, the Chronos-bronze nod. */
export const PRIORITY_HEX: Record<TaskPriority, string | null> = {
  none: null,
  low: "#5E6B77",
  medium: "#3E8A80",
  high: "#B7863B",
  urgent: "#B23A2E",
};
