// Cloudflare Worker — Strava-Token-Austausch (Stravas /oauth/token erlaubt
// keine CORS-Anfragen direkt aus dem Browser) und seit M2-8 zusätzlich
// POST /coach: baut aus geprüften, strukturierten Trainingsdaten einen
// Prompt und ruft die Claude API auf. /coach wird ERST kurz vor dem M2-Merge
// deployt (E2) — bis dahin ist dieser Code committet, aber ohne
// ANTHROPIC_API_KEY-Secret nicht live nutzbar (liefert 500 not_configured).
//
// Setup (Cloudflare-Dashboard, kostenloser Plan reicht):
// 1. workers.cloudflare.com -> "Create Worker" -> diesen Code einfügen
// 2. Settings -> Variables and Secrets, Secrets anlegen:
//      STRAVA_CLIENT_ID     = 277715
//      STRAVA_CLIENT_SECRET = <dein Secret aus strava.com/settings/api>
//      ANTHROPIC_API_KEY     = <eigener Workspace-Key, siehe E2>
//    Optional, empfohlen:
//      ALLOWED_ORIGINS      = https://<dein-name>.github.io
//    (mehrere durch Komma trennen; ohne diese Variable ist jede Herkunft
//     erlaubt — der Worker gibt dann für jeden das Token heraus bzw.
//     beantwortet /coach für jeden, der eine gültige Anfrage schickt)
// 3. Deployen, die Worker-URL (z. B. https://xyz.workers.dev) kopieren
//    und in config.js bei WORKER_URL_DEFAULT eintragen.
//
// Alternativ mit der CLI:  npx wrangler deploy   (siehe wrangler.toml)

const TOKEN_URL = "https://www.strava.com/oauth/token";

// ---------- /coach (M2-8, A3/A10) ----------
// Modell als EINE Konstante (A10): ein Wechsel ist eine Zeile + Deploy, eine
// Stilllegung degradiert über den 502 sauber auf den Regel-Fallback im
// Client (coach.js). Geprüft gegen die claude-api-Referenz (Stand
// 2026-06-24): Alias und Snapshot claude-haiku-4-5-20251001 bezeichnen
// dasselbe Modell, werden gemeinsam stillgelegt — der Alias ist trotzdem
// vorzuziehen (von der Referenz empfohlen, kein Stabilitätsnachteil).
const MODEL = "claude-haiku-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const PROMPT_VERSION = "coach-v3";
const MAX_BODY_BYTES = 8192;
const MAX_TOKENS_DAILY = 200;
const MAX_TOKENS_WEEKLY = 450;

// Whitelist für alle freien String-Felder (A3): Buchstaben inkl. Umlaute,
// Ziffern, Leerzeichen, ".,:;/()+-–×%°'" — explizit keine Zeilenumbrüche.
// Ergänzt um "·" (U+00B7 Mittelpunkt): der Client trennt Detailtexte an
// zig Stellen so (z. B. "14 / 24 km · Kraft 1/2", metrics.js/view-
// dashboard.js) — ohne diese Ergänzung hätte die Whitelist echte,
// harmlose Werte aus der eigenen App abgelehnt statt nur Fremdtext.
const STR_CHAR_RE = /^[\p{L}0-9 .,:;/()+\-–×%°'·]*$/u;
function isPlainString(v, maxLen) {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen && !v.includes("\n") && STR_CHAR_RE.test(v);
}
function onlyKeys(obj, keys) {
  return obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).every((k) => keys.includes(k));
}
const isInt = (v) => Number.isInteger(v);
const isFiniteNumber = (v) => typeof v === "number" && isFinite(v);

const DISTANCES = ["Halbmarathon", "Marathon", "10 km"];
const STATUSES = ["gruen", "gelb", "rot", "grau"];
const KRAFT_STATUSES = ["steigt", "haelt", "stagniert", "unterSoll"];
const TODAY_TYPES = ["Kraft", "Lauf", "Ruhe", "Offen"];
const TIME_RE = /^\d:\d\d:\d\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function validGoal(g) {
  return (
    onlyKeys(g, ["distance", "targetTime", "raceMonth", "raceDateConfirmed"]) &&
    DISTANCES.includes(g.distance) &&
    typeof g.targetTime === "string" && TIME_RE.test(g.targetTime) &&
    isInt(g.raceMonth) && g.raceMonth >= 1 && g.raceMonth <= 12 &&
    typeof g.raceDateConfirmed === "boolean"
  );
}

function validCheckpoint(c) {
  return onlyKeys(c, ["status", "detail"]) && STATUSES.includes(c.status) && isPlainString(c.detail, 80);
}

function validDaily(b) {
  if (!onlyKeys(b, ["kind", "date", "week", "weekType", "phase", "goal", "today", "checkpoints", "next", "aerobeEffizienzTrend"])) return false;
  if (typeof b.date !== "string" || !DATE_RE.test(b.date)) return false;
  if (!isInt(b.week) || b.week < 1 || b.week > 60) return false;
  if (!isPlainString(b.weekType, 40) || !isPlainString(b.phase, 40)) return false;
  if (!validGoal(b.goal)) return false;
  if (!onlyKeys(b.today, ["type", "name", "done"])) return false;
  if (!TODAY_TYPES.includes(b.today.type) || !isPlainString(b.today.name, 60) || typeof b.today.done !== "boolean") return false;
  if (!onlyKeys(b.checkpoints, ["wochensoll", "easy", "belastung", "kraft"])) return false;
  for (const key of ["wochensoll", "easy", "belastung", "kraft"]) {
    if (!validCheckpoint(b.checkpoints[key])) return false;
  }
  if (!isPlainString(b.next, 60)) return false;
  if (b.aerobeEffizienzTrend !== null && !isPlainString(b.aerobeEffizienzTrend, 40)) return false;
  return true;
}

function validWeekly(b) {
  if (!onlyKeys(b, ["kind", "goal", "week", "weekType", "phase", "run", "kraft", "belastung", "aerobeEffizienzTrend", "adherence4w", "nextWeek"])) return false;
  if (!validGoal(b.goal)) return false;
  if (!isInt(b.week) || b.week < 1 || b.week > 60) return false;
  if (!isPlainString(b.weekType, 40) || !isPlainString(b.phase, 40)) return false;

  const r = b.run;
  if (!onlyKeys(r, ["plannedKm", "actualKm", "sessionsPlanned", "sessionsDone", "easyOverLimit"])) return false;
  if (!isFiniteNumber(r.plannedKm) || !isFiniteNumber(r.actualKm)) return false;
  if (!isInt(r.sessionsPlanned) || !isInt(r.sessionsDone)) return false;
  if (!Array.isArray(r.easyOverLimit) || r.easyOverLimit.length > 7) return false;
  for (const e of r.easyOverLimit) {
    if (!onlyKeys(e, ["day", "avgHr", "limit"])) return false;
    if (!isPlainString(e.day, 10) || !isFiniteNumber(e.avgHr) || !isFiniteNumber(e.limit)) return false;
  }

  const k = b.kraft;
  if (!onlyKeys(k, ["sessionsPlanned", "sessionsDone", "progression"])) return false;
  if (!isInt(k.sessionsPlanned) || !isInt(k.sessionsDone)) return false;
  if (!Array.isArray(k.progression) || k.progression.length > 12) return false;
  for (const p of k.progression) {
    if (!onlyKeys(p, ["exercise", "status", "detail"])) return false;
    if (!isPlainString(p.exercise, 40) || !KRAFT_STATUSES.includes(p.status) || !isPlainString(p.detail, 80)) return false;
  }

  if (!onlyKeys(b.belastung, ["ratio", "status"])) return false;
  if (!isFiniteNumber(b.belastung.ratio) || !STATUSES.includes(b.belastung.status)) return false;

  if (b.aerobeEffizienzTrend !== null && !isPlainString(b.aerobeEffizienzTrend, 40)) return false;

  if (!onlyKeys(b.adherence4w, ["done", "planned"])) return false;
  if (!isInt(b.adherence4w.done) || !isInt(b.adherence4w.planned)) return false;

  if (!onlyKeys(b.nextWeek, ["n", "type", "keySession"])) return false;
  if (!isInt(b.nextWeek.n) || !isPlainString(b.nextWeek.type, 40) || !isPlainString(b.nextWeek.keySession, 60)) return false;

  return true;
}

// Der Ziel-Satz wird aus validierten Enum-/Regex-Werten zusammengesetzt
// (nie aus freiem Text) — Kern von A3: über den Endpunkt kann so kein
// beliebiger Text in den System-Prompt gelangen.
function goalSentence(goal) {
  const month = MONTHS_DE[goal.raceMonth - 1];
  const termin = goal.raceDateConfirmed ? "" : " (genauer Termin noch offen)";
  return `Er bereitet sich auf einen ${goal.distance} mit Zielzeit ${goal.targetTime} vor, das Rennen ist für ${month}${termin} geplant.`;
}

const RULES_TEXT = `Regeln:
- Wenn eine Ampel gelb oder rot ist, sprich die schlechteste zuerst an
  und sag konkret, was er beim nächsten Training anders machen soll.
- Rede eine gelbe oder rote Ampel nie schön. Kein Lob, das den Hinweis
  verwässert.
- Wenn alles grün ist, bestätige kurz und nenne, worauf es als Nächstes
  ankommt.
- Nutze nur Zahlen und Fakten aus dem JSON. Erfinde nichts.
- Keine medizinischen Diagnosen. Bei roter Belastung: Tempo oder Umfang
  reduzieren empfehlen; nur bei Schmerzen auf ärztliche Abklärung
  verweisen.
- Easy-, Long- und Recovery-Läufe gehören immer in ihre Zielzone. Empfiehl
  dort nie, schneller zu laufen oder Tempo aufzubauen. Tempo nur dort
  ansprechen, wo der Plan ausdrücklich Tempo, Schwelle oder Intervalle
  vorsieht.
- Halte die vorgegebene Satzzahl strikt ein. Keine Aufzählungen.
- Keine Gedankenstriche, verbinde mit Punkt, Komma oder Doppelpunkt.
- Keine Emojis, keine Anrede, keine Einleitung. Nur die Sätze.`;

function dailySystemPrompt(goal) {
  return `Du bist ein erfahrener Lauf- und Krafttrainer und kommentierst den
Trainingstag von Louis. ${goalSentence(goal)} Sein Plan kombiniert
Lauftraining mit Krafteinheiten.

Du bekommst ein JSON mit dem heutigen Tag, vier Ampel-Checkpoints und
Trends. Schreibe daraus genau ein bis zwei kurze Sätze auf Deutsch, in
der Du-Form, im Ton eines ruhigen, direkten Trainers. Zusammen höchstens
35 Wörter: ein Befund, eine konkrete Handlung, kein Zusatz.

${RULES_TEXT}`;
}

function weeklySystemPrompt(goal) {
  return `Du bist derselbe Lauf- und Krafttrainer und ziehst die
Wochenbilanz für Louis. ${goalSentence(goal)} Sein Plan kombiniert
Lauftraining mit Krafteinheiten.

Du bekommst ein JSON mit der zurückliegenden Planwoche. Schreibe daraus
vier bis sechs kurze Sätze auf Deutsch (zusammen höchstens 90 Wörter),
in der Du-Form, in dieser
Reihenfolge: (1) Laufumfang Soll/Ist und erledigte Einheiten, (2)
Easy-Disziplin der Woche, (3) Kraft-Trend (welche Übungen steigen,
welche hängen), (4) Belastung und aerobe Effizienz nur, wenn auffällig,
(5) ein konkreter Schwerpunkt für die neue Woche.

${RULES_TEXT}`;
}

function dailyUserContent(b) {
  const data = {
    date: b.date, week: b.week, weekType: b.weekType, phase: b.phase,
    today: b.today, checkpoints: b.checkpoints, next: b.next,
    aerobeEffizienzTrend: b.aerobeEffizienzTrend,
  };
  return `Trainingsdaten (JSON, alle Werte bereits geprüft):\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``;
}
function weeklyUserContent(b) {
  const data = {
    week: b.week, weekType: b.weekType, phase: b.phase, run: b.run, kraft: b.kraft,
    belastung: b.belastung, aerobeEffizienzTrend: b.aerobeEffizienzTrend,
    adherence4w: b.adherence4w, nextWeek: b.nextWeek,
  };
  return `Wochendaten (JSON, alle Werte bereits geprüft):\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``;
}

// Kürzt eine bei max_tokens abgeschnittene Antwort auf den letzten
// vollständigen Satz, statt einen abgehackten Halbsatz anzuzeigen.
// Sicherheitsnetz für die Form, falls das Modell die Regeln nicht ganz
// einhält: Gedankenstriche zu Kommas, höchstens maxSentences Sätze.
function shapeText(text, maxSentences) {
  const noDash = text.replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim();
  const sentences = noDash.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [noDash];
  return sentences.slice(0, maxSentences).join(" ").replace(/\s+/g, " ").trim();
}

function trimToLastSentence(text) {
  const m = text.match(/^[\s\S]*[.!?](?=\s|$)/);
  return m ? m[0].trim() : text.trim();
}

async function callClaude(env, systemPrompt, userContent, maxTokens) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
}

async function handleCoach(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "not_configured", message: "ANTHROPIC_API_KEY fehlt" }, 500, cors);
  }

  // Body als Text lesen und die Byte-Länge prüfen, bevor überhaupt geparst
  // wird (A3) — Content-Length kann bei chunked Requests fehlen, und
  // Umlaute/Sonderzeichen sind in UTF-8 mehr als ein Byte pro Zeichen.
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "too_large", message: `Body über ${MAX_BODY_BYTES} Byte` }, 413, cors);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_input", message: "Ungültiges JSON" }, 400, cors);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_input", message: "Kein Objekt" }, 400, cors);
  }

  let systemPrompt, userContent, maxTokens;
  if (body.kind === "daily") {
    if (!validDaily(body)) return json({ error: "invalid_input", message: "daily-Schema ungültig" }, 400, cors);
    systemPrompt = dailySystemPrompt(body.goal);
    userContent = dailyUserContent(body);
    maxTokens = MAX_TOKENS_DAILY;
  } else if (body.kind === "weekly") {
    if (!validWeekly(body)) return json({ error: "invalid_input", message: "weekly-Schema ungültig" }, 400, cors);
    systemPrompt = weeklySystemPrompt(body.goal);
    userContent = weeklyUserContent(body);
    maxTokens = MAX_TOKENS_WEEKLY;
  } else {
    return json({ error: "invalid_input", message: "kind muss 'daily' oder 'weekly' sein" }, 400, cors);
  }

  let upstream;
  try {
    upstream = await callClaude(env, systemPrompt, userContent, maxTokens);
  } catch {
    return json({ error: "upstream_error", message: "Claude API nicht erreichbar" }, 502, cors);
  }

  if (!upstream.ok) {
    // Upstream-401 (falscher Key) intern unterscheidbar loggen (wrangler
    // tail), nach außen bewusst derselbe upstream_error wie jeder andere
    // Fehler — kein Hinweis für Außenstehende, woran es liegt.
    if (upstream.status === 401) console.log("coach: upstream 401 (ANTHROPIC_API_KEY prüfen)");
    else console.log(`coach: upstream ${upstream.status}`);
    return json({ error: "upstream_error", message: `Claude API antwortete mit ${upstream.status}` }, 502, cors);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: "upstream_error", message: "Unerwartete Antwort von Claude" }, 502, cors);
  }

  if (data.stop_reason === "refusal") {
    return json({ error: "upstream_error", message: "Anfrage von Claude abgelehnt" }, 502, cors);
  }

  let text = (data.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
  if (!text) return json({ error: "upstream_error", message: "Leere Antwort von Claude" }, 502, cors);
  if (data.stop_reason === "max_tokens") text = trimToLastSentence(text);
  text = shapeText(text, body.kind === "weekly" ? 6 : 2);

  return json({ text, kind: body.kind, model: MODEL, promptVersion: PROMPT_VERSION }, 200, cors);
}

function corsHeaders(request, env, path) {
  const origin = request.headers.get("Origin") || "";
  const allowList = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  // /exchange, /refresh (unverändert seit M1): ohne ALLOWED_ORIGINS alles
  // erlauben (bequem, aber offen); mit ALLOWED_ORIGINS nur die eingetragenen
  // Herkünfte.
  // /coach (M2-8, Architektur-Review): ohne ALLOWED_ORIGINS NICHTS erlauben
  // — ein leeres Ausgabenlimit ist schneller aufgebraucht als ein
  // Strava-Token-Tausch schadet, das darf nicht versehentlich offen sein.
  const allowed =
    path === "/coach"
      ? allowList.length > 0 && allowList.includes(origin) ? origin : null
      : allowList.length === 0 ? "*" : allowList.includes(origin) ? origin : null;

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
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const { headers: cors, allowed } = corsHeaders(request, env, path);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!allowed) {
      // /coach nutzt die im Architektur-Review festgelegte { error, message
      // }-Form (A3); /exchange und /refresh bleiben bei ihrer bestehenden
      // Form, damit strava.js unverändert bleibt.
      return path === "/coach"
        ? json({ error: "origin_not_allowed", message: "Origin nicht erlaubt" }, 403, cors)
        : json({ message: "Origin nicht erlaubt" }, 403, cors);
    }
    if (request.method !== "POST") {
      return path === "/coach"
        ? json({ error: "method_not_allowed", message: "Nur POST" }, 405, cors)
        : json({ message: "Nur POST" }, 405, cors);
    }

    // /coach: vor die Strava-Secret-Prüfung geroutet, sonst antwortet der
    // Worker ohne Strava-Secrets fälschlich mit 500, bevor /coach überhaupt
    // geprüft wird.
    if (path === "/coach") return handleCoach(request, env, cors);

    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
      return json({ message: "Worker-Secrets STRAVA_CLIENT_ID/SECRET fehlen" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ message: "Ungültiges JSON" }, 400, cors);
    }

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
