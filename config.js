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

export const STRAVA_WORKER_URL = (readOverride() || WORKER_URL_DEFAULT).replace(/\/+$/, "");
export const STRAVA_CLIENT_ID = "277715"; // öffentlich, steht auch in der Authorize-URL
export const isWorkerConfigured = !!STRAVA_WORKER_URL && !STRAVA_WORKER_URL.includes("REPLACE-ME");
