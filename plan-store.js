// Lädt das Plan-Objekt aus plans/hm-2027.json (F0/A1). Einzige Andockstelle
// für Stufe 2 (Firestore, siehe docs/requirements-login.md).
//
// - URL relativ zum Modul (import.meta.url), nicht zur Seite — fetch("./…")
//   würde sonst relativ zur aufrufenden HTML-Seite auflösen.
// - fetch mit cache: "no-cache" erzwingt eine Revalidierung (ETag/304),
//   damit ein vergessener Versionsstempel nicht tagelang eine alte Version
//   ausliefert.
// - Nach erfolgreicher Validierung wandert eine Kopie in localStorage.
//   Scheitert das nächste Laden (Funkloch im Gym), läuft die App mit der
//   Kopie weiter statt das Satz-Logging zu blockieren.
// - Scheitert der Abruf UND es gibt keine (zur schemaVersion passende)
//   Kopie: PlanLoadError mit source "plan" — analog zu FirebaseAccessError,
//   damit der Fehler nicht mit einem Strava- oder Firebase-Problem
//   verwechselt wird.

import { validatePlan } from "./plan.js?v=202610031016";

const PLAN_ID = "hm-2027";
// Von `npm run version` gepflegt (tools/bump-version.mjs) — siehe
// tests/version.test.mjs, das prüft, dass dieser Stempel mit allen anderen
// übereinstimmt.
const PLAN_URL = new URL("./plans/hm-2027.json?v=202610031016", import.meta.url);

export class PlanLoadError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlanLoadError";
    this.source = "plan";
  }
}

function storageKey(id) {
  return `hm-tracker.plan.${id}`;
}

function readCache(id, expectedSchemaVersion) {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const plan = JSON.parse(raw);
    if (plan?.schemaVersion !== expectedSchemaVersion) return null;
    // K1: schemaVersion allein reicht nicht — eine Kopie kann trotz gleicher
    // schemaVersion nicht mehr zur erwarteten Form passen (z. B. ein neues
    // Pflichtfeld ohne Versionssprung). Ohne diese Prüfung würde ein
    // späterer Zugriff auf die Kopie (z. B. plan.totalWeeks) mit einer
    // unbehandelten Rejection durchbrechen, statt sauber auf die
    // Fehlerkarte zu fallen.
    return validatePlan(plan).length === 0 ? plan : null;
  } catch {
    return null; // kaputte Kopie oder localStorage nicht verfügbar (privates Fenster)
  }
}

function writeCache(plan) {
  try {
    localStorage.setItem(storageKey(plan.id), JSON.stringify(plan));
  } catch {
    // localStorage kann in privaten Fenstern werfen — dann eben ohne Kopie.
  }
}

async function fetchPlan() {
  const res = await fetch(PLAN_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const plan = await res.json();
  const problems = validatePlan(plan);
  if (problems.length) throw new Error(problems.join("; "));
  return plan;
}

// Lädt alle bekannten Pläne (heute genau einer, siehe F0a Punkt 4). Wirft
// nur, wenn weder ein frischer Abruf noch eine gültige Kopie da ist.
export async function loadPlans() {
  // schemaVersion der Kopie muss zum aktuellen Format passen (E5) — sonst
  // könnte eine alte Kopie mit inzwischen falscher Form durchrutschen.
  const EXPECTED_SCHEMA_VERSION = 1;
  try {
    const plan = await fetchPlan();
    writeCache(plan);
    return { plans: [plan], hint: null };
  } catch (err) {
    console.error(err);
    const cached = readCache(PLAN_ID, EXPECTED_SCHEMA_VERSION);
    if (cached) return { plans: [cached], hint: "Plan aus letzter Kopie" };
    throw new PlanLoadError("Plan konnte nicht geladen werden: " + err.message);
  }
}
