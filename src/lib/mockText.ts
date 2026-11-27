// Turns a graded mock checkride into a text message for the student. On the device; no AI.
import type { Bank } from "./banks";
import { firstName, noteSentences, type TextMode } from "./studentText";
import { fmtDate, todayStr } from "./store";
import type { Ride, Student } from "./types";

const RESULT_LINE: Record<string, string> = {
  "Ready for checkride": "Bottom line: you're ready for the real one. Let's get it booked.",
  "Needs another mock": "Bottom line: you're close. Go through the list below and we'll do one more mock.",
  "Not ready": "Bottom line: not ready yet, and that's exactly what a mock is for. Here's the plan.",
};
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);

export function mockText(r: Ride, bank: Bank, s: Student | undefined, opts: { mode: TextMode; answers: boolean }) {
  const first = firstName(s?.name ?? r.student ?? "");
  const kind = r.kind === "Oral" ? "mock oral" : r.kind === "Flight" ? "mock checkride flight" : "mock checkride";
  const when = r.date === todayStr() ? "today" : "on " + fmtDate(r.date);
  const parts = [`Hey ${first}, here's the debrief from your ${bank.short} ${kind} ${when}${r.examiner ? ` (run like ${r.examiner})` : ""}.`];

  const all = bank.sections.flatMap((sec) => sec.qs.map((q) => ({ sec, q, g: r.grades[q[0]] })));
  const S = all.filter((x) => x.g === "S").length, W = all.filter((x) => x.g === "W").length, U = all.filter((x) => x.g === "U").length;
  if (S + W + U) parts.push(`${S} solid, ${W} to brush up${U ? `, ${U} to relearn` : ""}.${r.result && RESULT_LINE[r.result] ? " " + RESULT_LINE[r.result] : ""}`);
  else if (r.result && RESULT_LINE[r.result]) parts.push(RESULT_LINE[r.result]);

  // Strong areas: topics where everything graded was solid (at least 2 questions).
  const strong = bank.sections.filter((sec) => {
    const g = sec.qs.map((q) => r.grades[q[0]]).filter(Boolean);
    return g.length >= 2 && g.every((x) => x === "S");
  }).map((sec) => sec.short ?? sec.t);
  if (strong.length) parts.push(`Strong areas: ${list(strong)}.`);

  const weak = [...all.filter((x) => x.g === "U"), ...all.filter((x) => x.g === "W")];
  if (opts.mode === "short") {
    const topics = [...new Set(weak.map((x) => x.sec.short ?? x.sec.t))].slice(0, 4);
    if (topics.length) parts.push(`Focus your review on: ${list(topics)}.`);
  } else if (weak.length) {
    const line = (x: (typeof weak)[number]) => {
      const note = (r.qnotes[x.q[0]] ?? "").trim();
      const bits = [`- ${x.q[1].replace(/\s+([?.!,])/g, "$1")}`];
      if (note) bits.push(`  (${noteSentences(note).join(" ")})`);
      if (opts.answers && x.q[2]) bits.push(`  Answer: ${clip(x.q[2], 320)}`);
      if (x.q[3]) bits.push(`  Study: ${x.q[3]}`);
      return bits.join("\n");
    };
    const us = weak.filter((x) => x.g === "U"), ws = weak.filter((x) => x.g === "W");
    const MAX = 12;
    if (us.length) parts.push("Know these cold:\n" + us.slice(0, MAX).map(line).join("\n"));
    const room = Math.max(0, MAX - us.length);
    if (ws.length) parts.push("Brush up on:\n" + ws.slice(0, Math.max(room, 4)).map(line).join("\n") + (ws.length > Math.max(room, 4) ? `\n- …and ${ws.length - Math.max(room, 4)} more we'll go over together.` : ""));
    const refs = [...new Set(weak.flatMap((x) => (x.q[3] ?? "").split(/;|,|\band\b/).map((t) => t.trim())).filter(Boolean))].slice(0, 6);
    if (weak.length >= 3 && refs.length > 1) parts.push(`Read before next time: ${list(refs)}.`);
  }

  if (opts.mode === "full") {
    const secNotes = bank.sections.map((sec) => ({ t: sec.short ?? sec.t, n: (r.sections[sec.id]?.note ?? "").trim() })).filter((x) => x.n);
    if (secNotes.length) parts.push(secNotes.map((x) => `${x.t}: ${noteSentences(x.n).join(" ")}`).join("\n"));
  }
  if (r.overall?.trim()) parts.push(noteSentences(r.overall).join(" "));
  parts.push(r.result === "Ready for checkride" ? "Proud of you. Questions any time." : "Text me with any questions as you study.");
  return parts.join("\n\n");
}
