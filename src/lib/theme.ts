// The one accent color (a school can set its own). Light and dark shades so text stays readable.
import { useSyncExternalStore } from "react";

export const ACCENTS = [
  { id: "teal", name: "Teal", light: "#0b7c82", dark: "#3cc4cb" },
  { id: "blue", name: "Blue", light: "#2f62d9", dark: "#5b9dff" },
  { id: "green", name: "Green", light: "#1f7a36", dark: "#30d158" },
  { id: "orange", name: "Orange", light: "#b34700", dark: "#ff9f0a" },
  { id: "red", name: "Red", light: "#c1121f", dark: "#ff453a" },
  { id: "purple", name: "Purple", light: "#6b3fc4", dark: "#bf5af2" },
  { id: "graphite", name: "Graphite", light: "#3a3a3c", dark: "#aeaeb2" },
];
const KEY = "cfi.v1.accent";
const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) || "teal"; } catch { return "teal"; } };

export function applyAccent(id = read()) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  const r = document.documentElement.style;
  r.setProperty("--brand", a.light);
  r.setProperty("--brand-dark", a.dark);
}
export function setAccent(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
  applyAccent(id);
  subs.forEach((f) => f());
}
export const useAccent = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), read);

/* ---- light / dark: follow the phone, or force one ---- */
export type ThemeMode = "auto" | "light" | "dark";
const THEME_KEY = "cfi.v1.theme";
const themeSubs = new Set<() => void>();
const readTheme = (): ThemeMode => { try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; } };

export function applyTheme(mode: ThemeMode = readTheme()) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  // The phone's status bar color follows the same choice.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const isDarkMeta = (m.getAttribute("media") ?? "").includes("dark");
    m.content = mode === "auto" ? (isDarkMeta ? "#11100f" : "#f7f5f2") : mode === "dark" ? "#11100f" : "#f7f5f2";
  });
}
export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* private mode */ }
  applyTheme(mode);
  themeSubs.forEach((f) => f());
}
export const useTheme = () => useSyncExternalStore((f) => (themeSubs.add(f), () => themeSubs.delete(f)), readTheme);
