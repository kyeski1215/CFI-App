import { useMemo, useState } from "react";
import { Modal } from "../components/ui";
import { BUILTIN_RESOURCES, DEFAULT_CATEGORIES } from "../lib/resources";
import { create, put, remove, useCollection } from "../lib/store";
import type { Resource } from "../lib/types";

interface Item {
  key: string;
  title: string;
  url: string;
  category: string;
  desc?: string;
  icon?: string;
  pinned?: boolean;
  builtinId?: string;
  rec?: Resource; // user record, if any
}

export default function Resources() {
  const recs = useCollection<Resource>("resources");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // Built-ins merged with user overrides, then user-only resources.
  const items: Item[] = useMemo(() => {
    const byBuiltin = new Map(recs.filter((r) => r.builtinId).map((r) => [r.builtinId!, r]));
    const builtins = BUILTIN_RESOURCES.map((b) => {
      const o = byBuiltin.get(b.id);
      return { key: "b:" + b.id, builtinId: b.id, ...b, ...(o ? { title: o.title, url: o.url, category: o.category, desc: o.desc, icon: o.icon, pinned: o.pinned } : {}), rec: o };
    });
    const mine = recs.filter((r) => !r.builtinId).map((r) => ({ key: r.id, ...r, rec: r }));
    return [...builtins, ...mine];
  }, [recs]);

  const visible = items.filter((i) => !i.rec?.hidden);
  const hidden = items.filter((i) => i.rec?.hidden);
  const cats = [...new Set([...DEFAULT_CATEGORIES, ...visible.map((i) => i.category)])];
  const filtered = visible.filter(
    (i) =>
      (cat === "All" || (cat === "★ Pinned" ? i.pinned : i.category === cat)) &&
      (!q || (i.title + " " + (i.desc ?? "") + " " + i.category).toLowerCase().includes(q.toLowerCase())),
  );
  const pinned = filtered.filter((i) => i.pinned);

  const saveItem = (i: Item, patch: Partial<Resource>) => {
    if (i.rec) return put("resources", { ...i.rec, ...patch });
    // first change to a built-in: create an override record
    return create<Resource>("resources", {
      builtinId: i.builtinId, title: i.title, url: i.url, category: i.category, desc: i.desc, icon: i.icon, pinned: i.pinned, ...patch,
    });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Everything in one place</div>
          <h1>Resources</h1>
        </div>
        <button className="btn primary" onClick={() => setEditing("new")}>+ Add resource</button>
      </header>
      <div className="row">
        <input className="search" type="search" placeholder="Search resources…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <div className="chips">
          {["All", "★ Pinned", ...cats].map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      {cat === "All" && !q && pinned.length > 0 && <Section title="★ Pinned" list={pinned} onEdit={setEditing} onSave={saveItem} />}
      {cat === "★ Pinned" ? (
        <Section title="★ Pinned" list={pinned} onEdit={setEditing} onSave={saveItem} />
      ) : (
        cats.map((c) => <Section key={c} title={c} list={filtered.filter((i) => i.category === c)} onEdit={setEditing} onSave={saveItem} />)
      )}
      {filtered.length === 0 && <div className="empty">Nothing here yet.</div>}

      {hidden.length > 0 && (
        <section className="list">
          <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? "Hide" : "Show"} {hidden.length} hidden
          </button>
          {showHidden && hidden.map((i) => (
            <div key={i.key} className="row card" style={{ flexDirection: "row" }}>
              <span>{i.icon} {i.title}</span><span className="spacer" />
              <button className="btn sm" onClick={() => saveItem(i, { hidden: false })}>Restore</button>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <EditResource
          item={editing === "new" ? null : editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (editing === "new") create<Resource>("resources", { title: "", url: "", category: cats[0], ...patch } as Omit<Resource, "id" | "createdAt" | "updatedAt">);
            else saveItem(editing, patch);
            setEditing(null);
          }}
          onRemove={() => {
            if (editing === "new") return;
            if (editing.builtinId) saveItem(editing, { hidden: true });
            else if (editing.rec) remove("resources", editing.rec.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, list, onEdit, onSave }: { title: string; list: Item[]; onEdit: (i: Item) => void; onSave: (i: Item, p: Partial<Resource>) => void }) {
  if (!list.length) return null;
  return (
    <section className="list">
      <div className="row"><h2>{title}</h2><span className="muted small">{list.length}</span></div>
      <div className="rgrid">
        {list.map((i) => (
          <a key={i.key} className="rcard" href={i.url} target="_blank" rel="noreferrer">
            <div className="ic">{i.icon || "🔗"}</div>
            <div>
              <div className="rt">{i.title}</div>
              {i.desc && <div className="rd">{i.desc}</div>}
            </div>
            <div className="acts">
              <button aria-label={i.pinned ? "Unpin" : "Pin"} className={i.pinned ? "on" : ""}
                onClick={(e) => { e.preventDefault(); onSave(i, { pinned: !i.pinned }); }}>{i.pinned ? "★" : "☆"}</button>
              <button aria-label="Edit" onClick={(e) => { e.preventDefault(); onEdit(i); }}>✎</button>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function EditResource({ item, cats, onClose, onSave, onRemove }: {
  item: Item | null; cats: string[]; onClose: () => void; onSave: (p: Partial<Resource>) => void; onRemove: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [category, setCategory] = useState(item?.category ?? cats[0]);
  const [desc, setDesc] = useState(item?.desc ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "🔗");
  return (
    <Modal title={item ? "Edit resource" : "Add resource"} onClose={onClose}>
      <form className="fields" onSubmit={(e) => {
        e.preventDefault();
        let u = url.trim();
        if (u && !/^[a-z]+:/i.test(u)) u = "https://" + u;
        onSave({ title: title.trim(), url: u, category: category.trim() || "Other", desc: desc.trim(), icon: icon.trim() || "🔗" });
      }}>
        <label className="f full">Title<input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Blitz rate sheet" /></label>
        <label className="f full">Link<input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (artifact, Google Doc, YouTube, PDF…)" /></label>
        <label className="f">Category
          <input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="f">Icon (emoji)<input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></label>
        <label className="f full">Description<input value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <div className="row full">
          {item && <button type="button" className="btn danger sm" onClick={onRemove}>{item.builtinId ? "Hide" : "Delete"}</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
