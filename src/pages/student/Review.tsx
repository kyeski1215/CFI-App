// Student side, second tab: go back over debriefs, see what to work on, and follow up with questions.
import { useState } from "react";
import { useCopy } from "../../components/ui";
import { markReviewed, useActivity } from "../../lib/activity";
import { logKey, type StudentCard } from "../../lib/card";
import { fmtDate } from "../../lib/store";
import { AskSheet, StudentGate, instructorName } from "./shared";

export default function Review() {
  return <StudentGate title="Review">{(c) => <ReviewBody c={c} />}</StudentGate>;
}

type Entry = StudentCard["log"][number];

function ReviewBody({ c }: { c: StudentCard }) {
  const { act, update } = useActivity(c);
  const [tab, setTab] = useState<"Debriefs" | "Work on" | "Questions">("Debriefs");
  const [ask, setAsk] = useState<string | null>(null);
  const entries = c.log.filter((e) => e.text || e.notes || (e.ratings && Object.keys(e.ratings).length));
  const toReview = entries.filter((e) => !act.reviewed?.[logKey(e)]).length;
  const qs = [...(act.questions ?? [])].reverse();
  const unanswered = qs.filter((q) => !c.replies?.[q.id]).length;

  const work = new Map<string, string>();
  for (const e of c.log) for (const [k, r] of Object.entries(e.ratings ?? {})) if (r === "work" && !work.has(k)) work.set(k, `Flagged ${fmtDate(e.date)}${e.lesson ? " · " + e.lesson : ""}`);
  c.skills.needsWork.forEach((k) => work.has(k) || work.set(k, "From your training record"));
  const practiced: string[] = [];
  for (const sec of c.plan ?? []) for (const it of sec.items) if (it.mark === "Y" || it.mark === "R") practiced.push(`${it.label.replace(/ — /, " · ")} (${it.mark === "Y" ? "Practiced" : "Introduced"})`);

  return (
    <>
      <h1>Review</h1>
      <div className="chips" role="tablist" aria-label="Review">
        {(["Debriefs", "Work on", "Questions"] as const).map((t) => (
          <button key={t} role="tab" className="chip" aria-pressed={tab === t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}{t === "Debriefs" && toReview ? ` · ${toReview}` : t === "Questions" && qs.length ? ` · ${qs.length}` : ""}
          </button>
        ))}
      </div>

      {tab === "Debriefs" && (
        <>
          {entries.length === 0 && <div className="empty">No debriefs yet. They show up here after each lesson.</div>}
          {entries.map((e) => <Debrief key={logKey(e)} e={e} reviewed={act.reviewed?.[logKey(e)]} onReviewed={(on) => update(markReviewed(logKey(e), on))} onAsk={() => setAsk(`${e.lesson || (e.kind === "ground" ? "Ground lesson" : "Flight")} · ${fmtDate(e.date)}`)} who={instructorName(c)} />)}
        </>
      )}

      {tab === "Work on" && (
        <>
          {work.size === 0 && practiced.length === 0 && <div className="empty">Nothing flagged right now. Nice work.</div>}
          {work.size > 0 && (
            <section className="card">
              <h3>Flagged in your lessons</h3>
              {[...work.entries()].map(([k, why]) => (
                <div key={k} className="workrow"><span className="dot y" aria-hidden="true" /><span><b>{k}</b><small>{why}</small></span><button className="btn sm" onClick={() => setAsk(k)}>Ask</button></div>
              ))}
            </section>
          )}
          {practiced.length > 0 && (
            <section className="card">
              <h3>Not Proficient yet</h3>
              <div className="small muted">These get finished during later lessons.</div>
              {practiced.slice(0, 12).map((p) => <div key={p} className="workrow"><span className="dot i" aria-hidden="true" /><span>{p}</span></div>)}
            </section>
          )}
          {c.mock && c.mock.weak.length > 0 && (
            <section className="card">
              <h3>From your mock checkride</h3>
              <div className="small muted">{c.mock.bank} · {fmtDate(c.mock.date)}</div>
              <div className="softchips">{c.mock.weak.map((w) => <span key={w}>{w}</span>)}</div>
            </section>
          )}
        </>
      )}

      {tab === "Questions" && (
        <>
          <button className="btn primary" onClick={() => setAsk("")}>Ask {instructorName(c).split(" ")[0]} a question</button>
          {qs.length === 0 && <div className="empty">Questions you send show up here with the answer.</div>}
          {qs.map((q) => {
            const r = c.replies?.[q.id];
            return (
              <section key={q.id} className="card qcard">
                {q.ctx && <div className="small muted">{q.ctx}</div>}
                <div className="bubble me">{q.text}</div>
                {r ? (r.inPerson ? <div className="small muted">{instructorName(c)} will go over this with you in person.</div> : <div className="bubble them"><small>{instructorName(c)}</small>{r.text}</div>) : <div className="small muted">Sent {fmtDate(q.at.slice(0, 10))} · waiting for an answer</div>}
              </section>
            );
          })}
          {unanswered > 0 && <div className="small muted">Answers appear here after your instructor replies and their app syncs.</div>}
        </>
      )}

      {ask !== null && <AskSheet card={c} ctx={ask || undefined} onClose={() => setAsk(null)} />}
    </>
  );
}

function Debrief({ e, reviewed, onReviewed, onAsk, who }: { e: Entry; reviewed?: string; onReviewed: (on: boolean) => void; onAsk: () => void; who: string }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const body = e.text || e.notes || "";
  const ratings = Object.entries(e.ratings ?? {});
  return (
    <article className={"card debrief" + (reviewed ? " read" : "")}>
      <div className="dhead">
        <h3>{e.lesson || (e.kind === "ground" ? "Ground lesson" : "Flight")}</h3>
        <span className="small muted">{fmtDate(e.date)}{e.hrs ? ` · ${e.hrs} hr` : ""}{e.tail ? ` · ${e.tail}` : ""}</span>
      </div>
      {body && (
        <>
          <div className="small muted">{who.charAt(0).toUpperCase() + who.slice(1)}'s debrief</div>
          <p className={open ? "" : "clamp3"} style={{ margin: 0, whiteSpace: "pre-wrap" }}>{body}</p>
          {body.length > 180 && <button className="linkbtn" onClick={() => setOpen(!open)}>{open ? "Show less" : "Read all"}</button>}
        </>
      )}
      {ratings.length > 0 && (
        <div className="softchips">{ratings.map(([k, r]) => <span key={k} className={r === "good" ? "g" : "y"}>{r === "good" ? "✓ " : ""}{k}</span>)}</div>
      )}
      <div className="row">
        {reviewed ? (
          <button className="linkbtn okline" onClick={() => onReviewed(false)}>✓ Reviewed {fmtDate(reviewed)}</button>
        ) : (
          <button className="btn primary sm" onClick={() => onReviewed(true)}>Mark as reviewed</button>
        )}
        <button className="btn sm" onClick={onAsk}>Ask</button>
        <span className="spacer" />
        {e.text && <button className="linkbtn" onClick={() => copy(e.text!, "Copied")}>Copy</button>}
      </div>
    </article>
  );
}
