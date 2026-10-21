// Reine Ablauflogik des Kraft-Tags (Stride, Etappe E2).
//
// Satz für Satz statt Formular: Startwerte, Gewicht-wirkt-vorwärts, nächste
// offene Übung, Stepper-Schritte, das Payload fürs Speichern und der
// Satz-Entwurf. Bewusst ohne DOM, ohne localStorage und ohne Firebase
// (Auflage C5): Aufrufer reichen Daten herein, das Lesen und Schreiben des
// Entwurfs übernimmt app.js mit serializeDraft/parseDraft.

import { parseSoll } from "./progression.js?v=202610211034";

export const MAX_SETS = 8; // wie setsCountFromSoll in app.js
export const MAX_VALUE = 1000; // obere Grenze für kg, Wdh und Sekunden im Entwurf
export const DRAFT_PREFIX = "hm-tracker.kraftDraft.";
export const DRAFT_MAX_AGE_DAYS = 7;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const round1 = (n) => Math.round(n * 10) / 10;
// Deutsche Kommazahl: 62.5 -> "62,5", 75 -> "75"
const de = (n) => String(round1(n)).replace(".", ",");
const hasWeight = (kg) => typeof kg === "number" && kg > 0;

// ---------- Art der Übung und Startwerte (F4/F5) ----------

/** Satzzahl aus dem Soll ("3x8-10" -> 3), 1 bis 8, ohne Angabe 3. */
export function setsCount(soll) {
  const m = String(soll ?? "").match(/(\d+)\s*x/i);
  const n = m ? parseInt(m[1], 10) : 3;
  return Math.min(Math.max(n, 1), MAX_SETS);
}

/**
 * "weight" | "reps" | "time" (F5).
 * time: Soll ist zeitbasiert ("3x30-45s"). reps: die letzte Einheit hatte in
 * allen Sätzen kein Gewicht (null ODER 0, der Bestand enthält kg: 0).
 * Alles andere, auch ohne Historie: weight. forceWeight ("+ Gewicht", E3)
 * holt eine Wdh-Übung wieder in den Gewichts-Modus; Zeit bleibt Zeit.
 */
export function exerciseMode(soll, lastEntry, forceWeight = false) {
  if (parseSoll(soll)?.timeBased) return "time";
  if (forceWeight) return "weight";
  const sets = lastEntry?.sets;
  if (Array.isArray(sets) && sets.length > 0 && sets.every((s) => !hasWeight(s?.kg))) return "reps";
  return "weight";
}

function topKgOf(entry) {
  const kgs = (entry?.sets ?? []).map((s) => s?.kg).filter(hasWeight);
  return kgs.length ? Math.max(...kgs) : null;
}

// Startwert eines noch offenen Satzes i (F4)
function openSet(i, mode, spec, lastEntry, chip) {
  const lastSets = (lastEntry?.sets ?? []).filter((s) => s && typeof s.reps === "number" && s.reps > 0);
  const lastReps = lastSets.length ? (lastSets[i] ?? lastSets[lastSets.length - 1]).reps : null;
  const reps = lastReps ?? spec?.repMin ?? 0;
  if (mode !== "weight") return { kg: null, reps, done: false };
  const kg = chip?.level === "up" && hasWeight(chip.nextKg) ? chip.nextKg : (topKgOf(lastEntry) ?? 0);
  return { kg, reps, done: false };
}

/**
 * Sätze für den Stepper-Ablauf (F4).
 * - saved: das heutige Firestore-Dokument (gewinnt immer). Seine n Sätze sind
 *   erledigt, dazu kommen die übrigen Sätze laut Soll als offene.
 * - sonst: alle Sätze offen; Gewicht = Top-Gewicht der letzten Einheit (bei
 *   chip.level "up" das vorgeschlagene), Wdh/Zeit = Werte der letzten Einheit
 *   je Satz, ohne Historie untere Grenze der Spanne, Gewicht ohne Historie 0.
 * Nicht-Gewichts-Modi liefern kg: null. mode ist optional (Standard exerciseMode).
 * @returns {{kg:number|null, reps:number, done:boolean}[]}
 */
export function startSets(soll, saved, lastEntry, chip, mode = exerciseMode(soll, lastEntry)) {
  const spec = parseSoll(soll);
  const count = setsCount(soll);
  const done = (saved?.sets ?? []).map((s) => ({
    kg: mode === "weight" ? (hasWeight(s?.kg) ? s.kg : 0) : null,
    reps: typeof s?.reps === "number" ? s.reps : 0,
    done: true,
  }));
  const open = [];
  for (let i = done.length; i < Math.max(count, done.length); i++) {
    open.push(openSet(i, mode, spec, lastEntry, chip));
  }
  return [...done, ...open];
}

/**
 * "Letztes Mal"-Text: "4×5 · 75 kg", "75 kg × 5/5/4", "3×40 s", "4×6".
 * Zeit erkennt es am Soll im Eintrag (das Log-Dokument trägt `soll`).
 * @returns {string|null} null ohne Sätze
 */
export function lastTimeText(entry) {
  const sets = (entry?.sets ?? []).filter((s) => s && typeof s.reps === "number");
  if (!sets.length) return null;
  const reps = sets.map((s) => s.reps);
  const sameReps = reps.every((r) => r === reps[0]);
  const isTime = !!parseSoll(entry.soll)?.timeBased;
  const kgs = sets.map((s) => (hasWeight(s.kg) ? s.kg : null));

  if (isTime) return sameReps ? `${sets.length}×${reps[0]} s` : `${reps.join("/")} s`;
  if (kgs.every((k) => k === null)) return sameReps ? `${sets.length}×${reps[0]}` : reps.join("/");

  const kgText = kgs.every((k) => k === kgs[0]) ? de(kgs[0]) : kgs.map((k) => de(k ?? 0)).join("/");
  if (sameReps && kgs.every((k) => k === kgs[0])) return `${sets.length}×${reps[0]} · ${kgText} kg`;
  return `${kgText} kg × ${reps.join("/")}`;
}

// ---------- Ablauf ----------

/**
 * Gewicht wirkt vorwärts: Satz i bekommt kg, ebenso jeder spätere Satz, der
 * noch nicht erledigt ist. Frühere und erledigte Sätze bleiben. Mutiert nicht.
 */
export function applyWeightForward(sets, i, kg) {
  return sets.map((s, idx) => (idx === i || (idx > i && !s.done) ? { ...s, kg } : { ...s }));
}

/**
 * Die Übung, mit der der Tag startet: die erste nicht gespeicherte.
 * @param {{slug:string, saved:boolean}[]} exercises in Anzeigereihenfolge
 * @returns {string|null} null, wenn alles gespeichert (oder die Liste leer) ist
 */
export function initialFocus(exercises) {
  return (exercises ?? []).find((e) => !e.saved)?.slug ?? null;
}

/**
 * "Weiter: <nächste offene>": nach current in Reihenfolge, danach von vorn.
 * @param {string[]} order Slugs in Anzeigereihenfolge
 * @param {string} current aktuelle Übung (zählt nicht als offen)
 * @param {Record<string, boolean>} savedMap slug -> gespeichert
 * @returns {string|null} null, wenn keine andere Übung offen ist
 */
export function nextOpenExercise(order, current, savedMap) {
  const list = order ?? [];
  const start = list.indexOf(current);
  for (let step = 1; step <= list.length; step++) {
    const slug = list[(start + step + list.length) % list.length];
    if (slug !== current && !savedMap?.[slug]) return slug;
  }
  return null;
}

const STEPPERS = {
  kg: { step: 2.5, min: 0, max: MAX_VALUE },
  reps: { step: 1, min: 0, max: MAX_VALUE },
  time: { step: 5, min: 0, max: MAX_VALUE },
};

/** Schrittweite und Grenzen je Stepper: "kg" ±2,5, "reps" ±1, "time" ±5 s, ab 0. */
export function setStepper(kind) {
  const cfg = STEPPERS[kind];
  if (!cfg) throw new RangeError(`Unbekannter Stepper: ${kind}`);
  return { ...cfg };
}

/** Wert um einen Schritt ändern (dir +1 / -1), geklemmt auf die Grenzen. */
export function stepValue(kind, value, dir) {
  const { step, min, max } = setStepper(kind);
  const base = Number.isFinite(value) ? value : 0;
  return Math.min(max, Math.max(min, round1(base + (dir < 0 ? -step : step))));
}

// ---------- Speichern (Auflage C1) ----------

/**
 * Sätze für das Firestore-Payload. Nur die ersten doneCount Sätze (Standard:
 * alle übergebenen); Startwerte nicht gemachter Sätze werden nie geschrieben.
 * Ohne Gewicht (Modus reps/time oder kg 0/null) wird kg: null. Zeit steht als
 * Sekunden in reps.
 */
export function toPayloadSets(sets, mode, doneCount = sets.length) {
  return sets.slice(0, Math.max(0, doneCount)).map((s) => ({
    kg: mode === "weight" && hasWeight(s.kg) ? s.kg : null,
    reps: typeof s.reps === "number" ? s.reps : null,
  }));
}

/** Summen wie bisher: topKg = max(kg ?? 0), totalReps = sum(reps ?? 0). */
export function payloadTotals(payloadSets) {
  return {
    topKg: Math.max(0, ...payloadSets.map((s) => s.kg ?? 0)),
    totalReps: payloadSets.reduce((a, s) => a + (s.reps ?? 0), 0),
  };
}

/**
 * Das komplette Dokument-Payload (ohne date/exercise/updatedAt, die ergänzt
 * saveLog). Gleiche Felder wie vor dem Umbau; week entfällt bei null.
 */
export function buildLogPayload({ week, name, soll, custom, sets, mode, doneCount }) {
  const payloadSets = toPayloadSets(sets, mode, doneCount);
  return {
    ...(week != null ? { week } : {}),
    name,
    soll,
    custom: !!custom,
    sets: payloadSets,
    ...payloadTotals(payloadSets),
    completed: true,
  };
}

// ---------- Entwurf (Auflage C2) ----------

/** localStorage-Schlüssel: Datum des Kraft-Tags, nicht das von heute. */
export function draftKey(iso) {
  if (!ISO_RE.test(String(iso))) throw new RangeError(`Kein ISO-Datum: ${iso}`);
  return DRAFT_PREFIX + iso;
}

const dayNumber = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

/**
 * Entwurfs-Schlüssel, die beim App-Start zu löschen sind: Datum mehr als
 * maxAgeDays vor heute oder nicht lesbar. Fremde Schlüssel und Entwürfe für
 * heute oder künftige Tage bleiben. Das Öffnen eines anderen Tags löscht nichts.
 */
export function staleDraftKeys(keys, todayIso, maxAgeDays = DRAFT_MAX_AGE_DAYS) {
  const today = dayNumber(todayIso);
  return (keys ?? []).filter((key) => {
    if (typeof key !== "string" || !key.startsWith(DRAFT_PREFIX)) return false;
    const iso = key.slice(DRAFT_PREFIX.length);
    if (!ISO_RE.test(iso)) return true;
    return today - dayNumber(iso) > maxAgeDays;
  });
}

const isNumOrNull = (v) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_VALUE);

/** Entwurf als JSON-Text. Nimmt nur die bekannten Felder mit. */
export function serializeDraft(draft) {
  const ex = {};
  for (const [slug, e] of Object.entries(draft?.ex ?? {})) {
    ex[slug] = {
      sets: (e.sets ?? []).map((s) => ({ kg: s.kg ?? null, reps: s.reps ?? null })),
      doneSets: e.doneSets ?? 0,
    };
  }
  return JSON.stringify({ v: 1, focus: draft?.focus ?? null, ex });
}

function parseDraftExercise(e) {
  if (!e || typeof e !== "object" || !Array.isArray(e.sets)) throw new Error("sets");
  if (e.sets.length < 1 || e.sets.length > MAX_SETS) throw new Error("Satzzahl");
  const sets = e.sets.map((s) => {
    if (!s || typeof s !== "object" || !isNumOrNull(s.kg) || !isNumOrNull(s.reps)) throw new Error("Satz");
    return { kg: s.kg, reps: s.reps };
  });
  if (!Number.isInteger(e.doneSets) || e.doneSets < 0 || e.doneSets > sets.length) throw new Error("doneSets");
  return { sets, doneSets: e.doneSets };
}

/**
 * Entwurf lesen und streng prüfen. Jeder Formfehler (kaputtes JSON, falsche
 * Version, Zahl außerhalb 0 bis 1000, mehr als 8 Sätze, doneSets zu groß)
 * verwirft den ganzen Entwurf. Übungen, die nicht in validSlugs stehen,
 * werden still ausgelassen. Wirft nie.
 * @param {string|null} raw Inhalt aus localStorage
 * @param {string[]} validSlugs Slugs der aktuellen Übungsliste
 * @returns {{focus:string|null, ex:Record<string,{sets:{kg:number|null,reps:number|null}[], doneSets:number}>}|null}
 */
export function parseDraft(raw, validSlugs) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || data.v !== 1) return null;
    if (typeof data.focus !== "string" && data.focus !== null) return null;
    if (!data.ex || typeof data.ex !== "object" || Array.isArray(data.ex)) return null;
    const ex = {};
    for (const slug of validSlugs ?? []) {
      if (Object.hasOwn(data.ex, slug)) ex[slug] = parseDraftExercise(data.ex[slug]);
    }
    if (!Object.keys(ex).length) return null;
    const focus = typeof data.focus === "string" && Object.hasOwn(ex, data.focus) ? data.focus : null;
    return { focus, ex };
  } catch {
    return null;
  }
}

/** R9: ein gespeichertes Firestore-Dokument gewinnt, sein Entwurfseintrag fällt weg. */
export function dropSavedFromDraft(draft, savedSlugs) {
  if (!draft) return null;
  const saved = new Set(savedSlugs ?? []);
  const ex = Object.fromEntries(Object.entries(draft.ex).filter(([slug]) => !saved.has(slug)));
  if (!Object.keys(ex).length) return null;
  return { focus: draft.focus && Object.hasOwn(ex, draft.focus) ? draft.focus : null, ex };
}
