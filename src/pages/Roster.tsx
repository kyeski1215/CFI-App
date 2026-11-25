import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, Modal } from "../components/ui";
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
  const week = active.filter((s) => (recency(s) ?? 999) <= 7);
  const ready = active.filter((s) => ["Stage check", "Checkride ready"].includes(s.status));

  const shown = sorted.filter((s) => {
    if (q && !(s.name + " " + s.goal + " " + (s.aircraft ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "Active") return isActive(s);
    if (filter === "Overdue") return overdue.includes(s);
    if (filter === "Ready") return ready.includes(s);
    if (filter === "Done / hold") return !isActive(s);
    return true;
  });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Student Roster</h1>
        </div>
        <div className="row">
          <Link className="btn" to="/import">Import logbook</Link>
          <button className="btn primary" onClick={() => setAdding(true)}>+ Add student</button>
        </div>
      </header>

      <section className="stats" aria-label="Summary">
        <div className="stat"><b>{active.length}</b><span>Active students</span></div>
        <div className="stat"><b>{week.length}</b><span>Flew in last 7 days</span></div>
        <div className="stat alert"><b>{overdue.length}</b><span>Overdue · {OVERDUE_DAYS}+ days</span></div>
        <div className="stat ready"><b>{ready.length}</b><span>Stage / checkride ready</span></div>
      </section>

      <section className="list">
        <div className="row">
          <input className="search" type="search" placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
          <select value={sortBy} aria-label="Sort" style={{ width: "auto", fontSize: 14 }} onChange={(e) => { setSortBy(e.target.value as SortKey); writePref("sort", e.target.value); }}>
            <option value="name">Sort: Name</option>
            <option value="recent">Sort: Flew most recently</option>
            <option value="overdue">Sort: Longest since flying</option>
            <option value="progress">Sort: Closest to checkride</option>
          </select>
          <button className="chip" aria-pressed={compact} onClick={() => { setCompact(!compact); writePref("compact", compact ? "0" : "1"); }}>Compact</button>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        {shown.length === 0 && (
          <div className="empty">
            {students.length ? "No students match." : <>No students yet. Add your first one, or <Link to="/import">import your ForeFlight logbook</Link>.</>}
          </div>
        )}
        <div className={compact ? "rows compact" : "rows"}>
        {shown.map((s) => {
          const d = recency(s);
          const plan = guideFor(s) ? guideProgress(s) : null;
          const topics = topicsFor(s);
          const prog = plan ?? { done: (s.covered ?? []).filter((t) => topics.includes(t)).length, total: topics.length, next: null };
          const lastMock = rides.filter((r) => r.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
          if (compact) {
            const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
            return (
              <Link key={s.id} to={"/students/" + s.id} className="crow">
                <span className={"cdot " + statusClass(s.status)} title={s.status} />
                <span className="cname">{s.name || "Unnamed"}</span>
                <span className="cgoal">{GOAL_SHORT[s.goal] ?? s.goal}</span>
                <span className={"cdays mono " + (d == null ? "muted" : d >= OVERDUE_DAYS ? "bad" : d >= 6 ? "warn" : "good")}>{d == null ? "—" : d === 0 ? "today" : d + "d"}</span>
                <span className="cpct mono">{pct}%</span>
              </Link>
            );
          }
          return (
            <Link key={s.id} to={"/students/" + s.id} className="lrow">
              <div className="who">
                <div className="name">{s.name || "Unnamed"}</div>
                <div className="sub">{[s.goal, s.aircraft, s.stage].filter(Boolean).join(" · ")}</div>
                {s.nextLesson && <div className="sub clamp">Next: {s.nextLesson}</div>}
                <div className="tags">
                  <span className={"pill " + statusClass(s.status)}>{s.status}</span>
                  {lastMock?.result && <span className="pill p-acc">Mock: {lastMock.result}</span>}
                </div>
              </div>
              <div>
                <div className="kv">Last flight</div>
                <div className={"mono " + (d == null ? "muted" : d >= OVERDUE_DAYS ? "pill p-bad" : d >= 6 ? "pill p-warn" : "pill p-good")}>
                  {d == null ? "—" : d === 0 ? "Today" : `${d}d ago`}
                </div>
                <div className="kv" style={{ marginTop: 4 }}>
                  <b>{totalHours(s).toFixed(1)}</b> hrs
                </div>
              </div>
              <div>
                <div className="kv">Syllabus {prog.done}/{prog.total}</div>
                <Bar value={prog.done} total={prog.total} />
                {prog.next && <div className="kv clamp" style={{ marginTop: 4 }}>Up next: <b>{prog.next}</b></div>}
                {lastMock && <div className="kv" style={{ marginTop: 4 }}>Mock {fmtDate(lastMock.date)}</div>}
              </div>
            </Link>
          );
        })}
        </div>
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
