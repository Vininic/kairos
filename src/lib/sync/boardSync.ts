/** localStorage ⇄ Supabase sync for the Kairos board.
 *
 *  Same engine shape as Chronos' userDataSync (one row per domain in the shared
 *  `user_data` KV table, RLS-scoped to the user), specialised to a single
 *  domain. Being single-domain buys one upgrade over the sibling: a remote
 *  change re-hydrates the store in place via BOARD_PULLED_EVENT — no reload.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { BOARD_PULLED_EVENT, BOARD_STORAGE_KEY } from "@/lib/board/store";
import { useT } from "@/lib/i18n/I18nProvider";

const TABLE = "user_data";
const DOMAIN_KEY = "kairos-board";

let snapshot: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
const ownVersions = new Set<number>(); // versions WE wrote — ignore our own realtime echoes

async function currentUserId(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.user?.id ?? null;
}

/** Pull the remote board into localStorage. Returns true if it differed. */
export async function pullBoard(): Promise<boolean> {
  const sb = getSupabaseClient();
  const userId = await currentUserId();
  if (!sb || !userId) return false;

  const { data, error } = await sb
    .from(TABLE)
    .select("value")
    .eq("user_id", userId)
    .eq("key", DOMAIN_KEY)
    .maybeSingle();
  if (error || !data) return false;

  const localRaw = localStorage.getItem(BOARD_STORAGE_KEY);
  const next = JSON.stringify(data.value);
  const changed = next !== localRaw;
  if (changed) localStorage.setItem(BOARD_STORAGE_KEY, next);
  snapshot = localStorage.getItem(BOARD_STORAGE_KEY);
  return changed;
}

async function pushBoard(): Promise<void> {
  const sb = getSupabaseClient();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const raw = localStorage.getItem(BOARD_STORAGE_KEY);
  if (raw === null) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  const version = Date.now();
  ownVersions.add(version);
  await sb
    .from(TABLE)
    .upsert({ user_id: userId, key: DOMAIN_KEY, value, version }, { onConflict: "user_id,key" });
}

/** Debounce-push when the local board changed since the last snapshot. */
export function flushChanges(): void {
  const raw = localStorage.getItem(BOARD_STORAGE_KEY);
  if (raw === snapshot) return;
  snapshot = raw;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushBoard(), 1000);
}

function subscribeForeignChanges(userId: string, onForeign: () => void): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};
  const channel = sb
    .channel("kairos_board_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { key?: string; version?: number } | undefined;
        if (row?.key !== DOMAIN_KEY) return; // ignore Chronos' rows
        if (typeof row.version === "number" && ownVersions.has(row.version)) return; // our own echo
        onForeign();
      },
    )
    .subscribe();
  return () => { sb.removeChannel(channel); };
}

/** Mount once at the app root. Pulls on cloud login, then pushes local edits. */
export function useBoardSync(): void {
  const { session, isCloud } = useAuth();
  const t = useT();

  useEffect(() => {
    // Cloud accounts only — a local guest stays entirely in the browser.
    if (!isCloud || !session?.email) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const changed = await pullBoard();
      if (cancelled) return;
      if (changed) window.dispatchEvent(new Event(BOARD_PULLED_EVENT));
      interval = setInterval(flushChanges, 3000);

      const userId = await currentUserId();
      if (userId && !cancelled) {
        unsubscribe = subscribeForeignChanges(userId, () => {
          void pullBoard().then((pulled) => {
            if (!pulled) return;
            window.dispatchEvent(new Event(BOARD_PULLED_EVENT));
            toast(t.common.updatedElsewhere, { description: t.common.updatedElsewhereDesc });
          });
        });
      }
    })();

    const flush = () => flushChanges();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      unsubscribe?.();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [isCloud, session?.email]);
}
