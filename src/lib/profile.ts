// Your name and school (shown to students instead of your email), kept as a synced record.
import { get, put, useRecord, type BaseRec } from "./store";

export interface Profile extends BaseRec {
  displayName?: string;
  schoolName?: string;
  logo?: string; // small image as a data URL
  iconFromLogo?: boolean; // use the logo as the home-screen / browser icon
  iconBg?: "white" | "accent" | "dark";
  appName?: string; // name under the home-screen icon
}
const ID = "me";
export const useProfile = () => useRecord<Profile>("profile", ID);
export const getProfile = () => get<Profile>("profile", ID);
export function saveProfile(p: Partial<Profile>) {
  const cur = getProfile();
  const now = Date.now();
  put<Profile>("profile", { id: ID, createdAt: cur?.createdAt ?? now, updatedAt: now, ...cur, ...p });
}

/** Shrink a picked image to a small square-ish logo (max 160 px) so it syncs and shares quickly. */
export function logoFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 320;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image the browser can read.")); };
    img.src = url;
  });
}
