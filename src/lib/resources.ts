// Built-in resources, ported from the CFI Toolkit artifact. Users add their own on top;
// a user Resource with builtinId overrides (or hides) the matching entry here.
export interface BuiltinResource {
  id: string;
  category: string;
  icon: string;
  title: string;
  url: string;
  desc: string;
}

export const DEFAULT_CATEGORIES = [
  "Checkride Prep",
  "Study Guides",
  "Procedures & Flights",
  "FAA & Weather",
  "Students & Scheduling",
];

const A = "https://claude.ai/artifact/";
export const BUILTIN_RESOURCES: BuiltinResource[] = [
  { id: "prep-hub", category: "Checkride Prep", icon: "🎯", title: "Checkride Prep Hub", url: A + "WWwDWfzPVtB7f6gezq8MDM", desc: "ACS by rating, flows, flashcards and videos for students." },
  { id: "kbmc-grade", category: "Checkride Prep", icon: "✅", title: "KBMC–KOGD Mock Checkride", url: A + "VCXtNEUygFAefnG8cXNJwS", desc: "Tap-to-grade IFR sheet for the KONNE / KBMC / RACGO / KOGD route." },
  { id: "kbmc-doc", category: "Checkride Prep", icon: "🧭", title: "IFR Mock Checkride – KBMC / KOGD", url: A + "8fvytvMF7XHUzDEZZ4bHmn", desc: "Written flight profile and notes for the KBMC / KOGD IFR mock." },
  { id: "gasik", category: "Checkride Prep", icon: "🎙️", title: "IFR Mock Oral — Steve Gasik Style", url: A + "SjwsqPrABCigFB6VVAgbyC", desc: "Oral checklist built around how Steve runs the IFR oral." },
  { id: "ifr-oral-guide", category: "Checkride Prep", icon: "🎙️", title: "IFR Mock Oral — Checkride Guide", url: A + "XyEwtTNbwhVwad1MmTHYGc", desc: "Question flow and guidance for running an instrument mock oral." },
  { id: "ifr-oral", category: "Checkride Prep", icon: "🎙️", title: "IFR Mock Oral — Instrument Rating", url: A + "M1RuLXvupgMaaAMARpLLqS", desc: "Instrument rating mock oral question set." },
  { id: "cpl-oral", category: "Checkride Prep", icon: "🎙️", title: "CPL Airplane Mock Oral", url: A + "E569SWvFfGQ1fjoqs2tqoV", desc: "Commercial pilot mock oral question set." },
  { id: "baron", category: "Checkride Prep", icon: "✈️", title: "N8145R Baron — Multi-Engine Checkride Prep", url: A + "2YV3qR1ZQ5wpnggmNsAz9R", desc: "Multi-engine add-on prep for the Baron." },
  { id: "ifr-study", category: "Study Guides", icon: "📘", title: "IFR Checkride Study Guide", url: A + "TPov5zv5g3zh4vTiD4An2t", desc: "What to know cold before the instrument checkride." },
  { id: "ir-guide", category: "Study Guides", icon: "📗", title: "Instrument Rating Study Guide", url: A + "CmExT8vJaxarcrCtc4s7SN", desc: "Full instrument rating ground study reference." },
  { id: "ppl-new", category: "Study Guides", icon: "🎓", title: "New Student Guide — Private Pilot", url: A + "V8wPTt6DhzsE6eG43G7MkT", desc: "Start-here guide for brand-new private pilot students." },
  { id: "p100i", category: "Procedures & Flights", icon: "📖", title: "Piper Pilot 100i Maneuver Guide", url: A + "KxPv8CvJCD1xRYJg2GvrD9", desc: "Blitz maneuver profiles for the Pilot 100i." },
  { id: "pattern", category: "Procedures & Flights", icon: "🛬", title: "Pilot 100i Traffic Pattern", url: A + "SGs6v2h9nMvKj8saRKwQJu", desc: "Power, configuration and callouts by leg." },
  { id: "emerg", category: "Procedures & Flights", icon: "🔥", title: "Single-Engine Emergency Flows", url: A + "ARTxX3fncYZqKEWBrwnx6h", desc: "ABCD engine failure, fire and electrical failure flows." },
  { id: "kbmc-local", category: "Procedures & Flights", icon: "🗺️", title: "KOGD to KBMC Local Flight", url: A + "M9VJWQVHXkDGrubFZ78s3K", desc: "Local cross-country briefing from Ogden to Brigham City." },
  { id: "awc", category: "FAA & Weather", icon: "🌦️", title: "Aviation Weather Center", url: "https://aviationweather.gov/", desc: "METARs, TAFs, PIREPs, G-AIRMETs and prog charts." },
  { id: "acs", category: "FAA & Weather", icon: "📑", title: "FAA Airman Certification Standards", url: "https://www.faa.gov/training_testing/testing/acs", desc: "Current ACS for every rating." },
  { id: "handbooks", category: "FAA & Weather", icon: "📚", title: "FAA Handbooks & Manuals", url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation", desc: "PHAK, AFH, IFH, IPH and more." },
  { id: "far", category: "FAA & Weather", icon: "⚖️", title: "14 CFR (eCFR)", url: "https://www.ecfr.gov/current/title-14", desc: "Parts 61, 91, 141 — the live regs." },
  { id: "ac61-65", category: "FAA & Weather", icon: "✍️", title: "AC 61-65 Endorsements", url: "https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.current/documentNumber/61-65", desc: "Sample endorsement wording for every situation." },
  { id: "iacra", category: "FAA & Weather", icon: "🪪", title: "IACRA", url: "https://iacra.faa.gov/", desc: "Applications and endorsements for checkrides." },
];
