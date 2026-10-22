// Reine Vergleichslogik des Lauf-Tags (Stride E2): Ziel lesen, Balken, Status.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseTarget, rangeScale, rangeBar, distanceStatus, paceStatus, hrStatus } from "../runcompare.js";
import { THRESHOLDS } from "../config.js";

// ---------- parseTarget ----------
test("parseTarget pace: geschlossene Spanne in Sekunden", () => {
  assert.deepEqual(parseTarget("5:45–6:15 /km", "pace"), { type: "closed", min: 345, max: 375 });
  assert.deepEqual(parseTarget("5:45-6:15 /km", "pace"), { type: "closed", min: 345, max: 375 }, "auch mit Bindestrich");
  assert.deepEqual(parseTarget("4:35–4:50 /km", "pace"), { type: "closed", min: 275, max: 290 });
});
test("parseTarget pace: offene Grenzen", () => {
  assert.deepEqual(parseTarget("> 6:40 /km", "pace"), { type: "openMin", min: 400, max: null });
  assert.deepEqual(parseTarget(">6:30/km", "pace"), { type: "openMin", min: 390, max: null });
  assert.deepEqual(parseTarget("< 5:00 /km", "pace"), { type: "openMax", min: null, max: 300 });
});
test("parseTarget hr: Spanne mit und ohne Einheit, offene Grenzen", () => {
  assert.deepEqual(parseTarget("148–163 bpm", "hr"), { type: "closed", min: 148, max: 163 });
  assert.deepEqual(parseTarget("172–181", "hr"), { type: "closed", min: 172, max: 181 });
  assert.deepEqual(parseTarget("< 148 bpm", "hr"), { type: "openMax", min: null, max: 148 });
  assert.deepEqual(parseTarget("< 148", "hr"), { type: "openMax", min: null, max: 148 });
  assert.deepEqual(parseTarget("> 184", "hr"), { type: "openMin", min: 184, max: null });
});
test("parseTarget: Kommazahlen bei HF", () => {
  assert.deepEqual(parseTarget("148,5–163,5 bpm", "hr"), { type: "closed", min: 148.5, max: 163.5 });
});
test("parseTarget: Freitext, zusammengesetzt und unlesbar sind free", () => {
  const free = { type: "free", min: null, max: null };
  for (const t of [
    "Kalibrierungstest",
    "30 min so schnell wie gleichmäßig möglich",
    "5:45–6:20 /km, Schluss 5:00–5:10 /km",
    "148–160 bpm, Schluss höher",
    "frei, Ø notieren",
    "", "   ", null, undefined, 42,
    "6:15–5:45 /km", // verdreht
  ]) assert.deepEqual(parseTarget(t, "pace"), free, String(t));
  assert.deepEqual(parseTarget("frei, Ø notieren", "hr"), free);
  assert.deepEqual(parseTarget("148–160 bpm", "zzz"), free, "unbekannte Art");
});
test("parseTarget: Pace-Text als HF und umgekehrt ergibt free", () => {
  assert.equal(parseTarget("5:45–6:15 /km", "hr").type, "free");
  assert.equal(parseTarget("148–163 bpm", "pace").type, "free");
});
test("parseTarget liest jedes Ziel der echten Plan-Datei ohne Fehler", () => {
  const plan = JSON.parse(readFileSync(new URL("../plans/hm-2027.json", import.meta.url), "utf8"));
  const counts = { closed: 0, openMin: 0, openMax: 0, free: 0 };
  for (const w of plan.weeks) for (const s of w.sessions ?? []) {
    if (s.kind !== "lauf") continue;
    if (s.pace) counts[parseTarget(s.pace, "pace").type]++;
    if (s.hf) counts[parseTarget(s.hf, "hr").type]++;
  }
  assert.ok(counts.closed > 0 && counts.openMin > 0 && counts.openMax > 0 && counts.free > 0, JSON.stringify(counts));
});

// ---------- rangeScale / rangeBar ----------
test("rangeScale: geschlossene Zone ±30 s bzw. ±18 bpm", () => {
  assert.deepEqual(rangeScale(parseTarget("5:45–6:15 /km", "pace"), "pace"), { min: 315, max: 405 });
  assert.deepEqual(rangeScale(parseTarget("148–163 bpm", "hr"), "hr"), { min: 130, max: 181 });
});
test("rangeScale: offene Grenzen laut Markup-Doku", () => {
  assert.deepEqual(rangeScale(parseTarget("> 6:40 /km", "pace"), "pace"), { min: 370, max: 460 });
  assert.deepEqual(rangeScale(parseTarget("< 5:00 /km", "pace"), "pace"), { min: 240, max: 330 });
  assert.deepEqual(rangeScale(parseTarget("> 184", "hr"), "hr"), { min: 166, max: 220 });
  assert.deepEqual(rangeScale(parseTarget("< 148", "hr"), "hr"), { min: 112, max: 166 });
});
test("rangeScale: free hat die Fallback-Skala 5:45-7:15 bzw. 130-175", () => {
  assert.deepEqual(rangeScale({ type: "free" }, "pace"), { min: 345, max: 435 });
  assert.deepEqual(rangeScale({ type: "free" }, "hr"), { min: 130, max: 175 });
});
test("rangeBar closed: Band und Marker in Prozent", () => {
  const t = parseTarget("148–163 bpm", "hr");
  const scale = rangeScale(t, "hr"); // 130..181
  assert.deepEqual(rangeBar(scale, t, 155), { from: 35.3, to: 64.7, at: 49 });
});
test("rangeBar: Marker wird auf 0 bis 100 geklemmt", () => {
  const t = parseTarget("148–163 bpm", "hr");
  const s = rangeScale(t, "hr");
  assert.equal(rangeBar(s, t, 90).at, 0);
  assert.equal(rangeBar(s, t, 210).at, 100);
});
test("rangeBar offen: Band reicht bis zum Skalenrand", () => {
  const up = parseTarget("> 6:40 /km", "pace"); // Skala 370..460
  assert.deepEqual(rangeBar(rangeScale(up, "pace"), up, 415), { from: 33.3, to: 100, at: 50 });
  const down = parseTarget("< 148", "hr"); // Skala 112..166
  assert.deepEqual(rangeBar(rangeScale(down, "hr"), down, 139), { from: 0, to: 66.7, at: 50 });
});
test("rangeBar: free hat kein Band, ohne Wert kein Marker", () => {
  const free = parseTarget("Kalibrierungstest", "pace");
  assert.deepEqual(rangeBar(rangeScale(free, "pace"), free, 400), { from: null, to: null, at: 61.1 });
  const t = parseTarget("148–163 bpm", "hr");
  assert.equal(rangeBar(rangeScale(t, "hr"), t, null).at, null);
  assert.equal(rangeBar(rangeScale(t, "hr"), t, NaN).at, null);
  assert.equal(rangeBar(rangeScale(t, "hr"), t, undefined).at, null);
});
test("rangeBar: Werte sind Prozente mit höchstens einer Nachkommastelle", () => {
  const t = parseTarget("5:45–6:15 /km", "pace");
  const bar = rangeBar(rangeScale(t, "pace"), t, 361);
  for (const v of Object.values(bar)) assert.equal(v, Math.round(v * 10) / 10);
});

// ---------- distanceStatus (C4) ----------
test("distanceStatus: genau 90 % ist im Plan, 89 % ist zu kurz", () => {
  assert.equal(distanceStatus(7.2, 8, THRESHOLDS), "imPlan");
  assert.equal(distanceStatus(7.1, 8, THRESHOLDS), "zuKurz");
  assert.equal(distanceStatus(8.9, 10, THRESHOLDS), "zuKurz");
  assert.equal(distanceStatus(9, 10, THRESHOLDS), "imPlan");
});
test("distanceStatus: bewertet auf der angezeigten Genauigkeit (eine Nachkommastelle)", () => {
  assert.equal(distanceStatus(7.16, 8, THRESHOLDS), "imPlan", "zeigt 7,2 km");
  assert.equal(distanceStatus(7.15, 8, THRESHOLDS), "imPlan", "zeigt 7,2 km (aufgerundet)");
  assert.equal(distanceStatus(7.14, 8, THRESHOLDS), "zuKurz", "zeigt 7,1 km");
  assert.equal(distanceStatus(6.3, 7, THRESHOLDS), "imPlan", "Gleitkomma-Rest 7 * 0.9");
  assert.equal(distanceStatus(6.2, 7, THRESHOLDS), "zuKurz");
});
test("distanceStatus: urteilt wie formatKm1 anzeigt (8,95 km zeigt 8,9)", () => {
  assert.equal((8.95).toFixed(1), "8.9", "Annahme: toFixed rundet 8.95 ab");
  assert.equal(distanceStatus(8.95, 10, THRESHOLDS), "zuKurz", "angezeigt 8,9 von 10 = 89 %");
  assert.equal(distanceStatus(8.96, 10, THRESHOLDS), "imPlan", "angezeigt 9,0 = 90 %");
  assert.equal(distanceStatus(9.04, 10, THRESHOLDS), "imPlan");
});
test("distanceStatus: länger als Soll und Null-Fälle", () => {
  assert.equal(distanceStatus(12, 8, THRESHOLDS), "imPlan");
  assert.equal(distanceStatus(0, 8, THRESHOLDS), "zuKurz");
  assert.equal(distanceStatus(null, 8, THRESHOLDS), null);
  assert.equal(distanceStatus(NaN, 8, THRESHOLDS), null);
  assert.equal(distanceStatus(8, 0, THRESHOLDS), null);
  assert.equal(distanceStatus(8, null, THRESHOLDS), null);
});
test("distanceStatus: Schwelle kommt aus THRESHOLDS.lauf.zuKurz", () => {
  assert.equal(THRESHOLDS.lauf.zuKurz, 0.9, "echte config.js");
  assert.equal(distanceStatus(7, 10, { lauf: { zuKurz: 0.7 } }), "imPlan");
  assert.equal(distanceStatus(7, 10, { lauf: { zuKurz: 0.8 } }), "zuKurz");
});

// ---------- paceStatus ----------
test("paceStatus: im Band ok, außerhalb warn, auf ganze Sekunden gerundet", () => {
  const t = parseTarget("5:45–6:15 /km", "pace"); // 345..375
  assert.equal(paceStatus(t, 360, "Easy"), "ok");
  assert.equal(paceStatus(t, 345, "Easy"), "ok");
  assert.equal(paceStatus(t, 375, "Easy"), "ok");
  assert.equal(paceStatus(t, 375.4, "Easy"), "ok", "zeigt 6:15");
  assert.equal(paceStatus(t, 375.6, "Easy"), "warn", "zeigt 6:16");
  assert.equal(paceStatus(t, 330, "Easy"), "warn");
});
test("paceStatus: offene Grenzen", () => {
  assert.equal(paceStatus(parseTarget("> 6:40 /km", "pace"), 410, "Recovery"), "ok");
  assert.equal(paceStatus(parseTarget("> 6:40 /km", "pace"), 380, "Recovery"), "warn");
  assert.equal(paceStatus(parseTarget("< 5:00 /km", "pace"), 290, "Easy"), "ok");
});
test("paceStatus: Schwelle, Intervalle und Test sind neutral", () => {
  const t = parseTarget("4:35–4:50 /km", "pace");
  assert.equal(paceStatus(t, 400, "Schwelle"), "neutral");
  assert.equal(paceStatus(t, 400, "Schwelle 4×10 min"), "neutral");
  assert.equal(paceStatus(t, 400, "Intervalle 6×800"), "neutral");
  assert.equal(paceStatus(t, 400, "Test"), "neutral");
  assert.equal(paceStatus(t, 400, "Kalibrierungstest"), "neutral");
});
test("paceStatus: freies Ziel ist neutral, ohne Messwert null", () => {
  assert.equal(paceStatus(parseTarget("Kalibrierungstest", "pace"), 300, "Test"), "neutral");
  assert.equal(paceStatus(parseTarget("5:45–6:20 /km, Schluss 5:00–5:10 /km", "pace"), 330, "LongProgressiv"), "neutral");
  assert.equal(paceStatus(parseTarget("5:45–6:15 /km", "pace"), null, "Easy"), null);
  assert.equal(paceStatus(parseTarget("5:45–6:15 /km", "pace"), NaN, "Easy"), null);
});

// ---------- hrStatus ----------
test("hrStatus: grün genau bei avgHr <= hfMax (wie Woche und Easy-Ampel)", () => {
  assert.equal(hrStatus(163, 163), "ok");
  assert.equal(hrStatus(150, 163), "ok");
  assert.equal(hrStatus(163.1, 163), "warn");
  assert.equal(hrStatus(164, 163), "warn");
});
test("hrStatus: ohne Wert oder Obergrenze null", () => {
  assert.equal(hrStatus(null, 163), null);
  assert.equal(hrStatus(150, undefined), null);
  assert.equal(hrStatus(NaN, 163), null);
});
