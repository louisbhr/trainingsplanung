// Reine Aggregation für den Verlauf (Stride, Etappe E2): Wochenbalken und
// Trendtext der Kraft-Übungen, Läufe seit Planstart. Kein DOM, kein Zugriff
// auf Firebase; die Aufrufer reichen Logs, Plan und Läufe herein.

import { weekNumberFor } from "./plan.js?v=202610211125";

const round1 = (n) => Math.round(n * 10) / 10;
const de = (n) => String(round1(n)).replace(".", ",");

const bestKg = (log) => {
  const fromSets = Math.max(0, ...(log.sets ?? []).map((s) => (typeof s?.kg === "number" ? s.kg : 0)));
  return fromSets > 0 ? fromSets : (typeof log.topKg === "number" ? log.topKg : 0);
};
const repsOf = (log) =>
  typeof log.totalReps === "number" ? log.totalReps : (log.sets ?? []).reduce((a, s) => a + (s?.reps ?? 0), 0);

/**
 * Wochenbalken einer Übung: bestes Satzgewicht je Planwoche. Hat die Übung nie
 * Gewicht, zählt die Summe der Wiederholungen. Woche = Planwoche des Log-Datums.
 * Wochen ohne Daten entfallen (der Aufrufer zeigt nur, was es gibt).
 * deload: weekType "Entlastung" bzw. deload-Flag der Planwoche.
 * @returns {{week:number, value:number, unit:"kg"|"Wdh", deload:boolean}[]} aufsteigend nach Woche
 */
export function kraftWeeklyBars(logs, exSlug, plan) {
  const own = (logs ?? []).filter((l) => l.exercise === exSlug && l.completed !== false && l.sets?.length);
  const unit = own.some((l) => bestKg(l) > 0) ? "kg" : "Wdh";
  const byWeek = new Map();
  for (const log of own) {
    const week = weekNumberFor(plan, log.date);
    if (week == null) continue;
    const value = unit === "kg" ? bestKg(log) : repsOf(log);
    if (!(value > 0)) continue;
    const prev = byWeek.get(week) ?? 0;
    byWeek.set(week, unit === "kg" ? Math.max(prev, value) : prev + value);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, value]) => {
      const w = plan.weeks.find((x) => x.n === week);
      return { week, value: round1(value), unit, deload: w?.weekType === "Entlastung" || w?.deload === true };
    });
}

/**
 * Trendtext: Differenz zwischen erster und letzter Nicht-Deload-Woche mit
 * Daten, z. B. "+25 kg seit W1" (W = erste Woche mit Daten), "-5 kg seit W2",
 * "+4 Wdh seit W1". null bei weniger als zwei solchen Wochen.
 */
export function kraftTrendText(bars) {
  const usable = (bars ?? []).filter((b) => !b.deload);
  if (usable.length < 2) return null;
  const first = usable[0];
  const last = usable[usable.length - 1];
  const diff = round1(last.value - first.value);
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `${sign}${de(Math.abs(diff))} ${last.unit} seit W${first.week}`;
}

/** Läufe ab Planstart (Datum >= planStart), Reihenfolge bleibt. Die Anzahl ist die Kachel "Läufe seit 31.08.". */
export function runsSince(runs, planStart) {
  return (runs ?? []).filter((r) => typeof r?.date === "string" && r.date >= planStart);
}
