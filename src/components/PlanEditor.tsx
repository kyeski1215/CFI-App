// Edit the wording of one lesson or ground module in your syllabus. Saved as your edit on top of the
// original, so "Reset" always gets the original back.
import { useState } from "react";
import { pplDetail, pplOriginal, savePplEdit, type PlanEdit } from "../lib/ppl";
import { Modal, useToast } from "./ui";

type Field = { k: keyof PlanEdit; label: string; kind: "text" | "long" | "list"; hint?: string };
const FLIGHT: Field[] = [
  { k: "name", label: "Lesson name", kind: "text" },
  { k: "objective", label: "Objective", kind: "long" },
  { k: "doneWhen", label: "Done when", kind: "long" },
  { k: "briefing", label: "Brief", kind: "list", hint: "One point per line" },
  { k: "inFlight", label: "In flight", kind: "list", hint: "One per line" },
  { k: "steps", label: "Steps", kind: "list", hint: "One per line" },
  { k: "profile", label: "Profile", kind: "list", hint: "One per line" },
  { k: "hood", label: "Hood", kind: "text" },
  { k: "homework", label: "Homework", kind: "list", hint: "One per line. Mention a module like G3 and students get its flashcards." },
  { k: "note", label: "Note", kind: "long" },
  { k: "cfiNote", label: "CFI note", kind: "long" },
];
const GROUND: Field[] = [
  { k: "name", label: "Module name", kind: "text" },
  { k: "due", label: "Due", kind: "text" },
  { k: "covers", label: "Covers", kind: "list", hint: "One topic per line" },
  { k: "oralCheck", label: "Oral check questions", kind: "list", hint: "One question per line. Students study these as flashcards." },
  { k: "sources", label: "Sources", kind: "list", hint: "One per line. Students see these as reading." },
];

export default function PlanEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const d = pplDetail(id)!;
  const orig = pplOriginal(id)!;
  const fields = (d.kind === "ground" ? GROUND : FLIGHT).filter((f) => f.k === "name" || f.k === "objective" || f.k === "doneWhen" || f.k === "homework" || f.k === "hood" || orig[f.k as keyof typeof orig] !== undefined || d.kind === "ground");
  const toText = (v: unknown) => (Array.isArray(v) ? v.join("\n") : (v as string | null | undefined) ?? "");
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.k, toText(d[f.k as keyof typeof d])])));
  const edited = JSON.stringify(d) !== JSON.stringify(orig);

  const save = () => {
    const patch: PlanEdit = {};
    for (const f of fields) {
      const raw = vals[f.k] ?? "";
      const v = f.kind === "list" ? raw.split("\n").map((x) => x.trim()).filter(Boolean) : raw.trim();
      if (JSON.stringify(v) === JSON.stringify(f.kind === "list" ? (orig[f.k as keyof typeof orig] as string[] | undefined) ?? [] : toText(orig[f.k as keyof typeof orig]))) continue;
      (patch as Record<string, unknown>)[f.k] = v;
    }
    savePplEdit(id, Object.keys(patch).length ? patch : null);
    toast("Syllabus updated");
    onClose();
  };

  return (
    <Modal title={`Edit ${d.kind === "ground" ? d.code + " " : ""}${orig.name}`} onClose={onClose}>
      <div className="small muted">Changes apply to every student on this syllabus, and students see the new wording after your next sync.</div>
      <div className="fields">
        {fields.map((f) => (
          <label key={f.k} className="f full">{f.label}{f.hint && <span className="muted" style={{ fontWeight: 400 }}> · {f.hint}</span>}
            {f.kind === "text" ? (
              <input value={vals[f.k]} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} />
            ) : (
              <textarea rows={f.kind === "list" ? Math.min(10, Math.max(3, (vals[f.k] ?? "").split("\n").length + 1)) : 3} value={vals[f.k]} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="row">
        {edited && <button type="button" className="btn danger" onClick={() => { savePplEdit(id, null); toast("Back to the original wording"); onClose(); }}>Reset to original</button>}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}
