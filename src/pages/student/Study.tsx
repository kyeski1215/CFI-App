// Student side, third tab: flashcards from the syllabus oral checks and the checkride oral bank.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bar } from "../../components/ui";
import { useActivity } from "../../lib/activity";
import { bankForGoal, useFullBank } from "../../lib/banks";
import type { StudentCard } from "../../lib/card";
import { bankDecks, deckStats, isDue, isMastered, nextLessonModules, recordReview, sessionOrder, syllabusDecks, type Deck, type Flash } from "../../lib/study";
import { AskSheet, StudentGate } from "./shared";

function useDecks(c: StudentCard) {
  const bankId = bankForGoal(c.goal);
  const bank = useFullBank(bankId);
  return useMemo(() => {
    const syl = syllabusDecks(c.goal, c.oralEdits);
    const oral = bankDecks(bankId, bank);
    const mods = nextLessonModules(c);
    const nextCards = syl.filter((d) => mods.includes(d.id.slice(4))).flatMap((d) => d.cards);
    const next: Deck | null = nextCards.length
      ? { id: "next", title: syl.filter((d) => mods.includes(d.id.slice(4))).map((d) => `${d.code} ${d.title}`).join(" · "), group: "syllabus", cards: nextCards }
      : null;
    return { syl, oral, next, all: [...syl, ...oral], bankName: bank?.name, loadingBank: !bank };
  }, [c, bankId, bank]);
}

export default function Study() {
  const { deck } = useParams();
  return <StudentGate title="Study">{(c) => (deck ? <Session key={deck} c={c} deckId={deck} /> : <StudyHome c={c} />)}</StudentGate>;
}

function StudyHome({ c }: { c: StudentCard }) {
  const { act } = useActivity(c);
  const { syl, oral, next, all, bankName, loadingBank } = useDecks(c);
  const cards = all.flatMap((d) => d.cards);
  const due = cards.filter((f) => isDue(act.cards?.[f.id])).length;
  const cold = cards.length ? Math.round((cards.filter((f) => isMastered(act.cards?.[f.id])).length / cards.length) * 100) : 0;
  return (
    <>
      <div>
        <h1>Study</h1>
        <div className="subtitle">Say each answer out loud before you flip the card.</div>
      </div>

      {next && (
        <section className="card nextdeck">
          <div className="small muted">For your next lesson</div>
          <h3>{next.title}</h3>
          <div className="row"><span className="small muted">{next.cards.length} questions · about {Math.max(2, Math.round(next.cards.length * 0.7))} min</span><span className="spacer" /><Link className="btn primary" to="/me/study/next">Start</Link></div>
        </section>
      )}

      <div className="tiles2">
        <Link className="tile" to={due ? "/me/study/due" : "/me/study"}><b>{due}</b><span>cards to refresh today</span></Link>
        <div className="tile"><b className="acc">{cold}%</b><span>down cold</span></div>
      </div>

      {syl.length > 0 && <DeckList title="Your syllabus · oral checks" decks={syl} act={act} />}
      {loadingBank ? <div className="small muted">Loading the checkride oral questions…</div> : oral.length > 0 && <DeckList title={`Checkride oral · ${bankName ?? ""}`} decks={oral} act={act} />}
    </>
  );
}

function DeckList({ title, decks, act }: { title: string; decks: Deck[]; act: ReturnType<typeof useActivity>["act"] }) {
  return (
    <section className="card decklist">
      <h3>{title}</h3>
      {decks.map((d) => {
        const s = deckStats(d, act);
        return (
          <Link key={d.id} to={"/me/study/" + d.id} className="deckrow">
            <span className="row">
              {d.code && <span className="lcode">{d.code}</span>}
              <span className="dt">{d.title}</span>
              <span className="spacer" />
              <span className="small muted">{s.due ? `${s.due} due · ` : ""}{s.mastered}/{s.total}</span>
            </span>
            <Bar value={s.mastered} total={s.total} color={s.mastered === s.total ? "var(--good)" : undefined} />
          </Link>
        );
      })}
    </section>
  );
}

function Session({ c, deckId }: { c: StudentCard; deckId: string }) {
  const nav = useNavigate();
  const { act, update } = useActivity(c);
  const { all, next, loadingBank } = useDecks(c);
  const deck: Deck | undefined =
    deckId === "next" ? next ?? undefined
    : deckId === "due" ? { id: "due", title: "Cards to refresh", group: "oral", cards: all.flatMap((d) => d.cards).filter((f) => isDue(act.cards?.[f.id])) }
    : all.find((d) => d.id === deckId);
  // Fix the order once per session so cards don't jump around as they're graded.
  const [order, setOrder] = useState<Flash[] | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [got, setGot] = useState(0);
  const [asking, setAsking] = useState(false);

  if (!deck) return loadingBank ? <div className="small muted">Loading…</div> : <div className="empty">Nothing to study here right now. <Link to="/me/study">Back to Study</Link></div>;
  const cards = order ?? sessionOrder(deck.cards, act);
  if (!order && cards.length) setOrder(cards);
  const f = cards[i];
  const close = () => nav("/me/study");

  if (!f) {
    return (
      <section className="card donecard">
        <h2>Nice work</h2>
        <p>You went through {cards.length} cards and had {got} down.</p>
        <div className="row"><button className="btn" onClick={() => { setOrder(null); setI(0); setGot(0); setShown(false); }}>Go again</button><span className="spacer" /><button className="btn primary" onClick={close}>Done</button></div>
      </section>
    );
  }
  const grade = (ok: boolean) => {
    update(recordReview(f.id, ok));
    if (ok) setGot(got + 1);
    setShown(false);
    setI(i + 1);
  };
  return (
    <>
      <div className="sessionhead">
        <button className="roundbtn" aria-label="Close" onClick={close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <div className="sh-mid">
          <div className="small muted clamp1">{deck.title}</div>
          <div className="row"><Bar value={i} total={cards.length} /><b className="small">{i + 1} of {cards.length}</b></div>
        </div>
      </div>

      <section className="card flash">
        <span className="ftag q">Question</span>
        <div className="fq">{f.q}</div>
        {shown ? (
          <>
            <div className="fsep" />
            <span className="ftag a">{f.a ? "Answer" : "Check your answer"}</span>
            {f.a ? <p className="fa">{f.a}</p> : <p className="fa muted">Your syllabus doesn't write this one out. Check it against the sources below, or ask.</p>}
            {f.ref && <div className="small muted">From: {f.ref}</div>}
          </>
        ) : (
          <button className="btn showans" onClick={() => setShown(true)}>Show answer</button>
        )}
      </section>
      <button className="linkbtn" style={{ alignSelf: "center" }} onClick={() => setAsking(true)}>Ask about this</button>

      {shown && (
        <div className="gradebar">
          <button className="btn again" onClick={() => grade(false)}>Study again</button>
          <button className="btn primary" onClick={() => grade(true)}>Got it</button>
        </div>
      )}
      {asking && <AskSheet card={c} ctx={`Study card: ${f.q}`} onClose={() => setAsking(false)} />}
    </>
  );
}
