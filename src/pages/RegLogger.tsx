import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCopy } from "../components/ui";
import { REG_TABS, formatRegs, goalToRegTab, regKey, type Cls, type RegItem } from "../lib/regs";
import { useCollection } from "../lib/store";
import type { Student } from "../lib/types";

const PREF_KEY = "cfi.v1.regprefs";
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as { tab?: string; cls?: Cls; fmt?: "compact" | "full" };
  } catch {
    return {};
  }
}

export default function RegLogger() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const copy = useCopy();
  const students = useCollection<Student>("students");
  const prefs = loadPrefs();
  const [studentId, setStudentId] = useState(params.get("student") ?? "");
  const student = students.find((s) => s.id === studentId);
  const [tab, setTab] = useState(student ? goalToRegTab(student.goal) : REG_TABS[prefs.tab ?? ""] ? prefs.tab! : "PPL");
  const [cls, setCls] = useState<Cls>(student?.goal === "Multi-Engine" ? "ME" : (prefs.cls ?? "SE"));
  const [fmt, setFmt] = useState<"compact" | "full">(prefs.fmt ?? "compact");
  const [sel, setSel] = useState<Map<string, RegItem>>(new Map());

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ tab, cls, fmt }));
    } catch {
      /* private mode */
    }
  }, [tab, cls, fmt]);

  const d = REG_TABS[tab];
  const groups = d.build(cls);
  const text = useMemo(() => formatRegs([...sel.values()], fmt), [sel, fmt]);

  const toggle = (i: RegItem) => {
    const n = new Map(sel);
    n.has(regKey(i)) ? n.delete(regKey(i)) : n.set(regKey(i), i);
    setSel(n);
  };

  return (
    <div className="page" style={{ paddingBottom: 200 }}>
      <header className="page-head">
        <div>
          <h1>Logbook Reg Logger</h1>
          <p className="muted small" style={{ margin: "4px 0 0" }}>Tap what you covered. Copy the reg line into the logbook, or save it to the student's lesson log.</p>
        </div>
      </header>

      <div className="ratingpick" role="tablist" aria-label="Rating">
        {Object.entries(REG_TABS).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={k === tab} onClick={() => setTab(k)}>{v.name}</button>
        ))}
      </div>
      {d.cls && (
        <div className="seg">
          {(["SE", "ME"] as Cls[]).map((c) => (
            <button key={c} aria-pressed={c === cls} onClick={() => setCls(c)}>{c === "SE" ? "Single-engine" : "Multi-engine"}</button>
          ))}
        </div>
      )}

      {groups.map((g) => {
        const allOn = g.items.every((i) => sel.has(regKey(i)));
        return (
          <section key={g.t} className="list">
            <div className="row">
              <h2>{g.t}</h2>
              {g.s && <span className="muted small">14 CFR {g.s}</span>}
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => {
                const n = new Map(sel);
                g.items.forEach((i) => (allOn ? n.delete(regKey(i)) : n.set(regKey(i), i)));
                setSel(n);
              }}>{allOn ? "Clear group" : "Select all"}</button>
            </div>
            <div className="regchips">
              {g.items.map((i) => (
                <button key={regKey(i)} className="regchip" aria-pressed={sel.has(regKey(i))} onClick={() => toggle(i)}>
                  <b>{i.sec}{i.p}</b><span>{i.n}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <p className="muted small">Paragraph numbers checked against the eCFR (14 CFR Part 61), Nov 2026. Regs change — spot-check at <a href="https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61" target="_blank" rel="noreferrer">ecfr.gov</a>.</p>

      <div className="regout">
        <div className="in">
          <div className="row">
            <div className="seg">
              <button aria-pressed={fmt === "compact"} onClick={() => setFmt("compact")}>Compact</button>
              <button aria-pressed={fmt === "full"} onClick={() => setFmt("full")}>With names</button>
            </div>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ flex: "1 1 160px", maxWidth: 260, fontSize: 14 }} aria-label="Student">
              <option value="">No student</option>
              {[...students].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="spacer" />
            <span className="small muted">{sel.size} selected</span>
          </div>
          <div className={"regtext" + (text ? "" : " empty-t")}>{text || "Nothing selected yet"}</div>
          <div className="row">
            <button className="btn primary" style={{ flex: 1 }} disabled={!text} onClick={() => copy(text)}>Copy</button>
            {student && (
              <button className="btn blue" disabled={!text}
                onClick={() => nav(`/students/${student.id}?tab=Log&regs=${encodeURIComponent(formatRegs([...sel.values()], "compact"))}`)}>
                Add to {student.name.split(" ")[0]}'s log
              </button>
            )}
            <button className="btn" onClick={() => setSel(new Map())}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}
