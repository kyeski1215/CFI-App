// Real checkride results and moving a student on to their next rating.
import { STATUSES } from "./curriculum";
import { newId, todayStr } from "./store";
import type { Checkride, Student } from "./types";

/** The usual next rating after a pass. */
export const NEXT_RATING: Record<string, string> = {
  "Private Pilot": "Instrument",
  Instrument: "Commercial",
  Commercial: "CFI",
  CFI: "CFII",
  CFII: "Multi-Engine",
  "Multi-Engine": "CFI",
};

export interface CheckrideRow extends Checkride { studentId: string; studentName: string; attempt: number }

/** Every checkride across the roster, newest first, with which attempt it was for that student and rating. */
export function allCheckrides(students: Student[]): CheckrideRow[] {
  const rows: CheckrideRow[] = [];
  for (const s of students) {
    const byRating = new Map<string, number>();
    [...(s.checkrides ?? [])].sort((a, b) => a.date.localeCompare(b.date)).forEach((c) => {
      const n = (byRating.get(c.rating) ?? 0) + 1;
      byRating.set(c.rating, n);
      rows.push({ ...c, studentId: s.id, studentName: s.name, attempt: n });
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function checkrideStats(rows: CheckrideRow[]) {
  const graded = rows.filter((r) => r.result !== "Discontinued");
  const pass = graded.filter((r) => r.result === "Pass").length;
  const firsts = graded.filter((r) => r.attempt === 1);
  const firstPass = firsts.filter((r) => r.result === "Pass").length;
  const byRating = new Map<string, { pass: number; fail: number }>();
  for (const r of graded) {
    const x = byRating.get(r.rating) ?? { pass: 0, fail: 0 };
    if (r.result === "Pass") x.pass++;
    else x.fail++;
    byRating.set(r.rating, x);
  }
  return {
    pass,
    fail: graded.length - pass,
    rate: graded.length ? Math.round((pass / graded.length) * 100) : null,
    firstRate: firsts.length ? Math.round((firstPass / firsts.length) * 100) : null,
    byRating: [...byRating.entries()],
  };
}

/** The student record after logging a checkride; optionally starts them on the next rating. */
export function recordCheckride(s: Student, c: Omit<Checkride, "id">, moveTo?: string): Student {
  const next: Student = { ...s, checkrides: [...(s.checkrides ?? []), { ...c, id: newId() }] };
  if (c.result === "Pass") {
    if (moveTo) {
      next.goal = moveTo;
      next.status = STATUSES[0][0];
      next.stage = "";
      next.nextLesson = "";
    } else next.status = "Done";
  } else if (c.result === "Fail") next.status = "Needs work";
  return next;
}
export const blankCheckride = (s: Student): Omit<Checkride, "id"> => ({ date: todayStr(), rating: s.goal, result: "Pass" });
