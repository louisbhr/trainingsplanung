// Prüft coach.js ohne Browser/Firestore: Eingabeschema, Hash-Stabilität,
// Cache-Entscheidung (A4), Regel-Fallback-Priorität (F6), und requestCoach()
// mit eingespeisten (gemockten) loadDoc/saveDoc/fetchWorker-Funktionen.

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyInput, hashInput, decideGeneration, fallbackDaily, requestCoach, weeklyDue, fallbackWeekly } from "../coach.js";

const GOAL = { distance: "Halbmarathon", targetTime: "1:29:59", raceDate: "2027-04-11", raceDateConfirmed: false };

function ampeln(overrides = {}) {
  const base = {
    wochensoll: { key: "wochensoll", status: "gruen", detail: "16 / 29 km · Kraft 0/2" },
    easy: { key: "easy", status: "gruen", detail: "Letzte 3 Läufe in der Zone" },
    belastung: { key: "belastung", status: "grau", detail: "noch zu wenig Daten" },
    kraft: { key: "kraft", status: "grau", detail: "noch zu wenig Daten" },
  };
  for (const [key, ov] of Object.entries(overrides)) base[key] = { ...base[key], ...ov };
  return Object.values(base);
}

// ---------- buildDailyInput ----------
test("buildDailyInput: Ziel-Monat aus raceDate abgeleitet, Ampeln aus der Liste gemappt", () => {
  const input = buildDailyInput({
    iso: "2026-09-24", week: 4, weekType: "Entlastung", phase: "Basis", goal: GOAL,
    today: { type: "Kraft", name: "Full Body B", done: false },
    ampeln: ampeln(), next: "Sa: Long Run 10 km", aerobeEffizienzTrend: "-7 s/km seit Woche 1",
  });
  assert.equal(input.kind, "daily");
  assert.equal(input.goal.raceMonth, 4);
  assert.equal(input.goal.distance, "Halbmarathon");
  assert.equal(input.checkpoints.wochensoll.status, "gruen");
  assert.equal(input.checkpoints.kraft.status, "grau");
  assert.equal(input.next, "Sa: Long Run 10 km");
});

// ---------- hashInput ----------
test("hashInput: bleibt bei geänderter Schlüsselreihenfolge stabil", async () => {
  const a = { z: 1, a: { y: 2, x: 3 }, b: [1, 2, 3] };
  const b = { a: { x: 3, y: 2 }, b: [1, 2, 3], z: 1 };
  assert.equal(await hashInput(a), await hashInput(b));
});

test("hashInput: ändert sich, wenn sich ein Wert ändert", async () => {
  const a = { status: "gruen" };
  const b = { status: "gelb" };
  assert.notEqual(await hashInput(a), await hashInput(b));
});

// ---------- decideGeneration (A4) ----------
test("decideGeneration: kein Dokument -> call", () => {
  assert.equal(decideGeneration(null, "h1", 3).action, "call");
});

test("decideGeneration: gleicher Hash -> reuse ohne neuen Aufruf", () => {
  const doc = { inputHash: "h1", text: "Alter Text.", generations: 1 };
  const d = decideGeneration(doc, "h1", 3);
  assert.equal(d.action, "reuse");
  assert.equal(d.text, "Alter Text.");
});

test("decideGeneration: geänderter Hash, Limit noch nicht erreicht -> call", () => {
  const doc = { inputHash: "h1", text: "Alter Text.", generations: 2 };
  assert.equal(decideGeneration(doc, "h2", 3).action, "call");
});

test("decideGeneration: geänderter Hash, Limit erreicht -> limited, letzter Text bleibt", () => {
  const doc = { inputHash: "h1", text: "Letzter KI-Text heute.", generations: 3 };
  const d = decideGeneration(doc, "h2", 3);
  assert.equal(d.action, "limited");
  assert.equal(d.text, "Letzter KI-Text heute.");
});

// ---------- fallbackDaily: Priorität rot > gelb > grün, Gleichstand-Reihenfolge ----------
test("fallbackDaily: alles grün/grau -> neutrale Bestätigung", () => {
  const text = fallbackDaily(ampeln());
  assert.match(text, /weiter so|Rhythmus/i);
});

test("fallbackDaily: eine gelbe Ampel wird konkret angesprochen", () => {
  const list = ampeln({ easy: { status: "gelb", detail: "Mi: Ø 166 bpm, Obergrenze 160" } });
  const text = fallbackDaily(list);
  assert.match(text, /locker|Zone/i);
});

test("fallbackDaily: rot geht vor gelb", () => {
  const list = [
    { key: "wochensoll", status: "gelb", detail: "x" },
    { key: "belastung", status: "rot", detail: "x" },
  ];
  const text = fallbackDaily(list);
  assert.match(text, /Belastung/i);
});

test("fallbackDaily: bei Gleichstand gewinnt Belastung vor Easy vor Wochensoll vor Kraft", () => {
  const list = [
    { key: "kraft", status: "gelb", detail: "x" },
    { key: "wochensoll", status: "gelb", detail: "x" },
    { key: "easy", status: "gelb", detail: "x" },
  ];
  const text = fallbackDaily(list);
  assert.match(text, /locker|Zone/i); // easy gewinnt vor wochensoll/kraft
});

// ---------- requestCoach (A4: Zählung vor dem Aufruf, kein Aufruf ohne lesbares Dokument) ----------
test("requestCoach: Dokument nicht lesbar -> Fallback, kein API-Aufruf", async () => {
  let fetchCalled = false;
  const result = await requestCoach({
    hash: "h1",
    loadDoc: async () => { throw new Error("boom"); },
    saveDoc: async () => {},
    fetchWorker: async () => { fetchCalled = true; return { ok: true, json: async () => ({ text: "x" }) }; },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });
  assert.equal(fetchCalled, false);
  assert.equal(result.source, "fallback");
  assert.equal(result.text, "Fallback-Satz.");
});

test("requestCoach: generations wird vor dem API-Aufruf gezählt und geschrieben", async () => {
  const writes = [];
  let fetchCalledAfterWrite = false;
  await requestCoach({
    hash: "h2",
    loadDoc: async () => ({ inputHash: "h1", generations: 1, text: "alt" }),
    saveDoc: async (data) => { writes.push(data); fetchCalledAfterWrite = writes.length > 0; },
    fetchWorker: async () => {
      assert.equal(writes.length, 1, "generations muss VOR dem Aufruf geschrieben sein");
      assert.equal(writes[0].generations, 2);
      return { ok: true, json: async () => ({ text: "Neuer Text." }) };
    },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback.",
  });
  assert.ok(fetchCalledAfterWrite);
  assert.equal(writes[1].text, "Neuer Text.");
});

test("requestCoach: Limit erreicht -> letzter Text, kein neuer Aufruf", async () => {
  let fetchCalled = false;
  const result = await requestCoach({
    hash: "h2",
    loadDoc: async () => ({ inputHash: "h1", generations: 3, text: "Letzter Text heute." }),
    saveDoc: async () => {},
    fetchWorker: async () => { fetchCalled = true; return { ok: true, json: async () => ({ text: "x" }) }; },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback.",
  });
  assert.equal(fetchCalled, false);
  assert.equal(result.text, "Letzter Text heute.");
});

test("requestCoach: gleicher Hash -> reuse, kein neuer Aufruf", async () => {
  let fetchCalled = false;
  const result = await requestCoach({
    hash: "h1",
    loadDoc: async () => ({ inputHash: "h1", generations: 1, text: "Gecachter Text." }),
    saveDoc: async () => {},
    fetchWorker: async () => { fetchCalled = true; return { ok: true, json: async () => ({ text: "x" }) }; },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback.",
  });
  assert.equal(fetchCalled, false);
  assert.equal(result.text, "Gecachter Text.");
  assert.equal(result.source, "cache");
});

test("requestCoach: Worker abgeschaltet (Fetch wirft) -> Fallback", async () => {
  const result = await requestCoach({
    hash: "h2",
    loadDoc: async () => null,
    saveDoc: async () => {},
    fetchWorker: async () => { throw new Error("network"); },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });
  assert.equal(result.source, "fallback");
  assert.equal(result.text, "Fallback-Satz.");
});

test("requestCoach: Worker antwortet nicht ok -> Fallback", async () => {
  const result = await requestCoach({
    hash: "h2",
    loadDoc: async () => null,
    saveDoc: async () => {},
    fetchWorker: async () => ({ ok: false, json: async () => ({ error: "upstream_error" }) }),
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });
  assert.equal(result.source, "fallback");
});

// ---------- weeklyDue (M2-10) ----------
// Der Wochentag entscheidet nur über ein-/ausgeklappt (F6), nicht über
// weeklyDue selbst — "ab Montag der neuen Woche" heißt: den ganzen
// Rest der Woche fällig, falls Montag übersprungen wurde.
test("weeklyDue: Montag der neuen Woche, mit Strava -> fällig", () => {
  assert.equal(weeklyDue({ weekNo: 5, hasStrava: true }), true);
});
test("weeklyDue: später in der Woche (Montag übersprungen), mit Strava -> weiterhin fällig", () => {
  assert.equal(weeklyDue({ weekNo: 5, hasStrava: true }), true);
});
test("weeklyDue: ohne Strava -> nicht fällig", () => {
  assert.equal(weeklyDue({ weekNo: 5, hasStrava: false }), false);
});
test("weeklyDue: Woche 1 hat keine vorherige Woche zu bilanzieren -> nicht fällig", () => {
  assert.equal(weeklyDue({ weekNo: 1, hasStrava: true }), false);
});

// ---------- fallbackWeekly ----------
test("fallbackWeekly: nennt Laufumfang, Kraft-Trend und den Schwerpunkt der neuen Woche", () => {
  const text = fallbackWeekly({
    run: { plannedKm: 24, actualKm: 24.3, sessionsPlanned: 3, sessionsDone: 3, easyOverLimit: [] },
    kraft: { sessionsPlanned: 2, sessionsDone: 2, progression: [{ exercise: "Squats", status: "stagniert", detail: "3× 60 kg" }] },
    belastung: { ratio: 0.72, status: "gruen" },
    nextWeek: { n: 5, type: "Aufbau", keySession: "Sa: Long Run 13 km" },
  });
  assert.match(text, /24.3 von 24 km/);
  assert.match(text, /Squats/);
  assert.match(text, /Aufbau/);
});

// M2 (Code-Review M2 Runde 1): "grau" ist auch "!== gruen" — ohne die
// explizite Prüfung auf gelb/rot meldete der Fallback fälschlich "Gelb
// (Verhältnis 0)" bei grauer Belastung.
test("fallbackWeekly: bei grauer Belastung keine Belastungszeile (M2 Minor)", () => {
  const text = fallbackWeekly({
    run: { plannedKm: 24, actualKm: 24.3, sessionsPlanned: 3, sessionsDone: 3, easyOverLimit: [] },
    kraft: { sessionsPlanned: 2, sessionsDone: 2, progression: [] },
    belastung: { ratio: 0, status: "grau" },
    nextWeek: { n: 5, type: "Aufbau", keySession: "Sa: Long Run 13 km" },
  });
  assert.ok(!/[Bb]elastung/.test(text), text);
});

test("fallbackWeekly: Verhältnis im Komma-Format bei roter Belastung (M2 Minor)", () => {
  const text = fallbackWeekly({
    run: { plannedKm: 24, actualKm: 24.3, sessionsPlanned: 3, sessionsDone: 3, easyOverLimit: [] },
    kraft: { sessionsPlanned: 2, sessionsDone: 2, progression: [] },
    belastung: { ratio: 1.67, status: "rot" },
    nextWeek: { n: 5, type: "Aufbau", keySession: "Sa: Long Run 13 km" },
  });
  assert.match(text, /Verhältnis 1,67/);
  assert.ok(!text.includes("1.67"), text);
});

test("requestCoach: Dokument nicht schreibbar -> Fallback, kein API-Aufruf (Limit sonst wirkungslos)", async () => {
  let fetchCalled = false;
  const result = await requestCoach({
    hash: "h2",
    loadDoc: async () => null,
    saveDoc: async () => { throw new Error("permission denied"); },
    fetchWorker: async () => { fetchCalled = true; return { ok: true, json: async () => ({ text: "x" }) }; },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });
  assert.equal(fetchCalled, false);
  assert.equal(result.source, "fallback");
});

// ---------- K2 (Code-Review M2 Runde 1): fehlgeschlagener Aufruf vergiftet
// den Cache nicht ----------
// Simuliert zwei echte Ladevorgänge über einen persistenten In-Memory-
// "Firestore"-Zustand (merge:true wie firebase-init.js) statt mit
// handgebauten Einzel-Dokumenten — genau das Szenario, das der Reviewer mit
// dem echten Worker reproduziert hat: nach einem Fehlschlag hing die
// Coach-Karte beim nächsten Laden dauerhaft im Platzhalter.
test("requestCoach: ein fehlgeschlagener Aufruf schreibt weder inputHash noch Text — der nächste Aufruf mit demselben Hash versucht es erneut statt einen leeren Text zu cachen (K2)", async () => {
  let store = null;
  const merge = (patch) => { store = { ...(store || {}), ...patch }; };
  let fetchCalls = 0;
  const makeArgs = (shouldFail) => ({
    hash: "h1",
    loadDoc: async () => store,
    saveDoc: async (data) => merge(data),
    fetchWorker: async () => {
      fetchCalls++;
      if (shouldFail) throw new Error("worker down");
      return { ok: true, json: async () => ({ text: "Echter Text." }) };
    },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });

  const first = await requestCoach(makeArgs(true));
  assert.equal(first.source, "fallback");
  assert.equal(store.generations, 1);
  assert.equal(store.text, undefined, "nach einem Fehlschlag darf kein Text im Dokument stehen");
  assert.equal(store.inputHash, undefined, "nach einem Fehlschlag darf kein inputHash im Dokument stehen");

  const second = await requestCoach(makeArgs(false));
  assert.equal(fetchCalls, 2, "der zweite Aufruf mit demselben Hash muss es erneut versuchen statt zu cachen");
  assert.equal(second.source, "api");
  assert.equal(second.text, "Echter Text.");
  assert.equal(store.text, "Echter Text.");
  assert.equal(store.inputHash, "h1");
});

test("requestCoach: ein vorhandener alter Text bleibt nach einem Fehlschlag erhalten (merge:true), geht nicht verloren (K2)", async () => {
  // Simuliert: gestern erfolgreich generiert (Hash h-alt), heute ändert
  // sich der Input (Hash h-neu) und der Worker ist gerade nicht erreichbar.
  let store = { inputHash: "h-alt", text: "Gestriger Text.", generations: 1, generatedAt: 1, model: "m", promptVersion: "v1" };
  const merge = (patch) => { store = { ...store, ...patch }; };
  const result = await requestCoach({
    hash: "h-neu",
    loadDoc: async () => store,
    saveDoc: async (data) => merge(data),
    fetchWorker: async () => { throw new Error("worker down"); },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });
  assert.equal(result.source, "fallback");
  assert.equal(store.text, "Gestriger Text.", "der alte Text darf durch den Versuchs-Schreibvorgang nicht überschrieben werden");
  assert.equal(store.inputHash, "h-alt", "der alte Hash darf nicht vorzeitig auf den neuen Input zeigen");
});

test("requestCoach: nach 3 Fehlschlägen in Folge kommt der Fallback, kein vierter Aufruf mehr (A4-Limit über echten Zustand)", async () => {
  let store = null;
  const merge = (patch) => { store = { ...(store || {}), ...patch }; };
  let fetchCalls = 0;
  const call = () => requestCoach({
    hash: "h1",
    loadDoc: async () => store,
    saveDoc: async (data) => merge(data),
    fetchWorker: async () => { fetchCalls++; throw new Error("worker down"); },
    limit: 3, model: "m", promptVersion: "v1", fallbackText: "Fallback-Satz.",
  });
  await call();
  await call();
  await call();
  assert.equal(fetchCalls, 3);
  const fourth = await call();
  assert.equal(fetchCalls, 3, "nach dem Limit folgt kein vierter Aufruf");
  assert.equal(fourth.source, "fallback");
  assert.equal(fourth.text, "Fallback-Satz.");
});
