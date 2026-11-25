// Converts records from the old Student Roster / Mock Checkride Logger artifacts into app records.
import { all, importAll, newId, put, type BaseRec } from "./store";
import type { LogEntry, Ride, Student } from "./types";

type Any = Record<string, any>;

const ms = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && !isNaN(Date.parse(v)) ? Date.parse(v) : Date.now());
const str = (v: unknown) => (v == null ? undefined : String(v));
const slug = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Accepts an array, a {id: doc} map, or a single doc. */
function docs(v: unknown): [string | undefined, Any][] {
  if (Array.isArray(v)) return v.map((d) => [d?.id, d]);
  if (v && typeof v === "object") {
    const o = v as Any;
    if (o.name || o.bank) return [[o.id, o]];
    return Object.entries(o).map(([k, d]) => [k, d?.data ?? d]);
  }
  return [];
}

export function convertStudent(id: string | undefined, d: Any): Student {
  const log: LogEntry[] = (d.log ?? []).map((e: Any) => ({
    id: e.id ?? newId(),
    kind: e.kind === "ground" ? "ground" : "flight",
    date: str(e.date) ?? "",
    tail: str(e.tail),
    hrs: str(e.hrs),
    night: str(e.night),
    ldgDay: str(e.ldgDay),
    ldgNight: str(e.ldgNight),
    lesson: str(e.lesson),
    notes: str(e.notes),
    text: str(e.text),
    regs: str(e.regs),
  }));
  return {
    ...d,
    id: "s-" + (id ?? slug(d.name ?? newId())),
    name: d.name ?? "Unnamed",
    goal: d.goal ?? "Private Pilot",
    status: d.status ?? "On track",
    priorHours: str(d.priorHours),
    targetPerWeek: str(d.targetPerWeek),
    log,
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt ?? d.createdAt),
  };
}

export function convertRide(id: string | undefined, d: Any, students: Student[]): Ride {
  const name = String(d.student ?? "").trim().toLowerCase();
  const match = name ? students.find((s) => s.name.trim().toLowerCase() === name) : undefined;
  return {
    ...d,
    id: "r-" + (id ?? newId()),
    bank: d.bank ?? "ppl",
    student: d.student ?? "",
    studentId: d.studentId ?? match?.id,
    date: d.date ?? "",
    kind: d.kind ?? "Oral",
    grades: d.grades ?? {},
    qnotes: d.qnotes ?? {},
    sections: d.sections ?? {},
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt ?? d.createdAt),
  };
}

export function importLegacy(json: Any) {
  if (json?.app === "cfi-cockpit") {
    const n = importAll(json);
    return { students: n, rides: 0 };
  }
  const students = docs(json.students).map(([id, d]) => convertStudent(id, d));
  repairMergedText(students);
  const known = [...all<Student>("students"), ...students];
  const rides = docs(json.rides ?? json.checkrides).map(([id, d]) => convertRide(id, d, known));
  if (!students.length && !rides.length) throw new Error("No students or checkrides found in that JSON");
  importAll({ data: { students: students as BaseRec[], rides: rides as BaseRec[] } });
  return { students: students.length, rides: rides.length };
}

/** An earlier importer appended each lesson's student text to its notes. Split them back apart. */
function repairMergedText(incoming: Student[]) {
  for (const inc of incoming) {
    const local = all<Student>("students").find((x) => x.id === inc.id);
    if (!local?.log) continue;
    let changed = false;
    const log = local.log.map((le) => {
      const src = inc.log?.find((ie) => ie.text && ie.date === le.date && (ie.lesson ?? "") === (le.lesson ?? ""));
      if (!src?.text || le.text) return le;
      const merged = [src.notes, src.text].filter(Boolean).join("\n\n");
      if (le.notes !== merged) return le;
      changed = true;
      return { ...le, notes: src.notes, text: src.text };
    });
    if (changed) put("students", { ...local, log });
  }
}
