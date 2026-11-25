// Builds src/data/banks-index.json (names, sections, question ids) from the full banks.json so the
// app can start without loading all 794 questions. Runs automatically before every build.
import { readFileSync, writeFileSync } from "node:fs";
const banks = JSON.parse(readFileSync(new URL("../src/data/banks.json", import.meta.url)));
const index = Object.fromEntries(Object.entries(banks).map(([id, b]) => [id, {
  name: b.name, short: b.short, route: b.route, examiners: b.examiners,
  sections: b.sections.map((s) => ({ id: s.id, t: s.t, short: s.short, qids: s.qs.map((q) => q[0]) })),
}]));
writeFileSync(new URL("../src/data/banks-index.json", import.meta.url), JSON.stringify(index));
console.log("banks-index.json:", Object.keys(index).length, "banks");
