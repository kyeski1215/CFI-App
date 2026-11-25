import { useState } from "react";
import { useCopy } from "../components/ui";
import { create, fmtDate, newId, put, remove, snapshot, todayStr, useCollection, type BaseRec } from "../lib/store";
import { useSharedFleet, type AircraftShared } from "../lib/sync";

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

export default function Aircraft() {
  const list = useCollection<AircraftRec>("aircraft");
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  const students = useCollection("students");
  const fleet = useSharedFleet().items;
  const fleetSorted = [...fleet].sort((a, b) => a.name.localeCompare(b.name));
  const studentOnly = students.length === 0 && list.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Blitz fleet</div>
          <h1>Aircraft</h1>
        </div>
      </header>
      {fleetSorted.length > 0 && (
        <section className="list">
          {!studentOnly && <div className="row"><h2>Blitz fleet</h2><span className="muted small">shared, read-only</span></div>}
          {fleetSorted.map((a) => <FleetCard key={a.id} a={a} open={open === "f-" + a.id} onToggle={() => setOpen(open === "f-" + a.id ? null : "f-" + a.id)} />)}
        </section>
      )}
      {studentOnly && fleetSorted.length === 0 && <div className="empty">No aircraft shared with you yet.</div>}
      {!studentOnly && fleetSorted.length > 0 && <div className="row"><h2>My aircraft</h2></div>}
      {!studentOnly && <form className="row" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const r = create<AircraftRec>("aircraft", { name: name.trim(), links: [] });
        setOpen(r.id);
        setName("");
      }}>
        <input placeholder="Add an aircraft type, e.g. Piper Seminole" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn primary">Add</button>
      </form>}
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
          {links.map((l, i) => <a key={i} className="chiplink" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>)}
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
            <button className="btn danger sm" onClick={() => { snapshot("Before deleting " + a.name, ["aircraft"]); remove("aircraft", a.id); }}>Yes, delete</button>
            <button className="btn sm" onClick={() => setConfirmDel(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn danger sm" onClick={() => setConfirmDel(true)}>Delete aircraft</button>
        )}
      </div>
    </div>
  );
}

function FleetCard({ a, open, onToggle }: { a: AircraftShared; open: boolean; onToggle: () => void }) {
  const links = a.links ?? [];
  const vs = Object.entries(a.vspeeds ?? {}).filter(([, v]) => v);
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
      {links.length > 0 && (
        <div className="aclinks">
          {links.map((l, i) => <a key={i} className="chiplink" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>)}
        </div>
      )}
      {open && (
        <div className="acdetail">
          {vs.length > 0 && (
            <div>
              <div className="xhead"><span>V-speeds (KIAS)</span></div>
              <dl className="facts vfacts">{vs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          )}
          {openSq.length > 0 && (
            <div>
              <div className="xhead"><span>Open squawks</span></div>
              {openSq.map((q) => <div key={q.id} className="small">• {q.text} <span className="muted">({fmtDate(q.date)}{q.tail ? " · " + q.tail : ""})</span></div>)}
            </div>
          )}
          {a.notes && <p className="small" style={{ margin: 0, whiteSpace: "pre-line" }}>{a.notes}</p>}
          {!vs.length && !openSq.length && !a.notes && <div className="small muted">No V-speeds or notes added yet.</div>}
        </div>
      )}
    </section>
  );
}
