// METAR/TAF via the "wx" Edge Function (aviationweather.gov blocks direct browser requests).
import { supabase } from "./sync";

export interface Metar {
  icaoId: string; name?: string; obsTime: number; rawOb: string; fltCat?: string;
  temp?: number; dewp?: number; wdir?: number | string; wspd?: number; wgst?: number;
  visib?: number | string; altim?: number; elev?: number;
  clouds?: { cover: string; base?: number }[];
}
export interface Taf { icaoId: string; rawTAF: string; issueTime?: string }

const CACHE = "cfi.v1.wxcache";
export async function fetchWx(ids: string[]): Promise<{ metars: Metar[]; tafs: Taf[]; fetchedAt: string; cached?: boolean }> {
  if (!supabase) throw new Error("Weather needs cloud sync, which isn't set up in this copy of the app.");
  const { data, error } = await supabase.functions.invoke("wx", { body: { ids: ids.join(",") } });
  if (error) {
    let msg = error.message;
    try {
      const b = await (error as { context?: Response }).context?.json();
      if (b?.error) msg = b.error;
    } catch { /* keep */ }
    if (/Failed to send|not found|404/i.test(msg)) msg = "The weather function isn't deployed yet. See README → Weather.";
    const cached = readCache();
    if (cached) return { ...cached, cached: true };
    throw new Error(msg);
  }
  try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch { /* ignore */ }
  return data;
}
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE) ?? "null"); } catch { return null; }
}

/** Lowest broken/overcast/vertical-visibility layer, in ft AGL; null if none. */
export function ceiling(m: Metar) {
  const c = (m.clouds ?? []).filter((x) => ["BKN", "OVC", "OVX", "VV"].includes(x.cover) && x.base != null).map((x) => x.base!);
  return c.length ? Math.min(...c) : null;
}
export const visSM = (m: Metar) => (m.visib == null ? null : typeof m.visib === "number" ? m.visib : parseFloat(String(m.visib).replace("+", "")));
export const inHg = (hPa?: number) => (hPa ? hPa * 0.0295300 : null);

/** Density altitude (ft) from field elevation, altimeter setting and temperature. */
export function densityAltitude(m: Metar) {
  const alt = inHg(m.altim);
  if (m.elev == null || alt == null || m.temp == null) return null;
  const elevFt = m.elev * 3.28084;
  const pa = elevFt + (29.92 - alt) * 1000;
  const isa = 15 - (2 * pa) / 1000;
  return Math.round(pa + 120 * (m.temp - isa));
}

/** Headwind / crosswind for each runway. Runway numbers are magnetic; METAR wind is true, so subtract east variation. */
export function runwayWinds(m: Metar, runways: string[], magVarEast: number) {
  if (typeof m.wdir !== "number" || !m.wspd) return [];
  const windMag = (m.wdir - magVarEast + 360) % 360;
  const speed = Math.max(m.wspd, m.wgst ?? 0);
  return runways.map((r) => {
    const hdg = (parseInt(r, 10) % 36) * 10 || 360;
    const ang = ((windMag - hdg) * Math.PI) / 180;
    return { rwy: r, head: Math.round(Math.cos(ang) * speed), cross: Math.round(Math.abs(Math.sin(ang) * speed)), steady: Math.round(Math.abs(Math.sin(ang) * (m.wspd ?? 0))) };
  });
}

export const CAT_CLASS: Record<string, string> = { VFR: "p-good", MVFR: "p-blue", IFR: "p-bad", LIFR: "p-acc" };
