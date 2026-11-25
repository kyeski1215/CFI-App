// "New version available" prompt instead of silent updates, so it's obvious when a device is out of date.
import { useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";

let needRefresh = false;
const subs = new Set<() => void>();
let update: ((reload?: boolean) => Promise<void>) | null = null;

export function initUpdates() {
  if (!("serviceWorker" in navigator)) return;
  update = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      subs.forEach((f) => f());
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Check for a new version every 30 minutes and whenever the app comes back to the foreground.
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    },
  });
}
export function useUpdateAvailable() {
  return useSyncExternalStore((l) => (subs.add(l), () => subs.delete(l)), () => needRefresh);
}
export function applyUpdate() {
  if (update) update(true);
  else location.reload();
}
