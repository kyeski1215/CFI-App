// Pieces every student screen uses: which instructor's card is showing, empty states, and the "ask" sheet.
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal, useToast } from "../../components/ui";
import PullToRefresh from "../../components/PullToRefresh";
import { askQuestion, useActivity } from "../../lib/activity";
import type { StudentCard } from "../../lib/card";
import { loadMyCards, syncConfigured, useMyCards, useSync } from "../../lib/sync";

const PICK = "cfi.v1.mycard";
/** The card being shown (a student can train with more than one instructor). */
export function useStudentCard() {
  const { cards, loaded, error } = useMyCards();
  const [pick, setPickState] = useState(() => { try { return +(localStorage.getItem(PICK) ?? 0) || 0; } catch { return 0; } });
  const setPick = (i: number) => { setPickState(i); try { localStorage.setItem(PICK, String(i)); } catch { /* ignore */ } };
  const card: StudentCard | undefined = cards[Math.min(pick, cards.length - 1)];
  return { cards, card, pick: Math.min(pick, Math.max(0, cards.length - 1)), setPick, loaded, error };
}

/** Shows sign-in / nothing-shared messages until there's a card, then renders the screen. */
export function StudentGate({ title, children }: { title: string; children: (c: StudentCard) => ReactNode }) {
  const sync = useSync();
  const { cards, card, pick, setPick, loaded, error } = useStudentCard();
  if (!card) {
    return (
      <div className="page">
        <h1>{title}</h1>
        <div className="card small">
          {!syncConfigured || !sync.session ? (
            <>Sign in under <Link to="/settings">Settings</Link> with the email your instructor has on file to see your training.</>
          ) : loaded ? (
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
  return (
    <div className="page">
      <PullToRefresh onRefresh={() => loadMyCards()} />
      {cards.length > 1 && (
        <select className="cardpick" value={pick} onChange={(e) => setPick(+e.target.value)} aria-label="Training record">
          {cards.map((x, i) => <option key={i} value={i}>{x.goal}{x.instructor ? ` with ${x.instructor}` : ""}</option>)}
        </select>
      )}
      {children(card)}
    </div>
  );
}

export const firstOf = (n?: string) => String(n ?? "").trim().split(/\s+/)[0] || "";
export const instructorName = (c: StudentCard) =>
  !c.instructor ? "your instructor" : c.instructor.includes("@") ? c.instructor.split("@")[0].replace(/[._]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : c.instructor;

/** Sheet for sending a question to the instructor. */
export function AskSheet({ card, ctx, onClose }: { card: StudentCard; ctx?: string; onClose: () => void }) {
  const { update } = useActivity(card);
  const toast = useToast();
  const [text, setText] = useState("");
  return (
    <Modal title="Ask your instructor" onClose={onClose}>
      {ctx && <div className="small muted">About: {ctx}</div>}
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What didn't make sense?" rows={4} aria-label="Your question" />
      <div className="row">
        <span className="small muted">They'll see it next time they open your page.</span>
        <span className="spacer" />
        <button className="btn primary" disabled={!text.trim()} onClick={() => { update(askQuestion(text, ctx)); toast("Question sent"); onClose(); }}>Send</button>
      </div>
    </Modal>
  );
}
