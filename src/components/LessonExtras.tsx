// Homework & study + videos/resources attached to a lesson or ground task.
// Built-in content comes from src/data/lessons.json; edits are saved as a "lessons" record with id = lesson key.
import { useState, type ReactNode } from "react";
import raw from "../data/lessons.json";
import { get, put, useRecord, type BaseRec } from "../lib/store";

type Hw = [string, string];
interface LinkItem { title: string; url: string }
export interface LessonRec extends BaseRec { hw?: Hw[]; items?: LinkItem[] }

const D = raw as unknown as {
  HWTYPES: string[];
  PHAKS: Record<string, string>;
  HB: Record<string, string>;
  LESSONS: Record<string, { hw?: Hw[]; items?: LinkItem[] }>;
};

const FAA = "https://www.faa.gov";
const chartUrl = (t: string) =>
  /Chart Supplement/i.test(t)
    ? FAA + "/air_traffic/flight_info/aeronav/digital_products/dafd/"
    : /Terminal Procedures|plate/i.test(t)
      ? FAA + "/air_traffic/flight_info/aeronav/digital_products/dtpp/"
      : FAA + "/air_traffic/flight_info/aeronav/digital_products/aero_guide/";

const A = (u: string, txt: string, k: number | string) => (
  <a key={k} href={u} target="_blank" rel="noreferrer">{txt}</a>
);

function linkTokens(text: string, re: RegExp, urlFor: (m: RegExpExecArray) => string | null): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text))) {
    const u = urlFor(m);
    if (!u) continue;
    out.push(text.slice(last, m.index), A(u, m[0], m.index));
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/** Turns "Ch 5", "91.155", "4-3" etc. into links to the FAA source for that reference type. */
export function linkify(type: string, text: string): ReactNode {
  if (type === "FAR")
    return linkTokens(text, /\b(\d{2,3}\.\d{1,3})((?:\([a-z0-9]+\))*)|Part (\d+)/g, (m) =>
      m[3]
        ? "https://www.ecfr.gov/current/title-14/part-" + m[3]
        : "https://www.ecfr.gov/current/title-14/section-" + m[1] + (m[2] ? "#p-" + m[1] + m[2] : ""),
    );
  if (type === "PHAK")
    return linkTokens(text, /Ch (\d+)/g, (m) =>
      D.PHAKS[m[1]] ? FAA + "/regulationspolicies/handbooksmanuals/aviation/phak/chapter-" + m[1] + "-" + D.PHAKS[m[1]] : null,
    );
  if (type === "AFH")
    return linkTokens(text, /Ch (\d+)/g, (m) =>
      +m[1] >= 1 && +m[1] <= 18
        ? FAA + "/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/" +
          String(+m[1] + 1).padStart(2, "0") + "_afh_ch" + m[1] + ".pdf"
        : null,
    );
  if (type === "AIM")
    return linkTokens(text, /\b(\d{1,2})-(\d{1,2})\b|Ch (\d{1,2})/g, (m) =>
      m[3]
        ? FAA + "/air_traffic/publications/atpubs/aim_html/chap_" + m[3] + ".html"
        : FAA + "/air_traffic/publications/atpubs/aim_html/chap" + m[1] + "_section_" + m[2] + ".html",
    );
  if (D.HB[type]) return A(D.HB[type], text, 0);
  if (type === "Chart") return A(chartUrl(text), text, 0);
  return text;
}

export type LessonContent = { hw: Hw[]; items: LinkItem[] };
/** Homework and videos for a lesson key, outside React (for briefings and student cards). */
export function lessonContent(k: string): LessonContent {
  const rec = get<LessonRec>("lessons", k);
  const def = D.LESSONS[k] ?? {};
  return { hw: rec?.hw ?? def.hw ?? [], items: rec?.items ?? def.items ?? [] };
}

/** Read-only homework + videos list. */
export function ExtrasView({ hw, items }: LessonContent) {
  if (!hw.length && !items.length) return null;
  return (
    <div className="extras">
      {hw.length > 0 && <div className="xhead"><span>Homework & study</span></div>}
      {hw.map(([t, txt], i) => (
        <div key={i} className="hwrow">
          <span className={"hwk" + (t === "Do" ? " do" : t === "FAR" ? " far" : "")}>{t}</span>
          <span className="hwt">{linkify(t, txt)}</span>
        </div>
      ))}
      {items.length > 0 && <div className="xhead"><span>Videos & resources</span></div>}
      {items.map((r, i) => {
        const h = hostOf(r.url);
        const yt = /youtu/.test(h);
        return (
          <div key={i} className="resrow">
            <a className="res" href={r.url} target="_blank" rel="noreferrer">
              <span className={"play" + (yt ? " yt" : "")} aria-hidden="true">{yt ? "▶" : "↗"}</span>
              <span className="rtitle">{r.title || h}</span>
              <span className="kv">{yt ? "YouTube" : h}</span>
            </a>
          </div>
        );
      })}
    </div>
  );
}

function useLesson(k: string) {
  const rec = useRecord<LessonRec>("lessons", k);
  const def = D.LESSONS[k] ?? {};
  const hw = rec?.hw ?? def.hw ?? [];
  const items = rec?.items ?? def.items ?? [];
  const save = (p: Partial<LessonRec>) => {
    const now = Date.now();
    put<LessonRec>("lessons", { id: k, createdAt: rec?.createdAt ?? now, updatedAt: now, hw, items, ...p });
  };
  return { hw, items, save, customHw: !!rec?.hw && !!def.hw, resetHw: () => save({ hw: def.hw }) };
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export default function LessonExtras({ k }: { k: string }) {
  const { hw, items, save, customHw, resetHw } = useLesson(k);
  const [edit, setEdit] = useState(false);
  const [hType, setHType] = useState(D.HWTYPES[0]);
  const [hText, setHText] = useState("");
  const [rTitle, setRTitle] = useState("");
  const [rUrl, setRUrl] = useState("");

  return (
    <div className="extras">
      <div className="xhead">
        <span>Homework & study</span>
        <button type="button" className="linkbtn" onClick={() => setEdit(!edit)}>{edit ? "Done" : "Edit"}</button>
        {edit && customHw && <button type="button" className="linkbtn" onClick={resetHw}>Reset to default</button>}
      </div>
      {hw.length === 0 && !edit && <div className="small muted">No homework yet.</div>}
      {hw.map(([t, txt], i) => (
        <div key={i} className="hwrow">
          <span className={"hwk" + (t === "Do" ? " do" : t === "FAR" ? " far" : "")}>{t}</span>
          <span className="hwt">{linkify(t, txt)}</span>
          {edit && <button type="button" className="x" aria-label={"Remove " + txt} onClick={() => save({ hw: hw.filter((_, j) => j !== i) })}>×</button>}
        </div>
      ))}
      {edit && (
        <form className="resadd" onSubmit={(e) => {
          e.preventDefault();
          if (!hText.trim()) return;
          save({ hw: [...hw, [hType, hText.trim()]] });
          setHText("");
        }}>
          <select value={hType} onChange={(e) => setHType(e.target.value)} aria-label="Type">{D.HWTYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <input value={hText} onChange={(e) => setHText(e.target.value)} placeholder="e.g. Ch 5, Aerodynamics of Flight" aria-label="Homework item" />
          <button className="btn sm">Add</button>
        </form>
      )}

      {(items.length > 0 || edit) && <div className="xhead"><span>Videos & resources</span></div>}
      {items.map((r, i) => {
        const h = hostOf(r.url);
        const yt = /youtu/.test(h);
        return (
          <div key={i} className="resrow">
            <a className="res" href={r.url} target="_blank" rel="noreferrer">
              <span className={"play" + (yt ? " yt" : "")} aria-hidden="true">{yt ? "▶" : "↗"}</span>
              <span className="rtitle">{r.title || h}</span>
              <span className="kv">{yt ? "YouTube" : h}</span>
            </a>
            {edit && <button type="button" className="x" aria-label={"Remove " + r.title} onClick={() => save({ items: items.filter((_, j) => j !== i) })}>×</button>}
          </div>
        );
      })}
      {edit && (
        <form className="resadd" onSubmit={(e) => {
          e.preventDefault();
          let url = rUrl.trim();
          if (!url) return;
          if (!/^https?:\/\//i.test(url)) url = "https://" + url;
          const h = hostOf(url);
          save({ items: [...items, { title: rTitle.trim() || (/youtu/.test(h) ? "YouTube video" : h), url }] });
          setRTitle("");
          setRUrl("");
        }}>
          <input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="Title (optional)" aria-label="Video title" />
          <input value={rUrl} onChange={(e) => setRUrl(e.target.value)} placeholder="Paste a YouTube or web link" aria-label="Video link" />
          <button className="btn sm">Add</button>
        </form>
      )}
    </div>
  );
}
