// Zentrale Einstellungen, die nach dem Deploy einmalig gesetzt werden.

// Cloudflare-Worker, der den Strava-Token-Austausch übernimmt.
// Stravas /oauth/token erlaubt keine CORS-Anfragen aus dem Browser —
// deshalb der Umweg. Siehe worker.js für Setup und README.
//
// Nach dem Worker-Deploy hier die echte URL eintragen, z. B.
// "https://hm-tracker-auth.dein-name.workers.dev"
const WORKER_URL_DEFAULT = "https://trainingsplanung-auth.jkmvkjn942.workers.dev";

// Zum schnellen Ausprobieren ohne Commit: die Seite einmal mit
// ?worker=https://...workers.dev aufrufen. Die URL wird dann lokal im
// Browser gemerkt und überschreibt den Wert oben.
const OVERRIDE_KEY = "hm-tracker.workerUrl";

function readOverride() {
  try {
    const fromQuery = new URLSearchParams(location.search).get("worker");
    if (fromQuery) {
      localStorage.setItem(OVERRIDE_KEY, fromQuery.replace(/\/+$/, ""));
      return fromQuery.replace(/\/+$/, "");
    }
    return localStorage.getItem(OVERRIDE_KEY) || "";
  } catch {
    return ""; // localStorage kann in privaten Fenstern werfen
  }
}

// WORKER_URL ist der neue, allgemeine Name (M2: auch /coach läuft über
// denselben Worker). STRAVA_WORKER_URL bleibt als Alias bestehen, damit
// strava.js unverändert bleiben kann.
export const WORKER_URL = (readOverride() || WORKER_URL_DEFAULT).replace(/\/+$/, "");
export const STRAVA_WORKER_URL = WORKER_URL;
export const COACH_URL = `${WORKER_URL}/coach`;
export const STRAVA_CLIENT_ID = "277715"; // öffentlich, steht auch in der Authorize-URL
export const isWorkerConfigured = !!STRAVA_WORKER_URL && !STRAVA_WORKER_URL.includes("REPLACE-ME");

// Grenzwerte für die vier Ampeln und den Coach (F5/F6/M2-3). Alle Info-
// Sheets (D1) lesen ihre Zahlen aus hier, nicht aus festem Text.
export const THRESHOLDS = {
  wochensoll: { gruen: 0.9, gelb: 0.7 },
  easy: { gelbMaxOver: 8 }, // bpm: bis zu 8 über der Obergrenze zählt noch als einzelner Ausreißer (gelb)
  belastung: { gruen: 1.3, gelb: 1.5, minHistoryDays: 28 },
  kraft: {
    windowDays: 42,
    stallSessions: 2,
    minExercisesWithData: 3,
    redAffectedCount: 2,
    redConsecutiveBelow: 2,
  },
  coach: { dailyLimit: 3, weeklyLimit: 2 },
};
