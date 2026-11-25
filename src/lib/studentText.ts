// Turns a logged lesson into a text message for the student. Runs on the device; no AI, no credits.
import { fmtDate, todayStr } from "./store";
import type { LogEntry, Student } from "./types";

export const firstName = (n: string) => String(n || "").trim().split(/\s+/)[0] || "there";

/** Note text → bullet lines. Keeps the instructor's own lines; splits one long paragraph into sentences. */
function bullets(notes: string) {
  let lines = notes.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].length > 160) lines = lines[0].split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  return lines.map((l) => "- " + l.replace(/^[-•*\d.)\s]+/, "").trim()).filter((l) => l.length > 2);
}

export function studentText(s: Student, e: LogEntry) {
  const when = e.date === todayStr() ? "today's" : `your ${fmtDate(e.date)}`;
  const what = e.lesson ? `${when} ${e.lesson} ${e.kind === "ground" ? "ground lesson" : "flight"}` : `${when} ${e.kind === "ground" ? "ground lesson" : "flight"}`;
  const facts = [e.kind !== "ground" && e.tail, e.hrs && `${e.hrs} hr`, (e.ldgDay || e.ldgNight) && `${(+(e.ldgDay || 0)) + (+(e.ldgNight || 0))} landings`].filter(Boolean);
  const good = Object.entries(e.ratings ?? {}).filter(([, r]) => r === "good").map(([k]) => "- " + k);
  const work = Object.entries(e.ratings ?? {}).filter(([, r]) => r === "work").map(([k]) => "- " + k);
  const notes = bullets(e.notes ?? "");

  const parts = [`Hey ${firstName(s.name)}, here's the debrief from ${what}${facts.length ? ` (${facts.join(", ")})` : ""}.`];
  if (good.length) parts.push("WENT WELL\n" + good.join("\n"));
  if (work.length) parts.push("WORK ON\n" + work.join("\n"));
  if (notes.length) parts.push((good.length || work.length ? "NOTES\n" : "") + notes.join("\n"));
  if (s.nextLesson) parts.push(`Next time: ${s.nextLesson}`);
  parts.push("Let me know if you have any questions!");
  return parts.join("\n\n");
}

/** The original artifact's drafting instructions, for pasting into the Claude app with the notes. */
export function claudePrompt(s: Student, e: LogEntry) {
  const rated = Object.entries(e.ratings ?? {}).map(([k, r]) => `${r === "good" ? "good" : "needs work"}: ${k}`).join("; ");
  return `You are helping a CFI (flight instructor) at Blitz Aviation in Ogden, Utah, turn rough post-flight notes into a text message to send to the student.

Student first name: ${firstName(s.name)}
Training toward: ${s.goal || ""}
Aircraft: ${e.tail || s.aircraft || ""}
Date: ${e.date || ""}
Lesson: ${e.lesson || ""}${rated ? `\nSkill ratings: ${rated}` : ""}

The instructor's raw notes (written quickly, may have typos and shorthand):
"""
${e.notes || ""}
"""

Write the text message in the instructor's voice, friendly and direct, as a CFI talking to the student:
- Open with one or two sentences on what went well (from the notes only).
- Then a section headed CHAIR FLY: a numbered list of the specific procedures, entries, approaches or flows from this flight the student should rehearse at home, each with the key steps to say out loud. Group related notes and keep the order of the flight.
- Then a section headed STUDY / FOCUS: short dashed bullets for the habits and knowledge to work on, with the biggest issue first.
- End with a short sign-off line.
Rules: plain text only, no markdown, asterisks or emoji. Fix typos and use standard aviation terms and capitalization (ATC, CTAF, MDA, MAP, GPS, AP, airport IDs, fix names in caps). Keep every specific number from the notes (altitudes, speeds, distances). Do not add facts, numbers or criticism that are not in the notes. If the notes are short or not about a flight, write a short simple debrief text instead of the sections. Output only the message text.`;
}

export function smsHref(phone: string, body: string) {
  const n = String(phone || "").replace(/[^\d+]/g, "");
  return "sms:" + n + "?&body=" + encodeURIComponent(body);
}
