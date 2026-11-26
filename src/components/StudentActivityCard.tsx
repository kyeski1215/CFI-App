// Instructor's view of what a student has been doing on their side: questions, lesson prep, debriefs read, studying.
import { useState } from "react";
import { useStudentActivity } from "../lib/activity";
import { buildBriefing } from "../lib/briefing";
import { logKey, type StudentCard } from "../lib/card";
import { put, fmtDate, todayStr } from "../lib/store";
import { deckStats, studiedThisWeek, syllabusDecks } from "../lib/study";
import type { Student } from "../lib/types";
import { prepItems } from "../pages/student/Next";
import { IconChip } from "./ui";

export default function StudentActivityCard({ s }: { s: Student }) {
  const { row, error } = useStudentActivity(s.id);
  if (!s.shareWithStudent || !s.email) return null;
  if (error === "setup") {
    return (
      <section className="card small">
        <h3><IconChip icon="next" tone="orange" />Student study tracking</h3>
        <div>One more Supabase step turns on {s.name.split(" ")[0]}'s prep checklist, study progress and questions: run <b>supabase/student-study.sql</b> in the SQL Editor.</div>
      </section>
    );
  }
  if (!row) return null;
  return <Body s={s} act={row.data} updated={row.updated_at} />;
}

function Body({ s, act, updated }: { s: Student; act: NonNullable<ReturnType<typeof useStudentActivity>["row"]>["data"]; updated: string }) {
  const first = s.name.split(" ")[0] || "Student";
  const replies = s.qReplies ?? {};
  const open = (act.questions ?? []).filter((q) => !replies[q.id]);
  const answered = (act.questions ?? []).filter((q) => replies[q.id]).slice(-2);
  const b = buildBriefing(s);
  const prep = b ? prepItems({ briefing: b } as StudentCard) : [];
  const prepDone = prep.filter((p) => act.prep?.[p.key]);
  const lastDebrief = [...(s.log ?? [])].filter((e) => e.date && (e.text || e.ratings)).sort((x, y) => y.date.localeCompare(x.date))[0];
  const readIt = lastDebrief ? act.reviewed?.[logKey(lastDebrief)] : undefined;
  const week = studiedThisWeek(act);
  const decks = syllabusDecks(s.goal).map((d) => ({ d, st: deckStats(d, act) })).filter((x) => x.st.seen > 0);
  const weakest = decks.sort((x, y) => x.st.mastered / x.st.total - y.st.mastered / y.st.total)[0];
  const reply = (id: string, text: string, inPerson = false) => put("students", { ...s, qReplies: { ...replies, [id]: { text, at: todayStr(), inPerson } } });

  return (
    <>
      {open.map((q) => <QuestionCard key={q.id} first={first} q={q} onReply={(t, ip) => reply(q.id, t, ip)} />)}
      <section className="card">
        <div className="row"><h3><IconChip icon="next" />{first}'s prep{b ? ` for ${b.title}` : ""}</h3><span className="spacer" />{prep.length > 0 && <b className="small" style={{ color: "var(--accent)" }}>{prepDone.length} of {prep.length}</b>}</div>
        {prep.map((p) => (
          <div key={p.key} className="miniprep"><span className={"mp" + (act.prep?.[p.key] ? " on" : "")} aria-hidden="true" /><span className={act.prep?.[p.key] ? "" : "muted"}>{p.title}</span>{act.prep?.[p.key] && <span className="small muted">{fmtDate(act.prep[p.key])}</span>}</div>
        ))}
        <div className="kvlist">
          {lastDebrief && <div><span>Read your last debrief ({lastDebrief.lesson || fmtDate(lastDebrief.date)})</span><b className={readIt ? "good" : "muted"}>{readIt ? "Yes · " + fmtDate(readIt) : "Not yet"}</b></div>}
          <div><span>Study cards this week</span><b>{week}</b></div>
          {weakest && <div><span>Weakest topic so far</span><b className="warn">{weakest.d.code} {weakest.d.title} · {Math.round((weakest.st.mastered / weakest.st.total) * 100)}%</b></div>}
        </div>
        {answered.length > 0 && <div className="small muted">Answered: {answered.map((q) => `“${q.text.slice(0, 50)}${q.text.length > 50 ? "…" : ""}”`).join(" · ")}</div>}
        <div className="small muted">Last active {fmtDate(updated.slice(0, 10))}</div>
      </section>
    </>
  );
}

function QuestionCard({ first, q, onReply }: { first: string; q: { id: string; text: string; ctx?: string; at: string }; onReply: (text: string, inPerson?: boolean) => void }) {
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(false);
  return (
    <section className="card qcard">
      <div className="row"><h3><IconChip icon="log" tone="orange" />Question from {first}</h3><span className="spacer" /><span className="small muted">{fmtDate(q.at.slice(0, 10))}</span></div>
      {q.ctx && <div className="small muted">{q.ctx}</div>}
      <div className="bubble them">{q.text}</div>
      {writing ? (
        <>
          <textarea autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Answer ${first}…`} aria-label="Your reply" />
          <div className="row"><button className="btn" onClick={() => setWriting(false)}>Cancel</button><span className="spacer" /><button className="btn primary" disabled={!text.trim()} onClick={() => onReply(text.trim())}>Send reply</button></div>
        </>
      ) : (
        <div className="row"><button className="btn primary" onClick={() => setWriting(true)}>Reply</button><button className="btn" onClick={() => onReply("", true)}>Answer in person</button></div>
      )}
    </section>
  );
}
