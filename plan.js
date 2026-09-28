// Reine Trainingsplan-Logik (F0/F0a). Die Plandaten liegen in
// plans/hm-2027.json und werden über plan-store.js geladen; jede Funktion
// hier nimmt den Plan als Parameter entgegen statt eigene Konstanten zu
// halten — Grundlage für weitere Pläne (Schritt 2) und Firestore (1b).

// --- Datums-Helfer (rein lokal, ohne toISOString/UTC-Verschiebung) ---
const pad = (n) => String(n).padStart(2, "0");
export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Zeichen für Zeichen aus app.js übernommen (A2): Log-IDs
// (logs/{datum}_{slug}) hängen an dieser Funktion, sie darf sich beim
// Umzug nicht ändern.
export const slug = (s) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// --- Wochen-Zugriff ---
export function weekStart(plan, w) {
  return addDays(plan.start, (w - 1) * 7);
}
export function weekDates(plan, w) {
  const start = weekStart(plan, w);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function weekOf(plan, n) {
  return plan.weeks.find((w) => w.n === n);
}
// Liefert die Wochennummer für ein Datum innerhalb des Plans, sonst null
// (kein stummes Klemmen auf 1…totalWeeks mehr — F0, [Abweichung vom Ist-Code]).
export function weekNumberFor(plan, iso) {
  const diffDays = Math.round((fromISO(iso) - fromISO(plan.start)) / 86400000);
  const w = Math.floor(diffDays / 7) + 1;
  return w >= 1 && w <= plan.totalWeeks ? w : null;
}
export function phaseOf(plan, weekNo) {
  return plan.phases.find((p) => weekNo >= p.weeks.from && weekNo <= p.weeks.to);
}

// Phasen-Zeitraum als Text — früher eine hartkodierte Konstante je Phase,
// jetzt aus den Wochendaten abgeleitet (z. B. "31.08.–25.10.2026", oder mit
// Jahr auf beiden Seiten, wenn die Phase über den Jahreswechsel läuft).
export function phaseRange(plan, phase) {
  const start = weekStart(plan, phase.weeks.from);
  const end = addDays(weekStart(plan, phase.weeks.to), 6);
  const short = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
  const withYear = (iso) => `${short(iso)}${iso.slice(0, 4)}`;
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${short(start)}–${withYear(end)}`
    : `${withYear(start)}–${withYear(end)}`;
}

export function planEnd(plan) {
  return addDays(weekStart(plan, plan.totalWeeks), 6);
}

// --- Einheiten (F0a Punkt 2: week.sessions[] statt fester Wochentags-Schlüssel) ---
export function sessionsFor(plan, weekNo) {
  return weekOf(plan, weekNo)?.sessions || [];
}
// Liefert die Einheit eines Tages innerhalb des Plans (kind: "kraft" |
// "lauf" | "ruhe" | "placeholder"), oder null, wenn das Datum außerhalb
// des Plans liegt (dafür ist planDayState/activePlanFor zuständig).
export function sessionOn(plan, iso) {
  const w = weekNumberFor(plan, iso);
  if (w == null) return null;
  const week = weekOf(plan, w);
  if (!week || week.placeholder) return { kind: "placeholder", week: w, focus: week?.focus };
  const session = (week.sessions || []).find((s) => s.date === iso);
  return session ? { kind: session.kind, ...session } : { kind: "ruhe" };
}

// --- Plan-Registry (F0a Punkt 4: Liste statt Einzelplan, injizierbar) ---
// Ein Plan gilt von seinem Start bis einschließlich Renntag bzw. letzter
// Planwoche, je nachdem, was später liegt (F0) — das deckt auch die Lücke
// zwischen Planende und (ggf. noch unbestätigtem) Renntag ab (A8/E7).
function raceDateOrPlanEnd(plan) {
  const end = planEnd(plan);
  const race = plan.goal?.raceDate;
  return race && race > end ? race : end;
}
export function activePlanFor(iso, plans) {
  return plans.find((plan) => iso >= plan.start && iso <= raceDateOrPlanEnd(plan)) || null;
}

// "woche": aktiver Plan mit Wochendetails · "bisZumRennen": aktiver Plan,
// Datum liegt hinter der letzten Planwoche, aber bis (inkl.) Renntag ·
// "keinPlan": kein Plan deckt das Datum ab.
export function planDayState(iso, plans) {
  const plan = activePlanFor(iso, plans);
  if (!plan) return "keinPlan";
  return weekNumberFor(plan, iso) == null ? "bisZumRennen" : "woche";
}

// Alle Übungen, die im Plan vorkommen — für die Auswahl im Verlauf.
export function exerciseCatalog(plan) {
  const seen = new Map();
  for (const week of plan.weeks) {
    if (week.placeholder) continue;
    for (const s of week.sessions.filter((x) => x.kind === "kraft")) {
      for (const ex of s.exercises) {
        if (!seen.has(ex.name)) seen.set(ex.name, { name: ex.name, firstWeek: week.n });
      }
    }
  }
  return [...seen.values()];
}

// --- Ziel-Text für den Plan-Tab ---
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
function monthLabel(iso) {
  const day = Number(iso.slice(8, 10));
  const month = MONTHS_DE[Number(iso.slice(5, 7)) - 1];
  const bucket = day <= 10 ? "Anfang" : day <= 20 ? "Mitte" : "Ende";
  return `${bucket} ${month} ${iso.slice(0, 4)}`;
}
function germanDate(iso) {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
// Ersetzt die frühere hartkodierte goal.time/goal.race-Konstante. Solange
// das Renndatum nicht bestätigt ist, zeigt der Text nur den Monat — das ist
// die bewusst in Kauf genommene kleine Textabweichung ggü. dem Ist-Code.
export function formatGoal(goal) {
  return {
    time: `${goal.targetTime} h`,
    race: goal.raceDateConfirmed
      ? `${goal.distance}, ${germanDate(goal.raceDate)}`
      : `${goal.distance}, ca. ${monthLabel(goal.raceDate)}`,
  };
}

// --- Plan-Objekt-Validierung (A1/A8) ---
//
// Prüft ein Plan-Objekt aus plans/hm-2027.json auf die Form, die
// plan-store.js und die Tests erwarten. Gibt eine Liste von Problemen
// zurück (deutsch, für Fehlermeldungen geeignet) — leer heißt gültig.

// Firestore speichert keine Arrays, deren Elemente selbst Arrays sind
// ("Array in Array"). Arrays aus Objekten, die wiederum Arrays enthalten,
// sind erlaubt — nur die direkte Verschachtelung ist verboten.
function hasNestedArray(value) {
  if (Array.isArray(value)) {
    if (value.some((v) => Array.isArray(v))) return true;
    return value.some((v) => hasNestedArray(v));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((v) => hasNestedArray(v));
  }
  return false;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_VERSION_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function validatePlan(plan) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };

  if (!plan || typeof plan !== "object") return ["Plan ist kein Objekt."];

  need(typeof plan.id === "string" && plan.id, "id fehlt oder ist kein String.");
  need(typeof plan.schemaVersion === "number", "schemaVersion fehlt oder ist keine Zahl.");
  need(
    typeof plan.fileVersion === "string" && FILE_VERSION_RE.test(plan.fileVersion),
    "fileVersion fehlt oder passt nicht auf JJJJ-MM-TTTHH:MM."
  );
  need(plan.goal && typeof plan.goal === "object", "goal fehlt oder ist kein Objekt.");
  const startOk = typeof plan.start === "string" && ISO_DATE_RE.test(plan.start);
  need(startOk, "start fehlt oder ist kein ISO-Datum.");
  need(typeof plan.totalWeeks === "number" && plan.totalWeeks > 0, "totalWeeks fehlt oder ist keine Zahl.");
  need(typeof plan.detailedUntilWeek === "number", "detailedUntilWeek fehlt oder ist keine Zahl.");
  need(Array.isArray(plan.recalibrationDates), "recalibrationDates fehlt oder ist kein Array.");
  need(Array.isArray(plan.zones), "zones fehlt oder ist kein Array.");
  need(Array.isArray(plan.phases), "phases fehlt oder ist kein Array.");
  need(Array.isArray(plan.weeks), "weeks fehlt oder ist kein Array.");

  if (hasNestedArray(plan)) {
    problems.push("Plan enthält ein Array in einem Array (nicht Firestore-tauglich).");
  }

  if (startOk && Array.isArray(plan.weeks) && typeof plan.totalWeeks === "number") {
    const byN = new Map(plan.weeks.map((w) => [w.n, w]));
    for (let n = 1; n <= plan.totalWeeks; n++) {
      const week = byN.get(n);
      if (!week) { problems.push(`Woche ${n} fehlt.`); continue; }

      const expectedStart = addDays(plan.start, (n - 1) * 7);
      need(week.start === expectedStart, `Woche ${n}: start ist ${week.start}, erwartet ${expectedStart}.`);

      if (typeof plan.detailedUntilWeek === "number") {
        const expectedPlaceholder = n > plan.detailedUntilWeek;
        need(
          !!week.placeholder === expectedPlaceholder,
          `Woche ${n}: placeholder ist ${!!week.placeholder}, erwartet ${expectedPlaceholder}.`
        );
      }

      if (Array.isArray(week.sessions) && typeof week.start === "string" && ISO_DATE_RE.test(week.start)) {
        const weekEnd = addDays(week.start, 6);
        for (const s of week.sessions) {
          need(
            typeof s.date === "string" && s.date >= week.start && s.date <= weekEnd,
            `Woche ${n}: Einheit am ${s.date} liegt nicht in der Woche (${week.start}–${weekEnd}).`
          );
        }
      }
    }
  }

  if (plan.goal?.raceDateConfirmed === true) {
    const raceDate = plan.goal.raceDate;
    const raceInWeek =
      Array.isArray(plan.weeks) &&
      typeof raceDate === "string" &&
      plan.weeks.some(
        (w) => typeof w.start === "string" && ISO_DATE_RE.test(w.start) && raceDate >= w.start && raceDate <= addDays(w.start, 6)
      );
    need(raceInWeek, "Renndatum ist bestätigt, liegt aber in keiner Planwoche.");
  }

  return problems;
}
