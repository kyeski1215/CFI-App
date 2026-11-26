import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/* ---- icons (inline so they work offline) ---- */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const Icon = {
  roster: () => (
    <svg viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3 2.4 3.5 5.2" /></svg>
  ),
  mock: () => (
    <svg viewBox="0 0 24 24" {...P}><rect x="5" y="3.5" width="14" height="18" rx="2" /><path d="M9 3.5h6v3H9zM8.5 11l1.5 1.5 3-3M8.5 16.5h7" /></svg>
  ),
  regs: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /><path d="M7 8h1.5M7 11h1.5M16 8h1M16 11h1" /></svg>
  ),
  resources: () => (
    <svg viewBox="0 0 24 24" {...P}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><path d="M17 14v6M14 17h6" /></svg>
  ),
  plane: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M12 3c.9 0 1.5.8 1.5 2v4.5l7 4v2l-7-2v4l2 1.5V21L12 20l-3.5 1v-2l2-1.5v-4l-7 2v-2l7-4V5c0-1.2.6-2 1.5-2z" /></svg>
  ),
  weather: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 10.5 3.75 3.75 0 0 0 7 18z" /><path d="M9 21l1-2M13 21l1-2" /></svg>
  ),
  next: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  chat: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M4 5h16v11H9l-5 4z" /></svg>
  ),
  cards: () => (
    <svg viewBox="0 0 24 24" {...P}><rect x="3" y="6" width="14" height="14" rx="3" /><path d="M7 3h11a3 3 0 0 1 3 3v11" /></svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" {...P}><path d="M5 19V11M12 19V5M19 19v-6" /></svg>
  ),
  more: () => (
    <svg viewBox="0 0 24 24" {...P}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
  ),
  settings: () => (
    <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
  ),
};

/* ---- toast ---- */
type ToastAction = { label: string; run: () => void };
type ToastFn = (msg: string, action?: ToastAction) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; action?: ToastAction } | null>(null);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), t.action ? 8000 : 1800);
    return () => clearTimeout(h);
  }, [t]);
  const show = useCallback<ToastFn>((msg, action) => setT({ msg, action }), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className="toast" role="status">
          {t.msg}
          {t.action && <button className="toastbtn" onClick={() => { t.action!.run(); setT(null); }}>{t.action.label}</button>}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---- clipboard ---- */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text: string, label = "Copied") => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast(label + " ✓");
    },
    [toast],
  );
}

/* ---- modal ---- */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, total, color }: { value: number; total: number; color?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="bar" aria-label={`${value} of ${total}`}>
      <i style={{ width: pct + "%", background: color }} />
    </div>
  );
}

/* ---- iOS list bits ---- */
export const initials = (name: string) => {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "?") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
};
const tintOf = (name: string) => { let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 6; };
/** One color per rating, so a glance at the roster shows who is training for what. */
export const RATING_TONE: Record<string, number> = { "Private Pilot": 5, Instrument: 4, Commercial: 3, "Multi-Engine": 1, CFI: 2, CFII: 0 };
export const toneFor = (goal?: string) => (goal && goal in RATING_TONE ? RATING_TONE[goal] : 6);
export function Avatar({ name, goal, size = 40 }: { name: string; goal?: string; size?: number }) {
  const t = goal === undefined ? tintOf(name) : toneFor(goal);
  return <span className={"av t" + t} style={{ ["--s" as string]: size + "px" }} aria-hidden="true">{initials(name)}</span>;
}
export function RatingDot({ goal }: { goal?: string }) {
  return <span className={"rdot t" + toneFor(goal)} aria-hidden="true" />;
}
/** Small colored square with an icon, for section headers. */
export function IconChip({ icon, tone }: { icon: "next" | "clock" | "chart" | "star" | "log"; tone?: "green" | "orange" | "purple" }) {
  const d = { next: "M5 12h14M13 6l6 6-6 6", clock: "M12 8v4l3 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0", chart: "M5 19V11M12 19V5M19 19v-6", star: "M12 4l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z", log: "M4 20h4L19 9l-4-4L4 16z" }[icon];
  return <span className={"ichip" + (tone ? " " + tone : "")} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></span>;
}
export function Chevron() {
  return <svg className="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>;
}
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="backlink">
      <svg viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2L2 10l8 8" /></svg>
      {label}
    </Link>
  );
}
