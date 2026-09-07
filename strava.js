import { saveStravaTokens, loadStravaTokens } from "./firebase-init.js";

// Diese Werte liegen zwangsläufig im Client-Code, weil die Seite rein
// statisch ist (kein eigener Server). Für ein privates Ein-Personen-Tool
// ist das der übliche, akzeptierte Kompromiss.
const CLIENT_ID = "277715";
const CLIENT_SECRET = "206659961dcf60d028a642d6a1fff2a5e31fddae";

function redirectUri() {
  // Automatisch die aktuelle Seiten-URL ohne Query-String
  return location.origin + location.pathname;
}

export function isAuthorized() {
  return loadStravaTokens().then((t) => !!(t && t.refresh_token));
}

export function startAuthorization() {
  const url =
    "https://www.strava.com/oauth/authorize" +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    "&response_type=code" +
    "&scope=activity:read_all" +
    "&approval_prompt=auto";
  location.href = url;
}

// Wird beim Laden aufgerufen, falls Strava mit ?code=... zurückgeleitet hat
export async function handleAuthRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (!code) return false;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Strava-Autorisierung fehlgeschlagen");
  const data = await res.json();
  await saveStravaTokens({
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expires_at: data.expires_at,
  });

  // Query-String aus der URL entfernen, damit der Code nicht erneut verwendet wird
  history.replaceState({}, "", redirectUri());
  return true;
}

async function getValidAccessToken() {
  const tokens = await loadStravaTokens();
  if (!tokens || !tokens.refresh_token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (tokens.access_token && tokens.expires_at && tokens.expires_at > now + 60) {
    return tokens.access_token;
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  await saveStravaTokens({
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expires_at: data.expires_at,
  });
  return data.access_token;
}

// Holt die letzten Läufe (max. 30) seit einem gegebenen Datum
export async function fetchRecentRuns(sinceISO) {
  const token = await getValidAccessToken();
  if (!token) return null; // nicht autorisiert

  const after = Math.floor(new Date(sinceISO).getTime() / 1000);
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const activities = await res.json();
  return activities
    .filter((a) => a.type === "Run")
    .map((a) => ({
      date: a.start_date_local.slice(0, 10),
      name: a.name,
      distanceKm: (a.distance / 1000).toFixed(1),
      paceMinPerKm: formatPace(a.moving_time, a.distance),
      avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    }));
}

function formatPace(movingTimeSec, distanceM) {
  if (!distanceM) return "–";
  const secPerKm = movingTimeSec / (distanceM / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

// Matched Strava-Läufe auf ein bestimmtes Plan-Datum
export function matchRunForDate(runs, dateISO) {
  if (!runs) return null;
  return runs.find((r) => r.date === dateISO) || null;
}
