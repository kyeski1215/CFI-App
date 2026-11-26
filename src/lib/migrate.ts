// One-time data upgrades that run on this device whenever students load or sync in.
import { OLD_LESSON_KEYS, migratePplProgress } from "./ppl";
import { all, get, onStoreChange, put } from "./store";
import type { Student } from "./types";
import { defaultLesson, type LessonRec } from "../components/LessonExtras";

let running = false;
function upgradePpl() {
  if (running) return;
  running = true;
  try {
    for (const s of all<Student>("students")) {
      if (s.goal !== "Private Pilot" || (s.pplPlan ?? 0) >= 2) continue;
      const r = migratePplProgress(s.guide, s.guideMarks as never);
      put("students", { ...s, ...(r.changed ? { guide: r.guide, guideMarks: r.guideMarks as Student["guideMarks"] } : {}), pplPlan: 2 });
    }
    // Your own homework / video edits on an old lesson follow it to the new lesson (if the new one has none yet).
    for (const [oldKey, targets] of Object.entries(OLD_LESSON_KEYS)) {
      const rec = get<LessonRec>("lessons", oldKey);
      if (!rec) continue;
      // Keep homework only if you changed it from the old built-in list; videos always come along.
      const hwChanged = rec.hw && JSON.stringify(rec.hw) !== JSON.stringify(defaultLesson(oldKey).hw ?? []);
      if (!hwChanged && !rec.items?.length) continue;
      for (const nk of targets) {
        if (get("lessons", nk)) continue;
        put<LessonRec>("lessons", { id: nk, createdAt: Date.now(), updatedAt: Date.now(), items: rec.items ?? [], ...(hwChanged ? { hw: rec.hw } : {}) });
      }
    }
  } finally {
    running = false;
  }
}

/** One time: the school's three Pilot 100i tails, on your Pilot 100i aircraft record. */
const TAILS_100I = ["N301BL", "N402BL", "N603BL"];
function fill100iTails() {
  try { if (localStorage.getItem("cfi.v1.fix.100i") === "1") return; } catch { return; }
  const rec = all<{ id: string; name: string; tails?: string; createdAt: number; updatedAt: number }>("aircraft").find((a) => /pilot\s*100\s*i/i.test(a.name));
  if (!rec) return; // not loaded yet, or this account has no Pilot 100i
  const have = (rec.tails ?? "").toUpperCase().split(/[\s,;/]+/).filter(Boolean);
  if (have.every((t) => TAILS_100I.includes(t)) && TAILS_100I.some((t) => !have.includes(t))) put("aircraft", { ...rec, tails: TAILS_100I.join(" ") });
  try { localStorage.setItem("cfi.v1.fix.100i", "1"); } catch { /* ignore */ }
}

export function initMigrations() {
  upgradePpl();
  fill100iTails();
  onStoreChange(() => setTimeout(() => { upgradePpl(); fill100iTails(); }, 0));
}
