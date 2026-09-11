import { saveStravaTokens, loadStravaTokens } from "./firebase-init.js?v=202609110852";
import { STRAVA_CLIENT_ID, STRAVA_WORKER_URL, isWorkerConfigured } from "./config.js?v=202609110852";

// Die Client-ID ist unkritisch öffentlich (sie steht ohnehin in der
// Authorize-URL). Das Client-Secret liegt NICHT hier, sondern nur als
// Secret im Cloudflare Worker (siehe worker.js) — Strava erlaubt den
// Token-Austausch nicht per CORS direkt aus dem Browser.
const API_BASE = "https://www.strava.com/api/v3";

export class StravaSetupError extends Error {}

function redirectUri() {
  // Automatisch die aktuelle Seiten-URL ohne Query-String
  return location.origin + location.pathname;
}

export async function isAuthorized() {
  const t = await loadStravaTokens();
  return !!(t && t.refresh_token);
}

export function startAuthorization() {
  const url =
    "https://www.strava.com/oauth/authorize" +
    `?client_id=${STRAVA_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    "&response_type=code" +
    "&scope=activity:read_all" +
    "&approval_prompt=auto";
  location.href = url;
}

export async function disconnect() {
  runCache = null;
  await saveStravaTokens({ refresh_token: null, access_token: null, expires_at: null });
}

// Ruft den Worker auf (/exchange oder /refresh)
async function callWorker(path, body) {
  if (!isWorkerConfigured) {
    throw new StravaSetupError(
      "Strava-Worker ist noch nicht eingerichtet — WORKER_URL_DEFAULT in config.js setzen."
    );
  }
  let res;
  try {
    res = await fetch(`${STRAVA_WORKER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Strava-Worker nicht erreichbar (Netzwerk oder falsche Worker-URL).");
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* keine JSON-Antwort — unten als Fehler behandelt */
  }
  if (!res.ok || !data) {
    const detail = data?.message || text.slice(0, 160) || "keine Antwort";
    throw new Error(`Strava-Token-Austausch fehlgeschlagen (HTTP ${res.status}): ${detail}`);
  }
  if (!data.access_token || !data.refresh_token) {
    throw new Error(`Strava hat keine Tokens geliefert: ${(data.message || text).slice(0, 160)}`);
  }
  return data;
}

// Wird beim Laden aufgerufen, falls Strava zurückgeleitet hat.
// Rückgabe: { status: "none" | "connected" | "denied" | "error", message? }
export async function handleAuthRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (!code && !error) return { status: "none" };

  const scope = params.get("scope");
  // Query-String immer entfernen, damit ein Reload den Code nicht erneut
  // einzulösen versucht — Strava-Codes sind Einmal-Codes.
  history.replaceState({}, "", redirectUri());

  if (error) {
    return {
      status: "denied",
      message:
        error === "access_denied" ? "Zugriff bei Strava abgelehnt." : `Strava-Fehler: ${error}`,
    };
  }

  try {
    const data = await callWorker("/exchange", { code });
    await saveStravaTokens({
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      expires_at: data.expires_at,
      scope: scope || null,
      athleteId: data.athlete?.id ?? null,
      connectedAt: Date.now(),
    });
    runCache = null;
    return { status: "connected" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

async function getValidAccessToken() {
  const tokens = await loadStravaTokens();
  if (!tokens || !tokens.refresh_token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (tokens.access_token && tokens.expires_at && tokens.expires_at > now + 60) {
    return tokens.access_token;
  }

  const data = await callWorker("/refresh", { refresh_token: tokens.refresh_token });
  await saveStravaTokens({
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expires_at: data.expires_at,
  });
  return data.access_token;
}

let runCache = null; // { sinceISO, runs, sessions, fetchedAt }
let lastSessions = [];
const CACHE_MS = 5 * 60 * 1000;

// Holt die Läufe seit einem Datum (paginiert, max. 200 Aktivitäten).
// Rückgabe: Array von Läufen, oder null wenn (noch) nicht autorisiert.
// Wirft, wenn autorisiert ist, der Abruf aber fehlschlägt.
export async function fetchRecentRuns(sinceISO, { force = false } = {}) {
  if (
    !force &&
    runCache &&
    runCache.sinceISO === sinceISO &&
    Date.now() - runCache.fetchedAt < CACHE_MS
  ) {
    lastSessions = runCache.sessions || [];
    return runCache.runs;
  }

  const token = await getValidAccessToken();
  if (!token) return null; // nicht autorisiert

  const after = Math.floor(new Date(sinceISO + "T00:00:00").getTime() / 1000);
  const all = [];
  for (let page = 1; page <= 4; page++) {
    let res;
    try {
      res = await fetch(`${API_BASE}/athlete/activities?after=${after}&per_page=50&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new Error("Strava ist nicht erreichbar (Netzwerk).");
    }
    if (res.status === 401) throw new Error("Strava-Zugang abgelaufen — bitte neu verbinden.");
    if (res.status === 429) throw new Error("Strava-Limit erreicht — bitte später nochmal.");
    if (!res.ok) throw new Error(`Strava-Abruf fehlgeschlagen (HTTP ${res.status}).`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 50) break;
  }

  const runs = all
    .filter((a) => a.type === "Run" || a.sport_type === "Run" || a.sport_type === "TrailRun")
    .map(mapActivity)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Krafteinheiten kommen von der Uhr als WeightTraining. Strava kennt
  // dazu keine einzelnen Übungen, aber Herzfrequenz und Dauer — daraus
  // wird die Belastung der Einheit ohne jede Eingabe sichtbar.
  lastSessions = all
    .filter((a) => a.type === "WeightTraining" || a.sport_type === "WeightTraining" || a.sport_type === "Workout")
    .map(mapSession)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  runCache = { sinceISO, runs, sessions: lastSessions, fetchedAt: Date.now() };
  return runs;
}

// Krafteinheiten aus dem letzten Abruf
export function strengthSessions() {
  return lastSessions;
}

export function sessionForDate(dateISO) {
  const sameDay = lastSessions.filter((s) => s.date === dateISO);
  if (!sameDay.length) return null;
  return sameDay.reduce((a, b) => (b.movingTimeSec > a.movingTimeSec ? b : a));
}

function mapSession(a) {
  return {
    id: a.id,
    date: (a.start_date_local || a.start_date || "").slice(0, 10),
    name: a.name,
    movingTimeSec: a.moving_time || 0,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    calories: a.calories ?? null,
    // Strava nennt das "Relative Effort" — aus der Herzfrequenz berechnet
    effort: a.suffer_score ?? null,
  };
}

function mapActivity(a) {
  const distanceM = a.distance || 0;
  const movingTimeSec = a.moving_time || 0;
  const paceSecPerKm = distanceM > 0 ? movingTimeSec / (distanceM / 1000) : null;
  return {
    id: a.id,
    date: (a.start_date_local || a.start_date || "").slice(0, 10),
    name: a.name,
    distanceKm: distanceM / 1000,
    movingTimeSec,
    paceSecPerKm,
    paceLabel: formatPace(paceSecPerKm),
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
  };
}

export function formatPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return "–";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  if (sec === 60) return `${min + 1}:00 /km`; // 5:60 vermeiden
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

export function formatDuration(totalSec) {
  if (!totalSec) return "–";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} h`
    : `${m}:${String(s).padStart(2, "0")} min`;
}

// Matched Strava-Läufe auf ein Plan-Datum. Bei mehreren Läufen am selben
// Tag gewinnt der längste — der Plan-Lauf ist praktisch immer der längste.
export function matchRunForDate(runs, dateISO) {
  if (!runs || !runs.length) return null;
  const sameDay = runs.filter((r) => r.date === dateISO);
  if (!sameDay.length) return null;
  return sameDay.reduce((best, r) => (r.distanceKm > best.distanceKm ? r : best));
}

export { isWorkerConfigured };
