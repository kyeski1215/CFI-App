import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, Modal } from "../components/ui";
import {
  DAYS,
  GOALS,
  OVERDUE_DAYS,
  SLOTS,
  STATUSES,
  initials,
  isActive,
  lastFlight,
  statusClass,
  topicsFor,
  totalHours,
} from "../lib/curriculum";
import { create, daysBetween, fmtDate, todayStr, useCollection } from "../lib/store";
import type { Ride, Student } from "../lib/types";

const FILTERS = ["Active", "All", "Overdue", "Ready", "Done / hold"];

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

  const sorted = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name)), [students]);
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
          <div className="eyebrow">KOGD · Blitz Aviation</div>
          <h1>Student Roster</h1>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add student</button>
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
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        {shown.length === 0 && (
          <div className="empty">
            {students.length ? "No students match." : "No students yet. Add your first one, or import from Settings."}
          </div>
        )}
        {shown.map((s) => {
          const d = recency(s);
          const topics = topicsFor(s);
          const covered = (s.covered ?? []).filter((t) => topics.includes(t)).length;
          const lastMock = rides.filter((r) => r.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
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
                <div className="kv">Syllabus {covered}/{topics.length}</div>
                <Bar value={covered} total={topics.length} />
                {lastMock && <div className="kv" style={{ marginTop: 4 }}>Mock {fmtDate(lastMock.date)}</div>}
              </div>
            </Link>
          );
        })}
      </section>

      <section>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2>Who's free when</h2>
          <span className="muted small">Active students' usual availability</span>
        </div>
        <div className="gridwrap">
          <table className="week">
            <thead>
              <tr><th></th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
            </thead>
            <tbody>
              {SLOTS.map(([k, label]) => (
                <tr key={k}>
                  <td className="slotname">{label}</td>
                  {DAYS.map((d) => (
                    <td key={d}>
                      {active.filter((s) => s.avail?.includes(d + "-" + k)).map((s) => (
                        <Link key={s.id} className="ini" to={"/students/" + s.id} title={s.name}>{initials(s.name)}</Link>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
