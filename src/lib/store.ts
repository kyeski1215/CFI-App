// Local-first record store. Every collection lives in localStorage and is
// mirrored to Supabase by sync.ts when the user is signed in.
import { useSyncExternalStore } from "react";

export type Collection = "students" | "rides" | "resources" | "lessons" | "aircraft";
export const COLLECTIONS: Collection[] = ["students", "rides", "resources", "lessons", "aircraft"];

export interface BaseRec {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

const PREFIX = "cfi.v1.";
const DIRTY_KEY = PREFIX + "dirty";

type Listener = () => void;
const listeners = new Set<Listener>();
const data = new Map<Collection, Map<string, BaseRec>>();
const snapshots = new Map<Collection, BaseRec[]>();
let dirty = new Set<string>(); // "collection/id"
let onChange: (() => void) | null = null;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Could not save locally", e);
  }
}

for (const c of COLLECTIONS) {
  const list = read<BaseRec[]>(PREFIX + c, []);
  data.set(c, new Map(list.map((r) => [r.id, r])));
}
dirty = new Set(read<string[]>(DIRTY_KEY, []));

function persist(c: Collection) {
  write(PREFIX + c, [...data.get(c)!.values()]);
  snapshots.delete(c);
}
function persistDirty() {
  write(DIRTY_KEY, [...dirty]);
}
function emit() {
  listeners.forEach((l) => l());
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function all<T extends BaseRec>(c: Collection): T[] {
  let snap = snapshots.get(c);
  if (!snap) {
    snap = [...data.get(c)!.values()].filter((r) => !r.deleted);
    snapshots.set(c, snap);
  }
  return snap as T[];
}

export function get<T extends BaseRec>(c: Collection, id: string): T | undefined {
  const r = data.get(c)!.get(id);
  return r && !r.deleted ? (r as T) : undefined;
}

/** The stored record including a deleted one (tombstone), for seeding decisions. */
export function getRaw(c: Collection, id: string): BaseRec | undefined {
  return data.get(c)!.get(id);
}

/** True if a record with this id was ever stored, including deleted ones. */
export function has(c: Collection, id: string) {
  return data.get(c)!.has(id);
}

export function put<T extends BaseRec>(c: Collection, rec: T): T {
  const next = { ...rec, updatedAt: Date.now() };
  data.get(c)!.set(rec.id, next);
  dirty.add(c + "/" + rec.id);
  persist(c);
  persistDirty();
  emit();
  onChange?.();
  return next;
}

export function create<T extends BaseRec>(c: Collection, fields: Omit<T, keyof BaseRec>): T {
  const now = Date.now();
  return put(c, { ...(fields as object), id: newId(), createdAt: now, updatedAt: now } as T);
}

export function remove(c: Collection, id: string) {
  const r = data.get(c)!.get(id);
  if (r) put(c, { ...r, deleted: true });
}

/* ---- used by sync ---- */
export function takeDirty(): { c: Collection; rec: BaseRec }[] {
  return [...dirty].flatMap((k) => {
    const [c, id] = k.split("/") as [Collection, string];
    const rec = data.get(c)?.get(id);
    return rec ? [{ c, rec }] : [];
  });
}
export function clearDirty(keys: string[]) {
  keys.forEach((k) => dirty.delete(k));
  persistDirty();
}
/** Merge a remote record; newest updatedAt wins. */
export function mergeRemote(c: Collection, rec: BaseRec): boolean {
  const m = data.get(c);
  if (!m) return false;
  const local = m.get(rec.id);
  if (local && local.updatedAt >= rec.updatedAt) return false;
  m.set(rec.id, rec);
  dirty.delete(c + "/" + rec.id);
  return true;
}
export function commitMerged(changed: Set<Collection>) {
  changed.forEach(persist);
  persistDirty();
  if (changed.size) emit();
}
export function markAllDirty() {
  for (const c of COLLECTIONS) for (const id of data.get(c)!.keys()) dirty.add(c + "/" + id);
  persistDirty();
}
export function setOnChange(fn: () => void) {
  onChange = fn;
}

/* ---- backup ---- */
export function exportAll() {
  const out: Record<string, BaseRec[]> = {};
  for (const c of COLLECTIONS) out[c] = [...data.get(c)!.values()];
  return { app: "cfi-cockpit", version: 1, exportedAt: new Date().toISOString(), data: out };
}
export function importAll(json: { data?: Record<string, BaseRec[]> }) {
  let n = 0;
  for (const c of COLLECTIONS) {
    for (const rec of json.data?.[c] ?? []) {
      if (!rec?.id) continue;
      const local = data.get(c)!.get(rec.id);
      if (!local || (rec.updatedAt ?? 0) > local.updatedAt) {
        data.get(c)!.set(rec.id, { ...rec, createdAt: rec.createdAt ?? Date.now(), updatedAt: rec.updatedAt ?? Date.now() });
        dirty.add(c + "/" + rec.id);
        n++;
      }
    }
    persist(c);
  }
  persistDirty();
  emit();
  onChange?.();
  return n;
}

/* ---- React ---- */
function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useCollection<T extends BaseRec>(c: Collection): T[] {
  return useSyncExternalStore(subscribe, () => all<T>(c));
}
export function useRecord<T extends BaseRec>(c: Collection, id: string | undefined): T | undefined {
  return useSyncExternalStore(subscribe, () => (id ? get<T>(c, id) : undefined));
}

/* ---- small shared helpers ---- */
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00").getTime() - new Date(a + "T12:00").getTime()) / 864e5);
export const fmtDate = (d?: string) => {
  if (!d) return "";
  const [y, m, dd] = d.split("-");
  return `${+m}/${+dd}/${y.slice(2)}`;
};
