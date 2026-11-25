import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isActive } from "../lib/curriculum";
import { useCollection } from "../lib/store";
import type { Student } from "../lib/types";
import { CAT_CLASS, ceiling, densityAltitude, fetchWx, inHg, runwayWinds, visSM, type Metar, type Taf } from "../lib/wx";

const PREF = "cfi.v1.wxprefs";
interface Prefs { airports: string[]; runways: Record<string, string>; magVar: number }
const DEFAULTS: Prefs = { airports: ["KOGD", "KBMC", "KSLC"], runways: { KOGD: "03 07 17 21 25 35" }, magVar: 11 };
function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREF) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}
const rwyList = (s?: string) => (s ?? "").split(/[\s,]+/).map((r) => r.replace(/[^0-9]/g, "").padStart(2, "0")).filter((r) => r !== "00" && +r <= 36);
const ago = (sec: number) => {
  const m = Math.round((Date.now() / 1000 - sec) / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
};
const zulu = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16).replace(":", "") + "Z";

export default function Weather() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [wx, setWx] = useState<{ metars: Metar[]; tafs: Taf[]; fetchedAt: string; cached?: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const students = useCollection<Student>("students");

  const save = (p: Prefs) => {
    setPrefs(p);
    try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* private mode */ }
  };
  const load = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setWx(await fetchWx(prefs.airports));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [prefs.airports]);
  useEffect(() => { load(); }, [load]);

  const home = prefs.airports[0];
  const homeMetar = wx?.metars.find((m) => m.icaoId === home);
  const soloStudents = students.filter((s) => isActive(s) && s.solo && Object.values(s.solo).some((v) => (v ?? "").trim()));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">aviationweather.gov</div>
          <h1>Weather</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setEditing(!editing)}>{editing ? "Done" : "Airports"}</button>
          <button className="btn primary" onClick={load} disabled={busy}>{busy ? "Loading…" : "Refresh"}</button>
        </div>
      </header>

      {editing && <WxSettings prefs={prefs} onSave={save} />}
      {err && <div className="card small" style={{ color: "var(--bad)" }}>{err}</div>}
      {wx?.cached && <div className="small" style={{ color: "var(--warn)" }}>Offline: showing weather from {new Date(wx.fetchedAt).toLocaleTimeString()}.</div>}

      {homeMetar && soloStudents.length > 0 && <SoloCheck m={homeMetar} students={soloStudents} runways={rwyList(prefs.runways[home])} magVar={prefs.magVar} />}

      <section className="list">
        {prefs.airports.map((id) => {
          const m = wx?.metars.find((x) => x.icaoId === id);
          const t = wx?.tafs.find((x) => x.icaoId === id);
          return <Station key={id} id={id} m={m} t={t} runways={rwyList(prefs.runways[id])} magVar={prefs.magVar} loading={busy && !wx} />;
        })}
      </section>

      <section className="card small">
        <b>More weather</b>
        <div className="row">
          <a href="https://aviationweather.gov/gfa/" target="_blank" rel="noreferrer">Graphical forecasts (GFA)</a>
          <a href="https://aviationweather.gov/gairmet/" target="_blank" rel="noreferrer">G-AIRMETs</a>
          <a href="https://aviationweather.gov/progchart/" target="_blank" rel="noreferrer">Prog charts</a>
          <a href="https://www.1800wxbrief.com/" target="_blank" rel="noreferrer">1800wxbrief</a>
        </div>
        <div className="muted">For a legal briefing use Flight Service or ForeFlight. Crosswinds use the magnetic variation set under Airports.</div>
      </section>
    </div>
  );
}

function Station({ id, m, t, runways, magVar, loading }: { id: string; m?: Metar; t?: Taf; runways: string[]; magVar: number; loading: boolean }) {
  if (!m) return <div className="card"><div className="row"><h3>{id}</h3><span className="spacer" /><span className="small muted">{loading ? "Loading…" : "No METAR"}</span></div></div>;
  const ceil = ceiling(m);
  const vis = visSM(m);
  const da = densityAltitude(m);
  const alt = inHg(m.altim);
  const winds = runwayWinds(m, runways, magVar).sort((a, b) => b.head - a.head);
  const wind = m.wspd === 0 ? "Calm" : `${typeof m.wdir === "number" ? String(m.wdir).padStart(3, "0") + "°" : "VRB"} @ ${m.wspd}${m.wgst ? "G" + m.wgst : ""} kt`;
  return (
    <section className="card wxcard">
      <div className="row">
        <h3>{id}</h3>
        {m.fltCat && <span className={"pill " + (CAT_CLASS[m.fltCat] ?? "p-mute")}>{m.fltCat}</span>}
        <span className="spacer" />
        <span className="small muted">{zulu(m.obsTime)} · {ago(m.obsTime)}</span>
      </div>
      {m.name && <div className="small muted">{m.name}</div>}
      <dl className="facts">
        <div><dt>Wind</dt><dd>{wind}</dd></div>
        <div><dt>Visibility</dt><dd>{m.visib ?? "—"} SM</dd></div>
        <div><dt>Ceiling</dt><dd>{ceil == null ? "None" : ceil.toLocaleString() + " ft"}</dd></div>
        <div><dt>Temp / dew</dt><dd>{m.temp ?? "—"}° / {m.dewp ?? "—"}° C</dd></div>
        <div><dt>Altimeter</dt><dd>{alt ? alt.toFixed(2) : "—"}</dd></div>
        <div><dt>Density altitude</dt><dd>{da == null ? "—" : da.toLocaleString() + " ft"}{m.elev != null && <span className="muted"> (field {Math.round(m.elev * 3.28084).toLocaleString()})</span>}</dd></div>
      </dl>
      {winds.length > 0 && (
        <div className="rwys">
          {winds.map((w) => (
            <span key={w.rwy} className={"rwy" + (w.head < 0 ? " tail" : "")}>
              <b>{w.rwy}</b> {w.head >= 0 ? `${w.head} head` : `${-w.head} tail`} · {w.cross} X
            </span>
          ))}
        </div>
      )}
      <pre className="raw">{m.rawOb}</pre>
      {t && <details><summary className="small">TAF</summary><pre className="raw">{t.rawTAF.replace(/ (FM|TEMPO|BECMG|PROB)/g, "\n  $1")}</pre></details>}
      {vis != null && vis < 3 && <div className="small" style={{ color: "var(--bad)" }}>Below basic VFR visibility.</div>}
    </section>
  );
}

function SoloCheck({ m, students, runways, magVar }: { m: Metar; students: Student[]; runways: string[]; magVar: number }) {
  const ceil = ceiling(m);
  const vis = visSM(m);
  const winds = runwayWinds(m, runways, magVar).filter((w) => w.head >= 0);
  const bestX = winds.length ? Math.min(...winds.map((w) => w.cross)) : null;
  const num = (v?: string) => (v && v.trim() ? parseFloat(v) : null);
  return (
    <section className="card">
      <div className="row"><h3>Solo limits at {m.icaoId}</h3><span className="spacer" /><span className="small muted">vs. current METAR</span></div>
      {students.map((s) => {
        const L = s.solo!;
        const fails: string[] = [];
        const w = num(L.maxWind), g = num(L.maxGust), x = num(L.maxXwind), c = num(L.minCeiling), v = num(L.minVis);
        if (w != null && (m.wspd ?? 0) > w) fails.push(`wind ${m.wspd} > ${w}`);
        if (g != null && (m.wgst ?? m.wspd ?? 0) > g) fails.push(`gusts ${m.wgst ?? m.wspd} > ${g}`);
        if (x != null && bestX != null && bestX > x) fails.push(`crosswind ${bestX} > ${x}`);
        if (c != null && ceil != null && ceil < c) fails.push(`ceiling ${ceil} < ${c}`);
        if (v != null && vis != null && vis < v) fails.push(`vis ${vis} < ${v}`);
        const xUnknown = x != null && bestX == null && (m.wspd ?? 0) > 0;
        return (
          <Link key={s.id} to={"/students/" + s.id} className="solorow">
            <span className={"pill " + (fails.length ? "p-bad" : "p-good")}>{fails.length ? "Outside" : "Within"}</span>
            <b>{s.name}</b>
            <span className="small muted">{fails.length ? fails.join(" · ") : xUnknown ? "add runways to check crosswind" : "all limits met"}</span>
          </Link>
        );
      })}
    </section>
  );
}

function WxSettings({ prefs, onSave }: { prefs: Prefs; onSave: (p: Prefs) => void }) {
  const [ids, setIds] = useState(prefs.airports.join(" "));
  return (
    <section className="card">
      <label className="f">Airports (first is home; up to 10)
        <input value={ids} onChange={(e) => setIds(e.target.value.toUpperCase())} onBlur={() => onSave({ ...prefs, airports: ids.split(/[\s,]+/).filter((x) => /^[A-Z0-9]{3,4}$/.test(x)).slice(0, 10) })} />
      </label>
      {prefs.airports.map((id) => (
        <label key={id} className="f">{id} runways (for crosswind), e.g. 03 21 17 35
          <input value={prefs.runways[id] ?? ""} onChange={(e) => onSave({ ...prefs, runways: { ...prefs.runways, [id]: e.target.value } })} />
        </label>
      ))}
      <label className="f">Magnetic variation (° east)
        <input inputMode="decimal" value={prefs.magVar} onChange={(e) => onSave({ ...prefs, magVar: parseFloat(e.target.value) || 0 })} />
      </label>
    </section>
  );
}
