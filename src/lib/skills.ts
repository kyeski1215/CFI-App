// Free, on-device strengths / needs-work, built from (1) the ✓/✗ skill ratings on logged lessons
// and (2) the student's most recent mock checkride grades. No network, no AI.
import { BANKS } from "./banks";
import type { LogEntry, Ride, Student } from "./types";

export type Rating = "good" | "work";

export interface SkillStat {
  skill: string;
  latest: Rating;
  lastDate: string;
  good: number; // ✓ count in the recent window
  work: number; // ✗ count in the recent window
}

const RECENT = 4; // ratings per skill that count toward the summary

export function skillSummary(s: Student) {
  const entries = (s.log ?? [])
    .filter((e): e is LogEntry & { ratings: Record<string, Rating> } => !!e.ratings && Object.keys(e.ratings).length > 0)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const bySkill = new Map<string, { r: Rating; date: string }[]>();
  for (const e of entries)
    for (const [skill, r] of Object.entries(e.ratings)) {
      if (!bySkill.has(skill)) bySkill.set(skill, []);
      bySkill.get(skill)!.push({ r, date: e.date });
    }

  const strengths: SkillStat[] = [];
  const improving: SkillStat[] = [];
  const needsWork: SkillStat[] = [];
  for (const [skill, list] of bySkill) {
    const recent = list.slice(0, RECENT);
    const stat: SkillStat = {
      skill,
      latest: recent[0].r,
      lastDate: recent[0].date,
      good: recent.filter((x) => x.r === "good").length,
      work: recent.filter((x) => x.r === "work").length,
    };
    if (stat.latest === "work") needsWork.push(stat); // still ✗ on the most recent lesson
    else if (stat.work > 0) improving.push(stat); // ✓ now, but ✗ recently
    else strengths.push(stat); // only ✓ recently
  }
  // Most evidence first; most recent ✗ first for needs work.
  strengths.sort((a, b) => b.good - a.good || b.lastDate.localeCompare(a.lastDate));
  improving.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  needsWork.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.work - a.work);
  return { strengths, improving, needsWork, ratedLessons: entries.length };
}

/** Topics from the most recent graded mock checkride: weak (any W/U) and solid (all S, at least 3 graded). */
export function mockSummary(rides: Ride[], studentId: string) {
  const ride = rides
    .filter((r) => r.studentId === studentId && Object.keys(r.grades ?? {}).length)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const bank = ride ? BANKS[ride.bank] : undefined;
  if (!ride || !bank) return null;
  const weak: { topic: string; w: number; u: number }[] = [];
  const solid: { topic: string; s: number }[] = [];
  for (const sec of bank.sections) {
    let s = 0, w = 0, u = 0;
    for (const q of sec.qs) {
      const g = ride.grades[q[0]];
      if (g === "S") s++;
      else if (g === "W") w++;
      else if (g === "U") u++;
    }
    const topic = sec.short || sec.t;
    if (w + u) weak.push({ topic, w, u });
    else if (s >= 3) solid.push({ topic, s });
  }
  weak.sort((a, b) => b.u - a.u || b.w - a.w);
  solid.sort((a, b) => b.s - a.s);
  return { ride, bankShort: bank.short, weak, solid };
}
