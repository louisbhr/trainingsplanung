// Reiner Teil des Daten-Exports (export.js): Feldauswahl, Datenschutz,
// Dateiname und lokale Zeit. Ohne Browser.
process.env.TZ = "Europe/Berlin"; // vor der ersten Date-Nutzung, für den Mitternachts-Check

import { readFileSync } from "node:fs";
import {
  buildExport, serializeExport, exportFileName, localIsoWithOffset, appVersionFromUrl,
  ACTIVITY_FIELDS, EXPORT_SINCE, pickActivity,
} from "../export.js";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

const plan = JSON.parse(readFileSync(new URL("../plans/hm-2027.json", import.meta.url), "utf8"));
const now = new Date(2026, 9, 20, 0, 30, 5); // 20.10.2026 00:30:05 lokal (UTC wäre noch der 19.)

const rawActivity = {
  id: 7, name: "Long run", sport_type: "Run", type: "Run", start_date_local: "2026-09-05T09:00:00Z",
  distance: 12030, moving_time: 4700, elapsed_time: 4800, total_elevation_gain: 80, average_speed: 2.6,
  max_speed: 4, average_heartrate: 151, max_heartrate: 170, average_cadence: 84, suffer_score: 55,
  workout_type: 2, trainer: false, manual: false,
  map: { id: "a1", summary_polyline: "SECRETPOLYLINE", polyline: "SECRETPOLYLINE" },
  athlete: { id: 42 }, access_token: "AT-SECRET", refresh_token: "RT-SECRET",
  start_latlng: [52.5, 13.4], end_latlng: [52.5, 13.4], calories: 900,
};
const rawLog = {
  date: "2026-09-08", exercise: "kniebeuge", name: "Kniebeuge", soll: "3x8", custom: false,
  sets: [{ kg: 60, reps: 8 }], topKg: 60, totalReps: 8, week: 2, completed: true, updatedAt: 123,
};

const data = buildExport({
  now, version: "202610201449", plan, stravaActivities: [rawActivity],
  logs: [rawLog], dayplans: { "2026-09-08": { removed: ["x"], added: [] } },
  runLinks: { "2026-09-07": { activityId: 7 } },
});
const text = serializeExport(data);

ok(!/SECRET|polyline|refresh_token|access_token|latlng|athlete/i.test(text.replace(/"plan":[\s\S]*?"strava":/, "")),
  "Export enthält keine Tokens, Polylines, Koordinaten oder athlete-Objekte");
ok(JSON.stringify(Object.keys(data.strava.activities[0]).sort()) ===
   JSON.stringify([...ACTIVITY_FIELDS].sort()), "Aktivität: genau die vorgesehenen Felder");
ok(data.strava.activities[0].calories === undefined, "Aktivität: Felder außerhalb der Liste fallen weg");
ok(pickActivity({ id: 1 }).name === undefined && Object.keys(pickActivity({ id: 1 })).length === 1,
  "Fehlende Felder werden nicht als undefined erfunden");
ok(data.strength.logs[0].updatedAt === undefined && data.strength.logs[0].topKg === 60 &&
   data.strength.logs[0].sets[0].kg === 60 && data.strength.logs[0].completed === true, "Log: Feldauswahl");
ok(data.strength.dayplans[0].date === "2026-09-08" && data.strength.dayplans[0].removed[0] === "x", "Dayplans als Liste mit Datum");
ok(data.runLinks[0].planDate === "2026-09-07" && data.runLinks[0].activityId === 7, "Lauf-Zuordnungen als Liste");
ok(data.plan.id === "hm-2027" && data.meta.planId === "hm-2027" && data.meta.planFileVersion === plan.fileVersion,
  "meta: planId und fileVersion");
ok(data.meta.appVersion === "202610201449", "meta: Versionsstempel");
ok(data.meta.counts.stravaActivities === 1 && data.meta.counts.strengthLogs === 1 &&
   data.meta.counts.dayplans === 1 && data.meta.counts.runLinks === 1, "meta: Anzahl je Bereich");
ok(data.meta.stravaRange.since === EXPORT_SINCE && data.meta.stravaRange.firstActivity === "2026-09-05" &&
   data.meta.stravaRange.lastActivity === "2026-09-05", "meta: Zeitraum der Strava-Daten");
ok(text.includes("\n  \"meta\""), "JSON ist eingerückt");

// Datum lokal, auch kurz nach Mitternacht (UTC wäre der Vortag)
ok(exportFileName(now) === "trainingsdaten-2026-10-20.json", `Dateiname lokal um 00:30: ${exportFileName(now)}`);
ok(exportFileName(new Date(2026, 9, 20, 23, 59, 59)) === "trainingsdaten-2026-10-20.json", "Dateiname um 23:59");
ok(data.meta.exportedAt === "2026-10-20T00:30:05+02:00", `exportedAt lokal mit Offset: ${data.meta.exportedAt}`);
ok(localIsoWithOffset(new Date(2026, 0, 5, 12, 0, 0)) === "2026-01-05T12:00:00+01:00", "Offset im Winter +01:00");

// Fehlende Quellen
const partial = buildExport({
  now, version: "x", plan, stravaActivities: null, logs: [], dayplans: {}, runLinks: {},
  warnings: ["Strava: nicht verbunden"],
});
ok(partial.strava.activities.length === 0 && partial.meta.warnings[0] === "Strava: nicht verbunden" &&
   partial.meta.stravaRange.firstActivity === null, "Ohne Strava: leere Liste, Warnung in meta.warnings");

ok(appVersionFromUrl("http://x/app.js?v=202610201449") === "202610201449", "Version aus URL");
ok(appVersionFromUrl("http://x/app.js") === "unbekannt", "Version ohne Stempel");

console.log(fails ? `\n${fails} FEHLER` : "\nExport-Test: alles grün");
process.exit(fails ? 1 : 0);
