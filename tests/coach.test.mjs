// Prüft coach.js ohne Browser/Firestore: Eingabeschema, Hash-Stabilität,
// Cache-Entscheidung (A4), Regel-Fallback-Priorität (F6), und requestCoach()
// mit eingespeisten (gemockten) loadDoc/saveDoc/fetchWorker-Funktionen.

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyInput, hashInput, decideGeneration, fallbackDaily, requestCoach } from "../coach.js";

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
