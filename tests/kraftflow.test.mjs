// Reine Kraft-Tag-Logik (Stride E2): Modus, Startwerte, Payload, Entwurf.
// Das Payload wird gegen die Fixture "Vorher-Payload" (Auflage C1) verglichen.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  exerciseMode, startSets, lastTimeText, applyWeightForward, initialFocus, nextOpenExercise,
  setStepper, stepValue, toPayloadSets, payloadTotals, buildLogPayload, setsCount,
  draftKey, staleDraftKeys, serializeDraft, parseDraft, dropSavedFromDraft,
} from "../kraftflow.js";
import { progressionChip } from "../progression.js";

const entry = (soll, kgs, reps) => ({ date: "2026-09-01", soll, sets: reps.map((r, i) => ({ kg: kgs[i] ?? kgs[0], reps: r })) });

// ---------- exerciseMode (F5) ----------
test("exerciseMode: Soll mit Sekunden ist Zeit, auch mit Historie", () => {
  assert.equal(exerciseMode("3x30-45s", null), "time");
  assert.equal(exerciseMode("3x30-45s", entry("3x30-45s", [20], [40, 40, 40])), "time");
});
test("exerciseMode: ohne Historie Gewicht", () => {
  assert.equal(exerciseMode("3x8-10", null), "weight");
  assert.equal(exerciseMode("3x8-10", { sets: [] }), "weight");
});
test("exerciseMode: letzte Einheit ohne Gewicht (null) ist reps", () => {
  assert.equal(exerciseMode("3x6-8", entry("3x6-8", [null], [6, 6, 6])), "reps");
});
test("exerciseMode: Altbestand kg 0 zählt wie null", () => {
  assert.equal(exerciseMode("3x6-8", entry("3x6-8", [0], [6, 6, 6])), "reps");
});
test("exerciseMode: ein einziger Satz mit Gewicht reicht für weight", () => {
  const e = { sets: [{ kg: null, reps: 6 }, { kg: 5, reps: 6 }] };
  assert.equal(exerciseMode("3x6-8", e), "weight");
});
test("exerciseMode: forceWeight (+ Gewicht) holt reps zurück, Zeit bleibt Zeit", () => {
  const e = entry("3x6-8", [null], [6, 6, 6]);
  assert.equal(exerciseMode("3x6-8", e, true), "weight");
  assert.equal(exerciseMode("3x30-45s", e, true), "time");
});

// ---------- startSets (F4) ----------
test("startSets: ohne Historie Gewicht 0 und untere Grenze der Spanne", () => {
  const s = startSets("3x8-10", null, null, null);
  assert.deepEqual(s, Array(3).fill({ kg: 0, reps: 8, done: false }));
});
test("startSets: Gewicht = Top-Gewicht der letzten Einheit, Wdh je Satz", () => {
  const last = { sets: [{ kg: 80, reps: 9 }, { kg: 80, reps: 8 }, { kg: 85, reps: 7 }] };
  const s = startSets("3x8-10", null, last, progressionChip("3x8-10", last));
  assert.deepEqual(s.map((x) => [x.kg, x.reps]), [[85, 9], [85, 8], [85, 7]]);
});
test("startSets: Progression 'up' nimmt das vorgeschlagene Gewicht", () => {
  const last = entry("3x8-10", [80], [10, 10, 10]);
  const chip = progressionChip("3x8-10", last);
  assert.equal(chip.level, "up");
  const s = startSets("3x8-10", null, last, chip);
  assert.ok(s.every((x) => x.kg === 85 && x.reps === 10 && x.done === false));
});
test("startSets: 'hold' und 'down' ändern den Startwert nicht", () => {
  const last = entry("3x8-10", [80], [8, 8, 8]);
  assert.ok(startSets("3x8-10", null, last, { level: "hold", nextKg: 80 }).every((x) => x.kg === 80));
  assert.ok(startSets("3x8-10", null, last, { level: "down", nextKg: 77.5 }).every((x) => x.kg === 80));
});
test("startSets: weniger Sätze in der Historie, der letzte Wert trägt weiter", () => {
  const last = { sets: [{ kg: 50, reps: 10 }, { kg: 50, reps: 9 }] };
  assert.deepEqual(startSets("4x8-10", null, last, null).map((x) => x.reps), [10, 9, 9, 9]);
});
test("startSets: Körpergewicht liefert kg null und Wdh", () => {
  const last = entry("3x6-8", [null], [7, 7, 6]);
  assert.deepEqual(startSets("3x6-8", null, last, null).map((x) => [x.kg, x.reps]), [[null, 7], [null, 7], [null, 6]]);
});
test("startSets: Zeit nimmt Sekunden der letzten Einheit, ohne Historie die untere Grenze", () => {
  assert.deepEqual(startSets("3x30-45s", null, null, null).map((x) => [x.kg, x.reps]), Array(3).fill([null, 30]));
  const last = entry("3x30-45s", [null], [40, 38, 35]);
  assert.deepEqual(startSets("3x30-45s", null, last, null).map((x) => x.reps), [40, 38, 35]);
});
test("startSets: gespeichertes Dokument gewinnt und ergänzt offene Sätze (weniger Sätze gespeichert)", () => {
  const saved = { sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }], completed: true };
  const last = entry("3x8-10", [50], [10, 10, 10]);
  const s = startSets("3x8-10", saved, last, null);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => x.done), [true, true, false]);
  assert.deepEqual(s.slice(0, 2).map((x) => [x.kg, x.reps]), [[60, 8], [60, 8]]);
  assert.deepEqual([s[2].kg, s[2].reps], [50, 10]);
});
test("startSets: gespeichertes Dokument mit kg null im Gewichts-Modus wird 0, Satzzahl über Soll bleibt", () => {
  const saved = { sets: Array(4).fill({ kg: null, reps: 5 }) };
  const s = startSets("3x5", saved, null, null, "weight");
  assert.equal(s.length, 4);
  assert.ok(s.every((x) => x.kg === 0 && x.done));
});
test("startSets: Satzzahl hat Grenzen (1 bis 8, Standard 3)", () => {
  assert.equal(setsCount("12x5"), 8);
  assert.equal(setsCount("0x5"), 1);
  assert.equal(setsCount("Körpergewicht"), 3);
  assert.equal(setsCount(undefined), 3);
});

// ---------- lastTimeText ----------
test("lastTimeText: gleiche Sätze mit Gewicht", () => {
  assert.equal(lastTimeText(entry("3x5", [75], [5, 5, 5, 5])), "4×5 · 75 kg");
});
test("lastTimeText: unterschiedliche Wdh, deutsche Kommazahl", () => {
  assert.equal(lastTimeText(entry("3x5", [75], [5, 5, 4])), "75 kg × 5/5/4");
  assert.equal(lastTimeText(entry("3x15", [12.5], [15, 15, 15])), "3×15 · 12,5 kg");
});
test("lastTimeText: verschiedene Gewichte je Satz", () => {
  const e = { soll: "3x5", sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }, { kg: 82.5, reps: 4 }] };
  assert.equal(lastTimeText(e), "80/80/82,5 kg × 5/5/4");
});
test("lastTimeText: Zeit und Körpergewicht", () => {
  assert.equal(lastTimeText(entry("3x30-45s", [null], [40, 40, 40])), "3×40 s");
  assert.equal(lastTimeText(entry("3x30-45s", [null], [40, 40, 35])), "40/40/35 s");
  assert.equal(lastTimeText(entry("4x6", [null], [6, 6, 6, 6])), "4×6");
  assert.equal(lastTimeText(entry("4x6", [0], [6, 6, 5])), "6/6/5");
});
test("lastTimeText: ohne Einträge null", () => {
  assert.equal(lastTimeText(null), null);
  assert.equal(lastTimeText({ sets: [] }), null);
});

// ---------- applyWeightForward ----------
test("applyWeightForward: Satz i und alle späteren offenen Sätze, frühere und erledigte bleiben", () => {
  const sets = [
    { kg: 50, reps: 8, done: true },
    { kg: 50, reps: 8, done: false },
    { kg: 50, reps: 8, done: false },
    { kg: 50, reps: 8, done: true },
  ];
  const out = applyWeightForward(sets, 1, 55);
  assert.deepEqual(out.map((s) => s.kg), [50, 55, 55, 50]);
  assert.deepEqual(sets.map((s) => s.kg), [50, 50, 50, 50], "Eingabe bleibt unverändert");
  assert.deepEqual(out.map((s) => s.reps), [8, 8, 8, 8], "Wdh nur für den Satz selbst, nie vorwärts");
});

// ---------- initialFocus / nextOpenExercise ----------
test("initialFocus: erste nicht gespeicherte, null wenn alles fertig oder leer", () => {
  assert.equal(initialFocus([{ slug: "a", saved: true }, { slug: "b", saved: false }, { slug: "c", saved: false }]), "b");
  assert.equal(initialFocus([{ slug: "a", saved: true }]), null);
  assert.equal(initialFocus([]), null);
});
test("nextOpenExercise: nach der aktuellen, danach von vorn", () => {
  const order = ["a", "b", "c", "d"];
  assert.equal(nextOpenExercise(order, "b", { a: false, c: true, d: false }), "d");
  assert.equal(nextOpenExercise(order, "d", { a: false, b: true, c: true }), "a");
});
test("nextOpenExercise: nichts offen oder nur die aktuelle offen ergibt null", () => {
  assert.equal(nextOpenExercise(["a", "b"], "a", { b: true }), null);
  assert.equal(nextOpenExercise(["a", "b"], "a", { a: true, b: true }), null);
  assert.equal(nextOpenExercise([], "a", {}), null);
});
test("nextOpenExercise: unbekannte aktuelle Übung startet vorn", () => {
  assert.equal(nextOpenExercise(["a", "b"], "zzz", {}), "a");
});

// ---------- Stepper ----------
test("setStepper: Schritte ±2,5 kg / ±1 Wdh / ±5 s, Untergrenze 0", () => {
  assert.deepEqual([setStepper("kg").step, setStepper("reps").step, setStepper("time").step], [2.5, 1, 5]);
  assert.ok(["kg", "reps", "time"].every((k) => setStepper(k).min === 0));
  assert.throws(() => setStepper("zzz"), RangeError);
});
test("stepValue: addiert, klemmt bei 0 und ohne Gleitkomma-Reste", () => {
  assert.equal(stepValue("kg", 16, 1), 18.5);
  assert.equal(stepValue("kg", 1, -1), 0);
  assert.equal(stepValue("reps", 0, -1), 0);
  assert.equal(stepValue("time", 40, 1), 45);
  assert.equal(stepValue("kg", 0.1 + 0.2, 1), 2.8);
  assert.equal(stepValue("kg", 999, 1), 1000);
  assert.equal(stepValue("reps", NaN, 1), 1);
});

// ---------- Payload (C1) ----------
const fixture = JSON.parse(readFileSync(new URL("./fixtures/kraft-payload-before.json", import.meta.url), "utf8"));

test("Vorher-Payload: Fixture deckt gewichtet, Körpergewicht, Zeit und eigene Übung ab", () => {
  const modes = new Set(fixture.cases.map((c) => c.mode));
  assert.deepEqual([...modes].sort(), ["reps", "time", "weight"]);
  assert.ok(fixture.cases.some((c) => c.before.custom === true));
  assert.ok(fixture.cases.every((c) => /^logs\/\d{4}-\d{2}-\d{2}_[a-z0-9-]+$/.test(c.docId)));
});
for (const c of fixture.cases) {
  test(`Vorher-Payload: buildLogPayload reproduziert "${c.label}" (${c.docId})`, () => {
    const got = buildLogPayload({ ...c.input });
    assert.deepEqual(got, c.after ?? c.before);
    assert.deepEqual(Object.keys(got), Object.keys(c.before), "gleiche Feldnamen in gleicher Reihenfolge");
  });
}
test("Vorher-Payload: ohne Altbestand-Fall ist toPayloadSets Feld für Feld identisch zu heute", () => {
  for (const c of fixture.cases.filter((x) => !x.after)) {
    assert.deepEqual(toPayloadSets(c.input.sets, c.mode), c.before.sets, c.label);
    assert.deepEqual(payloadTotals(c.before.sets), { topKg: c.before.topKg, totalReps: c.before.totalReps }, c.label);
  }
});
test("toPayloadSets: kg 0 wird wie null zu kg null (Altbestand-Eingabe), topKg bleibt 0", () => {
  const sets = toPayloadSets([{ kg: 0, reps: 10 }, { kg: 0, reps: 10 }], "weight");
  assert.deepEqual(sets, [{ kg: null, reps: 10 }, { kg: null, reps: 10 }]);
  assert.equal(payloadTotals(sets).topKg, 0);
});
test("toPayloadSets: ohne Gewichts-Modus nie ein kg, auch wenn der Satz einen Wert trägt", () => {
  assert.deepEqual(toPayloadSets([{ kg: 20, reps: 6 }], "reps"), [{ kg: null, reps: 6 }]);
  assert.deepEqual(toPayloadSets([{ kg: 20, reps: 40 }], "time"), [{ kg: null, reps: 40 }]);
});
test("toPayloadSets: vorzeitig abschließen schreibt nur die fertigen Sätze, nie Startwerte", () => {
  const sets = [
    { kg: 60, reps: 8, done: true },
    { kg: 60, reps: 7, done: true },
    { kg: 60, reps: 8, done: false }, // vorbelegter Startwert
  ];
  const out = toPayloadSets(sets, "weight", 2);
  assert.equal(out.length, 2);
  assert.deepEqual(out, [{ kg: 60, reps: 8 }, { kg: 60, reps: 7 }]);
  const doc = buildLogPayload({ week: 3, name: "X", soll: "3x8", custom: false, sets, mode: "weight", doneCount: 2 });
  assert.equal(doc.totalReps, 15, "totalReps ohne den Startwert des offenen Satzes");
  assert.equal(doc.sets.length, 2);
  assert.deepEqual(toPayloadSets(sets, "weight", 0), []);
});
test("buildLogPayload: week null entfällt, Komma-Gewicht bleibt Zahl", () => {
  const doc = buildLogPayload({ week: null, name: "X", soll: "3x8", custom: undefined, sets: [{ kg: 62.5, reps: 8 }], mode: "weight" });
  assert.equal("week" in doc, false);
  assert.equal(doc.custom, false);
  assert.equal(doc.topKg, 62.5);
  assert.equal(doc.completed, true);
});

// ---------- Entwurf (C2) ----------
test("draftKey: Datum des Kraft-Tags im Schlüssel, ungültige Daten werfen", () => {
  assert.equal(draftKey("2026-09-08"), "hm-tracker.kraftDraft.2026-09-08");
  assert.throws(() => draftKey("8.9.2026"), RangeError);
  assert.throws(() => draftKey(undefined), RangeError);
});
test("staleDraftKeys: älter als 7 Tage fällt weg, Grenze, heute, künftig und fremde Schlüssel bleiben", () => {
  const today = "2026-09-15";
  const keys = [
    "hm-tracker.kraftDraft.2026-09-07", // 8 Tage: weg
    "hm-tracker.kraftDraft.2026-09-08", // genau 7 Tage: bleibt
    "hm-tracker.kraftDraft.2026-09-15", // heute
    "hm-tracker.kraftDraft.2026-09-20", // künftig
    "hm-tracker.kraftDraft.kaputt",     // unlesbar: weg
    "hm-tracker.workerUrl",
    "test.logs",
  ];
  assert.deepEqual(staleDraftKeys(keys, today), ["hm-tracker.kraftDraft.2026-09-07", "hm-tracker.kraftDraft.kaputt"]);
});
test("staleDraftKeys: über Monats- und Zeitumstellungsgrenze korrekt", () => {
  assert.deepEqual(staleDraftKeys(["hm-tracker.kraftDraft.2026-10-24"], "2026-11-01"), ["hm-tracker.kraftDraft.2026-10-24"]);
  assert.deepEqual(staleDraftKeys(["hm-tracker.kraftDraft.2026-10-25"], "2026-11-01"), []);
});
test("staleDraftKeys: Öffnen eines anderen Tags löscht nichts (Entwurf für heute überlebt Nachtragen)", () => {
  // Der Entwurf für heute steht neben dem eines vergangenen Tags, der nachgetragen wird.
  assert.deepEqual(staleDraftKeys(["hm-tracker.kraftDraft.2026-09-15", "hm-tracker.kraftDraft.2026-09-10"], "2026-09-15"), []);
});

const SLUGS = ["squats", "deadlift", "planks"];
const goodDraft = {
  focus: "deadlift",
  ex: {
    squats: { sets: [{ kg: 60, reps: 8 }, { kg: 62.5, reps: 8 }, { kg: null, reps: 0 }], doneSets: 2 },
    deadlift: { sets: [{ kg: 80, reps: 5 }], doneSets: 0 },
  },
};
test("Entwurf: serializeDraft und parseDraft sind rundum verlustfrei", () => {
  assert.deepEqual(parseDraft(serializeDraft(goodDraft), SLUGS), goodDraft);
});
test("Entwurf: weightAdded überlebt den Rundlauf, nur als echtes true", () => {
  const d = { focus: null, ex: { squats: { sets: [{ kg: 0, reps: 8 }], doneSets: 0, weightAdded: true } } };
  assert.deepEqual(parseDraft(serializeDraft(d), SLUGS), d);
  const off = { focus: null, ex: { squats: { sets: [{ kg: 0, reps: 8 }], doneSets: 0, weightAdded: false } } };
  assert.equal(parseDraft(serializeDraft(off), SLUGS).ex.squats.weightAdded, undefined);
});
test("Entwurf: Slugs außerhalb der aktuellen Liste werden ausgelassen, Fokus darauf wird null", () => {
  const draft = { focus: "alt", ex: { ...goodDraft.ex, alt: { sets: [{ kg: 1, reps: 1 }], doneSets: 0 } } };
  const got = parseDraft(serializeDraft(draft), SLUGS);
  assert.deepEqual(Object.keys(got.ex), ["squats", "deadlift"]);
  assert.equal(got.focus, null);
});
test("Entwurf: kein Treffer in der Liste ergibt null", () => {
  assert.equal(parseDraft(serializeDraft(goodDraft), ["etwas-anderes"]), null);
});
const broken = (mutate) => {
  const d = JSON.parse(serializeDraft(goodDraft));
  mutate(d);
  return JSON.stringify(d);
};
test("Entwurf: kaputte Form verwirft den ganzen Entwurf", () => {
  const cases = {
    "kein JSON": "{nope",
    "null": "null",
    "leerer Text": "",
    "nicht übergeben": undefined,
    "Zahl statt Objekt": "5",
    "falsche Version": broken((d) => { d.v = 2; }),
    "Version fehlt": broken((d) => { delete d.v; }),
    "Fokus keine Zeichenkette": broken((d) => { d.focus = 7; }),
    "Fokus fehlt": broken((d) => { delete d.focus; }),
    "ex ist Array": broken((d) => { d.ex = []; }),
    "ex fehlt": broken((d) => { delete d.ex; }),
    "sets kein Array": broken((d) => { d.ex.squats.sets = "x"; }),
    "sets leer": broken((d) => { d.ex.squats.sets = []; }),
    "mehr als 8 Sätze": broken((d) => { d.ex.squats.sets = Array(9).fill({ kg: 1, reps: 1 }); }),
    "kg negativ": broken((d) => { d.ex.squats.sets[0].kg = -1; }),
    "kg über 1000": broken((d) => { d.ex.squats.sets[0].kg = 1001; }),
    "reps als Text": broken((d) => { d.ex.squats.sets[0].reps = "8"; }),
    "reps als Bool": broken((d) => { d.ex.squats.sets[0].reps = true; }),
    "reps fehlt": broken((d) => { delete d.ex.squats.sets[0].reps; }),
    "doneSets größer als Sätze": broken((d) => { d.ex.squats.doneSets = 4; }),
    "doneSets negativ": broken((d) => { d.ex.squats.doneSets = -1; }),
    "doneSets Kommazahl": broken((d) => { d.ex.squats.doneSets = 1.5; }),
    "Übung ist Zahl": broken((d) => { d.ex.squats = 3; }),
  };
  for (const [what, raw] of Object.entries(cases)) assert.equal(parseDraft(raw, SLUGS), null, what);
});
test("Entwurf: Randwerte 0 und 1000 sind erlaubt, 8 Sätze auch", () => {
  const d = { focus: null, ex: { squats: { sets: Array(8).fill({ kg: 1000, reps: 0 }), doneSets: 8 } } };
  assert.deepEqual(parseDraft(serializeDraft(d), SLUGS), d);
});
test("Entwurf: __proto__ und fremde Felder gelangen nicht ins Ergebnis", () => {
  const raw = '{"v":1,"focus":null,"extra":1,"ex":{"__proto__":{"sets":[{"kg":1,"reps":1}],"doneSets":0},"squats":{"sets":[{"kg":1,"reps":1,"x":9}],"doneSets":0,"y":1}}}';
  const got = parseDraft(raw, SLUGS);
  assert.deepEqual(got, { focus: null, ex: { squats: { sets: [{ kg: 1, reps: 1 }], doneSets: 0 } } });
  assert.equal({}.sets, undefined);
});
test("dropSavedFromDraft: gespeicherte Übung fällt aus dem Entwurf (R9), Fokus wird bereinigt", () => {
  const out = dropSavedFromDraft(goodDraft, ["deadlift"]);
  assert.deepEqual(Object.keys(out.ex), ["squats"]);
  assert.equal(out.focus, null);
  assert.equal(dropSavedFromDraft(goodDraft, ["squats", "deadlift"]), null);
  assert.equal(dropSavedFromDraft(null, []), null);
  assert.equal(Object.keys(goodDraft.ex).length, 2, "Eingabe bleibt unverändert");
});
