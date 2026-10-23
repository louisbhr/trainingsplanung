import {
  slug, toISO, addDays,
  weekStart, weekDates, weekOf, weekNumberFor, phaseOf,
  sessionOn, sessionsFor, activePlanFor, planDayState, exerciseCatalog,
  monthLabel, germanDate, LONG_RUN_TYPES,
} from "./plan.js?v=202610221509";
import { loadPlans } from "./plan-store.js?v=202610221509";
import {
  saveLog, loadLogsForDate, loadLogsForExercise, ensureSignedIn, loadDayPlan, saveDayPlan,
  loadRunLinks, saveRunLink, clearRunLink, loadAllLogs, loadAllDayPlans, loadCoach, saveCoach,
  loadCoachWeek, saveCoachWeek, authReady, signIn, signOutUser, signOutAndWipeDevice,
  authHeaders, waitForPendingWrites, deleteLog, deleteLogsForDate,
} from "./firebase-init.js?v=202610221509";
import {
  isAuthorized, startAuthorization, handleAuthRedirect, fetchRecentRuns,
  formatDuration, isWorkerConfigured, sessionForDate, fetchAllActivitiesForExport, lastFetchedAt,
} from "./strava.js?v=202610221509";
import { previousEntry, progressionChip } from "./progression.js?v=202610221509";
import {
  exerciseMode, startSets, lastTimeText, applyWeightForward, initialFocus, nextOpenExercise,
  stepValue, buildLogPayload, MAX_VALUE,
  draftKey, serializeDraft, parseDraft, staleDraftKeys, dropSavedFromDraft,
  withoutLogs, deleteDayTargets, deleteCountText,
} from "./kraftflow.js?v=202610221509";
import { assignRuns, offsetLabel, daysBetween } from "./runmatch.js?v=202610221509";
import { distanceStatus, hrStatus } from "./runcompare.js?v=202610221509";
import { esc, backNavHTML, toast, errorCard, loadingCard, dayNameDE, dayLongDE, shortDate, longDateDE, openInfo, closeOpenSheet, createSheet } from "./ui.js?v=202610221509";
import * as dash from "./view-dashboard.js?v=202610221509";
import * as dashWeek from "./view-week.js?v=202610221509";
import * as kraftView from "./view-kraft.js?v=202610221509";
import * as runView from "./view-run.js?v=202610221509";
import * as historyView from "./view-history.js?v=202610221509";
import * as planView from "./view-plan.js?v=202610221509";
import * as metrics from "./metrics.js?v=202610221509";
import * as coach from "./coach.js?v=202610221509";
import { THRESHOLDS, COACH_URL, ALLOWED_UID, WORKER_URL } from "./config.js?v=202610221509";
import { accessState, authErrorText, raceTimeout, fetchWithAuthRetry } from "./access.js?v=202610221509";
import { renderLogin, renderNoAccess, renderPendingWrites, renderGateWait, renderGateError, renderAccountSection } from "./view-account.js?v=202610221509";
import { buildExport, serializeExport, exportFileName, appVersionFromUrl, EXPORT_SINCE } from "./export.js?v=202610221509";

const INFO_CONTENT = { ...dash.infoContent(THRESHOLDS), ...historyView.infoContent() };
// Modell/Prompt-Version rein informativ fürs Firestore-Dokument (A4) — die
// eigentliche Konstante steht im Worker; ein Auseinanderlaufen ist
// unkritisch, das Feld dient nur der späteren Auswertung/Migration.
const COACH_MODEL = "claude-haiku-4-5";
const COACH_PROMPT_VERSION = "coach-v3";

// Coach-Aufruf mit Firebase-ID-Token. Ohne Token (authHeaders wirft) gibt es
// keinen Aufruf, und coach.js greift auf den Fallback zurück; ein 503
// auth_unavailable geht ebenfalls sofort in den Fallback, ohne Retry.
const coachFetch = (input) =>
  fetchWithAuthRetry(COACH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, { authHeaders, allowedOrigin: WORKER_URL });

// Wird erst gesetzt, wenn der Plan geladen ist (A1) — vorher greift jeder
// Zugriff auf den STRAVA_SINCE-Wert daneben.
let STRAVA_SINCE = null;

// Alle geladenen Pläne (F0a Punkt 4: Registry statt Einzelplan). In
// Schritt 1 genau einer; erst mit loadPlans() in init() gefüllt (A1) —
// Modul-Top-Level-Zugriffe auf Plandaten sind damit ausgeschlossen.
let plans = [];

// ---------- kleine Helfer ----------
const todayISO = () => toISO(new Date());

const main = document.getElementById("main");

// Seitenkopf scrollt mit dem Inhalt (docs/plan-stride.md "Ansatz"): er steht als
// erster Block <header class="sd-pagehead" data-region="pagehead"> IM #main, das
// einzige Scroll-Element. #header bleibt als leerer DOM-Platz. renderMain()
// schreibt Kopf + Inhalt; setPageHead() merkt sich den Kopf und patcht ihn,
// falls er schon im DOM steht.
let pageHeadHTML = "";

// Einziger Schreibweg für den Seiteninhalt: Kopf + Inhalt in #main. Direkte
// `main.innerHTML =`-Zuweisungen sind verboten (Test "renderMain"), sonst
// fehlt der Kopf. Eine Ausnahme ohne Kopf gibt es bewusst nicht.
function renderMain(html) {
  main.innerHTML = `<header class="sd-pagehead" data-region="pagehead">${pageHeadHTML}</header>${html}`;
}

// Kopf für Übergangs- und Fehlerzustände ohne eigenes Kopfmodul: ein Display-Titel.
function plainHead(title) {
  return `<div class="sd-daytitle"><h1 class="sd-display" tabindex="-1">${esc(title)}</h1></div>`;
}

function setPageHead(html) {
  pageHeadHTML = html;
  const el = main.querySelector(":scope > [data-region='pagehead']");
  if (el) el.innerHTML = html;
}

const state = {
  tab: "dashboard",
  weekNo: 1, // richtiger Wert kommt aus init(), sobald der Plan geladen ist
  openDayIndex: null, // offene Zeile im Wochen-Tab (0..6), höchstens eine; null = alle zu
  selectedDate: null,
  historyMode: "lauf", // Verlauf startet auf Lauf (Handoff 5.5)
  historyExercise: null,
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

// Kraft-Zustand der gerade sichtbaren Tagesansicht (slug -> Ablauf der Übung)
const logState = new Map();
// Pro Tag angepasste Übungsliste: { removed: [slug], added: [{name, soll, hint}] }
let dayPlan = { removed: [], added: [] };
let currentKraftDay = { info: null, iso: null };
let editMode = false;
// Strava: null = noch nicht geladen, false = nicht verbunden
let stravaState = { runs: null, error: null, errorSource: null, connected: null };
// Plan-Datum -> { run, offset, source }
let runAssignment = {};
let runLinks = {};
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

// ---------- Heute (F1–F8, Stride E3) ----------
// Die Seite besteht aus fünf Slots (#banner-slot, #today-slot, #coach-slot,
// #status-slot, #week-slot), die einzeln nachladen. Ein leerer Slot bleibt
// wirklich leer, dann blendet das CSS ihn aus. Das Markup liefert
// view-dashboard.js, siehe docs/ui-markup-stride.md Abschnitt 9.
const COACH_NO_PLAN_TEXT =
  "Dein Plan ist beendet. Ein neues Ziel legst du im Plan-Tab an, sobald es feststeht. " +
  "Bis dahin zeigt dir Heute weiter deine Strava-Läufe und die Belastung.";

// Letzter geladener dayplans-Stand und Fortschritt für den heutigen Krafttag —
// bleiben über Neuzeichnen erhalten, damit die Karte nicht jedes Mal auf
// "Training starten" zurückfällt, bevor der frische Fetch durch ist.
let todayDayPlanCache = { removed: [], added: [] };
let todayProgressCache = { iso: null, done: new Set() };
// Meldung, wenn Firestore-Daten (Logs, Tagesanpassungen) nicht lesbar waren.
let dataLoadError = null;

const isLongRun = (session) => LONG_RUN_TYPES.includes(session.shortType);

// Schreibt in einen Slot der Heute-Seite, aber nur, solange sie noch sichtbar
// ist (der Nutzer kann inzwischen weitergeklickt haben).
function setDashSlot(id, html) {
  if (state.tab !== "dashboard" || state.selectedDate) return;
  const slot = document.getElementById(id);
  if (slot) slot.innerHTML = html;
}

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
  return `${best.name} · ${metrics.formatKm1(best.distanceKm)} km`;
}

// Zeile bis zum Rennen: "237 Tage bis 02.05." (F2). Ohne bestätigtes Renndatum "Datum offen".
function countdownText(plan, iso) {
  if (!plan.goal.raceDateConfirmed) {
    return `Rennen ca. ${monthLabel(plan.goal.raceDate)} · Datum offen`;
  }
  const days = daysBetween(iso, plan.goal.raceDate);
  if (days <= 0) return "Rennen heute!";
  return `${days} ${days === 1 ? "Tag" : "Tage"} bis ${shortDate(plan.goal.raceDate)}`;
}

function paintDashboardHeader(iso, dayState, plan) {
  const title = longDateDE(iso);
  // Auf Heute ist .sd-head selbst die Markenzeile, darum ohne brandHeadHTML().
  if (dayState === "keinPlan") {
    const goal = plans[0]?.goal;
    const past = goal && goal.raceDate < iso;
    setPageHead(dash.headHTML({ sub: "Ohne Plan", title, meta: past ? [`Rennen am ${germanDate(goal.raceDate)}`] : [] }));
    return;
  }
  if (dayState === "bisZumRennen") {
    setPageHead(dash.headHTML({
      sub: "Zwischen zwei Planwochen", title, meta: [plan.goal.distance, countdownText(plan, iso)],
    }));
    return;
  }
  const w = weekNumberFor(plan, iso);
  const week = weekOf(plan, w);
  const phase = phaseOf(plan, w);
  setPageHead(dash.headHTML({
    sub: `Woche ${w} · ${week.weekType || phase.name}`,
    title,
    chip: { text: `W${w} / ${plan.totalWeeks}`, label: `Woche ${w} von ${plan.totalWeeks}` },
    progress: { value: w, max: plan.totalWeeks, label: `Planfortschritt, Woche ${w} von ${plan.totalWeeks}` },
    meta: [`Phase ${phase.n} · ${phase.name}`, countdownText(plan, iso)],
  }));
}

// ---- Banner ----
function stravaBannerState() {
  if (stravaState.connected === false) return { state: "disconnected" };
  if (stravaState.error && stravaState.errorSource === "strava") return { state: "error", message: stravaState.error };
  return null; // null = Prüfung läuft oder alles gut
}
function bannersMarkup() {
  const dataError = dataLoadError || (stravaState.errorSource === "firebase" ? stravaState.error : null);
  return dash.bannersHTML({ dataError, strava: stravaBannerState() });
}
function paintBanners() {
  setDashSlot("banner-slot", bannersMarkup());
}

// ---- Heute-Karte ----
// "Morgen"-Zeile der Ruhetag-Karte; null, wenn morgen außerhalb des Plans oder
// in einer Platzhalterwoche liegt.
function tomorrowInfo(iso) {
  const tomorrow = addDays(iso, 1);
  if (planDayState(tomorrow, plans) !== "woche") return null;
  const info = sessionOn(activePlanFor(tomorrow, plans), tomorrow);
  if (info.kind === "kraft") return { iso: tomorrow, kind: "kraft", value: info.label };
  if (info.kind === "lauf") return { iso: tomorrow, kind: isLongRun(info) ? "long" : "lauf", value: `${info.type} · ${info.dist}` };
  if (info.kind === "ruhe") return { iso: tomorrow, kind: "rest" };
  return null;
}

// Strava-Teil der Lauf-Karte: nur "lädt" und "Lauf zugeordnet" zeigen etwas; nicht
// verbunden und Ladefehler erklärt der Banner.
function laufIst(iso) {
  if (stravaState.error || stravaState.connected === false) return { state: "none" };
  if (!stravaReady()) return { state: "loading" };
  const a = runAssignment[iso];
  return a?.run ? { state: "run", run: a.run, offset: a.offset } : { state: "none" };
}

function raceInfo(plan, iso) {
  const goal = plan.goal;
  if (!goal.raceDateConfirmed) return null;
  const days = daysBetween(iso, goal.raceDate);
  return {
    dayText: `${dayLongDE(goal.raceDate)}, ${germanDate(goal.raceDate)}`,
    daysText: days <= 0 ? "heute" : `noch ${days} ${days === 1 ? "Tag" : "Tage"}`,
  };
}

function todayCardSlotHTML(iso, dayState, plan) {
  if (dayState === "keinPlan") {
    return dash.todayNoPlanHTML({ summary: todayStravaSummary(iso), runsKnown: Array.isArray(stravaState.runs) });
  }
  if (dayState === "bisZumRennen") return dash.todayRaceHTML(raceInfo(plan, iso));

  const info = sessionOn(plan, iso);
  if (info.kind === "placeholder") {
    const nextRecal = (plan.recalibrationDates || []).find((d) => d >= iso);
    return dash.todayPlaceholderHTML({
      fromDate: nextRecal ? shortDate(nextRecal) : null,
      km: weekOf(plan, info.week)?.plannedKm ?? null,
    });
  }
  if (info.kind === "kraft") {
    return dash.todayKraftHTML({
      session: info,
      exercises: effectiveExercisesFor(info, todayDayPlanCache),
      doneSlugs: todayProgressCache.iso === iso ? todayProgressCache.done : new Set(),
      deload: !!weekOf(plan, weekNumberFor(plan, iso))?.deload,
    });
  }
  if (info.kind === "lauf") {
    return dash.todayLaufHTML({ session: info, isLong: isLongRun(info), ist: laufIst(iso) }, THRESHOLDS);
  }
  return dash.todayRestHTML(tomorrowInfo(iso));
}

function paintDashboardMain(iso, dayState, plan) {
  // Neuer Tag/neue Woche: kein Rest vom vorigen Coach-Render übernehmen.
  coachDailyText = null;
  coachBilanzInfo = null;
  state.bilanzExpanded = false;
  const coachHTML = dayState === "keinPlan" ? dash.coachHTML(COACH_NO_PLAN_TEXT) : dash.coachLoadingHTML();
  // Kein Leerraum zwischen den Slot-Tags: ein leerer Slot muss wirklich leer sein.
  renderMain(`<div class="sd-main"><div id="banner-slot">${bannersMarkup()}</div>` +
    `<div id="today-slot">${todayCardSlotHTML(iso, dayState, plan)}</div>` +
    `<div id="coach-slot">${coachHTML}</div>` +
    `<div id="status-slot">${dash.statusCardHTML(null)}</div><div id="week-slot"></div></div>`);
  fillTodayCard(iso, dayState, plan);
  fillAmpeln(iso, dayState, plan);
  fillWeekCard(iso, dayState, plan);
  fillCoach(iso, dayState, plan);
  fillWeeklyBilanz(iso, dayState, plan);
}

function refreshTodaySlot(iso, dayState, plan) {
  setDashSlot("today-slot", todayCardSlotHTML(iso, dayState, plan));
}

// Lädt nach, was die Synchron-Ansicht noch nicht hatte (Strava-Ist-Werte,
// Kraft-Fortschritt) — die Seite selbst wartet darauf nicht (F3/F7).
async function fillTodayCard(iso, dayState, plan) {
  if (dayState === "woche") {
    const info = sessionOn(plan, iso);
    if (info.kind === "kraft") {
      try {
        const [saved, dp] = await Promise.all([loadLogsForDate(iso), loadDayPlan(iso)]);
        todayDayPlanCache = dp;
        const exercises = effectiveExercisesFor(info, dp);
        todayProgressCache = {
          iso,
          done: new Set(exercises.map((ex) => slug(ex.name)).filter((sl) => saved[sl]?.completed)),
        };
        refreshTodaySlot(iso, dayState, plan);
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
// Wirft nie (I1, Code-Review M2 Runde 1): fillAmpeln/fillWeekCard/fillCoach
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
    // Nur zuweisen, wenn nichts da ist (Auflage D5): ein Löschen während des Ladens
    // hat allLogs schon durch ein gefiltertes Array ersetzt, das nie überschrieben werden darf.
    allLogs = allLogs ?? logs;
    allDayPlans = allDayPlans ?? dps;
    dataLoadError = null;
    paintBanners();
    return { logs: allLogs, dps: allDayPlans, ok: true };
  } catch (err) {
    console.error(err);
    dataLoadError = err.message || "Unbekannter Fehler";
    paintBanners();
    return { logs: [], dps: {}, ok: false };
  }
}

// Letzte (max n) über assignRuns zugeordnete Easy/Long/Recovery-Läufe über
// alle Planwochen hinweg (nicht nur die aktuelle Woche) — F5 Ampel 2.
function lastAssignedEasyRuns(plan, n) {
  const candidates = [];
  for (const week of plan.weeks) {
    if (week.placeholder) continue;
    for (const s of week.sessions.filter(metrics.isZoneRun)) {
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
  let wochensollResult = metrics.wochensoll(wochensollSessions, actualKmByDate, kraftDoneByDate, iso, THRESHOLDS);
  // Fehlt eine Datenquelle, die fehlende Hälfte benennen statt "0 / 0 km"
  // zu zeigen; fehlen beide, ist die Ampel grau statt scheinbar grün.
  if (!stravaOk || !logsOk) {
    const sollKm = sessions.filter((x) => x.kind === "lauf").reduce((a, x) => a + (x.km || 0), 0);
    const laufPart = stravaOk ? `${metrics.formatKm(wochensollResult.istKm)} / ${metrics.formatKm(sollKm)} km` : "Lauf: Strava fehlt";
    const kraftPart = logsOk ? `Kraft ${wochensollResult.kraftDone}/${wochensollResult.kraftPlanned}` : "Kraft: Daten fehlen";
    wochensollResult = {
      ...wochensollResult,
      status: !stravaOk && !logsOk ? "grau" : wochensollResult.status,
      detail: `${laufPart} · ${kraftPart}`,
    };
  }

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
    setDashSlot("status-slot", dash.statusCardHTML(list));
  } catch (err) {
    console.error(err);
  }
}

// ---------- Diese Woche (F8, Stride E3) ----------
// Kraft-Kürzel im Wochenstreifen: "Full Body A" -> "A", sonst "K".
function kraftLetter(session) {
  return /\b([AB])\s*$/.exec(session.label || "")?.[1] ?? "K";
}

// Ein Tag des Streifens. "verpasst" nur, wenn die Datenquelle des Tages gelesen
// werden konnte (sonst wäre jeder Tag fälschlich verpasst) und die Einheit nicht
// optional ist (wie im Wochen-Tab).
function weekDayModel(plan, iso, today, logs, dps, logsOk) {
  const info = sessionOn(plan, iso);
  const base = { dow: dayNameDE(iso), dayLong: dayLongDE(iso), today: iso === today };
  if (info.kind === "kraft") {
    const done = kraftProgressOn(info, dps[iso], logs).complete;
    const missed = !done && iso < today && logsOk && !info.optional;
    return { ...base, kind: "kraft", what: `Kraft ${kraftLetter(info)}`, dot: kraftLetter(info), state: done ? "done" : missed ? "missed" : "open" };
  }
  if (info.kind === "lauf") {
    const done = !!runAssignment[iso]?.run;
    const missed = !done && iso < today && stravaReady();
    const km = Number.isFinite(info.km) ? Math.round(info.km) : null;
    const long = isLongRun(info);
    return {
      ...base, kind: long ? "long" : "lauf", state: done ? "done" : missed ? "missed" : "open",
      what: `${long ? "Long Run" : "Lauf"}${km != null ? ` ${km} km` : ""}`, dot: km != null ? String(km) : "L",
    };
  }
  return { ...base, kind: "rest" };
}

function weekCardModel(plan, weekNo, iso, logs, dps, logsOk) {
  const days = weekDates(plan, weekNo).map((d) => weekDayModel(plan, d, iso, logs, dps, logsOk));
  const laufSessions = sessionsFor(plan, weekNo).filter((s) => s.kind === "lauf");
  const soll = laufSessions.reduce((a, s) => a + (s.km || 0), 0);
  const ist = stravaReady()
    ? laufSessions.reduce((a, s) => a + (runAssignment[s.date]?.run?.distanceKm || 0), 0)
    : 0;
  return { days, volume: { ist: Math.round(ist * 10) / 10, soll } };
}

// Nur bei Plan mit Tagesdetails; bei Platzhalterwoche, Kein Plan und Bis zum
// Rennen bleibt der Slot leer. Erscheint erst, wenn die Daten da sind, damit
// kein Tag fälschlich "offen" oder "verpasst" aussieht.
async function fillWeekCard(iso, dayState, plan) {
  if (dayState !== "woche") return;
  const weekNo = weekNumberFor(plan, iso);
  if (weekOf(plan, weekNo).placeholder) return;
  try {
    await loadStrava();
    const { logs, dps, ok } = await ensureAllLogsAndDayPlans();
    setDashSlot("week-slot", dash.weekCardHTML(weekCardModel(plan, weekNo, iso, logs, dps, ok)));
  } catch (err) {
    console.error(err);
  }
}

// ---------- Coach-Eingaben (F6) ----------
// Die Karten "Im Detail" gibt es auf Heute nicht mehr (F3, Stride). Diese beiden
// Rechnungen bleiben, weil der Coach-Request (coach.js/Worker unverändert, C10)
// aerobeEffizienzTrend und adherence4w mitschickt.
// Zugeordnete Läufe je Woche (1..bis) für die aerobe Effizienz — auch aus
// Wochen außerhalb der aktuellen Phase.
function aerobeWeeklyData(plan, uptoWeekNo) {
  const out = [];
  for (let n = 1; n <= uptoWeekNo; n++) {
    const week = weekOf(plan, n);
    if (!week || week.placeholder) continue;
    // Nur Easy/Long/Recovery: Kalibrierungstest und Schwellenläufe liegen
    // bewusst über der Z2-Herzfrequenz und gehören nicht in die Effizienz.
    const runs = sessionsFor(plan, n)
      .filter(metrics.isZoneRun)
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
      const isDone = s.kind === "lauf"
        ? !!runAssignment[s.date]?.run
        : s.kind === "kraft" && kraftProgressOn(s, dayPlans[s.date], logs).complete;
      // Optionale Einheiten zählen nur, wenn sie erledigt sind.
      if (!metrics.countsTowardPlan(s, isDone)) continue;
      planned++;
      if (isDone) done++;
    }
  }
  return metrics.adherence4w(done, planned);
}

// ---------- Coach (F6, M2-9) ----------
function todayFieldFor(info, doneToday) {
  if (info.kind === "kraft") return { type: "Kraft", name: info.label, done: !!doneToday };
  // Distanz und HF-Obergrenze mitschicken, sonst nennt der Coach für den
  // Long Run die Easy-Grenze (coach-v3).
  if (info.kind === "lauf") {
    // Test-/Schwellenläufe haben keine HF-Obergrenze.
    const hfPart = typeof info.hfMax === "number" ? ` · HF bis ${info.hfMax}` : "";
    const name = `${info.type} ${info.dist}${hfPart}`.slice(0, 60);
    return { type: "Lauf", name, done: !!runAssignment[todayISO()]?.run };
  }
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
    ? dash.bilanzOpenHTML(coachBilanzInfo.weekN, coachBilanzInfo.text)
    : dash.bilanzToggleHTML(coachBilanzInfo.weekN, state.bilanzExpanded, coachBilanzInfo.text);
  setDashSlot("coach-slot", dash.coachHTML(coachDailyText, bilanzHTML));
}

// Baut die Ampel-Liste + Kraft-heute-erledigt ohne erneuten Strava-/
// Firestore-Zugriff (nutzt, was fillAmpeln/fillWeekCard ohnehin schon lädt/
// cacht) und ruft darüber requestCoach() auf. Fehler landen nie als
// Fehlerkarte (F6) — im schlimmsten Fall bleibt der Lade-Platzhalter stehen.
async function fillCoach(iso, dayState, plan) {
  if (dayState === "keinPlan") return; // fixer Hinweistext steht schon (kein API-Aufruf, F7)
  if (dayState === "bisZumRennen") {
    return setDashSlot("coach-slot", dash.coachHTML(
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
      fetchWorker: () => coachFetch(input),
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
    // Test-/Schwellenläufe haben keine Easy-Obergrenze (isZoneRun).
    if (metrics.isZoneRun(s) && a.run.avgHr != null && a.run.avgHr > s.hfMax) {
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
  let sessionsDone = 0, sessionsPlanned = 0;
  for (const s of sessionsFor(plan, weekNo).filter((x) => x.kind === "kraft")) {
    const complete = kraftProgressOn(s, dps[s.date], logs).complete;
    if (!metrics.countsTowardPlan(s, complete)) continue; // optional und nicht erledigt
    sessionsPlanned++;
    if (complete) sessionsDone++;
  }
  // Die Ampel kennt nur ok/stagniert/unterSoll; für die Wochenbilanz wird
  // "ok" über den Trend zur vorigen Einheit in steigt/haelt aufgeteilt.
  const progression = (kraftAmpelResults || []).slice(0, 12).map((r) => ({
    exercise: r.name,
    status: r.status === "unterSoll" ? "unterSoll" : r.status === "stagniert" ? "stagniert" : r.trend || "steigt",
    detail: `${r.reps.split("/").length}× ${r.topKg} kg`,
  }));
  return { sessionsPlanned, sessionsDone, progression };
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
      fetchWorker: () => coachFetch(input),
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

// Detailseiten (Kraft-Tag, Lauf-Tag) blenden die schwebende Tableiste aus
// (CSS: #app.is-detail). Beim Öffnen springt die Seite nach oben.
function setDetailMode(on) {
  const app = document.getElementById("app");
  const wasDetail = app.classList.contains("is-detail");
  app.classList.toggle("is-detail", on);
  if (on && !wasDetail) main.scrollTop = 0;
}

function render() {
  kraftOpen = false; // renderKraftDay setzt es wieder, sobald der Kraft-Tag die Seite ist
  runOpen = false; // ebenso renderRunDay; das Zuordnungs-Sheet gehört nur zum Lauf-Tag
  assignSheet.closeImmediately();
  confirmSheet.closeImmediately(); // Auflage D6: das Bestätigungs-Sheet gehört zum Kraft-Tag
  pendingDelete = null;
  if (!plans.length) return; // Plan lädt noch (siehe init()); nichts zu rendern
  syncTabbar();
  setDetailMode(false); // renderDay schaltet es für Kraft-/Lauf-Tage wieder ein
  try {
    if (state.tab === "dashboard") {
      return state.selectedDate ? renderDay(state.selectedDate, { showBack: true, backLabel: "Heute" }) : renderDashboard();
    }
    if (state.tab === "woche") {
      return state.selectedDate ? renderDay(state.selectedDate, { showBack: true, backLabel: "Woche" }) : renderWeek();
    }
    if (state.tab === "verlauf") return renderHistory();
    if (state.tab === "plan") return renderPlan();
  } catch (err) {
    console.error(err);
    setPageHead(plainHead("Fehler"));
    renderMain(errorCard("Etwas ist schiefgelaufen: " + err.message));
  }
}

// ---------- Tagesansicht ----------
async function renderDay(iso, { showBack, backLabel }) {
  const info = dayInfo(iso);
  const plan = activePlanFor(iso, plans);
  const w = plan ? weekNumberFor(plan, iso) : null;
  const isToday = iso === todayISO();
  const label = backLabel ?? `Woche ${w}`;
  setDetailMode(info.kind === "kraft" || info.kind === "lauf");
  // Der Kraft-Tag baut Kopf und Inhalt komplett selbst (view-kraft.js)
  if (info.kind === "kraft") return renderKraftDay(info, iso, label);
  // Der Lauf-Tag ebenso (view-run.js)
  if (info.kind === "lauf") return renderRunDay(info, iso, label);

  const title = info.kind === "placeholder" ? `Woche ${w}`
    : info.kind === "bisZumRennen" ? "Bis zum Rennen"
    : info.kind === "keinPlan" ? "Kein aktiver Plan"
    : "Ruhetag";
  const nav = showBack
    ? backNavHTML(label)
    : "";
  setPageHead(`${nav}
<div class="sd-daytitle">
  <p class="sd-eyebrow sd-eyebrow--plain">${dayNameDE(iso)} · ${shortDate(iso)}${isToday ? " · heute" : ""}</p>
  <h1 class="sd-display" tabindex="-1">${esc(title)}</h1>
</div>`);

  const [heading, text] = info.kind === "placeholder"
    ? ["Details folgen", `${info.focus ? info.focus + ". " : ""}Die genauen Werte tragen wir nach der Re-Kalibrierung nach.`]
    : info.kind === "bisZumRennen"
      ? [null, "Der Plan endet vor dem Renntag, für diesen Tag gibt es keine Einheit mehr."]
      : info.kind === "keinPlan"
        ? [null, "Für dieses Datum liegt kein Trainingsplan vor."]
        : [null, "Mobility, Foam Rolling, Beine hoch."];
  renderMain(`<div class="sd-main sd-main--tight">
  <section class="sd-card sd-card--center" data-card="${info.kind === "placeholder" ? "placeholder-day" : "rest-day"}">${
    heading ? `\n    <h2 class="sd-card__title">${heading}</h2>` : ""}
    <p class="sd-card__text">${esc(text)}</p>
  </section>
</div>`);
}

// ---------- Krafttag ----------
// Stride E5: Satz für Satz statt Formular. logState hält je Übung den Ablauf
// (Sätze mit done-Flag, aktiver Satz, gespeichert?), focusExerciseId die
// Jetzt-Übung. Rechenregeln (Startwerte, Gewicht wirkt vorwärts, Payload) stehen
// in kraftflow.js, das Markup in view-kraft.js; hier nur Zustand, Laden,
// Speichern und Verdrahtung.
let focusExerciseId = null;
let kraftOpen = false;      // Kraft-Tag ist gerade die sichtbare Seite
let kraftGen = 0;           // zählt Öffnungen: späte Antworten einer alten Öffnung werden verworfen
let kraftLoadError = null;
let kraftBackLabel = "Heute";
let kraftSaved = {};        // gespeicherte Dokumente des Tages (slug -> Dokument), auch für „Zurückholen“
let kraftSessionHTML = "";  // Strava-Zeile; bleibt über Neuzeichnungen erhalten
let editForm = null;        // { kind: "add"|"replace", slug?, name, soll, error } im Anpassen-Modus

// Wie lange „Speichert …“ höchstens steht. Mit Offline-Cache löst das Promise
// erst beim Sync auf; darauf will im Gym niemand warten, also gilt der Satz
// danach als gespeichert (optimistisch) und wird nur bei einem Fehler zurückgenommen.
const SAVE_OPTIMISTIC_MS = 800;

const firstUndone = (sets) => sets.findIndex((s) => !s.done);

// Eingabetext mit Komma oder Punkt -> Zahl; leer oder keine Zahl = null
function numOrNull(v) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

async function renderKraftDay(info, iso, backLabel) {
  const gen = ++kraftGen;
  kraftOpen = true;
  editMode = false;
  editForm = null;
  kraftBackLabel = backLabel;
  kraftSessionHTML = "";
  kraftLoadError = null;
  ensureKraftLive();
  setPageHead(kraftView.headHTML({ label: info.label, backLabel, exercises: null }));
  renderMain(kraftView.loadingMainHTML());

  let saved = {};
  try {
    let logs;
    [saved, dayPlan, logs] = await Promise.all([
      loadLogsForDate(iso),
      loadDayPlan(iso),
      allLogs ? Promise.resolve(allLogs) : loadAllLogs(),
    ]);
    allLogs = allLogs ?? logs; // Auflage D5: nie ein gefiltertes Array durch ein altes ersetzen
  } catch (err) {
    console.error(err);
    dayPlan = { removed: [], added: [] };
    // Als Karte, nicht als Toast: die Meldung muss stehen bleiben, sonst
    // sieht man nur leere Felder und rät.
    kraftLoadError = err.source === "firebase" ? err.message : "Laden fehlgeschlagen: " + err.message;
  }
  if (gen !== kraftGen || !kraftOpen) return; // Nutzer ist schon woanders

  try {
    currentKraftDay = { info, iso };
    kraftSaved = saved;
    buildLogState(effectiveExercises(info), iso);
    focusExerciseId = pickInitialFocus();
    restoreKraftDraft(iso);
    paintKraft();
  } catch (err) {
    // z. B. ein kaputtes Log-Dokument: als Banner statt stehendem Lade-Skelett
    console.error(err);
    renderMain(errorCard("Kraft-Tag nicht geladen: " + err.message));
    return;
  }
  fillSessionSlot(iso, gen);
}

// Herzfrequenz und Dauer der Einheit aus Strava — ohne jede Eingabe (F7).
async function fillSessionSlot(iso, gen) {
  const s = await loadStrava();
  if (gen !== kraftGen || !kraftOpen || s.error || !s.connected) return;
  kraftSessionHTML = kraftView.stravaSessionHTML(sessionForDate(iso));
  const slot = document.getElementById("session-slot");
  if (slot) slot.innerHTML = kraftSessionHTML;
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

// Zustand einer Übung aus Plan, Verlauf und dem heutigen Dokument (F4/F5).
function buildExerciseState(ex, rec, iso) {
  const s = slug(ex.name);
  const last = previousEntry((allLogs ?? []).filter((l) => l.exercise === s), iso);
  const chip = progressionChip(ex.soll, last);
  const saved = !!rec?.completed && rec.sets?.length > 0;
  // Wurde heute mit Gewicht gespeichert, obwohl das letzte Mal ohne: Gewichts-Modus beibehalten.
  const forceWeight = saved && rec.sets.some((x) => x.kg > 0);
  const baseMode = exerciseMode(ex.soll, last);
  const mode = exerciseMode(ex.soll, last, forceWeight);
  const sets = startSets(ex.soll, saved ? rec : null, last, chip, mode);
  return {
    slug: s, name: ex.name, soll: ex.soll, hint: ex.hint || "", custom: !!ex.custom,
    chip: chip ? { level: chip.level, text: chip.text } : null,
    lastText: last ? lastTimeText({ ...last, soll: last.soll ?? ex.soll }) : null,
    mode, weightAdded: mode === "weight" && baseMode === "reps",
    sets,
    activeIndex: saved ? null : firstUndone(sets),
    saved,
    savedSets: saved ? rec.sets.map((x) => ({ kg: x.kg ?? null, reps: x.reps ?? null })) : [],
    saving: false, saveError: null, editing: null,
  };
}

// prev: bisheriger Zustand (nach Anpassen bleibt die Eingabe der übrigen Übungen erhalten)
function buildLogState(exercises, iso, prev = null) {
  logState.clear();
  for (const ex of exercises) {
    const s = slug(ex.name);
    const old = prev?.get(s);
    logState.set(s, old
      ? { ...old, name: ex.name, soll: ex.soll, hint: ex.hint || "", custom: !!ex.custom }
      : buildExerciseState(ex, kraftSaved[s], iso));
  }
}

// Start: erste nicht gespeicherte Übung; ist alles gespeichert, die letzte
// (dort steht dann „Training abschließen“).
function pickInitialFocus() {
  const list = [...logState.values()];
  return initialFocus(list) ?? list[list.length - 1]?.slug ?? null;
}

function focusedState() {
  return logState.get(focusExerciseId) ?? null;
}

// Übungen für die Ansicht; die Jetzt-Übung kennt ihre „Weiter“-Übung.
function exerciseVMs() {
  const list = [...logState.values()];
  const savedMap = Object.fromEntries(list.map((s) => [s.slug, s.saved]));
  const next = nextOpenExercise(list.map((s) => s.slug), focusExerciseId, savedMap);
  const del = (st) => (kraftLoadError ? null : { disabled: st.saving || deleteBusy });
  return list.map((st) => (st.slug === focusExerciseId && next
    ? { ...st, nextSlug: next, nextName: logState.get(next).name, del: del(st) }
    : { ...st, del: del(st) }));
}

function editRows(info) {
  const removed = new Set(dayPlan.removed);
  const replacements = new Map(dayPlan.added.filter((e) => e.replaces).map((e) => [e.replaces, e]));
  const rowOf = (st) => ({
    slug: st.slug, name: st.name, soll: st.soll, custom: st.custom, saved: st.saved,
    savedSets: st.savedSets, mode: st.mode, removed: false,
  });
  const rows = [];
  for (const ex of info.exercises) {
    const sl = slug(ex.name);
    const rep = replacements.get(sl);
    const st = logState.get(rep ? slug(rep.name) : sl);
    if (rep || !removed.has(sl)) { if (st) rows.push(rowOf(st)); continue; }
    rows.push({ slug: sl, name: ex.name, removed: true });
  }
  for (const st of logState.values()) if (!rows.some((r) => r.slug === st.slug)) rows.push(rowOf(st));
  return rows;
}

// Zeichnet Kopf + Inhalt neu. #main ist das Scroll-Element: die Position bleibt,
// die Seite springt weder bei „Satz fertig“ noch beim Wechsel der Jetzt-Übung.
function paintKraft(focus = null) {
  if (!kraftOpen || !currentKraftDay.info) return;
  const { info, iso } = currentKraftDay;
  const scrollTop = main.scrollTop;
  if (editMode) {
    setPageHead(kraftView.editHeadHTML({ label: info.label, backLabel: kraftBackLabel, dateText: `${dayNameDE(iso)}, ${shortDate(iso)}` }));
    renderMain(kraftView.editMainHTML({ rows: editRows(info), form: editForm, dateText: shortDate(iso) }));
  } else {
    const exercises = exerciseVMs();
    setPageHead(kraftView.headWithDotsHTML({ label: info.label, backLabel: kraftBackLabel, exercises, focusSlug: focusExerciseId }));
    renderMain(kraftView.mainHTML({ exercises, focusSlug: focusExerciseId, loadError: kraftLoadError, sessionHTML: kraftSessionHTML }));
  }
  main.scrollTop = scrollTop;
  applyKraftFocus(focus);
  persistKraftDraft();
}

// ---------- Entwurf (V2, Auflage C2) ----------
// Schutz vor verlorenen Eingaben (Tab neu geladen, App im Hintergrund beendet).
// Gespeichert wird je Kraft-Tag unter hm-tracker.kraftDraft.<Datum> und nur für
// Übungen, die noch nicht gespeichert sind. Das Lesen und Schreiben steht nur
// hier (kraftflow.js bleibt rein); jeder Zugriff ist abgesichert, die App läuft
// auch ohne Speicher. Persistiert wird in paintKraft: jede Eingabe zeichnet neu.
const draftSeen = new Set(); // Tage, deren Entwurf in dieser Sitzung geschrieben oder gemeldet wurde

function draftRead(iso) {
  try { return localStorage.getItem(draftKey(iso)); } catch { return null; }
}

function draftWrite(iso, text) {
  try { localStorage.setItem(draftKey(iso), text); } catch { /* ohne Speicher kein Entwurf */ }
}

function draftRemove(iso) {
  try { localStorage.removeItem(draftKey(iso)); } catch { /* ohne Speicher kein Entwurf */ }
}

// Beim Start: Entwürfe älter als 7 Tage löschen. Ein anderer Tag räumt nie ab.
function purgeStaleDrafts() {
  try {
    const keys = Object.keys(localStorage);
    for (const key of staleDraftKeys(keys, todayISO())) localStorage.removeItem(key);
  } catch { /* ohne Speicher nichts zu räumen */ }
}

// Hat der Nutzer in dieser Übung etwas verändert (Wert oder fertiger Satz)?
function isDirty(st, iso) {
  const start = buildExerciseState(st, null, iso).sets;
  const key = (sets) => JSON.stringify(sets.map((x) => [x.kg ?? null, x.reps ?? null, !!x.done]));
  return key(st.sets) !== key(start);
}

function persistKraftDraft() {
  const { iso } = currentKraftDay;
  if (!kraftOpen || !iso) return;
  const ex = {};
  for (const st of logState.values()) {
    if (st.saved || !isDirty(st, iso)) continue;
    ex[st.slug] = { sets: st.sets, doneSets: st.sets.filter((x) => x.done).length, weightAdded: st.weightAdded === true };
  }
  if (!Object.keys(ex).length) return draftRemove(iso);
  draftWrite(iso, serializeDraft({ focus: Object.hasOwn(ex, focusExerciseId) ? focusExerciseId : null, ex }));
  draftSeen.add(iso);
}

// Gespeichertes Dokument gewinnt (R9); der Rest des Entwurfs füllt die Übungen.
function restoreKraftDraft(iso) {
  const raw = draftRead(iso);
  if (raw == null) return;
  const savedSlugs = [...logState.values()].filter((st) => st.saved).map((st) => st.slug);
  const draft = dropSavedFromDraft(parseDraft(raw, [...logState.keys()]), savedSlugs);
  if (!draft) return draftRemove(iso); // kaputt, fremd oder überholt: verwerfen
  for (const [name, d] of Object.entries(draft.ex)) {
    const st = logState.get(name);
    // Nie alle Sätze fertig wiederherstellen: so bliebe nichts zu bedienen.
    const done = Math.min(d.doneSets, d.sets.length - 1);
    st.sets = d.sets.map((x, i) => ({ kg: x.kg, reps: x.reps, done: i < done }));
    st.activeIndex = firstUndone(st.sets);
    if (st.mode === "reps" && (d.weightAdded || st.sets.some((x) => x.kg > 0))) { st.mode = "weight"; st.weightAdded = true; }
  }
  if (draft.focus) focusExerciseId = draft.focus;
  if (!draftSeen.has(iso)) toast("Eingaben von vorhin wiederhergestellt");
  draftSeen.add(iso);
}

// ---------- Fokus und Ansage (Markup 11.13) ----------
// Fokus nach dem Neuzeichnen: dorthin, wo die Bedienung weitergeht, nie auf body.
function applyKraftFocus(f) {
  if (!f) return;
  const q = (sel) => main.querySelector(sel);
  const attr = (v) => CSS.escape(String(v));
  let el = null;
  if (f.kind === "primary") el = q('[data-card="now"] .sd-btn--primary:not([disabled])');
  else if (f.kind === "item") el = q(`${f.via === "dot" ? ".sd-dots__seg" : ".sd-order__row"}[data-slug="${attr(f.slug)}"]`);
  else if (f.kind === "stepper") el = q(".sd-set--active [data-action='step']:not([disabled])");
  else if (f.kind === "step") {
    el = q(`.sd-set--active [data-action="step"][data-field="${attr(f.field)}"][data-dir="${attr(f.dir)}"]:not([disabled])`)
      ?? q(`.sd-set--active [data-action="step"][data-field="${attr(f.field)}"]:not([disabled])`);
  } else if (f.kind === "value") el = q(`.sd-set--active [data-action="edit-value"][data-field="${attr(f.field)}"]`);
  else if (f.kind === "input") { el = q(".sd-stepper__input"); el?.select?.(); }
  else if (f.kind === "selector") el = q(f.selector);
  if (!el && f.kind === "primary") return; // „Speichert …“ ist deaktiviert; der nächste Zeichenlauf setzt den Fokus
  // preventScroll: der Fokus darf die Seite nicht verschieben (die Position bleibt, Markup 11.2/11.6)
  (el ?? q(".sd-main button:not([disabled])"))?.focus({ preventScroll: true });
}

// Live-Region liegt in #app, außerhalb der neu geschriebenen Knoten; der Text
// kommt erst im nächsten Frame, sonst liest ein neu eingefügter Knoten nichts vor.
function ensureKraftLive() {
  if (document.getElementById("kraftLive")) return;
  const live = document.createElement("p");
  live.id = "kraftLive";
  live.className = "sd-vh";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  document.getElementById("app").appendChild(live);
}

function announceKraft(text) {
  const live = document.getElementById("kraftLive");
  if (!live) return;
  live.textContent = "";
  requestAnimationFrame(() => { live.textContent = text; });
}

// ---------- Eingabe: Stepper und direkte Eingabe (V1) ----------
const STEP_KIND = { kg: "kg", reps: "reps", sec: "time" };
const FIELD_NAME = { kg: "Gewicht", reps: "Wiederholungen", sec: "Sekunden" };
const FIELD_UNIT = { kg: " kg", reps: "", sec: " s" };

function setField(st, i, field, value) {
  if (field === "kg") st.sets = applyWeightForward(st.sets, i, value);
  else st.sets = st.sets.map((s, idx) => (idx === i ? { ...s, reps: value } : s));
}

function fieldValue(st, i, field) {
  const s = st.sets[i];
  return (field === "kg" ? s?.kg : s?.reps) ?? 0;
}

// Geprüfter Zahlenwert aus dem Eingabetext; ungültig = null (alter Wert bleibt).
function parseFieldValue(text, field) {
  const n = numOrNull(text);
  if (n == null || n < 0 || n > MAX_VALUE) return null;
  return field === "kg" ? Math.round(n * 10) / 10 : Math.round(n);
}

// Wert aus dem offenen Eingabefeld in den aktiven Satz schreiben (idempotent).
function applyEditing(st) {
  const input = main.querySelector(".sd-stepper__input");
  const text = input ? input.value : st.editing.text;
  const v = parseFieldValue(text, st.editing.field);
  if (v != null && st.activeIndex != null) setField(st, st.activeIndex, st.editing.field, v);
}

// Offenes Eingabefeld übernehmen und schließen (Enter, Fertig, Tipp auf ±, anderer Satz …).
function commitEditing(st) {
  if (!st?.editing) return;
  applyEditing(st);
  st.editing = null;
}

function kraftStep(field, dir) {
  const st = focusedState();
  if (!st || st.activeIndex == null || st.saving || !STEP_KIND[field]) return;
  commitEditing(st);
  const i = st.activeIndex;
  const v = stepValue(STEP_KIND[field], fieldValue(st, i, field), dir);
  setField(st, i, field, v);
  paintKraft({ kind: "step", field, dir: String(dir) });
  announceKraft(`${FIELD_NAME[field]} ${kraftView.fmtNum(v)}${FIELD_UNIT[field]}`);
}

function kraftEditValue(field) {
  const st = focusedState();
  if (!st || st.activeIndex == null || st.saving || !STEP_KIND[field]) return;
  commitEditing(st);
  st.editing = { field, text: kraftView.fmtNum(fieldValue(st, st.activeIndex, field)) };
  paintKraft({ kind: "input" });
}

function kraftCommitValue() {
  const st = focusedState();
  if (!st?.editing) return;
  const { field } = st.editing;
  commitEditing(st);
  paintKraft({ kind: "value", field });
}

function kraftCancelValue() {
  const st = focusedState();
  if (!st?.editing) return;
  const { field } = st.editing;
  st.editing = null;
  paintKraft({ kind: "value", field });
}

// Fokus verlässt das Feld: Wert still übernehmen, aber nicht sofort neu zeichnen.
// Ein Tipp auf „Satz fertig“ blurt das Feld zuerst; würde der Knopf dabei ersetzt,
// ginge der Tipp ins Leere. Jede Aktion zeichnet ohnehin neu; sonst räumt der Timer auf.
let editBlurTimer = null;
function kraftBlurValue() {
  const st = focusedState();
  if (!st?.editing) return;
  applyEditing(st);
  persistKraftDraft();
  clearTimeout(editBlurTimer);
  editBlurTimer = setTimeout(() => {
    const open = focusedState();
    if (!kraftOpen || editMode || !open?.editing) return; // inzwischen hat eine Aktion neu gezeichnet
    open.editing = null;
    paintKraft();
  }, 400);
}

function kraftAddWeight() {
  const st = focusedState();
  if (!st || st.mode !== "reps" || st.saving) return;
  commitEditing(st);
  st.mode = "weight";
  st.weightAdded = true;
  st.sets = st.sets.map((s) => ({ ...s, kg: s.kg ?? 0 }));
  paintKraft({ kind: "value", field: "kg" });
}

// ---------- Ablauf: Satz fertig, Übung wechseln, speichern ----------
function snapshotOf(st) {
  return JSON.parse(JSON.stringify({ sets: st.sets, activeIndex: st.activeIndex, saved: st.saved, savedSets: st.savedSets }));
}

function kraftFocusExercise(slugName, via) {
  const st = logState.get(slugName);
  if (!st) return;
  commitEditing(focusedState());
  focusExerciseId = slugName;
  // Eine gespeicherte Übung mit offenen Sätzen (vorzeitig abgeschlossen) wird wieder bedienbar.
  if (st.activeIndex == null && !st.saving && firstUndone(st.sets) !== -1) st.activeIndex = firstUndone(st.sets);
  paintKraft({ kind: "item", slug: slugName, via });
  announceKraft(`Jetzt: ${st.name}.`);
}

function kraftFinishSet() {
  const st = focusedState();
  if (!st || st.saving || st.activeIndex == null) return;
  commitEditing(st);
  const i = st.activeIndex;
  const snapshot = snapshotOf(st);
  st.sets = st.sets.map((s, idx) => (idx === i ? { ...s, done: true } : s));
  const after = st.sets.findIndex((s, idx) => idx > i && !s.done);
  const next = after !== -1 ? after : firstUndone(st.sets);
  if (next === -1) return saveKraftExercise(st, snapshot);
  st.activeIndex = next;
  paintKraft({ kind: "primary" });
  announceKraft(`Satz ${i + 1} fertig. Als Nächstes Satz ${next + 1}.`);
}

// „Mit n Sätzen abschließen“: gespeichert werden nur die fertigen Sätze (Auflage C1).
function kraftFinishEarly() {
  const st = focusedState();
  if (!st || st.saving || st.activeIndex == null || !st.sets.some((s) => s.done)) return;
  commitEditing(st);
  saveKraftExercise(st, snapshotOf(st));
}

function kraftReopenSet(index) {
  const st = focusedState();
  if (!st || st.saving || !st.sets[index]?.done) return;
  commitEditing(st);
  st.sets = st.sets.map((s, idx) => (idx === index ? { ...s, done: false } : s));
  st.activeIndex = index;
  paintKraft({ kind: "stepper" });
  announceKraft(`Satz ${index + 1} wieder geöffnet.`);
}

function kraftNextExercise(slugName) {
  kraftFocusExercise(slugName, "primary");
  applyKraftFocus({ kind: "primary" });
}

function kraftFinishSession() {
  if (currentKraftDay.iso) draftRemove(currentKraftDay.iso);
  state.selectedDate = null;
  render();
}

function weekForLog(dateISO) {
  // Woche immer aus Datum + Plan ableiten (F0a Punkt 6). Kraft-Log-Einträge
  // gibt es nur an Krafttagen einer ausformulierten Woche, deshalb ist hier
  // immer ein Plan aktiv — die Woche wird trotzdem nie als null geschrieben
  // (Lücke aus dem Architektur-Review, explizit abgesichert).
  const planForDate = activePlanFor(dateISO, plans);
  const week = planForDate ? weekNumberFor(planForDate, dateISO) : null;
  if (week == null) console.error("Kein Plan/keine Woche für Kraft-Log am " + dateISO + " — sollte nicht vorkommen.");
  return week;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Speichert die fertigen Sätze über den bestehenden Weg (saveLog, gleiches Payload).
// Optimistisch: „Speichert …“ steht höchstens SAVE_OPTIMISTIC_MS, danach gilt die
// Übung als gespeichert. Fehler (sofort oder später) nehmen alles zurück.
async function saveKraftExercise(st, snapshot) {
  const { iso } = currentKraftDay;
  const gen = kraftGen;
  // Eigene Referenz: eine späte Rücknahme darf die Map eines neueren Kraft-Tags nicht ändern.
  const savedMap = kraftSaved;
  const payload = buildLogPayload({
    week: weekForLog(iso), name: st.name, soll: st.soll, custom: st.custom,
    sets: st.sets.filter((s) => s.done), mode: st.mode,
  });
  st.saving = true;
  st.saveError = null;
  st.activeIndex = null;
  paintKraft({ kind: "primary" });

  const write = (async () => saveLog(iso, st.slug, payload))().then(() => null, (err) => err ?? new Error("Unbekannter Fehler"));
  const early = await Promise.race([write, sleep(SAVE_OPTIMISTIC_MS).then(() => null)]);
  if (early) return rollbackSave(st, snapshot, early, gen, savedMap);

  st.saving = false;
  st.saved = true;
  st.savedSets = payload.sets;
  savedMap[st.slug] = { completed: true, sets: payload.sets };
  write.then((err) => { if (err) rollbackSave(st, snapshot, err, gen, savedMap); });
  if (!kraftOpen || gen !== kraftGen) return;

  const list = [...logState.values()];
  const next = nextOpenExercise(list.map((s) => s.slug), st.slug, Object.fromEntries(list.map((s) => [s.slug, s.saved])));
  announceKraft(next ? `${st.name} gespeichert. Als Nächstes ${logState.get(next).name}.` : "Alle Übungen erfasst.");
  paintKraft(focusExerciseId === st.slug ? { kind: "primary" } : null);
}

function rollbackSave(st, snapshot, err, gen, savedMap) {
  console.error(err);
  Object.assign(st, snapshot, { saving: false, saveError: err.message || String(err) });
  delete savedMap[st.slug];
  if (snapshot.saved) savedMap[st.slug] = { completed: true, sets: snapshot.savedSets };
  toast("Speichern fehlgeschlagen: " + st.saveError, true);
  if (!kraftOpen || gen !== kraftGen || editMode) return;
  focusExerciseId = st.slug;
  paintKraft({ kind: "primary" });
}

// ---------- Löschen (Bestätigungs-Sheet, Markup 11.15) ----------
// Was gelöscht wird, steht beim Öffnen fest (pendingDelete) und ist genau das, was das
// Sheet zeigt. Optimistisch wie das Speichern: „Löscht …“ steht höchstens
// SAVE_OPTIMISTIC_MS, danach gilt der Eintrag als gelöscht und wird nur bei einem
// späten Fehler zurückgenommen. Neue Objekte statt Mutation, damit ein später
// rollbackSave einer früheren Speicherung nichts zurückholt (Architektur-Review D2 bis D7).
const confirmSheet = createSheet("confirmSheet", "confirmBackdrop");
let pendingDelete = null; // { kind: "entry"|"day", iso, slugs, gen }
let deleteBusy = false;   // früher Abschnitt eines Löschens läuft (D7)

const deleteDateText = (iso) => `${dayNameDE(iso)}, ${shortDate(iso)}`;
const anySaving = () => [...logState.values()].some((st) => st.saving);

// Löschknöpfe der Seite direkt umschalten, ohne neu zu zeichnen (Fokus bleibt).
function syncDeleteButtons() {
  document.querySelectorAll('#main [data-action="open-delete-entry"], #main [data-action="open-delete-day"]')
    .forEach((b) => { b.disabled = deleteBusy || (b.dataset.action === "open-delete-day" ? anySaving() : !!logState.get(b.dataset.slug)?.saving); });
}

function setConfirmBusy(busy) {
  const del = document.getElementById("confirmSheetDelete");
  const cancel = document.getElementById("confirmSheetCancel");
  if (busy) document.getElementById("confirmSheetTitle")?.focus(); // vor dem Deaktivieren, sonst fällt der Fokus auf body
  del.disabled = busy;
  cancel.disabled = busy;
  if (busy) del.setAttribute("aria-busy", "true"); else del.removeAttribute("aria-busy");
  del.textContent = busy ? "Löscht …" : "Löschen";
}

function openDeleteSheet(kind, trigger, slugName) {
  if (!kraftOpen || kraftLoadError || deleteBusy) return;
  const { iso } = currentKraftDay;
  let op;
  let body;
  if (kind === "entry") {
    const st = logState.get(slugName);
    if (!st?.saved || st.saving) return;
    op = { kind, iso, slugs: [st.slug], gen: kraftGen };
    body = kraftView.confirmBodyHTML({ kind, name: st.name, dateText: deleteDateText(iso), summary: kraftView.summaryText(st.savedSets, st.mode) });
  } else return;
  pendingDelete = op;
  setConfirmBusy(false);
  document.getElementById("confirmSheetTitle").textContent = kraftView.confirmTitle(kind);
  document.getElementById("confirmSheetBody").innerHTML = body;
  confirmSheet.open(trigger);
}

// Schreibt das Löschen und gibt Fehler als Wert zurück (nie als Ausnahme).
function runDelete(op) {
  const call = op.kind === "day" ? () => deleteLogsForDate(op.iso, op.slugs) : () => deleteLog(op.iso, op.slugs[0]);
  return (async () => call())().then(() => null, (err) => err ?? new Error("Unbekannter Fehler"));
}

async function confirmDelete() {
  const op = pendingDelete; // D2: eingefrorene Operation, nichts liest pendingDelete danach neu
  if (!op || deleteBusy) return;
  pendingDelete = null;
  deleteBusy = true;
  setConfirmBusy(true);
  syncDeleteButtons();

  const write = runDelete(op);
  const early = await Promise.race([write, sleep(SAVE_OPTIMISTIC_MS).then(() => null)]);
  deleteBusy = false;
  syncDeleteButtons();
  if (early) { // früher Fehler: lokal hat sich nichts geändert
    console.error(early);
    toast("Löschen fehlgeschlagen: " + (early.message || early), true);
    confirmSheet.close();
    return;
  }
  const undo = applyDelete(op);
  write.then((err) => { if (err) rollbackDelete(op, undo, err); });
}

// Daten- und Ansichtsteil getrennt (D3): allLogs und der Entwurf gelten immer, der Rest
// nur, wenn dieser Kraft-Tag noch offen ist. Liefert, was für eine Rücknahme nötig ist.
function applyDelete(op) {
  const undo = {
    saved: kraftSaved, allLogs, logState: new Map(logState),
    appliedLogs: null, appliedSaved: null, appliedStates: new Map(),
  };
  if (allLogs) allLogs = withoutLogs(allLogs, op.iso, op.slugs);
  undo.appliedLogs = allLogs;
  const live = op.gen === kraftGen && kraftOpen && currentKraftDay.iso === op.iso;
  const wasOpen = confirmSheet.isOpen();
  if (!live) {
    confirmSheet.close();
    toast("Eintrag gelöscht");
    return undo;
  }

  const next = { ...kraftSaved };
  for (const s of op.slugs) delete next[s];
  kraftSaved = next;
  undo.appliedSaved = next;
  for (const s of op.slugs) {
    const old = logState.get(s);
    if (!old) continue;
    const fresh = buildExerciseState(old, null, op.iso);
    undo.appliedStates.set(s, fresh);
    logState.set(s, fresh);
  }
  if (wasOpen) focusExerciseId = op.slugs[0];
  confirmSheet.close(); // D6: zuerst das Sheet, danach der App-Fokus
  paintKraft(wasOpen ? { kind: "primary" } : null);
  const name = logState.get(op.slugs[0])?.name;
  toast("Eintrag gelöscht");
  announceKraft(`Eintrag ${name} gelöscht`);
  return undo;
}

// D4: nur zurücksetzen, wenn der Speicher noch genau das ist, was das Löschen gesetzt hat.
function rollbackDelete(op, undo, err) {
  console.error(err);
  toast("Löschen fehlgeschlagen: " + (err.message || String(err)), true);
  const logsSame = allLogs === undo.appliedLogs;
  const dayOpen = kraftOpen && currentKraftDay.iso === op.iso;
  // kraftSaved wird beim Speichern in place geändert: die Referenz allein reicht nicht,
  // ein Schlüssel der gelöschten Übungen bedeutet eine neue Speicherung (Fall D9 b).
  // Dasselbe gilt für den Zustand: eine inzwischen gestartete oder fertige Speicherung
  // derselben Übung (saving/saved) ist neuer als der alte Stand und darf nicht überschrieben werden.
  const statesSame = [...undo.appliedStates].every(([s, fresh]) => logState.get(s) === fresh && !fresh.saving && !fresh.saved);
  const savedSame = !!undo.appliedSaved && kraftSaved === undo.appliedSaved && op.slugs.every((s) => !kraftSaved[s]) && statesSame;
  if (logsSame && savedSame) {
    kraftSaved = undo.saved;
    allLogs = undo.allLogs;
    for (const s of op.slugs) if (undo.logState.has(s)) logState.set(s, undo.logState.get(s));
    if (dayOpen && !editMode) { focusExerciseId = op.slugs[0]; paintKraft({ kind: "primary" }); }
    return;
  }
  if (logsSame && !undo.appliedSaved && !dayOpen) { allLogs = undo.allLogs; return; } // Tag war schon zu: nur die Daten zurück
  allLogs = null; // Firestore setzt den Cache bei Ablehnung selbst zurück: neu laden
  if (dayOpen) renderKraftDay(currentKraftDay.info, op.iso, kraftBackLabel);
}

// ---------- Übungen anpassen ----------
function toggleEditMode() {
  commitEditing(focusedState());
  editMode = !editMode;
  editForm = null;
  paintKraft({ kind: "selector", selector: '[data-action="toggle-edit"]' });
}

function persistDayPlan() {
  saveDayPlan(currentKraftDay.iso, dayPlan).catch((err) => {
    console.error(err);
    toast("Änderung an den Übungen nicht gespeichert: " + err.message, true);
  });
}

function removeExercise(slugName) {
  const st = logState.get(slugName);
  if (st?.custom) {
    const entry = dayPlan.added.find((ex) => slug(ex.name) === slugName);
    dayPlan.added = dayPlan.added.filter((ex) => slug(ex.name) !== slugName);
    // War es ein Tausch, soll die ursprüngliche Übung zurückkommen
    if (entry?.replaces) dayPlan.removed = dayPlan.removed.filter((x) => x !== entry.replaces);
  } else if (!dayPlan.removed.includes(slugName)) {
    dayPlan.removed.push(slugName);
  }
  refreshExercises({ kind: "selector", selector: `[data-action="restore-exercise"][data-slug="${CSS.escape(slugName)}"]` });
}

function restoreExercise(slugName) {
  dayPlan.removed = dayPlan.removed.filter((s) => s !== slugName);
  refreshExercises({ kind: "selector", selector: `[data-action="remove-exercise"][data-slug="${CSS.escape(slugName)}"]` });
}

function openAddForm() {
  editForm = { kind: "add", name: "", soll: "", error: null };
  paintKraft({ kind: "selector", selector: "#new-ex-name" });
}

function openReplaceForm(slugName) {
  const st = logState.get(slugName);
  if (!st) return;
  editForm = { kind: "replace", slug: slugName, name: "", soll: st.soll, error: null };
  paintKraft({ kind: "selector", selector: "#rep-ex-name" });
}

function closeEditForm(returnSelector) {
  editForm = null;
  paintKraft({ kind: "selector", selector: returnSelector });
}

function addExercise(replaces = null) {
  const nameEl = document.getElementById(replaces ? "rep-ex-name" : "new-ex-name");
  const sollEl = document.getElementById(replaces ? "rep-ex-soll" : "new-ex-soll");
  const name = (nameEl?.value || "").trim();
  const soll = (sollEl?.value || "").trim() || "3x8-10";
  const base = { kind: replaces ? "replace" : "add", slug: replaces, name, soll: (sollEl?.value || "").trim() };
  const fail = (error) => {
    editForm = { ...base, error };
    paintKraft({ kind: "selector", selector: replaces ? "#rep-ex-name" : "#new-ex-name" });
  };
  if (!name) return fail("Bitte einen Namen eingeben.");
  const s = slug(name);
  if (!s) return fail("Der Name ergibt keine gültige Übung.");
  if (logState.has(s)) return fail("Diese Übung steht heute schon auf der Liste.");
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
  editForm = null;
  refreshExercises({ kind: "selector", selector: replaces ? `.sd-edit__row[data-slug="${CSS.escape(s)}"] button` : '[data-action="quick-add"]' });
}

// Eingaben der übrigen Übungen behalten, Liste neu aufbauen
function refreshExercises(focus = null) {
  const prev = new Map(logState);
  buildLogState(effectiveExercises(currentKraftDay.info), currentKraftDay.iso, prev);
  if (!logState.has(focusExerciseId)) focusExerciseId = pickInitialFocus();
  persistDayPlan();
  paintKraft(focus);
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
    paintBanners();
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

// ---- Lauf-Tag (Stride E6): Zustand ----
// Kopf und Plan-Hinweis stehen sofort da, nur #strava-slot lädt nach. runOpen sagt,
// ob der Lauf-Tag gerade die Seite ist; runGen verwirft späte Antworten einer alten
// Öffnung. Das Markup liefert view-run.js, hier nur Zustand, Laden und Verdrahtung.
const assignSheet = createSheet("assignSheet", "assignBackdrop");
let runOpen = false;
let runGen = 0;
let runDay = { iso: null, info: null, backLabel: "Heute" };
let assignBusy = false; // "Neu laden" im Sheet läuft

function setRunLink(planDate, activityId) {
  runLinks[planDate] = { activityId };
  recomputeAssignment();
  afterRunLinkChange({ ignored: activityId === null });
  saveRunLink(planDate, activityId).catch((err) => {
    console.error(err);
    toast("Zuordnung nicht gespeichert: " + err.message, true);
  });
}

function resetRunLink(planDate) {
  delete runLinks[planDate];
  recomputeAssignment();
  afterRunLinkChange({ ignored: false });
  clearRunLink(planDate).catch((err) => {
    console.error(err);
    toast("Zuordnung nicht zurückgesetzt: " + err.message, true);
  });
}

// Erst den Slot neu schreiben, dann das Sheet schließen: so findet das Sheet den
// neuen Auslöser (pick-run + data-date) und gibt ihm den Fokus (Auflage C6).
function afterRunLinkChange({ ignored }) {
  if (runOpen) paintRunSlot();
  assignSheet.close();
  if (!runOpen) return;
  if (ignored) document.querySelector('#strava-slot [data-action="reset-run"]')?.focus();
  else keepRunFocus();
}

// Fokus nie auf body fallen lassen: sonst auf die erste Aktion im Slot, zuletzt auf den Titel.
function keepRunFocus() {
  const a = document.activeElement;
  if (a && a !== document.body && a.isConnected) return;
  (document.querySelector('#strava-slot [data-action="pick-run"]') || document.querySelector("#main h1"))?.focus();
}

function runSlotViewModel() {
  const { iso, info } = runDay;
  return {
    iso, info, isLong: isLongRun(info), past: iso < todayISO(),
    workerConfigured: isWorkerConfigured,
    error: stravaState.error, errorSource: stravaState.errorSource, connected: stravaState.connected,
    assignment: runAssignment[iso], THRESHOLDS, formatDuration,
  };
}

// Schreibt Slot und (falls nötig) Kopf aus dem aktuellen Zustand. Der Kopf wird nur
// angefasst, wenn sich die Ziel-Zeile ändert, damit der Fokus auf "Zurück" bleibt.
function paintRunSlot() {
  const slot = document.getElementById("strava-slot");
  if (!slot) return;
  const { html, showTarget } = runView.slotState(runSlotViewModel());
  paintRunHead(showTarget);
  slot.innerHTML = html;
}

function paintRunHead(showTarget) {
  const { iso, info, backLabel } = runDay;
  const head = runView.headHTML({ iso, info, isLong: isLongRun(info), backLabel, showTarget });
  if (head !== pageHeadHTML) setPageHead(head);
}

async function renderRunDay(info, iso, backLabel) {
  runOpen = true;
  const gen = ++runGen;
  runDay = { iso, info, backLabel };
  assignBusy = false;
  setPageHead(runView.headHTML({ iso, info, isLong: isLongRun(info), backLabel, showTarget: true }));
  renderMain(runView.pageHTML({ slotHTML: runView.loadingHTML(), note: info.note }));

  await loadStrava();
  if (gen !== runGen || !runOpen) return; // Nutzer hat inzwischen weitergeklickt
  paintRunSlot();
}

function paintAssignBody() {
  const { iso } = runDay;
  const a = runAssignment[iso];
  document.getElementById("assignSheetBody").innerHTML = runView.sheetBodyHTML({
    iso,
    options: runView.pickerOptions(stravaState.runs || [], runAssignment, iso),
    selectedId: a?.run?.id,
    source: a?.source,
    busy: assignBusy,
  });
}

function openAssignSheet(iso, trigger) {
  if (!runOpen || iso !== runDay.iso) return;
  document.getElementById("assignSheetTitle").textContent = runView.sheetTitle(iso);
  paintAssignBody();
  assignSheet.open(trigger);
}

// Tipp auf einen Lauf im Sheet: der schon zugeordnete schließt ohne Änderung.
function chooseRun(target) {
  const iso = target.dataset.date;
  if (String(runAssignment[iso]?.run?.id) === target.dataset.run) return assignSheet.close();
  setRunLink(iso, Number(target.dataset.run));
}

// "Neu laden" auf dem Lauf-Tag. Im Sheet bleibt es offen (Knopf gesperrt, danach nur
// der Körper neu); im Slot erscheint wieder der Platzhalter, der Kopf bleibt stehen.
async function reloadRunDay(target) {
  const inSheet = !!target.closest("#assignSheet");
  const gen = runGen;
  if (inSheet) {
    assignBusy = true;
    paintAssignBody();
    document.querySelector('#assignSheet [data-action="reload-strava"]')?.focus();
  } else {
    document.getElementById("strava-slot").innerHTML = runView.loadingHTML();
    document.querySelector("#main h1")?.focus(); // der Auslöser ist weg: Fokus auf den Titel (tabindex -1)
  }
  await loadStrava({ force: true });
  recomputeAssignment();
  assignBusy = false;
  if (gen !== runGen || !runOpen) return;
  paintRunSlot();
  if (inSheet && assignSheet.isOpen()) {
    paintAssignBody();
    document.querySelector('#assignSheet [data-action="reload-strava"]')?.focus();
  } else {
    keepRunFocus();
  }
}

// ---------- Woche ----------
// Der Wochen-Tab arbeitet auf dem (einzigen) Plan der Registry; Mehrplan-
// Unterstützung ist Teil von Schritt 2. Rendering steht in view-week.js, hier
// nur Datenaufbereitung, State und Verdrahtung (Auflage C5).

// Status einer Tageszeile, genau eine Variante. Rangfolge (Anforderungen 4.8,
// Entscheid E4): verpasst > HF zu hoch > zu kurz > nachgeholt > teilweise >
// erledigt > Heute > optional > Zukunft. Weitere Gründe stehen in den
// Detailzeilen. Ein künftiger Plantag bleibt "offen", auch wenn ein Lauf
// vorab zugeordnet wäre (wie bisher).
function weekRunStatus(info, run, offset, { isToday, isFuture }) {
  const kind = isLongRun(info) ? "long" : "lauf";
  if (isFuture) return { key: "future", kind };
  if (!run) return { key: isToday ? "today" : "missed", kind };
  if (metrics.isZoneRun(info) && hrStatus(run.avgHr, info.hfMax) === "warn") return { key: "hf", kind };
  if (distanceStatus(run.distanceKm, info.km, THRESHOLDS) === "zuKurz") return { key: "short", kind };
  if (offset !== 0) return { key: "moved", kind };
  return { key: "done", kind };
}

function weekKraftStatus(info, { done, total }, { isToday, isFuture }) {
  const kind = "kraft";
  if (isFuture) return { key: "future", kind };
  if (total > 0 && done === total) return { key: "done", kind };
  if (done > 0) return { key: isToday ? "todayPartial" : "partial", kind, done, total };
  if (isToday) return { key: "today", kind };
  return { key: info.optional ? "optional" : "missed", kind };
}

function weekKraftRow(info, iso, flags, logs, dps, deload) {
  const { exercises, withLogs, done, total } = kraftProgressOn(info, dps[iso], logs);
  const { isToday, isFuture } = flags;

  const lines = [{ text: `Ziel: ${total} Übungen${info.optional ? " (optional)" : ""}` }];
  if (done === 0) {
    lines.push({ text: `Übungen: ${exercises.map((e) => e.name).join(", ")}` });
  } else {
    for (const { ex, log } of withLogs) {
      const value = !log ? "–"
        : log.topKg > 0 ? `${log.topKg} kg · ${log.totalReps ?? 0} Wdh`
        : `${log.totalReps ?? 0} Wdh`;
      lines.push({ text: `${ex.name}: ${value}` });
    }
  }
  if (!isFuture && !isToday && done === 0) {
    lines.push(info.optional
      ? { tone: "warn", text: "Optional, nicht geloggt: zählt weder im Wochensoll noch als verpasst." }
      : { tone: "danger", text: "Nicht geloggt, zählt als verpasst." });
  } else if (!isFuture && !isToday && done < total) {
    lines.push({ tone: "warn", text: `Teilweise geloggt (${done}/${total}).` });
  }

  const subParts = [done > 0 ? `${done}/${total} erfasst` : `${total} Übungen`];
  if (info.optional) subParts.push("Optional");
  if (deload) subParts.push("Deload");
  return {
    stripe: "kraft", title: info.label, sub: subParts.join(" · "), lines,
    status: weekKraftStatus(info, { done, total }, flags),
  };
}

function weekRunRow(info, iso, flags) {
  const a = runAssignment[iso];
  const run = a?.run;
  const offset = a?.offset ?? 0;
  const lines = [{ text: `Ziel: ${info.dist} · ${info.pace} · HF ${info.hf}` }];
  if (info.note) lines.push({ tone: "warn", text: info.note });
  if (run) {
    lines.push({ text: `Ist: ${metrics.formatKm1(run.distanceKm)} km · ${run.paceLabel}${run.avgHr ? ` · Ø ${run.avgHr} bpm` : ""}` });
    if (metrics.isZoneRun(info) && hrStatus(run.avgHr, info.hfMax) === "warn") {
      lines.push({ tone: "warn", text: `Ø HF über der Zone (höchstens ${info.hfMax} bpm).` });
    }
    if (distanceStatus(run.distanceKm, info.km, THRESHOLDS) === "zuKurz") {
      lines.push({ tone: "warn", text: `Kürzer als geplant: ${metrics.formatKm1(run.distanceKm)} von ${info.dist}.` });
    }
    if (offset !== 0) lines.push({ text: `${dayNameDE(run.date)}, ${shortDate(run.date)}: ${offsetLabel(offset)}` });
  } else if (!flags.isFuture && !flags.isToday) {
    lines.push({ tone: "danger", text: "Kein Lauf zugeordnet, zählt als verpasst." });
  }
  return {
    stripe: isLongRun(info) ? "long" : "lauf",
    title: `${info.type} · ${info.dist}`,
    sub: run ? `Ist: ${metrics.formatKm1(run.distanceKm)} km · ${run.paceLabel}` : `Ziel: ${info.pace}`,
    lines,
    status: weekRunStatus(info, run, offset, flags),
  };
}

// Zeilenmodell für view-week.js. Ruhetage tragen nur die Kopfdaten (isRest).
function weekRowModel(plan, iso, today, logs, dps, { deload, isOpen }) {
  const info = sessionOn(plan, iso);
  const head = {
    iso, isOpen, isToday: iso === today,
    dow: dayNameDE(iso), dowLong: dayLongDE(iso), dayOfMonth: `${iso.slice(8, 10)}.`,
  };
  if (info.kind === "ruhe") return { ...head, isRest: true };
  const flags = { isToday: iso === today, isFuture: iso > today };
  const body = info.kind === "kraft"
    ? weekKraftRow(info, iso, flags, logs, dps, deload)
    : weekRunRow(info, iso, flags);
  return { ...head, isRest: false, ...body };
}

// Summen der Woche (Zählregeln unverändert aus M2-7): optionale Kraft zählt
// nur mit, wenn sie erledigt ist; Ist-km nur, wenn Strava Daten geliefert hat.
function weekSumsModel(week, logs, dps) {
  const laufSessions = week.sessions.filter((s) => s.kind === "lauf");
  const kraftCounted = week.sessions.filter((s) => s.kind === "kraft")
    .map((s) => ({ s, complete: kraftProgressOn(s, dps[s.date], logs).complete }))
    .filter(({ s, complete }) => metrics.countsTowardPlan(s, complete));
  return {
    sollKm: laufSessions.reduce((a, s) => a + s.km, 0),
    istKm: stravaReady() ? laufSessions.reduce((a, s) => a + (runAssignment[s.date]?.run?.distanceKm || 0), 0) : null,
    kraftDone: kraftCounted.filter((x) => x.complete).length,
    kraftPlanned: kraftCounted.length,
  };
}

// Nach dem Blättern landet der Fokus wieder auf dem gedrückten Pfeil (oder auf
// dem anderen, wenn der gerade gesperrt wurde), sonst ginge er mit dem
// Neuzeichnen verloren. Gesetzt vom Klick-Handler, geleert nach dem letzten Zeichnen.
let weekFocusAction = null;
function restoreWeekFocus() {
  if (!weekFocusAction) return;
  const other = weekFocusAction === "week-prev" ? "week-next" : "week-prev";
  const el = document.querySelector(`[data-action="${weekFocusAction}"]:not([disabled])`)
    ?? document.querySelector(`[data-action="${other}"]:not([disabled])`);
  el?.focus();
}

function paintWeek(html) {
  renderMain(html);
  restoreWeekFocus();
}

function setWeekRowOpen(row, open) {
  row.classList.toggle("is-open", open);
  row.querySelector('[data-action="toggle-day-detail"]')?.setAttribute("aria-expanded", String(open));
  const detail = row.querySelector(".sd-day__detail");
  if (detail) detail.hidden = !open;
}

// Akkordeon: höchstens eine Zeile offen. Der Index (0..6 in der Woche) liegt im
// State, damit der Rücksprung aus dem Tag die Zeile wieder offen zeigt.
function toggleWeekDay(button) {
  const row = button.closest(".sd-day");
  const rows = [...row.parentElement.querySelectorAll(".sd-day")];
  const willOpen = !row.classList.contains("is-open");
  rows.forEach((r) => setWeekRowOpen(r, false));
  if (willOpen) setWeekRowOpen(row, true);
  state.openDayIndex = willOpen ? rows.indexOf(row) : null;
}

function goToWeek(weekNo, focusAction = null) {
  state.weekNo = weekNo;
  state.openDayIndex = null; // beim Wechsel der Woche sind alle Zeilen zu
  weekFocusAction = focusAction;
  return render();
}

async function renderWeek() {
  const plan = plans[0];
  const w = state.weekNo;
  const week = weekOf(plan, w);
  const today = todayISO();
  const start = weekStart(plan, w);

  setPageHead(dashWeek.weekHeadHTML({
    n: w,
    weekType: week.weekType,
    dateRange: dashWeek.weekRangeText(start, addDays(start, 6)),
    hasPrev: w > 1,
    hasNext: w < plan.totalWeeks,
    showToday: w !== weekNoForTab(today),
  }));

  if (week.placeholder) {
    const nextRecal = (plan.recalibrationDates || []).find((d) => d >= today);
    paintWeek(dashWeek.weekMainHTML(dashWeek.placeholderCardHTML({
      fromDate: nextRecal ? shortDate(nextRecal) : null,
      km: week.plannedKm ?? null,
    })));
    weekFocusAction = null;
    return;
  }

  paintWeek(dashWeek.weekLoadingHTML());
  // Ein Firestore-/Strava-Ausfall darf die Wochenliste nicht leer lassen
  // (F7-Prinzip): mit Planwerten weiterrendern, die Fehlerkarte oben nennt den
  // Grund. Die einzelnen Tage führen trotzdem in die Tagesansicht.
  try {
    await loadStrava();
  } catch (err) {
    console.error(err);
  }
  const { logs, dps } = await ensureAllLogsAndDayPlans();
  // Zwischenzeitlich weitergeklickt (anderer Tab/andere Woche)? Dann nicht
  // mehr in die falsche Ansicht schreiben.
  if (state.tab !== "woche" || state.selectedDate || state.weekNo !== w) return;

  const rows = weekDates(plan, w)
    .map((iso, i) => weekRowModel(plan, iso, today, logs, dps, { deload: !!week.deload, isOpen: state.openDayIndex === i }))
    .map((d) => (d.isRest ? dashWeek.restRowHTML(d) : dashWeek.dayRowHTML(d)))
    .join("\n  ");

  // F9/E7: Ist heute außerhalb der Planwochen (Rennlücke oder danach), gilt
  // die letzte Planwoche als Endpunkt — dort erscheint der Hinweis.
  const todayState = planDayState(today, plans);
  const planIsOver = todayState === "bisZumRennen" || (todayState === "keinPlan" && today > plan.start);
  const dataError = dataLoadError || (stravaState.errorSource === "firebase" ? stravaState.error : null);

  paintWeek(dashWeek.weekMainHTML(
    dataError ? dash.bannersHTML({ dataError }) : "",
    dashWeek.weekSumsHTML(weekSumsModel(week, logs, dps)),
    dashWeek.daysCardHTML(rows),
    planIsOver && w === plan.totalWeeks ? dashWeek.planBeendetHintHTML(plan.totalWeeks) : ""));
  weekFocusAction = null;
}

// ---------- Verlauf (Stride E7) ----------
// Kopf und Segment stehen sofort, nur #hist-slot lädt nach (view-history.js). histGen
// verwirft späte Antworten einer alten Anzeige, z. B. nach schnellem Moduswechsel.
let histGen = 0;

const exerciseChips = () => exerciseCatalog(plans[0]).map((e) => ({ name: e.name, slug: slug(e.name) }));

async function renderHistory() {
  const gen = ++histGen;
  const mode = state.historyMode;
  setPageHead(historyView.headHTML({ mode, exercises: exerciseChips(), activeSlug: state.historyExercise }));
  renderMain(historyView.pageHTML({
    slotHTML: mode === "kraft" ? historyView.strengthLoadingHTML() : historyView.runLoadingHTML(),
  }));
  if (mode === "kraft") scrollActiveChipIntoView();

  const html = mode === "kraft" ? await strengthHistoryHTML() : await runHistoryHTML();
  const slot = document.getElementById("hist-slot");
  if (gen !== histGen || !slot) return;
  slot.innerHTML = html;
}

function scrollActiveChipIntoView() {
  document.querySelector(".sd-filter__chip.is-active")?.scrollIntoView({ inline: "center", block: "nearest" });
}

// Der Kopf wird bei Moduswechsel und Übungswahl neu gebaut: der Fokus geht auf den neuen
// Schalter bzw. das neue Chip, nie auf body.
function focusHistoryControl(selector) {
  const el = document.querySelector(selector);
  el?.focus({ preventScroll: true });
  el?.scrollIntoView({ inline: "center", block: "nearest" });
}

// Läufe mit Plan-Typ und Long-Run-Kennzeichen aus der Zuordnung (Listentitel, Balkenfarbe).
function historyRuns(runs) {
  const byRun = new Map();
  for (const [date, a] of Object.entries(runAssignment)) {
    if (!a?.run) continue;
    const info = dayInfo(date);
    if (info.kind === "lauf") byRun.set(a.run.id, { planType: info.type, long: isLongRun(info) });
  }
  return (runs || []).map((r) => ({ ...r, ...(byRun.get(r.id) ?? { planType: null, long: false }) }));
}

async function runHistoryHTML() {
  const s = await loadStrava();
  return historyView.runSlotHTML({
    workerConfigured: isWorkerConfigured, error: s.error, errorSource: s.errorSource, connected: s.connected,
    runs: historyRuns(s.runs), today: todayISO(), planStart: plans[0].start, sinceISO: STRAVA_SINCE,
  });
}

async function strengthHistoryHTML() {
  const exSlug = state.historyExercise;
  const name = exerciseChips().find((e) => e.slug === exSlug)?.name ?? exSlug;
  let logs;
  try {
    logs = await loadLogsForExercise(exSlug);
  } catch (err) {
    return historyView.strengthErrorHTML(err.message);
  }
  return historyView.strengthSlotHTML({ name, slug: exSlug, logs, plan: plans[0], today: todayISO() });
}

// ---------- Plan (Stride E7) ----------
// Der Plan-Tab zeigt den (einzigen) Plan der Registry; Markup in view-plan.js, das Konto
// in view-account.js. Der Strava-Status im Konto lädt bei Bedarf nach und patcht nur die Karte.
function accountSectionHTML() {
  return renderAccountSection({
    email: currentUser.email,
    strava: {
      workerConfigured: isWorkerConfigured, connected: stravaState.connected, error: stravaState.error,
      fetchedAt: lastFetchedAt(), now: Date.now(),
    },
  });
}

function paintPlanAccount() {
  const card = document.querySelector('#main [data-card="account"]');
  if (!card || !currentUser || card.contains(document.activeElement)) return;
  const tpl = document.createElement("template");
  tpl.innerHTML = accountSectionHTML();
  card.replaceWith(tpl.content.querySelector('[data-card="account"]'));
}

function renderPlan() {
  const plan = plans[0];
  const today = todayISO();
  // Heute liegt praktisch immer in einer Planwoche; außerhalb (I3: vor dem Start
  // Woche 1/0 %, nach der letzten Planwoche "fertig") stürzt die Anzeige trotzdem nicht ab.
  const inWeek = weekNumberFor(plan, today);
  const w = inWeek ?? (today < plan.start ? 1 : plan.totalWeeks);
  const status = inWeek != null ? "in" : today < plan.start ? "before" : "after";
  const pct = Math.round((Math.max(0, w - 1) / plan.totalWeeks) * 100);

  setPageHead(planView.headHTML({ week: w, totalWeeks: plan.totalWeeks, pct }));
  renderMain(planView.pageHTML({
    plan, week: w, status, accountHTML: currentUser ? accountSectionHTML() : "",
  }));
  if (currentUser && isWorkerConfigured && stravaState.connected === null && !stravaState.error) {
    loadStrava().then(() => { if (state.tab === "plan") paintPlanAccount(); });
  }
}

// ---------- Interaktion ----------
document.getElementById("app").addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "reload") return location.reload();
  if (action === "logout") return logout(target);
  if (action === "export-data") return exportData(target);
  if (action === "forbidden-logout") return forbiddenLogout(target);
  if (action === "retry-pending") return init();
  if (action === "back") { state.selectedDate = null; return render(); }
  if (action === "toggle-day-detail") return toggleWeekDay(target);
  if (action === "open-day") { state.selectedDate = target.dataset.date; return render(); }
  if (action === "go-tab") return switchTab(target.dataset.tab);
  if (action === "open-info") {
    const c = INFO_CONTENT[target.dataset.info];
    if (c) openInfo(c.title, c.blocks, target);
    return;
  }
  if (action === "close-sheet") return closeOpenSheet();
  if (action === "open-delete-entry") return openDeleteSheet("entry", target, target.dataset.slug);
  if (action === "confirm-delete") return confirmDelete();
  if (action === "toggle-bilanz") {
    state.bilanzExpanded = !state.bilanzExpanded;
    renderCoachSlot();
    // Der Slot wurde neu gezeichnet: Fokus zurück auf den Auslöser.
    document.querySelector('[data-action="toggle-bilanz"]')?.focus();
    return;
  }
  if (action === "week-prev") return goToWeek(Math.max(1, state.weekNo - 1), action);
  if (action === "week-next") return goToWeek(Math.min(plans[0].totalWeeks, state.weekNo + 1), action);
  if (action === "week-today") return goToWeek(weekNoForTab(todayISO()));
  if (action === "toggle-edit") return toggleEditMode();
  if (action === "remove-exercise") return removeExercise(target.dataset.slug);
  if (action === "restore-exercise") return restoreExercise(target.dataset.slug);
  // Formulare: Klick und Enter führen zur selben Funktion; preventDefault verhindert das zweite submit
  if (action === "add-exercise") { e.preventDefault(); return addExercise(); }
  if (action === "confirm-replace") { e.preventDefault(); return addExercise(target.dataset.slug); }
  if (action === "quick-add") return openAddForm();
  if (action === "cancel-add") return closeEditForm('[data-action="quick-add"]');
  if (action === "replace-exercise") return openReplaceForm(target.dataset.slug);
  if (action === "cancel-replace") {
    return closeEditForm(`[data-action="replace-exercise"][data-slug="${CSS.escape(editForm?.slug ?? "")}"]`);
  }
  if (action === "focus-exercise") {
    return kraftFocusExercise(target.dataset.slug, target.classList.contains("sd-dots__seg") ? "dot" : "row");
  }
  if (action === "step") return kraftStep(target.dataset.field, Number(target.dataset.dir));
  if (action === "edit-value") return kraftEditValue(target.dataset.field);
  if (action === "commit-value") return kraftCommitValue();
  if (action === "add-weight") return kraftAddWeight();
  if (action === "finish-set") return kraftFinishSet();
  if (action === "finish-early") return kraftFinishEarly();
  if (action === "reopen-set") return kraftReopenSet(Number(target.dataset.set));
  if (action === "next-exercise") return kraftNextExercise(target.dataset.slug);
  if (action === "finish-session") return kraftFinishSession();
  if (action === "hist-mode") {
    state.historyMode = target.dataset.mode;
    render();
    return focusHistoryControl(`[data-action="hist-mode"][data-mode="${state.historyMode}"]`);
  }
  if (action === "pick-exercise") {
    state.historyExercise = target.dataset.slug;
    render();
    return focusHistoryControl(`[data-action="pick-exercise"][data-slug="${CSS.escape(state.historyExercise)}"]`);
  }
  if (action === "connect-strava") return startAuthorization();
  if (action === "pick-run") return openAssignSheet(target.dataset.date, target);
  if (action === "assign-run") return chooseRun(target);
  if (action === "ignore-run") return setRunLink(target.dataset.date, null);
  if (action === "reset-run") return resetRunLink(target.dataset.date);
  if (action === "reload-strava") {
    if (runOpen) return reloadRunDay(target);
    target.disabled = true;
    await loadStrava({ force: true });
    recomputeAssignment();
    return render();
  }
});

// Direkte Eingabe (V1) im Kraft-Tag: Enter übernimmt, Escape verwirft, Verlassen
// übernimmt still, Tippen hält den Text fürs Neuzeichnen fest.
const isValueInput = (e) => e.target instanceof Element && e.target.matches(".sd-stepper__input");
document.getElementById("app").addEventListener("keydown", (e) => {
  if (!isValueInput(e)) return;
  if (e.key === "Enter") { e.preventDefault(); kraftCommitValue(); }
  else if (e.key === "Escape") { e.preventDefault(); kraftCancelValue(); }
});
document.getElementById("app").addEventListener("input", (e) => {
  const st = focusedState();
  if (isValueInput(e) && st?.editing) st.editing.text = e.target.value;
});
document.getElementById("app").addEventListener("focusout", (e) => {
  if (isValueInput(e)) kraftBlurValue();
});

// Tabwechsel: Tab-Leiste und "go-tab" (Zum Plan, Diese Woche) teilen sich diesen Weg.
const TAB_KEYS = ["dashboard", "woche", "verlauf", "plan"];
function switchTab(tab) {
  if (!TAB_KEYS.includes(tab)) return;
  state.tab = tab;
  state.selectedDate = null;
  if (tab === "woche") { state.weekNo = weekNoForTab(todayISO()); state.openDayIndex = null; weekFocusAction = null; }
  render();
}

document.querySelectorAll("#tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ---------- Start ----------
// ---------- Zugang (Login-Gate, Schritt 1b) ----------
// Die Prüfung hier ist nur Bedienkomfort: den Schutz bilden Firestore-Regeln
// und Worker. Vor dem Zugang wird weder der Plan noch irgendein Firestore-
// Dokument geladen.
const appEl = document.getElementById("app");
const PENDING_WRITES_TIMEOUT_MS = 10000;
let currentUser = null; // { email, uid } der angemeldeten Sitzung

// Anmelde-, Fremdkonto- und Hinweisschirme: ohne Tableiste.
// Der Seitenkopf bleibt exakt leer (.sd-pagehead:empty); den einen h1 trägt die Karte.
function showGate(html) {
  appEl.classList.add("no-session");
  appEl.classList.remove("is-detail");
  setPageHead("");
  renderMain(html);
}

// invalid: Namen leerer Felder. Nach einem Fehler springt der Fokus auf das erste markierte
// Feld, sonst auf das Passwort (das Formular wurde ersetzt); ohne Fehler kein Fokus (keine Tastatur).
function showLogin(email = "", error = "", notice = "", invalid = []) {
  showGate(renderLogin({ email, error, notice, invalid }));
  if (!error) return;
  const form = main.querySelector('form[data-form="login"]');
  (form?.querySelector('[aria-invalid="true"]') ?? form?.querySelector("#login-password"))?.focus();
}

// Einmaliger Hinweis über das Neuladen hinweg (sessionStorage, nicht der
// geräumte localStorage): nach dem Abmelden mit offenem zweitem Tab.
const LOGOUT_NOTICE_KEY = "hm-tracker-notice";
const CACHE_KEPT_NOTICE =
  "Abgemeldet. Der Offline-Speicher dieses Geräts konnte nicht geleert werden, weil die App noch in einem anderen Tab offen ist. Bitte alle Tabs der App schließen.";

function takeLogoutNotice() {
  try {
    const text = sessionStorage.getItem(LOGOUT_NOTICE_KEY) || "";
    sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
    return text;
  } catch {
    return "";
  }
}

// Anonyme Altsitzung aus der Zeit vor dem Login: erst alle noch nicht
// gesendeten Einträge übertragen lassen (sie gehören diesem Nutzer und
// gingen sonst verloren), dann still abmelden. Bei Timeout nicht abmelden.
async function handleAnonymousSession() {
  showGate(renderGateWait("Einen Moment …"));
  const flushed = await raceTimeout(waitForPendingWrites(), PENDING_WRITES_TIMEOUT_MS);
  if (!flushed) return showGate(renderPendingWrites());
  try {
    await signOutUser();
  } catch (err) {
    console.error(err);
    return showGate(renderGateError(err.message));
  }
  showLogin();
}

// tone "danger" färbt den Hinweis, sonst bleibt er ruhig (Markup 14.5).
function setAccountStatus(text, tone = "") {
  const el = document.getElementById("account-status");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.className = "sd-notice " + (tone === "danger" ? "sd-notice--danger" : "sd-notice--quiet");
}

// "Abmelden" im Plan-Tab räumt das Gerät (E4). Offene Einträge: abbrechen,
// nichts löschen. Danach neu laden, damit keine Daten im Speicher bleiben.
async function logout(btn) {
  btn.disabled = true;
  setAccountStatus("Wird abgemeldet …");
  let res;
  try {
    res = await signOutAndWipeDevice();
    if (!res.ok) {
      setAccountStatus("Abmelden abgebrochen. Es gibt noch nicht übertragene Einträge. Bitte mit Netz erneut versuchen.", "danger");
      btn.disabled = false;
      return;
    }
  } catch (err) {
    console.error(err);
    setAccountStatus("Abmelden fehlgeschlagen: " + err.message, "danger");
    btn.disabled = false;
    return;
  }
  if (res.cacheCleared === false) {
    try { sessionStorage.setItem(LOGOUT_NOTICE_KEY, CACHE_KEPT_NOTICE); } catch { /* ohne Hinweis neu laden */ }
  }
  location.reload();
}

// tone "warn" (unvollständig) oder "danger" (Fehler); ohne tone neutral (Markup 14.5).
function setExportStatus(text, tone = "") {
  const el = document.getElementById("export-status");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.className = "sd-split__hint sd-split__status" + (tone ? " is-" + tone : "");
}

// Führt einen Teil des Exports aus. Scheitert er, wird der Grund als Warnung
// notiert und der Export läuft mit den übrigen Teilen weiter.
async function exportPart(label, warnings, load) {
  try {
    return await load();
  } catch (err) {
    console.error(err);
    // Strava-Meldungen enthalten Gedankenstriche, die hier nicht stehen sollen.
    warnings.push(warningText(label, err.message));
    return null;
  }
}

// "Strava: Strava-Abruf fehlgeschlagen" liest sich doppelt: beginnt die
// Meldung selbst mit dem Teilnamen, wird er nicht noch einmal vorangestellt.
function warningText(label, message) {
  const clean = message.replace(/\s+—\s+/g, ", ");
  if (clean.startsWith(`${label}-`)) return `${label}: ${clean.slice(label.length + 1)}`;
  if (clean.startsWith(`${label} `)) return clean;
  return `${label}: ${clean}`;
}

// Gibt die Datei weiter: Teilen-Blatt, wo das Gerät Dateien teilen kann
// (iPhone), sonst Download. Rückgabe false, wenn das Teilen abgebrochen wurde.
// Teilen-Blatt nur auf Touch-Geräten (iPhone/iPad): Safari auf dem Mac kann
// zwar auch teilen, dort will man die Datei aber einfach in den Downloads.
function prefersShareSheet() {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
}

async function deliverExportFile(file) {
  if (prefersShareSheet() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (err) {
      if (err?.name === "AbortError") return false; // bewusst abgebrochen, kein Fehler
      throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// "Daten exportieren" im Plan-Tab: lädt Strava, Logs, Tagesanpassungen und
// Lauf-Zuordnungen und gibt sie als JSON-Datei heraus.
async function exportData(btn) {
  btn.disabled = true;
  const warnings = [];
  try {
    setExportStatus("Lade Strava-Aktivitäten …");
    const strava = await exportPart("Strava", warnings, async () => {
      const acts = await fetchAllActivitiesForExport(EXPORT_SINCE);
      if (acts === null) throw new Error("Strava ist nicht verbunden.");
      return acts;
    });
    setExportStatus("Lade Kraft-Logs und Zuordnungen …");
    const logs = await exportPart("Kraft-Logs", warnings, loadAllLogs);
    const dayplans = await exportPart("Angepasste Übungslisten", warnings, loadAllDayPlans);
    const runLinks = await exportPart("Lauf-Zuordnungen", warnings, loadRunLinks);

    if ([strava, logs, dayplans, runLinks].every((p) => p === null)) {
      throw new Error("Es konnte nichts geladen werden. " + warnings.join(" "));
    }
    const now = new Date();
    const data = buildExport({
      now, version: appVersionFromUrl(import.meta.url), plan: plans[0],
      stravaActivities: strava, logs, dayplans, runLinks, warnings,
    });
    const file = new File([serializeExport(data)], exportFileName(now), { type: "application/json" });
    setExportStatus("Datei wird erstellt …");
    const delivered = await deliverExportFile(file);
    if (!delivered) setExportStatus("");
    else if (warnings.length) setExportStatus("Exportiert, aber unvollständig: " + warnings.join(" "), "warn");
    else setExportStatus("Export fertig.");
  } catch (err) {
    console.error(err);
    setExportStatus("Export fehlgeschlagen: " + err.message, "danger");
    toast("Export fehlgeschlagen: " + err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function forbiddenLogout(btn) {
  btn.disabled = true;
  try {
    await signOutUser();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    return;
  }
  location.reload();
}

appEl.addEventListener("submit", async (e) => {
  // Kraft-Formulare (Anpassen): der Klick auf den Submit-Knopf hat schon gehandelt und das submit verhindert.
  const kraftForm = e.target.closest('form[data-form="add-exercise"], form[data-form="replace"]');
  if (kraftForm) {
    e.preventDefault();
    return kraftForm.dataset.form === "replace" ? addExercise(editForm?.slug) : addExercise();
  }
  const form = e.target.closest('form[data-form="login"]');
  if (!form) return;
  e.preventDefault();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !password) {
    const invalid = [!email && "email", !password && "password"].filter(Boolean);
    return showLogin(email, "Bitte E-Mail und Passwort eingeben.", "", invalid);
  }
  form.querySelector('button[type="submit"]').disabled = true;
  form.setAttribute("aria-busy", "true");
  try {
    await signIn(email, password);
  } catch (err) {
    return showLogin(email, authErrorText(err.code));
  }
  // Im selben Seitenaufruf weitermachen (nicht neu laden): ein Strava-
  // Redirect mit ?code= muss den Login überleben (B4).
  await init();
});

async function init() {
  appEl.classList.add("no-session");
  setPageHead("");
  renderMain(renderGateWait("Prüfe Anmeldung …"));
  let user;
  try {
    user = await authReady();
  } catch (err) {
    console.error(err);
    renderMain(renderGateError(err.message));
    return;
  }
  const access = accessState(user, ALLOWED_UID);
  if (access === "signedOut") return showLogin("", "", takeLogoutNotice());
  if (access === "anonymous") return handleAnonymousSession();
  if (access === "forbidden") {
    return showGate(renderNoAccess({ email: user.email, uid: user.uid }));
  }
  currentUser = { email: user.email, uid: user.uid };
  appEl.classList.remove("no-session");
  await startApp();
}

async function startApp() {
  // Tab-Leiste zeigt sofort einen Zustand, auch während der Plan noch lädt.
  document.querySelector('[data-tab="dashboard"]').classList.add("active");
  setPageHead('<h1 class="sd-vh">Stride</h1>');
  renderMain(loadingCard("Plan wird geladen …"));

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

    purgeStaleDrafts();
    state.weekNo = weekNoForTab(todayISO());
    state.historyExercise = defaultHistoryExercise();
    // F0: 35 Tage Vorlauf statt der alten 14 — die Belastungs-Ampel braucht
    // 28 Tage Historie vor den letzten 7 Tagen (M2-3/A6).
    STRAVA_SINCE = addDays(plans[0].start, -35);
  } catch (err) {
    console.error(err);
    setPageHead(plainHead("Trainingsplan"));
    renderMain(errorCard(err.message));
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
    setPageHead(plainHead("Strava"));
    renderMain(loadingCard("Strava-Verbindung wird abgeschlossen …"));
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
}

init();
