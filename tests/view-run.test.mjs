// Lauf-Tag-Markup (Stride E6): Fälle, die der Browser-Test mit dem echten Plan nicht
// erreicht (kein Soll-km, nur eine Zeile ohne Zielband, Auswahl-Logik).

import assert from "node:assert/strict";
import { test } from "node:test";
import { compareHTML, pickerOptions, sheetBodyHTML, slotState, stravaRowHTML, distanceLabel } from "../view-run.js";
import { THRESHOLDS } from "../config.js";

const formatDuration = () => "50:00 min";
const baseRun = { id: 1, date: "2026-09-07", name: "Lauf", distanceKm: 8, movingTimeSec: 3000, paceSecPerKm: 375, paceLabel: "6:15 /km", avgHr: 150 };
const baseInfo = { type: "Easy run", shortType: "Easy", dist: "8 km", km: 8, pace: "6:10–6:35 /km", hf: "148–163 bpm", hfMax: 163 };
const card = (info, run = baseRun) => compareHTML({ info, run, isLong: false, THRESHOLDS, formatDuration });

test("ohne Soll-km: keine Pille, kein Balken, nur die Dauer", () => {
  const html = card({ ...baseInfo, km: undefined, dist: "frei" });
  assert.match(html, /data-status="none"/);
  assert.doesNotMatch(html, /<progress|sd-pill/);
  assert.match(html, /Dauer 50:00 min/);
});

test("nur die Pace ist frei: eine Zeile ohne Spur und der Pace-Satz", () => {
  const html = card({ ...baseInfo, pace: "frei" });
  assert.equal((html.match(/sd-range--plain/g) || []).length, 1);
  assert.match(html, /Für die Pace gibt es kein Zielband\./);
  assert.equal((html.match(/sd-range__track/g) || []).length, 1);
});

test("nur die Herzfrequenz ist frei: der HF-Satz", () => {
  const html = card({ ...baseInfo, hf: "frei, Ø notieren" });
  assert.match(html, /Für die Herzfrequenz gibt es kein Zielband\./);
});

test("Marker ohne Messwert entfällt, mit extremem Wert bleibt er zwischen 0 und 100", () => {
  assert.doesNotMatch(card(baseInfo, { ...baseRun, avgHr: null }).split("Ø HF")[1], /sd-range__mark/);
  const far = card(baseInfo, { ...baseRun, paceSecPerKm: 99999, paceLabel: "99:99 /km" });
  const x = Number(far.match(/class="sd-range__tick" x1="([\d.]+)"/)[1]);
  assert.ok(x >= 0 && x <= 100);
});

test("Texte aus dem Plan und aus Strava laufen durch esc()", () => {
  const html = card({ ...baseInfo, dist: "8 <b>km</b>", pace: '5:00–6:00 /km "x"' }, { ...baseRun, paceLabel: "<i>6:15</i>" });
  assert.doesNotMatch(html, /<b>|<i>/);
  const row = stravaRowHTML({ iso: "2026-09-07", assignment: { run: { ...baseRun, name: "<script>x</script>", startTime: "07:10" }, offset: 0, source: "exact" } });
  assert.doesNotMatch(row, /<script>/);
  assert.match(row, /&lt;script&gt;x&lt;\/script&gt; · 07:10/);
});

test("Strava-Zeile: negativer Abstand heißt vorgezogen, manuell trägt die Pille 'von Hand'", () => {
  const row = stravaRowHTML({ iso: "2026-09-09", assignment: { run: baseRun, offset: -2, source: "manual" } });
  assert.match(row, /vorgezogen · Mo, 07\.09\./);
  assert.match(row, /data-source="manual"/);
  assert.match(row, /von Hand/);
});

test("slotState: Worker vor Fehler vor nicht verbunden vor ignoriert", () => {
  const vm = { iso: "2026-09-07", info: baseInfo, isLong: false, past: false, workerConfigured: true, error: null, errorSource: null, connected: true, assignment: undefined, THRESHOLDS, formatDuration };
  assert.match(slotState({ ...vm, workerConfigured: false, error: "x" }).html, /data-source="worker"/);
  assert.match(slotState({ ...vm, error: "x", errorSource: "firebase", connected: false }).html, /data-source="firebase"/);
  assert.match(slotState({ ...vm, error: "x", errorSource: "strava" }).html, /data-source="strava"/);
  assert.match(slotState({ ...vm, connected: false }).html, /data-card="no-strava"/);
  assert.match(slotState({ ...vm, assignment: { run: null, offset: 0, source: "ignored" } }).html, /data-card="ignored"/);
  assert.match(slotState({ ...vm, past: true }).html, /data-card="missed"/);
  assert.match(slotState(vm).html, /data-card="empty"/);
  assert.equal(slotState(vm).showTarget, true);
  assert.equal(slotState({ ...vm, assignment: { run: baseRun, offset: 0, source: "exact" } }).showTarget, false);
});

test("pickerOptions: fest vergebene Läufe kommen gesperrt mit takenBy, automatische bleiben frei", () => {
  const runs = [
    { id: 1, date: "2026-09-07", distanceKm: 8 },
    { id: 2, date: "2026-09-08", distanceKm: 5 },
    { id: 3, date: "2026-09-10", distanceKm: 6 },
    { id: 4, date: "2026-09-30", distanceKm: 6 }, // außerhalb des Fensters
  ];
  const assignment = {
    "2026-09-07": { run: runs[0], offset: 0, source: "exact" },
    "2026-09-11": { run: runs[2], offset: -1, source: "auto" },
  };
  const options = pickerOptions(runs, assignment, "2026-09-09");
  assert.deepEqual(options.map((o) => [o.run.id, o.takenBy]), [[2, null], [3, null], [1, "2026-09-07"]]);
});

test("Sheet-Körper: 'Automatik zurück' nur bei manuell oder ignoriert, Neu laden gesperrt wenn beschäftigt", () => {
  const body = (source, busy = false) => sheetBodyHTML({ iso: "2026-09-09", options: [], selectedId: undefined, source, busy });
  assert.doesNotMatch(body("auto"), /reset-run/);
  assert.doesNotMatch(body("exact"), /reset-run/);
  assert.match(body("manual"), /reset-run/);
  assert.match(body("ignored"), /reset-run/);
  assert.match(body("auto", true), /data-action="reload-strava" disabled aria-busy="true"/);
  assert.match(body("auto"), /data-slot="no-options"/);
  assert.match(body("auto"), /Kein Lauf an diesem Tag/);
});

test("Abstandstext mit Einzahl und Mehrzahl", () => {
  assert.equal(distanceLabel(0), "am Plantag");
  assert.equal(distanceLabel(1), "1 Tag später");
  assert.equal(distanceLabel(2), "2 Tage später");
  assert.equal(distanceLabel(-1), "1 Tag früher");
});
