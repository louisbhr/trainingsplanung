import {
  slug, toISO, fromISO, addDays,
  weekStart, weekDates, weekOf, weekNumberFor, phaseOf, phaseRange,
  sessionOn, sessionsFor, activePlanFor, planDayState, exerciseCatalog, formatGoal,
  monthLabel, germanDate,
} from "./plan.js?v=202610020844";
import { loadPlans } from "./plan-store.js?v=202610020844";
import {
  saveLog, loadLogsForDate, loadLogsForExercise, ensureSignedIn, loadDayPlan, saveDayPlan,
  loadRunLinks, saveRunLink, clearRunLink, loadAllLogs, loadAllDayPlans, loadCoach, saveCoach,
  loadCoachWeek, saveCoachWeek,
} from "./firebase-init.js?v=202610020844";
import {
  isAuthorized, startAuthorization, handleAuthRedirect, fetchRecentRuns,
  formatPace, formatDuration, isWorkerConfigured, sessionForDate,
} from "./strava.js?v=202610020844";
import { suggestProgression, previousEntry } from "./progression.js?v=202610020844";
import { assignRuns, pickableRuns, offsetLabel, daysBetween } from "./runmatch.js?v=202610020844";
import { esc, ICONS, badge, toast, errorCard, loadingCard, dayNameDE, shortDate, longDateDE, openInfo, closeInfo } from "./ui.js?v=202610020844";
import * as dash from "./view-dashboard.js?v=202610020844";
import * as dashWeek from "./view-week.js?v=202610020844";
import * as metrics from "./metrics.js?v=202610020844";
import * as coach from "./coach.js?v=202610020844";
import { THRESHOLDS, COACH_URL } from "./config.js?v=202610020844";

const INFO_CONTENT = dash.infoContent(THRESHOLDS);
// Modell/Prompt-Version rein informativ fürs Firestore-Dokument (A4) — die
// eigentliche Konstante steht im Worker; ein Auseinanderlaufen ist
// unkritisch, das Feld dient nur der späteren Auswertung/Migration.
const COACH_MODEL = "claude-haiku-4-5";
const COACH_PROMPT_VERSION = "coach-v1";

// Wird erst gesetzt, wenn der Plan geladen ist (A1) — vorher greift jeder
// Zugriff auf den STRAVA_SINCE-Wert daneben.
let STRAVA_SINCE = null;

// Alle geladenen Pläne (F0a Punkt 4: Registry statt Einzelplan). In
// Schritt 1 genau einer; erst mit loadPlans() in init() gefüllt (A1) —
// Modul-Top-Level-Zugriffe auf Plandaten sind damit ausgeschlossen.
let plans = [];

// ---------- kleine Helfer ----------
const todayISO = () => toISO(new Date());

const header = document.getElementById("header");
const main = document.getElementById("main");

const state = {
  tab: "dashboard",
  weekNo: 1, // richtiger Wert kommt aus init(), sobald der Plan geladen ist
  selectedDate: null,
  historyMode: "kraft",
  historyExercise: null,
  todayExpanded: false, // "Heute dran" (Kraft): Übungsliste auf-/zugeklappt
  bilanzExpanded: false, // Wochenbilanz Di–So: eingeklappt, per Tap aufklappbar (Mo startet automatisch offen)
};

// Wochennummer für den Wochen-Tab: innerhalb einer Planwoche die echte
// Nummer, sonst (Rennlücke/kein Plan) ein sinnvoller Randwert, damit die
// Navigation nicht auf undefined läuft (A8/E7).
function weekNoForTab(iso) {
  if (!plans.length) return 1;
  const plan = activePlanFor(iso, plans) || plans[0];
  if (planDayState(iso, plans) === "woche") return weekNumberFor(plan, iso);
  // Außerhalb einer Planwoche (I3): vor dem Planstart Woche 1 zeigen (wie
  // früher), dahinter (Rennlücke oder ganz ohne Plan) die letzte Woche.
  return iso < plan.start ? 1 : plan.totalWeeks;
}

// Vorauswahl im Verlauf: die erste Übung der laufenden Woche — der alte
// Split aus Woche 1 steht sonst dauerhaft als Standard da.
function defaultHistoryExercise() {
  const iso = todayISO();
  const plan = activePlanFor(iso, plans);
  const w = plan ? weekNumberFor(plan, iso) : null;
  const week = plan && w != null ? weekOf(plan, w) : null;
  if (week && !week.placeholder) {
    const firstKraft = week.sessions.find((s) => s.kind === "kraft");
    if (firstKraft) return slug(firstKraft.exercises[0].name);
  }
  const catalog = plan ? exerciseCatalog(plan) : [];
  return slug(catalog[0]?.name || "Squats");
}

// Kraft-Eingaben der gerade sichtbaren Tagesansicht
const logState = new Map();
// Pro Tag angepasste Übungsliste: { removed: [slug], added: [{name, soll, hint}] }
let dayPlan = { removed: [], added: [] };
let currentKraftDay = { info: null, iso: null };
let editMode = false;
let replaceFor = null; // Slug der Übung, die gerade getauscht wird
let quickAdd = false;  // Maske zum schnellen Hinzufügen offen
// Strava: null = noch nicht geladen, false = nicht verbunden
let stravaState = { runs: null, error: null, errorSource: null, connected: null };
// Plan-Datum -> { run, offset, source }
let runAssignment = {};
let runLinks = {};
let runPickerFor = null; // Plan-Datum, für das gerade die Auswahl offen ist
let allLogs = null; // Kraft-Verlauf, für die Progressionsvorschläge
let allDayPlans = null; // Tages-Anpassungen aller Tage, für die Wochensoll-Ampel (M2-5)

// ---------- Plan-Zugriff ----------
// Delegiert an sessionOn(plan, iso) innerhalb eines aktiven Plans; deckt
// zusätzlich die beiden Zustände außerhalb der Planwochen ab (A8/E7):
// "bisZumRennen" (Datum liegt zwischen Planende und Renntag) und
// "keinPlan" (kein Plan deckt das Datum ab).
function dayInfo(iso) {
  const dayState = planDayState(iso, plans);
  if (dayState === "keinPlan") return { kind: "keinPlan" };
  if (dayState === "bisZumRennen") return { kind: "bisZumRennen" };
  return sessionOn(activePlanFor(iso, plans), iso);
}

function colorsFor(info) {
  if (info.kind === "kraft") return ["var(--teal-fg)", "var(--teal-bg)"];
  if (info.kind === "lauf")
    return info.shortType === "Long"
      ? ["var(--purple-fg)", "var(--purple-bg)"]
      : ["var(--coral-fg)", "var(--coral-bg)"];
  return ["var(--text-secondary)", "var(--surface-1)"];
}

function badgeForKind(info) {
  const [color, bg] = colorsFor(info);
  if (info.kind === "kraft") return badge(info.label, color, bg);
  if (info.kind === "lauf") return badge(info.type, color, bg);
  if (info.kind === "placeholder") return badge("Offen", color, bg);
  if (info.kind === "bisZumRennen") return badge("Bis zum Rennen", color, bg);
  if (info.kind === "keinPlan") return badge("Kein Plan", color, bg);
  return badge("Ruhe", color, bg);
}

// ---------- Dashboard (F1–F8) ----------
// M2-4: Kopfzeile + "Heute dran" sind fertig; Coach/Ampeln/"Im Detail" sind
// bewusst Platzhalter (siehe view-dashboard.js) — echte Werte kommen mit
// M2-5/M2-6/M2-9/M2-10.
const COACH_NO_PLAN_TEXT =
  "Dein Plan ist beendet. Ein neues Ziel legst du im Plan-Tab an, sobald es feststeht. " +
  "Bis dahin zeigt dir das Dashboard weiter deine Strava-Läufe und die Belastung.";

// Letzter geladener dayplans-Stand für den heutigen Krafttag (M2-4) — bleibt
// über Toggle-Klicks erhalten, damit "Starten" nicht jedes Mal auf die
// Plan-Rohliste zurückfällt, bevor der frische Fetch durch ist.
let todayDayPlanCache = { removed: [], added: [] };

// Wie effectiveExercises(info), aber mit explizit übergebenem dayPlan statt
// dem Modul-Global — Dashboard und Ampeln (M2-5) brauchen das für Tage, die
// nicht die gerade offene Kraft-Tagesansicht sind.
function effectiveExercisesFor(info, dp) {
  const removed = new Set(dp.removed);
  const replacements = new Map();
  for (const ex of dp.added) if (ex.replaces) replacements.set(ex.replaces, ex);
  const out = [];
  for (const ex of info.exercises) {
    const sl = slug(ex.name);
    const rep = replacements.get(sl);
    if (rep) { out.push({ ...rep, custom: true }); continue; }
    if (removed.has(sl)) continue;
    out.push(ex);
  }
  for (const ex of dp.added) if (!ex.replaces) out.push({ ...ex, custom: true });
  return out;
}

function todayStravaSummary(iso) {
  if (!stravaState.runs) return null;
  const todays = stravaState.runs.filter((r) => r.date === iso);
  if (!todays.length) return null;
  const best = todays.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
  return `${best.name} · ${best.distanceKm.toFixed(1)} km`;
}

// F2: "Datum offen" ohne bestätigtes Renndatum, sonst Wochen/Tage bis zum
// Rennen (letzte Planwoche bzw. Rennlücke zeigt Tage statt Wochen).
function countdownText(plan, iso, dayState) {
  if (!plan.goal.raceDateConfirmed) {
    return `Rennen ca. ${monthLabel(plan.goal.raceDate)} · Datum offen`;
  }
  const days = daysBetween(iso, plan.goal.raceDate);
  if (days <= 0) return "Rennen heute!";
  const lastStretch = dayState === "bisZumRennen" || weekNumberFor(plan, iso) === plan.totalWeeks;
  if (lastStretch || days <= 7) return `Noch ${days} ${days === 1 ? "Tag" : "Tage"}`;
  const weeks = Math.ceil(days / 7);
  return `Noch ${weeks} ${weeks === 1 ? "Woche" : "Wochen"} bis zum Rennen`;
}

function paintDashboardHeader(iso, dayState, plan) {
  if (dayState === "keinPlan") {
    const race = plans[0]?.goal;
    const past = race && race.raceDate < iso;
    header.innerHTML = dash.headerHTML({
      eyebrow: longDateDE(iso),
      title: "Kein aktiver Plan",
      badge: dash.noPlanBadgeHTML(),
      countdown: past ? `Rennen am ${germanDate(race.raceDate)}` : "",
    });
    return;
  }
  if (dayState === "bisZumRennen") {
    header.innerHTML = dash.headerHTML({
      eyebrow: longDateDE(iso),
      title: "Bis zum Rennen",
      badge: dash.noPlanBadgeHTML(),
      countdown: countdownText(plan, iso, dayState),
    });
    return;
  }
  const w = weekNumberFor(plan, iso);
  const week = weekOf(plan, w);
  const phase = phaseOf(plan, w);
  header.innerHTML = dash.headerHTML({
    eyebrow: longDateDE(iso),
    title: `Woche ${w} · ${week.weekType}`,
    badge: dash.phaseBadgeHTML(phase.n, phase.name, phase.tone),
    countdown: countdownText(plan, iso, dayState),
  });
}

function todayCardSlotHTML(iso, dayState, plan) {
  if (dayState === "keinPlan") return dash.todayCardNoPlanHTML(todayStravaSummary(iso));
  if (dayState === "bisZumRennen") return dash.todayCardBisZumRennenHTML();

  const info = sessionOn(plan, iso);
  if (info.kind === "placeholder") return dash.todayCardPlaceholderHTML(phaseOf(plan, info.week)?.n, info.focus);
  if (info.kind === "kraft") {
    const exercises = effectiveExercisesFor(info, todayDayPlanCache);
    return dash.todayCardKraftHTML(info, { expanded: state.todayExpanded, progressText: "… geloggt", exercises });
  }
  if (info.kind === "lauf") {
    const actualHTML =
      stravaState.error ? dash.laufErrorHTML()
      : stravaState.connected === false ? dash.laufNotConnectedHTML()
      : stravaState.connected ? dash.laufActualHTML(runAssignment[iso])
      : dash.laufLoadingHTML(); // null = Prüfung läuft noch
    return dash.todayCardLaufHTML(info, actualHTML);
  }
  return dash.todayCardRuheHTML();
}

function paintDashboardMain(iso, dayState, plan) {
  // Neuer Tag/neue Woche: kein Rest vom vorigen Coach-Render übernehmen.
  coachDailyText = null;
  coachBilanzInfo = null;
  state.bilanzExpanded = false;
  main.innerHTML = `
    <div id="today-slot">${todayCardSlotHTML(iso, dayState, plan)}</div>
    <div id="coach-slot">${dayState === "keinPlan" ? dash.coachNoPlanHTML(COACH_NO_PLAN_TEXT) : dash.coachPlaceholderHTML()}</div>
    <div id="ampel-slot">${dash.ampelPlaceholderGridHTML()}</div>
    <div id="detail-slot">${dash.detailPlaceholderHTML()}</div>`;
  fillTodayCard(iso, dayState, plan);
  fillAmpeln(iso, dayState, plan);
  fillDetail(iso, dayState, plan);
  fillCoach(iso, dayState, plan);
  fillWeeklyBilanz(iso, dayState, plan);
}

function refreshTodaySlot(iso, dayState, plan) {
  // Kann inzwischen weitergeklickt haben (anderer Tab, Tagesansicht offen) —
  // dann nicht mehr in die aktuelle Ansicht schreiben.
  if (state.tab !== "dashboard" || state.selectedDate) return;
  const slot = document.getElementById("today-slot");
  if (slot) slot.innerHTML = todayCardSlotHTML(iso, dayState, plan);
}

// Lädt nach, was die Synchron-Ansicht noch nicht hatte (Strava-Ist-Werte,
// Kraft-Fortschritt) — das Dashboard selbst wartet darauf nicht (F3/F7).
async function fillTodayCard(iso, dayState, plan) {
  if (dayState === "woche") {
    const info = sessionOn(plan, iso);
    if (info.kind === "kraft") {
      try {
        const [saved, dp] = await Promise.all([loadLogsForDate(iso), loadDayPlan(iso)]);
        todayDayPlanCache = dp;
        const exercises = effectiveExercisesFor(info, dp);
        const done = exercises.filter((ex) => saved[slug(ex.name)]?.completed).length;
        if (state.tab === "dashboard" && !state.selectedDate) {
          const slot = document.getElementById("today-slot");
          if (slot) {
            slot.innerHTML = dash.todayCardKraftHTML(info, {
              expanded: state.todayExpanded,
              progressText: `${done}/${exercises.length} geloggt`,
              exercises,
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }
  }
  // Lauftag, "kein Plan" (Strava-Fallback) oder "bis zum Rennen": Strava
  // laden, dann die Karte mit den Ist-Werten aktualisieren.
  try {
    await loadStrava();
    refreshTodaySlot(iso, dayState, plan);
  } catch (err) {
    console.error(err);
  }
}

// ---------- Ampeln (F5, M2-5) ----------
// Wirft nie (I1, Code-Review M2 Runde 1): fillAmpeln/fillDetail/fillCoach
// sollen bei einem Firestore-Ausfall mit leeren, aber validen Daten
// weiterrechnen (Kraft-Ampel grau, Rest normal) statt dauerhaft im
// Lade-Platzhalter hängen zu bleiben. ok=false zeigt den Aufrufern, dass
// logs/dps nur ein sicherer Leerwert sind, keine echten Daten.
async function ensureAllLogsAndDayPlans() {
  try {
    const [logs, dps] = await Promise.all([
      allLogs ? Promise.resolve(allLogs) : loadAllLogs(),
      allDayPlans ? Promise.resolve(allDayPlans) : loadAllDayPlans(),
    ]);
    allLogs = logs;
    allDayPlans = dps;
    return { logs, dps, ok: true };
  } catch (err) {
    console.error(err);
    return { logs: [], dps: {}, ok: false };
  }
}

// Letzte (max n) über assignRuns zugeordnete Easy/Long/Recovery-Läufe über
// alle Planwochen hinweg (nicht nur die aktuelle Woche) — F5 Ampel 2.
function lastAssignedEasyRuns(plan, n) {
  const candidates = [];
  for (const week of plan.weeks) {
    if (week.placeholder) continue;
    for (const s of week.sessions.filter((x) => x.kind === "lauf" && ["Easy", "Long", "Recovery"].includes(x.shortType))) {
      const a = runAssignment[s.date];
      if (a?.run) candidates.push({ avgHr: a.run.avgHr, hfMax: s.hfMax, dayLabel: dayNameDE(s.date), date: s.date });
    }
  }
  candidates.sort((a, b) => (a.date < b.date ? 1 : -1)); // neueste zuerst
  return candidates.slice(0, n);
}

// "Kraft erledigt" (F5/F8): alle Übungen der effektiven Liste (inkl. eigener
// Ergänzungen/Entfernungen aus dayplans) sind für diesen Tag geloggt. Diese
// Regel stand vorher sechsfach fast gleich da (I4, Code-Review M2 Runde 1) —
// ändert sie sich einmal (z. B. eigene Übungen, Schritt 1b), reicht diese
// eine Stelle. logs darf leer sein (Firestore-Ausfall, I1) — dann ist
// einfach nichts geloggt, kein Fehler.
function kraftProgressOn(session, dp, logs) {
  const exercises = effectiveExercisesFor(session, dp || { removed: [], added: [] });
  const withLogs = exercises.map((ex) => ({
    ex,
    log: logs.find((l) => l.date === session.date && l.exercise === slug(ex.name) && l.completed) || null,
  }));
  const done = withLogs.filter((e) => e.log).length;
  return { exercises, withLogs, done, total: exercises.length, complete: exercises.length > 0 && done === exercises.length };
}

// Strava "bereit" heißt mehr als nur "verbunden" (I2): ein Abrufsfehler
// setzt connected weiterhin true, aber runs bleibt null und error ist
// gesetzt — ohne diese Prüfung würde ein 500er-Abruf als "0 km gelaufen"
// gewertet (falsches Rot auf den Lauf-Ampeln, eine Wochenbilanz ohne
// Strava-Daten).
function stravaReady() {
  return stravaState.connected === true && Array.isArray(stravaState.runs) && !stravaState.error;
}
function stravaUnavailableDetail() {
  return stravaState.connected === false ? "Strava nicht verbunden" : "Strava nicht geladen";
}

function grauAmpeln(iso, detail) {
  const b = stravaReady()
    ? metrics.belastung(stravaState.runs || [], iso, THRESHOLDS)
    : { status: "grau", detail: stravaUnavailableDetail() };
  return [
    { key: "wochensoll", status: "grau", detail },
    { key: "easy", status: "grau", detail },
    { key: "belastung", status: b.status, detail: b.detail },
    { key: "kraft", status: "grau", detail },
  ];
}

// logsOk=false (I1, Firestore-Ausfall): die Kraft-Ampel wird grau mit einem
// eigenen Hinweis statt "noch zu wenig Daten", und der Kraftteil des
// Wochensolls zählt nicht mit (weder Lob noch Tadel aus Daten, die gar nicht
// da sind). stravaReady()=false (I2): Easy- und Belastungs-Ampel werden
// grau, der Laufteil des Wochensolls zählt nicht mit.
function computeRealAmpeln(plan, weekNo, iso, logs, dayPlans, logsOk = true) {
  const sessions = sessionsFor(plan, weekNo);
  const stravaOk = stravaReady();

  const actualKmByDate = {};
  if (stravaOk) {
    for (const s of sessions.filter((x) => x.kind === "lauf")) {
      const a = runAssignment[s.date];
      if (a?.run) actualKmByDate[s.date] = a.run.distanceKm;
    }
  }
  const kraftDoneByDate = {};
  for (const s of sessions.filter((x) => x.kind === "kraft")) {
    kraftDoneByDate[s.date] = kraftProgressOn(s, dayPlans[s.date], logs).complete;
  }
  const wochensollSessions = sessions.filter(
    (s) => (s.kind === "kraft" && logsOk) || (s.kind === "lauf" && stravaOk)
  );
  const wochensollResult = metrics.wochensoll(wochensollSessions, actualKmByDate, kraftDoneByDate, iso, THRESHOLDS);

  const easyResult = stravaOk
    ? metrics.easyDisziplin(lastAssignedEasyRuns(plan, 3), THRESHOLDS)
    : { status: "grau", detail: stravaUnavailableDetail() };
  const belastungResult = stravaOk
    ? metrics.belastung(stravaState.runs || [], iso, THRESHOLDS)
    : { status: "grau", detail: stravaUnavailableDetail() };
  const kraftResult = logsOk
    ? metrics.kraftProgression(metrics.kraftHistoryByExercise(logs, iso, THRESHOLDS.kraft.windowDays), THRESHOLDS)
    : { status: "grau", detail: "Kraftdaten nicht geladen" };

  return [
    { key: "wochensoll", status: wochensollResult.status, detail: wochensollResult.detail },
    { key: "easy", status: easyResult.status, detail: easyResult.detail },
    { key: "belastung", status: belastungResult.status, detail: belastungResult.detail },
    { key: "kraft", status: kraftResult.status, detail: kraftResult.detail },
  ];
}

async function fillAmpeln(iso, dayState, plan) {
  try {
    await loadStrava(); // idempotent/gecacht — Zuordnung + Belastung brauchen es
    let list;
    if (dayState !== "woche") {
      list = grauAmpeln(iso, "kein aktiver Plan");
    } else {
      const weekNo = weekNumberFor(plan, iso);
      const week = weekOf(plan, weekNo);
      if (week.placeholder) {
        list = grauAmpeln(iso, "Woche ohne Details");
      } else {
        const { logs, dps, ok } = await ensureAllLogsAndDayPlans();
        list = computeRealAmpeln(plan, weekNo, iso, logs, dps, ok);
      }
    }
    if (state.tab === "dashboard" && !state.selectedDate) {
      const slot = document.getElementById("ampel-slot");
      if (slot) slot.innerHTML = dash.ampelGridHTML(list);
    }
  } catch (err) {
    console.error(err);
  }
}

// ---------- "Im Detail" (F8, M2-6) ----------
function weeksOfCurrentPhase(plan, weekNo) {
  const phase = phaseOf(plan, weekNo);
  return plan.weeks.filter((w) => w.n >= phase.weeks.from && w.n <= phase.weeks.to);
}

// Ist-km einer Woche aus den zugeordneten Läufen (runAssignment deckt schon
// den ganzen Plan ab, nicht nur die aktuelle Woche). 0 ist ein gültiger
// Wert (kein Lauf zugeordnet) — nur künftige Wochen bleiben null, damit dort
// kein Ist-Balken gezeichnet wird (D2).
function actualKmForWeek(plan, weekNo, currentWeekNo) {
  const week = weekOf(plan, weekNo);
  if (!week || week.placeholder || weekNo > currentWeekNo) return null;
  let total = 0;
  for (const s of sessionsFor(plan, weekNo).filter((x) => x.kind === "lauf")) {
    const a = runAssignment[s.date];
    if (a?.run) total += a.run.distanceKm;
  }
  return total;
}

// Zugeordnete Läufe je Woche (1..bis) für die aerobe Effizienz — auch aus
// Wochen außerhalb der aktuellen Phase, deshalb unabhängig von
// weeksOfCurrentPhase.
function aerobeWeeklyData(plan, uptoWeekNo) {
  const out = [];
  for (let n = 1; n <= uptoWeekNo; n++) {
    const week = weekOf(plan, n);
    if (!week || week.placeholder) continue;
    const runs = sessionsFor(plan, n)
      .filter((s) => s.kind === "lauf")
      .map((s) => runAssignment[s.date]?.run)
      .filter(Boolean)
      .map((r) => ({ paceSecPerKm: r.paceSecPerKm, avgHr: r.avgHr }));
    out.push({ week: n, runs });
  }
  return out;
}

// Adhärenz 4 Wochen: erledigte vs. geplante Einheiten (Ruhetage sind in
// sessions[] ohnehin nicht enthalten) der letzten 28 Tage über alle Wochen.
function adherence4wData(plan, iso, logs, dayPlans) {
  const from = addDays(iso, -27);
  let planned = 0, done = 0;
  for (const week of plan.weeks) {
    if (week.placeholder) continue;
    for (const s of sessionsFor(plan, week.n)) {
      if (s.date < from || s.date > iso) continue;
      planned++;
      if (s.kind === "lauf") {
        if (runAssignment[s.date]?.run) done++;
      } else if (s.kind === "kraft") {
        if (kraftProgressOn(s, dayPlans[s.date], logs).complete) done++;
      }
    }
  }
  return metrics.adherence4w(done, planned);
}

// "Als Nächstes": nächster Long Run, Typ der nächsten Woche, nächste
// Re-Kalibrierung.
function nextUpLines(plan, iso, currentWeekNo) {
  let nextLong = null;
  for (const week of plan.weeks) {
    if (week.placeholder) continue;
    for (const s of sessionsFor(plan, week.n).filter((x) => x.kind === "lauf" && x.shortType === "Long")) {
      if (s.date >= iso && (!nextLong || s.date < nextLong.date)) nextLong = s;
    }
  }
  const nextWeek = weekOf(plan, currentWeekNo + 1);
  const nextRecal = (plan.recalibrationDates || []).find((d) => d >= iso);
  return [
    nextLong ? `Nächster Long Run: ${dayNameDE(nextLong.date)} ${shortDate(nextLong.date)}, ${nextLong.dist}` : "Kein weiterer Long Run geplant",
    nextWeek ? `Nächste Woche: ${nextWeek.weekType}` : "Letzte Planwoche",
    nextRecal ? `Re-Kalibrierung: ${shortDate(nextRecal)}` : "Keine weitere Re-Kalibrierung geplant",
  ];
}

function patchDetailSlot(html) {
  if (state.tab !== "dashboard" || state.selectedDate) return;
  const slot = document.getElementById("detail-slot");
  if (slot) slot.innerHTML = html;
}

async function fillDetail(iso, dayState, plan) {
  try {
    await loadStrava();
    if (dayState !== "woche") {
      // F7: nach Planende/in der Rennlücke/ohne Plan bleibt höchstens die
      // Aerobe-Effizienz-Karte übrig, kein "Im Detail"-Label, kein Rest.
      let html = "";
      if (plan) {
        const zone = plan.zones.find((z) => z.id === "z2");
        const aerobe = metrics.aerobeEffizienz(aerobeWeeklyData(plan, plan.totalWeeks), zone);
        html = dash.aerobeCardHTML(aerobe);
      }
      patchDetailSlot(html);
      return;
    }
    const weekNo = weekNumberFor(plan, iso);
    const week = weekOf(plan, weekNo);
    if (week.placeholder) {
      patchDetailSlot(dash.detailPlaceholderHTML());
      return;
    }
    const { logs, dps, ok } = await ensureAllLogsAndDayPlans();
    const phaseWeeks = weeksOfCurrentPhase(plan, weekNo);
    const actualKmByWeek = {};
    for (const w of phaseWeeks) actualKmByWeek[w.n] = actualKmForWeek(plan, w.n, weekNo);
    const volume = metrics.weeklyVolume(phaseWeeks, actualKmByWeek, weekNo);
    const zone = plan.zones.find((z) => z.id === "z2");
    const aerobe = metrics.aerobeEffizienz(aerobeWeeklyData(plan, weekNo), zone);
    // I1: ohne lesbare Logs bleibt die Adhärenz-Kachel grau statt eine
    // 0%-Zahl aus leeren Daten vorzutäuschen; Volumen/Effizienz brauchen
    // keine Logs und rendern unverändert.
    const adherence = ok ? adherence4wData(plan, iso, logs, dps) : null;
    const nextLines = nextUpLines(plan, iso, weekNo);

    patchDetailSlot(`<p class="section-label">Im Detail</p>
      ${dash.volumeCardHTML(volume)}
      ${dash.aerobeCardHTML(aerobe)}
      <div class="metric-grid">
        ${dash.adherenceTileHTML(adherence)}
        ${dash.nextUpTileHTML(nextLines)}
      </div>`);
  } catch (err) {
    console.error(err);
  }
}

// ---------- Coach (F6, M2-9) ----------
function todayFieldFor(info, doneToday) {
  if (info.kind === "kraft") return { type: "Kraft", name: info.label, done: !!doneToday };
  if (info.kind === "lauf") return { type: "Lauf", name: info.type, done: !!runAssignment[todayISO()]?.run };
  if (info.kind === "ruhe") return { type: "Ruhe", name: "Ruhe", done: false };
  return { type: "Offen", name: "Offen", done: false }; // Platzhalterwoche
}

// Nächste geplante Einheit über alle Planwochen hinweg, kurzgefasst wie
// "Sa: Long Run 13 km" (F6-Eingabeschema "next").
function nextSessionLabel(plan, iso) {
  let next = null;
  for (const week of plan.weeks) {
    if (week.placeholder) continue;
    for (const s of sessionsFor(plan, week.n)) {
      if (s.date > iso && (!next || s.date < next.date)) next = s;
    }
  }
  if (!next) return "Kein weiteres Training geplant";
  const label = next.kind === "lauf" ? `${next.type} ${next.dist}` : next.label;
  return `${dayNameDE(next.date)}: ${label}`;
}

function patchCoachSlot(html) {
  if (state.tab !== "dashboard" || state.selectedDate) return;
  const slot = document.getElementById("coach-slot");
  if (slot) slot.innerHTML = html;
}

// Tagessatz und Wochenbilanz laufen als zwei unabhängige, unterschiedlich
// schnelle Anfragen (fillCoach/fillWeeklyBilanz) gegen denselben Slot —
// beide schreiben deshalb nie direkt, sondern nur über renderCoachSlot(),
// das den jeweils aktuellen Stand beider Teile kombiniert. Ohne das würde
// die zuerst fertige Anfrage von der zweiten überschrieben, statt ergänzt.
let coachDailyText = null;
let coachBilanzInfo = null; // { weekN, text, expanded } | null

function renderCoachSlot() {
  if (coachDailyText == null) return; // Tagessatz noch nicht da — nichts überschreiben
  const bilanzHTML = !coachBilanzInfo
    ? ""
    : coachBilanzInfo.expanded
    ? dash.bilanzExpandedHTML(coachBilanzInfo.weekN, coachBilanzInfo.text)
    : dash.bilanzCollapsedHTML(coachBilanzInfo.weekN, state.bilanzExpanded, coachBilanzInfo.text);
  patchCoachSlot(dash.coachTextHTML(coachDailyText, bilanzHTML));
}

// Baut die Ampel-Liste + Kraft-heute-erledigt ohne erneuten Strava-/
// Firestore-Zugriff (nutzt, was fillAmpeln/fillDetail ohnehin schon lädt/
// cacht) und ruft darüber requestCoach() auf. Fehler landen nie als
// Fehlerkarte (F6) — im schlimmsten Fall bleibt der Lade-Platzhalter stehen.
async function fillCoach(iso, dayState, plan) {
  if (dayState === "keinPlan") return; // fixer Hinweistext steht schon (kein API-Aufruf, F7)
  if (dayState === "bisZumRennen") {
    return patchCoachSlot(dash.coachNoPlanHTML(
      "Zwischen Planende und Rennen macht der Coach eine Pause. Bis zum Start alles Gute!"
    ));
  }
  try {
    await loadStrava();
    const weekNo = weekNumberFor(plan, iso);
    const week = weekOf(plan, weekNo);
    const info = sessionOn(plan, iso);

    let ampelnList, doneToday = false;
    if (week.placeholder) {
      ampelnList = grauAmpeln(iso, "Woche ohne Details");
    } else {
      const { logs, dps, ok } = await ensureAllLogsAndDayPlans();
      if (!ok) {
        // I1: ist das Coach-Dokument ohnehin nicht lesbar, gäbe es sowieso
        // keinen Aufruf (requestCoach() scheitert selbst an loadDoc) — hier
        // sparen wir ihn uns direkt und zeigen den Regel-Fallback sofort,
        // statt mit Platzhalterdaten eine echte Anfrage zu starten.
        ampelnList = computeRealAmpeln(plan, weekNo, iso, [], {}, false);
        coachDailyText = coach.fallbackDaily(ampelnList);
        renderCoachSlot();
        return;
      }
      ampelnList = computeRealAmpeln(plan, weekNo, iso, logs, dps);
      if (info.kind === "kraft") {
        doneToday = kraftProgressOn(info, dps[iso], logs).complete;
      }
    }

    const zone = plan.zones.find((z) => z.id === "z2");
    const aerobe = metrics.aerobeEffizienz(aerobeWeeklyData(plan, weekNo), zone);

    const input = coach.buildDailyInput({
      iso, week: weekNo, weekType: week.weekType, phase: phaseOf(plan, weekNo).name,
      goal: plan.goal, today: todayFieldFor(info, doneToday), ampeln: ampelnList,
      next: nextSessionLabel(plan, iso), aerobeEffizienzTrend: aerobe.deltaText,
    });
    const hash = await coach.hashInput(input);
    const fallbackText = coach.fallbackDaily(ampelnList);

    const result = await coach.requestCoach({
      hash,
      loadDoc: () => loadCoach(iso),
      saveDoc: (data) => saveCoach(iso, data),
      fetchWorker: () => fetch(COACH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      limit: THRESHOLDS.coach.dailyLimit,
      model: COACH_MODEL,
      promptVersion: COACH_PROMPT_VERSION,
      fallbackText,
    });

    coachDailyText = result.text;
    renderCoachSlot();
  } catch (err) {
    console.error(err);
    // Nie eine Fehlerkarte (F6) — Platzhalter bleibt stehen, wenn selbst der
    // Fallback nicht zustande kommt (z. B. Plan-/Zonen-Zugriff schlägt fehl).
  }
}

// ---------- Wochenbilanz montags (F6, M2-10) ----------
function weeklyRunData(plan, weekNo) {
  const laufSessions = sessionsFor(plan, weekNo).filter((s) => s.kind === "lauf");
  const plannedKm = laufSessions.reduce((a, s) => a + s.km, 0);
  let actualKm = 0, sessionsDone = 0;
  const easyOverLimit = [];
  for (const s of laufSessions) {
    const a = runAssignment[s.date];
    if (!a?.run) continue;
    actualKm += a.run.distanceKm;
    sessionsDone++;
    if (a.run.avgHr != null && a.run.avgHr > s.hfMax) {
      easyOverLimit.push({ day: dayNameDE(s.date), avgHr: Math.round(a.run.avgHr), limit: s.hfMax });
    }
  }
  return {
    plannedKm, actualKm: Math.round(actualKm * 10) / 10,
    sessionsPlanned: laufSessions.length, sessionsDone,
    easyOverLimit: easyOverLimit.slice(0, 7),
  };
}

function weeklyKraftData(plan, weekNo, logs, dps, kraftAmpelResults) {
  const kraftSessions = sessionsFor(plan, weekNo).filter((s) => s.kind === "kraft");
  let sessionsDone = 0;
  for (const s of kraftSessions) {
    if (kraftProgressOn(s, dps[s.date], logs).complete) sessionsDone++;
  }
  // metrics.kraftProgression kennt nur "ok"/"stagniert"/"unterSoll" (reicht
  // für die Ampel); die Wochenbilanz braucht die feinere Worker-Enum
  // steigt/haelt/stagniert/unterSoll — "ok" wird vereinfachend als "steigt"
  // gemeldet (bewusste Vereinfachung, siehe Bericht des coders).
  const progression = (kraftAmpelResults || []).slice(0, 12).map((r) => ({
    exercise: r.name,
    status: r.status === "unterSoll" ? "unterSoll" : r.status === "stagniert" ? "stagniert" : "steigt",
    detail: `${r.reps.split("/").length}× ${r.topKg} kg`,
  }));
  return { sessionsPlanned: kraftSessions.length, sessionsDone, progression };
}

// Wird erst ausgelöst, sobald Strava geladen ist, und nur, wenn es eine
// zurückliegende (nicht platzhaltergefüllte) Planwoche zu bilanzieren gibt.
async function fillWeeklyBilanz(iso, dayState, plan) {
  if (dayState !== "woche") return;
  try {
    await loadStrava();
    const weekNo = weekNumberFor(plan, iso);
    // I2: ein Strava-Abrufsfehler bei verbundenem Konto darf nicht als "0 km
    // gelaufen" in die Bilanz einfließen — ohne echte Strava-Daten gibt es
    // gar keine Wochenbilanz-Anfrage (verbraucht sonst eine Generation mit
    // einer falschen Bilanz).
    if (!coach.weeklyDue({ weekNo, hasStrava: stravaReady() })) return;

    const summarizedWeekNo = weekNo - 1;
    const summarizedWeek = weekOf(plan, summarizedWeekNo);
    if (!summarizedWeek || summarizedWeek.placeholder) return;

    const { logs, dps, ok } = await ensureAllLogsAndDayPlans();
    if (!ok) return; // kein verlässliches Bild der Woche -> lieber keine Bilanz als eine falsche
    const kraftResult = metrics.kraftProgression(metrics.kraftHistoryByExercise(logs, iso, THRESHOLDS.kraft.windowDays), THRESHOLDS);
    const belastungResult = metrics.belastung(stravaState.runs || [], iso, THRESHOLDS);
    const zone = plan.zones.find((z) => z.id === "z2");
    const aerobe = metrics.aerobeEffizienz(aerobeWeeklyData(plan, weekNo), zone);
    const adherence = adherence4wData(plan, iso, logs, dps);
    const currentWeek = weekOf(plan, weekNo);

    const input = coach.buildWeeklyInput({
      goal: plan.goal, week: summarizedWeekNo, weekType: summarizedWeek.weekType,
      phase: phaseOf(plan, summarizedWeekNo).name,
      run: weeklyRunData(plan, summarizedWeekNo),
      kraft: weeklyKraftData(plan, summarizedWeekNo, logs, dps, kraftResult.results),
      // K1: metrics.belastung() liefert bei ∞ jetzt ratio:null statt
      // Infinity (das würde der Worker als 400 ablehnen, siehe
      // docs/review-code-m2.md) — fürs Worker-Schema auf 9,99 kappen statt
      // auf 0, damit eine wirklich sehr hohe Belastung nicht als niedrig
      // ankommt.
      belastung: { ratio: belastungResult.ratio ?? 9.99, status: belastungResult.status },
      aerobeEffizienzTrend: aerobe.deltaText,
      // K1: metrics.adherence4w() liefert zusätzlich `pct` — das Worker-
      // Schema erlaubt nur done/planned, ein ungefiltertes Durchreichen
      // ließ die Wochenbilanz bisher IMMER mit 400 scheitern.
      adherence4w: { done: adherence.done, planned: adherence.planned },
      nextWeek: { n: weekNo, type: currentWeek?.weekType ?? "-", keySession: nextSessionLabel(plan, iso) },
    });
    const hash = await coach.hashInput(input);
    const key = `${plan.id}_W${summarizedWeekNo}`;
    const fallbackText = coach.fallbackWeekly(input);

    const result = await coach.requestCoach({
      hash,
      loadDoc: () => loadCoachWeek(key),
      saveDoc: (data) => saveCoachWeek(key, data),
      fetchWorker: () => fetch(COACH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      limit: THRESHOLDS.coach.weeklyLimit,
      model: COACH_MODEL,
      promptVersion: COACH_PROMPT_VERSION,
      fallbackText,
    });

    coachBilanzInfo = { weekN: summarizedWeekNo, text: result.text, expanded: dayNameDE(iso) === "Mo" };
    renderCoachSlot();
  } catch (err) {
    console.error(err);
  }
}

function renderDashboard() {
  const iso = todayISO();
  const dayState = planDayState(iso, plans);
  const plan = activePlanFor(iso, plans);
  paintDashboardHeader(iso, dayState, plan);
  paintDashboardMain(iso, dayState, plan);
}

// ---------- Rendering ----------
// Markierung in der Tableiste immer aus dem Zustand ableiten, nicht nur beim
// Tab-Klick: sonst zeigt sie nach internen Sprüngen den falschen Tab.
function syncTabbar() {
  document.querySelectorAll("#tabbar button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === state.tab));
}

function render() {
  if (!plans.length) return; // Plan lädt noch (siehe init()); nichts zu rendern
  syncTabbar();
  try {
    if (state.tab === "dashboard") {
      return state.selectedDate ? renderDay(state.selectedDate, { showBack: true, backLabel: "Dashboard" }) : renderDashboard();
    }
    if (state.tab === "woche") {
      return state.selectedDate ? renderDay(state.selectedDate, { showBack: true }) : renderWeek();
    }
    if (state.tab === "verlauf") return renderHistory();
    if (state.tab === "plan") return renderPlan();
  } catch (err) {
    console.error(err);
    header.innerHTML = `<h1>Fehler</h1>`;
    main.innerHTML = errorCard("Etwas ist schiefgelaufen: " + err.message);
  }
}

// ---------- Tagesansicht ----------
async function renderDay(iso, { showBack, backLabel }) {
  const info = dayInfo(iso);
  const plan = activePlanFor(iso, plans);
  const w = plan ? weekNumberFor(plan, iso) : null;
  const isToday = iso === todayISO();
  const label = backLabel ?? `Woche ${w}`;

  header.innerHTML = `
    <p class="eyebrow">${showBack ? `<button class="link-btn" data-action="back">${ICONS.back} ${esc(label)}</button> · ` : ""}${dayNameDE(iso)} · ${shortDate(iso)}${isToday ? " · heute" : ""}</p>
    <div class="title-row"><h1>${
      info.kind === "kraft" ? "Krafttraining"
      : info.kind === "lauf" ? "Lauf"
      : info.kind === "placeholder" ? `Woche ${w}`
      : info.kind === "bisZumRennen" ? "Bis zum Rennen"
      : info.kind === "keinPlan" ? "Kein aktiver Plan"
      : "Ruhetag"
    }</h1>${badgeForKind(info)}</div>`;

  if (info.kind !== "kraft") { editMode = false; replaceFor = null; quickAdd = false; }
  if (info.kind === "kraft") return renderKraftDay(info, iso);
  if (info.kind === "lauf") return renderRunDay(info, iso);
  if (info.kind === "placeholder") {
    main.innerHTML = `<div class="card"><p class="name">Details folgen</p>
      <p class="hint">${esc(info.focus || "")} — die genauen Werte tragen wir nach der Re-Kalibrierung nach.</p></div>`;
    return;
  }
  if (info.kind === "bisZumRennen") {
    main.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem 1rem;">
      <p class="name">Bis zum Rennen</p>
      <p class="hint">Der Plan endet vor dem Renntag — für diesen Tag gibt es keine Einheit mehr.</p></div>`;
    return;
  }
  if (info.kind === "keinPlan") {
    main.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem 1rem;">
      <p class="name">Kein aktiver Plan</p>
      <p class="hint">Für dieses Datum liegt kein Trainingsplan vor.</p></div>`;
    return;
  }
  main.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem 1rem;">
    <p class="name">Ruhetag</p><p class="hint">Mobility, Foam Rolling, Beine hoch.</p></div>`;
}

// ---------- Krafttag ----------
function setsCountFromSoll(soll) {
  const m = String(soll).match(/(\d+)\s*x/i);
  const n = m ? parseInt(m[1], 10) : 3;
  return Math.min(Math.max(n, 1), 8);
}

function numOrNull(v) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

function sameSets(sets) {
  if (!sets || sets.length < 2) return true;
  return sets.every((s) => s.kg === sets[0].kg && s.reps === sets[0].reps);
}

async function renderKraftDay(info, iso) {
  main.innerHTML = loadingCard("Lade gespeicherte Sätze …");

  let saved = {};
  let loadError = null;
  try {
    [saved, dayPlan, allLogs] = await Promise.all([
      loadLogsForDate(iso),
      loadDayPlan(iso),
      allLogs ? Promise.resolve(allLogs) : loadAllLogs(),
    ]);
  } catch (err) {
    console.error(err);
    dayPlan = { removed: [], added: [] };
    // Als Karte, nicht als Toast: die Meldung muss stehen bleiben, sonst
    // sieht man nur leere Felder und rät.
    loadError = err.source === "firebase" ? err.message : "Laden fehlgeschlagen: " + err.message;
  }

  currentKraftDay = { info, iso };
  buildLogState(effectiveExercises(info), saved);
  paintKraftDay(info, iso, loadError);
  fillSessionSlot(iso);
}

// Herzfrequenz und Dauer der Einheit aus Strava — ohne jede Eingabe.
// Über die einzelne Übung sagt das nichts, über die Einheit als Ganzes
// und ihren Verlauf über die Wochen schon.
async function fillSessionSlot(iso) {
  const slot = document.getElementById("session-slot");
  if (!slot) return;
  const s = await loadStrava();
  if (!slot.isConnected || s.error || !s.connected) return;
  const session = sessionForDate(iso);
  if (!session) return;
  slot.innerHTML = `<div class="card session-card">
    <div class="row" style="justify-content:space-between;">
      <p class="name">Einheit (Strava)</p>
      <span class="hint">${esc(formatDuration(session.movingTimeSec))}</span>
    </div>
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Ø HF</p><p class="metric-value" style="font-size:18px;">${session.avgHr ? session.avgHr + " bpm" : "–"}</p></div>
      <div><p class="metric-label">Max HF</p><p class="metric-value" style="font-size:18px;">${session.maxHr ? session.maxHr + " bpm" : "–"}</p></div>
    </div>
    ${session.effort != null ? `<p class="hint" style="margin-top:6px;">Relative Effort ${session.effort}</p>` : ""}
  </div>`;
}

// Plan-Übungen ohne die entfernten, plus die selbst hinzugefügten.
// Eine Ersetzung rückt an die Stelle der Übung, die sie ersetzt — sonst
// rutscht der Tausch ans Listenende und man sucht ihn.
function effectiveExercises(info) {
  const removed = new Set(dayPlan.removed);
  const replacements = new Map();
  for (const ex of dayPlan.added) if (ex.replaces) replacements.set(ex.replaces, ex);

  const out = [];
  for (const ex of info.exercises) {
    const sl = slug(ex.name);
    const rep = replacements.get(sl);
    if (rep) { out.push({ ...rep, custom: true }); continue; }
    if (removed.has(sl)) continue;
    out.push(ex);
  }
  for (const ex of dayPlan.added) if (!ex.replaces) out.push({ ...ex, custom: true });
  return out;
}

function buildLogState(exercises, saved) {
  logState.clear();
  for (const ex of exercises) {
    const s = slug(ex.name);
    const rec = saved[s];
    const count = setsCountFromSoll(ex.soll);
    const sets = rec?.sets?.length
      ? rec.sets.map((x) => ({ kg: x.kg ?? null, reps: x.reps ?? null }))
      : Array.from({ length: count }, () => ({ kg: null, reps: null }));
    logState.set(s, {
      slug: s, name: ex.name, soll: ex.soll, hint: ex.hint || "", custom: !!ex.custom,
      tip: progressionTip(s, ex.soll),
      setCount: Math.max(count, sets.length),
      sets,
      perSet: !sameSets(sets),
      saved: !!rec?.completed,
    });
  }
}

// Was die Zahlen vom letzten Mal für heute nahelegen — ersetzt die
// Frage nach dem Anstrengungsgrad.
function progressionTip(exSlug, soll) {
  if (!allLogs || !currentKraftDay.iso) return null;
  const history = allLogs.filter((l) => l.exercise === exSlug);
  return suggestProgression(soll, previousEntry(history, currentKraftDay.iso));
}

function paintKraftDay(info, iso, loadError) {
  const removedList = dayPlan.removed
    .map((sl) => info.exercises.find((ex) => slug(ex.name) === sl))
    .filter(Boolean);

  main.innerHTML =
    (loadError
      ? `<div class="card error-card">
           <p class="name">Gespeicherte Sätze nicht geladen</p>
           <p class="hint">${esc(loadError)}</p>
           <p class="hint" style="margin-top:6px;">Eintragen geht trotzdem — gespeichert wird aber erst, wenn das behoben ist.</p>
           <button data-action="reload" style="margin-top:8px;">Neu laden</button>
         </div>`
      : "") +
    `<div class="card summary-card">
       <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;">
         <div style="min-width:0;">
           <p class="name">${esc(info.label)}</p>
           <p class="hint" id="progress-line">${progressText()}</p>
         </div>
         <button class="small-btn" data-action="toggle-edit">${editMode ? "Fertig" : "Anpassen"}</button>
       </div>
     </div>` +
    `<div id="session-slot"></div>` +
    [...logState.values()].map(exerciseCard).join("") +
    (editMode ? "" : `<button class="add-inline" data-action="quick-add">+ Übung hinzufügen</button>`) +
    (quickAdd ? addFormHTML(iso) : "") +
    (editMode
      ? removedList.map((ex) => `<div class="card removed">
           <div class="row" style="justify-content:space-between;gap:10px;">
             <div style="min-width:0;"><p class="name">${esc(ex.name)}</p><p class="hint">Für diesen Tag entfernt</p></div>
             <button class="small-btn" data-action="restore-exercise" data-slug="${slug(ex.name)}">Zurückholen</button>
           </div></div>`).join("") +
        addFormHTML(iso)
      : "");
}

function addFormHTML(iso) {
  return `<div class="card">
    <p class="name">Übung hinzufügen</p>
    <p class="hint" style="margin-bottom:8px;">Gilt nur für diesen Tag (${shortDate(iso)}).</p>
    <div class="add-form">
      <input type="text" id="new-ex-name" placeholder="Name, z. B. Beinpresse" autocomplete="off" />
      <input type="text" id="new-ex-soll" placeholder="Soll, z. B. 3x8-10" autocomplete="off" />
      <div class="row" style="gap:8px;">
        <button class="save-btn" style="flex:1;" data-action="add-exercise">Hinzufügen</button>
        <button data-action="cancel-add">Abbrechen</button>
      </div>
    </div>
  </div>`;
}

function replaceFormHTML(st) {
  return `<div class="add-form">
    <p class="hint">Ersetzt ${esc(st.name)} an dieser Stelle.</p>
    <input type="text" id="rep-ex-name" placeholder="Neue Übung" value="" autocomplete="off" />
    <input type="text" id="rep-ex-soll" placeholder="Soll" value="${esc(st.soll)}" autocomplete="off" />
    <div class="row" style="gap:8px;">
      <button class="save-btn" style="flex:1;" data-action="confirm-replace" data-slug="${st.slug}">Übernehmen</button>
      <button data-action="cancel-replace">Abbrechen</button>
    </div>
  </div>`;
}

function progressText() {
  const total = logState.size;
  const done = [...logState.values()].filter((s) => s.saved).length;
  return `${done} von ${total} Übungen erfasst`;
}

function exerciseCard(st) {
  return `<div class="card${st.saved ? " done" : ""}" data-ex="${st.slug}">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;">
      <div style="min-width:0;">
        <p class="name">${esc(st.name)}${st.custom ? ' <span class="custom-tag">eigene</span>' : ""}</p>
        <p class="hint">Soll ${esc(st.soll)}${st.hint ? " · " + esc(st.hint) : ""}</p>
        ${st.tip ? `<p class="tip tip-${st.tip.level}">${esc(st.tip.text)}</p>` : ""}
      </div>
      ${editMode
        ? ""
        : `<button data-action="toggle-sets" data-slug="${st.slug}" class="small-btn">${st.perSet ? "Alle gleich" : "Sätze einzeln"}</button>`}
    </div>
    ${editMode && replaceFor !== st.slug
      ? `<div class="row edit-actions">
           <button class="small-btn" data-action="replace-exercise" data-slug="${st.slug}">Ersetzen</button>
           <button class="small-btn danger-btn" data-action="remove-exercise" data-slug="${st.slug}">Entfernen</button>
         </div>`
      : ""}
    <div class="ex-body">${
      replaceFor === st.slug ? replaceFormHTML(st) : st.perSet ? perSetRowsHTML(st) : simpleRowHTML(st)
    }</div>
    <p class="hint status" data-status="${st.slug}"></p>
  </div>`;
}

function saveButtonHTML(st, wide) {
  const label = st.saved ? "Gespeichert" : "Speichern";
  return `<button class="save-btn${wide ? " wide" : ""}${st.saved ? " is-saved" : ""}"
    data-action="save" data-slug="${st.slug}" aria-label="${label}">${ICONS.check}<span>${label}</span></button>`;
}

function simpleRowHTML(st) {
  const kg = st.sets[0]?.kg ?? "";
  const reps = st.sets[0]?.reps ?? "";
  return `<div class="row">
    <input type="number" inputmode="decimal" step="0.5" data-kg value="${kg}" placeholder="kg" aria-label="Gewicht" />
    <span class="times">×</span>
    <input type="number" inputmode="numeric" data-reps value="${reps}" placeholder="Wdh" aria-label="Wiederholungen" />
  </div>
  <p class="hint tiny">Gilt für alle ${st.setCount} Sätze</p>
  ${saveButtonHTML(st, true)}`;
}

function perSetRowsHTML(st) {
  let rows = "";
  for (let s = 0; s < st.setCount; s++) {
    const kg = st.sets[s]?.kg ?? "";
    const reps = st.sets[s]?.reps ?? "";
    rows += `<div class="set-row">
      <span class="set-label">Satz ${s + 1}</span>
      <input type="number" inputmode="decimal" step="0.5" data-kg value="${kg}" placeholder="kg" aria-label="Gewicht Satz ${s + 1}" />
      <input type="number" inputmode="numeric" data-reps value="${reps}" placeholder="Wdh" aria-label="Wiederholungen Satz ${s + 1}" />
    </div>`;
  }
  return rows + saveButtonHTML(st, true);
}

// Liest die aktuell sichtbaren Eingaben in den State zurück
function readCard(st) {
  const card = document.querySelector(`[data-ex="${st.slug}"]`);
  if (!card) return;
  // Zeigt die Karte gerade die Ersetzen-Maske, gibt es keine Eingabefelder
  if (!card.querySelector("[data-kg]")) return;
  if (st.perSet) {
    st.sets = [...card.querySelectorAll(".set-row")].map((row) => ({
      kg: numOrNull(row.querySelector("[data-kg]").value),
      reps: numOrNull(row.querySelector("[data-reps]").value),
    }));
  } else {
    const kg = numOrNull(card.querySelector("[data-kg]").value);
    const reps = numOrNull(card.querySelector("[data-reps]").value);
    st.sets = Array.from({ length: st.setCount }, () => ({ kg, reps }));
  }
}

function readAllCards() {
  for (const st of logState.values()) readCard(st);
}

function toggleSets(slugName) {
  const st = logState.get(slugName);
  if (!st) return;
  readCard(st);
  st.perSet = !st.perSet;
  const card = document.querySelector(`[data-ex="${slugName}"]`);
  card.querySelector(".ex-body").innerHTML = st.perSet ? perSetRowsHTML(st) : simpleRowHTML(st);
  card.querySelector("[data-action='toggle-sets']").textContent = st.perSet ? "Alle gleich" : "Sätze einzeln";
}

// --- Übungen anpassen ---
function toggleEditMode() {
  readAllCards();
  editMode = !editMode;
  replaceFor = null;
  quickAdd = false;
  paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null);
}

function persistDayPlan() {
  saveDayPlan(currentKraftDay.iso, dayPlan).catch((err) => {
    console.error(err);
    toast("Änderung an den Übungen nicht gespeichert: " + err.message, true);
  });
}

function removeExercise(slugName) {
  readAllCards();
  const st = logState.get(slugName);
  if (st?.custom) {
    const entry = dayPlan.added.find((ex) => slug(ex.name) === slugName);
    dayPlan.added = dayPlan.added.filter((ex) => slug(ex.name) !== slugName);
    // War es ein Tausch, soll die ursprüngliche Übung zurückkommen
    if (entry?.replaces) dayPlan.removed = dayPlan.removed.filter((x) => x !== entry.replaces);
  } else if (!dayPlan.removed.includes(slugName)) {
    dayPlan.removed.push(slugName);
  }
  refreshExercises();
}

function restoreExercise(slugName) {
  readAllCards();
  dayPlan.removed = dayPlan.removed.filter((s) => s !== slugName);
  refreshExercises();
}

function addExercise(replaces = null) {
  const nameEl = document.getElementById(replaces ? "rep-ex-name" : "new-ex-name");
  const sollEl = document.getElementById(replaces ? "rep-ex-soll" : "new-ex-soll");
  const name = (nameEl?.value || "").trim();
  const soll = (sollEl?.value || "").trim() || "3x8-10";
  if (!name) {
    nameEl?.focus();
    toast("Bitte einen Namen eintragen.", true);
    return;
  }
  const s = slug(name);
  if (!s) {
    toast("Der Name ergibt keine gültige Übung.", true);
    return;
  }
  if (logState.has(s)) {
    toast("Diese Übung steht heute schon auf der Liste.", true);
    return;
  }
  readAllCards();
  if (replaces) {
    // Tausch: die ersetzte Übung verschwindet, die neue rückt an ihre Stelle
    dayPlan.added = dayPlan.added.filter((ex) => ex.replaces !== replaces);
    dayPlan.added.push({ name, soll, hint: "Ersetzt " + (logState.get(replaces)?.name || replaces), replaces });
    if (!dayPlan.removed.includes(replaces)) dayPlan.removed.push(replaces);
  } else if (dayPlan.removed.includes(s)) {
    // Falls die Übung nur „entfernt" war: einfach wieder aufnehmen
    dayPlan.removed = dayPlan.removed.filter((x) => x !== s);
  } else {
    dayPlan.added.push({ name, soll, hint: "Eigene Übung" });
  }
  replaceFor = null;
  quickAdd = false;
  refreshExercises();
}

// Zustand der sichtbaren Eingaben behalten, Liste neu aufbauen
function refreshExercises() {
  const keep = {};
  for (const st of logState.values()) {
    keep[st.slug] = { sets: st.sets, completed: st.saved };
  }
  buildLogState(effectiveExercises(currentKraftDay.info), keep);
  persistDayPlan();
  paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null);
}

function saveExercise(slugName, dateISO) {
  const st = logState.get(slugName);
  if (!st) return;
  readCard(st);

  const hasInput = st.sets.some((s) => s.kg !== null || s.reps !== null);
  const status = document.querySelector(`[data-status="${slugName}"]`);
  if (!hasInput) {
    status.textContent = "Nichts eingetragen.";
    status.className = "hint status warn";
    return;
  }

  // Woche immer aus Datum + Plan ableiten (F0a Punkt 6). Kraft-Log-Einträge
  // gibt es nur an Krafttagen einer ausformulierten Woche, deshalb ist hier
  // immer ein Plan aktiv — die Woche wird trotzdem nie als null geschrieben
  // (Lücke aus dem Architektur-Review, explizit abgesichert).
  const planForDate = activePlanFor(dateISO, plans);
  const week = planForDate ? weekNumberFor(planForDate, dateISO) : null;
  if (week == null) console.error("Kein Plan/keine Woche für Kraft-Log am " + dateISO + " — sollte nicht vorkommen.");

  const payload = {
    ...(week != null ? { week } : {}),
    name: st.name,
    soll: st.soll,
    custom: st.custom,
    sets: st.sets.map((s) => ({ kg: s.kg, reps: s.reps })),
    topKg: Math.max(...st.sets.map((s) => s.kg ?? 0)),
    totalReps: st.sets.reduce((a, s) => a + (s.reps ?? 0), 0),
    completed: true,
  };

  // Optimistisch bestätigen: mit Offline-Cache landet der Schreibvorgang
  // lokal und wird später synchronisiert — das Promise löst dann erst
  // beim Sync auf, darauf wollen wir im Gym nicht warten.
  st.saved = true;
  status.textContent = "Gespeichert.";
  status.className = "hint status ok";
  const card = document.querySelector(`[data-ex="${slugName}"]`);
  card?.classList.add("done");
  const btn = card?.querySelector("[data-action='save']");
  if (btn) {
    btn.classList.add("is-saved");
    btn.querySelector("span").textContent = "Gespeichert";
  }
  const line = document.getElementById("progress-line");
  if (line) line.textContent = progressText();

  saveLog(dateISO, slugName, payload).catch((err) => {
    console.error(err);
    st.saved = false;
    status.textContent = "Speichern fehlgeschlagen: " + err.message;
    status.className = "hint status warn";
    card?.classList.remove("done");
    btn?.classList.remove("is-saved");
    if (btn) btn.querySelector("span").textContent = "Speichern";
  });
}

// ---------- Lauftag ----------
// I3: paintDashboardMain startet fünf fill*-Funktionen, und jede ruft
// loadStrava() auf. Der Wächter oben (stravaState.connected !== null) greift
// erst, wenn der ERSTE Aufruf fertig ist — ohne das Promise hier zu merken,
// laufen alle fünf parallel los (5× /athlete/activities, bei abgelaufenem
// Token zusätzlich 5× /refresh mit demselben Refresh-Token). force-Aufrufe
// (z. B. "Aktualisieren") laufen bewusst nicht durch den Cache.
let stravaLoading = null;
async function loadStrava({ force = false } = {}) {
  if (!force && stravaState.connected !== null) return stravaState;
  if (!force && stravaLoading) return stravaLoading;

  const run = async () => {
    stravaState.error = null;
    stravaState.errorSource = null;
    try {
      const connected = await isAuthorized();
      stravaState.connected = connected;
      stravaState.runs = connected ? await fetchRecentRuns(STRAVA_SINCE, { force }) : null;
      if (connected) {
        runLinks = await loadRunLinks();
        recomputeAssignment();
      }
    } catch (err) {
      console.error(err);
      stravaState.error = err.message;
      // Ein Firestore-Fehler ist kein Strava-Fehler — sonst sucht man an
      // der falschen Stelle.
      stravaState.errorSource = err.source === "firebase" ? "firebase" : "strava";
      stravaState.runs = null;
      if (stravaState.errorSource === "firebase") stravaState.connected = null;
    }
    return stravaState;
  };

  const promise = run();
  if (!force) stravaLoading = promise;
  try {
    return await promise;
  } finally {
    if (stravaLoading === promise) stravaLoading = null;
  }
}

// Alle Lauftage aller geladenen Pläne — Grundlage der Zuordnung
function allPlanRunDays() {
  const out = [];
  for (const plan of plans) {
    for (const week of plan.weeks) {
      if (week.placeholder) continue;
      for (const s of week.sessions.filter((x) => x.kind === "lauf")) {
        out.push({ date: s.date, distKm: s.km });
      }
    }
  }
  return out;
}

function recomputeAssignment() {
  runAssignment = assignRuns(allPlanRunDays(), stravaState.runs || [], runLinks);
}

function setRunLink(planDate, activityId) {
  runLinks[planDate] = { activityId };
  recomputeAssignment();
  runPickerFor = null;
  render();
  saveRunLink(planDate, activityId).catch((err) => {
    console.error(err);
    toast("Zuordnung nicht gespeichert: " + err.message, true);
  });
}

function resetRunLink(planDate) {
  delete runLinks[planDate];
  recomputeAssignment();
  runPickerFor = null;
  render();
  clearRunLink(planDate).catch((err) => {
    console.error(err);
    toast("Zuordnung nicht zurückgesetzt: " + err.message, true);
  });
}

async function renderRunDay(info, iso) {
  main.innerHTML =
    planRunCard(info) +
    `<div id="strava-slot">${loadingCard("Strava wird geprüft …")}</div>` +
    `<div class="strava-note">${ICONS.run}<p>${esc(info.note || "Wird nicht hier eingetragen — die Daten kommen automatisch aus Strava.")}</p></div>`;

  const slot = document.getElementById("strava-slot");
  const s = await loadStrava();
  if (!slot.isConnected) return; // Nutzer hat inzwischen weitergeklickt
  slot.innerHTML = stravaResultHTML(s, iso);
}

function planRunCard(info) {
  return `<div class="card" style="background:var(--coral-bg);">
    <p class="name" style="color:var(--coral-fg);">${esc(info.type)}</p>
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Ziel-Distanz</p><p class="metric-value" style="color:var(--coral-fg);">${esc(info.dist)}</p></div>
      <div><p class="metric-label">Ziel-Pace</p><p class="metric-value" style="font-size:16px;">${esc(info.pace)}</p></div>
    </div>
    <p class="hint" style="margin-top:8px;">HF-Zone ${esc(info.hf)}</p>
  </div>`;
}

// Getrennte Karten für die beiden Fehlerwelten: an Firestore-Problemen
// hilft "Neu verbinden" nicht, und der Hinweis muss auf Firebase zeigen.
function problemCard(s) {
  if (s.errorSource === "firebase") {
    return `<div class="card error-card">
      <p class="name">Daten-Problem (Firebase)</p>
      <p class="hint">${esc(s.error)}</p>
      <p class="hint" style="margin-top:6px;">Nicht Strava, sondern der Datenspeicher. Prüfe in der Firebase-Console, ob die Anmeldeart <b>Anonymous</b> aktiviert und die Regeln aus <code>firestore.rules</code> veröffentlicht sind.</p>
      <button data-action="reload-strava" style="margin-top:8px;">Nochmal versuchen</button></div>`;
  }
  return `<div class="card error-card"><p class="name">Strava-Problem</p>
    <p class="hint">${esc(s.error)}</p>
    <div class="row" style="margin-top:8px;gap:8px;">
      <button data-action="reload-strava">Nochmal versuchen</button>
      <button data-action="connect-strava">Neu verbinden</button>
    </div></div>`;
}

function stravaResultHTML(s, iso) {
  if (!isWorkerConfigured) {
    return `<div class="card error-card">
      <p class="name">Strava noch nicht eingerichtet</p>
      <p class="hint">Der Token-Worker fehlt (siehe README, Abschnitt „Strava"). Ohne ihn kann der Browser sich nicht bei Strava anmelden.</p></div>`;
  }
  if (s.error) return problemCard(s);
  if (s.connected === false) {
    return `<button class="primary-btn" data-action="connect-strava" style="margin-top:10px;">Mit Strava verbinden</button>`;
  }

  const a = runAssignment[iso];
  const picker = runPickerFor === iso ? runPickerHTML(s, iso) : "";

  if (!a || !a.run) {
    return `<div class="card">
        <p class="name">Noch kein Lauf zugeordnet</p>
        <p class="hint">${a?.source === "ignored"
          ? "Für diesen Tag ist bewusst kein Lauf hinterlegt."
          : "In Strava liegt kein Lauf an diesem Tag und keiner in den Tagen danach."}</p>
        <div class="row" style="margin-top:8px;gap:8px;">
          <button data-action="pick-run" data-date="${iso}">Lauf zuordnen</button>
          ${a?.source === "ignored" ? `<button data-action="reset-run" data-date="${iso}">Automatik zurück</button>` : ""}
          <button class="icon-btn" data-action="reload-strava" aria-label="Neu laden">${ICONS.refresh}</button>
        </div>
      </div>${picker}`;
  }

  const m = a.run;
  const shifted = a.offset !== 0;
  return `<div class="card${shifted ? " shifted" : ""}" style="margin-top:10px;">
    <div class="row" style="justify-content:space-between;">
      <p class="name">Erfasst (Strava)</p>
      <button class="icon-btn" data-action="reload-strava" aria-label="Neu laden">${ICONS.refresh}</button>
    </div>
    <p class="hint">${esc(m.name)}</p>
    ${shifted
      ? `<p class="shift-note">${dayNameDE(m.date)}, ${shortDate(m.date)} · ${esc(offsetLabel(a.offset))}</p>`
      : ""}
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Distanz</p><p class="metric-value">${m.distanceKm.toFixed(1)} km</p></div>
      <div><p class="metric-label">Pace</p><p class="metric-value" style="font-size:18px;">${esc(m.paceLabel)}</p></div>
      <div><p class="metric-label">Dauer</p><p class="metric-value" style="font-size:18px;">${esc(formatDuration(m.movingTimeSec))}</p></div>
      <div><p class="metric-label">Ø HF</p><p class="metric-value" style="font-size:18px;">${m.avgHr ? m.avgHr + " bpm" : "–"}</p></div>
    </div>
    <div class="row" style="margin-top:10px;gap:8px;">
      ${a.source === "auto"
        ? `<button class="small-btn" data-action="ignore-run" data-date="${iso}">Passt nicht</button>` : ""}
      ${a.source === "manual"
        ? `<button class="small-btn" data-action="reset-run" data-date="${iso}">Zuordnung aufheben</button>` : ""}
      <button class="small-btn" data-action="pick-run" data-date="${iso}">Anderen Lauf</button>
    </div>
  </div>${picker}`;
}

function runPickerHTML(s, iso) {
  const options = pickableRuns(s.runs || [], runAssignment, iso);
  if (!options.length) {
    return `<div class="card">
      <p class="name">Kein Lauf zur Auswahl</p>
      <p class="hint">In Strava liegt im Umkreis von sieben Tagen kein freier Lauf.</p>
      <button data-action="close-picker" style="margin-top:8px;">Schließen</button></div>`;
  }
  const current = runAssignment[iso]?.run?.id;
  return `<div class="card">
    <div class="row" style="justify-content:space-between;">
      <p class="name">Lauf für ${dayNameDE(iso)}, ${shortDate(iso)}</p>
      <button class="small-btn" data-action="close-picker">Schließen</button>
    </div>
    ${options.map((r) => {
      const off = daysBetween(iso, r.date);
      return `<button class="pick-row${String(r.id) === String(current) ? " on" : ""}"
          data-action="assign-run" data-date="${iso}" data-run="${r.id}">
        <span class="pick-main">${dayNameDE(r.date)}, ${shortDate(r.date)}${off ? ` · ${off > 0 ? "+" : ""}${off} ${Math.abs(off) === 1 ? "Tag" : "Tage"}` : " · am Plantag"}</span>
        <span class="pick-sub">${esc(r.name)} · ${r.distanceKm.toFixed(1)} km · ${esc(r.paceLabel)}</span>
      </button>`;
    }).join("")}
    <button data-action="ignore-run" data-date="${iso}" style="width:100%;margin-top:8px;">Kein Lauf an diesem Tag</button>
  </div>`;
}

// ---------- Woche ----------
// Der Wochen-Tab bleibt in Schritt 1 unverändert und arbeitet deshalb auf
// dem (einzigen) Plan der Registry — Mehrplan-Unterstützung für diesen Tab
// ist Teil von M2/Schritt 2, nicht von M1.
// Baut die Zeile eines aktiven Tags (Kraft/Lauf) für die neue
// Wochen-Tab-Tagesliste (F9, M2-7): Status-Symbol nach Priorität
// Zukunft > Heute > Vergangenheit, Ist/Ziel-Zeile, Nachgeholt-Hinweis.
function buildWeekDayRow(plan, iso, today, logs, dps) {
  const info = sessionOn(plan, iso);
  const d = dayNameDE(iso);
  const dt = shortDate(iso);
  if (info.kind === "ruhe") return { isRest: true, d, dt };

  const isToday = iso === today;
  const isFuture = iso > today;
  const kindColorVar =
    info.kind === "kraft" ? "var(--teal-fg)"
    : info.kind === "lauf" ? (info.shortType === "Long" ? "var(--purple-fg)" : "var(--coral-fg)")
    : "var(--text-muted)";

  if (info.kind === "kraft") {
    const { exercises, withLogs, done, total } = kraftProgressOn(info, dps[iso], logs);

    let statusHTML;
    if (isFuture) statusHTML = dashWeek.statusFutureHTML();
    else if (total > 0 && done === total) statusHTML = dashWeek.statusCheckHTML();
    else if (done > 0) statusHTML = dashWeek.statusPartialHTML(done, total, isToday);
    else if (isToday) statusHTML = dashWeek.statusTodayHTML();
    else statusHTML = dashWeek.statusMissedHTML();

    // Details: Übungsliste mit dem, was geloggt wurde
    const detailLines = [{ label: "Ziel:", text: `${total} Übungen` }];
    for (const { ex, log } of withLogs) {
      const value = !log ? "–"
        : log.topKg > 0 ? `${log.topKg} kg · ${log.totalReps ?? 0} Wdh`
        : `${log.totalReps ?? 0} Wdh`;
      detailLines.push({ label: ex.name + ":", text: value });
    }
    if (!isFuture && !isToday && done === 0) detailLines.push({ cls: "danger-text", text: "Nicht geloggt, zählt als verpasst." });
    else if (!isFuture && !isToday && done < total) detailLines.push({ cls: "warn-text", text: `Teilweise geloggt (${done}/${total}).` });

    return {
      isRest: false, iso, d, dt, isToday, kindColorVar,
      sessionName: info.label,
      targetText: `${total} Übungen`,
      hasActual: done > 0,
      actualText: `${done}/${total} geloggt`,
      statusHTML,
      detailLines,
    };
  }

  // Lauf
  const a = runAssignment[iso];
  const run = a?.run;
  let statusHTML;
  if (isFuture) statusHTML = dashWeek.statusFutureHTML();
  else if (!run) statusHTML = isToday ? dashWeek.statusTodayHTML() : dashWeek.statusMissedHTML();
  else if (run.avgHr != null && run.avgHr > info.hfMax) statusHTML = dashWeek.statusWarnHTML();
  else statusHTML = isToday ? dashWeek.statusTodayHTML() : dashWeek.statusCheckHTML();

  const actualText = run
    ? `${run.distanceKm.toFixed(1)} km · ${run.paceLabel}${a.offset !== 0 ? " (nachgeholt)" : ""}`
    : "";

  const detailLines = [{ label: "Ziel:", text: `${info.dist} · ${info.pace} · HF ${info.hf}` }];
  if (run) {
    detailLines.push({ label: "Ist:", text: `${run.distanceKm.toFixed(1)} km · ${run.paceLabel}${run.avgHr ? ` · Ø ${run.avgHr} bpm` : ""}` });
    if (run.avgHr != null && run.avgHr > info.hfMax) {
      detailLines.push({ cls: "warn-text", text: `Zu schnell: Ø ${run.avgHr} bpm über der Obergrenze von ${info.hfMax}.` });
    }
    if (a.offset !== 0) detailLines.push({ text: `${dayNameDE(run.date)}, ${shortDate(run.date)}: ${offsetLabel(a.offset)}` });
  } else if (!isFuture && !isToday) {
    detailLines.push({ cls: "danger-text", text: "Kein Lauf zugeordnet, zählt als verpasst." });
  }

  return {
    isRest: false, iso, d, dt, isToday, kindColorVar,
    sessionName: info.type,
    targetText: `${info.dist} · ${info.pace}`,
    hasActual: !!run,
    actualText,
    statusHTML,
    detailLines,
  };
}

async function renderWeek() {
  const plan = plans[0];
  const w = state.weekNo;
  const week = weekOf(plan, w);
  const isCurrent = w === weekNoForTab(todayISO());
  const start = weekStart(plan, w);

  header.innerHTML = dashWeek.weekNavHTML({
    n: w,
    weekType: week.weekType,
    dateRange: `${shortDate(start)}–${shortDate(addDays(start, 6))}`,
    hasPrev: w > 1,
    hasNext: w < plan.totalWeeks,
    showToday: !isCurrent,
  });

  if (week.placeholder) {
    const phase = phaseOf(plan, w);
    main.innerHTML = `<div class="card"><p class="name">${esc(phase.name)}</p>
      <p class="hint">${esc(week.focus)}. Details folgen nach der Re-Kalibrierung.</p></div>`;
    return;
  }

  main.innerHTML = loadingCard("Woche wird geladen …");
  // Ein Firestore-/Strava-Ausfall darf die Wochenliste nicht leer lassen
  // (analog zum Dashboard, F7-Prinzip): mit leeren Daten weiterrendern statt
  // die Ansicht dauerhaft bei "Woche wird geladen …" hängen zu lassen — die
  // einzelnen Tage führen trotzdem in die Tagesansicht, die ihre eigenen
  // Fehlerkarten zeigt (z. B. #strava-slot).
  let logs = [], dps = {};
  try {
    await loadStrava();
    ({ logs, dps } = await ensureAllLogsAndDayPlans());
  } catch (err) {
    console.error(err);
  }
  // Zwischenzeitlich weitergeklickt (anderer Tab/andere Woche)? Dann nicht
  // mehr in die falsche Ansicht schreiben.
  if (state.tab !== "woche" || state.selectedDate || state.weekNo !== w) return;

  const today = todayISO();
  const days = weekDates(plan, w).map((iso) => buildWeekDayRow(plan, iso, today, logs, dps));

  const laufSessions = week.sessions.filter((s) => s.kind === "lauf");
  const sollKm = laufSessions.reduce((a, s) => a + s.km, 0);
  const istKm = laufSessions.reduce((a, s) => a + (runAssignment[s.date]?.run?.distanceKm || 0), 0);
  const kraftSessions = week.sessions.filter((s) => s.kind === "kraft");
  const kraftDone = kraftSessions.filter((s) => kraftProgressOn(s, dps[s.date], logs).complete).length;

  // F9/E7: Ist heute außerhalb der Planwochen (Rennlücke oder danach), gilt
  // die letzte Planwoche als Endpunkt — dort erscheint der Hinweis.
  const todayState = planDayState(today, plans);
  const planIsOver = todayState === "bisZumRennen" || (todayState === "keinPlan" && today > plan.start);

  main.innerHTML =
    dashWeek.weekSummaryHTML({
      ist: Math.round(istKm * 10) / 10,
      soll: sollKm,
      pct: sollKm > 0 ? Math.min(100, Math.round((istKm / sollKm) * 100)) : 0,
      kraftDone,
      kraftPlanned: kraftSessions.length,
    }) +
    days.map((d) => (d.isRest ? dashWeek.restRowHTML(d.d, d.dt) : dashWeek.dayRowHTML(d))).join("") +
    (planIsOver && w === plan.totalWeeks ? dashWeek.planBeendetHintHTML(plan.totalWeeks) : "");
}

// ---------- Verlauf ----------
async function renderHistory() {
  const m = state.historyMode;
  header.innerHTML = `<div class="title-row"><h1>Verlauf</h1>
    <div class="seg">
      <button data-action="hist-mode" data-mode="kraft" class="${m === "kraft" ? "on" : ""}">Kraft</button>
      <button data-action="hist-mode" data-mode="lauf" class="${m === "lauf" ? "on" : ""}">Lauf</button>
    </div></div>`;
  main.innerHTML = loadingCard();
  if (m === "kraft") await renderKraftHistory();
  else await renderRunHistory();
}

async function renderKraftHistory() {
  const options = exerciseCatalog(plans[0])
    .map((e) => `<option value="${slug(e.name)}" ${slug(e.name) === state.historyExercise ? "selected" : ""}>${esc(e.name)}</option>`)
    .join("");

  let logs = [];
  try {
    logs = await loadLogsForExercise(state.historyExercise);
  } catch (err) {
    main.innerHTML = errorCard("Verlauf konnte nicht geladen werden: " + err.message);
    return;
  }

  const points = logs
    .map((l) => {
      const sets = l.sets || [];
      const topKg = l.topKg ?? Math.max(0, ...sets.map((s) => s.kg ?? 0));
      const totalReps = l.totalReps ?? sets.reduce((a, s) => a + (s.reps ?? 0), 0);
      return { date: l.date, topKg, totalReps };
    })
    .filter((p) => p.topKg > 0 || p.totalReps > 0)
    .slice(-10);

  const usesWeight = points.some((p) => p.topKg > 0);
  const valueOf = (p) => (usesWeight ? p.topKg : p.totalReps);
  const unit = usesWeight ? "kg" : "Wdh";

  const picker = `<select id="ex-picker" aria-label="Übung wählen">${options}</select>`;

  if (!points.length) {
    main.innerHTML = `${picker}<p class="center-note">Noch nichts erfasst für diese Übung.</p>`;
    wirePicker();
    return;
  }

  main.innerHTML = `${picker}
    <div class="card">
      <p class="name">${usesWeight ? "Bestes Satzgewicht" : "Wiederholungen gesamt"}</p>
      <p class="hint">Letzte ${points.length} Einheiten</p>
      ${barsHTML(points.map((p) => ({ value: valueOf(p), label: shortDate(p.date), value_label: `${valueOf(p)} ${unit}` })), "var(--teal-fg)")}
    </div>
    <div class="card">
      <p class="name">Einträge</p>
      ${points.slice().reverse().map((p) => `<div class="row list-row"><span>${shortDate(p.date)}</span>
        <span style="color:var(--text-secondary)">${p.topKg > 0 ? p.topKg + " kg" : "–"} · ${p.totalReps} Wdh</span></div>`).join("")}
    </div>`;
  wirePicker();
}

function wirePicker() {
  const sel = document.getElementById("ex-picker");
  if (!sel) return;
  sel.addEventListener("change", () => {
    state.historyExercise = sel.value;
    renderHistory();
  });
}

async function renderRunHistory() {
  const s = await loadStrava();

  if (!isWorkerConfigured) {
    main.innerHTML = `<div class="card error-card"><p class="name">Strava noch nicht eingerichtet</p>
      <p class="hint">Siehe README, Abschnitt „Strava".</p></div>`;
    return;
  }
  if (s.error) {
    main.innerHTML = errorCard(s.error);
    return;
  }
  if (s.connected === false) {
    main.innerHTML = `<button class="primary-btn" data-action="connect-strava">Mit Strava verbinden</button>`;
    return;
  }
  const runs = s.runs || [];
  if (!runs.length) {
    main.innerHTML = `<p class="center-note">Noch keine Läufe seit ${shortDate(STRAVA_SINCE)} in Strava.</p>`;
    return;
  }

  const last = runs.slice(-10);
  const km7 = sumKm(runs, 7);
  const km28 = sumKm(runs, 28);
  const withPace = last.filter((r) => r.paceSecPerKm);
  const avgPace = withPace.length
    ? withPace.reduce((a, r) => a + r.paceSecPerKm, 0) / withPace.length
    : null;

  main.innerHTML = `
    <div class="card">
      <div class="metric-grid">
        <div><p class="metric-label">Letzte 7 Tage</p><p class="metric-value">${km7.toFixed(1)} km</p></div>
        <div><p class="metric-label">Letzte 28 Tage</p><p class="metric-value">${km28.toFixed(1)} km</p></div>
        <div><p class="metric-label">Ø Pace (${withPace.length} ${withPace.length === 1 ? "Lauf" : "Läufe"})</p><p class="metric-value" style="font-size:18px;">${esc(formatPace(avgPace))}</p></div>
        <div><p class="metric-label">Läufe gesamt</p><p class="metric-value">${runs.length}</p></div>
      </div>
    </div>
    <div class="card">
      <p class="name">Distanz je Lauf</p>
      <p class="hint">Label = Pace</p>
      ${barsHTML(last.map((r) => ({ value: r.distanceKm, label: esc(r.paceLabel.replace(" /km", "")), value_label: r.distanceKm.toFixed(1) + " km" })), "var(--coral-fg)")}
    </div>
    <div class="card">
      <p class="name">Läufe</p>
      ${last.slice().reverse().map((r) => `<div class="row list-row"><span>${shortDate(r.date)} ${esc(r.name)}</span>
        <span style="color:var(--text-secondary)">${r.distanceKm.toFixed(1)} km · ${esc(r.paceLabel)}</span></div>`).join("")}
    </div>`;
}

function sumKm(runs, days) {
  const today = todayISO();
  const cutoff = addDays(today, -days + 1);
  // Obergrenze heute: ein Lauf mit Datum in der Zukunft (Zeitzone, manuell
  // in Strava nachgetragen) gehört nicht in „die letzten 7 Tage".
  return runs.filter((r) => r.date >= cutoff && r.date <= today).reduce((a, r) => a + r.distanceKm, 0);
}

// Balken mit echten Höhen — Werte werden auf 8..90 px abgebildet.
function barsHTML(points, color) {
  const max = Math.max(...points.map((p) => p.value), 0);
  if (max <= 0) return `<p class="center-note">Keine Werte.</p>`;
  return `<div class="bars">
    ${points.map((p) => {
      const h = Math.max(8, Math.round((p.value / max) * 90));
      return `<div class="bar-col" title="${esc(p.value_label)}">
        <span class="bar-value">${esc(p.value_label)}</span>
        <div class="bar" style="height:${h}px;background:${color}"></div>
        <span class="bar-label">${p.label}</span>
      </div>`;
    }).join("")}
  </div>`;
}

// ---------- Plan ----------
// Wie beim Wochen-Tab: der Plan-Tab bleibt in Schritt 1 unverändert und
// zeigt deshalb den (einzigen) Plan der Registry.
function renderPlan() {
  const plan = plans[0];
  const today = todayISO();
  // Heute liegt praktisch immer in einer Planwoche; außerhalb (I3: vor dem
  // Start Woche 1/0%, nach der letzten Planwoche "fertig") stürzt der
  // Fortschrittsbalken trotzdem nicht ab.
  const w = weekNumberFor(plan, today) ?? (today < plan.start ? 1 : plan.totalWeeks);
  const done = Math.max(0, w - 1);
  const pct = Math.round((done / plan.totalWeeks) * 100);
  const displayGoal = formatGoal(plan.goal);

  header.innerHTML = `<h1>Trainingsplan</h1>
    <p class="eyebrow" style="margin-top:2px;">Woche ${w} von ${plan.totalWeeks} · ${pct}% geschafft</p>`;

  main.innerHTML = `
    <div class="card goal-card">
      <p class="metric-label">Ziel</p>
      <p class="goal-time">${esc(displayGoal.time)}</p>
      <p class="hint" style="margin-top:4px;">${esc(displayGoal.race)} · Renntempo ${esc(plan.goal.targetPace)}</p>
      <div class="timeline">
        ${plan.phases.map((p) => {
          const len = p.weeks.to - p.weeks.from + 1;
          // Anteil dieser Phase, der schon hinter dir liegt
          const fill = w > p.weeks.to ? 100 : w < p.weeks.from ? 0 : ((w - p.weeks.from + 1) / len) * 100;
          return `<div class="seg tone-${p.tone}" style="flex:${len}" title="Phase ${p.n}"><i style="width:${fill}%"></i></div>`;
        }).join("")}
      </div>
      <div class="timeline-marker"><span>${shortDate(plan.start)}</span><span>Wettkampf</span></div>
      <div class="timeline-legend">
        ${plan.phases.map((p) => `<span class="tone-${p.tone}"><i></i>${esc(p.name)}</span>`).join("")}
      </div>
    </div>

    ${plan.phases.map((p) => {
      const current = w >= p.weeks.from && w <= p.weeks.to;
      return `<div class="phase-card tone-${p.tone}${current ? " is-current" : ""}">
        <div class="phase-head">
          <p class="name">Phase ${p.n} – ${esc(p.name)}</p>
          <span class="phase-weeks">W${p.weeks.from}–${p.weeks.to}</span>
        </div>
        <p class="hint" style="margin-top:2px;">${esc(phaseRange(plan, p))}</p>
        <p class="hint" style="margin-top:4px;">${esc(p.focus)}${current ? " · läuft gerade" : ""}</p>
      </div>`;
    }).join("")}

    <div class="card">
      <p class="name">Trainingsbereiche</p>
      ${plan.zones.map((z) => {
        const [tag, label] = z.zone.split(" – ");
        return `<div class="zone-line tone-${z.tone}">
          <span class="zone-chip">${esc(tag)}</span>
          <span class="zname">${esc(label)}<br><span style="color:var(--text-muted);font-size:11px;">${esc(z.use)}</span></span>
          <span class="zvals">${esc(z.hf)} bpm<br>${esc(z.pace)}</span>
        </div>`;
      }).join("")}
    </div>`;
}

// ---------- Interaktion ----------
document.getElementById("app").addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "reload") return location.reload();
  if (action === "back") { state.selectedDate = null; runPickerFor = null; return render(); }
  if (action === "toggle-day-detail") {
    const row = target.closest(".day-row");
    const detail = row?.querySelector(".day-detail");
    if (!detail) return;
    const open = detail.classList.toggle("open");
    target.setAttribute("aria-expanded", String(open));
    return;
  }
  if (action === "open-day") { state.selectedDate = target.dataset.date; runPickerFor = null; return render(); }
  if (action === "toggle-today-exercises") { state.todayExpanded = !state.todayExpanded; return render(); }
  if (action === "open-info") {
    const c = INFO_CONTENT[target.dataset.info];
    if (c) openInfo(c.title, c.body, target);
    return;
  }
  if (action === "close-info") return closeInfo();
  if (action === "toggle-bilanz") { state.bilanzExpanded = !state.bilanzExpanded; return renderCoachSlot(); }
  if (action === "week-prev") { state.weekNo = Math.max(1, state.weekNo - 1); return render(); }
  if (action === "week-next") { state.weekNo = Math.min(plans[0].totalWeeks, state.weekNo + 1); return render(); }
  if (action === "week-today") { state.weekNo = weekNoForTab(todayISO()); return render(); }
  if (action === "toggle-sets") return toggleSets(target.dataset.slug);
  if (action === "toggle-edit") return toggleEditMode();
  if (action === "remove-exercise") return removeExercise(target.dataset.slug);
  if (action === "restore-exercise") return restoreExercise(target.dataset.slug);
  if (action === "add-exercise") return addExercise();
  if (action === "quick-add") { quickAdd = true; paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); document.getElementById("new-ex-name")?.focus(); return; }
  if (action === "cancel-add") { quickAdd = false; return paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); }
  if (action === "replace-exercise") { readAllCards(); replaceFor = target.dataset.slug; paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); document.getElementById("rep-ex-name")?.focus(); return; }
  if (action === "cancel-replace") { replaceFor = null; return paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); }
  if (action === "confirm-replace") return addExercise(target.dataset.slug);
  if (action === "save") return saveExercise(target.dataset.slug, currentDateISO());
  if (action === "hist-mode") { state.historyMode = target.dataset.mode; return render(); }
  if (action === "connect-strava") return startAuthorization();
  if (action === "pick-run") { runPickerFor = target.dataset.date; return render(); }
  if (action === "close-picker") { runPickerFor = null; return render(); }
  if (action === "assign-run") return setRunLink(target.dataset.date, Number(target.dataset.run));
  if (action === "ignore-run") return setRunLink(target.dataset.date, null);
  if (action === "reset-run") return resetRunLink(target.dataset.date);
  if (action === "reload-strava") {
    target.disabled = true;
    await loadStrava({ force: true });
    recomputeAssignment();
    return render();
  }
});

function currentDateISO() {
  return state.tab === "woche" && state.selectedDate ? state.selectedDate : todayISO();
}

// Info-Sheet (D1): Escape schließt, unabhängig davon, wo der Fokus liegt.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeInfo();
});

document.querySelectorAll("#tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tab = btn.dataset.tab;
    state.selectedDate = null;
    runPickerFor = null;
    if (state.tab === "woche") state.weekNo = weekNoForTab(todayISO());
    render();
  });
});

// ---------- Start ----------
(async function init() {
  // Tab-Leiste zeigt sofort einen Zustand, auch während der Plan noch lädt.
  document.querySelector('[data-tab="dashboard"]').classList.add("active");
  main.innerHTML = loadingCard("Plan wird geladen …");

  // A1: Der Plan wird asynchron geladen. Scheitert das ganz (kein Abruf,
  // keine Kopie), gibt es eine dauerhafte Fehlerkarte statt eines leeren
  // Bildschirms; alle weiteren Modul-Top-Level-Zugriffe auf Plandaten
  // stehen deshalb erst hier, nicht mehr oben im Modul.
  // K1: alles, was auf den geladenen Plan zugreift, gehört mit in den
  // try-Block — sonst wirft ein Plan, der zwar geladen aber in einer Form
  // ist, die dieser Code-Stand nicht (mehr) erwartet, eine unbehandelte
  // Rejection nach dem catch, und der Bildschirm bleibt für immer bei
  // "Plan wird geladen …" hängen, ohne Fehlerkarte.
  // M4: Der Hinweis "Plan aus letzter Kopie" darf nicht vom Strava-Toast
  // verschluckt werden, wenn beides direkt hintereinander passiert (Redirect
  // nach einer Strava-Verbindung, während gleichzeitig das Funkloch-Fallback
  // greift) — deshalb erst sammeln, dann gemeinsam anzeigen.
  let planHint = null;
  try {
    const result = await loadPlans();
    plans = result.plans;
    planHint = result.hint;

    state.weekNo = weekNoForTab(todayISO());
    state.historyExercise = defaultHistoryExercise();
    // F0: 35 Tage Vorlauf statt der alten 14 — die Belastungs-Ampel braucht
    // 28 Tage Historie vor den letzten 7 Tagen (M2-3/A6).
    STRAVA_SINCE = addDays(plans[0].start, -35);
  } catch (err) {
    console.error(err);
    header.innerHTML = `<h1>Trainingsplan</h1>`;
    main.innerHTML = errorCard(err.message);
    // M3: Ein Strava-Redirect (?code=…) wird hier bewusst nicht mehr
    // verarbeitet, wenn schon das Plan-Laden scheitert — der Code bleibt
    // dann in der URL stehen. Das ist kein Datenverlust: der Code ist
    // einmalig und noch unbenutzt, ein "Neu laden" nach behobenem
    // Plan-Problem verarbeitet ihn normal.
    return;
  }

  let stravaMsg = null;
  let stravaIsError = false;
  const hasRedirect = /[?&](code|error)=/.test(location.search);
  if (hasRedirect) {
    header.innerHTML = `<h1>Strava</h1>`;
    main.innerHTML = loadingCard("Strava-Verbindung wird abgeschlossen …");
    const res = await handleAuthRedirect();
    if (res.status === "connected") stravaMsg = "Mit Strava verbunden.";
    else if (res.status !== "none") { stravaMsg = res.message; stravaIsError = true; }
  }

  // M4: beide Hinweise zusammenführen statt den einen vom anderen
  // überschreiben zu lassen.
  if (planHint && stravaMsg) toast(`${planHint} · ${stravaMsg}`, stravaIsError);
  else if (planHint) toast(planHint);
  else if (stravaMsg) toast(stravaMsg, stravaIsError);

  // Anmeldung früh anstoßen, damit der erste Firestore-Zugriff nicht wartet.
  ensureSignedIn().catch((err) => {
    console.error(err);
    toast("Firebase-Anmeldung fehlgeschlagen: " + err.message, true);
  });

  render();
})();
