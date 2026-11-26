// The one accent color (a school can set its own). Light and dark shades so text stays readable.
import { useSyncExternalStore } from "react";

export const ACCENTS = [
  { id: "blue", name: "Blue", light: "#0066d6", dark: "#0a84ff" },
  { id: "teal", name: "Teal", light: "#00838a", dark: "#00adb5" },
  { id: "green", name: "Green", light: "#1f7a36", dark: "#30d158" },
  { id: "orange", name: "Orange", light: "#b34700", dark: "#ff9f0a" },
  { id: "red", name: "Red", light: "#c1121f", dark: "#ff453a" },
  { id: "purple", name: "Purple", light: "#6b3fc4", dark: "#bf5af2" },
  { id: "graphite", name: "Graphite", light: "#3a3a3c", dark: "#aeaeb2" },
];
const KEY = "cfi.v1.accent";
const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) || "blue"; } catch { return "blue"; } };

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
