// Flashcards for the student side: the syllabus's oral-check questions (one deck per ground module)
// and the checkride oral bank for the student's rating (one deck per topic).
// Progress uses simple Leitner boxes: "Got it" moves a card up a box and pushes its next review out.
import type { Bank } from "./banks";
import type { StudentCard } from "./card";
import type { Activity, CardProgress } from "./activity";
import { PPL } from "./ppl";
import { todayStr } from "./store";

export interface Flash { id: string; q: string; a?: string; ref?: string }
export interface Deck { id: string; title: string; short?: string; group: "syllabus" | "oral"; code?: string; cards: Flash[] }

/** One deck per ground module of the Private Pilot syllabus. Answers aren't written out: the student answers out loud and checks the sources. */
export function syllabusDecks(goal: string, edits?: StudentCard["oralEdits"]): Deck[] {
  if (goal !== "Private Pilot") return [];
  return PPL.stages.flatMap((st) =>
    st.groundModules.map((orig) => ({ ...orig, ...(edits?.[orig.id] ?? {}) })).map((g) => ({
      id: "syl-" + g.id,
      title: g.name,
      code: g.id === "SOLO-REGS" ? "Regs" : g.id,
      group: "syllabus" as const,
      cards: g.oralCheck
        .filter((q) => !/is the oral check for this module/i.test(q))
        .map((q) => ({ id: `syl:${g.id}:${simpleId(q)}`, q, ref: (g.sources ?? []).join(" · ") })),
    })).filter((d) => d.cards.length),
  );
}
/** One deck per topic of the checkride oral bank. */
export function bankDecks(bankId: string, bank: Bank | undefined): Deck[] {
  if (!bank) return [];
  return bank.sections.map((s) => ({
    id: `bank-${bankId}-${s.id}`,
    title: s.t,
    short: s.short,
    group: "oral" as const,
    cards: s.qs.map(([id, q, a, ref]) => ({ id: "bank:" + id, q, a, ref })),
  }));
}

/** Ground module ids the next lesson calls for: modules to finish first, plus any "Study Gx" homework. */
export function nextLessonModules(c: StudentCard): string[] {
  const b = c.briefing;
  const ids = new Set<string>();
  for (const g of b?.groundFirst ?? []) if (!g.done) ids.add(g.code === "Regs" ? "SOLO-REGS" : g.code);
  for (const [, txt] of b?.extras.hw ?? []) {
    const m = txt.match(/\bG(\d+)\b/);
    if (m) ids.add("G" + m[1]);
    else if (/solo regs/i.test(txt)) ids.add("SOLO-REGS");
  }
  if (!ids.size) {
    // Nothing named: the first ground module in the plan that isn't Proficient yet.
    for (const sec of c.plan ?? [])
      for (const it of sec.items) {
        const m = it.label.match(/^(G\d+|Regs) — /);
        if (m && !it.done) return [m[1] === "Regs" ? "SOLO-REGS" : m[1]];
      }
  }
  return [...ids];
}

const INTERVAL = [0, 1, 3, 7, 14];
const addDays = (d: string, n: number) => {
  const t = new Date(d + "T12:00:00");
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
};
/** New progress after a review. */
export function review(p: CardProgress | undefined, gotIt: boolean): CardProgress {
  const today = todayStr();
  const b = gotIt ? Math.min(4, (p?.b ?? 0) + 1) : 0;
  return { b, due: addDays(today, gotIt ? INTERVAL[b] : 0), seen: today };
}
export const isDue = (p?: CardProgress) => !!p && p.due <= todayStr();
export const isMastered = (p?: CardProgress) => !!p && p.b >= 3;

/** Record one review in the activity. */
export const recordReview = (id: string, gotIt: boolean) => (a: Activity): Activity => {
  const today = todayStr();
  return {
    ...a,
    cards: { ...a.cards, [id]: review(a.cards?.[id], gotIt) },
    studied: { ...a.studied, [today]: (a.studied?.[today] ?? 0) + 1 },
  };
};

export function deckStats(d: Deck, a: Activity) {
  const p = (f: Flash) => a.cards?.[f.id];
  return {
    total: d.cards.length,
    mastered: d.cards.filter((f) => isMastered(p(f))).length,
    due: d.cards.filter((f) => isDue(p(f))).length,
    seen: d.cards.filter((f) => p(f)).length,
  };
}
/** Order for a study session: cards due first, then ones never seen, then the rest (weakest first). */
export function sessionOrder(cards: Flash[], a: Activity, max = 20): Flash[] {
  const p = (f: Flash) => a.cards?.[f.id];
  const rank = (f: Flash) => (isDue(p(f)) ? 0 : !p(f) ? 1 : 2 + (p(f)!.b ?? 0));
  return [...cards].sort((x, y) => rank(x) - rank(y)).slice(0, max);
}
export function studiedThisWeek(a: Activity) {
  const cutoff = addDays(todayStr(), -6);
  return Object.entries(a.studied ?? {}).filter(([d]) => d >= cutoff).reduce((n, [, v]) => n + v, 0);
}

/** Flashcard ids follow the question text, so editing one question doesn't reset progress on the others. */
function simpleId(q: string) {
  let h = 0;
  for (let k = 0; k < q.length; k++) h = (Math.imul(31, h) + q.charCodeAt(k)) | 0;
  return (h >>> 0).toString(36);
}
