// Markup und Geometrie von Verlauf, Plan und Konto (Stride E7) ohne Browser: Fälle, die der
// Browser-Test mit dem echten Plan nicht erreicht (Rundung, Ausdünnen, Grenzwerte, esc).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  svgNum, mmss, barRects, axisHTML, runStats, runSlotHTML, strengthEntries, strengthSlotHTML, headHTML, infoContent,
} from "../view-history.js";
import { phaseBarGeometry, pageHTML as planPageHTML, headHTML as planHeadHTML } from "../view-plan.js";
import { syncText, stravaStatus, renderAccountSection } from "../view-account.js";

const plan = JSON.parse(readFileSync(new URL("../plans/hm-2027.json", import.meta.url), "utf8"));

test("svgNum: Punkt als Trenner, eine Nachkommastelle, nie NaN", () => {
  assert.equal(svgNum(12.3456), "12.3");
  assert.equal(svgNum(NaN), "0");
  assert.equal(svgNum(Infinity), "0");
});

test("mmss: Sekundenüberlauf und fehlende Pace", () => {
  assert.equal(mmss(382), "6:22");
  assert.equal(mmss(359.7), "6:00");
  assert.equal(mmss(null), "–");
});

test("barRects: y + height endet immer auf Grundlinie + 5, auch nach dem Runden", () => {
  for (const values of [[70, 80, null, 60], [5.2, 18.4, 7.7, 9.9, 12.3, 8.1], [1, 1000]]) {
    for (const g of barRects(values, { plotHeight: 130, gap: 3 }).filter(Boolean)) {
      assert.equal(Math.round((Number(g.y) + Number(g.height)) * 10) / 10, 135);
      assert.ok(Number(g.x) >= 0 && Number(g.x) + Number(g.width) <= 320);
    }
  }
});

test("barRects: kleinster Balken mindestens 4 hoch, ein Platz = 24 breit, leere Plätze bleiben null", () => {
  const [a, b, c] = barRects([1, 1000, null], { plotHeight: 120, gap: 6 });
  assert.equal(Number(a.y), 116);
  assert.equal(a.width, "24");
  assert.equal(b.y, "0");
  assert.equal(c, null);
  assert.deepEqual(barRects([], { plotHeight: 120, gap: 6 }), []);
  assert.deepEqual(barRects([0, 0], { plotHeight: 120, gap: 6 }), []);
});

test("barRects: Balkenbreite folgt dem Platz (35 Wochen: höchstens slot - 3)", () => {
  const rects = barRects(Array.from({ length: 35 }, (_, i) => i + 1), { plotHeight: 130, gap: 3 });
  assert.equal(rects.length, 35);
  assert.ok(rects.every((r) => Number(r.width) <= 320 / 35 - 3 + 0.05));
  assert.ok(rects.every((r) => Number(r.rx) <= Number(r.width) / 2 + 0.1)); // beide auf 0,1 gerundet
});

test("axisHTML: immer genau n Spans, Ausdünnen vom neuesten Platz, aktuelle Woche immer beschriftet", () => {
  const spans = (labels, cur) => [...axisHTML(labels, cur).matchAll(/<span([^>]*)>([^<]*)<\/span>/g)].map((m) => ({ cls: m[1], text: m[2] }));
  const ten = spans(Array.from({ length: 10 }, (_, i) => `${i + 1}`));
  assert.equal(ten.length, 10);
  assert.ok(ten.every((s) => s.text));
  const eleven = spans(Array.from({ length: 11 }, (_, i) => `W${i + 1}`), 10);
  assert.equal(eleven.length, 11);
  assert.deepEqual(eleven.filter((s) => s.text).map((s) => s.text), ["W1", "W3", "W5", "W7", "W9", "W11"]);
  const w35 = spans(Array.from({ length: 35 }, (_, i) => `W${i + 1}`), 34);
  assert.equal(w35.length, 35);
  assert.equal(w35.filter((s) => s.text).length, 9);
  assert.equal(w35[34].text, "W35");
  assert.match(w35[34].cls, /is-current/);
});

test("runStats: Läufe ab Planstart (nicht ab Strava-Fenster), 7 Tage ohne Zukunft", () => {
  const run = (date, km, pace = 360) => ({ date, distanceKm: km, paceSecPerKm: pace });
  const runs = [run("2026-08-20", 5), run("2026-08-31", 6), run("2026-09-05", 12), run("2026-09-07", 8), run("2026-09-10", 8, null)];
  const s = runStats(runs, "2026-09-07", "2026-08-31");
  assert.equal(s.count, 4);
  assert.equal(s.km7, 20); // 01.09. bis 07.09.: 12 + 8; der 31.08. liegt außerhalb, der 10.09. ist Zukunft
  assert.equal(Math.round(s.km28 * 10) / 10, 31);
  assert.equal(s.avgPace, 360);
});

const vm = (runs) => ({ workerConfigured: true, error: null, connected: true, runs, today: "2026-09-07", planStart: "2026-08-31", sinceISO: "2026-07-27" });
const mk = (id, date, extra = {}) => ({ id, date, name: `Lauf ${id}`, distanceKm: 8, paceSecPerKm: 375, planType: null, long: false, ...extra });

test("runSlotHTML: Reihenfolge der Zustände und Escaping", () => {
  assert.match(runSlotHTML({ ...vm([]), workerConfigured: false }), /data-source="worker"/);
  assert.match(runSlotHTML({ ...vm([]), error: "<b>x</b>", errorSource: "strava" }), /data-source="strava"[\s\S]*&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(runSlotHTML({ ...vm([]), connected: false }), /data-card="no-strava"/);
  assert.match(runSlotHTML(vm([])), /data-card="empty"[\s\S]*Seit 27\.07\./);
  const html = runSlotHTML(vm([mk(1, "2026-09-07", { name: "<img src=x onerror=alert(1)>" })]));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /style=/);
});

test("runSlotHTML: Pace fehlt -> Strich ohne Trennpunkt; Plan-Typ schlägt Strava-Namen; Long Run mit Legende", () => {
  const html = runSlotHTML(vm([
    mk(1, "2026-09-05", { long: true, planType: "Long run" }),
    mk(2, "2026-09-07", { paceSecPerKm: null }),
  ]));
  assert.match(html, /<span>8,0 km<\/span><span>–<\/span>/);
  assert.match(html, /<span class="sd-hrow__title">Long run<\/span>/);
  assert.match(html, /sd-chart__bar--long/);
  assert.match(html, /sd-chart__swatch--long/);
  assert.equal(runSlotHTML(vm([mk(2, "2026-09-07")])).includes("sd-chart__legend"), false);
});

test("runSlotHTML: ein einziger Lauf, Karte und Liste stehen", () => {
  const html = runSlotHTML(vm([mk(1, "2026-09-07")]));
  assert.match(html, /Letzter Lauf/);
  assert.equal((html.match(/<rect /g) || []).length, 1);
});

const logOf = (date, exercise, kg, reps, extra = {}) =>
  ({ date, exercise, topKg: kg ?? 0, totalReps: reps, completed: true, sets: [{ kg, reps }], ...extra });

test("strengthSlotHTML: ohne Einträge die Leer-Karte mit escaptem Namen", () => {
  const html = strengthSlotHTML({ name: "<i>X</i>", slug: "x", logs: [], plan, today: "2026-09-07" });
  assert.match(html, /data-card="strength-empty"/);
  assert.match(html, /&lt;i&gt;X&lt;\/i&gt;/);
});

test("strengthSlotHTML: Trend, Deload-Legende, Einheit Wdh ohne Gewicht", () => {
  const kg = strengthSlotHTML({
    name: "Squats", slug: "squats", plan, today: "2026-09-23",
    logs: [logOf("2026-09-01", "squats", 70, 9), logOf("2026-09-08", "squats", 82.5, 9), logOf("2026-09-22", "squats", 60, 9)],
  });
  assert.match(kg, /\+12,5 kg<\/span><span class="sd-trend__since">seit W1/);
  assert.match(kg, /sd-chart__bar sd-chart__bar--deload/);
  assert.match(kg, /W4: 60 kg \(Entlastung\)/);
  assert.match(kg, /Woche 4 · Entlastung/);
  const wdh = strengthSlotHTML({
    name: "Klimmzüge", slug: "klimmzuege", plan, today: "2026-09-16",
    logs: [logOf("2026-09-01", "klimmzuege", null, 12), logOf("2026-09-08", "klimmzuege", null, 8)],
  });
  assert.match(wdh, /Wiederholungen gesamt/);
  assert.match(wdh, /−4 Wdh<\/span>/); // echtes Minus, neutral (kein is-up)
  assert.doesNotMatch(wdh, /is-up/);
  assert.doesNotMatch(wdh, /kg/);
});

test("strengthSlotHTML: gleicher Wert = 'unverändert', ein Wert = kein Trend", () => {
  const same = strengthSlotHTML({
    name: "S", slug: "s", plan, today: "2026-09-08",
    logs: [logOf("2026-09-01", "s", 70, 9), logOf("2026-09-08", "s", 70, 9)],
  });
  assert.match(same, /<span>unverändert<\/span>/);
  const one = strengthSlotHTML({ name: "S", slug: "s", plan, today: "2026-09-08", logs: [logOf("2026-09-01", "s", 70, 9)] });
  assert.doesNotMatch(one, /sd-trend/);
  assert.doesNotMatch(one, /verlauf-trend/);
});

test("strengthEntries: nur Einträge mit Wert, höchstens 10, Woche und Entlastung aus dem Plan", () => {
  const logs = Array.from({ length: 12 }, (_, i) => logOf(`2026-09-${String(i + 1).padStart(2, "0")}`, "s", 50 + i, 8));
  logs.push(logOf("2026-09-13", "s", null, 0, { totalReps: 0 }));
  const e = strengthEntries(logs, plan);
  assert.equal(e.length, 10);
  assert.equal(e.at(-1).date, "2026-09-12");
  assert.equal(strengthEntries([logOf("2026-09-22", "s", 60, 9)], plan)[0].deload, true);
});

test("headHTML: Chips nur im Modus Kraft, Name und Slug escaped", () => {
  const ex = [{ name: 'A"<b>', slug: 'a"x' }, { name: "B", slug: "b" }];
  assert.doesNotMatch(headHTML({ mode: "lauf", exercises: ex, activeSlug: "b" }), /sd-filter/);
  const kraft = headHTML({ mode: "kraft", exercises: ex, activeSlug: "b" });
  assert.match(kraft, /data-slug="a&quot;x"/);
  assert.match(kraft, /<span>A&quot;&lt;b&gt;<\/span>/);
  assert.match(kraft, /aria-pressed="true" data-action="pick-exercise" data-slug="b"/);
});

test("infoContent: die zwei neuen Schlüssel haben Berechnung und Bedeutung", () => {
  const c = infoContent();
  assert.deepEqual(Object.keys(c).sort(), ["verlauf-pace", "verlauf-trend"]);
  assert.ok(Object.values(c).every((x) => x.blocks.map((b) => b.heading).join() === "Berechnung,Bedeutung"));
});

// ---------- Plan ----------

test("phaseBarGeometry: Breiten proportional, Lücken 3, Füllung nach erledigten Wochen", () => {
  const g = phaseBarGeometry(plan.phases, 9);
  const total = g.reduce((a, s) => a + s.width, 0) + 3 * 3;
  assert.ok(Math.abs(total - 300) < 1e-9);
  assert.ok(Math.abs(g[0].width / g[1].width - 8 / 12) < 1e-9);
  assert.equal(g[0].fill, g[0].width);
  assert.ok(Math.abs(g[1].fill - g[1].width / 12) < 1e-9);
  assert.equal(g[2].fill, 0);
  assert.equal(phaseBarGeometry(plan.phases, 0).every((s) => s.fill === 0), true);
  assert.ok(phaseBarGeometry(plan.phases, 35).every((s) => Math.abs(s.fill - s.width) < 1e-9));
});

test("pageHTML (Plan): vor dem Plan keine laufende Phase und keine Füllung, danach alles gefüllt", () => {
  const html = (status, week) => planPageHTML({ plan, week, status, accountHTML: "" });
  assert.doesNotMatch(html("before", 1), /is-current|sd-phasebar__fill/);
  assert.equal((html("after", 35).match(/sd-phasebar__fill/g) || []).length, 4);
  assert.equal((html("in", 2).match(/sd-phasebar__fill/g) || []).length, 1);
  assert.doesNotMatch(html("in", 2), /style=/);
});

test("pageHTML (Plan): nicht bestätigtes Renndatum zeigt Monat und Hinweis", () => {
  const open = { ...plan, goal: { ...plan.goal, raceDateConfirmed: false, targetPace: undefined } };
  const html = planPageHTML({ plan: open, week: 2, status: "in", accountHTML: "" });
  assert.match(html, /Rennen ca\./);
  assert.match(html, /Anfang Mai 2027/);
  assert.match(html, /Das Renndatum ist noch nicht bestätigt\./);
  assert.doesNotMatch(html, /sd-goal__pace/);
});

test("headHTML (Plan): geschütztes Leerzeichen vor %", () => {
  assert.match(planHeadHTML({ week: 8, totalWeeks: 35, pct: 20 }), /20 % geschafft/);
});

// ---------- Konto ----------

test("syncText: heute mit 'heute', anderer Tag mit Datum, ohne Zeitpunkt leer", () => {
  const now = new Date(2026, 9, 22, 12, 0).getTime();
  assert.equal(syncText(new Date(2026, 9, 22, 7, 5).getTime(), now), "Sync heute 07:05");
  assert.equal(syncText(new Date(2026, 9, 20, 18, 30).getTime(), now), "Sync 20.10. 18:30");
  assert.equal(syncText(null, now), "");
});

test("stravaStatus: alle Zustände, Fehler mit Meldung escaped", () => {
  const base = { workerConfigured: true, connected: true, error: null, fetchedAt: null, now: 0 };
  assert.equal(stravaStatus({ ...base, workerConfigured: false }).dd, "nicht eingerichtet");
  assert.equal(stravaStatus({ ...base, connected: null }).dd, "wird geprüft …");
  assert.equal(stravaStatus({ ...base, connected: false }).dd, "nicht verbunden");
  assert.match(stravaStatus({ ...base, connected: false }).below, /sd-btn--coral" data-action="connect-strava"/);
  assert.equal(stravaStatus(base).dd, "verbunden");
  const err = stravaStatus({ ...base, error: "<b>kaputt</b>" });
  assert.equal(err.dd, "Abruf fehlgeschlagen");
  assert.match(err.ddClass, /is-danger/);
  assert.match(err.below, /&lt;b&gt;kaputt&lt;\/b&gt;/);
  assert.match(err.below, /reload-strava/);
});

test("renderAccountSection: E-Mail escaped, keine UID, Plan-Zeile ohne Knopf, kein style=", () => {
  const html = renderAccountSection({
    email: '"><script>x</script>', planVersion: null,
    strava: { workerConfigured: true, connected: true, error: null, fetchedAt: null, now: 0 },
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /uid|UID/);
  assert.match(html, /data-slot="plan-source"><dt>Plan<\/dt><dd>Plandatei<\/dd>/);
  assert.doesNotMatch(html, /style=/);
  const withVersion = renderAccountSection({
    email: "a@b.c", planVersion: "2026-09-24T10:00",
    strava: { workerConfigured: true, connected: true, error: null, fetchedAt: null, now: 0 },
  });
  assert.match(withVersion, /Plandatei · Version 2026-09-24T10:00/);
});

test("Quelltext-Wächter: view-history.js, view-plan.js und view-account.js ohne style=, Firebase- und Strava-Import (C5)", () => {
  for (const file of ["view-history.js", "view-plan.js", "view-account.js"]) {
    const code = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.doesNotMatch(code, /\bstyle\s*=/, `${file}: style=`);
    assert.doesNotMatch(code, /from "\.\/(firebase-init|strava|app)\.js/, `${file}: Import`);
    assert.doesNotMatch(code, /—/, `${file}: Gedankenstrich`);
  }
});
