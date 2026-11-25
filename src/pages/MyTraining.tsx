import { useState } from "react";
import { Link } from "react-router-dom";
import BriefingCard from "../components/BriefingCard";
import { Bar, useCopy } from "../components/ui";
import { planProgress, type StudentCard } from "../lib/card";
import { fmtDate } from "../lib/store";
import { MARK_LABEL } from "../lib/curriculum";
import { loadMyCards, syncConfigured, useMyCards, useSync } from "../lib/sync";

export default function MyTraining() {
  const sync = useSync();
  const { cards, loaded, error } = useMyCards();
  const [pick, setPick] = useState(0);

  if (!cards.length && (!syncConfigured || !sync.session)) {
    return (
      <div className="page">
        <h1>My training</h1>
        <div className="card small">
          Sign in under <Link to="/settings">Settings</Link> with the email your instructor has on file to see your training.
        </div>
      </div>
    );
  }
  if (!cards.length) {
    return (
      <div className="page">
        <h1>My training</h1>
        <div className="card small">
          {loaded ? (
            <>
              Nothing has been shared with <b>{sync.session?.user.email}</b> yet. Ask your instructor to turn on student access for this email.
              {error && <div style={{ color: "var(--bad)" }}>{error}</div>}
            </>
          ) : "Loading…"}
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => loadMyCards()}>Check again</button></div>
        </div>
      </div>
    );
  }
  const c = cards[Math.min(pick, cards.length - 1)];
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{c.goal}{c.instructor ? ` · with ${c.instructor}` : ""}</div>
          <h1>{c.name}</h1>
        </div>
        {cards.length > 1 && (
          <select value={pick} onChange={(e) => setPick(+e.target.value)} style={{ width: "auto" }} aria-label="Training record">
            {cards.map((x, i) => <option key={i} value={i}>{x.goal}{x.instructor ? ` (${x.instructor})` : ""}</option>)}
          </select>
        )}
      </header>
      <CardView c={c} />
      <div className="small muted">Updated {new Date(c.updated).toLocaleString()} · <button className="linkbtn" onClick={() => loadMyCards()}>Refresh</button></div>
    </div>
  );
}

function CardView({ c }: { c: StudentCard }) {
  const prog = planProgress(c);
  const topicsDone = c.topics.filter((t) => t.done).length;
  return (
    <>
      <section className="stats" aria-label="Summary">
        <div className="stat"><b>{c.stats.hours.toFixed(1)}</b><span>Total hours{c.stats.night ? ` · ${c.stats.night} night` : ""}</span></div>
        <div className="stat"><b>{c.stats.lastFlight ? fmtDate(c.stats.lastFlight) : "—"}</b><span>Last flight</span></div>
        <div className="stat"><b>{c.stats.flights30}</b><span>Flights · last 30 days</span></div>
        <div className="stat"><b>{c.stats.landings || "—"}</b><span>Landings logged</span></div>
      </section>

      {c.briefing && <BriefingCard b={c.briefing} />}

      {c.hours && (
        <section className="card">
          <div className="row">
            <h3>Hours toward checkride</h3>
            <span className="spacer" />
            <span className="pill p-mute">{c.hours.rows.filter((r) => r.met).length}/{c.hours.rows.length} met</span>
          </div>
          <div className="small muted">{c.hours.title}. Your instructor confirms these from your logbook.</div>
          <div className="hreqs">
            {c.hours.rows.map((r) => (
              <div key={r.label} className={"hreq" + (r.met ? " met" : "")}>
                <span className="hmark" aria-hidden="true">{r.met ? "✓" : ""}</span>
                <span className="hlabel">{r.label}<small className="mono">{r.ref}</small></span>
                {r.unit === "flag" ? <span className="small muted">{r.met ? "Done" : "Not yet"}</span> : (
                  <span className="hval">
                    <span className="mono small">{r.have.toFixed(r.unit === "ldg" ? 0 : 1)} / {r.need}{r.unit === "ldg" ? "" : " hr"}</span>
                    <span className="bar"><i style={{ width: Math.min(100, (r.have / r.need) * 100) + "%", background: r.met ? "var(--good)" : undefined }} /></span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3>Training progress</h3>
        {c.plan ? (
          <>
            <div className="row small"><span>{prog.done} of {prog.total} plan items</span><span className="spacer" /><span className="mono">{prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%</span></div>
            <Bar value={prog.done} total={prog.total} />
            {c.plan.map((sec) => {
              const n = sec.items.filter((i) => i.done).length;
              return (
                <details key={sec.n} className="fold">
                  <summary><span className="ft">{sec.n}</span><span className="mono small muted">{n}/{sec.items.length}</span></summary>
                  <div className="fb checks">
                    {sec.note && <p className="secnote">{sec.note}</p>}
                    {sec.items.map((it, i) => (
                      <div key={i} className={"check" + (it.mark ? " mrow m" + it.mark : "")}>
                        {it.mark ? <span className={"mdot big " + it.mark} title={MARK_LABEL[it.mark]} /> : <span className="mk" aria-hidden="true" />}
                        <span className="ct"><span>{it.label}</span>{it.when && <small>Done when: {it.when}</small>}</span>
                        {it.done && <span className="when">{fmtDate(it.done)}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </>
        ) : (
          <>
            <div className="row small"><span>{topicsDone} of {c.topics.length} maneuvers checkride ready</span></div>
            <Bar value={topicsDone} total={c.topics.length} />
            <div className="checks">
              {c.topics.map((t) => (
                <div key={t.t} className={"check" + (t.mark ? " mrow m" + t.mark : "")}>
                  {t.mark ? <span className={"mdot big " + t.mark} title={MARK_LABEL[t.mark]} /> : <span className="mk" aria-hidden="true" />}
                  <span className="ct"><span>{t.t}</span>{t.mark && <small>{MARK_LABEL[t.mark]}</small>}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {(c.skills.strengths.length + c.skills.needsWork.length + c.skills.improving.length > 0 || c.mock) && (
        <section className="card">
          <h3>Strengths & needs work</h3>
          <div className="sw">
            <div>
              <span className="kv">Strengths</span>
              {c.skills.strengths.length ? c.skills.strengths.map((x) => <div key={x} className="skrow good"><span>{x}</span></div>) : <span className="small muted">Building up</span>}
              {c.skills.improving.length > 0 && <><span className="kv" style={{ marginTop: 6 }}>Improving</span>{c.skills.improving.map((x) => <div key={x} className="skrow imp"><span>{x}</span></div>)}</>}
            </div>
            <div>
              <span className="kv">Keep working on</span>
              {c.skills.needsWork.length ? c.skills.needsWork.map((x) => <div key={x} className="skrow work"><span>{x}</span></div>) : <span className="small muted">Nothing flagged right now</span>}
            </div>
          </div>
          {c.mock && (
            <div className="mocksum">
              <span className="kv">{c.mock.bank} mock checkride {fmtDate(c.mock.date)}{c.mock.result ? ` · ${c.mock.result}` : ""}</span>
              {c.mock.weak.length > 0 && <div className="small"><b>Review:</b> {c.mock.weak.join(" · ")}</div>}
              {c.mock.solid.length > 0 && <div className="small"><b>Solid:</b> {c.mock.solid.join(" · ")}</div>}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h3>Lessons</h3>
        {c.log.length === 0 && <div className="small muted">No lessons yet.</div>}
        {c.log.map((e, i) => <LessonRow key={i} e={e} />)}
      </section>
    </>
  );
}

function LessonRow({ e }: { e: StudentCard["log"][number] }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const ratings = Object.entries(e.ratings ?? {});
  const body = e.text || e.notes;
  return (
    <div className={"entry " + e.kind}>
      <div className="top">
        <b>{e.kind === "ground" && <span className="pill p-acc">Ground</span>} {e.lesson || (e.kind === "ground" ? "Ground lesson" : "Flight")}</b>
        <span className="mono muted">{fmtDate(e.date)}{e.tail ? " · " + e.tail : ""}{e.hrs ? " · " + e.hrs + " hr" : ""}</span>
      </div>
      {ratings.length > 0 && (
        <div className="ratedlist">{ratings.map(([k, r]) => <span key={k} className={"rated " + r}>{r === "good" ? "✓" : "✗"} {k}</span>)}</div>
      )}
      {body && (
        <>
          <p className={open ? "" : "clamp3"}>{body}</p>
          <div className="row">
            {body.length > 200 && <button className="linkbtn" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show more"}</button>}
            {e.text && <button className="linkbtn" onClick={() => copy(e.text!, "Copied")}>Copy</button>}
          </div>
        </>
      )}
    </div>
  );
}
