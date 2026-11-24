import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bar, useCopy } from "../components/ui";
import { BANKS, bankForGoal } from "../lib/banks";
import {
  AIRCRAFT,
  DAYS,
  GOALS,
  SLOTS,
  STATUSES,
  TAILS,
  groundFor,
  groundKey,
  guideFor,
  lastFlight,
  statusClass,
  topicsFor,
  totalHours,
} from "../lib/curriculum";
import { create, fmtDate, newId, put, remove, todayStr, useCollection, useRecord } from "../lib/store";
import type { LogEntry, Ride, Student } from "../lib/types";

const TABS = ["Overview", "Log", "Syllabus", "Ground", "Guide", "Mocks"] as const;
type Tab = (typeof TABS)[number];

export default function StudentPage() {
  const { id } = useParams();
  const s = useRecord<Student>("students", id);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "Overview") as Tab;
  const nav = useNavigate();

  if (!s) {
    return (
      <div className="page">
        <div className="empty">Student not found. <Link to="/students">Back to roster</Link></div>
      </div>
    );
  }
  const update = (patch: Partial<Student>) => put("students", { ...s, ...patch });
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link to="/students" className="small">← Roster</Link>
          <h1 style={{ marginTop: 6 }}>{s.name || "Unnamed"}</h1>
          <div className="tags">
            <span className={"pill " + statusClass(s.status)}>{s.status}</span>
            <span className="pill p-blue">{s.goal}</span>
            <span className="pill p-mute">{totalHours(s).toFixed(1)} hrs</span>
            {lastFlight(s) && <span className="pill p-mute">Last flight {fmtDate(lastFlight(s)!)}</span>}
          </div>
        </div>
        <div className="row">
          <Link className="btn" to={`/regs?student=${s.id}`}>Log regs</Link>
          <button
            className="btn primary"
            onClick={() => {
              const bank = bankForGoal(s.goal);
              const r = create<Ride>("rides", {
                bank,
                studentId: s.id,
                student: s.name,
                date: todayStr(),
                kind: "Oral",
                aircraft: s.aircraft,
                route: BANKS[bank]?.route,
                prep: s.goal,
                grades: {},
                qnotes: {},
                sections: {},
              });
              nav("/mocks/" + r.id);
            }}
          >
            + Mock checkride
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && <Overview s={s} update={update} onDelete={() => { remove("students", s.id); nav("/students"); }} />}
      {tab === "Log" && <Log s={s} update={update} prefillRegs={params.get("regs") ?? ""} />}
      {tab === "Syllabus" && <Syllabus s={s} update={update} />}
      {tab === "Ground" && <Ground s={s} update={update} />}
      {tab === "Guide" && <Guide s={s} update={update} />}
      {tab === "Mocks" && <StudentMocks s={s} />}
    </div>
  );
}

type P = { s: Student; update: (p: Partial<Student>) => void };

function Field({ s, update, k, label, type = "text", full }: P & { k: keyof Student; label: string; type?: string; full?: boolean }) {
  return (
    <label className={"f" + (full ? " full" : "")}>
      {label}
      <input type={type} value={(s[k] as string) ?? ""} onChange={(e) => update({ [k]: e.target.value })} />
    </label>
  );
}
function Select({ s, update, k, label, opts }: P & { k: keyof Student; label: string; opts: string[] }) {
  const v = (s[k] as string) ?? "";
  const list = v && !opts.includes(v) ? [v, ...opts] : opts;
  return (
    <label className="f">
      {label}
      <select value={v} onChange={(e) => update({ [k]: e.target.value })}>
        <option value="">—</option>
        {list.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Overview({ s, update, onDelete }: P & { onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const avail = new Set(s.avail ?? []);
  return (
    <>
      <section className="card">
        <h3>Profile</h3>
        <div className="fields">
          <Field s={s} update={update} k="name" label="Name" full />
          <Select s={s} update={update} k="goal" label="Training for" opts={GOALS} />
          <Select s={s} update={update} k="status" label="Status" opts={STATUSES.map((x) => x[0])} />
          <Select s={s} update={update} k="aircraft" label="Aircraft" opts={AIRCRAFT} />
          <Field s={s} update={update} k="stage" label="Stage" />
          <Field s={s} update={update} k="nextLesson" label="Next lesson" />
          <Field s={s} update={update} k="targetPerWeek" label="Target flights / week" type="number" />
          <Field s={s} update={update} k="priorHours" label="Prior hours" type="number" />
          <Field s={s} update={update} k="course" label="Course" />
          <Field s={s} update={update} k="contact" label="Phone" type="tel" />
          <Field s={s} update={update} k="email" label="Email" type="email" />
          <Field s={s} update={update} k="coInstructors" label="Other instructors" full />
          <label className="f">Strengths
            <textarea value={s.strengths ?? ""} onChange={(e) => update({ strengths: e.target.value })} />
          </label>
          <label className="f">Needs work
            <textarea value={s.weaknesses ?? ""} onChange={(e) => update({ weaknesses: e.target.value })} />
          </label>
          <label className="f full">Notes
            <textarea value={s.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
          </label>
        </div>
      </section>
      <section className="card">
        <h3>Usual availability</h3>
        <div className="avail">
          <span />
          {DAYS.map((d) => <span key={d} className="h">{d}</span>)}
          {SLOTS.map(([k, label]) => (
            <div key={k} style={{ display: "contents" }}>
              <span className="l">{k}</span>
              {DAYS.map((d) => {
                const key = d + "-" + k;
                return (
                  <button
                    key={key}
                    className="slot"
                    aria-label={`${d} ${label}`}
                    aria-pressed={avail.has(key)}
                    onClick={() => {
                      const n = new Set(avail);
                      n.has(key) ? n.delete(key) : n.add(key);
                      update({ avail: [...n] });
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <label className="f">Availability notes
          <input value={s.availNotes ?? ""} onChange={(e) => update({ availNotes: e.target.value })} placeholder="e.g. works nights, free after 3 on Fridays" />
        </label>
      </section>
      <div className="row">
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}>Delete student</button>
        ) : (
          <>
            <span className="small">Delete {s.name} and their log? Mock checkrides are kept.</span>
            <button className="btn danger" onClick={onDelete}>Yes, delete</button>
            <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        )}
      </div>
    </>
  );
}

const blankEntry = (regs = ""): LogEntry => ({ id: newId(), kind: "flight", date: todayStr(), tail: "", hrs: "", lesson: "", notes: "", regs });

function Log({ s, update, prefillRegs }: P & { prefillRegs: string }) {
  const [form, setForm] = useState<LogEntry | null>(prefillRegs ? blankEntry(prefillRegs) : null);
  const [editing, setEditing] = useState<string | null>(null);
  const copy = useCopy();
  useEffect(() => {
    if (prefillRegs) setForm(blankEntry(prefillRegs));
  }, [prefillRegs]);
  const log = [...(s.log ?? [])].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const save = (e: LogEntry) => {
    const others = (s.log ?? []).filter((x) => x.id !== e.id);
    update({ log: [...others, e] });
    setForm(null);
    setEditing(null);
  };
  return (
    <>
      {form && !editing ? (
        <EntryForm e={form} onSave={save} onCancel={() => setForm(null)} />
      ) : (
        <div className="row">
          <button className="btn primary" onClick={() => setForm(blankEntry())}>+ Log a lesson</button>
          <Link className="btn" to={`/regs?student=${s.id}`}>Pick regs first</Link>
        </div>
      )}
      <section className="card">
        <h3>Lesson log</h3>
        {log.length === 0 && <div className="muted small">No lessons logged yet.</div>}
        {log.map((e) =>
          editing === e.id ? (
            <EntryForm key={e.id} e={e} onSave={save} onCancel={() => setEditing(null)}
              onDelete={() => { update({ log: (s.log ?? []).filter((x) => x.id !== e.id) }); setEditing(null); }} />
          ) : (
            <div key={e.id} className={"entry " + e.kind}>
              <div className="top">
                <b>
                  {e.kind === "ground" && <span className="pill p-acc">Ground</span>} {e.lesson || (e.kind === "ground" ? "Ground lesson" : "Flight")}
                </b>
                <span className="mono muted">{fmtDate(e.date)}{e.tail ? " · " + e.tail : ""}{e.hrs ? " · " + e.hrs + " hr" : ""}{e.night ? ` (${e.night} night)` : ""}{e.ldgDay || e.ldgNight ? ` · ${e.ldgDay || 0}/${e.ldgNight || 0} ldg` : ""}</span>
              </div>
              {e.notes && <p>{e.notes}</p>}
              {e.regs && <div className="regs">{e.regs}</div>}
              <div className="row">
                <button className="linkbtn" onClick={() => setEditing(e.id)}>Edit</button>
                {e.regs && <button className="linkbtn" onClick={() => copy(e.regs!, "Regs copied")}>Copy regs</button>}
              </div>
            </div>
          ),
        )}
      </section>
    </>
  );
}

function EntryForm({ e, onSave, onCancel, onDelete }: { e: LogEntry; onSave: (e: LogEntry) => void; onCancel: () => void; onDelete?: () => void }) {
  const [f, setF] = useState(e);
  const set = (p: Partial<LogEntry>) => setF({ ...f, ...p });
  return (
    <form className="card" onSubmit={(ev) => { ev.preventDefault(); onSave(f); }}>
      <div className="fields">
        <label className="f">Type
          <select value={f.kind} onChange={(ev) => set({ kind: ev.target.value as LogEntry["kind"] })}>
            <option value="flight">Flight</option>
            <option value="ground">Ground</option>
          </select>
        </label>
        <label className="f">Date<input type="date" value={f.date} onChange={(ev) => set({ date: ev.target.value })} /></label>
        {f.kind === "flight" && (
          <>
            <label className="f">Tail
              <input list="tails" value={f.tail ?? ""} onChange={(ev) => set({ tail: ev.target.value.toUpperCase() })} />
              <datalist id="tails">{TAILS.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="f">Hours<input inputMode="decimal" value={f.hrs ?? ""} onChange={(ev) => set({ hrs: ev.target.value })} /></label>
            <label className="f">Night hrs<input inputMode="decimal" value={f.night ?? ""} onChange={(ev) => set({ night: ev.target.value })} /></label>
            <label className="f">Landings day / night
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input inputMode="numeric" aria-label="Day landings" value={f.ldgDay ?? ""} onChange={(ev) => set({ ldgDay: ev.target.value })} />
                <input inputMode="numeric" aria-label="Night landings" value={f.ldgNight ?? ""} onChange={(ev) => set({ ldgNight: ev.target.value })} />
              </div>
            </label>
          </>
        )}
        <label className="f full">Lesson<input value={f.lesson ?? ""} placeholder="e.g. F5 — The traffic pattern" onChange={(ev) => set({ lesson: ev.target.value })} /></label>
        <label className="f full">Notes / debrief<textarea value={f.notes ?? ""} onChange={(ev) => set({ notes: ev.target.value })} /></label>
        <label className="f full">Regs (from the Reg Logger)<input className="mono" value={f.regs ?? ""} onChange={(ev) => set({ regs: ev.target.value })} /></label>
      </div>
      <div className="row">
        {onDelete && <button type="button" className="btn danger sm" onClick={onDelete}>Delete</button>}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary">Save</button>
      </div>
    </form>
  );
}

function Syllabus({ s, update }: P) {
  const topics = topicsFor(s);
  const covered = new Set(s.covered ?? []);
  const [extra, setExtra] = useState("");
  const done = topics.filter((t) => covered.has(t)).length;
  return (
    <section className="card">
      <div className="row"><h3>{s.goal} syllabus</h3><span className="spacer" /><span className="mono small">{done}/{topics.length}</span></div>
      <Bar value={done} total={topics.length} />
      <div className="checks">
        {topics.map((t) => (
          <label key={t} className={"check" + (covered.has(t) ? " done" : "")}>
            <input type="checkbox" checked={covered.has(t)} onChange={() => {
              const n = new Set(covered);
              n.has(t) ? n.delete(t) : n.add(t);
              update({ covered: [...n] });
            }} />
            <span className="ct"><span>{t}</span></span>
          </label>
        ))}
      </div>
      <form className="row" onSubmit={(e) => {
        e.preventDefault();
        if (extra.trim()) update({ extraTopics: [...(s.extraTopics ?? []), extra.trim()] });
        setExtra("");
      }}>
        <input placeholder="Add a topic for this student…" value={extra} onChange={(e) => setExtra(e.target.value)} style={{ flex: 1 }} />
        <button className="btn">Add</button>
      </form>
    </section>
  );
}

function Ground({ s, update }: P) {
  const g = groundFor(s);
  const done = new Set(s.ground ?? []);
  const toggle = (k: string) => {
    const n = new Set(done);
    n.has(k) ? n.delete(k) : n.add(k);
    update({ ground: [...n] });
  };
  return (
    <section className="list">
      <div className="muted small">{g.area}</div>
      {g.tasks.map((t) => {
        const items = t.i.filter((i) => !i.startsWith("#"));
        const n = items.filter((i) => done.has(groundKey(t.t, i))).length;
        return (
          <details key={t.t} className="fold">
            <summary>
              <span className="code">{t.lab ?? "Task " + t.t}</span>
              <span className="ft">{t.n}</span>
              <span className="mono small muted">{n}/{items.length}</span>
            </summary>
            <div className="fb checks">
              {t.i.map((i) =>
                i.startsWith("#") ? (
                  <div key={i} className="ghead">{i.slice(1)}</div>
                ) : (
                  <label key={i} className={"check" + (done.has(groundKey(t.t, i)) ? " done" : "")}>
                    <input type="checkbox" checked={done.has(groundKey(t.t, i))} onChange={() => toggle(groundKey(t.t, i))} />
                    <span className="ct"><span>{i}</span></span>
                  </label>
                ),
              )}
            </div>
          </details>
        );
      })}
    </section>
  );
}

function Guide({ s, update }: P) {
  const g = guideFor(s);
  if (!g) return <div className="empty">No onboarding guide for {s.goal} yet.</div>;
  const done = s.guide ?? {};
  return (
    <section className="list">
      {g.map((sec) => {
        const n = sec.items.filter((it) => done[sec.id + "." + it[0]]).length;
        return (
          <details key={sec.id} className="fold" open={n < sec.items.length && n > 0}>
            <summary>
              <span className="ft">{sec.n}</span>
              <span className="mono small muted">{n}/{sec.items.length}</span>
            </summary>
            <div className="fb">
              {sec.note && <p className="muted small" style={{ marginTop: 0, fontStyle: "italic" }}>{sec.note}</p>}
              <div className="checks">
                {sec.items.map(([k, label, when]) => {
                  const key = sec.id + "." + k;
                  return (
                    <label key={key} className={"check" + (done[key] ? " done" : "")}>
                      <input type="checkbox" checked={!!done[key]} onChange={() => {
                        const n2 = { ...done };
                        if (n2[key]) delete n2[key];
                        else n2[key] = todayStr();
                        update({ guide: n2 });
                      }} />
                      <span className="ct"><span>{label}</span>{when && <small>Done when: {when}</small>}</span>
                      {done[key] && <span className="when">{fmtDate(done[key])}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
        );
      })}
    </section>
  );
}

function StudentMocks({ s }: { s: Student }) {
  const rides = useCollection<Ride>("rides")
    .filter((r) => r.studentId === s.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!rides.length) return <div className="empty">No mock checkrides yet. Use “+ Mock checkride” above.</div>;
  return (
    <section className="list">
      {rides.map((r) => {
        const c = { S: 0, W: 0, U: 0 };
        Object.values(r.grades).forEach((g) => c[g]++);
        return (
          <Link key={r.id} className="lrow" to={"/mocks/" + r.id}>
            <div className="who">
              <div className="name">{BANKS[r.bank]?.short ?? r.bank} {r.kind.toLowerCase()}</div>
              <div className="sub">{fmtDate(r.date)}{r.examiner ? " · " + r.examiner + " style" : ""}</div>
            </div>
            <div className="row"><span className="gp S">{c.S}</span><span className="gp W">{c.W}</span><span className="gp U">{c.U}</span></div>
            <div>{r.result && <span className="pill p-acc">{r.result}</span>}</div>
          </Link>
        );
      })}
    </section>
  );
}
