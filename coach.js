// Coach-Logik (F6, M2-9/M2-10): Eingabeschema bauen, Hash, Cache-
// Entscheidung, Regel-Fallback, Worker-Aufruf mit Firestore-Cache. Wie
// metrics.js ohne Firebase-/Browser-Abhängigkeiten — Firestore-Zugriff
// (loadCoach/saveCoach) und der HTTP-Aufruf werden von außen als Funktionen
// hereingereicht (requestCoach), damit sich alles ohne Browser testen lässt
// (tests/coach.test.mjs).
import { worstStatus } from "./metrics.js?v=202609281116";

// ---------- Eingabeschema "daily" (F6) ----------
// goal hier ist das Plan-Objekt-goal ({ distance, raceDate, targetTime,
// raceDateConfirmed }); der Worker erwartet raceMonth als Zahl statt eines
// vollen Datums, damit er kein freies Datum validieren muss.
export function buildDailyInput({ iso, week, weekType, phase, goal, today, ampeln, next, aerobeEffizienzTrend }) {
  const byKey = Object.fromEntries(ampeln.map((a) => [a.key, a]));
  const checkpoint = (key) => ({ status: byKey[key]?.status ?? "grau", detail: byKey[key]?.detail ?? "" });
  return {
    kind: "daily",
    date: iso,
    week,
    weekType,
    phase,
    goal: {
      distance: goal.distance,
      targetTime: goal.targetTime,
      raceMonth: Number(goal.raceDate.slice(5, 7)),
      raceDateConfirmed: goal.raceDateConfirmed,
    },
    today,
    checkpoints: {
      wochensoll: checkpoint("wochensoll"),
      easy: checkpoint("easy"),
      belastung: checkpoint("belastung"),
      kraft: checkpoint("kraft"),
    },
    next,
    aerobeEffizienzTrend: aerobeEffizienzTrend ?? null,
  };
}

// ---------- Eingabeschema "weekly" (F6, M2-10) ----------
export function buildWeeklyInput({ goal, week, weekType, phase, run, kraft, belastung, aerobeEffizienzTrend, adherence4w, nextWeek }) {
  return {
    kind: "weekly",
    goal: {
      distance: goal.distance,
      targetTime: goal.targetTime,
      raceMonth: Number(goal.raceDate.slice(5, 7)),
      raceDateConfirmed: goal.raceDateConfirmed,
    },
    week,
    weekType,
    phase,
    run,
    kraft,
    belastung,
    aerobeEffizienzTrend: aerobeEffizienzTrend ?? null,
    adherence4w,
    nextWeek,
  };
}

// ---------- Hash (kanonisches JSON + SHA-256) ----------
// Schlüsselreihenfolge darf den Hash nicht beeinflussen — sonst würde ein
// Objekt, das clientseitig einmal anders zusammengesetzt wird (z. B. je
// nach Iterationsreihenfolge von Object.entries), fälschlich als "neue
// Eingabe" gelten und unnötig neu generieren.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonicalize(value[k]);
        return acc;
      }, {});
  }
  return value;
}

export async function hashInput(input) {
  const json = JSON.stringify(canonicalize(input));
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Cache-Entscheidung (A4) ----------
// doc: das aktuelle Firestore-Dokument (coach/{datum} bzw.
// coachweek/{planId}_W{n}) oder null. Gibt nie selbst einen API-Aufruf
// aus — das entscheidet requestCoach() anhand von action === "call".
export function decideGeneration(doc, currentHash, limit) {
  if (doc && doc.inputHash === currentHash) return { action: "reuse", text: doc.text };
  if (doc && doc.generations >= limit) return { action: "limited", text: doc.text };
  return { action: "call" };
}

// ---------- Regel-Fallback täglich (F6) ----------
// Priorisiert nach der schlechtesten Ampel (rot vor gelb vor grün), bei
// Gleichstand: Belastung -> Easy-Disziplin -> Wochensoll -> Kraft.
const DAILY_TIE_ORDER = ["belastung", "easy", "wochensoll", "kraft"];

const DAILY_FALLBACK_LINES = {
  wochensoll: {
    gelb: "Dein Wochensoll hinkt gerade hinterher — hol es bei der nächsten Einheit bewusst auf.",
    rot: "Dein Wochensoll liegt deutlich zurück — die nächste geplante Einheit hat jetzt Vorrang.",
  },
  easy: {
    gelb: "Dein letzter lockerer Lauf lag über der Zielzone, beim nächsten bewusst langsamer starten.",
    rot: "Mehrere lockere Läufe lagen zuletzt über der Zone — nimm den nächsten Easy Run bewusst ruhiger.",
  },
  belastung: {
    gelb: "Deine Belastung steigt gerade recht schnell — nimm den nächsten Lauf eine Stufe leichter.",
    rot: "Deine Belastung ist deutlich hochgeschossen — heute lieber kürzer oder langsamer laufen.",
  },
  kraft: {
    gelb: "Eine Kraftübung hängt gerade fest — bei der nächsten Einheit bewusst auf die Ausführung achten.",
    rot: "Mehrere Kraftübungen hängen fest — Gewichte halten und erst die Wiederholungen ausbauen.",
  },
};
const GREEN_LINE = "Guter Rhythmus diese Woche — weiter so.";

export function fallbackDaily(ampeln) {
  const worst = worstStatus(ampeln, DAILY_TIE_ORDER);
  if (!worst || worst.status === "gruen" || worst.status === "grau") return GREEN_LINE;
  return DAILY_FALLBACK_LINES[worst.key][worst.status];
}

// ---------- Regel-Fallback Wochenbilanz (F6, M2-10) ----------
export function fallbackWeekly({ run, kraft, belastung, nextWeek }) {
  const parts = [];
  parts.push(`Laufumfang: ${run.actualKm} von ${run.plannedKm} km, ${run.sessionsDone}/${run.sessionsPlanned} Einheiten erledigt.`);
  const stuck = (kraft.progression || []).filter((p) => p.status === "stagniert" || p.status === "unterSoll");
  parts.push(
    stuck.length
      ? `Bei der Kraft hängt ${stuck[0].exercise} gerade fest.`
      : "Bei der Kraft geht es voran, nichts hängt fest."
  );
  if (belastung.status !== "gruen") {
    parts.push(`Die Belastung steht auf ${belastung.status === "rot" ? "Rot" : "Gelb"} (Verhältnis ${belastung.ratio}).`);
  }
  parts.push(`Nächste Woche: ${nextWeek.type}, Schlüsseleinheit ${nextWeek.keySession}.`);
  return parts.join(" ");
}

// ---------- Worker-Aufruf mit Firestore-Cache (A4) ----------
// loadDoc/saveDoc/fetchWorker werden hereingereicht statt selbst gegen
// Firestore/den Worker zu greifen — hält coach.js browserfrei testbar.
// Reihenfolge ist entscheidend (A4): generations wird VOR dem eigentlichen
// API-Aufruf geschrieben, damit eine Fehlerschleife (Refusal, max_tokens,
// Upstream-5xx) nicht endlos neu zählt, ohne das Limit je zu erreichen.
export async function requestCoach({ hash, loadDoc, saveDoc, fetchWorker, limit, model, promptVersion, fallbackText }) {
  let doc;
  try {
    doc = await loadDoc();
  } catch {
    return { text: fallbackText, source: "fallback" };
  }

  const decision = decideGeneration(doc, hash, limit);
  if (decision.action === "reuse") return { text: decision.text, source: "cache" };
  if (decision.action === "limited") {
    return decision.text ? { text: decision.text, source: "cache" } : { text: fallbackText, source: "fallback" };
  }

  const generations = (doc?.generations ?? 0) + 1;
  try {
    await saveDoc({ inputHash: hash, generations, generatedAt: Date.now(), text: doc?.text ?? null, model, promptVersion });
  } catch {
    return { text: fallbackText, source: "fallback" };
  }

  let text;
  try {
    const res = await fetchWorker();
    if (!res.ok) throw new Error("worker not ok");
    const data = await res.json();
    text = data?.text;
    if (!text) throw new Error("empty text");
  } catch {
    return { text: fallbackText, source: "fallback" };
  }

  try {
    await saveDoc({ inputHash: hash, generations, generatedAt: Date.now(), text, model, promptVersion });
  } catch {
    // Text kam an, aber der Cache-Schreibvorgang schlägt fehl — trotzdem
    // anzeigen (das Dashboard wartet nie auf den Coach, siehe F6).
  }
  return { text, source: "api" };
}
