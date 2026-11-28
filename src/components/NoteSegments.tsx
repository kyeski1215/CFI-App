// Flight notes split into the parts of the flight (engine start, taxi, departure, approach 1, landing 2…).
// The sections are kept on the entry as `segs`, and `notes` is rebuilt from them ("Taxi: …" lines) so the
// debrief text, the student's view and everything else that reads notes keeps working.
import { useEffect, useRef, useState } from "react";
import { newId } from "../lib/store";
import type { LogEntry, NoteSeg } from "../lib/types";

/** Sections you can add. Ones ending in " #" are numbered (Approach 1, Approach 2…). */
export const SEG_PRESETS = [
  "Preflight", "Engine start", "Taxi", "Run-up", "Takeoff",
  "Departure · Class D", "Departure · untowered", "Airwork", "Emergencies",
  "Approach #", "Landing #", "Pattern", "Arrival · Class D", "Arrival · untowered", "Shutdown", "Overall",
];
const DEFAULT = ["Engine start", "Taxi", "Departure · Class D", "Landing 1", "Overall"];
const TPL = "cfi.v1.segtpl";

const base = (label: string) => label.replace(/\s+\d+$/, "");
const chipName = (p: string) => p.replace(/ #$/, "");

/** "Taxi: held centerline\nLanding 1: floated" from the sections that have something written. */
export const composeNotes = (segs: NoteSeg[]) =>
  segs.filter((g) => g.text.trim()).map((g) => (g.label.trim() ? `${g.label.trim()}: ${g.text.trim()}` : g.text.trim())).join("\n");

/** Section names for a new flight: the ones you used last time (numbered ones start back at 1), else a default set. */
export function startSegs(): NoteSeg[] {
  let labels = DEFAULT;
  try {
    const t = JSON.parse(localStorage.getItem(TPL) ?? "null");
    if (Array.isArray(t) && t.length) labels = t;
  } catch { /* first use */ }
  return labels.map((label) => ({ id: newId(), label, text: "" }));
}
/** Remember which sections this flight used, for the next one. */
export function rememberSegs(segs?: NoteSeg[]) {
  if (!segs?.length) return;
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const g of segs) {
    const b = base(g.label.trim());
    if (!b || seen.has(b)) continue;
    seen.add(b);
    labels.push(/\d+$/.test(g.label.trim()) ? b + " 1" : g.label.trim());
  }
  try { localStorage.setItem(TPL, JSON.stringify(labels)); } catch { /* private mode */ }
}

export default function NoteSegments({ e, set }: { e: LogEntry; set: (p: Partial<LogEntry>) => void }) {
  // Older entries have one block of notes: show it as a single "Notes" section until you add more.
  const segs: NoteSeg[] = e.segs ?? (e.notes?.trim() ? [{ id: "old", label: "Notes", text: e.notes }] : startSegs());
  const [focus, setFocus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const save = (next: NoteSeg[]) => set({ segs: next, notes: composeNotes(next) });

  // A brand-new entry gets its starting sections stored right away so their ids stay put while typing.
  useEffect(() => { if (!e.segs && !e.notes?.trim()) set({ segs }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (preset: string) => {
    let label = chipName(preset);
    if (preset.endsWith(" #")) label = `${label} ${segs.filter((g) => base(g.label) === label).length + 1}`;
    if (preset === "Custom") label = "";
    const g = { id: newId(), label, text: "" };
    // Approach n goes just before Landing n and Landing n just after Approach n; anything else goes before "Overall" so it stays last.
    const num = label.match(/^(Approach|Landing) (\d+)$/);
    const pair = num ? segs.findIndex((x) => x.label === `${num[1] === "Approach" ? "Landing" : "Approach"} ${num[2]}`) : -1;
    const at = pair !== -1 ? pair + (num![1] === "Landing" ? 1 : 0) : segs.findIndex((x) => x.label === "Overall");
    save(at === -1 ? [...segs, g] : [...segs.slice(0, at), g, ...segs.slice(at)]);
    setFocus(g.id + (preset === "Custom" ? ":label" : ""));
    setAdding(false);
  };
  const patch = (id: string, p: Partial<NoteSeg>) => save(segs.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const drop = (id: string) => save(segs.filter((g) => g.id !== id));
  const move = (i: number, d: -1 | 1) => {
    const n = [...segs];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    save(n);
  };
  const filled = segs.filter((g) => g.text.trim()).length;

  return (
    <div className="full segs">
      <div className="row"><span className="kv">Notes by part of the flight</span><span className="spacer" /><span className="small muted">{filled ? `${filled} of ${segs.length} written` : "Empty ones are skipped"}</span></div>
      {segs.map((g, i) => (
        <Seg key={g.id} g={g} first={i === 0} last={i === segs.length - 1} focus={focus} onFocused={() => setFocus(null)}
          onChange={(p) => patch(g.id, p)} onRemove={() => drop(g.id)} onMove={(d) => move(i, d)} />
      ))}
      <div className="segadd">
        <span className="small muted">Add</span>
        {["Approach #", "Landing #"].map((p) => <button key={p} type="button" className="chip" onClick={() => add(p)}>+ {chipName(p)} {segs.filter((g) => base(g.label) === chipName(p)).length + 1}</button>)}
        <button type="button" className="chip" aria-expanded={adding} onClick={() => setAdding(!adding)}>{adding ? "Less" : "More…"}</button>
      </div>
      {adding && (
        <div className="segadd more">
          {SEG_PRESETS.filter((p) => !p.endsWith(" #")).map((p) => (
            <button key={p} type="button" className="chip" disabled={segs.some((g) => g.label === p)} onClick={() => add(p)}>{p}</button>
          ))}
          <button type="button" className="chip" onClick={() => add("Custom")}>Your own…</button>
        </div>
      )}
    </div>
  );
}

function Seg({ g, first, last, focus, onFocused, onChange, onRemove, onMove }: {
  g: NoteSeg; first: boolean; last: boolean; focus: string | null; onFocused: () => void;
  onChange: (p: Partial<NoteSeg>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const lab = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus === g.id) { ta.current?.focus(); onFocused(); }
    if (focus === g.id + ":label") { lab.current?.focus(); onFocused(); }
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  // Grow with what's typed.
  useEffect(() => {
    const t = ta.current;
    if (t) { t.style.height = "auto"; t.style.height = Math.max(26, t.scrollHeight) + "px"; }
  }, [g.text]);
  return (
    <div className={"seg" + (g.text.trim() ? " on" : "")}>
      <div className="seghead">
        <input ref={lab} className="seglabel" value={g.label} placeholder="Name this part" aria-label="Section name" onChange={(ev) => onChange({ label: ev.target.value })} />
        <span className="segtools">
          <button type="button" aria-label={`Move ${g.label || "section"} up`} disabled={first} onClick={() => onMove(-1)}>↑</button>
          <button type="button" aria-label={`Move ${g.label || "section"} down`} disabled={last} onClick={() => onMove(1)}>↓</button>
          <button type="button" aria-label={`Remove ${g.label || "section"}`} onClick={onRemove}>×</button>
        </span>
      </div>
      <textarea ref={ta} rows={1} value={g.text} aria-label={`Notes: ${g.label || "section"}`} placeholder="Notes…" onChange={(ev) => onChange({ text: ev.target.value })} />
    </div>
  );
}

/** Read-only view of an entry's notes, by section when it has them. */
export function SegNotes({ e, clamp }: { e: LogEntry; clamp?: boolean }) {
  const segs = e.segs?.filter((g) => g.text.trim());
  if (!segs?.length) return e.notes ? <p className={clamp ? "clamp3" : ""}>{e.notes}</p> : null;
  return (
    <dl className={"segnotes" + (clamp ? " clamp" : "")}>
      {segs.map((g) => (
        <div key={g.id}><dt>{g.label}</dt><dd>{g.text.trim()}</dd></div>
      ))}
    </dl>
  );
}
