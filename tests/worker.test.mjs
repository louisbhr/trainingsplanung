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

// ---------- Testschlüssel und Token (Login, Schritt 1b) ----------
const PROJECT_ID = "trainingsplanung-2c6c0";
const UID = "gH4Te1JZzaO7DVoTSg9TtK4gw8p1";
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
// Eigene RSA-Schlüssel statt echter Google-Schlüssel: Der Worker holt die
// öffentlichen Schlüssel per fetch (hier gemockt, nach URL geroutet) und
// prüft Tokens, die dieser Test selbst signiert. crypto.subtle gibt es ab
// Node 19 global; ältere Versionen scheitern hier mit klarer Meldung.
assert.ok(globalThis.crypto?.subtle, "crypto.subtle fehlt: Node >= 19 nötig");

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const b64urlJson = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
const RSA = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };

async function makeKey(kid, jwkExtras = {}) {
  const pair = await crypto.subtle.generateKey(RSA, true, ["sign", "verify"]);
  const publicJwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "RS256", use: "sig", ...jwkExtras };
  return { kid, privateKey: pair.privateKey, publicJwk };
}

const KEY = await makeKey("kid-1");
const OTHER_KEY = await makeKey("kid-1"); // gleiche kid, anderer Schlüssel

function claims(nowS, overrides = {}) {
  return {
    aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, sub: UID,
    iat: nowS - 10, auth_time: nowS - 10, exp: nowS + 3600,
    firebase: { sign_in_provider: "password" }, ...overrides,
  };
}

// header/payload dürfen Objekte oder fertige Segmente (String) sein.
async function mint({ key = KEY, nowS = Math.floor(Date.now() / 1000), header, payload, signWith } = {}) {
  const h = header ?? { alg: "RS256", kid: key.kid, typ: "JWT" };
  const p = payload ?? claims(nowS);
  const seg = (v) => (typeof v === "string" ? v : b64urlJson(v));
  const signingInput = `${seg(h)}.${seg(p)}`;
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, (signWith ?? key).privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

let jwkFetches = 0;
let jwkResponder = () => new Response(JSON.stringify({ keys: [KEY.publicJwk] }), { status: 200, headers: { "Cache-Control": "public, max-age=19000, must-revalidate" } });
const setJwks = (keys, { maxAge = 19000, status = 200, headers } = {}) => {
  jwkResponder = () => new Response(JSON.stringify({ keys }), {
    status, headers: headers ?? (maxAge === null ? {} : { "Cache-Control": `public, max-age=${maxAge}` }) });
};
const failJwks = () => { jwkResponder = () => { throw new TypeError("netzwerk"); }; };
const resetJwks = () => { jwkFetches = 0; setJwks([KEY.publicJwk]); };

const DEFAULT_TOKEN = await mint();

const ORIGIN = "https://louisbhr.github.io";
const ENV = {
  FIREBASE_PROJECT_ID: PROJECT_ID,
  ALLOWED_UID: UID,
  ALLOWED_ORIGINS: ORIGIN,
  ANTHROPIC_API_KEY: "sk-ant-test-key",
  STRAVA_CLIENT_ID: "id",
  STRAVA_CLIENT_SECRET: "secret",
};

// auth: undefined = gültiges Token, null = kein Header, String = genau dieser Header-Wert.
function req(path, { method = "POST", origin = ORIGIN, body, rawBody, auth } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin !== null) headers.Origin = origin;
  if (auth === undefined) headers.Authorization = `Bearer ${DEFAULT_TOKEN}`;
  else if (auth !== null) headers.Authorization = auth;
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
    // Googles Schlüssel-Endpunkt wird nach URL geroutet und zählt nicht als Upstream-Aufruf.
    if (String(url) === JWK_URL) { jwkFetches++; return jwkResponder(); }
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

// =====================================================================
// Login: Firebase-ID-Token (Schritt 1b, A2, Auflagen B1 bis B3)
// =====================================================================
// Der Schlüssel-Cache lebt modulweit. Jede Gruppe importiert den Worker
// deshalb frisch (?t=...), damit kein Test vom Cache eines anderen abhängt.
let moduleCounter = 0;
async function freshWorker() {
  return (await import(`../worker.js?t=${++moduleCounter}`)).default;
}

const REAL_NOW = Date.now;
let nowMs = Date.UTC(2026, 9, 20, 12, 0, 0);
const nowS = () => Math.floor(nowMs / 1000);
function installClock() { Date.now = () => nowMs; }
function restoreClock() { Date.now = REAL_NOW; }
const advance = (ms) => { nowMs += ms; };

// Fängt console.log ab, damit "nie Token loggen" und die Ablehnungsgründe prüfbar sind.
function captureLogs() {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  return { lines, stop: () => { console.log = orig; } };
}

// Eine Auth-Szene: frischer Worker, Uhr eingefroren, Schlüssel zurückgesetzt, Upstream-Mock.
async function scene(fn) {
  const worker = await freshWorker();
  resetJwks();
  installClock();
  const logs = captureLogs();
  mockClaudeText("Alles gut.");
  try {
    await fn({ worker, logs });
  } finally {
    logs.stop();
    restoreClock();
  }
}

const authedReq = async (path, tokenOpts = {}, extra = {}) => {
  const token = await mint({ nowS: nowS(), ...tokenOpts });
  return { token, request: req(path, { auth: `Bearer ${token}`, ...extra }) };
};
const coachBody = () => ({ body: validDaily() });

async function assertUnauthorized(res, why) {
  assert.equal(res.status, 401, why);
  assert.deepEqual(await res.json(), { error: "unauthorized", message: "Anmeldung erforderlich" }, why);
  assert.equal(lastUpstreamCall, null, `${why}: der Upstream darf nie erreicht werden`);
}

test("Token: gültiges Token lässt /coach, /exchange und /refresh durch", () => scene(async ({ worker }) => {
  mockClaude(async (url) => String(url).includes("anthropic")
    ? new Response(JSON.stringify({ content: [{ type: "text", text: "ok." }], stop_reason: "end_turn" }), { status: 200 })
    : new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_at: 1 }), { status: 200 }));
  const c = await authedReq("/coach", {}, coachBody());
  assert.equal((await worker.fetch(c.request, ENV)).status, 200);
  const e = await authedReq("/exchange", {}, { body: { code: "c" } });
  assert.equal((await worker.fetch(e.request, ENV)).status, 200);
  const r = await authedReq("/refresh", {}, { body: { refresh_token: "r" } });
  assert.equal((await worker.fetch(r.request, ENV)).status, 200);
}));

for (const path of ["/coach", "/exchange", "/refresh"]) {
  test(`Token: ${path} ohne Authorization-Header -> einheitliche 401`, () => scene(async ({ worker }) => {
    const body = path === "/coach" ? validDaily() : { code: "c", refresh_token: "r" };
    await assertUnauthorized(await worker.fetch(req(path, { auth: null, body }), ENV), path);
  }));
}

test("Token: Prüfung kommt vor dem Lesen des Bodys (kaputtes JSON ohne Token -> 401, nicht 400)", () => scene(async ({ worker }) => {
  await assertUnauthorized(await worker.fetch(req("/coach", { auth: null, rawBody: "{kaputt" }), ENV), "ohne Token");
}));

test("Token: 401-Matrix, jede Ablehnung hat denselben Body und erreicht den Upstream nie", async () => {
  const cases = {
    "kein Bearer": async () => "Basic abc",
    "Bearer ohne Token": async () => "Bearer",
    "Token mit nur zwei Teilen": async () => "Bearer a.b",
    "Token mit vier Teilen": async () => "Bearer a.b.c.d",
    "Token mit Nicht-base64url-Zeichen": async () => "Bearer a!.b.c",
    "Header kein JSON": async () => `Bearer ${b64url(new TextEncoder().encode("kein json"))}.${b64urlJson({})}.${b64url(new Uint8Array([1]))}`,
    "Payload ist ein Array": async () => `Bearer ${b64urlJson({ alg: "RS256", kid: "kid-1" })}.${b64urlJson([1])}.${b64url(new Uint8Array([1]))}`,
    "Token über 4096 Zeichen": async () => `Bearer ${"a".repeat(4097)}`,
    "alg none": async () => `Bearer ${await mint({ header: { alg: "none", kid: "kid-1" } })}`,
    "alg HS256": async () => `Bearer ${await mint({ header: { alg: "HS256", kid: "kid-1" } })}`,
    "alg RS512": async () => `Bearer ${await mint({ header: { alg: "RS512", kid: "kid-1" } })}`,
    "alg klein geschrieben": async () => `Bearer ${await mint({ header: { alg: "rs256", kid: "kid-1" } })}`,
    "kid fehlt": async () => `Bearer ${await mint({ header: { alg: "RS256" } })}`,
    "kid leer": async () => `Bearer ${await mint({ header: { alg: "RS256", kid: "" } })}`,
    "kid unbekannt": async () => `Bearer ${await mint({ header: { alg: "RS256", kid: "gibt-es-nicht" } })}`,
    "falsche Signatur (anderer Schlüssel, gleiche kid)": async () => `Bearer ${await mint({ signWith: OTHER_KEY })}`,
    "Payload nach dem Signieren verändert": async () => {
      const [h, , sig] = (await mint({ nowS: nowS() })).split(".");
      return `Bearer ${h}.${b64urlJson(claims(nowS(), { sub: "jemand-anderes" }))}.${sig}`;
    },
    "exp abgelaufen": async () => `Bearer ${await mint({ payload: claims(nowS(), { exp: nowS() - 31 }) })}`,
    "iat in der Zukunft": async () => `Bearer ${await mint({ payload: claims(nowS(), { iat: nowS() + 61 }) })}`,
    "auth_time in der Zukunft": async () => `Bearer ${await mint({ payload: claims(nowS(), { auth_time: nowS() + 61 }) })}`,
    "exp als String": async () => `Bearer ${await mint({ payload: claims(nowS(), { exp: String(nowS() + 3600) }) })}`,
    "iat als String": async () => `Bearer ${await mint({ payload: claims(nowS(), { iat: "1" }) })}`,
    "auth_time fehlt": async () => { const p = claims(nowS()); delete p.auth_time; return `Bearer ${await mint({ payload: p })}`; },
    "sub fehlt": async () => { const p = claims(nowS()); delete p.sub; return `Bearer ${await mint({ payload: p })}`; },
    "sub leer": async () => `Bearer ${await mint({ payload: claims(nowS(), { sub: "" }) })}`,
    "falsches aud": async () => `Bearer ${await mint({ payload: claims(nowS(), { aud: "anderes-projekt" }) })}`,
    "falsches iss": async () => `Bearer ${await mint({ payload: claims(nowS(), { iss: "https://securetoken.google.com/anderes-projekt" }) })}`,
    "fremde sub": async () => `Bearer ${await mint({ payload: claims(nowS(), { sub: "fremde-uid" }) })}`,
    "anonyme Anmeldung": async () => `Bearer ${await mint({ payload: claims(nowS(), { firebase: { sign_in_provider: "anonymous" } }) })}`,
  };
  for (const [name, build] of Object.entries(cases)) {
    await scene(async ({ worker }) => {
      const auth = await build();
      const res = await worker.fetch(req("/coach", { auth, ...coachBody() }), ENV);
      await assertUnauthorized(res, name);
    });
  }
});

test("Token: 401-Antworten tragen die CORS-Header (der Browser kann den Grund lesen)", () => scene(async ({ worker }) => {
  const res = await worker.fetch(req("/coach", { auth: null, ...coachBody() }), ENV);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
}));

test("Token: Toleranzen an den Grenzen (exp 29 s abgelaufen, iat +59 s sind noch ok)", () => scene(async ({ worker }) => {
  const a = await authedReq("/coach", { payload: claims(nowS(), { exp: nowS() - 29 }) }, coachBody());
  assert.equal((await worker.fetch(a.request, ENV)).status, 200);
  const b = await authedReq("/coach", { payload: claims(nowS(), { iat: nowS() + 59, auth_time: nowS() + 59 }) }, coachBody());
  assert.equal((await worker.fetch(b.request, ENV)).status, 200);
}));

test("Token: Origin und Methode werden vor dem Token geprüft (403/405 bleiben)", () => scene(async ({ worker }) => {
  const bad = await worker.fetch(req("/coach", { origin: "https://evil.example", auth: null, ...coachBody() }), ENV);
  assert.equal(bad.status, 403);
  const get = await worker.fetch(req("/coach", { method: "GET", auth: null }), ENV);
  assert.equal(get.status, 405);
}));

test("Token: unbekannter Pfad bleibt bei 404, ohne Token-Pflicht", () => scene(async ({ worker }) => {
  const res = await worker.fetch(req("/gibt-es-nicht", { auth: null, body: {} }), ENV);
  assert.equal(res.status, 404);
}));

test("CORS: OPTIONS erlaubt den Authorization-Header", () => scene(async ({ worker }) => {
  const res = await worker.fetch(req("/coach", { method: "OPTIONS" }), ENV);
  assert.equal(res.status, 204);
  assert.match(res.headers.get("Access-Control-Allow-Headers"), /Authorization/);
  assert.match(res.headers.get("Access-Control-Allow-Headers"), /Content-Type/);
}));

// ---------- Konfiguration, fail closed ----------
for (const [name, patch] of [
  ["ALLOWED_UID fehlt", { ALLOWED_UID: undefined }],
  ["ALLOWED_UID leer", { ALLOWED_UID: "" }],
  ["ALLOWED_UID nur Leerzeichen", { ALLOWED_UID: "   " }],
  ["FIREBASE_PROJECT_ID fehlt", { FIREBASE_PROJECT_ID: undefined }],
  ["FIREBASE_PROJECT_ID nur Leerzeichen", { FIREBASE_PROJECT_ID: "  " }],
]) {
  for (const path of ["/coach", "/exchange", "/refresh"]) {
    test(`Konfiguration: ${name} -> 500 not_configured auf ${path}`, () => scene(async ({ worker }) => {
      const body = path === "/coach" ? validDaily() : { code: "c", refresh_token: "r" };
      const res = await worker.fetch(req(path, { body }), { ...ENV, ...patch });
      assert.equal(res.status, 500);
      assert.equal((await res.json()).error, "not_configured");
      assert.equal(lastUpstreamCall, null);
    }));
  }
}

test("Konfiguration: leere ALLOWED_UID lässt auch ein Token mit leerer sub nicht durch", () => scene(async ({ worker }) => {
  const a = await authedReq("/coach", { payload: claims(nowS(), { sub: "" }) }, coachBody());
  const res = await worker.fetch(a.request, { ...ENV, ALLOWED_UID: "" });
  assert.equal(res.status, 500);
}));

// ---------- Schlüssel-Cache (B1) ----------
test("JWK-Cache: zwei Requests -> ein Abruf", () => scene(async ({ worker }) => {
  for (let i = 0; i < 2; i++) {
    const a = await authedReq("/coach", {}, coachBody());
    assert.equal((await worker.fetch(a.request, ENV)).status, 200);
  }
  assert.equal(jwkFetches, 1);
}));

test("JWK-Cache: max-age steuert die Dauer, eingegrenzt auf 60 s bis 24 h", () => scene(async ({ worker }) => {
  const hit = async () => (await worker.fetch((await authedReq("/coach", {}, coachBody())).request, ENV)).status;

  setJwks([KEY.publicJwk], { maxAge: 5 }); // zu klein -> 60 s
  assert.equal(await hit(), 200);
  advance(30_000);
  assert.equal(await hit(), 200);
  assert.equal(jwkFetches, 1, "nach 30 s noch aus dem Cache (Untergrenze 60 s)");
  advance(31_000);
  assert.equal(await hit(), 200);
  assert.equal(jwkFetches, 2, "nach 61 s neu geladen");

  setJwks([KEY.publicJwk], { maxAge: 99_999_999 }); // zu groß -> 24 h
  advance(61_000);
  assert.equal(await hit(), 200);
  const afterReload = jwkFetches;
  advance(23 * 3600_000);
  assert.equal(await hit(), 200);
  assert.equal(jwkFetches, afterReload, "nach 23 h noch aus dem Cache (Obergrenze 24 h)");
  advance(2 * 3600_000);
  assert.equal(await hit(), 200);
  assert.equal(jwkFetches, afterReload + 1, "nach 25 h neu geladen");
}));

test("JWK-Cache: fehlt Cache-Control, gilt eine Stunde", () => scene(async ({ worker }) => {
  const hit = async () => (await worker.fetch((await authedReq("/coach", {}, coachBody())).request, ENV)).status;
  setJwks([KEY.publicJwk], { maxAge: null });
  await hit();
  advance(59 * 60_000);
  await hit();
  assert.equal(jwkFetches, 1);
  advance(2 * 60_000);
  await hit();
  assert.equal(jwkFetches, 2);
}));

test("JWK-Rotation: unbekannte kid lädt einmal neu, danach höchstens 1x pro 60 s", () => scene(async ({ worker }) => {
  const hitWith = async (key) => (await worker.fetch((await authedReq("/coach", { key }, coachBody())).request, ENV)).status;
  assert.equal(await hitWith(KEY), 200);
  assert.equal(jwkFetches, 1);

  const rotated = await makeKey("kid-2");
  assert.equal(await hitWith(rotated), 401, "kid-2 ist noch nicht veröffentlicht");
  assert.equal(jwkFetches, 1, "weniger als 60 s seit dem letzten Abruf: kein Neuladen");

  advance(61_000);
  setJwks([KEY.publicJwk, rotated.publicJwk]);
  assert.equal(await hitWith(rotated), 200, "nach Veröffentlichung wird kid-2 akzeptiert");
  assert.equal(jwkFetches, 2);

  const unknown = await makeKey("kid-unbekannt");
  advance(61_000);
  assert.equal(await hitWith(unknown), 401);
  assert.equal(jwkFetches, 3, "unbekannte kid nach 61 s: genau ein Neuladen");
  assert.equal(await hitWith(unknown), 401);
  assert.equal(await hitWith(unknown), 401);
  assert.equal(jwkFetches, 3, "weitere Versuche innerhalb von 60 s laden nicht erneut");
}));

test("JWK-Filter: nur RSA/RS256/sig; EC-Schlüssel, andere alg und use=enc werden ignoriert", () => scene(async ({ worker }) => {
  const hitWith = async (key) => (await worker.fetch((await authedReq("/coach", { key }, coachBody())).request, ENV)).status;
  const ec = { ...KEY.publicJwk, kid: "ec", kty: "EC" };
  const rs512 = await makeKey("rs512", { alg: "RS512" });
  const enc = await makeKey("enc", { use: "enc" });
  const plain = await makeKey("plain", { alg: undefined, use: undefined }); // Felder fehlen: erlaubt
  setJwks([KEY.publicJwk, ec, rs512.publicJwk, enc.publicJwk, plain.publicJwk]);
  assert.equal(await hitWith(KEY), 200);
  assert.equal(await hitWith(rs512), 401);
  assert.equal(await hitWith(enc), 401);
  advance(61_000);
  assert.equal(await hitWith(plain), 200);
}));

// ---------- 503 und stale-if-error (B1) ----------
test("503 auth_unavailable: Schlüssel nicht abrufbar und kein Cache, nicht 401", () => scene(async ({ worker }) => {
  failJwks();
  const a = await authedReq("/coach", {}, coachBody());
  const res = await worker.fetch(a.request, ENV);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "auth_unavailable");
  assert.equal(lastUpstreamCall, null);
}));

test("503 auth_unavailable: auch bei HTTP-Fehler und unbrauchbarer Schlüsselliste", async () => {
  for (const setup of [
    () => setJwks([], { status: 500 }),
    () => setJwks([]),
    () => setJwks([{ kty: "EC", kid: "x" }]),
  ]) {
    await scene(async ({ worker }) => {
      setup();
      const a = await authedReq("/refresh", {}, { body: { refresh_token: "r" } });
      const res = await worker.fetch(a.request, ENV);
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "auth_unavailable");
    });
  }
});

test("stale-if-error: abgelaufener Cache gilt bei Abruffehler bis zu 1 h weiter, danach 503", () => scene(async ({ worker }) => {
  const hit = async () => (await worker.fetch((await authedReq("/coach", {}, coachBody())).request, ENV)).status;
  setJwks([KEY.publicJwk], { maxAge: 60 });
  assert.equal(await hit(), 200);
  failJwks();
  advance(10 * 60_000); // 9 Minuten über dem Ablauf
  assert.equal(await hit(), 200, "abgelaufen, aber Google down: Cache weiter nutzen");
  advance(40 * 60_000); // 49 Minuten über dem Ablauf (0:50 nach Abruf)
  assert.equal(await hit(), 200);
  advance(30 * 60_000); // gut 1 h über dem Ablauf
  assert.equal(await hit(), 503, "älter als 1 h über dem Ablauf: 503");
}));

test("Fehlgeschlagene Abrufe werden nicht öfter als 1x pro 60 s wiederholt", () => scene(async ({ worker }) => {
  failJwks();
  for (let i = 0; i < 5; i++) await worker.fetch((await authedReq("/coach", {}, coachBody())).request, ENV);
  assert.equal(jwkFetches, 1);
  advance(61_000);
  await worker.fetch((await authedReq("/coach", {}, coachBody())).request, ENV);
  assert.equal(jwkFetches, 2);
}));

// ---------- Konfiguration ----------
test("Token-Pflicht ist unabhängig von einer (alten) AUTH_MODE-Variable", () => scene(async ({ worker }) => {
  // Eine noch gesetzte Altvariable darf nichts mehr aufweichen.
  const env = { ...ENV, AUTH_MODE: "report" };
  await assertUnauthorized(await worker.fetch(req("/coach", { auth: null, ...coachBody() }), env), "AUTH_MODE=report ignoriert");
}));

test("fehlende Konfiguration (ALLOWED_UID leer) -> 500 not_configured, geloggt", () => scene(async ({ worker, logs }) => {
  const a = await authedReq("/coach", {}, coachBody());
  const res = await worker.fetch(a.request, { ...ENV, ALLOWED_UID: "" });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "not_configured");
  assert.ok(logs.lines.includes("auth: not_configured"));
}));

test("Logging: das Token (oder Teile davon) landet nie im Log", () => scene(async ({ worker, logs }) => {
  const a = await authedReq("/coach", { payload: claims(nowS(), { exp: nowS() - 600 }) }, coachBody());
  await worker.fetch(a.request, ENV);
  const [h, p, sig] = a.token.split(".");
  const dump = logs.lines.join("\n");
  for (const part of [a.token, h, p, sig]) assert.ok(!dump.includes(part), "Token-Teil im Log");
  assert.ok(!dump.includes(UID), "UID im Log");
}));
