import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../components/ui";
import { GOALS, STATUSES } from "../lib/curriculum";
import { groupByStudent, parseForeFlight, toLogEntry, type Candidate, type FFFlight } from "../lib/foreflight";
import { create, fmtDate, put, useCollection } from "../lib/store";
import type { LogEntry, Student } from "../lib/types";

interface Choice { include: boolean; name: string; goal: string; target: string /* "" = new student, else student id */; email?: string }

export default function ImportLogbook() {
  const students = useCollection<Student>("students");
  const nav = useNavigate();
  const toast = useToast();
  const [err, setErr] = useState("");
  const [file, setFile] = useState("");
  const [result, setResult] = useState<{ candidates: Candidate[]; unassigned: FFFlight[]; teaching: number; total: number } | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [unassignedTo, setUnassignedTo] = useState("skip"); // "skip" | "new" | student id

  const byName = (n: string) => students.find((s) => s.name.trim().toLowerCase() === n.trim().toLowerCase());

  const load = async (f: File) => {
    setErr("");
    setResult(null);
    setFile(f.name);
    try {
      const { flights } = parseForeFlight(await f.text());
      const g = groupByStudent(flights);
      if (!g.teaching) throw new Error(`Found ${flights.length} flights but none with dual given or ground given, so there's no instruction to import.`);
      setResult({ ...g, total: flights.length });
      const c: Record<string, Choice> = {};
      for (const k of g.candidates) {
        const match = byName(k.name);
        c[k.key] = { include: true, name: k.name, goal: match?.goal ?? k.goalGuess, target: match?.id ?? "", email: k.email };
      }
      setChoices(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const merge = (s: Student, flights: FFFlight[]) => {
    const have = new Set((s.log ?? []).map((e) => e.id));
    const add: LogEntry[] = flights.map(toLogEntry).filter((e) => !have.has(e.id));
    if (add.length) put("students", { ...s, log: [...(s.log ?? []), ...add] });
    return add.length;
  };
  const run = () => {
    if (!result) return;
    let made = 0, flightsAdded = 0;
    for (const c of result.candidates) {
      const ch = choices[c.key];
      if (!ch?.include) continue;
      let s = ch.target ? students.find((x) => x.id === ch.target) : undefined;
      if (!s) {
        s = create<Student>("students", { name: ch.name.trim() || c.name, goal: ch.goal, status: STATUSES[0][0], email: ch.email, log: [], covered: [] });
        made++;
      }
      flightsAdded += merge(s, c.flights);
    }
    if (result.unassigned.length && unassignedTo !== "skip") {
      let s = unassignedTo === "new" ? undefined : students.find((x) => x.id === unassignedTo);
      if (!s) {
        s = create<Student>("students", { name: "Unassigned (ForeFlight)", goal: "Other", status: "On hold", log: [], covered: [] });
        made++;
      }
      flightsAdded += merge(s, result.unassigned);
    }
    toast(`Imported ${flightsAdded} lessons${made ? ` · ${made} new student${made === 1 ? "" : "s"}` : ""}`);
    nav("/students");
  };

  const set = (k: string, p: Partial<Choice>) => setChoices({ ...choices, [k]: { ...choices[k], ...p } });
  const included = result?.candidates.filter((c) => choices[c.key]?.include) ?? [];
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link to="/students" className="small">← Roster</Link>
          <h1 style={{ marginTop: 6 }}>Import logbook</h1>
        </div>
      </header>

      <section className="card">
        <h3>1. Export from ForeFlight</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>In ForeFlight, open <b>Logbook</b>.</li>
          <li>Tap the <b>⋯ / Settings</b> menu and choose <b>Export</b> → <b>CSV</b> (on the web: plan.foreflight.com → Logbook → Export).</li>
          <li>Save the file, then choose it below.</li>
        </ol>
        <p className="small muted" style={{ margin: 0 }}>
          Only flights where you logged <b>dual given</b> (or ground given) are imported. The student comes from the people on each flight: add them in ForeFlight with the <b>Student</b> role for the best match.
          Nothing is uploaded until you review it, and importing the same file again won't duplicate lessons.
        </p>
        <label className="btn primary" style={{ alignSelf: "flex-start" }}>
          Choose ForeFlight CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />
        </label>
        {file && <div className="small muted">{file}</div>}
        {err && <div className="small" style={{ color: "var(--bad)" }}>{err}</div>}
      </section>

      {result && (
        <>
          <section className="card">
            <h3>2. Check the students</h3>
            <div className="small muted">
              {result.total} flights in the file · {result.teaching} with instruction given · {result.candidates.length} student{result.candidates.length === 1 ? "" : "s"} found
            </div>
            {result.candidates.map((c) => {
              const ch = choices[c.key];
              if (!ch) return null;
              return (
                <div key={c.key} className={"impstu" + (ch.include ? "" : " off")}>
                  <label className="check" style={{ borderBottom: 0, padding: 0 }}>
                    <input type="checkbox" checked={ch.include} onChange={() => set(c.key, { include: !ch.include })} />
                    <span className="ct">
                      <b>{c.name}</b>
                      <small>{c.flights.length} lesson{c.flights.length === 1 ? "" : "s"} · {c.hours} hr · last {fmtDate(c.last)}{c.email ? " · " + c.email : ""}</small>
                    </span>
                  </label>
                  {ch.include && (
                    <div className="fields">
                      <label className="f">Add to
                        <select value={ch.target} onChange={(e) => set(c.key, { target: e.target.value })}>
                          <option value="">New student</option>
                          {sorted.map((s) => <option key={s.id} value={s.id}>{s.name} (on roster)</option>)}
                        </select>
                      </label>
                      {!ch.target && (
                        <>
                          <label className="f">Name<input value={ch.name} onChange={(e) => set(c.key, { name: e.target.value })} /></label>
                          <label className="f">Training for
                            <select value={ch.goal} onChange={(e) => set(c.key, { goal: e.target.value })}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {result.unassigned.length > 0 && (
              <div className="impstu">
                <div className="ct">
                  <b>{result.unassigned.length} instruction flight{result.unassigned.length === 1 ? "" : "s"} with no student named</b>
                  <div className="small muted">Most recent: {result.unassigned.map((f) => `${fmtDate(f.date)} ${f.tail}`).slice(-3).reverse().join(", ")}</div>
                </div>
                <label className="f">What to do with them
                  <select value={unassignedTo} onChange={(e) => setUnassignedTo(e.target.value)}>
                    <option value="skip">Skip them</option>
                    <option value="new">Put them in an "Unassigned (ForeFlight)" student to sort later</option>
                    {sorted.map((s) => <option key={s.id} value={s.id}>Add them all to {s.name}</option>)}
                  </select>
                </label>
              </div>
            )}
          </section>

          <section className="card">
            <h3>3. Import</h3>
            <div className="small">
              {included.length} student{included.length === 1 ? "" : "s"} · {included.reduce((a, c) => a + c.flights.length, 0) + (unassignedTo !== "skip" ? result.unassigned.length : 0)} lessons.
              Each flight becomes a lesson log entry with date, tail, route, dual hours, night, landings and your comments.
            </div>
            <div className="row">
              <span className="spacer" />
              <button className="btn primary" disabled={!included.length && unassignedTo === "skip"} onClick={run}>Import</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
