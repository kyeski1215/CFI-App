// The Private Pilot syllabus (src/data/ppl-syllabus.json) turned into the app's training-plan sections,
// plus full lesson / ground-module details for the Syllabus tab, briefings and the student side.
import raw from "../data/ppl-syllabus.json";
import type { GuideSection } from "./curriculum";
import { get, put, type BaseRec } from "./store";

type Str = string | null | undefined;
export interface PlanDetail {
  kind: "flight" | "ground" | "gate" | "test";
  id: string;
  name: string;
  code?: string; // "G3" for ground modules
  stage: string;
  objective?: string;
  doneWhen?: string;
  briefing?: string[];
  hood?: Str;
  homework?: string[];
  groundPrereqs?: string[];
  steps?: string[];
  inFlight?: string[];
  profile?: string[];
  endorsements?: string[];
  cfiNote?: string;
  eachFlight?: string;
  beforeFirst?: string;
  note?: string;
  requirement?: string;
  meets?: string;
  route?: string[];
  approxTotalNm?: number;
  checkedBy?: string;
  presoloWritten?: string;
  repeatable?: boolean;
  due?: string;
  covers?: string[];
  sources?: string[];
  oralCheck?: string[];
  detail?: string;
}

type Raw = typeof raw;
export const PPL = raw as Raw;
export const PPL_PRINCIPLES: string[] = PPL.principles;
export const PPL_RUNNING: { id: string; name: string; detail: string }[] = PPL.runningThrough;
export const PPL_GRADES = PPL.gradingScale;

const [S1, S2, S3] = PPL.stages;
const DETAIL: Record<string, PlanDetail> = {};
const add = (d: PlanDetail) => (DETAIL[d.id] = d);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flight = (o: any, stage: string) => add({ ...o, kind: "flight", stage });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ground = (o: any, stage: string) => add({ ...o, kind: "ground", code: o.id === "SOLO-REGS" ? "Regs" : o.id, stage });
for (const st of PPL.stages) {
  const label = `Stage ${st.order} · ${st.name}`;
  st.flightLessons.forEach((l) => flight(l, label));
  st.groundModules.forEach((g) => ground(g, label));
  st.gates.forEach((g) => add({ ...g, kind: "gate", stage: label }));
}
S2.nightBlock!.lessons.forEach((l) => flight(l, "Night block"));
add({ kind: "test", id: "kt", name: "Knowledge test passed", stage: "Stage 3 · Checkride Prep", objective: S3.knowledgeTest!.timing, steps: [S3.knowledgeTest!.before, S3.knowledgeTest!.after] });

/* ---- your edits to the syllabus text (Syllabus → open a lesson → Edit), synced like everything else ---- */
export type PlanEdit = Partial<Pick<PlanDetail, "name" | "objective" | "doneWhen" | "briefing" | "hood" | "homework" | "steps" | "inFlight" | "profile" | "note" | "cfiNote" | "due" | "covers" | "sources" | "oralCheck" | "detail">>;
interface EditsRec extends BaseRec { edits: Record<string, PlanEdit> }
const EDITS_ID = "ppl-syllabus";
export const pplEdits = (): Record<string, PlanEdit> => get<EditsRec>("profile", EDITS_ID)?.edits ?? {};
export function savePplEdit(id: string, patch: PlanEdit | null) {
  const cur = get<EditsRec>("profile", EDITS_ID);
  const edits = { ...(cur?.edits ?? {}) };
  if (patch) edits[id] = patch;
  else delete edits[id];
  const now = Date.now();
  put<EditsRec>("profile", { id: EDITS_ID, createdAt: cur?.createdAt ?? now, updatedAt: now, edits });
}
/** The syllabus as written in the app, before your edits. */
export const pplOriginal = (id: string): PlanDetail | undefined => DETAIL[id];

/** Full details for a plan item key ("G3", "s1-emergencies", "gate-mock-oral"…) with your edits, or undefined for checkbox items. */
export const pplDetail = (itemKey: string): PlanDetail | undefined => {
  const d = DETAIL[itemKey];
  if (!d) return undefined;
  const e = pplEdits()[itemKey];
  return e ? { ...d, ...e } : d;
};

const label = (id: string) => {
  const d = pplDetail(id)!;
  return d.kind === "ground" ? `${d.code} — ${d.name}` : d.name;
};
const doneWhen = (id: string) => {
  const d = pplDetail(id)!;
  if (d.kind === "ground") return d.oralCheck?.length && d.oralCheck.length > 1 ? "Answers the oral check without help" : d.oralCheck?.[0];
  if (d.kind === "gate") return d.detail;
  return d.doneWhen;
};
const item = (id: string): [string, string, string?] => [id, label(id), doneWhen(id)];
const endo = (phase: string) =>
  PPL.endorsements.filter((e) => e.phase === phase).map((e): [string, string, string?] => [e.id, e.name + (e.reg ? ` (${e.reg})` : "")]);

/** The Private Pilot training plan, in the recommended order: ground modules sit before the flight that needs them. */
export const pplSections = (): GuideSection[] => [
  {
    id: "p1",
    n: "Stage 1 · Pre-Solo",
    note: S1.summary,
    items: ["G1", "G2", "s1-intro-fundamentals", "s1-slow-flight-power-off-stalls", "s1-power-on-stalls-steep-turns", "G3", "G6", "s1-emergencies", "G4", "G5",
      "s1-pattern-normal-landings", "s1-go-arounds-slips-crosswind", "s1-pattern-emergencies", "G7", "G8", "SOLO-REGS", "gate-presolo-written",
      "s1-presolo-written-stage-check", "s1-first-solo"].map(item),
  },
  {
    id: "e1",
    n: "Before first solo",
    note: "No solo until every box is checked.",
    items: [...endo("before-first-solo"), ["limits", "Written solo limitations given (wind, visibility, ceiling, practice areas)"], ["dayof", "Day-of: weather, fuel, W&B, you on frequency or watching"]],
  },
  {
    id: "p2",
    n: "Stage 2 · Cross-Country",
    note: S2.summary,
    items: ["G9", "s2-ground-reference", "G12", "s2-short-soft-field", "s2-local-solo-practice", "G10", "s2-towered-ops-airspace", "G11", "G13", "G14",
      "s2-dual-xc-wendover", "gate-solo-xc-planning", "s2-solo-xc", "s2-long-solo-xc"].map(item),
  },
  { id: "pn", n: "Night block", note: S2.nightBlock!.note, items: ["G15", "night-local", "night-xc"].map(item) },
  { id: "e2", n: "Stage 2 endorsements", note: "Give these as the student reaches each one. Conditional ones only if used.", items: endo("stage-2") },
  { id: "p3", n: "Stage 3 · Checkride Prep", note: S3.summary, items: ["G16", "G17", "kt", "gate-mock-oral", "s3-acs-review", "s3-mock-checkride"].map(item) },
  {
    id: "e3",
    n: "Before the checkride",
    note: "Confirm each one before booking the DPE.",
    items: [
      ...endo("before-checkride"),
      ["hrs", "61.109 hours confirmed in the logbook"],
      ["acft", "Aircraft logbooks tabbed (annual, 100-hr, ELT, transponder, ADs)"],
      ["bring", "Student has ID, student pilot certificate, medical, knowledge test report, logbook, DPE fee"],
      ["ride", "Checkride"],
    ],
  },
];
export const PPL_SECTION_IDS = new Set(pplSections().map((s) => s.id));

/** Homework the syllabus lists for a plan key ("p1.G3"), in the app's [type, text] form. */
export function pplHomework(key: string): [string, string][] | undefined {
  const id = key.slice(key.indexOf(".") + 1);
  const d = pplDetail(id);
  if (!d) return undefined;
  if (d.kind === "ground") return (d.sources ?? []).map((s) => ["Read", s]);
  return (d.homework ?? []).map((h): [string, string] => {
    const m = h.match(/\b(G\d+)\b/) ?? (/solo regs/i.test(h) ? ["", "SOLO-REGS"] : null);
    const md = m ? pplDetail(m[1]) : undefined;
    if (m && md) return ["Study", `${h.replace(/\bG\d+\b/, md.code ?? m[1])} · ${md.name}`.replace(/^Solo Regs prep · /, "")];
    if (/^read\b/i.test(h)) return ["Read", h.replace(/^read\s+/i, "")];
    return ["Do", h];
  });
}

/* ---- carrying progress over from the old 16-lesson plan ---- */
const OLD_TO_NEW: Record<string, string[]> = {
  "s1.G2": ["p1.G8"], "s1.G3": ["p1.G8"], "s1.G4": ["p1.G4"], "s1.G5": ["p1.G6"], "s1.G6": ["p1.SOLO-REGS", "p1.gate-presolo-written"],
  "s1.F1": ["p1.s1-intro-fundamentals"], "s1.F2": ["p1.s1-intro-fundamentals"], "s1.F3": ["p1.s1-slow-flight-power-off-stalls"],
  "s1.F4": ["p1.s1-power-on-stalls-steep-turns"], "s1.F5": ["p1.s1-pattern-normal-landings"], "s1.F6": ["p1.s1-go-arounds-slips-crosswind"],
  "s1.F8": ["p1.s1-emergencies"], "s1.F10": ["p1.s1-first-solo"],
  "solo.card": ["e1.student-cert"], "solo.presolo": ["e1.presolo-knowledge"], "solo.e87c": ["e1.presolo-flight"], "solo.e87n": ["e1.solo-90"],
  "solo.limits": ["e1.limits"], "solo.dayof": ["e1.dayof"],
  "s2.G7": ["p2.G13"], "s2.F11": ["p2.s2-short-soft-field"], "s2.F12": ["p2.s2-dual-xc-wendover"], "s2.F15": ["p2.s2-dual-xc-wendover"],
  "s2.G8": ["pn.G15"], "s2.F13": ["pn.night-local"], "s2.F14": ["pn.night-xc"], "s2.e93c1": ["e2.solo-xc-training"],
  "s2.soloxc": ["p2.s2-solo-xc"], "s2.longxc": ["p2.s2-long-solo-xc"], "s2.kte": ["e3.knowledge-test"], "s2.kt": ["p3.kt"],
  "s3.G9": ["p3.G17"], "s3.G10": ["p3.gate-mock-oral"], "s3.F17": ["p3.s3-acs-review"], "s3.F18": ["p3.s3-acs-review"], "s3.F19": ["p3.s3-mock-checkride"],
  "s3.ktdef": ["e3.kt-review"], "s3.e39": ["e3.prep-2-months"], "s3.e105": ["e3.practical-test"], "s3.8710": ["e3.iacra-8710"],
  "s3.hrs": ["e3.hrs"], "s3.acft": ["e3.acft"], "s3.bring": ["e3.bring"], "s3.ride": ["e3.ride"],
};
/** Old lesson keys whose custom homework/videos should follow them to the new lesson. */
export const OLD_LESSON_KEYS = OLD_TO_NEW;

type Marks = Record<string, { m: "G" | "Y" | "R"; d: string }>;
const RANK = { G: 3, Y: 2, R: 1 } as const;
/**
 * New guide + marks for a student on the old plan. Old keys are left in place (harmless, and
 * reversible); a new key gets the best grade any of its old lessons had.
 */
export function migratePplProgress(guide: Record<string, string> = {}, marks: Marks = {}) {
  const g = { ...guide };
  const mk = { ...marks };
  let changed = false;
  for (const [oldKey, targets] of Object.entries(OLD_TO_NEW)) {
    let cur: { m: "G" | "Y" | "R"; d: string } | undefined = guide[oldKey] ? { m: "G", d: guide[oldKey] } : marks[oldKey];
    if (!cur) {
      // An old lesson with only some of its items checked counts as Introduced.
      const partial = Object.entries(guide).filter(([k]) => k.startsWith(oldKey + ".")).map(([, d]) => d).sort();
      if (partial.length) cur = { m: "R", d: partial[partial.length - 1] };
    }
    if (!cur) continue;
    for (const nk of targets) {
      const have: { m: "G" | "Y" | "R"; d: string } | undefined = g[nk] ? { m: "G", d: g[nk] } : mk[nk];
      if (have && (RANK[have.m] > RANK[cur.m] || (have.m === cur.m && have.d >= cur.d))) continue;
      delete g[nk];
      delete mk[nk];
      if (cur.m === "G") g[nk] = cur.d;
      else mk[nk] = cur;
      changed = true;
    }
  }
  return { guide: g, guideMarks: mk, changed };
}
