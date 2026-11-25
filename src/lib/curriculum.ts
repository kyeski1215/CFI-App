// Curriculum content ported from the Student Roster artifact (src/data/curriculum.json).
import raw from "../data/curriculum.json";
import type { Student } from "./types";

export interface GroundTask {
  t: string;
  n: string;
  lab?: string;
  i: string[]; // items; entries starting with "#" are sub-headings
}
export interface GuideSection {
  id: string;
  n: string;
  note?: string;
  items: [string, string, string?][]; // key, label, done-when
}

const C = raw as unknown as {
  DAYS: string[];
  SLOTS: [string, string][];
  GOALS: string[];
  STATUSES: [string, string][];
  AIRCRAFT: string[];
  CURR: Record<string, string[]>;
  G_PPL: GroundTask[];
  G_IR: GroundTask[];
  G_CFI: GroundTask[];
  GUIDE: GuideSection[];
  D87: string[];
  BSC: [string, number][];
  PRESOLO: Record<string, PresoloLesson>;
};

/** sub = [item, 61.87(d) item numbers "1,3", Blitz stage-check items "1.1,1.3"] */
export interface PresoloLesson {
  time: string;
  scen?: string;
  take?: string;
  sub: [string, string?, string?][];
}

export const DAYS = C.DAYS;
export const SLOTS = C.SLOTS;
export const GOALS = C.GOALS;
export const STATUSES = C.STATUSES;
export const AIRCRAFT = C.AIRCRAFT;
export const CURR = C.CURR;
export const D87 = C.D87;
export const BSC = C.BSC;
export const PRESOLO = C.PRESOLO;
export const TAILS = ["N122XP", "N9547W", "N99832", "N402BL", "N301BL", "N603BL", "N2569Q"];
export const OVERDUE_DAYS = 10;

export const statusClass = (st: string) => (STATUSES.find((s) => s[0] === st) ?? ["", "p-mute"])[1];
export const isActive = (s: Student) => !["Done", "On hold"].includes(s.status);

export function topicsFor(s: Student) {
  const base = CURR[s.goal] ?? [];
  return [...base, ...(s.extraTopics ?? []).filter((t) => !base.includes(t))];
}

export function groundFor(s: Student): { area: string; tasks: GroundTask[] } {
  if (s.goal === "Instrument" || s.goal === "CFII")
    return { area: "Instrument ACS · Area I: Preflight Preparation + approach deep dive", tasks: C.G_IR };
  if (s.goal === "CFI") return { area: "CFI ACS · Area I: Fundamentals of Instructing", tasks: C.G_CFI };
  return {
    area: (s.goal === "Commercial" ? "Commercial" : "Private Pilot") + " ACS · Area I: Preflight Preparation",
    tasks: C.G_PPL,
  };
}
export const groundKey = (t: string, item: string) => t + "|" + item;

export function guideFor(s: Student): GuideSection[] | null {
  if (s.goal === "Private Pilot") return C.GUIDE;
  if (s.goal !== "Instrument" && s.goal !== "Commercial") return null;
  const ir = s.goal === "Instrument";
  return [
    {
      id: "pdocs",
      n: "Documents in the Blitz system",
      note: "Check each one is uploaded or on file, not just shown to you.",
      items: [
        ["cert", "Pilot certificate"],
        ["med", "Medical certificate (or BasicMed)"],
        ["id", "Photo ID"],
        ["cit", "Citizenship verified + TSA logbook endorsement"],
        ["forms", "Blitz forms + rental agreement signed"],
        ["waiver", "Waiver signed"],
        ["ins", "Renter's insurance"],
        ["fsp", "Flight Schedule Pro account + payment on file"],
        ["badge", "Airport badge"],
        ["sportys", "Sporty's course access"],
      ],
    },
    {
      id: "pstart",
      n: "Getting started",
      note: "Settle the plan before the first lesson.",
      items: [
        ["logbook", "Logbook reviewed — prior time and currency"],
        ["plan", "Goal, timeline and budget discussed"],
        ["sched", "Schedule agreed, next 2 weeks booked"],
        ["checkout", "Checked out in the Blitz aircraft they'll fly"],
      ],
    },
    {
      id: "pride",
      n: "Before the checkride",
      note: "Confirm each one before booking the DPE.",
      items: [
        ["kt", "Knowledge test passed (valid 24 calendar months)"],
        ["exp", ir ? "Aeronautical experience confirmed (61.65)" : "Aeronautical experience confirmed (61.129)"],
        ["e39", "Practical test endorsement (61.39)"],
        ["8710", "IACRA 8710-1 reviewed and signed"],
        ["acft", "Aircraft logbooks tabbed"],
        ["ride", "Checkride"],
      ],
    },
  ];
}

const flights = (s: Student) => (s.log ?? []).filter((e) => e.kind !== "ground");
export function lastFlight(s: Student) {
  const d = flights(s)
    .map((e) => e.date)
    .filter(Boolean)
    .sort();
  return d.length ? d[d.length - 1] : null;
}
export const totalHours = (s: Student) =>
  flights(s).reduce((a, e) => a + (parseFloat(e.hrs ?? "") || 0), 0) + (parseFloat(s.priorHours ?? "") || 0);

export function initials(n: string) {
  return (
    String(n || "?")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export const guideKey = (sec: string, k: string) => sec + "." + k;

/** Progress through the training plan, plus the next G/F lesson not yet complete. */
export function guideProgress(s: Student) {
  const g = s.guide ?? {};
  let done = 0, total = 0;
  let next: string | null = null;
  let nextItem: { sec: GuideSection; item: GuideSection["items"][number] } | null = null;
  for (const sec of guideFor(s) ?? [])
    for (const it of sec.items) {
      total++;
      if (g[guideKey(sec.id, it[0])]) done++;
      else if (!next && /^[GF]\d/.test(it[0])) {
        next = it[1];
        nextItem = { sec, item: it };
      }
    }
  return { done, total, next, nextItem };
}

/** Which 61.87(d) items and Blitz stage-check items the checked pre-solo sub-items cover. */
export function coverage(guide: Record<string, string>) {
  const d87 = new Set<number>(), bsc = new Set<string>();
  for (const [id, L] of Object.entries(PRESOLO))
    L.sub.forEach((s, i) => {
      if (!guide["s1." + id + "." + (i + 1)]) return;
      s[1]?.split(",").forEach((t) => d87.add(+t));
      s[2]?.split(",").forEach((t) => bsc.add(t));
    });
  const stage = BSC.map(([n, cnt], i) => {
    let d = 0;
    for (let k = 1; k <= cnt; k++) if (bsc.has(i + 1 + "." + k)) d++;
    return { n, cnt, d };
  });
  return { d87, stage };
}
