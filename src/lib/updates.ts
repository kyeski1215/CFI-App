// "New version available" prompt instead of silent updates, so it's obvious when a device is out of date.
import { useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";

let needRefresh = false;
const subs = new Set<() => void>();
let update: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;

export function initUpdates() {
  if (!("serviceWorker" in navigator)) return;
  update = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      subs.forEach((f) => f());
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      registration = reg;
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
  if (update) update(true).catch(() => {});
  // iPhone home-screen apps sometimes miss the switch-over event; reload anyway so the tap always works.
  setTimeout(() => location.reload(), 1500);
}

/** Settings button: look for a new version now. Returns what happened, for a message. */
export async function checkForUpdate(): Promise<"updating" | "current" | "unsupported"> {
  if (!registration) return "unsupported";
  await registration.update().catch(() => {});
  if (registration.waiting || registration.installing || needRefresh) {
    applyUpdate();
    return "updating";
  }
  return "current";
}

/** Last resort: drop the cached app files (not your data) and load the newest version from the web. */
export async function forceRefresh() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    const keys = await caches?.keys?.();
    await Promise.all((keys ?? []).map((k) => caches.delete(k)));
  } catch { /* ignore */ }
  location.reload();
}
