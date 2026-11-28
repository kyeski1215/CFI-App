// Turns a logged lesson into a text message for the student. Runs on the device; no AI, no credits.
import { guideMark } from "./curriculum";
import { pplDetail } from "./ppl";
import { headName, tipFor } from "./skillTips";
import { fmtDate, todayStr } from "./store";
import type { LogEntry, Student } from "./types";

export const firstName = (n: string) => String(n || "").trim().split(/\s+/)[0] || "there";

/** Your notes as clean sentences: split on line breaks and sentence ends, first letter capitalized, ending punctuation added. */
export function noteSentences(notes: string): string[] {
  return notes
    .split(/\n+|(?<=[.!?])\s+/)
    .map((l) => l.trim().replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 2)
    .map((l) => {
      const t = l.charAt(0).toUpperCase() + l.slice(1);
      return /[.!?]$/.test(t) ? t : t + ".";
    });
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const SIGNOFFS = ["Questions? Just text me.", "Text me if anything's unclear.", "Good work. Questions any time.", "See you next lesson. Text me with any questions."];

export type TextMode = "full" | "short";

/**
 * The debrief text for a lesson, built from your ✓/✗ ratings, notes and syllabus grade.
 * Full: a coaching tip for each thing to work on, your notes tied to the skill they're about, a chair-fly line.
 * Short: a few lines for a routine flight.
 */
export function studentText(s: Student, e: LogEntry, mode: TextMode = "full") {
  const first = firstName(s.name);
  const ground = e.kind === "ground";
  const today = todayStr();
  const yest = (() => { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const when = e.date === today ? "today" : e.date === yest ? "yesterday" : "on " + fmtDate(e.date);
  const ldg = (+(e.ldgDay || 0)) + (+(e.ldgNight || 0));
  const facts = [e.hrs && `${e.hrs} hr`, ldg && `${ldg} landing${ldg === 1 ? "" : "s"}`].filter(Boolean) as string[];

  const rated = Object.entries(e.ratings ?? {});
  const good = rated.filter(([, r]) => r === "good").map(([k]) => k);
  const work = rated.filter(([, r]) => r === "work").map(([k]) => k);

  // Tie each note sentence to the first rated skill it talks about (things to work on first).
  // With notes by part of the flight, the section name helps find the skill ("Landing 2" → landings),
  // and a sentence that isn't about a rated skill keeps its section name so it still makes sense.
  const segs = e.kind === "flight" ? e.segs?.filter((g) => g.text.trim()) : undefined;
  const pieces = segs?.length
    ? segs.flatMap((g) => noteSentences(g.text).map((sen) => ({ sen, about: g.label, low: (g.label + " " + sen).toLowerCase() })))
    : noteSentences(e.notes ?? "").map((sen) => ({ sen, about: "", low: sen.toLowerCase() }));
  const tied = new Map<string, string[]>();
  const loose: string[] = [];
  for (const { sen, about, low } of pieces) {
    const hit = [...work, ...good].find((k) => (tipFor(k).keys ?? []).some((w) => low.includes(w)));
    if (hit) tied.set(hit, [...(tied.get(hit) ?? []), sen]);
    else loose.push(about && !/^(overall|notes|general)$/i.test(about) ? `${about}: ${sen}` : sen);
  }

  const where = `${e.tail ? ` in ${e.tail}` : ""}${facts.length ? ` (${facts.join(", ")})` : ""}`;
  const opener = ground
    ? `Hey ${first}, thanks for the ground lesson ${when}${e.lesson ? ` on ${e.lesson}` : ""}.`
    : work.length > good.length
      ? `Hey ${first}, here's how ${when === "today" ? "today's flight" : "the flight " + when} went${where}.`
      : `Hey ${first}, nice flight ${when}${where}.`;
  const parts = [opener];

  if (good.length) {
    const extra = mode === "full" ? good.flatMap((k) => tied.get(k) ?? []) : [];
    parts.push(`What went well: ${list(good.map((k) => tipFor(k).say))}.${extra.length ? " " + extra.join(" ") : ""}`);
  }

  if (work.length) {
    if (mode === "short") parts.push(`To work on: ${list(work.map((k) => tipFor(k).say))}.`);
    else {
      const lines = work.map((k) => {
        const notes = (tied.get(k) ?? []).join(" ");
        const tip = tipFor(k).tip;
        const lower = (t: string) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
        const tipText = tip ? (notes ? "Next time: " + lower(tip) : tip) : "";
        return `- ${headName(k)}: ${[notes, tipText].filter(Boolean).join(" ")}`.trim();
      });
      parts.push("To work on:\n" + lines.join("\n"));
    }
  }

  if (mode === "full" && loose.length) parts.push((good.length || work.length ? "Also: " : "") + loose.join(" "));
  if (mode === "short" && !good.length && !work.length && loose.length) parts.push(loose.slice(0, 2).join(" "));

  if (mode === "full") {
    const chair = work.map((k) => tipFor(k).chair).filter(Boolean).slice(0, 2) as string[];
    if (chair.length === 1) parts.push(`Chair fly before next time: ${chair[0]}.`);
    else if (chair.length) parts.push("Chair fly before next time:\n" + chair.map((c) => "- " + c.charAt(0).toUpperCase() + c.slice(1)).join("\n"));
  }

  // The syllabus grade you gave this lesson in the log form.
  const m = e.syl ? guideMark(s, e.syl)?.m : undefined;
  if (e.syl && m) {
    const id = e.syl.slice(e.syl.indexOf(".") + 1);
    const name = pplDetail(id)?.name ?? e.lesson ?? "this lesson";
    parts.push(m === "G" ? `That wraps up ${name}. ✓` : m === "Y" ? `We'll finish up ${name} next lesson.` : `We'll keep building on ${name} next time.`);
  }

  let h = 0;
  for (const c of e.date + (e.lesson ?? "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  parts.push(SIGNOFFS[h % SIGNOFFS.length]);
  return parts.join("\n\n");
}

/** The original artifact's drafting instructions, for pasting into the Claude app with the notes. */
export function claudePrompt(s: Student, e: LogEntry) {
  const rated = Object.entries(e.ratings ?? {}).map(([k, r]) => `${r === "good" ? "good" : "needs work"}: ${tipFor(k).say}`).join("; ");
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
