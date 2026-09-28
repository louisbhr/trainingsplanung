// Prüft plans/hm-2027.json direkt (F0: "Die Plandaten-Tests prüfen künftig
// die JSON-Datei"). Die Substanz der bisherigen 81 Prüfungen (Kraft Di/Do,
// Läufe an den richtigen Tagen, keine Doppelbelegung, Platzhalterwochen,
// Phasengrenzen, Übungskatalog) bleibt erhalten, zielt jetzt aber auf die
// JSON statt auf die alten plan.js-Exporte. plan.js selbst bleibt in M1-2
// unverändert (siehe tests/fixtures/plan-legacy.mjs, A2) und wird erst in
// M1-3 auf reine Logik umgestellt.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validatePlan, addDays, weekNumberFor, weekDates, phaseOf, phaseRange,
  planEnd, activePlanFor, planDayState, formatGoal,
} from "../plan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(readFileSync(join(root, "plans", "hm-2027.json"), "utf8"));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// ---- Struktur & Validierung ----
ok(validatePlan(plan).length === 0, `Plan ist gültig (${JSON.stringify(validatePlan(plan))})`);

const weekByN = new Map(plan.weeks.map((w) => [w.n, w]));
ok(plan.weeks.length === plan.totalWeeks, `Alle ${plan.totalWeeks} Wochen vorhanden`);

const dow = (iso) => new Date(iso + "T12:00:00").getDay();

// ---- Ausformulierte Wochen 1-8: Kraft Di/Do, Läufe an den richtigen Tagen ----
for (let n = 1; n <= plan.detailedUntilWeek; n++) {
  const week = weekByN.get(n);
  ok(week.placeholder === false, `W${n} kein Platzhalter`);
  ok(Array.isArray(week.sessions) && week.sessions.length > 0, `W${n} hat Einheiten`);

  const kraftSessions = week.sessions.filter((s) => s.kind === "kraft");
  const laufSessions = week.sessions.filter((s) => s.kind === "lauf");
  ok(kraftSessions.length === 2, `W${n} genau 2 Krafteinheiten`);
  ok(dow(kraftSessions[0].date) === 2 || dow(kraftSessions[1].date) === 2, `W${n} eine Krafteinheit am Dienstag`);
  ok(dow(kraftSessions[0].date) === 4 || dow(kraftSessions[1].date) === 4, `W${n} eine Krafteinheit am Donnerstag`);
  ok(kraftSessions.every((s) => s.exercises.length > 0), `W${n} Übungen vorhanden`);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  ok(week.sessions.every((s) => days.includes(s.date)), `W${n} alle Einheiten in der Woche`);
  ok(laufSessions.every((r) => r.dist && r.pace && r.hf && r.km > 0 && r.hfMax), `W${n} Läufe vollständig (dist/pace/hf/km/hfMax)`);

  // keine Kollision Kraft/Lauf am selben Tag
  const dates = week.sessions.map((s) => s.date);
  ok(new Set(dates).size === dates.length, `W${n} keine Doppelbelegung an einem Tag`);

  ok(typeof week.plannedKm === "number" && week.plannedKm > 0, `W${n} plannedKm gesetzt (${week.plannedKm})`);
}

// ---- Platzhalterwochen 9-31 ----
for (let n = plan.detailedUntilWeek + 1; n <= plan.totalWeeks; n++) {
  const week = weekByN.get(n);
  ok(week.placeholder === true, `W${n} als Platzhalter vorhanden`);
  ok(week.sessions === undefined, `W${n} hat noch keine Einheiten`);
  ok(typeof week.weekType === "string" && week.weekType, `W${n} hat einen Wochentyp`);
}

// ---- Phasen ----
ok(
  plan.phases.every((p) => weekByN.has(p.weeks.from) && weekByN.has(p.weeks.to)),
  "Phasengrenzen existieren"
);

// ---- Wochentyp (F2): Entlastung bei Deload, sonst Aufbau in Phase 1, ab Phase 2 der Phasenname ----
ok(weekByN.get(4).weekType === "Entlastung", "W4 (Deload) heißt Entlastung");
ok(weekByN.get(8).weekType === "Entlastung", "W8 (Deload) heißt Entlastung");
ok(weekByN.get(2).weekType === "Aufbau", "W2 (Phase 1, kein Deload) heißt Aufbau");
ok(weekByN.get(9).weekType === "Aufbau", "W9 (Phase 2) heißt wie die Phase (Aufbau)");

// ---- Übungskatalog (aus den ausformulierten Wochen) ----
const catalog = new Set();
for (let n = 1; n <= plan.detailedUntilWeek; n++) {
  for (const s of weekByN.get(n).sessions.filter((x) => x.kind === "kraft")) {
    for (const ex of s.exercises) catalog.add(ex.name);
  }
}
ok(catalog.size > 10, `Übungskatalog gefüllt (${catalog.size})`);

// ---- Ziel ----
ok(plan.goal.raceDateConfirmed === false, "Renndatum noch nicht bestätigt");
ok(plan.goal.raceDate === "2027-04-11" && plan.goal.distanceKm === 21.0975, "Ziel-Felder gesetzt");

// ---- Negativ-Fixturen: validatePlan muss jeweils genau das erkennen ----
function withProblem(mutate, expectSubstring, label) {
  const bad = structuredClone(plan);
  mutate(bad);
  const problems = validatePlan(bad);
  ok(
    problems.some((p) => p.includes(expectSubstring)),
    `Negativ-Fixture "${label}" wird erkannt (${JSON.stringify(problems)})`
  );
}

withProblem((p) => { p.zones[0] = [1, 2]; }, "Array in einem Array", "Array in Array");
withProblem((p) => { p.fileVersion = "2026-09-27"; }, "fileVersion", "ungültige fileVersion");
withProblem((p) => { p.weeks[3].placeholder = true; }, "placeholder", "falsches placeholder-Flag");
withProblem(
  (p) => { p.goal.raceDateConfirmed = true; p.goal.raceDate = "2027-04-11"; },
  "Renndatum",
  "bestätigtes Renndatum außerhalb der Wochen"
);

// ---- I1: reine Plan-Logik (weekNumberFor/weekDates/planDayState/formatGoal/phaseRange) ----

// weekNumberFor: außerhalb null, keine stumme Klemmung mehr; über beide
// Zeitumstellungen im Plan (25.10.2026 und 28.03.2027) hinweg korrekt.
ok(weekNumberFor(plan, addDays(plan.start, -1)) === null, "weekNumberFor: Tag vor Planstart -> null");
ok(weekNumberFor(plan, plan.start) === 1, "weekNumberFor: Planstart -> Woche 1");
ok(weekNumberFor(plan, planEnd(plan)) === plan.totalWeeks, `weekNumberFor: letzter Plantag -> Woche ${plan.totalWeeks}`);
ok(weekNumberFor(plan, addDays(planEnd(plan), 1)) === null, "weekNumberFor: Tag nach der letzten Planwoche -> null");
ok(weekNumberFor(plan, "2026-10-26") === 9, "weekNumberFor: 26.10.2026 = Woche 9 (nach der Zeitumstellung im Oktober)");
ok(weekNumberFor(plan, "2027-03-28") === 30, "weekNumberFor: 28.03.2027 = Woche 30 (Zeitumstellung im März)");

// weekDates: 7 Tage, Montag zuerst, in derselben Woche wie weekStart.
{
  const days = weekDates(plan, 9);
  ok(days.length === 7 && days[0] === "2026-10-26" && days[6] === "2026-11-01", `weekDates(9): 7 Tage, Mo–So (${days.join(",")})`);
}

// planDayState/activePlanFor an den Grenzen: Renntag zählt noch als
// "bisZumRennen", der Tag danach und der Tag vor Planstart sind "keinPlan".
ok(planDayState(plan.goal.raceDate, [plan]) === "bisZumRennen", "planDayState: Renntag selbst noch 'bisZumRennen'");
ok(planDayState(addDays(plan.goal.raceDate, 1), [plan]) === "keinPlan", "planDayState: Tag nach dem Rennen -> 'keinPlan'");
ok(planDayState(addDays(plan.start, -1), [plan]) === "keinPlan", "planDayState: Tag vor Planstart -> 'keinPlan'");
ok(activePlanFor(addDays(plan.start, -1), [plan]) === null, "activePlanFor: vor Planstart kein aktiver Plan");
ok(activePlanFor(plan.goal.raceDate, [plan]) === plan, "activePlanFor: am Renntag noch derselbe Plan aktiv");

// formatGoal: unbestätigtes Datum zeigt nur den Monat (Anfang/Mitte/Ende),
// bestätigtes Datum das genaue Tagesdatum.
ok(formatGoal(plan.goal).race === "Halbmarathon, ca. Mitte April 2027", `formatGoal unbestätigt (${formatGoal(plan.goal).race})`);
ok(
  formatGoal({ ...plan.goal, raceDateConfirmed: true }).race === "Halbmarathon, 11.04.2027",
  `formatGoal bestätigt (${formatGoal({ ...plan.goal, raceDateConfirmed: true }).race})`
);
ok(formatGoal({ ...plan.goal, raceDate: "2027-04-05" }).race.includes("Anfang April"), "formatGoal: Tag 1-10 -> 'Anfang'");
ok(formatGoal({ ...plan.goal, raceDate: "2027-04-15" }).race.includes("Mitte April"), "formatGoal: Tag 11-20 -> 'Mitte'");
ok(formatGoal({ ...plan.goal, raceDate: "2027-04-25" }).race.includes("Ende April"), "formatGoal: Tag 21-31 -> 'Ende'");

// phaseRange über den Jahreswechsel: beide Enden zeigen das Jahr.
{
  const phase2 = phaseOf(plan, 9);
  ok(phase2.n === 2, "phaseOf(9): liegt in Phase 2");
  ok(phaseRange(plan, phase2) === "26.10.2026–03.01.2027", `phaseRange über den Jahreswechsel (${phaseRange(plan, phase2)})`);
  const phase1 = phaseOf(plan, 1);
  ok(phaseRange(plan, phase1) === "31.08.–25.10.2026", `phaseRange innerhalb eines Jahres (${phaseRange(plan, phase1)})`);
}

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Plandaten-Tests bestanden");
process.exit(fails ? 1 : 0);
