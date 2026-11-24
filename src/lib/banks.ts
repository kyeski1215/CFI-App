// Mock checkride question banks ported from the Mock Checkride Logger artifact.
// Question ids never change: saved grades are keyed by them.
import raw from "../data/banks.json";

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

export const BANKS = raw as unknown as Record<string, Bank>;
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

export function questionCount(b: Bank) {
  return b.sections.reduce((a, s) => a + s.qs.length, 0);
}
