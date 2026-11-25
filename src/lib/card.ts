// The read-only "card" a student sees in their own account. Built on the instructor's device from the
// student record and published to Supabase (collection "cards"); RLS lets only the account whose email
// matches studentEmail read it. Private fields (your notes, phone, availability notes) stay out unless
// "share lesson notes" is on for that student.
import { buildBriefing, type Briefing } from "./briefing";
import { guideFor, guideKey, isActive, lastFlight, topicsFor, totalHours } from "./curriculum";
import { mockSummary, skillSummary } from "./skills";
import { daysBetween, todayStr } from "./store";
import type { Rating } from "./skills";
import type { Resource, Ride, Student } from "./types";
import { libraryFor, type LibraryItem } from "./library";

export interface StudentCard {
  v: 1;
  studentEmail: string;
  instructor?: string;
  name: string;
  goal: string;
  stage?: string;
  aircraft?: string;
  status: string;
  updated: string;
  stats: { hours: number; night: number; landings: number; flights30: number; lastFlight: string | null };
  plan: { n: string; note?: string; items: { label: string; when?: string; done?: string }[] }[] | null;
  topics: { t: string; done: boolean }[];
  skills: { strengths: string[]; improving: string[]; needsWork: string[] };
  mock: { date: string; bank: string; weak: string[]; solid: string[]; result?: string } | null;
  briefing: Briefing | null;
  resources?: LibraryItem[]; // instructor's recommended videos/links for this student's rating + General
  log: { date: string; kind: string; tail?: string; hrs?: string; lesson?: string; text?: string; notes?: string; ratings?: Record<string, Rating> }[];
}

export function buildCard(s: Student, rides: Ride[], instructor?: string, library: Resource[] = []): StudentCard | null {
  const email = (s.email ?? "").trim().toLowerCase();
  if (!s.shareWithStudent || !email || !isActive(s) && s.status !== "Done") return null;
  const today = todayStr();
  const flights = (s.log ?? []).filter((e) => e.kind !== "ground" && e.date);
  const num = (v?: string) => parseFloat(v ?? "") || 0;
  const sk = skillSummary(s);
  const mk = mockSummary(rides, s.id);
  const plan = guideFor(s);
  const covered = new Set(s.covered ?? []);
  return {
    v: 1,
    studentEmail: email,
    instructor,
    name: s.name,
    goal: s.goal,
    stage: s.stage,
    aircraft: s.aircraft,
    status: s.status,
    updated: new Date().toISOString(),
    stats: {
      hours: +totalHours(s).toFixed(1),
      night: +flights.reduce((a, e) => a + num(e.night), 0).toFixed(1),
      landings: flights.reduce((a, e) => a + num(e.ldgDay) + num(e.ldgNight), 0),
      flights30: flights.filter((e) => daysBetween(e.date, today) <= 30).length,
      lastFlight: lastFlight(s),
    },
    plan: plan
      ? plan.map((sec) => ({ n: sec.n, note: sec.note, items: sec.items.map(([k, label, when]) => ({ label, when, done: s.guide?.[guideKey(sec.id, k)] })) }))
      : null,
    topics: topicsFor(s).map((t) => ({ t, done: covered.has(t) })),
    skills: { strengths: sk.strengths.map((x) => x.skill), improving: sk.improving.map((x) => x.skill), needsWork: sk.needsWork.map((x) => x.skill) },
    mock: mk ? { date: mk.ride.date, bank: mk.bankShort, weak: mk.weak.map((w) => w.topic), solid: mk.solid.map((x) => x.topic), result: mk.ride.result } : null,
    briefing: buildBriefing(s),
    resources: libraryFor(s, library),
    log: [...(s.log ?? [])]
      .filter((e) => e.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40)
      .map((e) => ({ date: e.date, kind: e.kind, tail: e.tail, hrs: e.hrs, lesson: e.lesson, text: e.text, ratings: e.ratings, notes: s.shareNotes ? e.notes : undefined })),
  };
}

export const planProgress = (c: StudentCard) => {
  const items = (c.plan ?? []).flatMap((p) => p.items);
  return { done: items.filter((i) => i.done).length, total: items.length };
};

