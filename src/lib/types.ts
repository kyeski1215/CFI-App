import type { BaseRec } from "./store";

export type Grade = "S" | "W" | "U";

export interface LogEntry {
  id: string;
  kind: "flight" | "ground";
  date: string;
  tail?: string;
  hrs?: string;
  night?: string;
  ldgDay?: string;
  ldgNight?: string;
  lesson?: string;
  notes?: string;
  regs?: string; // reg line copied from the Reg Logger
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
  log?: LogEntry[];
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
  category: string;
  desc?: string;
  icon?: string;
  pinned?: boolean;
  builtinId?: string; // set when it overrides/hides a built-in
  hidden?: boolean;
}
