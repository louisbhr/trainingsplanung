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
for (let n = 1; n <= 8; n++) {
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

// ---- Platzhalterwochen 13-35 ----
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
ok(weekByN.get(12).weekType === "Entlastung" && weekByN.get(12).deload === true, "W12 ist Entlastung (deload)");

// ---- Übungskatalog (aus den ausformulierten Wochen) ----
const catalog = new Set();
for (let n = 1; n <= 8; n++) {
  for (const s of weekByN.get(n).sessions.filter((x) => x.kind === "kraft")) {
    for (const ex of s.exercises) catalog.add(ex.name);
  }
}
ok(catalog.size > 10, `Übungskatalog gefüllt (${catalog.size})`);

// ---- Ziel ----
ok(plan.goal.raceDateConfirmed === true, "Renndatum bestätigt");
ok(plan.goal.raceDate === "2027-05-02" && plan.goal.distanceKm === 21.0975, "Ziel-Felder gesetzt (Rennen So 02.05.2027)");
ok(plan.totalWeeks === 35 && plan.weeks.length === 35, "35 Wochen");
ok(planEnd(plan) === plan.goal.raceDate, `Plan endet am Renntag (${planEnd(plan)})`);
ok(weekNumberFor(plan, plan.goal.raceDate) === 35, "Renntag liegt in Woche 35");
ok(weekByN.get(35).start === "2027-04-26", "W35 beginnt Mo 26.04.2027");
ok(plan.detailedUntilWeek === 12, "Ausformuliert bis Woche 12");

// ---- Phasen (Stand 20.10.2026) ----
{
  const ranges = plan.phases.map((p) => `${p.n}:${p.weeks.from}-${p.weeks.to}:${phaseRange(plan, p)}`);
  ok(ranges[0] === "1:1-8:31.08.–25.10.2026", `Phase 1 (${ranges[0]})`);
  ok(ranges[1] === "2:9-20:26.10.2026–17.01.2027", `Phase 2 (${ranges[1]})`);
  ok(ranges[2] === "3:21-33:18.01.–18.04.2027", `Phase 3 (${ranges[2]})`);
  ok(ranges[3] === "4:34-35:19.04.–02.05.2027", `Phase 4 (${ranges[3]})`);
  ok(plan.phases.every((p, i) => i === 0 || p.weeks.from === plan.phases[i - 1].weeks.to + 1), "Phasen lückenlos");
  ok(plan.phases.at(-1).weeks.to === plan.totalWeeks, "Letzte Phase endet mit der letzten Woche");
  ok(plan.weeks.every((w) => phaseOf(plan, w.n).n === w.phase), "week.phase passt zu phases[]");
}

// ---- Wochen 9-12 (ausformuliert) ----
{
  const sess = (n) => weekByN.get(n).sessions;
  const lauf = (n) => sess(n).filter((s) => s.kind === "lauf");
  const kraft = (n) => sess(n).filter((s) => s.kind === "kraft");
  const kmOf = (n) => lauf(n).map((s) => s.km).join("/");
  ok(kmOf(9) === "9/11/15/5", `W9 Läufe (${kmOf(9)})`);
  ok(kmOf(10) === "10/11/16/5", `W10 Läufe (${kmOf(10)})`);
  ok(kmOf(11) === "10/12/17/6", `W11 Läufe (${kmOf(11)})`);
  ok(kmOf(12) === "8/8/13/4", `W12 Läufe (${kmOf(12)})`);
  for (let n = 9; n <= 12; n++) {
    const week = weekByN.get(n);
    ok(week.placeholder === false, `W${n} kein Platzhalter`);
    ok(lauf(n).reduce((a, s) => a + s.km, 0) === week.plannedKm, `W${n} plannedKm = Summe der Läufe`);
    ok(lauf(n).map((s) => dow(s.date)).join() === "1,3,6,0", `W${n} Läufe Mo/Mi/Sa/So`);
    ok(kraft(n).length === 2 && kraft(n).map((s) => dow(s.date)).join() === "2,4", `W${n} Kraft Di + Do`);
    ok(!kraft(n)[0].optional && kraft(n)[1].optional === true, `W${n}: Di Pflicht, Do optional`);
    ok(kraft(n)[0].exercises.some((e) => e.name.startsWith("Plyometrie")), `W${n}: Plyometrie in Full Body A`);
    ok(kraft(n).every((s) => s.exercises.every((e) => /Zuhause:/.test(e.hint))), `W${n}: jede Kraft-Übung hat Zuhause-Alternative`);
    ok(kraft(n).every((s) => s.exercises.every((e) => !/Hüftabd|Hüftstreck-Dehn/.test(e.name))), `W${n}: keine zusätzlichen Hüftübungen`);
  }
  const test9 = lauf(9)[1];
  ok(test9.shortType === "Test" && test9.type === "Kalibrierungstest" && test9.km === 11 && test9.hfMax === undefined,
    "W9 Mi: Kalibrierungstest, 11 km, shortType Test, ohne hfMax");
  ok(/Ø Pace und Ø HF/.test(test9.note), "W9 Mi: Notiz zum Notieren von Pace/HF");
  ok(lauf(10)[1].shortType === "Schwelle" && lauf(11)[1].shortType === "Schwelle", "W10/W11 Mi: Schwelle");
  ok(lauf(10)[1].pace === "4:35–4:50 /km" && lauf(10)[1].hfMax === undefined, "Schwelle: Pace 4:35–4:50, ohne hfMax");
  ok(lauf(12)[1].shortType === "Easy" && lauf(12)[1].type.includes("6x20s"), "W12 Mi: Easy + 6x20s");
  ok(lauf(9)[0].pace === "5:45–6:15 /km" && lauf(9)[2].pace === "5:45–6:20 /km" && lauf(9)[3].pace === "> 6:30 /km",
    "W9: neue Easy-/Long-/Recovery-Pace");
  ok(lauf(9).filter((s) => ["Easy", "Long", "Recovery"].includes(s.shortType)).every((s) => [163, 160, 148].includes(s.hfMax)),
    "HF-Obergrenzen unverändert (163/160/148)");
  ok(kraft(12)[0].exercises[0].soll.includes("Deload"), "W12: Kraft im Deload-Soll");
  ok(kraft(9)[0].exercises[0].soll === "4x4-6", "W9: Kraft-Soll wie W5");
  // Gleiche Namen wie in W5-8 (Firestore-Slugs, durchgehender Verlauf), plus Plyometrie
  const namesOf = (n) => new Set(kraft(n).flatMap((s) => s.exercises.map((e) => e.name)));
  const base = namesOf(5);
  ok([...base].every((nm) => namesOf(9).has(nm)), "W9 enthält alle Übungsnamen der Full-Body-A/B aus W5");
}
// Optionale Einheiten nur ab Woche 9
ok(plan.weeks.filter((w) => w.n <= 8).every((w) => w.sessions.every((s) => !s.optional)), "W1-8: nichts optional");

// ---- Zonen-Tabelle: neue Easy-/Recovery-Pace, HF unverändert ----
{
  const z = Object.fromEntries(plan.zones.map((x) => [x.id, x]));
  ok(z.z1.pace === "> 6:30 /km" && z.z2.pace === "5:45–6:15 /km", "Z1/Z2 Pace neu");
  ok(z.z1.hf === "< 148" && z.z2.hf === "148–163" && z.z2.hfMax === 163, "Z1/Z2 HF unverändert");
  ok(z.z4.pace === "4:35–4:50 /km" && z.z5.pace === "4:05–4:20 /km", "Z4/Z5 bleiben bis zum Test");
}

// ---- Platzhalter-Kilometer W13-35 ----
{
  const exp = { 13: 46, 14: 49, 15: 52, 16: 40, 17: 48, 18: 44, 19: 50, 20: 42, 21: 52, 22: 54, 23: 56, 24: 44, 25: 56, 26: 58,
    27: 60, 28: 46, 29: 58, 30: 60, 31: 60, 32: 48, 33: 54, 34: 42, 35: 30 };
  ok(Object.entries(exp).every(([n, km]) => weekByN.get(Number(n)).plannedKm === km), "Platzhalter-plannedKm W13-35 laut Vorgabe");
  const deloads = [16, 20, 24, 28, 32];
  ok(deloads.every((n) => weekByN.get(n).deload && weekByN.get(n).weekType === "Entlastung"), "Entlastungswochen 16/20/24/28/32");
  ok(weekByN.get(34).weekType === "Taper" && weekByN.get(35).weekType === "Rennwoche", "W34 Taper, W35 Rennwoche");
}
ok(plan.fileVersion > "2026-09-27T16:21", `fileVersion hochgezählt (${plan.fileVersion})`);

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
  (p) => { p.goal.raceDateConfirmed = true; p.goal.raceDate = "2027-05-09"; },
  "Renndatum",
  "bestätigtes Renndatum außerhalb der Wochen"
);

withProblem((p) => { p.weeks[9].sessions[3].optional = "ja"; }, "optional", "optional kein Boolean");
withProblem((p) => { p.weeks[9].sessions[0].optional = true; }, "optional", "optional an einem Lauf");
withProblem((p) => { p.weeks[9].sessions[0].shortType = "Fahrtspiel"; }, "shortType", "unbekannter shortType");
withProblem((p) => { delete p.weeks[9].sessions[0].hfMax; }, "hfMax", "Easy ohne hfMax");
withProblem((p) => { p.weeks[35 - 1].start = "2027-05-03"; }, "Woche 35", "Woche 35 falsches Startdatum");

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
ok(planDayState(plan.goal.raceDate, [plan]) === "woche", "planDayState: Renntag liegt in Woche 35 ('woche', keine Lücke mehr)");
{
  // 'bisZumRennen' bleibt für Pläne mit Lücke erhalten (A8/E7), hier mit künstlich späterem Renndatum.
  const gap = { ...plan, goal: { ...plan.goal, raceDate: "2027-05-09", raceDateConfirmed: false } };
  ok(planDayState("2027-05-09", [gap]) === "bisZumRennen", "planDayState: Plan mit späterem Renntag -> 'bisZumRennen'");
}
ok(planDayState(addDays(plan.goal.raceDate, 1), [plan]) === "keinPlan", "planDayState: Tag nach dem Rennen -> 'keinPlan'");
ok(planDayState(addDays(plan.start, -1), [plan]) === "keinPlan", "planDayState: Tag vor Planstart -> 'keinPlan'");
ok(activePlanFor(addDays(plan.start, -1), [plan]) === null, "activePlanFor: vor Planstart kein aktiver Plan");
ok(activePlanFor(plan.goal.raceDate, [plan]) === plan, "activePlanFor: am Renntag noch derselbe Plan aktiv");

// formatGoal: unbestätigtes Datum zeigt nur den Monat (Anfang/Mitte/Ende),
// bestätigtes Datum das genaue Tagesdatum.
ok(formatGoal(plan.goal).race === "Halbmarathon, 02.05.2027", `formatGoal bestätigt (${formatGoal(plan.goal).race})`);
ok(
  formatGoal({ ...plan.goal, raceDateConfirmed: false }).race === "Halbmarathon, ca. Anfang Mai 2027",
  `formatGoal unbestätigt (${formatGoal({ ...plan.goal, raceDateConfirmed: false }).race})`
);
ok(formatGoal({ ...plan.goal, raceDateConfirmed: false, raceDate: "2027-04-05" }).race.includes("Anfang April"), "formatGoal: Tag 1-10 -> 'Anfang'");
ok(formatGoal({ ...plan.goal, raceDateConfirmed: false, raceDate: "2027-04-15" }).race.includes("Mitte April"), "formatGoal: Tag 11-20 -> 'Mitte'");
ok(formatGoal({ ...plan.goal, raceDateConfirmed: false, raceDate: "2027-04-25" }).race.includes("Ende April"), "formatGoal: Tag 21-31 -> 'Ende'");

// phaseRange über den Jahreswechsel: beide Enden zeigen das Jahr.
{
  const phase2 = phaseOf(plan, 9);
  ok(phase2.n === 2, "phaseOf(9): liegt in Phase 2");
  ok(phaseRange(plan, phase2) === "26.10.2026–17.01.2027", `phaseRange über den Jahreswechsel (${phaseRange(plan, phase2)})`);
  const phase1 = phaseOf(plan, 1);
  ok(phaseRange(plan, phase1) === "31.08.–25.10.2026", `phaseRange innerhalb eines Jahres (${phaseRange(plan, phase1)})`);
}

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Plandaten-Tests bestanden");
process.exit(fails ? 1 : 0);
