// Reine Verlaufs-Aggregation (Stride E2): Wochenbalken, Trendtext, Läufe seit Planstart.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { kraftWeeklyBars, kraftTrendText, runsSince } from "../history-data.js";

const plan = JSON.parse(readFileSync(new URL("../plans/hm-2027.json", import.meta.url), "utf8"));
// Woche n beginnt am plan.start + 7 * (n - 1) Tagen; start ist 2026-08-31
const weekDay = (n, offset = 0) => {
  const d = new Date(Date.UTC(2026, 7, 31 + 7 * (n - 1) + offset));
  return d.toISOString().slice(0, 10);
};
const log = (n, kgs, reps, extra = {}) => ({
  exercise: "squats", date: weekDay(n), completed: true,
  sets: kgs.map((kg, i) => ({ kg, reps: reps[i] })),
  topKg: Math.max(0, ...kgs.map((k) => k ?? 0)), totalReps: reps.reduce((a, b) => a + b, 0), ...extra,
});

test("Testannahme: Woche 1 beginnt am Planstart, es gibt Deload-Wochen", () => {
  assert.equal(plan.start, "2026-08-31");
  assert.ok(plan.weeks.some((w) => w.weekType === "Entlastung"));
});

test("kraftWeeklyBars: bestes Satzgewicht je Planwoche, aufsteigend", () => {
  const bars = kraftWeeklyBars([log(3, [60, 60, 65], [8, 8, 6]), log(1, [50, 50], [8, 8])], "squats", plan);
  assert.deepEqual(bars, [
    { week: 1, value: 50, unit: "kg", deload: false },
    { week: 3, value: 65, unit: "kg", deload: false },
  ]);
});
test("kraftWeeklyBars: zwei Einheiten in einer Woche zählen mit dem Maximum", () => {
  const second = { ...log(2, [70], [5]), date: weekDay(2, 3) };
  const bars = kraftWeeklyBars([log(2, [60], [8]), second], "squats", plan);
  assert.deepEqual(bars, [{ week: 2, value: 70, unit: "kg", deload: false }]);
});
test("kraftWeeklyBars: Woche ohne Daten fehlt, ganz ohne Daten ist die Liste leer", () => {
  const bars = kraftWeeklyBars([log(1, [50], [8]), log(4, [55], [8])], "squats", plan);
  assert.deepEqual(bars.map((b) => b.week), [1, 4]);
  assert.deepEqual(kraftWeeklyBars([], "squats", plan), []);
  assert.deepEqual(kraftWeeklyBars(null, "squats", plan), []);
  assert.deepEqual(kraftWeeklyBars([log(1, [50], [8])], "deadlift", plan), []);
});
test("kraftWeeklyBars: Deload-Woche wird markiert", () => {
  const deloadWeek = plan.weeks.find((w) => w.weekType === "Entlastung").n;
  const normalWeek = plan.weeks.find((w) => w.weekType === "Aufbau").n;
  const bars = kraftWeeklyBars([log(deloadWeek, [40], [8]), log(normalWeek, [60], [8])], "squats", plan);
  assert.equal(bars.find((b) => b.week === deloadWeek).deload, true);
  assert.equal(bars.find((b) => b.week === normalWeek).deload, false);
});
test("kraftWeeklyBars: Übung ohne Gewicht (null und 0) summiert die Wiederholungen", () => {
  const bars = kraftWeeklyBars([
    log(1, [null, null], [6, 6]),
    { ...log(2, [0, 0], [6, 7]), topKg: 0 },
    { ...log(2, [null], [5]), date: weekDay(2, 2) },
  ], "squats", plan);
  assert.deepEqual(bars, [
    { week: 1, value: 12, unit: "Wdh", deload: false },
    { week: 2, value: 18, unit: "Wdh", deload: false },
  ]);
});
test("kraftWeeklyBars: Gewicht gilt für die ganze Übung, Wochen ohne Gewicht fallen dann weg", () => {
  const bars = kraftWeeklyBars([log(1, [50], [8]), log(2, [null], [8])], "squats", plan);
  assert.deepEqual(bars, [{ week: 1, value: 50, unit: "kg", deload: false }]);
});
test("kraftWeeklyBars: Logs außerhalb des Plans und unvollständige Dokumente werden ignoriert", () => {
  const before = { ...log(1, [50], [8]), date: "2026-08-24" };
  const unfinished = log(2, [50], [8], { completed: false });
  const noSets = { exercise: "squats", date: weekDay(2), completed: true, sets: [] };
  assert.deepEqual(kraftWeeklyBars([before, unfinished, noSets], "squats", plan), []);
});
test("kraftWeeklyBars: Kommagewicht bleibt Zahl, ohne topKg im Dokument aus den Sätzen", () => {
  const l = log(1, [62.5, 60], [8, 8]);
  delete l.topKg;
  assert.equal(kraftWeeklyBars([l], "squats", plan)[0].value, 62.5);
});

test("kraftTrendText: Differenz erste zu letzter Nicht-Deload-Woche", () => {
  const bars = [
    { week: 1, value: 40, unit: "kg", deload: false },
    { week: 4, value: 30, unit: "kg", deload: true },
    { week: 5, value: 65, unit: "kg", deload: false },
  ];
  assert.equal(kraftTrendText(bars), "+25 kg seit W1");
});
test("kraftTrendText: Deload am Ende zählt nicht, Start ist die erste Woche mit Daten", () => {
  const bars = [
    { week: 2, value: 40, unit: "kg", deload: false },
    { week: 3, value: 42.5, unit: "kg", deload: false },
    { week: 4, value: 20, unit: "kg", deload: true },
  ];
  assert.equal(kraftTrendText(bars), "+2,5 kg seit W2");
});
test("kraftTrendText: Rückgang, unverändert und Wiederholungen", () => {
  assert.equal(kraftTrendText([{ week: 1, value: 60, unit: "kg", deload: false }, { week: 2, value: 55, unit: "kg", deload: false }]), "−5 kg seit W1");
  assert.equal(kraftTrendText([{ week: 1, value: 60, unit: "kg", deload: false }, { week: 2, value: 60, unit: "kg", deload: false }]), "±0 kg seit W1");
  assert.equal(kraftTrendText([{ week: 1, value: 12, unit: "Wdh", deload: false }, { week: 3, value: 16, unit: "Wdh", deload: false }]), "+4 Wdh seit W1");
});
test("kraftTrendText: weniger als zwei Nicht-Deload-Wochen mit Daten ist null", () => {
  assert.equal(kraftTrendText([]), null);
  assert.equal(kraftTrendText(null), null);
  assert.equal(kraftTrendText([{ week: 1, value: 60, unit: "kg", deload: false }]), null);
  assert.equal(kraftTrendText([{ week: 1, value: 60, unit: "kg", deload: false }, { week: 4, value: 40, unit: "kg", deload: true }]), null);
});

test("runsSince: nur Läufe ab Planstart, inklusive Starttag, Reihenfolge bleibt", () => {
  const runs = [
    { date: "2026-08-30", distanceKm: 5 },
    { date: "2026-08-31", distanceKm: 7 },
    { date: "2026-09-02", distanceKm: 8 },
  ];
  assert.deepEqual(runsSince(runs, "2026-08-31").map((r) => r.date), ["2026-08-31", "2026-09-02"]);
});
test("runsSince: leer, null und Einträge ohne Datum", () => {
  assert.deepEqual(runsSince([], "2026-08-31"), []);
  assert.deepEqual(runsSince(null, "2026-08-31"), []);
  assert.deepEqual(runsSince([{ distanceKm: 3 }, null], "2026-08-31"), []);
});
