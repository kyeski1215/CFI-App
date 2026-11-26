// The next-lesson briefing: built as plain data so the instructor's Overview and the student's
// shared card render the same thing.
import { lessonContent, type LessonContent } from "../components/LessonExtras";
import { PRESOLO, guideFor, guideKey, guideMark, guideProgress } from "./curriculum";
import { pplDetail } from "./ppl";
import { skillSummary } from "./skills";
import type { Student } from "./types";

export interface Briefing {
  code?: string; // "G4"
  title: string;
  stage?: string;
  time?: string;
  scenario?: string;
  objectives: { text: string; done: boolean }[];
  doneWhen?: string;
  takeover?: string;
  focus: string[]; // the student's current needs-work skills
  instructorNote?: string; // the "Next lesson" field
  extras: LessonContent;
  hood?: string;
  groundFirst?: { code: string; name: string; done: boolean }[]; // ground modules this flight needs
  warmup?: string[]; // earlier lessons still Introduced/Practiced, to carry along as a warm-up
}

export function buildBriefing(s: Student): Briefing | null {
  const prog = guideProgress(s);
  const focus = skillSummary(s).needsWork.map((x) => x.skill).slice(0, 5);
  const note = s.nextLesson?.trim() || undefined;
  if (prog.nextItem) {
    const { sec, item } = prog.nextItem;
    const key = guideKey(sec.id, item[0]);
    const d = pplDetail(item[0]);
    if (d) {
      const plan = guideFor(s) ?? [];
      const keyOf = (id: string) => { const sc = plan.find((x) => x.items.some((i) => i[0] === id)); return sc ? guideKey(sc.id, id) : id; };
      const warmup: string[] = [];
      for (const sc of plan) for (const it of sc.items) {
        if (it[0] === item[0]) break;
        const pd = pplDetail(it[0]);
        const m = pd?.kind === "flight" ? guideMark(s, guideKey(sc.id, it[0]))?.m : undefined;
        if (m === "Y" || m === "R") warmup.push(`${pd!.name} (${m === "Y" ? "Practiced" : "Introduced"})`);
      }
      return {
        title: d.name,
        stage: sec.n,
        scenario: d.objective,
        objectives: (d.briefing ?? d.steps ?? d.profile ?? d.inFlight ?? []).map((text) => ({ text, done: false })),
        doneWhen: d.doneWhen,
        hood: d.hood ?? undefined,
        groundFirst: (d.groundPrereqs ?? []).map((g) => { const x = pplDetail(g); return { code: x?.code ?? g, name: x?.name ?? g, done: !!s.guide?.[keyOf(g)] }; }),
        warmup: warmup.slice(-2),
        focus,
        instructorNote: note,
        extras: lessonContent(key),
      };
    }
    const L = sec.id === "s1" ? PRESOLO[item[0]] : undefined;
    const [code, ...rest] = item[1].split(" — ");
    return {
      code,
      title: rest.join(" — ") || item[1],
      stage: sec.n,
      time: L?.time,
      scenario: L?.scen,
      objectives: (L?.sub ?? []).map((sub, i) => ({ text: sub[0], done: !!s.guide?.[key + "." + (i + 1)] })),
      doneWhen: item[2],
      takeover: L?.take,
      focus,
      instructorNote: note,
      extras: lessonContent(key),
    };
  }
  if (!note && !focus.length) return null;
  return { title: note ?? "Next lesson", objectives: [], focus, extras: { hw: [], items: [] } };
}

export function briefingText(b: Briefing, studentFirst: string) {
  const lines = [`Hey ${studentFirst}, here's the plan for our next lesson:`, "", `${b.code ? b.code + " — " : ""}${b.title}${b.time ? ` (${b.time})` : ""}`];
  if (b.scenario) lines.push(b.scenario);
  if (b.objectives.length) lines.push("", "BRIEF", ...b.objectives.map((o) => "- " + o.text));
  if (b.doneWhen) lines.push("", "DONE WHEN: " + b.doneWhen);
  if (b.hood) lines.push("", "HOOD: " + b.hood);
  if (b.groundFirst?.some((g) => !g.done)) lines.push("", "GROUND FIRST", ...b.groundFirst.filter((g) => !g.done).map((g) => `- ${g.code} ${g.name}`));
  if (b.warmup?.length) lines.push("", "WARM-UP", ...b.warmup.map((w) => "- " + w));
  if (b.focus.length) lines.push("", "KEEP WORKING ON", ...b.focus.map((f) => "- " + f));
  if (b.instructorNote && b.instructorNote !== b.title) lines.push("", "NOTE: " + b.instructorNote);
  if (b.extras.hw.length) lines.push("", "BEFORE THE LESSON", ...b.extras.hw.map(([t, x]) => `- ${t === "Do" ? "" : t + " "}${x}`));
  if (b.extras.items.length) lines.push("", "WATCH", ...b.extras.items.map((v) => `- ${v.title}: ${v.url}`));
  return lines.join("\n");
}
