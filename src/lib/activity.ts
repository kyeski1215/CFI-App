// What a student does on their side of the app: lesson prep ticked off, debriefs read, flashcard
// progress, and questions for their instructor. Saved on the student's device first, then to the
// student_activity table (supabase/student-study.sql), where the instructor who shared the card can read it.
import { useContext, useEffect, useSyncExternalStore } from "react";
import { PreviewCtx } from "./preview";
import type { StudentCard } from "./card";
import { todayStr } from "./store";
import { getSession, onSynced, supabase } from "./sync";

export interface AskedQuestion { id: string; text: string; ctx?: string; at: string }
export interface CardProgress { b: number; due: string; seen: string } // Leitner box 0–4
export interface Activity {
  prep?: Record<string, string>; // "lessonKey|item" → date ticked
  reviewed?: Record<string, string>; // logKey → date read
  cards?: Record<string, CardProgress>; // flashcard id → progress
  studied?: Record<string, number>; // date → cards studied that day
  questions?: AskedQuestion[];
}

/** Combine two copies (e.g. phone and laptop): keep every question, the newest flashcard state, the most studied. */
export function mergeActivity(a: Activity = {}, b: Activity = {}): Activity {
  const later = <T,>(x: Record<string, T> = {}, y: Record<string, T> = {}, newer: (p: T, q: T) => boolean) => {
    const out = { ...x };
    for (const [k, v] of Object.entries(y)) if (!(k in out) || newer(v, out[k])) out[k] = v;
    return out;
  };
  const qs = new Map<string, AskedQuestion>();
  [...(a.questions ?? []), ...(b.questions ?? [])].forEach((q) => qs.set(q.id, q));
  return {
    prep: later(a.prep, b.prep, (p, q) => p > q),
    reviewed: later(a.reviewed, b.reviewed, (p, q) => p > q),
    cards: later(a.cards, b.cards, (p, q) => p.seen > q.seen),
    studied: later(a.studied, b.studied, (p, q) => p > q),
    questions: [...qs.values()].sort((x, y) => x.at.localeCompare(y.at)),
  };
}

/* ---- the student's own activity, one per shared card ---- */
type Slot = { act: Activity; loaded: boolean; saving: boolean; error?: string };
const slots = new Map<string, Slot>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const slotKey = (c: StudentCard) => `${c._owner ?? "local"}:${c._id ?? c.studentEmail}`;
const LS = (k: string) => "cfi.v1.act." + k;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Replace a slot with a new object so React sees the change. */
function patch(k: string, p: Partial<Slot>) {
  slots.set(k, { ...(slots.get(k) as Slot), ...p });
  emit();
}

function slotFor(c: StudentCard): Slot {
  const k = slotKey(c);
  let s = slots.get(k);
  if (!s) {
    let act: Activity = {};
    try { act = JSON.parse(localStorage.getItem(LS(k)) ?? "{}"); } catch { /* first use */ }
    s = { act, loaded: false, saving: false };
    slots.set(k, s);
  }
  return s;
}

async function loadRemote(c: StudentCard) {
  const k = slotKey(c);
  const s = slotFor(c);
  if (s.loaded || !supabase || !getSession() || !c._owner || !c._id) return;
  patch(k, { loaded: true });
  const { data, error } = await supabase.from("student_activity").select("data").eq("cfi_user", c._owner).eq("card_id", c._id).maybeSingle();
  if (error) return patch(k, { error: error.message });
  if (data?.data) {
    const act = mergeActivity(data.data as Activity, slotFor(c).act);
    try { localStorage.setItem(LS(k), JSON.stringify(act)); } catch { /* ignore */ }
    patch(k, { act });
  }
}

async function saveRemote(c: StudentCard) {
  const sess = getSession();
  if (!supabase || !sess || !c._owner || !c._id) return;
  const k = slotKey(c);
  const { error } = await supabase.from("student_activity").upsert({
    cfi_user: c._owner, card_id: c._id, student_user: sess.user.id, student_email: c.studentEmail, data: slotFor(c).act, updated_at: new Date().toISOString(),
  });
  patch(k, { error: error ? error.message : undefined });
}

/** The signed-in student's activity for one card, and a function to change it (saved locally at once, online shortly after). */
export function useActivity(c: StudentCard | undefined) {
  const pv = useContext(PreviewCtx);
  useEffect(() => { if (c && !pv) loadRemote(c); }, [c?._owner, c?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const snap = useSyncExternalStore((l) => (subs.add(l), () => subs.delete(l)), () => (c ? slotFor(c) : undefined));
  const update = (fn: (a: Activity) => Activity) => {
    if (!c) return;
    const k = slotKey(c);
    const s = slotFor(c);
    const next = { ...s, act: fn(s.act) };
    slots.set(k, next);
    try { localStorage.setItem(LS(k), JSON.stringify(next.act)); } catch { /* ignore */ }
    emit();
    clearTimeout(timers.get(k));
    timers.set(k, setTimeout(() => saveRemote(c), 1200));
  };
  if (pv && c === pv.card) return { act: pv.act, error: undefined, update: (_fn: (a: Activity) => Activity) => pv.blocked() };
  return { act: snap?.act ?? {}, error: snap?.error, update };
}

/* small helpers the student screens share */
export const askQuestion = (text: string, ctx?: string) => (a: Activity): Activity => ({
  ...a,
  questions: [...(a.questions ?? []), { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: text.trim(), ctx, at: new Date().toISOString() }],
});
export const togglePrep = (key: string) => (a: Activity): Activity => {
  const prep = { ...a.prep };
  if (prep[key]) delete prep[key];
  else prep[key] = todayStr();
  return { ...a, prep };
};
export const markReviewed = (key: string, on = true) => (a: Activity): Activity => {
  const reviewed = { ...a.reviewed };
  if (on) reviewed[key] = todayStr();
  else delete reviewed[key];
  return { ...a, reviewed };
};

/* ---- the instructor's view: every activity record for cards you shared ---- */
type Theirs = { rows: Record<string, { data: Activity; updated_at: string; student_email: string }>; loaded: boolean; error?: string };
let theirs: Theirs = { rows: {}, loaded: false };
const theirSubs = new Set<() => void>();
export async function loadInstructorActivity() {
  const sess = getSession();
  if (!supabase || !sess) return;
  const { data, error } = await supabase.from("student_activity").select("card_id,data,updated_at,student_email").eq("cfi_user", sess.user.id);
  theirs = error
    ? { ...theirs, loaded: true, error: /relation .*student_activity|does not exist|schema cache/i.test(error.message) ? "setup" : error.message }
    : { rows: Object.fromEntries((data ?? []).map((r) => [r.card_id as string, { data: r.data as Activity, updated_at: r.updated_at as string, student_email: r.student_email as string }])), loaded: true };
  theirSubs.forEach((f) => f());
}
onSynced(() => { loadInstructorActivity(); });
/** A student's activity as seen by their instructor (undefined until they've used their side). */
export function useStudentActivity(studentId: string | undefined) {
  useEffect(() => { loadInstructorActivity(); }, [studentId]);
  const t = useSyncExternalStore((l) => (theirSubs.add(l), () => theirSubs.delete(l)), () => theirs);
  return { row: studentId ? t.rows[studentId] : undefined, loaded: t.loaded, error: t.error };
}
