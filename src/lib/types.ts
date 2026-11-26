import type { BaseRec } from "./store";

export type Grade = "S" | "W" | "U";

export interface LogEntry {
  /** Plan key of the syllabus lesson this entry was graded against, e.g. "p1.s1-emergencies". */
  syl?: string;
  id: string;
  kind: "flight" | "ground";
  date: string;
  tail?: string;
  hrs?: string;
  night?: string;
  ldgDay?: string;
  ldgNight?: string;
  solo?: string; // student solo hours on this flight (the rest of hrs is dual)
  xc?: string; // cross-country hours
  inst?: string; // instrument hours (actual + simulated)
  approaches?: string; // instrument approaches flown
  prep?: boolean; // training in preparation for the practical test (61.109(a)(4), 61.65(d)(2)(i), 61.129(a)(3)(v))
  lesson?: string;
  notes?: string;
  regs?: string; // reg line copied from the Reg Logger
  ratings?: Record<string, "good" | "work">; // ✓ / ✗ per skill flown this lesson
  text?: string; // message sent to the student about this lesson
}

/** A real checkride with a DPE (not a mock). */
export interface Checkride {
  id: string;
  date: string;
  rating: string; // "Instrument"
  result: "Pass" | "Fail" | "Discontinued";
  examiner?: string;
  notes?: string; // e.g. the areas that weren't passed
}

export interface Student extends BaseRec {
  name: string;
  goal: string;
  status: string;
  stage?: string;
  aircraft?: string;
  contact?: string;
  email?: string;
  course?: string;
  priorHours?: string;
  targetPerWeek?: string;
  nextLesson?: string;
  coInstructors?: string;
  notes?: string;
  strengths?: string;
  summaryAt?: string; // date strengths / needs work were last filled from the AI summary
  weaknesses?: string;
  availNotes?: string;
  accountId?: string;
  avail?: string[]; // "Mon-AM"
  covered?: string[]; // curriculum topics
  extraTopics?: string[];
  ground?: string[]; // "taskLetter|item text"
  guide?: Record<string, string>; // "section.key" -> date done
  // Yellow / red grades. Green ("checkride ready") is stored as done: guide[key] / covered[].
  guideMarks?: Record<string, { m: "Y" | "R"; d: string }>;
  /** 2 = progress carried over to the named-lesson Private Pilot syllabus. */
  pplPlan?: number;
  checkrides?: Checkride[];
  /** Your replies to the student's in-app questions (published on their card). */
  qReplies?: Record<string, { text: string; at: string; inPerson?: boolean }>;
  topicMarks?: Record<string, { m: "Y" | "R"; d: string }>;
  hoursAdj?: Record<string, string>; // hours toward checkride from other logbooks, per requirement
  hoursFlags?: Record<string, boolean>; // requirements marked complete by hand (e.g. long cross-country)
  log?: LogEntry[];
  solo?: { maxWind?: string; maxGust?: string; maxXwind?: string; minCeiling?: string; minVis?: string }; // written solo limitations
  shareWithStudent?: boolean; // publish a read-only card the student can see (matched by email)
  shareNotes?: boolean; // include raw lesson notes on that card
  logDraft?: LogEntry; // lesson being written; saved on every keystroke
}

export interface Ride extends BaseRec {
  bank: string;
  studentId?: string;
  student: string; // display name (kept for rides imported without an id)
  date: string;
  kind: string;
  prep?: string;
  aircraft?: string;
  route?: string;
  examiner?: string;
  grades: Record<string, Grade>;
  qnotes: Record<string, string>;
  sections: Record<string, { note?: string; grade?: Grade }>;
  result?: string;
  overall?: string;
}

export interface Resource extends BaseRec {
  title: string;
  url: string;
  ratings?: string[]; // RATINGS this is recommended for
  topic?: string; // e.g. "Stalls", "Approaches"
  note?: string; // why / when to watch it
  pinned?: boolean;
  // Older records from the first Resources page; ignored by the new page.
  category?: string;
  builtinId?: string;
  hidden?: boolean;
  desc?: string;
  icon?: string;
}
