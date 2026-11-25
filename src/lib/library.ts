// Recommended videos and links, organized by rating.
import type { Resource, Student } from "./types";

export const RATINGS = ["Private", "Instrument", "Commercial", "Multi-Engine", "CFI", "CFII", "General"] as const;

export const goalToRating = (goal: string) =>
  ({ "Private Pilot": "Private", Instrument: "Instrument", Commercial: "Commercial", "Multi-Engine": "Multi-Engine", CFI: "CFI", CFII: "CFII" })[goal] ?? "General";

/** Records made by the old artifact-link Resources page are left out. */
export const isLibraryItem = (r: Resource) => !r.builtinId && !r.hidden && !!r.url;
export const ratingsOf = (r: Resource) => (r.ratings?.length ? r.ratings : ["General"]);

export function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}
export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Best-effort video title from YouTube's public oEmbed endpoint; null if the browser blocks it. */
export async function fetchYoutubeTitle(url: string): Promise<string | null> {
  try {
    const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url));
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.title === "string" ? j.title : null;
  } catch {
    return null;
  }
}

/** What a student sees: their rating plus General. */
export function libraryFor(s: Student, items: Resource[]) {
  const mine = goalToRating(s.goal);
  return items
    .filter(isLibraryItem)
    .filter((r) => ratingsOf(r).some((x) => x === mine || x === "General"))
    .map(({ title, url, ratings, topic, note, pinned }) => ({ title, url, ratings: ratings ?? ["General"], topic, note, pinned }));
}
export type LibraryItem = ReturnType<typeof libraryFor>[number];
