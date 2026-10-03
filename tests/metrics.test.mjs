// Prüft die reine Ampel-/Kennzahlenlogik aus metrics.js ohne Browser (M2-3).
// Ein Test je Status (grün/gelb/rot/grau) je Ampel, plus die Fenster-Grenzen
// über die beiden Zeitumstellungen (A7) und Deload-/Soll-Wechsel bei der
// Kraft-Progression.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  wochensoll, easyDisziplin, belastung, kraftProgression,
  adherence4w, aerobeEffizienz, weeklyVolume, worstStatus, kraftHistoryByExercise,
} from "../metrics.js";
import { suggestProgression } from "../progression.js";

const THRESHOLDS = {
  wochensoll: { gruen: 0.9, gelb: 0.7 },
  easy: { gelbMaxOver: 8 },
  belastung: { gruen: 1.3, gelb: 1.5, minHistoryDays: 28 },
  kraft: { windowDays: 42, stallSessions: 2, minExercisesWithData: 3, redAffectedCount: 2, redConsecutiveBelow: 2 },
};

// ---------- Ampel 1: Wochensoll ----------
test("wochensoll: grün ab 90% der geplanten km bis heute, Kraft vollständig", () => {
  const sessions = [
    { date: "2026-09-07", kind: "lauf", km: 8 },
    { date: "2026-09-08", kind: "kraft", exercises: [{ name: "Squats" }] },
    { date: "2026-09-09", kind: "lauf", km: 8 },
  ];
  const r = wochensoll(sessions, { "2026-09-07": 8, "2026-09-09": 7.5 }, { "2026-09-08": true }, "2026-09-09", THRESHOLDS);
  assert.equal(r.status, "gruen");
  assert.equal(r.detail, "15,5 / 16 km · Kraft 1/1");
});

test("wochensoll: gelb zwischen 70% und 90%", () => {
  const sessions = [{ date: "2026-09-07", kind: "lauf", km: 10 }];
  const r = wochensoll(sessions, { "2026-09-07": 7.5 }, {}, "2026-09-07", THRESHOLDS);
  assert.equal(r.status, "gelb");
});

test("wochensoll: rot unter 70%", () => {
  const sessions = [{ date: "2026-09-07", kind: "lauf", km: 10 }];
  const r = wochensoll(sessions, { "2026-09-07": 5 }, {}, "2026-09-07", THRESHOLDS);
  assert.equal(r.status, "rot");
});

test("wochensoll: verpasste vergangene Krafteinheit -> mindestens gelb, auch bei 100% Lauf", () => {
  const sessions = [
    { date: "2026-09-07", kind: "lauf", km: 8 },
    { date: "2026-09-06", kind: "kraft", exercises: [{ name: "Squats" }] },
  ];
  const r = wochensoll(sessions, { "2026-09-07": 8 }, { "2026-09-06": false }, "2026-09-08", THRESHOLDS);
  assert.equal(r.status, "gelb");
});

test("wochensoll: heutige offene Krafteinheit zählt nicht als verpasst", () => {
  const sessions = [{ date: "2026-09-08", kind: "kraft", exercises: [{ name: "Squats" }] }];
  const r = wochensoll(sessions, {}, { "2026-09-08": false }, "2026-09-08", THRESHOLDS);
  assert.equal(r.status, "gruen");
});

// ---------- Ampel 2: Easy-Disziplin ----------
test("easyDisziplin: grün, alle drei unter der Obergrenze", () => {
  const runs = [
    { avgHr: 150, hfMax: 163, dayLabel: "Mo" },
    { avgHr: 155, hfMax: 163, dayLabel: "Mi" },
    { avgHr: 158, hfMax: 160, dayLabel: "Sa" },
  ];
  assert.equal(easyDisziplin(runs, THRESHOLDS).status, "gruen");
});

test("easyDisziplin: gelb, genau ein Ausreißer bis 8 bpm drüber", () => {
  const runs = [
    { avgHr: 166, hfMax: 160, dayLabel: "Mi" },
    { avgHr: 150, hfMax: 163, dayLabel: "Mo" },
    { avgHr: 155, hfMax: 163, dayLabel: "Sa" },
  ];
  const r = easyDisziplin(runs, THRESHOLDS);
  assert.equal(r.status, "gelb");
  assert.equal(r.detail, "Mi: Ø 166 bpm, Obergrenze 160");
});

test("easyDisziplin: rot, zwei Ausreißer", () => {
  const runs = [
    { avgHr: 166, hfMax: 160, dayLabel: "Mi" },
    { avgHr: 170, hfMax: 163, dayLabel: "Mo" },
    { avgHr: 155, hfMax: 163, dayLabel: "Sa" },
  ];
  assert.equal(easyDisziplin(runs, THRESHOLDS).status, "rot");
});

test("easyDisziplin: rot, ein Ausreißer mehr als 8 bpm drüber", () => {
  const runs = [{ avgHr: 172, hfMax: 160, dayLabel: "Mi" }];
  assert.equal(easyDisziplin(runs, THRESHOLDS).status, "rot");
});

test("easyDisziplin: grau bei weniger als 1 zugeordnetem Lauf", () => {
  assert.equal(easyDisziplin([], THRESHOLDS).status, "grau");
});

// I5 (Code-Review M2 Runde 1): easy.gelbMaxOver stand vorher fest im Code
// (metrics.js:68 `r.over > 8`) statt aus THRESHOLDS zu kommen — eine
// geänderte Schwelle musste den Status kippen, tat es aber nicht.
test("easyDisziplin: eine geänderte THRESHOLDS-Schwelle (gelbMaxOver) kippt gelb zu rot", () => {
  const runs = [{ avgHr: 166, hfMax: 160, dayLabel: "Mi" }]; // over = 6
  const normal = easyDisziplin(runs, { easy: { gelbMaxOver: 8 } });
  const strict = easyDisziplin(runs, { easy: { gelbMaxOver: 5 } });
  assert.equal(normal.status, "gelb");
  assert.equal(strict.status, "rot");
});

// ---------- Ampel 3: Belastung (A7: DST-Fenster) ----------
function shift(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
// Ein Lauf mitten im 7-Tage-Fenster, einer mitten im 28-Tage-Fenster davor,
// weit genug zurück (-33 Tage), um die 4-Wochen-Historie zu erfüllen (nur
// die Fensterlogik ist hier relevant, nicht ein realistisches Trainingsbild).
function runsAround(centerISO, { km7 = 20, km28 = 80 } = {}) {
  return [
    { date: shift(centerISO, -3), distanceKm: km7 },
    { date: shift(centerISO, -33), distanceKm: km28 },
  ];
}

test("belastung: grün bei Verhältnis <= 1.3", () => {
  const r = belastung(runsAround("2026-09-30", { km7: 20, km28: 80 }), "2026-09-30", THRESHOLDS);
  assert.equal(r.status, "gruen");
});

test("belastung: rot bei Verhältnis > 1.5, Anzeige als Verhältnis (Komma), nicht Prozent", () => {
  const r = belastung(runsAround("2026-09-30", { km7: 30, km28: 8 }), "2026-09-30", THRESHOLDS);
  assert.equal(r.status, "rot");
  assert.ok(!r.detail.includes("%"), "keine Prozentangabe: " + r.detail);
  assert.ok(r.detail.startsWith("Verhältnis "), r.detail);
});

test("belastung: grau bei weniger als 4 Wochen Historie", () => {
  const runs = [{ date: "2026-09-25", distanceKm: 20 }];
  assert.equal(belastung(runs, "2026-09-30", THRESHOLDS).status, "grau");
});

test("belastung: Fenster rechnet korrekt über die Zeitumstellung 25.10.2026", () => {
  const runs = runsAround("2026-10-28", { km7: 20, km28: 80 });
  const r = belastung(runs, "2026-10-28", THRESHOLDS);
  assert.equal(r.status, "gruen");
});

test("belastung: Fenster rechnet korrekt über die Zeitumstellung 28.03.2027", () => {
  const runs = runsAround("2027-03-30", { km7: 20, km28: 80 });
  const r = belastung(runs, "2027-03-30", THRESHOLDS);
  assert.equal(r.status, "gruen");
});

// I5 (Code-Review M2 Runde 1): die bisherigen DST-Tests legten die Läufe
// 3 bzw. 33 Tage vor "heute" — weit weg von den echten Fenstergrenzen
// (−6/−7 für die 7 Tage, −34/−35 für die 28 Tage). Ein Off-by-one an genau
// diesen Grenzen wäre dort nicht aufgefallen. Diese Tests legen Läufe
// GENAU auf die Grenze, einmal über jede der beiden Zeitumstellungen.
function boundaryTests(center) {
  test(`belastung: 7-Tage-Grenze (heute−6 zählt dazu, heute−7 nicht mehr) über ${center}`, () => {
    // hist liegt sicher im 28-Tage-Fenster (−33), unabhängig vom Grenzfall.
    const hist = { date: shift(center, -33), distanceKm: 28 };
    const atMinus6 = belastung([hist, { date: shift(center, -6), distanceKm: 28 }], center, THRESHOLDS);
    const atMinus7 = belastung([hist, { date: shift(center, -7), distanceKm: 28 }], center, THRESHOLDS);
    // −6: zählt zu den 7 Tagen -> km7=28, km28=28 (nur hist) -> ratio 4.0 -> rot.
    // −7: zählt NUR zu den 28 Tagen -> km7=0, km28=56 -> ratio 0 -> gruen.
    // Ein Off-by-one (Grenze um einen Tag verschoben) würde beide Fälle
    // gleich ausfallen lassen.
    assert.equal(atMinus6.status, "rot", `heute−6 muss zu den 7 Tagen zählen (${JSON.stringify(atMinus6)})`);
    assert.equal(atMinus7.status, "gruen", `heute−7 darf NICHT mehr zu den 7 Tagen zählen (${JSON.stringify(atMinus7)})`);
  });

  test(`belastung: 28-Tage-Grenze (heute−34 zählt dazu, heute−35 nicht mehr) über ${center}`, () => {
    const near = { date: shift(center, -3), distanceKm: 7 }; // konstant in beiden Fällen, im 7-Tage-Fenster
    const atMinus34 = belastung([near, { date: shift(center, -34), distanceKm: 28 }], center, THRESHOLDS);
    const atMinus35 = belastung([near, { date: shift(center, -35), distanceKm: 28 }], center, THRESHOLDS);
    // −34: zählt noch zu den 28 Tagen -> km28=28, weeklyAvg=7, km7=7 -> ratio 1.0 -> gruen.
    // −35: zählt NICHT mehr -> km28=0 -> ratio unendlich (km7>0) -> rot.
    assert.equal(atMinus34.status, "gruen", `heute−34 muss noch zu den 28 Tagen zählen (${JSON.stringify(atMinus34)})`);
    assert.equal(atMinus35.status, "rot", `heute−35 darf NICHT mehr zu den 28 Tagen zählen (${JSON.stringify(atMinus35)})`);
  });
}
boundaryTests("2026-10-28"); // Zeitumstellung 25.10.2026
boundaryTests("2027-03-30"); // Zeitumstellung 28.03.2027

test("belastung: eine geänderte THRESHOLDS-Schwelle (gruen/gelb) kippt den Status", () => {
  const runs = runsAround("2026-09-30", { km7: 10, km28: 32 }); // ratio = 10/8 = 1.25
  const normal = belastung(runs, "2026-09-30", { belastung: { gruen: 1.3, gelb: 1.5, minHistoryDays: 28 } });
  const strict = belastung(runs, "2026-09-30", { belastung: { gruen: 1.0, gelb: 1.2, minHistoryDays: 28 } });
  assert.equal(normal.status, "gruen");
  assert.equal(strict.status, "rot");
});

// K1 (Code-Review M2 Runde 1): ein unendliches Verhältnis (Läufe in den
// letzten 7 Tagen, aber keine Historie in den 28 Tagen davor) darf weder
// `Infinity` zurückgeben (wird beim JSON.stringify zu `null`, der Worker
// lehnt den weekly-Body dann ab) noch "∞" im Detailtext (nicht auf der
// Zeichen-Whitelist des Workers, siehe worker.js STR_CHAR_RE).
test("belastung: unendliches Verhältnis liefert ratio:null statt Infinity und einen Whitelist-tauglichen Text ohne '∞'", () => {
  const runs = [{ date: "2026-09-20", distanceKm: 20 }]; // nur in den letzten 7 Tagen
  const r = belastung(runs, "2026-09-24", { belastung: { gruen: 1.3, gelb: 1.5, minHistoryDays: 1 } });
  assert.equal(r.status, "rot");
  assert.equal(r.ratio, null);
  assert.ok(JSON.parse(JSON.stringify(r)).ratio === null, "Infinity würde zu null, aber über einen Umweg, der leicht übersehen wird");
  assert.ok(!r.detail.includes("∞"), r.detail);
  assert.match(r.detail, /^[\p{L}0-9 .,:;/()+\-–×%°'·]*$/u, "Detail muss die Worker-Zeichen-Whitelist erfüllen: " + r.detail);
});

// ---------- Ampel 4: Kraft-Progression ----------
function entries(list) {
  const m = new Map();
  for (const [name, es] of Object.entries(list)) m.set(name, es);
  return m;
}

test("kraftProgression: grau unter minExercisesWithData", () => {
  const r = kraftProgression(entries({ Squats: [{ date: "2026-09-01", soll: "3x8-10", topKg: 60, totalReps: 24, sets: [{ reps: 8 }] }] }), THRESHOLDS);
  assert.equal(r.status, "grau");
});

test("kraftProgression: grün, keine Übung hängt fest oder ist unter Soll", () => {
  const mk = (kg) => [{ date: "2026-09-01", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  const r = kraftProgression(entries({ Squats: mk(60), Deadlift: mk(80), Bench: mk(50) }), THRESHOLDS);
  assert.equal(r.status, "gruen");
  assert.equal(r.detail, "3 Übungen, keine hängt fest");
});

test("kraftProgression: gelb, genau eine Übung stagniert (Deload-Woche übersprungen, W3->W5 Soll-Wechsel zählt neu)", () => {
  const ok = (kg) => [{ date: "2026-09-01", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  // Squats: Woche 3 Soll 3x8-10 bei 60kg, dann Deload (nicht in den Einheiten
  // enthalten, weil Deload-Einheiten vorab herausgefiltert werden), dann
  // Woche 5 Soll wechselt auf 4x4-6 -> Zählung beginnt neu, keine Stagnation
  // trotz "weniger Wdh" nach dem Wechsel.
  const squats = [
    { date: "2026-08-31", soll: "3x8-10", topKg: 60, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
    { date: "2026-09-07", soll: "3x8-10", topKg: 60, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
    { date: "2026-09-21", soll: "4x4-6", topKg: 60, totalReps: 20, sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }, { reps: 5 }] },
  ];
  const stagnant = [
    { date: "2026-08-31", soll: "3x8-10", topKg: 70, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
    { date: "2026-09-07", soll: "3x8-10", topKg: 70, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
  ];
  const r = kraftProgression(entries({ Squats: squats, Deadlift: stagnant, Bench: ok(50) }), THRESHOLDS);
  assert.equal(r.status, "gelb");
  assert.ok(r.detail.includes("Deadlift"), r.detail);
});

test("kraftProgression: rot bei zwei betroffenen Übungen", () => {
  const stagnant = (kg) => [
    { date: "2026-08-31", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
    { date: "2026-09-07", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
  ];
  const ok = [{ date: "2026-09-01", soll: "3x8-10", topKg: 50, totalReps: 30, sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] }];
  const r = kraftProgression(entries({ Squats: stagnant(60), Deadlift: stagnant(70), Bench: ok }), THRESHOLDS);
  assert.equal(r.status, "rot");
});

test("kraftProgression: rot, dieselbe Übung zwei Nicht-Deload-Einheiten in Folge unter Soll", () => {
  const under = [
    { date: "2026-08-31", soll: "3x5", topKg: 100, totalReps: 12, sets: [{ reps: 4 }, { reps: 4 }, { reps: 4 }] },
    { date: "2026-09-07", soll: "3x5", topKg: 100, totalReps: 12, sets: [{ reps: 4 }, { reps: 4 }, { reps: 4 }] },
  ];
  const ok = (kg) => [{ date: "2026-09-01", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  const r = kraftProgression(entries({ Deadlift: under, Squats: ok(60), Bench: ok(50) }), THRESHOLDS);
  assert.equal(r.status, "rot");
});

test("kraftProgression: eine geänderte THRESHOLDS-Schwelle kippt den Status", () => {
  const stagnant = [
    { date: "2026-08-31", soll: "3x8-10", topKg: 60, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
    { date: "2026-09-07", soll: "3x8-10", topKg: 60, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
  ];
  const ok = (kg) => [{ date: "2026-09-01", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  const map = entries({ Squats: stagnant, Deadlift: ok(70), Bench: ok(50) });
  const normal = kraftProgression(map, THRESHOLDS);
  const strict = kraftProgression(map, { kraft: { ...THRESHOLDS.kraft, redAffectedCount: 1 } });
  assert.equal(normal.status, "gelb");
  assert.equal(strict.status, "rot");
});

// I5 (Code-Review M2 Runde 1, S1): kraftHistoryByExercise filtert Deload-
// Einheiten heraus, bevor kraftProgression sie sieht — das stand vorher
// nirgends im Test (die Funktion lebte unexportiert in app.js). Eine echte
// Deload-Einheit mit abweichendem Soll ("2x8 (Deload)") darf weder in der
// Historie landen noch eine bestehende Stagnation unterbrechen.
test("kraftHistoryByExercise: eine echte Deload-Einheit wird übersprungen, Stagnation bleibt ununterbrochen", () => {
  const ok3 = [{ date: "2026-09-01", exercise: "bench", name: "Bench", completed: true, soll: "3x8-10", topKg: 50, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  const ok4 = [{ date: "2026-09-01", exercise: "deadlift", name: "Deadlift", completed: true, soll: "3x8-10", topKg: 80, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  const squatsLogs = [
    { date: "2026-08-31", exercise: "squats", name: "Squats", completed: true, soll: "3x8-10", topKg: 60, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
    { date: "2026-09-07", exercise: "squats", name: "Squats", completed: true, soll: "2x8 (Deload)", topKg: 40, totalReps: 16, sets: [{ reps: 8 }, { reps: 8 }] },
    { date: "2026-09-14", exercise: "squats", name: "Squats", completed: true, soll: "3x8-10", topKg: 60, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] },
  ];
  const map = kraftHistoryByExercise([...squatsLogs, ...ok3, ...ok4], "2026-09-14", 42);
  const squats = map.get("Squats");
  assert.equal(squats.length, 2, "die Deload-Einheit darf nicht in der Historie stehen");
  assert.ok(squats.every((e) => !/deload/i.test(e.soll)), "keine Deload-Einheit in der gefilterten Historie: " + JSON.stringify(squats));

  const r = kraftProgression(map, THRESHOLDS);
  const squatsResult = r.results.find((x) => x.name === "Squats");
  assert.equal(squatsResult.status, "stagniert", "gleiches Schema/topKg/Gesamt-Wdh vor und nach dem übersprungenen Deload -> Stagnation bleibt sichtbar");
});

// I5 (Code-Review M2 Runde 1): suggestProgression (progression.js) und
// kraftProgression (metrics.js) klassifizieren unabhängig voneinander —
// sie dürfen sich bei "unter Soll" nicht widersprechen. Ausnahme bewusst
// ausgeklammert (siehe M3 im Code-Review): Sätze mit reps:0 behandeln
// beide unterschiedlich, deshalb nur reps > 0 in diesem Test.
test("Konsistenz: suggestProgression level 'down' <-> kraftProgression Status 'unterSoll'", () => {
  const entry = (date, soll, topKg, reps) => ({
    date, soll, topKg, totalReps: reps.reduce((a, b) => a + b, 0), sets: reps.map((r) => ({ reps: r, kg: topKg })),
  });
  const cases = {
    ImRahmen: [entry("2026-09-01", "3x8-10", 60, [9, 9, 9])],
    UnterSoll: [entry("2026-09-01", "3x8-10", 60, [5, 5, 5])],
    AmOberenEnde: [entry("2026-09-01", "3x8-10", 60, [10, 10, 10])],
  };
  const r = kraftProgression(entries(cases), THRESHOLDS);
  assert.equal(r.results.length, 3);
  for (const result of r.results) {
    const last = cases[result.name][cases[result.name].length - 1];
    const progression = suggestProgression(last.soll, { sets: last.sets, date: last.date });
    const ampelSaysUnter = result.status === "unterSoll";
    const progressionSaysDown = progression?.level === "down";
    assert.equal(
      ampelSaysUnter, progressionSaysDown,
      `${result.name}: Ampel=${result.status}, suggestProgression=${progression?.level}`
    );
  }
});

// ---------- Adhärenz / Effizienz / Wochenvolumen / worstStatus ----------
test("adherence4w: Prozent aus erledigt/geplant", () => {
  assert.deepEqual(adherence4w(11, 12), { pct: 92, done: 11, planned: 12 });
});

test("aerobeEffizienz: Delta seit erster Woche mit Daten, Wochen ohne Treffer ausgelassen", () => {
  const zone = { hfMin: 148, hfMax: 163 };
  const weeks = [
    { week: 1, runs: [{ paceSecPerKm: 380, avgHr: 155 }] },
    { week: 2, runs: [{ paceSecPerKm: 400, avgHr: 175 }] }, // außerhalb Zone, ausgelassen
    { week: 3, runs: [{ paceSecPerKm: 373, avgHr: 158 }] },
  ];
  const r = aerobeEffizienz(weeks, zone);
  assert.equal(r.points.length, 2);
  assert.equal(r.good, true);
  assert.ok(r.deltaText.includes("Woche 1"), r.deltaText);
});

test("weeklyVolume: Platzhalterwochen ohne Soll, aktuelle Woche markiert", () => {
  const weeks = [
    { n: 1, placeholder: false, plannedKm: 26 },
    { n: 9, placeholder: true },
  ];
  const r = weeklyVolume(weeks, { 1: 26 }, 1);
  assert.equal(r[0].soll, 26);
  assert.equal(r[0].isCurrent, true);
  assert.equal(r[1].soll, null);
});

test("worstStatus: rot vor gelb vor grün, bei Gleichstand nach tieOrder", () => {
  const list = [
    { key: "wochensoll", status: "gelb" },
    { key: "belastung", status: "gelb" },
    { key: "easy", status: "rot" },
  ];
  const w = worstStatus(list, ["belastung", "easy", "wochensoll", "kraft"]);
  assert.equal(w.key, "easy");
});

test("wochensoll: Montagmorgen, Lauf von heute noch offen -> nicht rot", () => {
  const sessions = [
    { date: "2026-09-21", kind: "lauf", km: 7 }, { date: "2026-09-22", kind: "kraft" },
    { date: "2026-09-23", kind: "lauf", km: 7 }, { date: "2026-09-24", kind: "kraft" },
    { date: "2026-09-26", kind: "lauf", km: 10 },
  ];
  const r = wochensoll(sessions, {}, {}, "2026-09-21", THRESHOLDS);
  assert.equal(r.status, "gruen");
  assert.equal(r.detail, "0 / 24 km · Kraft 0/2");
});

test("wochensoll: Montag nach dem Lauf zählt der heutige Lauf mit", () => {
  const sessions = [{ date: "2026-09-21", kind: "lauf", km: 7 }, { date: "2026-09-23", kind: "lauf", km: 7 }];
  assert.equal(wochensoll(sessions, { "2026-09-21": 7.1 }, {}, "2026-09-21", THRESHOLDS).status, "gruen");
  assert.equal(wochensoll(sessions, { "2026-09-21": 4 }, {}, "2026-09-21", THRESHOLDS).status, "rot");
});

test("wochensoll: Dienstag mit verpasstem Montagslauf -> rot", () => {
  const sessions = [{ date: "2026-09-21", kind: "lauf", km: 7 }, { date: "2026-09-23", kind: "lauf", km: 7 }];
  assert.equal(wochensoll(sessions, {}, {}, "2026-09-22", THRESHOLDS).status, "rot");
});

test("kraftProgression: Trend steigt/haelt für die Wochenbilanz", () => {
  const T = { ...THRESHOLDS, kraft: { ...THRESHOLDS.kraft, minExercisesWithData: 1 } };
  const e = (date, kg, reps) => ({ date, soll: "3x8-10", topKg: kg, totalReps: reps * 3, sets: [{ kg, reps }, { kg, reps }, { kg, reps }] });
  const steigt = kraftProgression(new Map([["Squats", [e("2026-09-01", 60, 9), e("2026-09-08", 62.5, 9)]]]), T);
  assert.equal(steigt.results[0].trend, "steigt");
  const haelt = kraftProgression(new Map([["Squats", [e("2026-09-01", 62.5, 9), e("2026-09-08", 60, 10)]]]), T);
  assert.equal(haelt.results[0].status, "ok");
  assert.equal(haelt.results[0].trend, "haelt");
});
