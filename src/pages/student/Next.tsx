// Student side, first tab: get ready for the next lesson.
import { useState } from "react";
import { Link } from "react-router-dom";
import BriefingCard from "../../components/BriefingCard";
import { Avatar } from "../../components/ui";
import { togglePrep, useActivity } from "../../lib/activity";
import type { StudentCard } from "../../lib/card";

import { nextLessonModules, syllabusDecks } from "../../lib/study";
import { AskSheet, StudentGate, firstOf, instructorName } from "./shared";

type Prep = { key: string; title: string; sub?: string; kind: "Read" | "Study" | "Watch" | "Do" | "Quiz"; href?: string; to?: string };

/** The "Get ready" checklist for the next lesson, built from the briefing your instructor shares. */
export function prepItems(c: StudentCard): Prep[] {
  const b = c.briefing;
  if (!b) return [];
  const base = b.key ?? b.title;
  const out: Prep[] = [{ key: `${base}|plan`, title: "Read the lesson plan", sub: "Objective, brief and the Done when standard", kind: "Read" }];
  (b.groundFirst ?? []).filter((g) => !g.done).forEach((g) => out.push({ key: `${base}|g:${g.code}`, title: `${g.code} · ${g.name}`, sub: "Ground module to finish first", kind: "Study", to: "/me/study/syl-" + (g.code === "Regs" ? "SOLO-REGS" : g.code) }));
  b.extras.hw.forEach(([t, txt], i) => {
    const m = t === "Study" ? txt.match(/\b(G\d+)\b/) ?? (/solo regs/i.test(txt) ? [, "SOLO-REGS"] : null) : null;
    out.push({ key: `${base}|hw:${i}`, title: txt, sub: t !== "Do" && t !== "Study" && t !== "Read" ? t : m ? "Ground module · tap for its flashcards" : undefined, kind: t === "Do" ? "Do" : t === "Study" ? "Study" : "Read", to: m ? "/me/study/syl-" + m[1] : undefined });
  });
  b.extras.items.forEach((v, i) => out.push({ key: `${base}|v:${i}`, title: v.title, sub: /youtu/.test(v.url) ? "Video" : "Link", kind: "Watch", href: v.url }));
  const mods = nextLessonModules(c);
  const decks = syllabusDecks(c.goal, c.oralEdits).filter((d) => mods.includes(d.id.slice(4)));
  const qs = decks.reduce((n, d) => n + d.cards.length, 0);
  if (qs) out.push({ key: `${base}|quiz`, title: "Oral check questions", sub: `${qs} questions · ${decks.map((d) => d.code).join(", ")}`, kind: "Quiz", to: "/me/study/next" });
  return out;
}

export default function Next() {
  return <StudentGate title="Next lesson">{(c) => <NextBody c={c} />}</StudentGate>;
}

function NextBody({ c }: { c: StudentCard }) {
  const { act, update } = useActivity(c);
  const [plan, setPlan] = useState(false);
  const [asking, setAsking] = useState(false);
  const items = prepItems(c);
  const done = items.filter((p) => act.prep?.[p.key]).length;
  const b = c.briefing;
  const lastWork = c.log.find((e) => e.ratings && Object.values(e.ratings).includes("work"));
  const workOn = [...(b?.warmup ?? []), ...(lastWork ? Object.entries(lastWork.ratings!).filter(([, r]) => r === "work").map(([k]) => k) : [])].slice(0, 5);
  return (
    <>
      {c.school && (
        <div className="schoolbar">
          {c.school.logo && <img src={c.school.logo} alt="" />}
          <span>{c.school.name ?? ""}{c.school.name ? " · " : ""}with {instructorName(c)}</span>
        </div>
      )}
      <div className="hello">
        <Avatar name={c.name} goal={c.goal} size={46} />
        <div className="greet"><small>{[c.goal, c.stage].filter(Boolean).join(" · ")}</small><h1>Hi {firstOf(c.name)}</h1></div>
      </div>

      {b ? (
        <section className="nexthero">
          <div className="nh-k">Your next lesson{b.stage ? ` · ${b.stage}` : ""}</div>
          <div className="nh-t">{b.title}</div>
          {b.scenario && <div className="nh-s">{b.scenario}</div>}
          {items.length > 0 && (
            <div className="nh-p">
              <span className="nh-bar"><i style={{ width: (done / items.length) * 100 + "%" }} /></span>
              <b>{done} of {items.length} ready</b>
            </div>
          )}
        </section>
      ) : (
        <div className="card small">{instructorName(c)} hasn't set your next lesson yet.</div>
      )}

      {items.length > 0 && (
        <section className="card prepcard">
          <h3>Get ready</h3>
          {items.map((p) => {
            const on = !!act.prep?.[p.key];
            const open = () => (p.key.endsWith("|plan") ? setPlan(true) : undefined);
            return (
              <div key={p.key} className={"preprow" + (on ? " on" : "")}>
                <button className="tick" role="checkbox" aria-checked={on} aria-label={(on ? "Done: " : "Mark done: ") + p.title} onClick={() => update(togglePrep(p.key))}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                </button>
                {p.href ? (
                  <a className="pt" href={p.href} target="_blank" rel="noreferrer"><span>{p.title}</span>{p.sub && <small>{p.sub}</small>}</a>
                ) : p.to ? (
                  <Link className="pt" to={p.to}><span>{p.title}</span>{p.sub && <small>{p.sub}</small>}</Link>
                ) : (
                  <button className="pt linkish" onClick={open}><span>{p.title}</span>{p.sub && <small>{p.sub}</small>}</button>
                )}
                <span className={"kindtag k-" + p.kind}>{p.kind}</span>
              </div>
            );
          })}
        </section>
      )}

      {plan && b && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setPlan(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Lesson plan">
            <div className="row"><h2>Lesson plan</h2><span className="spacer" /><button className="btn sm" onClick={() => setPlan(false)}>Close</button></div>
            <BriefingCard b={b} />
            <div className="row">
              <button className="btn" onClick={() => { setPlan(false); setAsking(true); }}>Ask a question</button>
              <span className="spacer" />
              {!act.prep?.[`${b.key ?? b.title}|plan`] && <button className="btn primary" onClick={() => { update(togglePrep(`${b.key ?? b.title}|plan`)); setPlan(false); }}>Mark as read</button>}
            </div>
          </div>
        </div>
      )}

      {workOn.length > 0 && (
        <section className="card">
          <div className="row"><h3>From last time</h3><span className="spacer" /><Link to="/me/review" className="small">Review</Link></div>
          <div className="softchips">{workOn.map((w) => <span key={w}>{w}</span>)}</div>
        </section>
      )}

      {asking && b && <AskSheet card={c} ctx={`Next lesson: ${b.title}`} onClose={() => setAsking(false)} />}
    </>
  );
}
