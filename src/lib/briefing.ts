// The next-lesson briefing: built as plain data so the instructor's Overview and the student's
// shared card render the same thing.
import { lessonContent, type LessonContent } from "../components/LessonExtras";
import { PRESOLO, guideKey, guideProgress } from "./curriculum";
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
}

export function buildBriefing(s: Student): Briefing | null {
  const prog = guideProgress(s);
  const focus = skillSummary(s).needsWork.map((x) => x.skill).slice(0, 5);
  const note = s.nextLesson?.trim() || undefined;
  if (prog.nextItem) {
    const { sec, item } = prog.nextItem;
    const key = guideKey(sec.id, item[0]);
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
  if (b.objectives.length) lines.push("", "WE'LL COVER", ...b.objectives.map((o) => "- " + o.text));
  if (b.doneWhen) lines.push("", "DONE WHEN: " + b.doneWhen);
  if (b.focus.length) lines.push("", "KEEP WORKING ON", ...b.focus.map((f) => "- " + f));
  if (b.instructorNote && b.instructorNote !== b.title) lines.push("", "NOTE: " + b.instructorNote);
  if (b.extras.hw.length) lines.push("", "BEFORE THE LESSON", ...b.extras.hw.map(([t, x]) => `- ${t === "Do" ? "" : t + " "}${x}`));
  if (b.extras.items.length) lines.push("", "WATCH", ...b.extras.items.map((v) => `- ${v.title}: ${v.url}`));
  return lines.join("\n");
}
