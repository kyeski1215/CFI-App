import { ExtrasView } from "./LessonExtras";
import type { Briefing } from "../lib/briefing";

export default function BriefingCard({ b, actions }: { b: Briefing; actions?: React.ReactNode }) {
  return (
    <section className="card briefing">
      <div className="row">
        <span className="eyebrow">Next lesson briefing</span>
        <span className="spacer" />
        {actions}
      </div>
      <div className="btitle">
        {b.code && <span className="lcode">{b.code}</span>}
        <h3>{b.title}</h3>
      </div>
      {(b.stage || b.time) && <div className="small muted">{[b.stage, b.time].filter(Boolean).join(" · ")}</div>}
      {b.scenario && <p className="bscen">{b.scenario}</p>}
      {b.objectives.length > 0 && (
        <div>
          <div className="kv">We'll cover</div>
          <ul className="bobj">
            {b.objectives.map((o, i) => <li key={i} className={o.done ? "done" : ""}>{o.text}</li>)}
          </ul>
        </div>
      )}
      {b.doneWhen && <div className="small"><b>Done when:</b> {b.doneWhen}</div>}
      {b.takeover && <div className="small"><b>Student takes over:</b> {b.takeover}</div>}
      {b.focus.length > 0 && (
        <div className="small"><b>Keep working on:</b> {b.focus.join(" · ")}</div>
      )}
      {b.instructorNote && b.instructorNote !== b.title && <div className="small"><b>Instructor note:</b> {b.instructorNote}</div>}
      <ExtrasView {...b.extras} />
    </section>
  );
}
