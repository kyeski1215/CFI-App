import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../components/ui";
import { findImportDuplicates, isImported } from "../lib/foreflight";
import { fmtDate, put, remove, restoreSnapshot, snapshot, useCollection } from "../lib/store";
import type { LogEntry, Student } from "../lib/types";

/** Undo or tidy a ForeFlight import. Imported lessons have ids starting with "ff-"; nothing else is touched. */
export default function ImportCleanup() {
  const students = useCollection<Student>("students");
  const nav = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<"dups" | "undo">("dups");
  const [confirm, setConfirm] = useState(false);

  const plan = useMemo(() => students.map((s) => {
    const log = s.log ?? [];
    const imported = log.filter(isImported);
    const dups = findImportDuplicates(log);
    // A student the import created: every lesson is imported and nothing else was added by hand.
    const onlyImported = imported.length > 0 && imported.length === log.length && !Object.keys(s.guide ?? {}).length && !(s.covered ?? []).length && !s.notes && !s.logDraft;
    return { s, imported, dups, onlyImported };
  }).filter((x) => x.imported.length), [students]);

  const dupCount = plan.reduce((a, x) => a + x.dups.length, 0);
  const impCount = plan.reduce((a, x) => a + x.imported.length, 0);
  const createdCount = plan.filter((x) => x.onlyImported).length;

  const run = () => {
    const snap = snapshot(mode === "undo" ? "Before undoing an import" : "Before removing import duplicates");
    let removed = 0, studentsRemoved = 0;
    for (const x of plan) {
      if (mode === "undo" && x.onlyImported) { remove("students", x.s.id); studentsRemoved++; removed += x.imported.length; continue; }
      const drop = new Set<LogEntry>(mode === "undo" ? x.imported : x.dups);
      if (!drop.size) continue;
      put("students", { ...x.s, log: (x.s.log ?? []).filter((e) => !drop.has(e)) });
      removed += drop.size;
    }
    toast(`Removed ${removed} imported lesson${removed === 1 ? "" : "s"}${studentsRemoved ? ` and ${studentsRemoved} imported student${studentsRemoved === 1 ? "" : "s"}` : ""}`, { label: "Undo", run: () => restoreSnapshot(snap) });
    nav("/students");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link to="/import" className="small">← Import logbook</Link>
          <h1 style={{ marginTop: 6 }}>Fix an import</h1>
        </div>
      </header>

      {!impCount ? (
        <div className="empty">No imported lessons on your roster.</div>
      ) : (
        <>
          <section className="card">
            <div className="small">{impCount} lesson{impCount === 1 ? "" : "s"} on your roster came from a ForeFlight import. Lessons you typed in yourself are never removed here.</div>
            <div className="seg" style={{ alignSelf: "flex-start" }}>
              <button aria-pressed={mode === "dups"} onClick={() => { setMode("dups"); setConfirm(false); }}>Remove duplicates ({dupCount})</button>
              <button aria-pressed={mode === "undo"} onClick={() => { setMode("undo"); setConfirm(false); }}>Undo whole import ({impCount})</button>
            </div>
            <div className="small muted">
              {mode === "dups"
                ? "Removes each imported lesson that's on the same date as one you logged (same plane, if both have a tail number). Your own lesson stays, with its notes, ratings and texts."
                : `Removes every imported lesson${createdCount ? `, and the ${createdCount} student${createdCount === 1 ? "" : "s"} the import created that ha${createdCount === 1 ? "s" : "ve"} nothing else` : ""}. You can then import again cleanly.`}
            </div>
          </section>

          {plan.map((x) => {
            const list = mode === "dups" ? x.dups : x.imported;
            if (!list.length) return null;
            return (
              <section key={x.s.id} className="card">
                <div className="row">
                  <h3>{x.s.name}</h3>
                  <span className="spacer" />
                  <span className="small muted">
                    {mode === "undo" && x.onlyImported ? "student will be removed" : `${list.length} to remove · ${(x.s.log ?? []).length - list.length} kept`}
                  </span>
                </div>
                <div className="small mono muted" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((e) => (
                    <span key={e.id}>{fmtDate(e.date)} · {e.tail || e.kind} · {e.hrs ? e.hrs + " hr" : ""} {e.lesson ?? ""}</span>
                  ))}
                  {list.length > 8 && <span>…and {list.length - 8} more</span>}
                </div>
              </section>
            );
          })}

          <section className="card">
            {confirm ? (
              <div className="row confirmbar">
                <span className="small">{mode === "dups" ? `Remove ${dupCount} duplicate lessons?` : `Remove all ${impCount} imported lessons${createdCount ? ` and ${createdCount} students` : ""}?`}</span>
                <span className="spacer" />
                <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
                <button className="btn danger" onClick={run}>Remove</button>
              </div>
            ) : (
              <div className="row">
                <span className="spacer" />
                <button className="btn primary" disabled={mode === "dups" ? !dupCount : !impCount} onClick={() => setConfirm(true)}>
                  {mode === "dups" ? `Remove ${dupCount} duplicates` : "Undo the import"}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
