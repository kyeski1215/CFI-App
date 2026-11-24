// Logbook reg tables ported from the Logbook Reg Picker artifact.
// Paragraph numbers checked against the eCFR (14 CFR Part 61), Nov 2026.

export interface RegItem {
  sec: string;
  p: string;
  n: string;
}
export interface RegGroup {
  t: string;
  s: string;
  items: RegItem[];
}
export type Cls = "SE" | "ME";

const R = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"];
const areas = (sec: string, par: string, list: string[]) => list.map((n, i) => ({ sec, p: par + "(" + R[i] + ")", n }));

const PPL_SE = ["Preflight preparation","Preflight procedures","Airport and seaplane base operations","Takeoffs, landings, and go-arounds","Performance maneuvers","Ground reference maneuvers","Navigation","Slow flight and stalls","Basic instrument maneuvers","Emergency operations","Night operations","Postflight procedures"];
const PPL_ME = ["Preflight preparation","Preflight procedures","Airport and seaplane base operations","Takeoffs, landings, and go-arounds","Performance maneuvers","Ground reference maneuvers","Navigation","Slow flight and stalls","Basic instrument maneuvers","Emergency operations","Multiengine operations","Night operations","Postflight procedures"];
const CPL_SE = ["Preflight preparation","Preflight procedures","Airport and seaplane base operations","Takeoffs, landings, and go-arounds","Performance maneuvers","Ground reference maneuvers","Navigation","Slow flight and stalls","Emergency operations","High-altitude operations","Postflight procedures"];
const CPL_ME = ["Preflight preparation","Preflight procedures","Airport and seaplane base operations","Takeoffs, landings, and go-arounds","Performance maneuvers","Navigation","Slow flight and stalls","Emergency operations","Multiengine operations","High-altitude operations","Postflight procedures"];
const CFI_SE = ["Fundamentals of instructing","Technical subject areas","Preflight preparation","Preflight lesson on a maneuver","Preflight procedures","Airport and seaplane base operations","Takeoffs, landings, and go-arounds","Fundamentals of flight","Performance maneuvers","Ground reference maneuvers","Slow flight, stalls, and spins","Basic instrument maneuvers","Emergency operations","Postflight procedures"];
const CFI_ME = ["Fundamentals of instructing","Technical subject areas","Preflight preparation","Preflight lesson on a maneuver","Preflight procedures","Airport and seaplane base operations","Takeoffs, landings, and go-arounds","Fundamentals of flight","Performance maneuvers","Ground reference maneuvers","Slow flight and stalls","Basic instrument maneuvers","Emergency operations","Multiengine operations","Postflight procedures"];
const CFII = ["Fundamentals of instructing","Technical subject areas","Preflight preparation","Preflight lesson on a maneuver","ATC clearances and procedures","Flight by reference to instruments","Navigation aids","Instrument approach procedures","Emergency operations","Postflight procedures"];
const IR = ["Preflight preparation","Preflight procedures","ATC clearances and procedures","Flight by reference to instruments","Navigation systems","Instrument approach procedures","Emergency operations","Postflight procedures"];
const PRESOLO_SE = ["Flight prep, powerplant & systems","Taxiing / surface ops, runups","Takeoffs & landings, normal & crosswind","Straight & level, turns both directions","Climbs & climbing turns","Traffic patterns, entries & departures","Collision, windshear & wake avoidance","Descents, high & low drag","Cruise to slow flight","Stall entries & full-stall recovery","Emergency procedures & malfunctions","Ground reference maneuvers","Simulated engine-out approaches","Slips to a landing","Go-arounds"];
const PRESOLO_ME = PRESOLO_SE.filter((n) => n !== "Slips to a landing");

const ppl = (c: Cls): RegGroup[] => {
  const a = c === "SE" ? "(a)" : "(b)";
  return [
    { t: "Flight proficiency", s: "61.107", items: areas("61.107", c === "SE" ? "(b)(1)" : "(b)(2)", c === "SE" ? PPL_SE : PPL_ME) },
    {
      t: "Aeronautical experience",
      s: "61.109",
      items: [
        { sec: "61.109", p: a + "(1)", n: "Cross-country training (3 hrs)" },
        { sec: "61.109", p: a + "(2)", n: "Night training (3 hrs)" },
        { sec: "61.109", p: a + "(2)(i)", n: "Night XC over 100 NM" },
        { sec: "61.109", p: a + "(2)(ii)", n: "10 night T/O & full-stop landings" },
        { sec: "61.109", p: a + "(3)", n: "Instrument training (3 hrs)" },
        { sec: "61.109", p: a + "(4)", n: "Checkride prep (3 hrs in 2 cal. months)" },
      ],
    },
    {
      t: "Ground & solo prep",
      s: "",
      items: [
        { sec: "61.105", p: "(b)", n: "Aeronautical knowledge (ground)" },
        { sec: "61.93", p: "(e)", n: "Solo cross-country training" },
      ],
    },
    {
      t: "Pre-solo",
      s: "61.87",
      items: [
        { sec: "61.87", p: "(b)", n: "Pre-solo aeronautical knowledge test" },
        { sec: "61.87", p: "(c)", n: "Pre-solo flight training & proficiency" },
        ...(c === "SE" ? PRESOLO_SE : PRESOLO_ME).map((n, i) => ({ sec: "61.87", p: (c === "SE" ? "(d)" : "(e)") + "(" + (i + 1) + ")", n })),
      ],
    },
  ];
};

const cpl = (c: Cls): RegGroup[] => {
  const a = c === "SE" ? "(a)" : "(b)";
  return [
    { t: "Flight proficiency", s: "61.127", items: areas("61.127", c === "SE" ? "(b)(1)" : "(b)(2)", c === "SE" ? CPL_SE : CPL_ME) },
    {
      t: "Aeronautical experience",
      s: "61.129",
      items: [
        { sec: "61.129", p: a + "(3)(i)", n: "Instrument training (10 hrs)" },
        { sec: "61.129", p: a + "(3)(ii)", n: c === "SE" ? "Complex / TAA training (10 hrs)" : "ME complex/turbine training (10 hrs)" },
        { sec: "61.129", p: a + "(3)(iii)", n: "2-hr day XC, >100 NM" },
        { sec: "61.129", p: a + "(3)(iv)", n: "2-hr night XC, >100 NM" },
        { sec: "61.129", p: a + "(3)(v)", n: "Checkride prep (3 hrs in 2 cal. months)" },
        { sec: "61.129", p: a + "(4)", n: "Solo / PIC with instructor aboard" },
      ],
    },
    { t: "Ground", s: "", items: [{ sec: "61.125", p: "(b)", n: "Aeronautical knowledge (ground)" }] },
  ];
};

export const REG_TABS: Record<string, { name: string; cls?: boolean; build: (c: Cls) => RegGroup[] }> = {
  PPL: { name: "Private", cls: true, build: ppl },
  IR: {
    name: "Instrument",
    build: () => [
      { t: "Flight proficiency", s: "61.65", items: IR.map((n, i) => ({ sec: "61.65", p: "(c)(" + (i + 1) + ")", n })) },
      {
        t: "Aeronautical experience",
        s: "61.65",
        items: [
          { sec: "61.65", p: "(d)(2)", n: "Instrument time w/ CFII (40 hrs / 15 dual)" },
          { sec: "61.65", p: "(d)(2)(i)", n: "Checkride prep (3 hrs in 2 cal. months)" },
          { sec: "61.65", p: "(d)(2)(ii)", n: "IFR long XC (250 NM, 3 approaches)" },
        ],
      },
      { t: "Ground", s: "", items: [{ sec: "61.65", p: "(b)", n: "Aeronautical knowledge (ground)" }] },
    ],
  },
  CPL: { name: "Commercial", cls: true, build: cpl },
  CFI: {
    name: "CFI",
    cls: true,
    build: (c) => [
      { t: "Flight proficiency", s: "61.187", items: areas("61.187", c === "SE" ? "(b)(1)" : "(b)(2)", c === "SE" ? CFI_SE : CFI_ME) },
      {
        t: "Other",
        s: "",
        items: [
          { sec: "61.183", p: "(i)(1)", n: "Spin training / instructional competency" },
          { sec: "61.185", p: "(a)", n: "Aeronautical knowledge (ground)" },
        ],
      },
    ],
  },
  CFII: { name: "CFII", build: () => [{ t: "Flight proficiency", s: "61.187", items: areas("61.187", "(b)(7)", CFII) }] },
  OTHER: {
    name: "Reviews & Endorsements",
    build: () => [
      {
        t: "Reviews & currency",
        s: "",
        items: [
          { sec: "61.56", p: "(a)", n: "Flight review" },
          { sec: "61.57", p: "(d)", n: "Instrument proficiency check (IPC)" },
        ],
      },
      {
        t: "Additional training (61.31)",
        s: "61.31",
        items: [
          { sec: "61.31", p: "(e)", n: "Complex airplane" },
          { sec: "61.31", p: "(f)", n: "High-performance airplane" },
          { sec: "61.31", p: "(g)", n: "High-altitude / pressurized" },
          { sec: "61.31", p: "(i)", n: "Tailwheel airplane" },
        ],
      },
    ],
  },
};

export const regKey = (i: RegItem) => i.sec + i.p;

export function goalToRegTab(goal: string) {
  return { "Private Pilot": "PPL", Instrument: "IR", Commercial: "CPL", CFI: "CFI", CFII: "CFII" }[goal] ?? "PPL";
}

/** Compact: "61.107(b)(1)(i)-(iv), (vii); 61.109(a)(1)". Full: one line per item with its name. */
export function formatRegs(items: RegItem[], fmt: "compact" | "full") {
  if (!items.length) return "";
  if (fmt === "full") return items.map((i) => `${i.sec}${i.p} – ${i.n}`).join("\n");
  // paragraph levels: (a) letter, (1) number, (i) roman, (A) capital
  const ord = (t: string, lvl: number) => (lvl === 0 ? t.charCodeAt(0) : lvl === 1 ? +t : lvl === 2 ? R.indexOf(t) : t.charCodeAt(0));
  const parsed = items.map((i) => {
    const toks = [...i.p.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
    return { sec: i.sec, num: parseFloat(i.sec.slice(3)), toks, idx: toks.map((t, l) => ord(t, l)) };
  });
  parsed.sort((a, b) => {
    if (a.num !== b.num) return a.num - b.num;
    for (let k = 0; k < Math.max(a.idx.length, b.idx.length); k++) {
      const d = (a.idx[k] ?? -1) - (b.idx[k] ?? -1);
      if (d) return d;
    }
    return 0;
  });
  type Kid = { t: string; n: number };
  const groups: { k: string; sec: string; parent: string; kids: Kid[] }[] = [];
  for (const x of parsed) {
    const parent = x.toks.slice(0, -1).map((t) => "(" + t + ")").join("");
    const gk = x.sec + "|" + parent;
    let g = groups.find((y) => y.k === gk);
    if (!g) groups.push((g = { k: gk, sec: x.sec, parent, kids: [] }));
    g.kids.push({ t: x.toks[x.toks.length - 1], n: x.idx[x.idx.length - 1] });
  }
  const fmtKids = (kids: Kid[]) => {
    const runs: { start: Kid; end: Kid }[] = [];
    for (const k of kids) {
      const r = runs[runs.length - 1];
      if (r && k.n === r.end.n + 1) r.end = k;
      else runs.push({ start: k, end: k });
    }
    return runs
      .map((r) => (r.start === r.end ? r.start.t : r.end.n === r.start.n + 1 ? r.start.t + ", " + r.end.t : r.start.t + "-" + r.end.t))
      .join(", ");
  };
  const bySec: { sec: string; parts: string[] }[] = [];
  for (const g of groups) {
    let s = bySec.find((x) => x.sec === g.sec);
    if (!s) bySec.push((s = { sec: g.sec, parts: [] }));
    s.parts.push(g.parent + "(" + fmtKids(g.kids) + ")");
  }
  return bySec.map((s) => s.sec + s.parts.join(", ")).join("; ");
}
