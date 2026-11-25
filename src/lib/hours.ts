// Aeronautical experience toward the practical test (14 CFR 61.109(a), 61.65(d), 61.129(a), single-engine
// airplane, Part 61). Built from the lesson log, plus time the instructor adds from the student's other
// logbooks. Items the log can't show (a specific long cross-country, PIC time) are tick-boxes.
import { guideMark } from "./curriculum";
import type { LogEntry, Student } from "./types";

export interface Req {
  key: string;
  label: string;
  need: number; // hours or landings; 0 for a tick-box item
  unit: "hr" | "ldg" | "flag";
  ref: string;
  value?: (c: Totals) => number;
  guideKey?: string; // tick-box satisfied by a green syllabus item
}
export interface Totals {
  total: number; dual: number; solo: number; dualXc: number; soloXc: number; xc: number;
  dualNight: number; night: number; nightLdg: number; inst: number; dualInst: number; prep: number; prepInst: number;
}

const n = (v?: string) => parseFloat(v ?? "") || 0;

/** Training within the 2 calendar months before a checkride taken today, counted conservatively from the 1st of last month. */
export function prepWindowStart(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function totals(s: Student): Totals {
  const flights = (s.log ?? []).filter((e: LogEntry) => e.kind !== "ground");
  const since = prepWindowStart();
  const t: Totals = { total: n(s.priorHours), dual: 0, solo: 0, dualXc: 0, soloXc: 0, xc: 0, dualNight: 0, night: 0, nightLdg: 0, inst: 0, dualInst: 0, prep: 0, prepInst: 0 };
  for (const e of flights) {
    const hrs = n(e.hrs), solo = Math.min(n(e.solo), hrs), dual = hrs - solo;
    const xc = Math.min(n(e.xc), hrs), night = Math.min(n(e.night), hrs), inst = Math.min(n(e.inst), hrs);
    const dualShare = hrs ? dual / hrs : 0;
    t.total += hrs; t.dual += dual; t.solo += solo;
    t.xc += xc; t.dualXc += xc * dualShare; t.soloXc += xc * (1 - dualShare);
    t.night += night; t.dualNight += night * dualShare; t.nightLdg += n(e.ldgNight);
    t.inst += inst; t.dualInst += inst * dualShare;
    if (e.prep && e.date >= since) { t.prep += dual; t.prepInst += inst * dualShare; }
  }
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

const PPL: Req[] = [
  { key: "total", label: "Total flight time", need: 40, unit: "hr", ref: "61.109(a)", value: (c) => c.total },
  { key: "dual", label: "Flight training (dual)", need: 20, unit: "hr", ref: "61.109(a)", value: (c) => c.dual },
  { key: "dualXc", label: "Dual cross-country", need: 3, unit: "hr", ref: "61.109(a)(1)", value: (c) => c.dualXc },
  { key: "dualNight", label: "Dual night", need: 3, unit: "hr", ref: "61.109(a)(2)", value: (c) => c.dualNight },
  { key: "nightXc", label: "Night XC over 100 nm total", need: 0, unit: "flag", ref: "61.109(a)(2)(i)", guideKey: "s2.F14" },
  { key: "nightLdg", label: "Night takeoffs & full-stop landings", need: 10, unit: "ldg", ref: "61.109(a)(2)(ii)", value: (c) => c.nightLdg },
  { key: "inst", label: "Instrument training", need: 3, unit: "hr", ref: "61.109(a)(3)", value: (c) => c.dualInst },
  { key: "prep", label: "Checkride prep in last 2 calendar months", need: 3, unit: "hr", ref: "61.109(a)(4)", value: (c) => c.prep },
  { key: "solo", label: "Solo", need: 10, unit: "hr", ref: "61.109(a)(5)", value: (c) => c.solo },
  { key: "soloXc", label: "Solo cross-country", need: 5, unit: "hr", ref: "61.109(a)(5)(i)", value: (c) => c.soloXc },
  { key: "longXc", label: "Solo XC 150 nm, 3 full-stop points, one leg over 50 nm", need: 0, unit: "flag", ref: "61.109(a)(5)(ii)", guideKey: "s2.longxc" },
  { key: "towered", label: "3 solo full-stop landings at a towered airport", need: 0, unit: "flag", ref: "61.109(a)(5)(iii)", guideKey: "s2.towered" },
];
const IR: Req[] = [
  { key: "xcPic", label: "Cross-country PIC", need: 50, unit: "hr", ref: "61.65(d)(1)" },
  { key: "inst", label: "Actual or simulated instrument", need: 40, unit: "hr", ref: "61.65(d)(2)", value: (c) => c.inst },
  { key: "instCfii", label: "Instrument training from a CFII", need: 15, unit: "hr", ref: "61.65(d)(2)", value: (c) => c.dualInst },
  { key: "prep", label: "Instrument checkride prep in last 2 calendar months", need: 3, unit: "hr", ref: "61.65(d)(2)(i)", value: (c) => c.prepInst },
  { key: "longIfrXc", label: "250 nm IFR cross-country, 3 approach types", need: 0, unit: "flag", ref: "61.65(d)(2)(ii)" },
];
const CPL: Req[] = [
  { key: "total", label: "Total flight time", need: 250, unit: "hr", ref: "61.129(a)", value: (c) => c.total },
  { key: "pic", label: "Pilot in command", need: 100, unit: "hr", ref: "61.129(a)(2)" },
  { key: "xcPic", label: "Cross-country PIC", need: 50, unit: "hr", ref: "61.129(a)(2)(ii)" },
  { key: "dual", label: "Flight training (dual)", need: 20, unit: "hr", ref: "61.129(a)(3)", value: (c) => c.dual },
  { key: "inst", label: "Instrument training", need: 10, unit: "hr", ref: "61.129(a)(3)(i)", value: (c) => c.dualInst },
  { key: "complex", label: "Complex or TAA training", need: 10, unit: "hr", ref: "61.129(a)(3)(ii)" },
  { key: "dayXc", label: "2-hr day XC over 100 nm (dual)", need: 0, unit: "flag", ref: "61.129(a)(3)(iii)" },
  { key: "nightXcDual", label: "2-hr night XC over 100 nm (dual)", need: 0, unit: "flag", ref: "61.129(a)(3)(iv)" },
  { key: "prep", label: "Checkride prep in last 2 calendar months", need: 3, unit: "hr", ref: "61.129(a)(3)(v)", value: (c) => c.prep },
  { key: "soloPic", label: "Solo / PIC with instructor aboard", need: 10, unit: "hr", ref: "61.129(a)(4)" },
  { key: "longXc300", label: "XC of 300 nm, 3 points, one leg 250 nm", need: 0, unit: "flag", ref: "61.129(a)(4)(i)" },
  { key: "nightVfr", label: "5 hr night VFR, 10 takeoffs & landings at a towered airport", need: 0, unit: "flag", ref: "61.129(a)(4)(ii)" },
];

export function requirementsFor(goal: string): { title: string; reqs: Req[] } | null {
  if (goal === "Private Pilot") return { title: "Private Pilot · 61.109(a)", reqs: PPL };
  if (goal === "Instrument") return { title: "Instrument Rating · 61.65(d)", reqs: IR };
  if (goal === "Commercial") return { title: "Commercial · 61.129(a)", reqs: CPL };
  return null;
}

export interface ReqRow { req: Req; have: number; met: boolean; logged: number; adj: number; auto?: boolean }
export function hoursProgress(s: Student) {
  const rf = requirementsFor(s.goal);
  if (!rf) return null;
  const c = totals(s);
  const rows: ReqRow[] = rf.reqs.map((req) => {
    if (req.unit === "flag") {
      const auto = req.guideKey ? guideMark(s, req.guideKey)?.m === "G" : false;
      const met = auto || !!s.hoursFlags?.[req.key];
      return { req, have: met ? 1 : 0, met, logged: 0, adj: 0, auto };
    }
    const logged = req.value ? req.value(c) : 0;
    const adj = n(s.hoursAdj?.[req.key]);
    const have = Math.round((logged + adj) * 10) / 10;
    return { req, have, met: have >= req.need, logged, adj };
  });
  return { title: rf.title, rows, met: rows.filter((r) => r.met).length, total: rows.length, prepSince: prepWindowStart() };
}
