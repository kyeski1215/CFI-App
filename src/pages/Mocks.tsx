import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CheckrideModal from "../components/CheckrideModal";
import { allCheckrides, checkrideStats, type CheckrideRow } from "../lib/checkrides";
import { Modal } from "../components/ui";
import { BANKS, BANK_IDS, KINDS, bankForGoal, questionCount } from "../lib/banks";
import { create, fmtDate, todayStr, useCollection } from "../lib/store";
import type { Ride, Student } from "../lib/types";

export default function Mocks() {
  const [params, setParams] = useSearchParams();
  const real = params.get("tab") === "real";
  const tabs = (
    <div className="chips kindtabs" role="tablist" aria-label="Checkrides">
      <button role="tab" className="chip" aria-pressed={!real} aria-selected={!real} onClick={() => setParams({}, { replace: true })}>Mock checkrides</button>
      <button role="tab" className="chip" aria-pressed={real} aria-selected={real} onClick={() => setParams({ tab: "real" }, { replace: true })}>Real checkrides</button>
    </div>
  );
  return real ? <RealCheckrides tabs={tabs} /> : <MockList tabs={tabs} />;
}

function RealCheckrides({ tabs }: { tabs: React.ReactNode }) {
  const students = useCollection<Student>("students");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CheckrideRow | null>(null);
  const rows = allCheckrides(students);
  const st = checkrideStats(rows);
  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Checkrides</h1></div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Record result</button>
      </header>
      {tabs}
      <section className="pstrip">
        <div><b style={{ color: "var(--good)" }}>{st.pass}</b><span>passed</span></div>
        <div><b style={{ color: st.fail ? "var(--bad)" : undefined }}>{st.fail}</b><span>failed</span></div>
        <div><b>{st.rate == null ? "—" : st.rate + "%"}</b><span>pass rate</span></div>
        <div className="acc"><b>{st.firstRate == null ? "—" : st.firstRate + "%"}</b><span>first try</span></div>
      </section>
      {st.byRating.length > 0 && (
        <section className="card">
          <h3>By rating</h3>
          {st.byRating.map(([r, x]) => (
            <div key={r} className="crrow"><span className="crt"><b>{r}</b></span><span className="small"><span style={{ color: "var(--good)" }}>{x.pass} pass</span>{x.fail ? <span style={{ color: "var(--bad)" }}> · {x.fail} fail</span> : null}</span></div>
          ))}
        </section>
      )}
      {rows.length === 0 ? (
        <div className="empty">No checkrides logged yet. When a student takes theirs, tap “+ Record result” (or use the Checkrides card on their page).</div>
      ) : (
        <section className="rows">
          {rows.map((r) => (
            <div key={r.id} className="lrow crlist">
              <span className={"pill " + (r.result === "Pass" ? "p-good" : r.result === "Fail" ? "p-bad" : "p-mute")}>{r.result}</span>
              <Link to={"/students/" + r.studentId} className="crt crlink"><b>{r.studentName}</b><small>{r.rating}{r.attempt > 1 ? ` · attempt ${r.attempt}` : ""} · {fmtDate(r.date)}{r.examiner ? " · " + r.examiner : ""}</small>{r.notes && <small>{r.notes}</small>}</Link>
              <button className="btn sm" onClick={() => setEditing(r)}>Edit</button>
            </div>
          ))}
        </section>
      )}
      {adding && <CheckrideModal students={students} onClose={() => setAdding(false)} />}
      {editing && <CheckrideModal students={students} initial={students.find((x) => x.id === editing.studentId)} edit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MockList({ tabs }: { tabs: React.ReactNode }) {
  const rides = useCollection<Ride>("rides");
  const students = useCollection<Student>("students");
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("all");
  const [creating, setCreating] = useState(false);

  const nameOf = (r: Ride) => students.find((s) => s.id === r.studentId)?.name ?? r.student ?? "";
  const list = rides
    .filter((r) => (bank === "all" || r.bank === bank) && nameOf(r).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Mock Checkrides</h1>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New mock</button>
      </header>
      {tabs}

      <div className="row">
        <input className="search" type="search" placeholder="Filter by student…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <div className="chips">
          <button className="chip" aria-pressed={bank === "all"} onClick={() => setBank("all")}>All</button>
          {BANK_IDS.map((b) => (
            <button key={b} className="chip" aria-pressed={bank === b} onClick={() => setBank(b)}>{BANKS[b].short}</button>
          ))}
        </div>
      </div>

      <section className="list">
        {list.length === 0 && <div className="empty">No mock checkrides yet.</div>}
        <div className="rows">
        {list.map((r) => {
          const c = { S: 0, W: 0, U: 0 };
          Object.values(r.grades ?? {}).forEach((g) => c[g]++);
          const total = BANKS[r.bank] ? questionCount(BANKS[r.bank]) : 0;
          return (
            <Link key={r.id} to={"/mocks/" + r.id} className="lrow">
              <div className="who">
                <div className="name">{nameOf(r) || "No student"}</div>
                <div className="sub">{BANKS[r.bank]?.short ?? r.bank} · {r.kind} · {fmtDate(r.date)}{r.examiner ? ` · ${r.examiner} style` : ""}</div>
              </div>
              <div className="row">
                <span className="gp S">{c.S}</span><span className="gp W">{c.W}</span><span className="gp U">{c.U}</span>
                <span className="kv">of {total}</span>
              </div>
              <div>{r.result && <span className="pill p-acc">{r.result}</span>}</div>
            </Link>
          );
        })}
        </div>
      </section>

      <section className="card">
        <h3>Question banks</h3>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {BANK_IDS.map((b) => (
            <li key={b}>
              <b>{BANKS[b].name}</b>: {questionCount(BANKS[b])} questions in {BANKS[b].sections.length} topics
              {BANKS[b].examiners.length ? ` · gouges from ${BANKS[b].examiners.join(", ")}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {creating && <NewMock students={students} onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewMock({ students, onClose }: { students: Student[]; onClose: () => void }) {
  const nav = useNavigate();
  const [studentId, setStudentId] = useState("");
  const [bank, setBank] = useState("ppl");
  const [kind, setKind] = useState(KINDS[0]);
  const [examiner, setExaminer] = useState("");
  const [date, setDate] = useState(todayStr());
  const [otherName, setOtherName] = useState("");
  const [otherPhone, setOtherPhone] = useState("");
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal title="New mock checkride" onClose={onClose}>
      <form
        className="fields"
        onSubmit={(e) => {
          e.preventDefault();
          const s = students.find((x) => x.id === studentId);
          const r = create<Ride>("rides", {
            bank, studentId: s?.id, student: s?.name ?? (studentId === "__other" ? otherName.trim() : ""), contact: studentId === "__other" ? otherPhone.trim() || undefined : undefined, date, kind, examiner,
            aircraft: s?.aircraft, route: BANKS[bank].route, prep: s?.goal,
            grades: {}, qnotes: {}, sections: {},
          });
          nav("/mocks/" + r.id);
        }}
      >
        <label className="f full">Student
          <select value={studentId} onChange={(e) => {
            setStudentId(e.target.value);
            const s = students.find((x) => x.id === e.target.value);
            if (s) setBank(bankForGoal(s.goal));
          }}>
            <option value="">— None —</option>
            <option value="__other">Someone not on my roster…</option>
            {sorted.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {studentId === "__other" && (
          <>
            <label className="f">Their name<input autoFocus required value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. another CFI's student" /></label>
            <label className="f">Phone (optional)<input type="tel" value={otherPhone} onChange={(e) => setOtherPhone(e.target.value)} placeholder="For texting the debrief" /></label>
          </>
        )}
        <label className="f">Checkride
          <select value={bank} onChange={(e) => { setBank(e.target.value); setExaminer(""); }}>
            {BANK_IDS.map((b) => <option key={b} value={b}>{BANKS[b].name}</option>)}
          </select>
        </label>
        <label className="f">Type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        </label>
        <label className="f">Run it like
          <select value={examiner} onChange={(e) => setExaminer(e.target.value)}>
            <option value="">Any examiner</option>
            {BANKS[bank].examiners.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="f">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="row full"><span className="spacer" /><button className="btn primary">Start</button></div>
      </form>
    </Modal>
  );
}
