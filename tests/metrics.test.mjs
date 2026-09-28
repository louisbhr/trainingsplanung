// Prüft die reine Ampel-/Kennzahlenlogik aus metrics.js ohne Browser (M2-3).
// Ein Test je Status (grün/gelb/rot/grau) je Ampel, plus die Fenster-Grenzen
// über die beiden Zeitumstellungen (A7) und Deload-/Soll-Wechsel bei der
// Kraft-Progression.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  wochensoll, easyDisziplin, belastung, kraftProgression,
  adherence4w, aerobeEffizienz, weeklyVolume, worstStatus,
} from "../metrics.js";

const THRESHOLDS = {
  wochensoll: { gruen: 0.9, gelb: 0.7 },
  belastung: { gruen: 1.3, gelb: 1.5 },
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
  assert.equal(r.detail, "15.5 / 16 km · Kraft 1/1");
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
