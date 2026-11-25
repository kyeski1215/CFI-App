import { useEffect, useState } from "react";
import { useCopy } from "../components/ui";
import { create, fmtDate, getRaw, importAll, newId, put, remove, todayStr, useCollection, type BaseRec } from "../lib/store";

export interface AircraftLink { title: string; url: string; kind: string }
export interface Squawk { id: string; date: string; tail?: string; text: string; resolved?: boolean }
export interface AircraftRec extends BaseRec {
  name: string;
  tails?: string; // "N301BL N402BL"
  links?: AircraftLink[];
  vspeeds?: Record<string, string>;
  notes?: string;
  squawks?: Squawk[];
}

const KINDS = ["POH / AFM", "Checklist", "ForeFlight", "Guide", "W&B / performance", "Video", "Other"];
const VSPEEDS = ["Vr", "Vx", "Vy", "Va", "Vfe", "Vno", "Vne", "Vso", "Vs1", "Best glide", "Approach", "Max demo crosswind"];
const A = "https://claude.ai/artifact/";

// Blitz fleet, from the instructor's Google Drive aircraft folder. Fixed ids and an old timestamp
// (SEED_V) so these fill in on every device without overwriting anything edited in the app.
const SEED_V = 3;
const SEED: AircraftRec[] = [
  {
    id: "ac-p100i", name: "Piper Pilot 100i", tails: "", createdAt: 1, updatedAt: SEED_V, links: [
      { title: "POH", url: "https://drive.google.com/file/d/1AZxbMn3_mrU6jL2jf8VUGw-qWI2Ztc-W/view", kind: "POH / AFM" },
      { title: "GFC 500 autopilot supplement", url: "https://drive.google.com/file/d/19a1bd7iEjVfPa3cAM09NnnZJ9ewHTLIt/view", kind: "POH / AFM" },
      { title: "Type certificate data sheet (TCDS)", url: "https://drive.google.com/file/d/1vGjPLKa6GprdDyowuhaMxyRmcDo5KziP/view", kind: "Other" },
      { title: "ForeFlight checklist (.fmd)", url: "https://drive.google.com/file/d/1s8hN4K3LYXxUZoSBKsGl3ycoO8RZM1PQ/view", kind: "ForeFlight" },
      { title: "Pilot 100i traffic pattern", url: A + "SGs6v2h9nMvKj8saRKwQJu", kind: "Guide" },
    ],
  },
  {
    id: "ac-n9547w", name: "N9547W · Cessna 172R (180 hp)", tails: "N9547W", createdAt: 1, updatedAt: SEED_V, links: [
      { title: "POH", url: "https://drive.google.com/file/d/1-GjgHgMXJi2ySlt3G9b6Qdez4K_8Sk9J/view", kind: "POH / AFM" },
      { title: "180 hp / 2,550 lb STC supplement (Air Plains)", url: "https://drive.google.com/file/d/147-bDCC2FcgkvPLNotTmVrKqRFX4uRo5/view", kind: "POH / AFM" },
      { title: "Weight & balance", url: "https://drive.google.com/file/d/1vMVA3O99QMpF83xhKrCSHEI47gCHAr0O/view", kind: "W&B / performance" },
      { title: "Equipment list", url: "https://drive.google.com/file/d/1QrtRdRZkie5W3rSUT1Qi4I7HSZpw8pzW/view", kind: "Other" },
      { title: "ForeFlight checklist (.fmd)", url: "https://drive.google.com/file/d/1B4SmKbdG1MdFYUHysOTmOKblp98xLQoN/view", kind: "ForeFlight" },
    ],
  },
  {
    id: "ac-n99832", name: "N99832 · Cessna 172P (Air Plains STC)", tails: "N99832", createdAt: 1, updatedAt: SEED_V, links: [
      { title: "POH", url: "https://drive.google.com/file/d/1tHnWYZjYfPJr9U4BjSmeXLBeIcZxrhkq/view", kind: "POH / AFM" },
      { title: "STC supplement (Air Plains, 2,550 lb)", url: "https://drive.google.com/file/d/1ay4qNuxWoxZiasZ8AHzSsZuIXvsvVNxn/view", kind: "POH / AFM" },
      { title: "Weight & balance", url: "https://drive.google.com/file/d/1JZJOrEaSwHIf3NUj5Jkf7oTUcJM1RZMB/view", kind: "W&B / performance" },
      { title: "ForeFlight checklist (.fmd)", url: "https://drive.google.com/file/d/1eqpDcBFeyFqjwodfihhI-dTgArOiRVyw/view", kind: "ForeFlight" },
    ],
  },
  {
    id: "ac-n122xp", name: "N122XP · Cessna R172K", tails: "N122XP", createdAt: 1, updatedAt: SEED_V, links: [
      { title: "POH", url: "https://drive.google.com/file/d/1Jpue1ao7N-yy9C6eH1PRNhUNKzrMfgi3/view", kind: "POH / AFM" },
      { title: "Weight & balance", url: "https://drive.google.com/file/d/1jSmUk0XEUMOAf5CUZYxDVSH5WU7s5V1y/view", kind: "W&B / performance" },
      { title: "ForeFlight checklist (.fmd)", url: "https://drive.google.com/file/d/1nT_jIUd0uIVSxjLhgzwTm0gsBTAVDIoF/view", kind: "ForeFlight" },
    ],
  },
  {
    id: "ac-n2569q", name: "N2569Q", tails: "N2569Q", createdAt: 1, updatedAt: SEED_V, links: [
      { title: "POH", url: "https://drive.google.com/file/d/1nL3rDl_Xn5AAIMUS2RkXVzYvrwTLH6bw/view", kind: "POH / AFM" },
      { title: "SureFly electronic ignition supplement", url: "https://drive.google.com/file/d/1ieZtHkbYzFOKqF-B1PIjXKFU_RiMmGQm/view", kind: "POH / AFM" },
    ],
  },
  {
    id: "ac-n8145r", name: "N8145R · Beechcraft Baron B55", tails: "N8145R", createdAt: 1, updatedAt: SEED_V, links: [
      { title: "POH (B55)", url: "https://drive.google.com/file/d/1bhaD2WSSLOxkE-edDeZEwHy2hFTcbBdr/view", kind: "POH / AFM" },
    ],
  },
  // The generic Cessna 172 card is replaced by one card per Cessna tail.
  { id: "ac-c172", name: "Cessna 172", createdAt: 1, updatedAt: SEED_V, deleted: true },
];

export default function Aircraft() {
  const list = useCollection<AircraftRec>("aircraft");
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    // Fill in or update a seed only when this device has no newer copy (edits in the app are always newer).
    const due = SEED.filter((s) => (getRaw("aircraft", s.id)?.updatedAt ?? 0) < s.updatedAt);
    if (due.length) importAll({ data: { aircraft: due } });
  }, []);
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Blitz fleet</div>
          <h1>Aircraft</h1>
        </div>
      </header>
      <form className="row" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const r = create<AircraftRec>("aircraft", { name: name.trim(), links: [] });
        setOpen(r.id);
        setName("");
      }}>
        <input placeholder="Add an aircraft type, e.g. Piper Seminole" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn primary">Add</button>
      </form>
      {sorted.map((a) => <AircraftCard key={a.id} a={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} />)}
    </div>
  );
}

function AircraftCard({ a, open, onToggle }: { a: AircraftRec; open: boolean; onToggle: () => void }) {
  const update = (p: Partial<AircraftRec>) => put("aircraft", { ...a, ...p });
  const links = a.links ?? [];
  const openSq = (a.squawks ?? []).filter((q) => !q.resolved);
  return (
    <section className="card">
      <button className="acsum" onClick={onToggle} aria-expanded={open}>
        <span>
          <span className="acname">{a.name}</span>
          <span className="small muted">{[a.tails, `${links.length} resource${links.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span>
        </span>
        {openSq.length > 0 && <span className="pill p-warn">{openSq.length} squawk{openSq.length === 1 ? "" : "s"}</span>}
        <span className="chev" aria-hidden="true">›</span>
      </button>
      {!open && links.length > 0 && (
        <div className="aclinks">
          {links.slice(0, 4).map((l, i) => <a key={i} className="chiplink" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>)}
        </div>
      )}
      {open && <AircraftDetail a={a} update={update} />}
    </section>
  );
}

function AircraftDetail({ a, update }: { a: AircraftRec; update: (p: Partial<AircraftRec>) => void }) {
  const copy = useCopy();
  const [lt, setLt] = useState("");
  const [lu, setLu] = useState("");
  const [lk, setLk] = useState(KINDS[0]);
  const [sq, setSq] = useState("");
  const [sqTail, setSqTail] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const links = a.links ?? [];
  const vs = a.vspeeds ?? {};
  const tails = (a.tails ?? "").split(/[\s,]+/).filter(Boolean);
  const byKind = KINDS.map((k) => ({ k, items: links.map((l, i) => ({ l, i })).filter((x) => (KINDS.includes(x.l.kind) ? x.l.kind : "Other") === k) })).filter((g) => g.items.length);

  return (
    <div className="acdetail">
      <label className="f">Name<input value={a.name} onChange={(e) => update({ name: e.target.value })} /></label>
      <label className="f">Tail numbers<input value={a.tails ?? ""} placeholder="N301BL N402BL" onChange={(e) => update({ tails: e.target.value.toUpperCase() })} /></label>

      <div>
        <div className="xhead"><span>Documents & resources</span></div>
        {byKind.length === 0 && <div className="small muted">Add the POH, ForeFlight checklist link, W&B sheet and anything else for this airplane.</div>}
        {byKind.map((g) => (
          <div key={g.k} className="acgroup">
            <div className="kv">{g.k}</div>
            {g.items.map(({ l, i }) => (
              <div key={i} className="resrow">
                <a className="res" href={l.url} target="_blank" rel="noreferrer"><span className="play" aria-hidden="true">↗</span><span className="rtitle">{l.title}</span></a>
                <button type="button" className="x" aria-label={"Remove " + l.title} onClick={() => update({ links: links.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
          </div>
        ))}
        <form className="resadd" onSubmit={(e) => {
          e.preventDefault();
          let url = lu.trim();
          if (!url) return;
          if (!/^[a-z]+:/i.test(url)) url = "https://" + url;
          update({ links: [...links, { title: lt.trim() || lk, url, kind: lk }] });
          setLt("");
          setLu("");
        }}>
          <select value={lk} onChange={(e) => setLk(e.target.value)} aria-label="Type">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <input value={lt} onChange={(e) => setLt(e.target.value)} placeholder="Title" aria-label="Title" />
          <input value={lu} onChange={(e) => setLu(e.target.value)} placeholder="Link (Google Drive PDF, ForeFlight share link…)" aria-label="Link" />
          <button className="btn sm">Add</button>
        </form>
        <div className="small muted">For a POH PDF, upload it to Google Drive or Dropbox and paste the share link. A ForeFlight checklist can be shared as a link from ForeFlight.</div>
      </div>

      <div>
        <div className="xhead"><span>V-speeds (KIAS, from the POH)</span><button type="button" className="linkbtn" onClick={() => copy(VSPEEDS.filter((k) => vs[k]).map((k) => `${k} ${vs[k]}`).join(" · "), "V-speeds copied")}>Copy</button></div>
        <div className="vgrid">
          {VSPEEDS.map((k) => (
            <label key={k} className="f">{k}<input inputMode="numeric" value={vs[k] ?? ""} onChange={(e) => update({ vspeeds: { ...vs, [k]: e.target.value } })} /></label>
          ))}
        </div>
      </div>

      <div>
        <div className="xhead"><span>Squawks</span></div>
        {(a.squawks ?? []).length === 0 && <div className="small muted">None noted.</div>}
        {[...(a.squawks ?? [])].sort((x, y) => Number(!!x.resolved) - Number(!!y.resolved) || y.date.localeCompare(x.date)).map((q) => (
          <label key={q.id} className={"check" + (q.resolved ? " done" : "")}>
            <input type="checkbox" checked={!!q.resolved} onChange={() => update({ squawks: (a.squawks ?? []).map((x) => (x.id === q.id ? { ...x, resolved: !x.resolved } : x)) })} />
            <span className="ct"><span>{q.text}</span><small>{fmtDate(q.date)}{q.tail ? " · " + q.tail : ""}{q.resolved ? " · fixed" : ""}</small></span>
          </label>
        ))}
        <form className="resadd" onSubmit={(e) => {
          e.preventDefault();
          if (!sq.trim()) return;
          update({ squawks: [...(a.squawks ?? []), { id: newId(), date: todayStr(), tail: sqTail || undefined, text: sq.trim() }] });
          setSq("");
        }}>
          {tails.length > 0 && <select value={sqTail} onChange={(e) => setSqTail(e.target.value)} aria-label="Tail"><option value="">Tail</option>{tails.map((t) => <option key={t}>{t}</option>)}</select>}
          <input value={sq} onChange={(e) => setSq(e.target.value)} placeholder="e.g. Left brake soft" aria-label="Squawk" />
          <button className="btn sm">Add</button>
        </form>
      </div>

      <label className="f">Notes<textarea value={a.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} placeholder="Flows, quirks, Blitz procedures for this airplane…" /></label>

      <div className="row">
        {confirmDel ? (
          <>
            <span className="small">Delete {a.name}?</span>
            <button className="btn danger sm" onClick={() => remove("aircraft", a.id)}>Yes, delete</button>
            <button className="btn sm" onClick={() => setConfirmDel(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn danger sm" onClick={() => setConfirmDel(true)}>Delete aircraft</button>
        )}
      </div>
    </div>
  );
}
