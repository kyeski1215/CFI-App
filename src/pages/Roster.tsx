import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Chevron, Modal, RatingDot, toneFor } from "../components/ui";
import {
  GOALS,
  OVERDUE_DAYS,
  guideFor,
  guideProgress,
  STATUSES,
  isActive,
  lastFlight,
  statusClass,
  topicsFor,
} from "../lib/curriculum";
import { create, daysBetween, fmtDate, todayStr, useCollection } from "../lib/store";
import type { Ride, Student } from "../lib/types";

const FILTERS = ["Active", "All", "Overdue", "Ready", "Done / hold"];
type SortKey = "name" | "recent" | "overdue" | "progress";
const GOAL_SHORT: Record<string, string> = { "Private Pilot": "PPL", Instrument: "IR", Commercial: "CPL", "Multi-Engine": "AMEL", CFI: "CFI", CFII: "CFII", Other: "Other" };
const readPref = (k: string) => { try { return localStorage.getItem("cfi.v1.roster." + k) ?? ""; } catch { return ""; } };
const writePref = (k: string, v: string) => { try { localStorage.setItem("cfi.v1.roster." + k, v); } catch { /* private mode */ } };

const ORDER = ["Private Pilot", "Instrument", "Commercial", "Multi-Engine", "CFI", "CFII"];
const toneOrder = (g: string) => { const i = ORDER.indexOf(g); return i < 0 ? 99 + toneFor(g) : i; };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function recency(s: Student) {
  const lf = lastFlight(s);
  return lf ? daysBetween(lf, todayStr()) : null;
}

export default function Roster() {
  const students = useCollection<Student>("students");
  const rides = useCollection<Ride>("rides");
  const [filter, setFilter] = useState("Active");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [rating, setRating] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortKey>(() => (readPref("sort") as SortKey) || "name");
  const [compact, setCompact] = useState(() => readPref("compact") === "1");
  const sorted = useMemo(() => {
    const progressOf = (s: Student) => {
      const p = guideFor(s) ? guideProgress(s) : null;
      const t = topicsFor(s);
      const done = p ? p.done : (s.covered ?? []).filter((x) => t.includes(x)).length;
      const total = p ? p.total : t.length;
      return total ? done / total : 0;
    };
    const days = (s: Student) => recency(s) ?? 9999;
    const list = [...students];
    const byName = (a: Student, b: Student) => a.name.localeCompare(b.name);
    if (sortBy === "recent") list.sort((a, b) => days(a) - days(b) || byName(a, b));
    else if (sortBy === "overdue") list.sort((a, b) => days(b) - days(a) || byName(a, b));
    else if (sortBy === "progress") list.sort((a, b) => progressOf(b) - progressOf(a) || byName(a, b));
    else list.sort(byName);
    return list;
  }, [students, sortBy]);
  const active = sorted.filter(isActive);
  const overdue = active.filter((s) => (recency(s) ?? 999) >= OVERDUE_DAYS);
  const ready = active.filter((s) => ["Stage check", "Checkride ready"].includes(s.status));

  const shown = sorted.filter((s) => {
    if (rating && s.goal !== rating) return false;
    if (q && !(s.name + " " + s.goal + " " + (s.aircraft ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "Active") return isActive(s);
    if (filter === "Overdue") return overdue.includes(s);
    if (filter === "Ready") return ready.includes(s);
    if (filter === "Done / hold") return !isActive(s);
    return true;
  });

  const ratingsHere = Object.entries(
    active.reduce<Record<string, number>>((m, s) => ((m[s.goal || "Other"] = (m[s.goal || "Other"] ?? 0) + 1), m), {}),
  ).sort((a, b) => toneOrder(a[0]) - toneOrder(b[0]));
  const label = filter === "Done / hold" ? "Done or on hold" : filter;

  return (
    <div className="page">
      <div className="hello">
        <span className="appmark" aria-hidden="true"><img src="icon.svg" alt="" /></span>
        <div className="greet"><small>{greeting()}</small><h1>Your students</h1></div>
        <Link className="roundbtn" to="/import" aria-label="Import logbook" title="Import logbook">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
        </Link>
        <button className="roundbtn" aria-label="Add student" onClick={() => setAdding(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <input className="search" type="search" placeholder="Search students" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />


      <div className="chips" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "Done / hold" ? "Done" : f}{f === "Overdue" && overdue.length ? ` ${overdue.length}` : f === "Ready" && ready.length ? ` ${ready.length}` : ""}
          </button>
        ))}
      </div>

      {ratingsHere.length > 1 && (
        <div className="legend" role="group" aria-label="Filter by rating">
          {ratingsHere.map(([g, n]) => (
            <button key={g} aria-pressed={rating === g} onClick={() => setRating(rating === g ? null : g)}>
              <RatingDot goal={g} />{GOAL_SHORT[g] ?? g}<span className="muted"> {n}</span>
            </button>
          ))}
        </div>
      )}

      <section className="list">
        <div className="ghdr">
          <span>{shown.length} {label}</span>
          <span className="spacer" />
          <select value={sortBy} aria-label="Sort" onChange={(e) => { setSortBy(e.target.value as SortKey); writePref("sort", e.target.value); }}>
            <option value="name">Name</option>
            <option value="recent">Flew recently</option>
            <option value="overdue">Longest since flying</option>
            <option value="progress">Closest to checkride</option>
          </select>
          <button aria-pressed={compact} onClick={() => { setCompact(!compact); writePref("compact", compact ? "0" : "1"); }}>{compact ? "Expand" : "Compact"}</button>
        </div>
        {shown.length === 0 && (
          <div className="empty">
            {students.length ? "No students match." : <>No students yet. Tap + to add one, or <Link to="/import">import your ForeFlight logbook</Link>.</>}
          </div>
        )}
        {shown.length > 0 && (
        <div className="rows">
        {shown.map((s) => {
          const d = recency(s);
          const plan = guideFor(s) ? guideProgress(s) : null;
          const topics = topicsFor(s);
          const prog = plan ?? { done: (s.covered ?? []).filter((t) => topics.includes(t)).length, total: topics.length };
          const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
          const lastMock = rides.filter((r) => r.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
          const days = d == null ? "—" : d === 0 ? "Today" : d + "d";
          const dcls = "ival" + (d == null ? "" : d >= OVERDUE_DAYS ? " bad" : d >= 6 ? " warn" : "");
          if (compact) {
            return (
              <Link key={s.id} to={"/students/" + s.id} className="irow compact">
                <span className="ibody">
                  <RatingDot goal={s.goal} />
                  <span className="itext"><span className="t1">{s.name || "Unnamed"} <span className="muted" style={{ fontSize: 14 }}>{GOAL_SHORT[s.goal] ?? s.goal}</span></span></span>
                  <span className="ival">{pct}%</span>
                  <span className={dcls} style={{ minWidth: 44, textAlign: "right" }}>{days}</span>
                  <Chevron />
                </span>
              </Link>
            );
          }
          const when = d == null ? "no flights yet" : d === 0 ? "flew today" : d >= OVERDUE_DAYS ? `${d} days, overdue` : `flew ${d}d ago`;
          return (
            <Link key={s.id} to={"/students/" + s.id} className="irow">
              <Avatar name={s.name} goal={s.goal} size={44} />
              <span className="ibody">
                <span className="itext">
                  <span className="t1">{s.name || "Unnamed"}</span>
                  <span className="t2">{GOAL_SHORT[s.goal] ?? s.goal}{s.stage ? " · " + s.stage : ""} · <span className={d != null && d >= OVERDUE_DAYS ? "bad" : d != null && d >= 6 ? "warn" : ""}>{when}</span></span>
                  {(["Stage check", "Checkride ready"].includes(s.status) || lastMock?.result) && (
                    <span className="tags" style={{ marginTop: 4 }}>
                      {["Stage check", "Checkride ready"].includes(s.status) && <span className={"pill " + statusClass(s.status)}>{s.status}</span>}
                      {lastMock?.result && <span className="pill p-mute">Mock {fmtDate(lastMock.date)}: {lastMock.result}</span>}
                    </span>
                  )}
                </span>
                {prog.total > 0 && <span className={"pctpill" + (pct >= 90 ? " done" : "")}>{pct}%</span>}
              </span>
            </Link>
          );
        })}
        </div>
        )}
      </section>

      {adding && <AddStudent onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStudent({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState(GOALS[0]);
  return (
    <Modal title="Add student" onClose={onClose}>
      <form
        className="fields"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const s = create<Student>("students", { name: name.trim(), goal, status: STATUSES[0][0], log: [], avail: [], covered: [] });
          nav("/students/" + s.id);
        }}
      >
        <label className="f full">Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="f full">Training for
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
        </label>
        <div className="row full"><span className="spacer" /><button className="btn primary">Add</button></div>
      </form>
    </Modal>
  );
}
