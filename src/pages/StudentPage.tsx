import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bar, useCopy } from "../components/ui";
import LessonExtras from "../components/LessonExtras";
import { mockSummary, skillSummary, type SkillStat } from "../lib/skills";
import { claudePrompt, firstName, smsHref, studentText } from "../lib/studentText";
import BriefingCard from "../components/BriefingCard";
import { useSync } from "../lib/sync";
import { buildBriefing, briefingText } from "../lib/briefing";
import { BANKS, bankForGoal } from "../lib/banks";
import {
  AIRCRAFT,
  D87,
  GOALS,
  OVERDUE_DAYS,
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
  const copy = useCopy();
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
  const brief = buildBriefing(s);

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

      {brief && (
        <BriefingCard b={brief} actions={<button className="btn ghost sm" onClick={() => copy(briefingText(brief, firstName(s.name)), "Briefing copied")}>Copy for {firstName(s.name)}</button>} />
      )}

      <section className="card">
        <div className="row">
          <h3>Last lesson</h3>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => goTo("Log")}>Full log →</button>
        </div>
        {last ? <LastLesson e={last} /> : <div className="muted small">Nothing logged yet.</div>}
      </section>

      <StrengthsCard s={s} goTo={goTo} />

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

function StudentTextBox({ s, e, onText }: { s: Student; e: LogEntry; onText: (t: string | undefined) => void }) {
  const copy = useCopy();
  const hasNotes = !!(e.notes ?? "").trim() || Object.keys(e.ratings ?? {}).length > 0;
  return (
    <div className="full txtbox">
      <div className="row">
        <b className="small">Text for {firstName(s.name)}</b>
        <span className="spacer" />
        <button type="button" className="btn sm" disabled={!hasNotes} title={hasNotes ? "" : "Write notes or rate skills first"}
          onClick={() => onText(studentText(s, e))}>{e.text ? "Redo from notes" : "Make student text"}</button>
      </div>
      {e.text !== undefined && (
        <>
          <textarea value={e.text} onChange={(ev) => onText(ev.target.value)} aria-label={`Text for ${firstName(s.name)}`} />
          <div className="row">
            <button type="button" className="btn primary sm" onClick={() => copy(e.text ?? "", "Text copied")}>Copy text</button>
            {s.contact && <a className="btn sm" href={smsHref(s.contact, e.text ?? "")}>Open in Messages</a>}
            <span className="spacer" />
            <button type="button" className="btn ghost sm" onClick={() => onText(undefined)}>Remove text</button>
          </div>
        </>
      )}
      <div className="small muted">
        Want it rewritten with chair-fly steps?{" "}
        <button type="button" className="linkbtn" disabled={!hasNotes} onClick={() => copy(claudePrompt(s, e), "Copied. Paste into the Claude app")}>Copy for Claude</button>
        , paste into the Claude app, then paste its reply back in here.
      </div>
    </div>
  );
}

function StudentAccess({ s, update }: P) {
  const copy = useCopy();
  const sync = useSync();
  const appUrl = window.location.origin + window.location.pathname;
  const email = (s.email ?? "").trim();
  const invite = `Hi ${firstName(s.name)}! You can follow your flight training in my app: progress, your next lesson's plan and homework, and my notes after each flight.\n\n1. Open ${appUrl}\n2. Settings → Create an account with this email: ${email}\n3. Confirm the email, sign in, and tap My training.\n\nOn iPhone: Share → Add to Home Screen to keep it like an app.`;
  return (
    <section className="card">
      <h3>Student access</h3>
      <p className="small muted" style={{ margin: 0 }}>
        Lets {firstName(s.name)} sign in to this app and see a read-only page of their own training: progress, the next lesson briefing, homework, ratings and the texts you made. Your phone, availability and private notes stay hidden.
      </p>
      <label className="check">
        <input type="checkbox" checked={!!s.shareWithStudent} onChange={() => update({ shareWithStudent: !s.shareWithStudent })} />
        <span className="ct"><span>Share with {firstName(s.name)}</span><small>{email ? `They sign in with ${email}` : "Add their email above first"}</small></span>
      </label>
      {s.shareWithStudent && (
        <>
          <label className="check">
            <input type="checkbox" checked={!!s.shareNotes} onChange={() => update({ shareNotes: !s.shareNotes })} />
            <span className="ct"><span>Also show my raw lesson notes</span><small>Off: they see only the student texts you made</small></span>
          </label>
          {!email && <div className="small" style={{ color: "var(--warn)" }}>Nothing is shared until there's an email on this profile.</div>}
          {!sync.session && <div className="small" style={{ color: "var(--warn)" }}>Sign in under Settings so the app can publish this.</div>}
          {email && <div className="row"><button className="btn sm" onClick={() => copy(invite, "Invite copied")}>Copy invite text</button></div>}
        </>
      )}
    </section>
  );
}

function SkillRater({ skills, ratings, onChange }: { skills: string[]; ratings: Record<string, "good" | "work">; onChange: (r: Record<string, "good" | "work">) => void }) {
  const n = Object.keys(ratings).length;
  const cycle = (k: string) => {
    const next = { ...ratings };
    if (!next[k]) next[k] = "good";
    else if (next[k] === "good") next[k] = "work";
    else delete next[k];
    onChange(next);
  };
  const extra = Object.keys(ratings).filter((k) => !skills.includes(k));
  return (
    <details className="fold full rater" open>
      <summary>
        <span className="ft">How did it go?</span>
        {n > 0 && <span className="small muted">{n} rated</span>}
      </summary>
      <div className="fb">
        <p className="small muted" style={{ margin: "0 0 8px" }}>Tap once for ✓ good, twice for ✗ needs work, a third time to clear.</p>
        {skills.length + extra.length === 0 ? (
          <div className="small muted">No skills for this rating yet. Add some under Syllabus → Maneuver checklist.</div>
        ) : (
          <div className="ratechips">
            {[...skills, ...extra].map((k) => (
              <button key={k} type="button" className={"ratechip " + (ratings[k] ?? "")} aria-label={`${k}: ${ratings[k] === "good" ? "good" : ratings[k] === "work" ? "needs work" : "not rated"}`} onClick={() => cycle(k)}>
                <span className="mark" aria-hidden="true">{ratings[k] === "good" ? "✓" : ratings[k] === "work" ? "✗" : ""}</span>
                {k}
              </button>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function RatingChips({ ratings }: { ratings?: Record<string, "good" | "work"> }) {
  const list = Object.entries(ratings ?? {});
  if (!list.length) return null;
  list.sort((a, b) => (a[1] === b[1] ? 0 : a[1] === "work" ? -1 : 1));
  return (
    <div className="ratedlist">
      {list.map(([k, r]) => <span key={k} className={"rated " + r}>{r === "good" ? "✓" : "✗"} {k}</span>)}
    </div>
  );
}

function StrengthsCard({ s, goTo }: { s: Student; goTo: (t: Tab) => void }) {
  const rides = useCollection<Ride>("rides");
  const sk = skillSummary(s);
  const mock = mockSummary(rides, s.id);
  const evid = (x: SkillStat) => x.latest === "work" ? `✗ ${fmtDate(x.lastDate)}` : `✓ ${x.good} of last ${x.good + x.work}`;
  const empty = !sk.ratedLessons && !mock;
  return (
    <section className="card">
      <div className="row">
        <h3>Strengths & needs work</h3>
        <span className="spacer" />
        <span className="small muted">{sk.ratedLessons ? `From ${sk.ratedLessons} rated lesson${sk.ratedLessons === 1 ? "" : "s"}` : ""}</span>
      </div>
      {empty && (
        <div className="small muted">
          Fills in automatically. When you log a lesson, tap ✓ or ✗ on the skills you covered under “How did it go?”. Mock checkride grades count too.
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => goTo("Log")}>Go to the log</button></div>
        </div>
      )}
      {sk.ratedLessons > 0 && (
        <div className="sw">
          <div>
            <span className="kv">Strengths</span>
            {sk.strengths.length ? sk.strengths.slice(0, 6).map((x) => <div key={x.skill} className="skrow good"><span>{x.skill}</span><span className="mono">{evid(x)}</span></div>) : <span className="small muted">None consistent yet</span>}
            {sk.improving.length > 0 && <>
              <span className="kv" style={{ marginTop: 6 }}>Improving</span>
              {sk.improving.slice(0, 4).map((x) => <div key={x.skill} className="skrow imp"><span>{x.skill}</span><span className="mono">✓ {fmtDate(x.lastDate)}, ✗ before</span></div>)}
            </>}
          </div>
          <div>
            <span className="kv">Needs work</span>
            {sk.needsWork.length ? sk.needsWork.slice(0, 6).map((x) => <div key={x.skill} className="skrow work"><span>{x.skill}</span><span className="mono">{evid(x)}{x.work > 1 ? ` · ${x.work}×` : ""}</span></div>) : <span className="small muted">Nothing marked ✗ on the latest lessons</span>}
          </div>
        </div>
      )}
      {mock && (mock.weak.length > 0 || mock.solid.length > 0) && (
        <div className="mocksum">
          <span className="kv">From the {mock.bankShort} mock {fmtDate(mock.ride.date)} · <Link to={"/mocks/" + mock.ride.id}>open</Link></span>
          {mock.weak.length > 0 && <div className="small"><b>Weak:</b> {mock.weak.map((w) => `${w.topic} (${[w.u && w.u + " U", w.w && w.w + " W"].filter(Boolean).join(", ")})`).join(" · ")}</div>}
          {mock.solid.length > 0 && <div className="small"><b>Solid:</b> {mock.solid.map((x) => x.topic).join(" · ")}</div>}
        </div>
      )}
      {(s.strengths || s.weaknesses) && (
        <details className="fold sub">
          <summary><span className="ft small">Your written notes</span></summary>
          <div className="fb small">
            {s.strengths && <p style={{ margin: "0 0 6px" }}><b>Strengths:</b> {s.strengths}</p>}
            {s.weaknesses && <p style={{ margin: 0 }}><b>Needs work:</b> {s.weaknesses}</p>}
          </div>
        </details>
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

function ProfileEditor({ s, update, onDelete, onDone }: P & { onDelete: () => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
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
        <h3>Solo limitations</h3>
        <p className="small muted" style={{ margin: 0 }}>The written limits on their solo endorsement. The Weather page checks these against the current METAR. Leave blank for no limit.</p>
        <div className="fields">
          {([["maxWind", "Max wind (kt)"], ["maxGust", "Max gust (kt)"], ["maxXwind", "Max crosswind (kt)"], ["minCeiling", "Min ceiling (ft AGL)"], ["minVis", "Min visibility (SM)"]] as const).map(([k, label]) => (
            <label key={k} className="f">{label}
              <input inputMode="decimal" value={s.solo?.[k] ?? ""} onChange={(e) => update({ solo: { ...s.solo, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
      </section>
      <StudentAccess s={s} update={update} />
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
          student={s}
          skills={topicsFor(s)}
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
              student={s}
              skills={topicsFor(s)}
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
              <RatingChips ratings={e.ratings} />
              {e.regs && <div className="regs">{e.regs}</div>}
              <div className="row">
                <button className="linkbtn" onClick={() => setEditing(e.id)}>Edit</button>
                {e.regs && <button className="linkbtn" onClick={() => copy(e.regs!, "Regs copied")}>Copy regs</button>}
                {e.text && <button className="linkbtn" onClick={() => copy(e.text!, "Student text copied")}>Copy student text</button>}
              </div>
            </div>
          ),
        )}
      </section>
    </>
  );
}

function EntryForm({ e, student, skills, title, onChange, primary, remove, note }: {
  e: LogEntry;
  student: Student;
  skills: string[];
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
        <SkillRater skills={skills} ratings={e.ratings ?? {}} onChange={(ratings) => set({ ratings })} />
        <StudentTextBox s={student} e={e} onText={(text) => set({ text })} />
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
