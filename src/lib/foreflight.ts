// ForeFlight logbook CSV import. The export has an "Aircraft Table" and a "Flights Table", each a
// header row followed by data rows. People on a flight are in Person1..Person6 as "Name;Role;Email".
// Column names are matched loosely so small differences between ForeFlight versions still work.
import type { LogEntry } from "./types";

/** RFC 4180-ish CSV parser: quotes, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface FFPerson { name: string; role: string; email?: string }
export interface FFFlight {
  date: string; tail: string; type?: string; from?: string; to?: string; route?: string;
  total: number; dualGiven: number; groundGiven: number; night: number; xc: number; simInst: number; actualInst: number;
  dayLdg: number; nightLdg: number; approaches: number;
  persons: FFPerson[]; comments: string; key: string;
}

function tableAfter(rows: string[][], marker: RegExp, firstCol: RegExp) {
  let start = rows.findIndex((r) => marker.test(r.join(" ")));
  if (start < 0) start = 0;
  const h = rows.findIndex((r, i) => i >= start && firstCol.test((r[0] ?? "").trim()));
  if (h < 0) return null;
  const header = rows[h].map(norm);
  const data: Record<string, string>[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((c) => c.trim())) {
      if (data.length) break;
      continue;
    }
    if (/table/i.test(r[0] ?? "") && r.slice(1).every((c) => !c.trim())) break;
    const o: Record<string, string> = {};
    header.forEach((k, j) => { if (k) o[k] = (r[j] ?? "").trim(); });
    data.push(o);
  }
  return { header, data };
}

const num = (v?: string) => {
  const n = parseFloat((v ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
};
const pick = (o: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (o[norm(k)] !== undefined && o[norm(k)] !== "") return o[norm(k)];
  return "";
};

function toIsoDate(d: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return d;
}

export function parsePersons(o: Record<string, string>): FFPerson[] {
  const out: FFPerson[] = [];
  for (let i = 1; i <= 6; i++) {
    const v = pick(o, "Person" + i);
    if (!v) continue;
    const [name, role, email] = v.split(";").map((x) => x.trim());
    if (name) out.push({ name, role: role ?? "", email: email || undefined });
  }
  return out;
}

export function parseForeFlight(text: string): { flights: FFFlight[]; skipped: number } {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const aircraft = tableAfter(rows, /aircraft\s*table/i, /^aircraftid$/i);
  const types = new Map<string, string>();
  for (const a of aircraft?.data ?? []) {
    const id = pick(a, "AircraftID");
    if (id) types.set(id, [pick(a, "Make"), pick(a, "Model")].filter(Boolean).join(" ") || pick(a, "TypeCode"));
  }
  const ft = tableAfter(rows, /flights\s*table/i, /^date$/i);
  if (!ft) throw new Error("This doesn't look like a ForeFlight logbook export. In ForeFlight: Logbook → export as CSV.");
  const flights: FFFlight[] = [];
  let skipped = 0;
  for (const o of ft.data) {
    const date = toIsoDate(pick(o, "Date"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }
    const tail = pick(o, "AircraftID");
    let approaches = 0;
    for (let i = 1; i <= 6; i++) if (pick(o, "Approach" + i)) approaches++;
    const f: FFFlight = {
      date, tail, type: types.get(tail),
      from: pick(o, "From"), to: pick(o, "To"), route: pick(o, "Route"),
      total: num(pick(o, "TotalTime")),
      dualGiven: num(pick(o, "DualGiven")),
      groundGiven: num(pick(o, "GroundTrainingGiven", "GroundGiven")),
      night: num(pick(o, "Night")), xc: num(pick(o, "CrossCountry")),
      simInst: num(pick(o, "SimulatedInstrument")), actualInst: num(pick(o, "ActualInstrument")),
      dayLdg: num(pick(o, "DayLandingsFullStop")) || Math.max(0, num(pick(o, "AllLandings")) - num(pick(o, "NightLandingsFullStop"))),
      nightLdg: num(pick(o, "NightLandingsFullStop")),
      approaches,
      persons: parsePersons(o),
      comments: [pick(o, "PilotComments"), pick(o, "InstructorComments")].filter(Boolean).join("\n\n"),
      key: "",
    };
    f.key = "ff-" + hash([f.date, f.tail, pick(o, "TimeOut"), pick(o, "HobbsStart"), f.total, f.dualGiven, f.route, f.from, f.to].join("|"));
    flights.push(f);
  }
  return { flights, skipped };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Who the student was: a person with a student role, else the only person on a dual-given flight. */
export function studentOf(f: FFFlight): FFPerson | null {
  const st = f.persons.find((p) => /student/i.test(p.role));
  if (st) return st;
  const others = f.persons.filter((p) => !/(instructor|examiner|cfi|self|me)/i.test(p.role));
  if ((f.dualGiven > 0 || f.groundGiven > 0) && others.length === 1) return others[0];
  return null;
}

export interface Candidate {
  key: string; name: string; email?: string; flights: FFFlight[]; hours: number; last: string; goalGuess: string;
}

/** Instruction flights grouped by student. Flights with no student identified go in "unassigned". */
export function groupByStudent(flights: FFFlight[]) {
  const teaching = flights.filter((f) => f.dualGiven > 0 || f.groundGiven > 0);
  const map = new Map<string, Candidate>();
  const unassigned: FFFlight[] = [];
  for (const f of teaching) {
    const p = studentOf(f);
    if (!p) { unassigned.push(f); continue; }
    const k = p.name.trim().toLowerCase();
    if (!map.has(k)) map.set(k, { key: k, name: p.name.trim(), email: p.email, flights: [], hours: 0, last: "", goalGuess: "Private Pilot" });
    const c = map.get(k)!;
    c.flights.push(f);
    if (!c.email && p.email) c.email = p.email;
  }
  for (const c of map.values()) {
    c.hours = +c.flights.reduce((a, f) => a + (f.dualGiven || f.total), 0).toFixed(1);
    c.last = c.flights.map((f) => f.date).sort().pop() ?? "";
    c.goalGuess = guessGoal(c.flights);
  }
  const candidates = [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  return { candidates, unassigned, teaching: teaching.length };
}

function guessGoal(fl: FFFlight[]) {
  const air = fl.filter((f) => f.dualGiven > 0);
  if (!air.length) return "Private Pilot";
  const multi = air.filter((f) => /baron|seminole|seneca|duchess|travel air|aztec|twin|da42|da-42|310|340|apache/i.test(f.type ?? "")).length;
  if (multi / air.length > 0.5) return "Multi-Engine";
  const inst = air.filter((f) => f.simInst + f.actualInst >= 0.5 || f.approaches > 0).length;
  if (inst / air.length > 0.5) return "Instrument";
  return "Private Pilot";
}

export function toLogEntry(f: FFFlight): LogEntry {
  const ground = f.dualGiven === 0 && f.groundGiven > 0 && f.total === 0;
  const place = [f.from, f.to].filter(Boolean).join("–");
  const extras = [
    f.xc ? `XC ${f.xc}` : "",
    f.simInst ? `sim inst ${f.simInst}` : "",
    f.actualInst ? `actual ${f.actualInst}` : "",
    f.approaches ? `${f.approaches} approach${f.approaches === 1 ? "" : "es"}` : "",
  ].filter(Boolean).join(", ");
  return {
    id: f.key,
    kind: ground ? "ground" : "flight",
    date: f.date,
    tail: ground ? undefined : f.tail || undefined,
    hrs: ground ? undefined : String(f.dualGiven || f.total || "") || undefined,
    night: f.night ? String(f.night) : undefined,
    ldgDay: f.dayLdg ? String(f.dayLdg) : undefined,
    ldgNight: f.nightLdg ? String(f.nightLdg) : undefined,
    lesson: ground ? `Ground (${f.groundGiven} hr)` : place || f.route || undefined,
    notes: [f.comments, extras && `ForeFlight: ${extras}`].filter(Boolean).join("\n\n") || undefined,
  };
}
