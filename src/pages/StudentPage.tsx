import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bar, useCopy } from "../components/ui";
import LessonExtras from "../components/LessonExtras";
import { summarizeStudent } from "../lib/sync";
import { BANKS, bankForGoal } from "../lib/banks";
import {
  AIRCRAFT,
  D87,
  DAYS,
  GOALS,
  OVERDUE_DAYS,
  SLOTS,
  STATUSES,
  TAILS,
  groundFor,
  groundKey,
  PRESOLO,
  coverage,
  guideFor,
  guideKey,
  guideProgress,
  type GuideSection,
  type PresoloLesson,
  statusClass,
  topicsFor,
  totalHours,
} from "../lib/curriculum";
import { create, daysBetween, fmtDate, newId, put, remove, todayStr, useCollection, useRecord } from "../lib/store";
import type { LogEntry, Ride, Student } from "../lib/types";

const TABS = ["Overview", "Log", "Syllabus", "Ground", "Mocks"] as const;
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
          </div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => {
            if (!s.logDraft) update({ logDraft: blankEntry() });
            setTab("Log");
          }}>{s.logDraft ? "Finish lesson draft" : "+ Log a lesson"}</button>
          <Link className="btn" to={`/regs?student=${s.id}`}>Log regs</Link>
          <button
            className="btn"
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

      {tab === "Overview" && <Overview s={s} update={update} goTo={setTab} onDelete={() => { remove("students", s.id); nav("/students"); }} />}
      {tab === "Log" && <Log s={s} update={update} prefillRegs={params.get("regs") ?? ""} />}
      {tab === "Syllabus" && <Syllabus s={s} update={update} />}
      {tab === "Ground" && <Ground s={s} update={update} />}
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

function Overview({ s, update, onDelete, goTo }: P & { onDelete: () => void; goTo: (t: Tab) => void }) {
  const [editing, setEditing] = useState(false);
  const rides = useCollection<Ride>("rides");
  if (editing) return <ProfileEditor s={s} update={update} onDelete={onDelete} onDone={() => setEditing(false)} />;

  const today = todayStr();
  const flights = (s.log ?? []).filter((e) => e.kind !== "ground" && e.date).sort((a, b) => b.date.localeCompare(a.date));
  const last = [...(s.log ?? [])].filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const since = flights[0] ? daysBetween(flights[0].date, today) : null;
  const in30 = flights.filter((e) => daysBetween(e.date, today) <= 30).length;
  const num = (v?: string) => parseFloat(v ?? "") || 0;
  const night = flights.reduce((a, e) => a + num(e.night), 0);
  const ldg = flights.reduce((a, e) => a + num(e.ldgDay) + num(e.ldgNight), 0);
  const plan = guideFor(s);
  const prog = guideProgress(s);
  const topics = topicsFor(s);
  const covered = (s.covered ?? []).filter((t) => topics.includes(t)).length;
  const lastMock = rides.filter((r) => r.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const target = num(s.targetPerWeek);

  return (
    <>
      {s.logDraft && (
        <button className="draftbar" onClick={() => goTo("Log")}>
          <b>Unsaved lesson draft</b>
          <span className="small">{[fmtDate(s.logDraft.date), s.logDraft.lesson, s.logDraft.notes?.slice(0, 60)].filter(Boolean).join(" · ") || "Started"} · Tap to finish</span>
        </button>
      )}

      <section className="stats" aria-label="Summary">
        <div className="stat"><b>{totalHours(s).toFixed(1)}</b><span>Total hours{night ? ` · ${night.toFixed(1)} night` : ""}</span></div>
        <div className={"stat" + (since != null && since >= OVERDUE_DAYS ? " alert" : "")}>
          <b>{since == null ? "—" : since === 0 ? "Today" : since + "d"}</b><span>Since last flight</span>
        </div>
        <div className="stat"><b>{in30}</b><span>Flights · last 30 days{target ? ` (goal ${target}/wk)` : ""}</span></div>
        <div className="stat"><b>{ldg || "—"}</b><span>Landings logged</span></div>
      </section>

      <section className="card">
        <div className="row">
          <h3>Training progress</h3>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => goTo("Syllabus")}>Open syllabus →</button>
        </div>
        {plan ? (
          <>
            <div className="row small"><span>{prog.done} of {prog.total} plan items</span><span className="spacer" /><span className="mono">{prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%</span></div>
            <Bar value={prog.done} total={prog.total} />
            <div className="stagebars">
              {plan.map((sec) => {
                const n = sec.items.filter((it) => s.guide?.[guideKey(sec.id, it[0])]).length;
                return (
                  <div key={sec.id} className="stagebar">
                    <div className="row small"><span className="clamp1">{sec.n}</span><span className="spacer" /><span className="mono muted">{n}/{sec.items.length}</span></div>
                    <Bar value={n} total={sec.items.length} color={n === sec.items.length ? "var(--good)" : undefined} />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="row small"><span>{covered} of {topics.length} maneuvers & topics</span></div>
            <Bar value={covered} total={topics.length} />
          </>
        )}
        <div className="nextup">
          <span className="kv">Next lesson</span>
          <b>{s.nextLesson || prog.next || "Not set"}</b>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h3>Last lesson</h3>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => goTo("Log")}>Full log →</button>
        </div>
        {last ? <LastLesson e={last} /> : <div className="muted small">Nothing logged yet.</div>}
      </section>

      <StrengthsCard s={s} update={update} />

      <section className="card">
        <div className="row">
          <h3>Profile</h3>
          <span className="spacer" />
          <button className="btn sm" onClick={() => setEditing(true)}>Edit profile</button>
        </div>
        <dl className="facts">
          <div><dt>Aircraft</dt><dd>{s.aircraft || "—"}</dd></div>
          <div><dt>Stage</dt><dd>{s.stage || "—"}</dd></div>
          <div><dt>Course</dt><dd>{s.course || "—"}</dd></div>
          <div><dt>Usually free</dt><dd>{availSummary(s)}</dd></div>
          <div><dt>Phone</dt><dd>{s.contact ? <a href={"tel:" + s.contact}>{s.contact}</a> : "—"}</dd></div>
          <div><dt>Email</dt><dd className="wrap">{s.email || "—"}</dd></div>
          {s.coInstructors && <div><dt>Other instructors</dt><dd>{s.coInstructors}</dd></div>}
          {lastMock && <div><dt>Last mock</dt><dd><Link to={"/mocks/" + lastMock.id}>{fmtDate(lastMock.date)} · {BANKS[lastMock.bank]?.short ?? lastMock.bank}{lastMock.result ? " · " + lastMock.result : ""}</Link></dd></div>}
        </dl>
        {s.notes && <p className="small clamp3" style={{ margin: 0 }}>{s.notes}</p>}
      </section>
    </>
  );
}

function StrengthsCard({ s, update }: P) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<{ strengths: string; needsWork: string; lessons: number } | null>(null);
  const hasNotes = (s.log ?? []).some((e) => (e.notes ?? "").trim());
  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      setDraft(await summarizeStudent(s));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <div className="row">
        <h3>Strengths & needs work</h3>
        <span className="spacer" />
        <button className="btn sm" disabled={busy || !hasNotes} onClick={run} title={hasNotes ? "" : "Log a lesson with notes first"}>
          {busy ? "Reading the log…" : "✨ Summarize from log"}
        </button>
      </div>
      {err && <div className="small" style={{ color: "var(--bad)" }}>{err}</div>}
      {draft ? (
        <div className="aisum">
          <div className="small muted">Suggested from {draft.lessons} lesson{draft.lessons === 1 ? "" : "s"}. Check it before saving.</div>
          <div className="sw">
            <label className="f">Strengths<textarea value={draft.strengths} onChange={(e) => setDraft({ ...draft, strengths: e.target.value })} /></label>
            <label className="f">Needs work<textarea value={draft.needsWork} onChange={(e) => setDraft({ ...draft, needsWork: e.target.value })} /></label>
          </div>
          <div className="row">
            <span className="spacer" />
            <button className="btn" onClick={() => setDraft(null)}>Keep current</button>
            <button className="btn primary" onClick={() => {
              update({ strengths: draft.strengths, weaknesses: draft.needsWork, summaryAt: todayStr() });
              setDraft(null);
            }}>Use these</button>
          </div>
        </div>
      ) : (
        <>
          <div className="sw">
            <div><span className="kv">Strengths</span><p className="clamp3">{s.strengths || <span className="muted">Not written yet</span>}</p></div>
            <div><span className="kv">Needs work</span><p className="clamp3">{s.weaknesses || <span className="muted">Not written yet</span>}</p></div>
          </div>
          {s.summaryAt && <div className="small muted">From AI summary {fmtDate(s.summaryAt)} · edit any time under Edit profile</div>}
        </>
      )}
    </section>
  );
}

function LastLesson({ e }: { e: LogEntry }) {
  const [more, setMore] = useState(false);
  const facts = [fmtDate(e.date), e.kind === "ground" ? "Ground" : e.tail, e.hrs && e.hrs + " hr", e.night && e.night + " night",
    (e.ldgDay || e.ldgNight) && `${e.ldgDay || 0}/${e.ldgNight || 0} ldg`].filter(Boolean);
  const long = (e.notes ?? "").length > 220;
  return (
    <div className="lastlesson">
      <div className="mono small muted">{facts.join(" · ")}</div>
      {e.lesson && <b>{e.lesson}</b>}
      {e.notes && <p className={more ? "" : "clamp3"}>{e.notes}</p>}
      {long && <button className="linkbtn" onClick={() => setMore(!more)}>{more ? "Show less" : "Show more"}</button>}
      {e.regs && <div className="regs">{e.regs}</div>}
    </div>
  );
}

function availSummary(s: Student) {
  const a = new Set(s.avail ?? []);
  const note = s.availNotes ? " · " + s.availNotes : "";
  if (!a.size) return (s.availNotes || "Not set");
  if (a.size === DAYS.length * SLOTS.length) return "Anytime" + note;
  const days = DAYS.map((d) => {
    const sl = SLOTS.filter(([k]) => a.has(d + "-" + k)).map(([k]) => k);
    return sl.length ? (sl.length === SLOTS.length ? d : `${d} ${sl.join("/")}`) : "";
  }).filter(Boolean);
  return days.join(", ") + note;
}

function ProfileEditor({ s, update, onDelete, onDone }: P & { onDelete: () => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const avail = new Set(s.avail ?? []);
  return (
    <>
      <div className="row">
        <h2>Edit profile</h2>
        <span className="spacer" />
        <span className="small savednote">✓ Saves as you type</span>
        <button className="btn primary" onClick={onDone}>Done</button>
      </div>
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
const isBlank = (e: LogEntry) => !["tail", "hrs", "night", "ldgDay", "ldgNight", "lesson", "notes", "regs"].some((k) => String(e[k as keyof LogEntry] ?? "").trim());

// Everything typed here is written to the student record on each change (local storage first, then sync),
// so a dead phone or closed app never loses it. A draft only goes away by saving it to the log or discarding it.
function Log({ s, update, prefillRegs }: P & { prefillRegs: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [, setParams] = useSearchParams();
  const copy = useCopy();
  const draft = s.logDraft;

  // Regs sent from the Reg Logger: add them to the draft once, then drop them from the URL.
  useEffect(() => {
    if (!prefillRegs) return;
    const d = s.logDraft ?? blankEntry();
    const regs = d.regs ? (d.regs.includes(prefillRegs) ? d.regs : d.regs + "; " + prefillRegs) : prefillRegs;
    update({ logDraft: { ...d, regs } });
    setParams({ tab: "Log" }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillRegs]);

  const log = [...(s.log ?? [])].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const patchEntry = (id: string, p: Partial<LogEntry>) =>
    update({ log: (s.log ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)) });

  return (
    <>
      {draft ? (
        <EntryForm
          e={draft}
          title="New lesson"
          onChange={(p) => update({ logDraft: { ...draft, ...p } })}
          primary={{ label: "Save to log", run: () => update({ log: [...(s.log ?? []), draft], logDraft: undefined }) }}
          remove={{ label: "Discard draft", confirm: "Discard this draft? What you typed will be deleted.", run: () => update({ logDraft: undefined }), skipConfirm: isBlank(draft) }}
          note="Draft saved automatically. It stays here until you save it to the log or discard it."
        />
      ) : (
        <div className="row">
          <button className="btn primary" onClick={() => update({ logDraft: blankEntry() })}>+ Log a lesson</button>
          <Link className="btn" to={`/regs?student=${s.id}`}>Pick regs first</Link>
        </div>
      )}
      <section className="card">
        <h3>Lesson log</h3>
        {log.length === 0 && <div className="muted small">No lessons logged yet.</div>}
        {log.map((e) =>
          editing === e.id ? (
            <EntryForm
              key={e.id}
              e={e}
              title="Edit lesson"
              onChange={(p) => patchEntry(e.id, p)}
              primary={{ label: "Done", run: () => setEditing(null) }}
              remove={{ label: "Delete", confirm: "Delete this lesson from the log?", run: () => { update({ log: (s.log ?? []).filter((x) => x.id !== e.id) }); setEditing(null); } }}
              note="Changes save as you type."
            />
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

function EntryForm({ e, title, onChange, primary, remove, note }: {
  e: LogEntry;
  title: string;
  onChange: (p: Partial<LogEntry>) => void;
  primary: { label: string; run: () => void };
  remove: { label: string; confirm: string; run: () => void; skipConfirm?: boolean };
  note: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const set = onChange;
  return (
    <form className="card" onSubmit={(ev) => ev.preventDefault()}>
      <div className="row"><h3>{title}</h3><span className="spacer" /><span className="small savednote">✓ Saved</span></div>
      <div className="fields">
        <label className="f">Type
          <select value={e.kind} onChange={(ev) => set({ kind: ev.target.value as LogEntry["kind"] })}>
            <option value="flight">Flight</option>
            <option value="ground">Ground</option>
          </select>
        </label>
        <label className="f">Date<input type="date" value={e.date} onChange={(ev) => set({ date: ev.target.value })} /></label>
        {e.kind === "flight" && (
          <>
            <label className="f">Tail
              <input list="tails" value={e.tail ?? ""} onChange={(ev) => set({ tail: ev.target.value.toUpperCase() })} />
              <datalist id="tails">{TAILS.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="f">Hours<input inputMode="decimal" value={e.hrs ?? ""} onChange={(ev) => set({ hrs: ev.target.value })} /></label>
            <label className="f">Night hrs<input inputMode="decimal" value={e.night ?? ""} onChange={(ev) => set({ night: ev.target.value })} /></label>
            <label className="f">Landings day / night
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input inputMode="numeric" aria-label="Day landings" value={e.ldgDay ?? ""} onChange={(ev) => set({ ldgDay: ev.target.value })} />
                <input inputMode="numeric" aria-label="Night landings" value={e.ldgNight ?? ""} onChange={(ev) => set({ ldgNight: ev.target.value })} />
              </div>
            </label>
          </>
        )}
        <label className="f full">Lesson<input value={e.lesson ?? ""} placeholder="e.g. F5 — The traffic pattern" onChange={(ev) => set({ lesson: ev.target.value })} /></label>
        <label className="f full">Notes / debrief<textarea style={{ minHeight: 140 }} value={e.notes ?? ""} onChange={(ev) => set({ notes: ev.target.value })} /></label>
        <label className="f full">Regs (from the Reg Logger)<input className="mono" value={e.regs ?? ""} onChange={(ev) => set({ regs: ev.target.value })} /></label>
      </div>
      <div className="small muted">{note}</div>
      {confirming ? (
        <div key="confirm" className="row confirmbar">
          <span className="small">{remove.confirm}</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => setConfirming(false)}>Keep it</button>
          <button type="button" className="btn danger" onClick={() => { setConfirming(false); remove.run(); }}>{remove.label}</button>
        </div>
      ) : (
        <div key="actions" className="row">
          <button type="button" className="btn danger sm" onClick={() => (remove.skipConfirm ? remove.run() : setConfirming(true))}>{remove.label}</button>
          <span className="spacer" />
          <button type="button" className="btn primary" onClick={primary.run}>{primary.label}</button>
        </div>
      )}
    </form>
  );
}

function Syllabus({ s, update }: P) {
  const plan = guideFor(s);
  const g = s.guide ?? {};
  const toggle = (key: string) => {
    const n = { ...g };
    if (n[key]) delete n[key];
    else n[key] = todayStr();
    update({ guide: n });
  };
  const prog = guideProgress(s);
  return (
    <section className="list">
      {plan ? (
        <>
          <div className="card">
            <div className="row">
              <h3>Training plan</h3>
              <span className="spacer" />
              <span className="mono small">{prog.done}/{prog.total}</span>
            </div>
            <Bar value={prog.done} total={prog.total} />
            {prog.next && <div className="small">Next lesson: <b>{prog.next}</b></div>}
          </div>
          {plan.map((sec) => {
            const n = sec.items.filter((it) => g[guideKey(sec.id, it[0])]).length;
            const full = n === sec.items.length;
            return (
              <details key={sec.id} className="fold stage" open={!full && (n > 0 || sec.id === firstOpen(plan, g))}>
                <summary>
                  <span className="ft">{sec.n}</span>
                  <span className={"mono small " + (full ? "pill p-good" : "muted")}>{n}/{sec.items.length}</span>
                </summary>
                <div className="fb">
                  {sec.note && <p className="secnote">{sec.note}</p>}
                  {sec.id === "s1" && <Coverage guide={g} />}
                  <div className="checks">
                    {sec.items.map((it) => {
                      const key = guideKey(sec.id, it[0]);
                      const L = sec.id === "s1" ? PRESOLO[it[0]] : undefined;
                      return L ? (
                        <Lesson key={key} k={key} label={it[1]} when={it[2]} L={L} g={g} toggle={toggle} />
                      ) : (
                        <CheckRow key={key} label={it[1]} when={it[2]} date={g[key]} onToggle={() => toggle(key)} />
                      );
                    })}
                  </div>
                  <details className="fold sub">
                    <summary><span className="ft small">Stage videos & resources</span></summary>
                    <div className="fb"><LessonExtras k={"guide-" + sec.id} /></div>
                  </details>
                </div>
              </details>
            );
          })}
        </>
      ) : (
        <div className="empty">There's no stage plan for {s.goal} yet. Use the maneuver checklist below.</div>
      )}
      <Topics s={s} update={update} open={!plan} />
    </section>
  );
}

function firstOpen(plan: GuideSection[], g: Record<string, string>) {
  return plan.find((sec) => sec.items.some((it) => !g[guideKey(sec.id, it[0])]))?.id;
}

function CheckRow({ label, when, date, onToggle, strong }: { label: string; when?: string; date?: string; onToggle: () => void; strong?: boolean }) {
  return (
    <label className={"check" + (date ? " done" : "")}>
      <input type="checkbox" checked={!!date} onChange={onToggle} />
      <span className="ct">
        <span style={strong ? { fontWeight: 600 } : undefined}>{label}</span>
        {when && <small>Done when: {when}</small>}
      </span>
      {date && <span className="when">{fmtDate(date)}</span>}
    </label>
  );
}

function Lesson({ k, label, when, L, g, toggle }: {
  k: string; label: string; when?: string; L: PresoloLesson; g: Record<string, string>; toggle: (key: string) => void;
}) {
  const nd = L.sub.filter((_, i) => g[k + "." + (i + 1)]).length;
  const done = g[k];
  return (
    <details className="lesson">
      <summary>
        <span className="lcode">{label.split(" — ")[0]}</span>
        <span className={"ln" + (done ? " ldone" : "")}>{label.split(" — ").slice(1).join(" — ") || label}</span>
        <span className="mono small muted">{nd}/{L.sub.length}</span>
        {done && <span className="when">{fmtDate(done)}</span>}
      </summary>
      <div className="lbody">
        <p className="secnote"><b>{L.time}</b>{L.scen ? " · " + L.scen : ""}</p>
        <div className="checks">
          {L.sub.map((sub, i) => {
            const sk = k + "." + (i + 1);
            return (
              <label key={sk} className={"check" + (g[sk] ? " done" : "")}>
                <input type="checkbox" checked={!!g[sk]} onChange={() => toggle(sk)} />
                <span className="ct"><span>{sub[0]}</span></span>
                {sub[1] && <span className="tag" title="61.87(d) solo endorsement items">{sub[1].split(",").map((x) => "d" + x).join(" ")}</span>}
                {sub[2] && <span className="tag bsc" title="Blitz first-solo stage check items">SC {sub[2].replace(/,/g, " ")}</span>}
              </label>
            );
          })}
        </div>
        {L.take && <p className="take">Student takes over: <b>{L.take}</b></p>}
        <LessonExtras k={k} />
        <div className="checks lessondone">
          <CheckRow label="Lesson complete" when={when} date={done} onToggle={() => toggle(k)} strong />
        </div>
      </div>
    </details>
  );
}

function Coverage({ guide }: { guide: Record<string, string> }) {
  const { d87, stage } = coverage(guide);
  const bd = stage.reduce((a, x) => a + x.d, 0), bt = stage.reduce((a, x) => a + x.cnt, 0);
  return (
    <div className="cov">
      <div className="kv">61.87(d) solo endorsement items covered · <b className="mono">{D87.filter((_, i) => d87.has(i + 1)).length}/{D87.length}</b></div>
      <div className="covg">
        {D87.map((t, i) => <span key={i} className={"cv" + (d87.has(i + 1) ? " on" : "")}>({i + 1}) {t}</span>)}
      </div>
      <div className="kv">Blitz first solo stage check items covered · <b className="mono">{bd}/{bt}</b></div>
      <div className="covg">
        {stage.map((x, i) => (
          <span key={i} className={"cv" + (x.d === x.cnt ? " on" : x.d ? " part" : "")}>{i + 1}. {x.n} <span className="mono">{x.d}/{x.cnt}</span></span>
        ))}
      </div>
    </div>
  );
}

function Topics({ s, update, open }: P & { open: boolean }) {
  const topics = topicsFor(s);
  const covered = new Set(s.covered ?? []);
  const [extra, setExtra] = useState("");
  const done = topics.filter((t) => covered.has(t)).length;
  return (
    <details className="fold" open={open}>
      <summary>
        <span className="ft">Maneuver checklist</span>
        <span className="mono small muted">{done}/{topics.length}</span>
      </summary>
      <div className="fb">
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
        <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => {
          e.preventDefault();
          if (extra.trim()) update({ extraTopics: [...(s.extraTopics ?? []), extra.trim()] });
          setExtra("");
        }}>
          <input placeholder="Add a topic for this student…" value={extra} onChange={(e) => setExtra(e.target.value)} style={{ flex: 1 }} />
          <button className="btn">Add</button>
        </form>
      </div>
    </details>
  );
}

function Ground({ s, update }: P) {
  const g = groundFor(s);
  const prefix = "gr-" + (s.goal === "Instrument" || s.goal === "CFII" ? "ir" : s.goal === "CFI" ? "cfi" : "ppl") + "-";
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
            <div className="fb">
              <div className="checks">
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
              <LessonExtras k={prefix + t.t} />
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
