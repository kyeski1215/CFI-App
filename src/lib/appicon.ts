// Use your school logo as the app icon (browser tab, and the home-screen icon when the app is added).
// iPhone reads the icon at "Add to Home Screen" time, so a change shows after re-adding the app.
import { getProfile, type Profile } from "./profile";
import { onStoreChange } from "./store";

const BG = { white: "#ffffff", dark: "#1d1b19" } as const;
const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#0b7c82";

/** Draw the logo centered on a rounded-friendly square background. Resolves to a PNG data URL. */
export function renderIcon(logo: string, bg: Profile["iconBg"] = "white", size = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d")!;
      g.fillStyle = bg === "accent" ? accent() : BG[bg ?? "white"];
      g.fillRect(0, 0, size, size);
      const box = size * 0.68;
      const k = Math.min(box / img.width, box / img.height);
      const w = img.width * k, h = img.height * k;
      g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Couldn't draw the logo"));
    img.src = logo;
  });
}

function setLink(rel: string, href: string, type?: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
  if (type) el.type = type;
  else el.removeAttribute("type");
}
function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

let last = "";
let manifestUrl = "";
export async function applyAppIcon() {
  const p = getProfile();
  const name = p?.appName?.trim() || "CFI Cockpit";
  const useLogo = !!(p?.iconFromLogo && p.logo);
  const sig = [useLogo, p?.logo?.length, p?.iconBg, name, useLogo && p?.iconBg === "accent" ? accent() : ""].join("|");
  if (sig === last) return;
  last = sig;
  setMeta("apple-mobile-web-app-title", name);
  document.title = name;
  if (!useLogo) {
    setLink("icon", "icon.svg", "image/svg+xml");
    setLink("apple-touch-icon", "icon-192.png");
    if (manifestUrl) { URL.revokeObjectURL(manifestUrl); manifestUrl = ""; setLink("manifest", "manifest.webmanifest"); }
    return;
  }
  try {
    const [big, touch] = await Promise.all([renderIcon(p!.logo!, p!.iconBg, 512), renderIcon(p!.logo!, p!.iconBg, 180)]);
    setLink("icon", big, "image/png");
    setLink("apple-touch-icon", touch);
    // Android / desktop install reads the manifest: hand it a copy with your icon and name.
    const base = new URL(".", location.href).href;
    const manifest = {
      name, short_name: name.length > 12 ? name.split(" ")[0] : name,
      start_url: base, scope: base, display: "standalone", theme_color: "#f7f5f2", background_color: "#f7f5f2",
      icons: [{ src: big, sizes: "512x512", type: "image/png" }, { src: touch, sizes: "180x180", type: "image/png" }],
    };
    if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    setLink("manifest", manifestUrl);
  } catch { /* keep whatever icon is there */ }
}

export function initAppIcon() {
  applyAppIcon();
  onStoreChange(() => applyAppIcon());
}
