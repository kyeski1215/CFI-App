import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bar, useCopy } from "../components/ui";
import { BANKS, GRADE_LABEL, KINDS, RESULTS, useFullBank, type Question } from "../lib/banks";
import { fmtDate, put, remove, useCollection, useRecord } from "../lib/store";
import type { Grade, Ride, Student } from "../lib/types";

const GRADES: Grade[] = ["S", "W", "U"];

export default function MockRide() {
  const { id } = useParams();
  const r = useRecord<Ride>("rides", id);
  const students = useCollection<Student>("students");
  const nav = useNavigate();
  const copy = useCopy();
  const [focus, setFocus] = useState<string>("");
  const [showKeys, setShowKeys] = useState(false);
  const [only, setOnly] = useState<"all" | "open" | "weak">("all");
  const [confirmDel, setConfirmDel] = useState(false);

  const bank = useFullBank(r?.bank);
  const meta = r ? BANKS[r.bank] : undefined;
  const counts = useMemo(() => {
    const c = { S: 0, W: 0, U: 0 };
    Object.values(r?.grades ?? {}).forEach((g) => c[g]++);
    return c;
  }, [r?.grades]);

  if (!r || !meta) {
    return <div className="page"><div className="empty">Mock checkride not found. <Link to="/mocks">Back</Link></div></div>;
  }
  if (!bank) {
    return <div className="page"><div className="empty">Loading {meta.name} questions…</div></div>;
  }
  const examinerFocus = focus || r.examiner || "";
  const update = (p: Partial<Ride>) => put("rides", { ...r, ...p });
  const grade = (qid: string, g: Grade) => {
    const grades = { ...r.grades };
    if (grades[qid] === g) delete grades[qid];
    else grades[qid] = g;
    update({ grades });
  };
  const total = bank.sections.reduce((a, s) => a + s.qs.length, 0);
  const graded = counts.S + counts.W + counts.U;
  const student = students.find((s) => s.id === r.studentId);

  const visible = (q: Question) => {
    if (examinerFocus && !q[4]?.[examinerFocus]) return false;
    if (only === "open" && r.grades[q[0]]) return false;
    if (only === "weak" && !["W", "U"].includes(r.grades[q[0]])) return false;
    return true;
  };

  const debrief = () => {
    let out = `${bank.short} mock ${r.kind.toLowerCase()} debrief: ${student?.name ?? r.student ?? "Student"} (${fmtDate(r.date)})\n`;
    if (r.examiner) out += `Run in the style of: ${r.examiner}\n`;
    out += `S ${counts.S} · W ${counts.W} · U ${counts.U}${r.result ? " · " + r.result : ""}\n`;
    for (const s of bank.sections) {
      const items = s.qs.filter((q) => ["W", "U"].includes(r.grades[q[0]]) || r.qnotes[q[0]]);
      const sn = r.sections[s.id]?.note;
      if (!items.length && !sn) continue;
      out += `\n${s.t}\n`;
      if (sn) out += `  Note: ${sn}\n`;
      for (const q of items) {
        out += `  [${r.grades[q[0]] ?? "–"}] ${q[1]}${r.qnotes[q[0]] ? " — " + r.qnotes[q[0]] : ""}\n      Review: ${q[3]}\n`;
      }
    }
    if (r.overall) out += `\nOverall: ${r.overall}\n`;
    return out;
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link to="/mocks" className="small">← Mock checkrides</Link>
          <h1 style={{ marginTop: 6 }}>{bank.name}</h1>
          <div className="muted small">
            {student ? <Link to={"/students/" + student.id}>{student.name}</Link> : r.student || "No student"} · {fmtDate(r.date)}
          </div>
        </div>
        <button className="btn" onClick={() => copy(debrief(), "Debrief copied")}>Copy debrief</button>
      </header>

      <details className="fold" open={graded === 0}>
        <summary><span className="ft">Checkride details</span><span className="small muted">{r.kind}{r.examiner ? ` · ${r.examiner} style` : ""}</span></summary>
        <div className="fb fields">
          <label className="f">Student
            <select value={r.studentId ?? ""} onChange={(e) => {
              const s = students.find((x) => x.id === e.target.value);
              update({ studentId: s?.id, student: s?.name ?? "" });
            }}>
              <option value="">{r.student && !r.studentId ? r.student + " (not on roster)" : "— None —"}</option>
              {[...students].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="f">Date<input type="date" value={r.date} onChange={(e) => update({ date: e.target.value })} /></label>
          <label className="f">Type
            <select value={r.kind} onChange={(e) => update({ kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </label>
          <label className="f">Run it like
            <select value={r.examiner ?? ""} onChange={(e) => update({ examiner: e.target.value })}>
              <option value="">Any examiner</option>
              {bank.examiners.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="f">Aircraft<input value={r.aircraft ?? ""} onChange={(e) => update({ aircraft: e.target.value })} /></label>
          <label className="f">Route<input value={r.route ?? ""} onChange={(e) => update({ route: e.target.value })} /></label>
        </div>
      </details>

      <div className="row" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "8px 0" }}>
        <div className="chips">
          {(["all", "open", "weak"] as const).map((o) => (
            <button key={o} className="chip" aria-pressed={only === o} onClick={() => setOnly(o)}>
              {o === "all" ? "All" : o === "open" ? "Ungraded" : "W / U"}
            </button>
          ))}
          {bank.examiners.length > 0 && (
            <select value={focus} onChange={(e) => setFocus(e.target.value)} style={{ width: "auto", padding: "4px 8px", fontSize: 13 }} aria-label="Examiner focus">
              <option value="">{r.examiner ? `${r.examiner}'s gouge` : "Every question"}</option>
              {bank.examiners.filter((x) => x !== r.examiner).map((x) => <option key={x} value={x}>{x}'s gouge</option>)}
            </select>
          )}
          <button className="chip" aria-pressed={showKeys} onClick={() => setShowKeys(!showKeys)}>Answer keys</button>
        </div>
        <span className="spacer" />
        <span className="small mono">{graded}/{total}</span>
        <span className="gp S">{counts.S}</span><span className="gp W">{counts.W}</span><span className="gp U">{counts.U}</span>
      </div>

      {bank.sections.map((sec) => {
        const qs = sec.qs.filter(visible);
        if (!qs.length) return null;
        const n = sec.qs.filter((q) => r.grades[q[0]]).length;
        return (
          <details key={sec.id} className="fold" open>
            <summary>
              <span className="ft">{sec.t}</span>
              <span className="mono small muted">{n}/{sec.qs.length}</span>
            </summary>
            <div className="fb">
              {sec.intro && <p className="muted small" style={{ marginTop: 0 }}>{sec.intro}</p>}
              {qs.map((q) => (
                <QuestionRow key={q[0]} q={q} grade={r.grades[q[0]]} note={r.qnotes[q[0]] ?? ""} showKey={showKeys}
                  onGrade={(g) => grade(q[0], g)}
                  onNote={(t) => {
                    const qnotes = { ...r.qnotes };
                    if (t) qnotes[q[0]] = t;
                    else delete qnotes[q[0]];
                    update({ qnotes });
                  }} />
              ))}
              <label className="f" style={{ marginTop: 10 }}>Section notes
                <textarea value={r.sections[sec.id]?.note ?? ""} onChange={(e) =>
                  update({ sections: { ...r.sections, [sec.id]: { ...r.sections[sec.id], note: e.target.value } } })} />
              </label>
            </div>
          </details>
        );
      })}

      <section className="card">
        <h3>Overall</h3>
        <Bar value={graded} total={total} />
        <div className="fields">
          <label className="f full">Result
            <select value={r.result ?? ""} onChange={(e) => update({ result: e.target.value })}>
              <option value="">Result…</option>
              {RESULTS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="f full">Overall debrief
            <textarea style={{ minHeight: 110 }} value={r.overall ?? ""} onChange={(e) => update({ overall: e.target.value })} />
          </label>
        </div>
        <div className="row">
          {!confirmDel ? (
            <button className="btn danger sm" onClick={() => setConfirmDel(true)}>Delete mock</button>
          ) : (
            <>
              <span className="small">Delete this mock checkride?</span>
              <button className="btn danger sm" onClick={() => { remove("rides", r.id); nav("/mocks"); }}>Yes, delete</button>
              <button className="btn sm" onClick={() => setConfirmDel(false)}>Cancel</button>
            </>
          )}
          <span className="spacer" />
          <button className="btn primary" onClick={() => copy(debrief(), "Debrief copied")}>Copy debrief</button>
        </div>
      </section>
    </div>
  );
}

function QuestionRow({ q, grade, note, showKey, onGrade, onNote }: {
  q: Question; grade?: Grade; note: string; showKey: boolean; onGrade: (g: Grade) => void; onNote: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const ex = Object.entries(q[4] ?? {});
  return (
    <div className="q">
      <div className="qt">
        {q[1]}
        {ex.map(([name, lvl]) => (
          <span key={name} className={"ex" + (lvl === 2 ? " hot" : "")} title={lvl === 2 ? `${name} spends real time here` : `On ${name}'s gouge`}>
            {name}{lvl === 2 ? " ★" : ""}
          </span>
        ))}
      </div>
      <div className="g" role="group" aria-label="Grade">
        {GRADES.map((g) => (
          <button key={g} className={g} aria-pressed={grade === g} title={GRADE_LABEL[g]} onClick={() => onGrade(g)}>{g}</button>
        ))}
      </div>
      {(showKey || open) && (
        <div className="key">{q[2]}<span className="ref">{q[3]}</span></div>
      )}
      <div className="qx">
        {!showKey && <button className="linkbtn" onClick={() => setOpen(!open)}>{open ? "Hide answer" : "Answer"}</button>}
        {!note && !noteOpen && <button className="linkbtn" onClick={() => setNoteOpen(true)}>+ Note</button>}
      </div>
      {(note || noteOpen) && (
        <textarea placeholder="What they said / what to re-brief…" value={note} onChange={(e) => onNote(e.target.value)} autoFocus={noteOpen && !note} />
      )}
    </div>
  );
}
