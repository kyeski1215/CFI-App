import { useMemo, useState } from "react";
import { Modal } from "../components/ui";
import { RATINGS, fetchYoutubeTitle, hostOf, isLibraryItem, ratingsOf, youtubeId, type LibraryItem } from "../lib/library";
import { create, put, remove, useCollection } from "../lib/store";
import { useMyCards } from "../lib/sync";
import type { Resource } from "../lib/types";

type Item = LibraryItem & { id?: string; rec?: Resource };

export default function Resources() {
  const recs = useCollection<Resource>("resources");
  const students = useCollection("students");
  const { cards } = useMyCards();
  // A signed-in student (no roster of their own) sees what their instructor recommends for them.
  if (students.length === 0 && cards.length > 0) {
    const seen = new Set<string>();
    const items = cards.flatMap((c) => c.resources ?? []).filter((r) => !seen.has(r.url) && (seen.add(r.url), true));
    return <Library items={items} title="Videos & links" eyebrow="Recommended by your instructor" />;
  }
  const items: Item[] = recs.filter(isLibraryItem).map((r) => ({
    id: r.id, rec: r, title: r.title, url: r.url, ratings: ratingsOf(r), topic: r.topic, note: r.note, pinned: r.pinned,
  }));
  return <Library items={items} title="Resources" eyebrow="Videos & links by rating" editable />;
}

function Library({ items, title, eyebrow, editable }: { items: Item[]; title: string; eyebrow: string; editable?: boolean }) {
  const counts = Object.fromEntries(RATINGS.map((r) => [r, items.filter((i) => i.ratings.includes(r)).length]));
  const firstWithItems = RATINGS.find((r) => counts[r] > 0) ?? "Private";
  const [rating, setRating] = useState<string>(() => {
    try { return localStorage.getItem("cfi.v1.librating") || firstWithItems; } catch { return firstWithItems; }
  });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const pick = (r: string) => {
    setRating(r);
    try { localStorage.setItem("cfi.v1.librating", r); } catch { /* private mode */ }
  };

  const ql = q.trim().toLowerCase();
  const shown = items.filter((i) =>
    ql ? (i.title + " " + (i.topic ?? "") + " " + (i.note ?? "") + " " + i.ratings.join(" ")).toLowerCase().includes(ql) : i.ratings.includes(rating),
  );
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    const pinned = shown.filter((i) => i.pinned);
    if (pinned.length && !ql) m.set("★ Pinned", pinned);
    for (const i of shown) {
      if (i.pinned && !ql) continue;
      const t = i.topic?.trim() || "General";
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(i);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "★ Pinned" ? -1 : b[0] === "★ Pinned" ? 1 : a[0] === "General" ? 1 : b[0] === "General" ? -1 : a[0].localeCompare(b[0])));
  }, [shown, ql]);
  const topics = [...new Set(items.map((i) => i.topic?.trim()).filter(Boolean))] as string[];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        {editable && <button className="btn primary" onClick={() => setEditing("new")}>+ Add video or link</button>}
      </header>

      <input className="search" type="search" placeholder="Search all ratings…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!ql && (
        <div className="ratingpick" role="tablist" aria-label="Rating">
          {RATINGS.map((r) => (
            <button key={r} role="tab" aria-selected={r === rating} onClick={() => pick(r)}>
              {r}{counts[r] ? <span className="cnt"> {counts[r]}</span> : null}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <div className="empty">
          {ql ? "Nothing matches that search." : editable ? `No ${rating} videos or links yet. Tap “+ Add video or link” and pick ${rating}.` : "Nothing here yet."}
        </div>
      )}

      {groups.map(([topic, list]) => (
        <section key={topic} className="list">
          <div className="row"><h2>{topic}</h2><span className="muted small">{list.length}</span></div>
          <div className="vgrid2">
            {list.map((i) => <ItemCard key={i.url + (i.id ?? "")} i={i} showRatings={!!ql} onEdit={editable && i.rec ? () => setEditing(i) : undefined}
              onPin={editable && i.rec ? () => put("resources", { ...i.rec!, pinned: !i.pinned }) : undefined} />)}
          </div>
        </section>
      ))}

      {editing && (
        <EditItem item={editing === "new" ? null : editing} defaultRating={rating} topics={topics} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ItemCard({ i, showRatings, onEdit, onPin }: { i: Item; showRatings: boolean; onEdit?: () => void; onPin?: () => void }) {
  const yt = youtubeId(i.url);
  return (
    <a className="vcard" href={i.url} target="_blank" rel="noreferrer">
      {yt ? (
        <span className="thumb"><img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /><span className="playbadge" aria-hidden="true">▶</span></span>
      ) : (
        <span className="thumb link" aria-hidden="true">↗<small>{hostOf(i.url)}</small></span>
      )}
      <span className="vbody">
        <span className="vtitle">{i.title}</span>
        {i.note && <span className="vnote">{i.note}</span>}
        <span className="vmeta">{yt ? "YouTube" : hostOf(i.url)}{showRatings ? " · " + i.ratings.join(", ") : ""}</span>
      </span>
      {(onEdit || onPin) && (
        <span className="vacts">
          {onPin && <button aria-label={i.pinned ? "Unpin" : "Pin"} className={i.pinned ? "on" : ""} onClick={(e) => { e.preventDefault(); onPin(); }}>{i.pinned ? "★" : "☆"}</button>}
          {onEdit && <button aria-label="Edit" onClick={(e) => { e.preventDefault(); onEdit(); }}>✎</button>}
        </span>
      )}
    </a>
  );
}

function EditItem({ item, defaultRating, topics, onClose }: { item: Item | null; defaultRating: string; topics: string[]; onClose: () => void }) {
  const [url, setUrl] = useState(item?.url ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [ratings, setRatings] = useState<string[]>(item?.ratings ?? [defaultRating]);
  const [topic, setTopic] = useState(item?.topic ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const [looking, setLooking] = useState(false);

  const norm = (u: string) => (u.trim() && !/^[a-z]+:/i.test(u.trim()) ? "https://" + u.trim() : u.trim());
  const lookup = async (u: string) => {
    if (title.trim() || !youtubeId(norm(u))) return;
    setLooking(true);
    const t = await fetchYoutubeTitle(norm(u));
    setLooking(false);
    if (t) setTitle((cur) => cur || t);
  };
  const toggle = (r: string) => setRatings((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  return (
    <Modal title={item ? "Edit" : "Add video or link"} onClose={onClose}>
      <form className="fields" onSubmit={(e) => {
        e.preventDefault();
        const u = norm(url);
        if (!u) return;
        const fields = {
          url: u,
          title: title.trim() || (youtubeId(u) ? "YouTube video" : hostOf(u)),
          ratings: ratings.length ? ratings : ["General"],
          topic: topic.trim() || undefined,
          note: note.trim() || undefined,
        };
        if (item?.rec) put("resources", { ...item.rec, ...fields });
        else create<Resource>("resources", fields);
        onClose();
      }}>
        <label className="f full">Link
          <input autoFocus={!item} required value={url} placeholder="Paste a YouTube or web link" onChange={(e) => setUrl(e.target.value)} onBlur={(e) => lookup(e.target.value)} />
        </label>
        <label className="f full">Title{looking ? " (looking up…)" : ""}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Power-off stalls explained" />
        </label>
        <div className="full">
          <div className="kv" style={{ marginBottom: 6 }}>Recommended for</div>
          <div className="chips">
            {RATINGS.map((r) => <button key={r} type="button" className="chip" aria-pressed={ratings.includes(r)} onClick={() => toggle(r)}>{r}</button>)}
          </div>
        </div>
        <label className="f">Topic (optional)
          <input list="libtopics" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Stalls" />
          <datalist id="libtopics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className="f">Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Watch before F3" />
        </label>
        <div className="row full">
          {item?.rec && (confirmDel ? (
            <>
              <button type="button" className="btn danger sm" onClick={() => { remove("resources", item.rec!.id); onClose(); }}>Yes, delete</button>
              <button type="button" className="btn sm" onClick={() => setConfirmDel(false)}>Keep</button>
            </>
          ) : <button type="button" className="btn danger sm" onClick={() => setConfirmDel(true)}>Delete</button>)}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
