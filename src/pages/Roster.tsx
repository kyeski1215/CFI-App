import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Chevron, Modal } from "../components/ui";
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
  totalHours,
} from "../lib/curriculum";
import { create, daysBetween, fmtDate, todayStr, useCollection } from "../lib/store";
import type { Ride, Student } from "../lib/types";

const FILTERS = ["Active", "All", "Overdue", "Ready", "Done / hold"];
type SortKey = "name" | "recent" | "overdue" | "progress";
const GOAL_SHORT: Record<string, string> = { "Private Pilot": "PPL", Instrument: "IR", Commercial: "CPL", "Multi-Engine": "AMEL", CFI: "CFI", CFII: "CFII", Other: "Other" };
const readPref = (k: string) => { try { return localStorage.getItem("cfi.v1.roster." + k) ?? ""; } catch { return ""; } };
const writePref = (k: string, v: string) => { try { localStorage.setItem("cfi.v1.roster." + k, v); } catch { /* private mode */ } };

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
    if (q && !(s.name + " " + s.goal + " " + (s.aircraft ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "Active") return isActive(s);
    if (filter === "Overdue") return overdue.includes(s);
    if (filter === "Ready") return ready.includes(s);
    if (filter === "Done / hold") return !isActive(s);
    return true;
  });

  const stories = [...active].sort((x, y) => (recency(x) ?? 9999) - (recency(y) ?? 9999));
  const label = filter === "Done / hold" ? "Done or on hold" : filter;

  return (
    <div className="page">
      <div className="navactions">
        <Link className="navbtn" to="/import">Import</Link>
        <button className="navbtn" aria-label="Add student" onClick={() => setAdding(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <h1>Roster</h1>
      <input className="search" type="search" placeholder="Search" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />

      {stories.length > 0 && !q && (
        <div className="stories" aria-label="Recent students">
          {stories.map((s) => {
            const d = recency(s);
            return (
              <Link key={s.id} to={"/students/" + s.id} className="story" title={s.name}>
                <span className={"ring" + (d != null && d >= OVERDUE_DAYS ? " bad" : "")}><Avatar name={s.name} size={52} /></span>
                <span>{(s.name || "Unnamed").split(/\s+/)[0]}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="chips" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "Done / hold" ? "Done" : f}{f === "Overdue" && overdue.length ? ` ${overdue.length}` : f === "Ready" && ready.length ? ` ${ready.length}` : ""}
          </button>
        ))}
      </div>

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
                  <span className="itext"><span className="t1">{s.name || "Unnamed"} <span className="muted" style={{ fontSize: 14 }}>{GOAL_SHORT[s.goal] ?? s.goal}</span></span></span>
                  <span className="ival">{pct}%</span>
                  <span className={dcls} style={{ minWidth: 44, textAlign: "right" }}>{days}</span>
                  <Chevron />
                </span>
              </Link>
            );
          }
          const sub = [GOAL_SHORT[s.goal] ?? s.goal, s.stage || (isActive(s) ? null : s.status), totalHours(s).toFixed(1) + " hr", prog.total ? pct + "%" : null].filter(Boolean).join(" · ");
          return (
            <Link key={s.id} to={"/students/" + s.id} className="irow">
              <Avatar name={s.name} />
              <span className="ibody">
                <span className="itext">
                  <span className="t1">{s.name || "Unnamed"}</span>
                  <span className="t2">{sub}</span>
                  {(["Stage check", "Checkride ready"].includes(s.status) || lastMock?.result) && (
                    <span className="tags" style={{ marginTop: 4 }}>
                      {["Stage check", "Checkride ready"].includes(s.status) && <span className={"pill " + statusClass(s.status)}>{s.status}</span>}
                      {lastMock?.result && <span className="pill p-mute">Mock {fmtDate(lastMock.date)}: {lastMock.result}</span>}
                    </span>
                  )}
                </span>
                <span className={dcls}>{days}</span>
                <Chevron />
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
