// Log a real checkride result; on a pass, optionally start the student on their next rating.
import { useState } from "react";
import { NEXT_RATING, blankCheckride, deleteCheckride, editCheckride, recordCheckride } from "../lib/checkrides";
import { GOALS } from "../lib/curriculum";
import { put, restoreSnapshot, snapshot } from "../lib/store";
import type { Checkride, Student } from "../lib/types";
import { Modal, useToast } from "./ui";

export default function CheckrideModal({ students, initial, edit, onClose }: { students: Student[]; initial?: Student; edit?: Checkride; onClose: () => void }) {
  const toast = useToast();
  const [sid, setSid] = useState(initial?.id ?? "");
  const s = students.find((x) => x.id === sid);
  const [c, setC] = useState<Omit<Checkride, "id">>(() => (edit ? { date: edit.date, rating: edit.rating, result: edit.result, examiner: edit.examiner, notes: edit.notes } : initial ? blankCheckride(initial) : { date: blankCheckride({ goal: "" } as Student).date, rating: "", result: "Pass" }));
  const [confirmDel, setConfirmDel] = useState(false);
  const [move, setMove] = useState(true);
  const [moveTo, setMoveTo] = useState(initial ? NEXT_RATING[initial.goal] ?? "" : "");
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p });
  const first = s?.name.split(" ")[0] ?? "the student";

  return (
    <Modal title={edit ? "Edit checkride" : "Record a checkride"} onClose={onClose}>
      <form className="fields" onSubmit={(e) => {
        e.preventDefault();
        if (!s) return;
        if (edit) {
          put("students", editCheckride(s, edit.id, { ...c, rating: c.rating || s.goal }));
          toast("Checkride updated");
          return onClose();
        }
        put("students", recordCheckride(s, { ...c, rating: c.rating || s.goal }, c.result === "Pass" && move && moveTo ? moveTo : undefined));
        toast(c.result === "Pass" ? (move && moveTo ? `Congrats! ${first} is now on ${moveTo}.` : `Congrats to ${first}!`) : "Checkride logged");
        onClose();
      }}>
        {edit && s && <div className="full small muted">{s.name}. Changing this doesn't change their current rating or status.</div>}
        {!initial && (
          <label className="f full">Student
            <select required value={sid} onChange={(e) => { setSid(e.target.value); const x = students.find((y) => y.id === e.target.value); if (x) { set({ rating: x.goal }); setMoveTo(NEXT_RATING[x.goal] ?? ""); } }}>
              <option value="">Choose…</option>
              {[...students].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.goal}</option>)}
            </select>
          </label>
        )}
        <label className="f">Rating
          <select value={c.rating || s?.goal || ""} onChange={(e) => set({ rating: e.target.value })}>
            {GOALS.filter((g) => g !== "Other").map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="f">Date<input type="date" required value={c.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <div className="full">
          <div className="kv" style={{ marginBottom: 6 }}>Result</div>
          <div className="chips kindtabs" role="radiogroup" aria-label="Result">
            {(["Pass", "Fail", "Discontinued"] as const).map((r) => (
              <button key={r} type="button" role="radio" className="chip" aria-checked={c.result === r} aria-pressed={c.result === r} onClick={() => set({ result: r })}>{r}</button>
            ))}
          </div>
        </div>
        <label className="f">Examiner (DPE)<input value={c.examiner ?? ""} onChange={(e) => set({ examiner: e.target.value })} placeholder="Optional" /></label>
        <label className="f">{c.result === "Pass" ? "Notes" : "What wasn't passed"}<input value={c.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder={c.result === "Pass" ? "Optional" : "e.g. Area IV Task M, soft field landing"} /></label>
        {!edit && c.result === "Pass" && s && (
          <div className="full movebox">
            <label className="check">
              <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} />
              <span className="ct"><span>Start {first} on the next rating</span><small>Keeps their logbook, hours and history. Their syllabus and maneuver list switch to the new rating.</small></span>
            </label>
            {move && (
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Next rating">
                {GOALS.filter((g) => g !== "Other" && g !== (c.rating || s.goal)).map((g) => <option key={g}>{g}</option>)}
              </select>
            )}
            {!move && <div className="small muted">{first} will be marked Done.</div>}
          </div>
        )}
        {!edit && c.result === "Fail" && <div className="full small muted">{first}'s status will change to Needs work. Log the retest here too when it happens.</div>}
        <div className="row full">
          {edit && s && (confirmDel ? (
            <>
              <button type="button" className="btn danger" onClick={() => {
                const snap = snapshot("Before deleting a checkride");
                put("students", deleteCheckride(s, edit.id));
                toast("Checkride deleted", { label: "Undo", run: () => restoreSnapshot(snap) });
                onClose();
              }}>Yes, delete</button>
              <button type="button" className="btn" onClick={() => setConfirmDel(false)}>Keep</button>
            </>
          ) : <button type="button" className="btn danger" onClick={() => setConfirmDel(true)}>Delete</button>)}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!s}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
