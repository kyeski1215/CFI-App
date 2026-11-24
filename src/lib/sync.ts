// Supabase sync. Each record is one row in `records` (see supabase/schema.sql).
// Push: upsert dirty records. Pull: rows whose server_ts moved past our cursor.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import {
  COLLECTIONS,
  type BaseRec,
  type Collection,
  clearDirty,
  commitMerged,
  markAllDirty,
  mergeRemote,
  setOnChange,
  takeDirty,
} from "./store";

// The publishable key is designed to ship in client code; row-level security protects the data.
// Env vars override these (e.g. to point a dev build at a different project).
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://rhegqbbsnvsalkmslext.supabase.co";
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "sb_publishable_-ftazVXaXQcBgvx-ireUZQ_9rvRBBVA";
export const supabase: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;
export const syncConfigured = !!supabase;

type SyncState = {
  session: Session | null;
  status: "off" | "idle" | "syncing" | "error" | "offline";
  lastSync: number | null;
  error?: string;
};
let state: SyncState = { session: null, status: syncConfigured ? "idle" : "off", lastSync: null };
const subs = new Set<() => void>();
function set(p: Partial<SyncState>) {
  state = { ...state, ...p };
  subs.forEach((s) => s());
}
export function useSync() {
  return useSyncExternalStore(
    (l) => (subs.add(l), () => subs.delete(l)),
    () => state,
  );
}

const CURSOR_KEY = "cfi.v1.cursor";
const OWNER_KEY = "cfi.v1.owner";

let timer: number | undefined;
let running = false;
let again = false;

export function scheduleSync(delay = 1200) {
  if (!supabase || !state.session) return;
  clearTimeout(timer);
  timer = window.setTimeout(syncNow, delay);
}

export async function syncNow() {
  if (!supabase || !state.session) return;
  if (running) {
    again = true;
    return;
  }
  if (!navigator.onLine) {
    set({ status: "offline" });
    return;
  }
  running = true;
  set({ status: "syncing", error: undefined });
  try {
    const uid = state.session.user.id;
    // push
    const pending = takeDirty();
    if (pending.length) {
      const rows = pending.map(({ c, rec }) => ({
        user_id: uid,
        collection: c,
        id: rec.id,
        data: rec,
        updated_ms: rec.updatedAt,
        deleted: !!rec.deleted,
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("records").upsert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      clearDirty(pending.map(({ c, rec }) => c + "/" + rec.id));
    }
    // pull
    const cursor = localStorage.getItem(CURSOR_KEY) ?? "1970-01-01T00:00:00Z";
    let newest = cursor;
    const changed = new Set<Collection>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("records")
        .select("collection,data,server_ts")
        .gt("server_ts", cursor)
        .order("server_ts")
        .range(from, from + 999);
      if (error) throw error;
      for (const row of data ?? []) {
        const c = row.collection as Collection;
        if (COLLECTIONS.includes(c) && mergeRemote(c, row.data as BaseRec)) changed.add(c);
        if (row.server_ts > newest) newest = row.server_ts;
      }
      if (!data || data.length < 1000) break;
    }
    commitMerged(changed);
    localStorage.setItem(CURSOR_KEY, newest);
    set({ status: "idle", lastSync: Date.now() });
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  } finally {
    running = false;
    if (again) {
      again = false;
      scheduleSync(300);
    }
  }
}

function onSession(session: Session | null) {
  set({ session });
  if (!session) return;
  // First sign-in on this device (or a different account): upload everything local.
  if (localStorage.getItem(OWNER_KEY) !== session.user.id) {
    localStorage.setItem(OWNER_KEY, session.user.id);
    localStorage.removeItem(CURSOR_KEY);
    markAllDirty();
  }
  syncNow();
}

export function initSync() {
  setOnChange(() => scheduleSync());
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => onSession(data.session));
  supabase.auth.onAuthStateChange((_e, session) => {
    if (session?.user.id !== state.session?.user.id) onSession(session);
    else set({ session });
  });
  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
  });
  window.setInterval(() => document.visibilityState === "visible" && syncNow(), 60_000);
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Sync isn't configured");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error("Sync isn't configured");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return !!data.session; // false → confirmation email sent
}
export async function signOut() {
  await supabase?.auth.signOut();
}
