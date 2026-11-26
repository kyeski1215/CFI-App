// Student side, fourth tab: hours, syllabus progress, strengths and needs-work.
import { fmtDate } from "../../lib/store";
import { loadMyCards } from "../../lib/sync";
import { CardView } from "../MyTraining";
import { StudentGate } from "./shared";

export default function Progress() {
  return (
    <StudentGate title="Progress">
      {(c) => (
        <>
          <h1>Progress</h1>
          <CardView c={c} progressOnly />
          <div className="small muted">Updated {fmtDate(c.updated.slice(0, 10))} · <button className="linkbtn" onClick={() => loadMyCards()}>Refresh</button></div>
        </>
      )}
    </StudentGate>
  );
}
