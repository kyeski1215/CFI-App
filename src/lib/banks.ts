// Mock checkride question banks ported from the Mock Checkride Logger artifact.
// Question ids never change: saved grades are keyed by them.
// The app starts with only the small index (names, sections, question ids); the full questions
// load on demand when a mock checkride is opened (see useFullBank).
import { useEffect, useState } from "react";
import index from "../data/banks-index.json";

/** [id, question, answer key, reference, {examiner: 1 = on their gouge, 2 = spends real time there}] */
export type Question = [string, string, string, string, Record<string, number>];
export interface BankSection {
  id: string;
  t: string;
  short?: string;
  intro?: string;
  qs: Question[];
}
export interface Bank {
  name: string;
  short: string;
  route: string;
  examiners: string[];
  sections: BankSection[];
}

/** Light version of a bank: everything but the question text. */
export interface BankMeta {
  name: string;
  short: string;
  route: string;
  examiners: string[];
  sections: { id: string; t: string; short?: string; qids: string[] }[];
}

export const BANKS = index as unknown as Record<string, BankMeta>;

let full: Promise<Record<string, Bank>> | null = null;
export function loadFullBanks() {
  full ??= import("../data/banks.json").then((m) => m.default as unknown as Record<string, Bank>);
  return full;
}
/** The full question bank for one checkride, loaded on first use (undefined while loading). */
export function useFullBank(id: string | undefined) {
  const [banks, setBanks] = useState<Record<string, Bank> | null>(null);
  useEffect(() => {
    let live = true;
    loadFullBanks().then((b) => live && setBanks(b));
    return () => { live = false; };
  }, []);
  return id && banks ? banks[id] : undefined;
}
export const BANK_IDS = Object.keys(BANKS);
export const KINDS = ["Oral", "Flight", "Oral + Flight"];
export const RESULTS = ["Ready for checkride", "Needs another mock", "Not ready"];
export const GRADE_LABEL = { S: "Satisfactory", W: "Weak: re-brief", U: "Unsatisfactory" } as const;

/** Map a roster goal to the bank most likely needed. */
export function bankForGoal(goal: string) {
  return (
    { "Private Pilot": "ppl", Instrument: "ifr", Commercial: "comm", "Multi-Engine": "me", CFI: "cfi", CFII: "cfii" }[
      goal
    ] ?? "ppl"
  );
}

export function questionCount(b: BankMeta) {
  return b.sections.reduce((a, s) => a + s.qids.length, 0);
}
