// Pull down at the top of the page to refresh (student side), like a native app.
import { useEffect, useRef, useState } from "react";

export default function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> | void }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  useEffect(() => {
    const down = (e: TouchEvent) => { start.current = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null; };
    const move = (e: TouchEvent) => {
      if (start.current == null) return;
      const d = e.touches[0].clientY - start.current;
      setPull(d > 0 ? Math.min(110, d * 0.5) : 0);
    };
    const up = async () => {
      if (start.current == null) return;
      start.current = null;
      if (pull >= 60) {
        setBusy(true);
        setPull(60);
        try { await onRefresh(); } finally { setBusy(false); setPull(0); }
      } else setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [pull, busy, onRefresh]);
  if (!pull && !busy) return null;
  return (
    <div className={"ptr" + (busy ? " spin" : "")} style={{ transform: `translate(-50%, ${pull - 40}px) rotate(${busy ? 0 : pull * 3}deg)`, opacity: Math.min(1, pull / 60) }} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
    </div>
  );
}
