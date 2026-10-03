// Reine Ampel-/Kennzahlenlogik für das Dashboard (M2-3, F5/F8). Wie plan.js
// ohne Firebase-/Browser-Abhängigkeiten, damit alles ohne Browser testbar
// ist (tests/metrics.test.mjs). Jede Funktion nimmt bereits aufbereitete
// Daten entgegen (Läufe, Log-Einträge, THRESHOLDS als Parameter) — das
// Zusammentragen dieser Daten (Firestore, Strava, assignRuns) passt in
// app.js/view-dashboard.js.
//
// Alle Zeitfenster laufen über plan.js' addDays (lokale Datumsarithmetik),
// nie über Millisekunden-Differenzen — sonst rechnen die 7/28/42-Tage-
// Fenster an den beiden Zeitumstellungen im Plan (25.10.2026, 28.03.2027)
// falsch (A7).
import { addDays } from "./plan.js?v=202610031016";
import { parseSoll } from "./progression.js?v=202610031016";

const rank = { grau: 0, gruen: 1, gelb: 2, rot: 3 };
const worseOf = (a, b) => (rank[b] > rank[a] ? b : a);
const round1 = (n) => Math.round(n * 10) / 10;
// Kilometer mit deutschem Dezimalkomma, eine Nachkommastelle wenn nötig.
export const formatKm = (n) => String(round1(n)).replace(".", ",");
// Immer mit einer Nachkommastelle (8,0 km), für Messwerte aus Strava.
export const formatKm1 = (n) => n.toFixed(1).replace(".", ",");

// ---------- Ampel 1: Wochensoll ----------
// sessions: sessionsFor(plan, weekNo) der betrachteten Woche.
// actualKmByDate: { [planDate]: km } — nur für Tage mit zugeordnetem Lauf.
// kraftDoneByDate: { [planDate]: bool } — true, wenn alle Übungen des
// effektiven Tages geloggt sind (Aufrufer berücksichtigt dayplans).
export function wochensoll(sessions, actualKmByDate, kraftDoneByDate, todayISO, THRESHOLDS) {
  const laufSessions = sessions.filter((s) => s.kind === "lauf");
  const kraftSessions = sessions.filter((s) => s.kind === "kraft");

  const sollKmTotal = laufSessions.reduce((a, s) => a + (s.km || 0), 0);
  const istKmTotal = laufSessions.reduce((a, s) => a + (actualKmByDate[s.date] || 0), 0);

  // Status nach dem Anteil bis heute, Anzeige aber über die gesamte Woche
  // (F5: "Wochensoll gesamt, nicht anteilig").
  // Der Lauf von heute zählt erst, wenn er gelaufen ist; sonst wäre jeder
  // Morgen eines Lauftags rot, obwohl noch nichts versäumt ist.
  const laufBisHeute = laufSessions.filter(
    (s) => s.date < todayISO || (s.date === todayISO && actualKmByDate[s.date] > 0));
  const sollBisHeute = laufBisHeute.reduce((a, s) => a + (s.km || 0), 0);
  const istBisHeute = laufBisHeute.reduce((a, s) => a + (actualKmByDate[s.date] || 0), 0);
  const laufPct = sollBisHeute > 0 ? istBisHeute / sollBisHeute : 1;
  const laufStatus =
    laufPct >= THRESHOLDS.wochensoll.gruen ? "gruen" : laufPct >= THRESHOLDS.wochensoll.gelb ? "gelb" : "rot";

  const kraftPlanned = kraftSessions.length;
  const kraftDone = kraftSessions.filter((s) => kraftDoneByDate[s.date]).length;
  // Die heutige, noch offene Einheit zählt nicht als verpasst.
  const kraftMissedPast = kraftSessions.some((s) => s.date < todayISO && !kraftDoneByDate[s.date]);
  const kraftStatus = kraftMissedPast ? "gelb" : "gruen";

  return {
    status: worseOf(laufStatus, kraftStatus),
    sollKm: sollKmTotal,
    istKm: istKmTotal,
    kraftDone,
    kraftPlanned,
    detail: `${formatKm(istKmTotal)} / ${formatKm(sollKmTotal)} km · Kraft ${kraftDone}/${kraftPlanned}`,
  };
}

// ---------- Ampel 2: Easy-Disziplin ----------
// runs: die letzten (max. 3) über assignRuns zugeordneten Easy/Long/Recovery-
// Läufe, je { avgHr, hfMax, dayLabel } (dayLabel = "Mi" o.ä., vom Aufrufer
// formatiert, damit metrics.js keine Locale-/Datumslogik braucht).
export function easyDisziplin(runs, THRESHOLDS) {
  if (runs.length < 1) return { status: "grau", detail: "noch zu wenig Daten" };

  const withOver = runs.map((r) => ({ ...r, over: (r.avgHr ?? 0) - r.hfMax }));
  const overCount = withOver.filter((r) => r.over > 0).length;
  const bigOver = withOver.some((r) => r.over > THRESHOLDS.easy.gelbMaxOver);

  let status;
  if (overCount === 0) status = "gruen";
  else if (overCount === 1 && !bigOver) status = "gelb";
  else status = "rot";

  if (status === "gruen") {
    return { status, detail: `Letzte ${runs.length} ${runs.length === 1 ? "Lauf" : "Läufe"} in der Zone` };
  }
  const worst = withOver.reduce((a, b) => (b.over > a.over ? b : a));
  return { status, detail: `${worst.dayLabel}: Ø ${worst.avgHr} bpm, Obergrenze ${worst.hfMax}` };
}

// ---------- Ampel 3: Belastung ----------
// allRuns: alle Strava-Läufe (auch ungeplante), je { date, distanceKm }.
export function belastung(allRuns, todayISO, THRESHOLDS) {
  const earliest = allRuns.reduce((min, r) => (!min || r.date < min ? r.date : min), null);
  const hasHistory = earliest && earliest <= addDays(todayISO, -(THRESHOLDS.belastung.minHistoryDays - 1));
  if (!hasHistory) return { status: "grau", detail: "noch zu wenig Daten" };

  const kmBetween = (from, to) =>
    allRuns.filter((r) => r.date >= from && r.date <= to).reduce((a, r) => a + r.distanceKm, 0);

  const km7 = kmBetween(addDays(todayISO, -6), todayISO);
  const km28 = kmBetween(addDays(todayISO, -34), addDays(todayISO, -7));
  const weeklyAvg = km28 / 4;
  const ratio = weeklyAvg > 0 ? km7 / weeklyAvg : km7 > 0 ? Infinity : 0;

  const status = ratio <= THRESHOLDS.belastung.gruen ? "gruen" : ratio <= THRESHOLDS.belastung.gelb ? "gelb" : "rot";
  // Ein unendliches Verhältnis (keine Historie in den 28 Tagen, aber Läufe
  // in den letzten 7) darf weder als `Infinity` (wird zu `null` beim
  // JSON.stringify, K1) noch als "∞" (nicht auf der Zeichen-Whitelist des
  // Workers) nach außen gehen — "ratio: null" + Text ohne Sonderzeichen.
  const finite = isFinite(ratio);
  const ratioRounded = finite ? Math.round(ratio * 100) / 100 : null;
  const ratioText = finite ? ratioRounded.toFixed(2).replace(".", ",") : "über 9,99";
  return { status, ratio: ratioRounded, detail: `Verhältnis ${ratioText}` };
}

// Gewichtsübungen der letzten windowDays Tage, gruppiert nach Übungsname,
// aufsteigend sortiert — Deload-Einheiten und Zeit-/Körpergewichtsübungen
// fallen schon hier raus (F5 Ampel 4). Verschoben von app.js hierher (I5,
// Code-Review M2 Runde 1), damit die Deload-/Fenster-Filterung ohne Browser
// testbar ist — vorher stand sie nirgends im Test.
export function kraftHistoryByExercise(logs, iso, windowDays) {
  const cutoff = addDays(iso, -(windowDays - 1));
  const byExercise = new Map();
  for (const log of logs) {
    if (!log.completed || !log.sets?.length) continue;
    if (log.date < cutoff || log.date > iso) continue;
    const spec = parseSoll(log.soll);
    if (!spec || spec.timeBased || spec.deload) continue;
    if (!(log.topKg > 0)) continue;
    const key = log.name || log.exercise;
    if (!byExercise.has(key)) byExercise.set(key, []);
    byExercise.get(key).push({ date: log.date, soll: log.soll, topKg: log.topKg, totalReps: log.totalReps, sets: log.sets });
  }
  for (const entries of byExercise.values()) entries.sort((a, b) => (a.date < b.date ? -1 : 1));
  return byExercise;
}

// ---------- Ampel 4: Kraft-Progression ----------
// historyByExercise: Map<name, entries[]> — bereits gefiltert auf das
// Betrachtungsfenster (windowDays), Nicht-Deload, Gewichtsübungen
// (topKg > 0, nicht zeitbasiert), aufsteigend nach Datum sortiert. Jeder
// Eintrag: { date, soll, topKg, totalReps, sets: [{reps, kg}] }.
function classifyExercise(entries, KRAFT) {
  const last = entries[entries.length - 1];
  const lastSpec = parseSoll(last.soll);
  const lastMinReps = Math.min(...last.sets.map((s) => s.reps ?? Infinity));
  const belowNow = !!lastSpec && !lastSpec.timeBased && lastMinReps < lastSpec.repMin;

  // Wie viele Nicht-Deload-Einheiten in Folge (vom Ende her) unter Soll sind.
  let consecutiveBelow = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const spec = parseSoll(entries[i].soll);
    const minReps = Math.min(...entries[i].sets.map((s) => s.reps ?? Infinity));
    if (spec && minReps < spec.repMin) consecutiveBelow++;
    else break;
  }

  // Stagnation: die letzten stallSessions Einheiten haben dasselbe Soll-
  // Schema (gleiche Satzzahl + Wdh-Spanne), dasselbe topKg, und die
  // Gesamt-Wdh der jüngsten ist nicht höher als die der ältesten dieser
  // Einheiten. Ändert sich das Schema, beginnt die Zählung neu (F5).
  const n = KRAFT.stallSessions;
  let stagnates = false;
  if (entries.length >= n) {
    const win = entries.slice(-n);
    const specs = win.map((e) => parseSoll(e.soll));
    const sameSchema = specs.every(
      (s) => s && s.sets === specs[0].sets && s.repMin === specs[0].repMin && s.repMax === specs[0].repMax
    );
    const sameTopKg = win.every((e) => e.topKg === win[0].topKg);
    stagnates = sameSchema && sameTopKg && win[win.length - 1].totalReps <= win[0].totalReps;
  }

  const status = belowNow ? "unterSoll" : stagnates ? "stagniert" : "ok";
  // Für die Wochenbilanz: bei "ok" unterscheiden, ob seit der vorigen
  // Einheit Gewicht oder Wiederholungen zugelegt haben oder alles gleich blieb.
  const prev = entries.length >= 2 ? entries[entries.length - 2] : null;
  const trend = !prev || last.topKg > prev.topKg || (last.topKg === prev.topKg && last.totalReps > prev.totalReps)
    ? "steigt" : "haelt";
  return {
    name: last.name,
    status,
    affected: status !== "ok",
    consecutiveBelow,
    topKg: last.topKg,
    reps: last.sets.map((s) => s.reps).join("/"),
    soll: last.soll,
    trend,
  };
}

function formatKraftDetail(results, status) {
  if (status === "gruen") return `${results.length} Übungen, keine hängt fest`;
  const affected = [...results.filter((r) => r.affected)].sort((a, b) => b.consecutiveBelow - a.consecutiveBelow);
  const worst = affected[0];
  const spec = parseSoll(worst.soll);
  const range = spec ? `${spec.sets}x${spec.repMin}${spec.repMax !== spec.repMin ? "-" + spec.repMax : ""}` : worst.soll;
  const text =
    worst.status === "unterSoll"
      ? `${worst.name} unter Soll (${worst.reps} bei ${range})`
      : `${worst.name}: ${worst.reps.split("/").length}× ${worst.topKg} kg ohne Steigerung`;
  return affected.length > 1 ? `${text} · +${affected.length - 1} weitere` : text;
}

export function kraftProgression(historyByExercise, THRESHOLDS) {
  const KRAFT = THRESHOLDS.kraft;
  const withData = [...historyByExercise.entries()].filter(([, entries]) => entries.length > 0);
  if (withData.length < KRAFT.minExercisesWithData) {
    return { status: "grau", detail: "noch zu wenig Daten" };
  }

  const results = withData.map(([name, entries]) =>
    classifyExercise(entries.map((e) => ({ ...e, name })), KRAFT)
  );
  const affected = results.filter((r) => r.affected);
  const twoInRow = results.some((r) => r.consecutiveBelow >= KRAFT.redConsecutiveBelow);

  const status = affected.length >= KRAFT.redAffectedCount || twoInRow ? "rot" : affected.length === 1 ? "gelb" : "gruen";
  return { status, detail: formatKraftDetail(results, status), results };
}

// ---------- Adhärenz 4 Wochen (F8) ----------
export function adherence4w(doneCount, plannedCount) {
  const pct = plannedCount > 0 ? Math.round((doneCount / plannedCount) * 100) : 0;
  return { pct, done: doneCount, planned: plannedCount };
}

// ---------- Aerobe Effizienz (F8) ----------
// weeklyRuns: [{ week, runs: [{ paceSecPerKm, avgHr }] }] — nur Läufe mit
// Ø HF in der Z2-Zone des Plans zählen; Wochen ohne Treffer fehlen im
// Ergebnis (keine Lücke wird erzwungen).
export function aerobeEffizienz(weeklyRuns, zone) {
  const points = weeklyRuns
    .map(({ week, runs }) => {
      const inZone = runs.filter((r) => r.avgHr != null && r.avgHr >= zone.hfMin && r.avgHr <= zone.hfMax && r.paceSecPerKm);
      if (!inZone.length) return null;
      return { week, avgPace: inZone.reduce((a, r) => a + r.paceSecPerKm, 0) / inZone.length };
    })
    .filter(Boolean);

  if (points.length < 2) return { points, deltaText: null, good: null };
  const deltaSec = Math.round(points[0].avgPace - points[points.length - 1].avgPace);
  const good = deltaSec > 0;
  return { points, good, deltaText: `${good ? "-" : "+"}${Math.abs(deltaSec)} s/km seit Woche ${points[0].week}` };
}

// ---------- Wochenvolumen Soll/Ist (F8) ----------
export function weeklyVolume(weeks, actualKmByWeek, currentWeekNo) {
  return weeks.map((w) => ({
    w: w.n,
    soll: w.placeholder ? null : w.plannedKm ?? null,
    ist: w.placeholder ? null : actualKmByWeek[w.n] ?? null,
    isCurrent: w.n === currentWeekNo,
    isPlaceholder: !!w.placeholder,
  }));
}

// ---------- Priorisierung für den Coach-Fallback (F6) ----------
// statuses: [{ key, status }]. tieOrder gibt bei Gleichstand die Reihenfolge
// vor (z. B. Belastung -> Easy -> Wochensoll -> Kraft).
export function worstStatus(statuses, tieOrder = []) {
  let best = null;
  for (const s of statuses) {
    if (!best || rank[s.status] > rank[best.status]) best = s;
    else if (rank[s.status] === rank[best.status] && tieOrder.indexOf(s.key) < tieOrder.indexOf(best.key)) best = s;
  }
  return best;
}
