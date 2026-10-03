// Prüft den Cloudflare Worker (M2-8, POST /coach) ohne Browser und ohne
// echten Netzwerkzugriff: globalThis.fetch wird für den Aufruf der Claude
// API gemockt. worker.js läuft unverändert unter Node, weil es nur
// Standard-Web-APIs benutzt (Request/Response/fetch/URL).
//
// Wichtig: worker.js wird NICHT deployt (siehe E2) — dieser Test läuft rein
// gegen den Modul-Code, keine echten Secrets, kein echter API-Aufruf.

import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.js";
import { belastung, adherence4w, kraftProgression } from "../metrics.js";
import { buildWeeklyInput } from "../coach.js";

const ORIGIN = "https://louisbhr.github.io";
const ENV = {
  ALLOWED_ORIGINS: ORIGIN,
  ANTHROPIC_API_KEY: "sk-ant-test-key",
  STRAVA_CLIENT_ID: "id",
  STRAVA_CLIENT_SECRET: "secret",
};

function req(path, { method = "POST", origin = ORIGIN, body, rawBody } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin !== null) headers.Origin = origin;
  return new Request(`https://worker.test${path}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function validDaily(overrides = {}) {
  return {
    kind: "daily",
    date: "2026-09-24",
    week: 4,
    weekType: "Entlastung",
    phase: "Basis",
    goal: { distance: "Halbmarathon", targetTime: "1:29:59", raceMonth: 4, raceDateConfirmed: false },
    today: { type: "Kraft", name: "Full Body B (reduziert)", done: false },
    checkpoints: {
      wochensoll: { status: "gruen", detail: "14 / 24 km · Kraft 1/2" },
      easy: { status: "gelb", detail: "Mi: Ø 166 bpm, Obergrenze 160" },
      belastung: { status: "gruen", detail: "Verhältnis 0,72" },
      kraft: { status: "gelb", detail: "Squats: 3× 60 kg ohne Steigerung" },
    },
    next: "Sa: Long Run 10 km",
    aerobeEffizienzTrend: "-7 s/km seit Woche 1",
    ...overrides,
  };
}

function validWeekly(overrides = {}) {
  return {
    kind: "weekly",
    goal: { distance: "Halbmarathon", targetTime: "1:29:59", raceMonth: 4, raceDateConfirmed: false },
    week: 4,
    weekType: "Entlastung",
    phase: "Basis",
    run: { plannedKm: 24, actualKm: 24.3, sessionsPlanned: 3, sessionsDone: 3, easyOverLimit: [{ day: "Mi", avgHr: 166, limit: 160 }] },
    kraft: { sessionsPlanned: 2, sessionsDone: 2, progression: [{ exercise: "Squats", status: "stagniert", detail: "3× 60 kg" }] },
    belastung: { ratio: 0.72, status: "gruen" },
    aerobeEffizienzTrend: "-7 s/km seit Woche 1",
    adherence4w: { done: 11, planned: 12 },
    nextWeek: { n: 5, type: "Aufbau", keySession: "Sa: Long Run 13 km" },
    ...overrides,
  };
}

let lastUpstreamCall = null;
function mockClaude(handler) {
  lastUpstreamCall = null;
  globalThis.fetch = async (url, opts) => {
    lastUpstreamCall = { url, opts, body: opts?.body ? JSON.parse(opts.body) : null };
    return handler(url, opts);
  };
}
function mockClaudeText(text, { stopReason = "end_turn" } = {}) {
  mockClaude(async () =>
    new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: stopReason }), { status: 200 }));
}
function mockClaudeStatus(status) {
  mockClaude(async () => new Response(JSON.stringify({ error: "boom" }), { status }));
}

// ---------- Origin / CORS ----------
test("/coach: 403 bei falschem Origin", async () => {
  mockClaudeText("egal");
  const res = await worker.fetch(req("/coach", { origin: "https://evil.example", body: validDaily() }), ENV);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "origin_not_allowed");
});

test("/coach: 403 ohne Origin-Header", async () => {
  const res = await worker.fetch(req("/coach", { origin: null, body: validDaily() }), ENV);
  assert.equal(res.status, 403);
});

test("/coach: 403 bei leerem ALLOWED_ORIGINS — anders als /exchange, dort bleibt es offen", async () => {
  const res = await worker.fetch(req("/coach", { body: validDaily() }), { ...ENV, ALLOWED_ORIGINS: "" });
  assert.equal(res.status, 403);
});

test("/exchange: leeres ALLOWED_ORIGINS erlaubt weiterhin jede Herkunft (unverändert)", async () => {
  mockClaude(async () => new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_at: 1 }), { status: 200 }));
  const res = await worker.fetch(req("/exchange", { origin: "https://irgendwas.example", body: { code: "c" } }), { ...ENV, ALLOWED_ORIGINS: "" });
  assert.equal(res.status, 200);
});

// ---------- Body-Limit ----------
test("/coach: 413 ab über 8192 Byte, auch ohne verlässlichen Content-Length", async () => {
  const big = "x".repeat(9000);
  const res = await worker.fetch(req("/coach", { rawBody: JSON.stringify(validDaily({ next: big })) }), ENV);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "too_large");
});

// ---------- Schema ----------
test("/coach: 400 bei unbekanntem kind", async () => {
  const res = await worker.fetch(req("/coach", { body: { kind: "monthly" } }), ENV);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_input");
});

test("/coach: 400 bei Zusatzfeld (Whitelist der Feldnamen)", async () => {
  const res = await worker.fetch(req("/coach", { body: validDaily({ extra: "nope" }) }), ENV);
  assert.equal(res.status, 400);
});

test("/coach: 400 bei Zeilenumbruch in einem freien String-Feld", async () => {
  const res = await worker.fetch(req("/coach", {
    body: validDaily({ next: "Sa: Long Run\n10 km" }),
  }), ENV);
  assert.equal(res.status, 400);
});

test("/coach: 400 bei unerlaubtem Zeichen (z. B. < ) in einem freien String-Feld", async () => {
  const res = await worker.fetch(req("/coach", { body: validDaily({ next: "<script>" }) }), ENV);
  assert.equal(res.status, 400);
});

test("/coach: 400 bei zu langem String", async () => {
  const res = await worker.fetch(req("/coach", { body: validDaily({ next: "a".repeat(61) }) }), ENV);
  assert.equal(res.status, 400);
});

test("/coach: 400 bei zu langem Array (weekly easyOverLimit > 7)", async () => {
  const tooMany = Array.from({ length: 8 }, () => ({ day: "Mi", avgHr: 160, limit: 160 }));
  const res = await worker.fetch(req("/coach", { body: validWeekly({ run: { ...validWeekly().run, easyOverLimit: tooMany } }) }), ENV);
  assert.equal(res.status, 400);
});

test("/coach: 400 bei falschem Enum-Wert (status)", async () => {
  const body = validDaily();
  body.checkpoints.wochensoll.status = "blau";
  const res = await worker.fetch(req("/coach", { body }), ENV);
  assert.equal(res.status, 400);
});

test("/coach: 400 bei falscher Kraft-Status-Enum (weekly)", async () => {
  const body = validWeekly();
  body.kraft.progression[0].status = "explodiert";
  const res = await worker.fetch(req("/coach", { body }), ENV);
  assert.equal(res.status, 400);
});

// ---------- Prompt-Aufbau ----------
test("/coach: System-Prompt ist fest und enthält den aus goal zusammengesetzten Zielsatz; Eingabe steht als JSON-Datenblock in der User-Nachricht", async () => {
  mockClaudeText("Alles im grünen Bereich, weiter so.");
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 200);
  const sent = lastUpstreamCall.body;
  assert.match(sent.system, /Halbmarathon mit Zielzeit 1:29:59/);
  assert.match(sent.system, /April/);
  assert.equal(sent.messages.length, 1);
  assert.equal(sent.messages[0].role, "user");
  assert.match(sent.messages[0].content, /```json/);
  assert.ok(sent.messages[0].content.includes('"week":4') || sent.messages[0].content.includes('"week": 4') || JSON.parse(sent.messages[0].content.match(/```json\n([\s\S]*)\n```/)[1]).week === 4);
  assert.equal(sent.model, "claude-haiku-4-5");
  assert.equal(sent.max_tokens, 200);
});

test("/coach: weekly nutzt max_tokens 450 und die Wochenbilanz-Systemrolle", async () => {
  mockClaudeText("Wochenbilanz-Text.");
  const res = await worker.fetch(req("/coach", { body: validWeekly() }), ENV);
  assert.equal(res.status, 200);
  assert.equal(lastUpstreamCall.body.max_tokens, 450);
  assert.match(lastUpstreamCall.body.system, /Wochenbilanz/);
});

// ---------- Fehlende Konfiguration ----------
test("/coach: 500 wenn der Key fehlt", async () => {
  const res = await worker.fetch(req("/coach", { body: validDaily() }), { ...ENV, ANTHROPIC_API_KEY: undefined });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "not_configured");
});

// ---------- Upstream-Fehler ----------
test("/coach: 502 bei Upstream-5xx", async () => {
  mockClaudeStatus(503);
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "upstream_error");
});

test("/coach: 502 bei Upstream-401 (falscher Key), aber ohne das nach außen zu verraten", async () => {
  mockClaudeStatus(401);
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error, "upstream_error");
  assert.ok(!JSON.stringify(data).includes("401") || data.message.includes("401")); // 401 darf in der Zahl stehen, nicht als eigener Fehlercode
});

test("/coach: 502 bei refusal", async () => {
  mockClaude(async () => new Response(JSON.stringify({ content: [], stop_reason: "refusal" }), { status: 200 }));
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 502);
});

test("/coach: 502 bei leerem Text", async () => {
  mockClaude(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "" }], stop_reason: "end_turn" }), { status: 200 }));
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 502);
});

// ---------- max_tokens-Kürzung ----------
test("/coach: bei stop_reason max_tokens wird auf den letzten vollständigen Satz gekürzt", async () => {
  mockClaudeText("Erster Satz ist fertig. Zweiter Satz bricht mittendrin ab, weil das Lim", { stopReason: "max_tokens" });
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  const data = await res.json();
  assert.equal(data.text, "Erster Satz ist fertig.");
});

test("/coach: 200 im Normalfall liefert text/kind/model/promptVersion", async () => {
  mockClaudeText("Guter Rhythmus diese Woche.");
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.text, "Guter Rhythmus diese Woche.");
  assert.equal(data.kind, "daily");
  assert.equal(data.model, "claude-haiku-4-5");
  assert.equal(typeof data.promptVersion, "string");
});

// ---------- Vertragstest (K1, Code-Review M2 Runde 1) ----------
// Der weekly-Body wurde über app.js IMMER mit 400 abgelehnt: adherence4w
// enthielt das Zusatzfeld `pct` (nicht auf der Worker-Whitelist), und ein
// unendliches Belastungsverhältnis wurde als `Infinity`/"∞" verschickt.
// Dieser Test baut den Body aus den ECHTEN Rückgaben von metrics.js
// zusammen (so, wie app.js es nach dem Fix tut) statt mit einem
// handgebauten, bereits korrekten Fixture — er hätte den Bug also wirklich
// gefangen.
test("Vertrag: adherence4w mit dem rohen pct-Feld wird vom Worker abgelehnt (belegt K1)", async () => {
  mockClaudeText("x");
  const body = validWeekly({ adherence4w: { ...adherence4w(11, 12) } }); // enthält pct
  const res = await worker.fetch(req("/coach", { body }), ENV);
  assert.equal(res.status, 400);
});

test("Vertrag: buildWeeklyInput mit echten metrics-Rückgaben (inkl. ∞-Belastung) wird vom Worker angenommen (K1)", async () => {
  mockClaudeText("Wochenbilanz-Text.");

  const adherence = adherence4w(11, 12); // { pct, done, planned } — pct darf NICHT mitgeschickt werden
  const belastungResult = belastung(
    [
      { date: "2026-08-15", distanceKm: 20 }, // erfüllt die 4-Wochen-Historie, liegt aber VOR dem 28-Tage-Fenster
      { date: "2026-09-21", distanceKm: 7 }, // nur in den letzten 7 Tagen -> km28 bleibt 0 -> unendliches Verhältnis
    ],
    "2026-09-24",
    { belastung: { gruen: 1.3, gelb: 1.5, minHistoryDays: 28 } }
  );
  const mk = (kg) => [{ date: "2026-09-01", soll: "3x8-10", topKg: kg, totalReps: 27, sets: [{ reps: 9 }, { reps: 9 }, { reps: 9 }] }];
  const kraftMap = new Map([["Squats", mk(60)], ["Deadlift", mk(70)], ["Bench", mk(50)]]);
  const kraftResults = kraftProgression(kraftMap, {
    kraft: { windowDays: 42, stallSessions: 2, minExercisesWithData: 3, redAffectedCount: 2, redConsecutiveBelow: 2 },
  }).results;

  const input = buildWeeklyInput({
    goal: { distance: "Halbmarathon", targetTime: "1:29:59", raceDate: "2027-04-11", raceDateConfirmed: false },
    week: 4, weekType: "Entlastung", phase: "Basis",
    run: { plannedKm: 24, actualKm: 24.3, sessionsPlanned: 3, sessionsDone: 3, easyOverLimit: [] },
    kraft: {
      sessionsPlanned: 2, sessionsDone: 2,
      progression: kraftResults.map((r) => ({
        exercise: r.name,
        status: r.status === "unterSoll" ? "unterSoll" : r.status === "stagniert" ? "stagniert" : "steigt",
        detail: `${r.reps.split("/").length}× ${r.topKg} kg`,
      })),
    },
    belastung: { ratio: belastungResult.ratio ?? 9.99, status: belastungResult.status },
    aerobeEffizienzTrend: null,
    adherence4w: { done: adherence.done, planned: adherence.planned },
    nextWeek: { n: 5, type: "Aufbau", keySession: "Sa: Long Run 13 km" },
  });

  const res = await worker.fetch(req("/coach", { body: input }), ENV);
  const payload = await res.clone().json().catch(() => null);
  assert.equal(res.status, 200, JSON.stringify(payload));
});

// ---------- /exchange, /refresh unverändert ----------
test("/exchange und /refresh verhalten sich unverändert", async () => {
  mockClaude(async () => new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_at: 1 }), { status: 200 }));
  const ex = await worker.fetch(req("/exchange", { body: { code: "c" } }), ENV);
  assert.equal(ex.status, 200);
  const rf = await worker.fetch(req("/refresh", { body: { refresh_token: "r" } }), ENV);
  assert.equal(rf.status, 200);
  const missing = await worker.fetch(req("/exchange", { body: {} }), ENV);
  assert.equal(missing.status, 400);
});

// ---------- Form der Antwort (coach-v2) ----------
test("/coach daily: höchstens zwei Sätze, Gedankenstriche werden zu Kommas", async () => {
  mockClaudeText("Dein Easy-Pace war zu schnell – 166 statt 163 bpm. Beim nächsten Lauf langsamer starten. Ansonsten passt alles.");
  const res = await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  assert.equal(res.status, 200);
  const { text, promptVersion } = await res.json();
  assert.equal(text, "Dein Easy-Pace war zu schnell, 166 statt 163 bpm. Beim nächsten Lauf langsamer starten.");
  assert.equal(promptVersion, "coach-v3");
});

test("/coach weekly: höchstens sechs Sätze", async () => {
  mockClaudeText("Eins. Zwei. Drei. Vier. Fünf. Sechs. Sieben.");
  const res = await worker.fetch(req("/coach", { body: validWeekly() }), ENV);
  assert.equal((await res.json()).text, "Eins. Zwei. Drei. Vier. Fünf. Sechs.");
});

test("/coach: Systemprompt verbietet Tempo-Empfehlungen für Easy, Long und Recovery", async () => {
  mockClaudeText("Gut gemacht.");
  await worker.fetch(req("/coach", { body: validDaily() }), ENV);
  const system = lastUpstreamCall.body.system;
  assert.match(system, /Easy-, Long- und Recovery-Läufe gehören immer in ihre Zielzone/);
  assert.match(system, /Keine Gedankenstriche/);
  assert.match(system, /höchstens\s+35 Wörter/);
});
