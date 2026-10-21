// Daten-Export: baut aus den geladenen Trainingsdaten ein JSON, das sich
// zum Auswerten (z. B. durch Claude) weitergeben lässt. Dieses Modul ist
// bewusst rein (keine Firebase-/Strava-Importe), damit es ohne Browser
// testbar ist; das Laden der Daten und das Teilen/Herunterladen steht in
// app.js.
import { toISO } from "./plan.js?v=202610211227";

// Der Export beginnt mit dem Jahr, in dem das Training begann.
export const EXPORT_SINCE = "2026-01-01";

// Nur diese Felder der Strava-Zusammenfassung wandern in die Datei. Eine
// Positivliste statt "alles außer ...": so kommt nie versehentlich ein
// Token, ein athlete-Objekt oder eine map/polyline (Standortdaten) hinein,
// auch wenn Strava die Antwort um neue Felder erweitert.
export const ACTIVITY_FIELDS = [
  "id", "name", "sport_type", "type", "start_date_local", "distance", "moving_time",
  "elapsed_time", "total_elevation_gain", "average_speed", "max_speed", "average_heartrate",
  "max_heartrate", "average_cadence", "suffer_score", "workout_type", "trainer", "manual",
];

const LOG_FIELDS = ["date", "exercise", "name", "soll", "custom", "sets", "topKg", "totalReps", "week", "completed"];

const pad = (n) => String(n).padStart(2, "0");

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj?.[f] !== undefined) out[f] = obj[f];
  return out;
}

// Lokale ISO-Zeit mit Offset, z. B. 2026-10-20T00:30:00+02:00. toISOString()
// würde in UTC rechnen und um Mitternacht den falschen Tag zeigen.
export function localIsoWithOffset(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function exportFileName(d) {
  return `trainingsdaten-${toISO(d)}.json`;
}

// Versionsstempel des laufenden Codes: steht als ?v=... an der URL dieses
// Moduls (siehe tools/bump-version.mjs).
export function appVersionFromUrl(url) {
  try {
    return new URL(url).searchParams.get("v") || "unbekannt";
  } catch {
    return "unbekannt";
  }
}

export function pickActivity(a) {
  return pick(a, ACTIVITY_FIELDS);
}

function byDate(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function activityDates(activities) {
  const dates = activities.map((a) => (a.start_date_local || "").slice(0, 10)).filter(Boolean).sort();
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null };
}

// Fehlende Quellen (null) bleiben leer und stehen in meta.warnings.
// dayplans: { [datum]: { removed, added } }, runLinks: { [datum]: { activityId } }.
export function buildExport({
  now, version, plan, stravaActivities = null, logs = null, dayplans = null, runLinks = null,
  warnings = [], since = EXPORT_SINCE,
}) {
  const activities = (stravaActivities || []).map(pickActivity)
    .sort((a, b) => (a.start_date_local || "").localeCompare(b.start_date_local || ""));
  const logList = (logs || []).map((l) => pick(l, LOG_FIELDS)).sort(byDate);
  const dayplanList = Object.entries(dayplans || {})
    .map(([date, d]) => ({ date, removed: d.removed || [], added: d.added || [] }))
    .sort(byDate);
  const runLinkList = Object.entries(runLinks || {})
    .map(([planDate, l]) => ({ planDate, activityId: l.activityId ?? null }))
    .sort((a, b) => (a.planDate < b.planDate ? -1 : a.planDate > b.planDate ? 1 : 0));
  const range = activityDates(activities);

  return {
    meta: {
      exportedAt: localIsoWithOffset(now),
      appVersion: version,
      planId: plan?.id ?? null,
      planFileVersion: plan?.fileVersion ?? null,
      stravaRange: { since, firstActivity: range.first, lastActivity: range.last },
      counts: {
        stravaActivities: activities.length,
        strengthLogs: logList.length,
        dayplans: dayplanList.length,
        runLinks: runLinkList.length,
      },
      warnings: [...warnings],
    },
    plan: plan ?? null,
    strava: { activities },
    strength: { logs: logList, dayplans: dayplanList },
    runLinks: runLinkList,
  };
}

export function serializeExport(data) {
  return JSON.stringify(data, null, 2);
}
