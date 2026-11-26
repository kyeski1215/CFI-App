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
  all,
} from "./store";
import { buildCard, type StudentCard } from "./card";
import { getProfile } from "./profile";
import type { Resource, Ride, Student } from "./types";

// The publishable key is designed to ship in client code; row-level security protects the data.
// Env vars override these (e.g. to point a dev build at a different project).
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://rhegqbbsnvsalkmslext.supabase.co";
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "sb_publishable_-ftazVXaXQcBgvx-ireUZQ_9rvRBBVA";
// VITE_DISABLE_SYNC=1 builds an on-device-only preview (e.g. for hosts that block outside connections).
const DISABLED = import.meta.env.VITE_DISABLE_SYNC === "1";
// PKCE puts the email-confirmation result in ?code= instead of the #hash, which the app's router uses.
export const supabase: SupabaseClient | null =
  !DISABLED && URL && KEY ? createClient(URL, KEY, { auth: { flowType: "pkce", detectSessionInUrl: true } }) : null;
const appUrl = () => window.location.origin + window.location.pathname;
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
export const getSession = () => state.session;
const syncedHooks = new Set<() => void>();
/** Run after each successful sync (and on sign-in). */
export function onSynced(fn: () => void) {
  syncedHooks.add(fn);
  return () => syncedHooks.delete(fn);
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
        .eq("user_id", uid) // only my own records; cards shared with me are read separately
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
    if (takeDirty().length) again = true; // merged local edits go back up on the next pass
    await publishCards(uid);
    localStorage.setItem(CURSOR_KEY, newest);
    set({ status: "idle", lastSync: Date.now() });
    syncedHooks.forEach((f) => { try { f(); } catch { /* ignore */ } });
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
    localStorage.removeItem(CARD_HASH);
    markAllDirty();
  }
  syncNow();
  loadMyCards();
  loadSharedLibrary();
  loadSharedFleet();
}

export function initSync() {
  setOnChange(() => scheduleSync());
  if (!supabase) return;
  loadSharedLibrary(); // readable even before sign-in
  supabase.auth.getSession().then(({ data }) => onSession(data.session));
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      try { localStorage.removeItem(MY_CARDS); localStorage.removeItem(FLEET); } catch { /* ignore */ }
      fleetState = { items: [], loaded: false };
      fleetSubs.forEach((f) => f());
      setCards({ cards: [], loaded: false });
    }
    if (session?.user.id !== state.session?.user.id) onSession(session);
    else set({ session });
  });
  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncNow();
      loadMyCards();
      loadSharedLibrary();
      loadSharedFleet();
    }
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
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
  if (error) throw error;
  return !!data.session; // false → confirmation email sent
}
export async function signOut() {
  await supabase?.auth.signOut();
}

/** Asks the student-summary Edge Function for AI strengths / needs-work drawn from the lesson log. */
export async function summarizeStudent(s: {
  name: string; goal: string; stage?: string; strengths?: string; weaknesses?: string;
  log?: { date?: string; kind?: string; lesson?: string; notes?: string; hrs?: string; tail?: string }[];
}): Promise<{ strengths: string; needsWork: string; lessons: number }> {
  if (!supabase) throw new Error("AI summaries need cloud sync, which isn't set up in this copy of the app.");
  if (!state.session) throw new Error("Sign in under Settings to use AI summaries.");
  const log = (s.log ?? []).map(({ date, kind, lesson, notes, hrs, tail }) => ({ date, kind, lesson, notes, hrs, tail }));
  const { data, error } = await supabase.functions.invoke("student-summary", {
    body: { name: s.name, goal: s.goal, stage: s.stage, strengths: s.strengths, weaknesses: s.weaknesses, log },
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    try {
      const b = ctx ? await ctx.json() : null;
      if (b?.error) msg = b.error;
    } catch {
      /* keep generic message */
    }
    if (/Failed to send|not found|404/i.test(msg)) msg = "The AI summary function isn't deployed yet. See README → AI summaries.";
    throw new Error(msg);
  }
  return data;
}

/* ---- student cards ---- */
const CARD_HASH = "cfi.v1.cardhash";

/** Publish a read-only card for each student with sharing on; withdraw cards that were turned off. */
async function publishCards(uid: string) {
  if (!supabase) return;
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(localStorage.getItem(CARD_HASH) ?? "{}"); } catch { /* first run */ }
  const rides = all<Ride>("rides");
  const library = all<Resource>("resources");
  const prof = getProfile();
  const instructor = prof?.displayName?.trim() || state.session?.user.email || undefined;
  const school = prof?.schoolName?.trim() || prof?.logo ? { name: prof?.schoolName?.trim() || undefined, logo: prof?.logo } : undefined;
  const rows: Record<string, unknown>[] = [];
  const next: Record<string, string> = {};
  for (const st of all<Student>("students")) {
    const built = buildCard(st, rides, instructor, library);
    if (!built) continue;
    const card = school ? { ...built, school } : built;
    const { updated: _u, ...stable } = card;
    const hash = JSON.stringify(stable);
    next[st.id] = String(hash.length) + ":" + simpleHash(hash);
    if (sent[st.id] !== next[st.id]) rows.push({ user_id: uid, collection: "cards", id: st.id, data: card, updated_ms: Date.now(), deleted: false });
  }
  for (const id of Object.keys(sent))
    if (!next[id]) rows.push({ user_id: uid, collection: "cards", id, data: {}, updated_ms: Date.now(), deleted: true });
  if (!rows.length) return;
  const { error } = await supabase.from("records").upsert(rows);
  if (error) throw error;
  localStorage.setItem(CARD_HASH, JSON.stringify(next));
}
function simpleHash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const MY_CARDS = "cfi.v1.mycards";
type CardsState = { cards: StudentCard[]; loaded: boolean; error?: string };
let cardsState: CardsState = { cards: readMyCards(), loaded: false };
const cardSubs = new Set<() => void>();
function readMyCards(): StudentCard[] {
  try { return JSON.parse(localStorage.getItem(MY_CARDS) ?? "[]"); } catch { return []; }
}
function setCards(p: Partial<CardsState>) {
  cardsState = { ...cardsState, ...p };
  cardSubs.forEach((f) => f());
}
/** Training cards other instructors shared with the signed-in account (the student view). */
export function useMyCards() {
  return useSyncExternalStore((l) => (cardSubs.add(l), () => cardSubs.delete(l)), () => cardsState);
}
export async function loadMyCards() {
  if (!supabase || !state.session) return;
  const { data, error } = await supabase
    .from("records")
    .select("user_id,id,data")
    .eq("collection", "cards")
    .eq("deleted", false)
    .neq("user_id", state.session.user.id);
  if (error) return setCards({ loaded: true, error: error.message });
  const cards = (data ?? []).map((r) => ({ ...(r.data as StudentCard), _owner: r.user_id as string, _id: r.id as string })).filter((c) => c?.v === 1);
  try { localStorage.setItem(MY_CARDS, JSON.stringify(cards)); } catch { /* ignore */ }
  setCards({ cards, loaded: true, error: undefined });
}

/* ---- shared resource library ---- */
// Resources added by the library owner (listed in app_admins) are readable by every user via RLS.
const SHARED_LIB = "cfi.v1.sharedlib";
type LibState = { items: Resource[]; isOwner: boolean; loaded: boolean };
let libState: LibState = { items: readSharedLib(), isOwner: false, loaded: false };
const libSubs = new Set<() => void>();
function readSharedLib(): Resource[] {
  try { return JSON.parse(localStorage.getItem(SHARED_LIB) ?? "[]"); } catch { return []; }
}
function setLib(p: Partial<LibState>) {
  libState = { ...libState, ...p };
  libSubs.forEach((f) => f());
}
export function useSharedLibrary() {
  return useSyncExternalStore((l) => (libSubs.add(l), () => libSubs.delete(l)), () => libState);
}
export async function loadSharedLibrary() {
  if (!supabase) return;
  const me = state.session?.user.id;
  let q = supabase.from("records").select("data").eq("collection", "resources").eq("deleted", false);
  if (me) q = q.neq("user_id", me);
  const [{ data, error }, owner] = await Promise.all([
    q,
    me ? supabase.rpc("is_app_admin", { uid: me }) : Promise.resolve({ data: false }),
  ]);
  if (error) return setLib({ loaded: true }); // library not set up yet: keep any cached copy
  const items = (data ?? []).map((r) => r.data as Resource).filter((r) => r && r.url && !r.builtinId && !r.hidden);
  try { localStorage.setItem(SHARED_LIB, JSON.stringify(items)); } catch { /* ignore */ }
  setLib({ items, isOwner: owner.data === true, loaded: true });
}

/* ---- Blitz fleet ---- */
// Aircraft on the library owner's account, readable (via RLS) only by Blitz members and their shared students.
const FLEET = "cfi.v1.fleet";
type FleetState = { items: AircraftShared[]; loaded: boolean };
export type AircraftShared = { id: string; name: string; tails?: string; links?: { title: string; url: string; kind: string }[]; vspeeds?: Record<string, string>; notes?: string; squawks?: { id: string; date: string; tail?: string; text: string; resolved?: boolean }[] };
let fleetState: FleetState = { items: readFleet(), loaded: false };
const fleetSubs = new Set<() => void>();
function readFleet(): AircraftShared[] {
  try { return JSON.parse(localStorage.getItem(FLEET) ?? "[]"); } catch { return []; }
}
export function useSharedFleet() {
  return useSyncExternalStore((l) => (fleetSubs.add(l), () => fleetSubs.delete(l)), () => fleetState);
}
export async function loadSharedFleet() {
  if (!supabase || !state.session) return;
  const { data, error } = await supabase
    .from("records")
    .select("data")
    .eq("collection", "aircraft")
    .eq("deleted", false)
    .neq("user_id", state.session.user.id);
  if (error) return;
  const items = (data ?? []).map((r) => r.data as AircraftShared).filter((a) => a?.name);
  try { localStorage.setItem(FLEET, JSON.stringify(items)); } catch { /* ignore */ }
  fleetState = { items, loaded: true };
  fleetSubs.forEach((f) => f());
}

/* ---- Blitz access management (library owner only; enforced in the database) ---- */
export type BlitzMember = { email: string; signed_up: boolean; is_owner: boolean };
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("Cloud sync isn't set up.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (/Could not find the function|does not exist/i.test(error.message)) throw new Error("Run supabase/sharing-all-in-one.sql in Supabase first.");
    throw new Error(error.message);
  }
  return data as T;
}
export const listBlitzMembers = async () =>
  (await rpc<{ member_email: string; signed_up: boolean; is_owner: boolean }[]>("blitz_member_list")).map((r) => ({
    email: r.member_email, signed_up: r.signed_up, is_owner: r.is_owner,
  }));
export const addBlitzMember = (email: string) => rpc<null>("blitz_add", { member_email: email });
export const removeBlitzMember = (email: string) => rpc<null>("blitz_remove", { member_email: email });
