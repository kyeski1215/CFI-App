// Local-first record store. Every collection lives in localStorage and is
// mirrored to Supabase by sync.ts when the user is signed in.
import { useSyncExternalStore } from "react";

export type Collection = "students" | "rides" | "resources" | "lessons" | "aircraft" | "profile";
export const COLLECTIONS: Collection[] = ["students", "rides", "resources", "lessons", "aircraft", "profile"];

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
  const now = Date.now();
  const next = stamp(data.get(c)!.get(rec.id), { ...rec, updatedAt: now } as BaseRec, now) as T;
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
  const key = c + "/" + rec.id;
  const local = m.get(rec.id);
  if (!local) {
    m.set(rec.id, rec);
    return true;
  }
  if (rec.updatedAt <= local.updatedAt && !dirty.has(key)) return false; // we already have this or newer
  const merged = mergeRecords(local, rec);
  if (sameContent(merged, rec)) {
    m.set(rec.id, rec);
    dirty.delete(key);
  } else {
    // Local edits the server doesn't have yet: keep them and upload the merged version.
    merged.updatedAt = Math.max(Date.now(), rec.updatedAt + 1);
    m.set(rec.id, merged);
    dirty.add(key);
  }
  return !sameContent(local, merged);
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
/** Run a callback after any local or synced change (used for one-time data upgrades). */
export function onStoreChange(l: Listener) {
  return subscribe(l);
}
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

/* ---- field-level merge so edits on two devices don't overwrite each other ----
   Each record carries _ts (last edit time per field). Arrays of objects with an id (lesson log,
   squawks) are merged item by item using _its (per-item edit time) and _gone (deletion time). */
type Meta = { _ts?: Record<string, number>; _its?: Record<string, Record<string, number>>; _gone?: Record<string, Record<string, number>> };
type R = BaseRec & Meta & Record<string, unknown>;
const META = new Set(["id", "createdAt", "updatedAt", "_ts", "_its", "_gone"]);
const isItemList = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Stamp the fields and list items that changed since prev with `now`. */
function stamp(prevRaw: BaseRec | undefined, nextRaw: BaseRec, now: number): BaseRec {
  const prev = prevRaw as R | undefined, next = nextRaw as R;
  const base = prev?.updatedAt ?? now; // fields never stamped before date from the previous save
  const ts = { ...(prev?._ts ?? {}) }, its = { ...(prev?._its ?? {}) }, gone = { ...(prev?._gone ?? {}) };
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
  for (const k of keys) {
    if (META.has(k)) continue;
    const pv = prev?.[k], nv = next[k];
    if (isItemList(pv) || isItemList(nv)) {
      const pm = new Map((isItemList(pv) ? pv : []).map((x) => [x.id, x]));
      const nm = new Map((isItemList(nv) ? nv : []).map((x) => [x.id, x]));
      const t = { ...(its[k] ?? {}) }, g = { ...(gone[k] ?? {}) };
      for (const [id, item] of nm) {
        if (!pm.has(id) || !same(pm.get(id), item)) t[id] = now;
        else t[id] ??= base;
      }
      for (const id of pm.keys()) if (!nm.has(id)) { g[id] = now; delete t[id]; }
      its[k] = t;
      gone[k] = g;
      ts[k] ??= base;
      continue;
    }
    if (prev && !same(pv, nv)) ts[k] = now;
    else ts[k] ??= base;
  }
  return { ...next, _ts: ts, _its: its, _gone: gone } as BaseRec;
}

export function mergeRecords(aRaw: BaseRec, bRaw: BaseRec): BaseRec {
  const a = aRaw as R, b = bRaw as R;
  const tA = (k: string) => a._ts?.[k] ?? a.updatedAt, tB = (k: string) => b._ts?.[k] ?? b.updatedAt;
  const out: R = { id: a.id, createdAt: Math.min(a.createdAt ?? Infinity, b.createdAt ?? Infinity) || a.createdAt, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
  const ts: Record<string, number> = {}, its: Record<string, Record<string, number>> = {}, gone: Record<string, Record<string, number>> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (META.has(k)) continue;
    const av = a[k], bv = b[k];
    if (isItemList(av) || isItemList(bv)) {
      const ga = a._gone?.[k] ?? {}, gb = b._gone?.[k] ?? {};
      const g: Record<string, number> = { ...ga };
      for (const [id, t] of Object.entries(gb)) g[id] = Math.max(g[id] ?? 0, t);
      const ia = a._its?.[k] ?? {}, ib = b._its?.[k] ?? {};
      const items = new Map<string, { item: { id: string }; t: number }>();
      for (const x of isItemList(av) ? av : []) items.set(x.id, { item: x, t: ia[x.id] ?? a.updatedAt });
      for (const x of isItemList(bv) ? bv : []) {
        const t = ib[x.id] ?? b.updatedAt, cur = items.get(x.id);
        if (!cur || t > cur.t) items.set(x.id, { item: x, t });
      }
      const list: { id: string }[] = [], it: Record<string, number> = {};
      for (const [id, { item, t }] of items) {
        if ((g[id] ?? 0) >= t) continue; // deleted after its last edit
        list.push(item);
        it[id] = t;
        delete g[id];
      }
      out[k] = list;
      its[k] = it;
      gone[k] = g;
      ts[k] = Math.max(tA(k), tB(k));
      continue;
    }
    const useB = tB(k) > tA(k);
    const v = useB ? bv : av;
    if (v !== undefined) out[k] = v;
    ts[k] = Math.max(tA(k), tB(k));
  }
  out._ts = ts;
  out._its = its;
  out._gone = gone;
  return out;
}

const strip = (r: BaseRec) => {
  const { updatedAt: _u, _ts, _its, _gone, ...rest } = r as R;
  void _u; void _ts; void _its; void _gone;
  return rest;
};
function sameContent(a: BaseRec, b: BaseRec) {
  const x = strip(a), y = strip(b);
  const norm = (o: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      const v = o[k];
      out[k] = isItemList(v) ? [...v].sort((p, q) => p.id.localeCompare(q.id)) : v;
    }
    return out;
  };
  return same(norm(x), norm(y));
}

/* ---- safety copies before big changes ---- */
const SNAP_KEY = PREFIX + "snapshots";
export interface Snapshot { id: string; label: string; at: number; data: Partial<Record<Collection, BaseRec[]>> }
export function listSnapshots(): Snapshot[] {
  return read<Snapshot[]>(SNAP_KEY, []);
}
/** Save a copy of these collections before a bulk change. Keeps the last 5; drops the oldest if storage is full. */
export function snapshot(label: string, cols: Collection[] = ["students"]): string {
  const snap: Snapshot = { id: newId(), label, at: Date.now(), data: {} };
  for (const c of cols) snap.data[c] = [...data.get(c)!.values()];
  let list = [snap, ...listSnapshots()].slice(0, 5);
  while (list.length) {
    try {
      localStorage.setItem(SNAP_KEY, JSON.stringify(list));
      break;
    } catch {
      list = list.slice(0, -1); // storage full: drop the oldest copy and try again
    }
  }
  snapSubs.forEach((f) => f());
  return snap.id;
}
/** Put the saved collections back as they were. The restore is itself a normal edit, so it syncs everywhere. */
export function restoreSnapshot(id: string): boolean {
  const snap = listSnapshots().find((x) => x.id === id);
  if (!snap) return false;
  snapshot("Before restoring “" + snap.label + "”", Object.keys(snap.data) as Collection[]);
  for (const [c, recs] of Object.entries(snap.data) as [Collection, BaseRec[]][]) {
    const keep = new Set(recs.map((r) => r.id));
    for (const r of recs) {
      const cur = data.get(c)!.get(r.id);
      if (!cur || !sameContent(cur, r)) put(c, { ...r });
    }
    for (const [rid, cur] of data.get(c)!) if (!keep.has(rid) && !cur.deleted) put(c, { ...cur, deleted: true });
  }
  return true;
}
const snapSubs = new Set<() => void>();
export function useSnapshots() {
  return useSyncExternalStore((l) => (snapSubs.add(l), () => snapSubs.delete(l)), listSnapshotsCached);
}
let cache: { raw: string | null; list: Snapshot[] } = { raw: null, list: [] };
function listSnapshotsCached() {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SNAP_KEY); } catch { /* ignore */ }
  if (raw !== cache.raw) cache = { raw, list: raw ? JSON.parse(raw) : [] };
  return cache.list;
}
