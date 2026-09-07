// Cloudflare Worker — übernimmt NUR den Strava-Token-Austausch, weil
// Stravas /oauth/token-Endpunkt keine CORS-Anfragen direkt aus dem
// Browser erlaubt. Alles andere (Aktivitäten abrufen) bleibt im
// Frontend, das funktioniert bei Strava per CORS.
//
// Setup (Cloudflare-Dashboard, kostenloser Plan reicht):
// 1. workers.cloudflare.com -> "Create Worker" -> diesen Code einfügen
// 2. Settings -> Variables and Secrets, zwei Secrets anlegen:
//      STRAVA_CLIENT_ID     = 277715
//      STRAVA_CLIENT_SECRET = <dein Secret aus strava.com/settings/api>
//    Optional, empfohlen:
//      ALLOWED_ORIGINS      = https://<dein-name>.github.io
//    (mehrere durch Komma trennen; ohne diese Variable ist jede Herkunft
//     erlaubt — der Worker gibt dann für jeden das Token heraus, der
//     einen gültigen Strava-Code besitzt)
// 3. Deployen, die Worker-URL (z. B. https://xyz.workers.dev) kopieren
//    und in config.js bei WORKER_URL_DEFAULT eintragen.
//
// Alternativ mit der CLI:  npx wrangler deploy   (siehe wrangler.toml)

const TOKEN_URL = "https://www.strava.com/oauth/token";

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowList = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  // Ohne ALLOWED_ORIGINS: alles erlauben (bequem, aber offen).
  // Mit ALLOWED_ORIGINS: nur die eingetragenen Herkünfte.
  const allowed = allowList.length === 0 ? "*" : allowList.includes(origin) ? origin : null;

  return {
    headers: {
      "Access-Control-Allow-Origin": allowed || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
    allowed: allowed !== null,
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const { headers: cors, allowed } = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!allowed) return json({ message: "Origin nicht erlaubt" }, 403, cors);
    if (request.method !== "POST") return json({ message: "Nur POST" }, 405, cors);

    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
      return json({ message: "Worker-Secrets STRAVA_CLIENT_ID/SECRET fehlen" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ message: "Ungültiges JSON" }, 400, cors);
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const params = {
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
    };

    if (path === "/exchange") {
      if (!body.code) return json({ message: "code fehlt" }, 400, cors);
      params.code = body.code;
      params.grant_type = "authorization_code";
    } else if (path === "/refresh") {
      if (!body.refresh_token) return json({ message: "refresh_token fehlt" }, 400, cors);
      params.refresh_token = body.refresh_token;
      params.grant_type = "refresh_token";
    } else {
      return json({ message: `Unbekannter Pfad ${path} (erwartet /exchange oder /refresh)` }, 404, cors);
    }

    let res;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    } catch (err) {
      return json({ message: "Strava nicht erreichbar" }, 502, cors);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return json({ message: `Unerwartete Strava-Antwort: ${text.slice(0, 200)}` }, 502, cors);
    }
    return json(data, res.status, cors);
  },
};
