// Zentrale Einstellungen, die nach dem Deploy einmalig gesetzt werden.

// Cloudflare-Worker, der den Strava-Token-Austausch übernimmt.
// Stravas /oauth/token erlaubt keine CORS-Anfragen aus dem Browser —
// deshalb der Umweg. Siehe worker.js für Setup und README.
//
// Nach dem Worker-Deploy hier die echte URL eintragen, z. B.
// "https://hm-tracker-auth.dein-name.workers.dev"
const WORKER_URL_DEFAULT = "https://trainingsplanung-auth.jkmvkjn942.workers.dev";

// Abweichende Worker-URL nur für lokale Entwicklung und Tests: Läuft die
// Seite auf localhost/127.0.0.1, darf ?worker=... bzw. der gemerkte Wert die
// URL ersetzen. Auf der echten Seite wird jeder Override ignoriert, sonst
// könnte ein präparierter Link das Login-Token an eine fremde Adresse lenken.
const OVERRIDE_KEY = "hm-tracker.workerUrl";

export function isLocalDevHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function readOverride() {
  try {
    if (!isLocalDevHost(location.hostname)) {
      localStorage.removeItem(OVERRIDE_KEY); // alten, evtl. untergeschobenen Wert verwerfen
      return "";
    }
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
// UID des einzigen erlaubten Kontos (Louis). Öffentlich unkritisch: sie steht
// auch in firestore.rules und wrangler.toml, ein Test hält die drei gleich.
// Die Prüfung im Client ist nur Bedienkomfort, den Schutz bilden Regeln und Worker.
export const ALLOWED_UID = "gH4Te1JZzaO7DVoTSg9TtK4gw8p1";
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
