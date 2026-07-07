/** The Kairos → Chronos bridge.
 *
 *  Neither app writes the other's data. Kairos posts *scheduling requests* to a
 *  shared `user_data` row (key "kairos-bridge"); Chronos reads them, turns them
 *  into commitments on its own terms, and marks them scheduled. RLS scopes the
 *  row to the account, so the bridge only exists for suite (cloud) sessions.
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import { makeId, type Project, type Task } from "@/lib/board/types";

const TABLE = "user_data";
export const BRIDGE_KEY = "kairos-bridge";

export interface BridgeRequest {
  id: string;
  taskId: string;
  projectName: string;
  title: string;
  notes?: string;
  dueDate?: string;
  priority: Task["priority"];
  /** Suggested block length for the commitment, in minutes. */
  durationMin: number;
  createdAt: string;
  status: "pending" | "scheduled" | "dismissed";
  /** Set by Chronos once a commitment exists. */
  commitmentId?: string;
}

export interface BridgeData {
  version: 1;
  requests: BridgeRequest[];
}

function emptyBridge(): BridgeData {
  return { version: 1, requests: [] };
}

function coerce(raw: unknown): BridgeData {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as BridgeData).requests)) return emptyBridge();
  return { version: 1, requests: (raw as BridgeData).requests };
}

/** Post a task to the Chronos inbox. Returns an error message or null. */
export async function sendToChronos(task: Task, project: Project): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return "Cloud is not configured";
  const { data: { session } } = await sb.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return "Sign in with your suite account to send tasks to Chronos";

  const { data: row, error } = await sb
    .from(TABLE)
    .select("value")
    .eq("user_id", userId)
    .eq("key", BRIDGE_KEY)
    .maybeSingle();
  if (error) return error.message;

  const bridge = coerce(row?.value);
  if (bridge.requests.some((r) => r.taskId === task.id && r.status === "pending")) {
    return "This task is already waiting in the Chronos inbox";
  }
  bridge.requests = [
    ...bridge.requests.filter((r) => r.status === "pending").slice(-49),
    {
      id: makeId(),
      taskId: task.id,
      projectName: project.name,
      title: task.title,
      notes: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      durationMin: 60,
      createdAt: new Date().toISOString(),
      status: "pending",
    },
  ];

  const { error: upsertError } = await sb
    .from(TABLE)
    .upsert({ user_id: userId, key: BRIDGE_KEY, value: bridge, version: Date.now() }, { onConflict: "user_id,key" });
  return upsertError ? upsertError.message : null;
}
