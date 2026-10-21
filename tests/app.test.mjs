import pw from "playwright";
import { readFileSync } from "node:fs";
const { chromium } = pw;

const BASE = "http://127.0.0.1:8099";
const SHOTS = process.env.SHOTS;
let fails = 0, checks = 0;
// Zählt die Checks je Szenario (Ledger in tests/README.md). scenario(id) steht in der ersten Zeile jedes Blocks.
const perScenario = new Map(); let curScenario = "0"; const scenario = (id) => { curScenario = id; };
const ok = (cond, msg) => { checks++; perScenario.set(curScenario, (perScenario.get(curScenario) || 0) + 1); if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// Für die Plan-Lade-Tests (A1): eine echte, gültige Kopie zum Vorbelegen
// von localStorage, damit "JSON 404 mit Kopie" nicht künstlich wirkt.
const REAL_PLAN_JSON = readFileSync(new URL("../plans/hm-2027.json", import.meta.url), "utf8");
// Die Stub-UID kommt aus config.js, damit sie nicht kopiert werden muss und
// beim Wechsel der UID nichts auseinanderläuft.
const TEST_UID = readFileSync(new URL("../config.js", import.meta.url), "utf8").match(/ALLOWED_UID\s*=\s*"([^"]+)"/)[1];

// C4: THRESHOLDS im config.js-Stub kommen aus der echten config.js, nicht aus einem
// Literal. Ein fehlender Schlüssel (z. B. lauf) fiele sonst erst im Browser als
// TypeError auf; der Stub-Wächter prüft nur Namen.
const { THRESHOLDS: REAL_THRESHOLDS } = await import("../config.js");

const FIREBASE_STUB = `
const KEY = "test.logs";
const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
export const db = {};
// Auth-Zustand des Tests: sessionStorage (überlebt ein Neuladen, z. B. nach
// signOutUser) vor window.__AUTH__ (per addInitScript) vor "ok".
const AUTH_USERS = {
  ok: { uid: "${TEST_UID}", email: "louis@example.test", isAnonymous: false },
  forbidden: { uid: "fremde-uid-1234567890", email: "fremd@example.test", isAnonymous: false },
  anonymous: { uid: "anon-uid", email: null, isAnonymous: true },
  signedOut: null,
};
const authMode = () => sessionStorage.getItem("test.auth") || window.__AUTH__ || "ok";
const bumpCount = (k) => { window[k] = (window[k] || 0) + 1; };
const fs = () => bumpCount("__FS_CALLS__");
export async function authReady() { return AUTH_USERS[authMode()] ?? null; }
export async function signIn(email, password) {
  bumpCount("__SIGNIN_CALLS__");
  window.__SIGNIN_ARGS__ = [email, password];
  if (window.__SIGNIN_FAIL__) { const e = new Error("bad"); e.code = window.__SIGNIN_FAIL__; throw e; }
  sessionStorage.setItem("test.auth", "ok");
  return AUTH_USERS.ok;
}
export async function signOutUser() {
  sessionStorage.setItem("test.signouts", String(Number(sessionStorage.getItem("test.signouts") || 0) + 1));
  sessionStorage.setItem("test.auth", "signedOut");
}
export async function signOutAndWipeDevice() {
  if (window.__PENDING__ === "hang") return { ok: false, reason: "pending" };
  sessionStorage.setItem("test.wiped", "1");
  sessionStorage.setItem("test.auth", "signedOut");
  return { ok: true, cacheCleared: !window.__CACHE_KEPT__ };
}
export async function waitForPendingWrites() {
  bumpCount("__FLUSH_CALLS__");
  if (window.__PENDING__ === "hang") return new Promise(() => {});
}
export async function authHeaders({ force } = {}) {
  // __TOKEN_FAIL__: true = abgemeldet; ein String = Firebase-Fehlercode (z. B. offline).
  if (authMode() !== "ok" || window.__TOKEN_FAIL__) throw Object.assign(new Error("Firebase: Nicht angemeldet."), { source: "firebase", code: typeof window.__TOKEN_FAIL__ === "string" ? window.__TOKEN_FAIL__ : undefined });
  window.__TOKEN_CALLS__ = (window.__TOKEN_CALLS__ || []).concat([!!force]);
  return { Authorization: "Bearer " + (force ? "fresh-token" : "test-token") };
}
export async function ensureSignedIn() { return AUTH_USERS.ok; }
export async function saveLog(dateISO, slug, data) { fs();
  const s = read(); s[dateISO + "_" + slug] = { date: dateISO, exercise: slug, ...data }; write(s);
}
export async function loadLog(d, s) { fs(); return read()[d + "_" + s] || null; }
export async function loadLogsForDate(d) { fs();
  const out = {}; for (const v of Object.values(read())) if (v.date === d) out[v.exercise] = v; return out;
}
export async function loadAllLogs() { fs(); return Object.values(read()); }
export async function loadAllDayPlans() { fs();
  const out = {};
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("test.dayplan.")) continue;
    const d = JSON.parse(localStorage.getItem(key) || "null");
    out[key.slice("test.dayplan.".length)] = { removed: d?.removed || [], added: d?.added || [] };
  }
  return out;
}
export async function loadLogsForExercise(slug) { fs();
  return Object.values(read()).filter((v) => v.exercise === slug).sort((a, b) => (a.date < b.date ? -1 : 1));
}
export async function loadRunLinks() { fs();
  return JSON.parse(localStorage.getItem("test.runlinks") || "{}");
}
export async function saveRunLink(date, activityId) { fs();
  const all = JSON.parse(localStorage.getItem("test.runlinks") || "{}");
  all[date] = { activityId: activityId ?? null };
  localStorage.setItem("test.runlinks", JSON.stringify(all));
}
export async function clearRunLink(date) { fs();
  const all = JSON.parse(localStorage.getItem("test.runlinks") || "{}");
  delete all[date];
  localStorage.setItem("test.runlinks", JSON.stringify(all));
}
export async function loadDayPlan(dateISO) { fs();
  const d = JSON.parse(localStorage.getItem("test.dayplan." + dateISO) || "null");
  return { removed: d?.removed || [], added: d?.added || [] };
}
export async function saveDayPlan(dateISO, dp) { fs();
  localStorage.setItem("test.dayplan." + dateISO, JSON.stringify(dp));
}
export async function loadCoach(dateISO) { fs();
  return JSON.parse(localStorage.getItem("test.coach." + dateISO) || "null");
}
export async function saveCoach(dateISO, data) { fs();
  localStorage.setItem("test.coach." + dateISO, JSON.stringify(data));
}
export async function loadCoachWeek(key) { fs();
  return JSON.parse(localStorage.getItem("test.coachweek." + key) || "null");
}
export async function saveCoachWeek(key, data) { fs();
  localStorage.setItem("test.coachweek." + key, JSON.stringify(data));
}
export async function saveStravaTokens(t) { fs();
  const cur = JSON.parse(localStorage.getItem("test.strava") || "null") || {};
  localStorage.setItem("test.strava", JSON.stringify({ ...cur, ...t }));
}
export async function loadStravaTokens() { fs(); return JSON.parse(localStorage.getItem("test.strava") || "null"); }
`;

const ACTIVITIES = [
  { id: 1, type: "Run", name: "Easy run", start_date_local: "2026-09-07T07:10:00Z", distance: 8020, moving_time: 3010, average_heartrate: 155 },
  { id: 2, type: "Run", name: "Kurzer Trab", start_date_local: "2026-09-07T18:00:00Z", distance: 2000, moving_time: 800 },
  { id: 3, type: "Run", name: "Long run", start_date_local: "2026-09-05T09:00:00Z", distance: 12030, moving_time: 4700, average_heartrate: 151 },
  { id: 4, type: "Ride", name: "Rad", start_date_local: "2026-09-04T09:00:00Z", distance: 30000, moving_time: 3600 },
  { id: 5, type: "Run", name: "Easy run", start_date_local: "2026-09-02T07:00:00Z", distance: 7010, moving_time: 2680 },
  { id: 6, type: "Run", name: "Nachgeholt", start_date_local: "2026-09-10T18:30:00Z", distance: 8100, moving_time: 3050 },
  { id: 7, type: "WeightTraining", name: "Morning Weight Training", start_date_local: "2026-09-08T10:10:00Z",
    distance: 0, moving_time: 3868, average_heartrate: 118.4, max_heartrate: 155, suffer_score: 15 },
];

const browser = await chromium.launch();

async function newPage({ connected = false, tz = "Europe/Berlin", activities = ACTIVITIES, now = "2026-09-07T09:00:00Z" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: tz });
  const errors = [];
  await ctx.route(/firebase-init\.js/, (r) =>
    r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => {
    const page = new URL(r.request().url()).searchParams.get("page");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(page === "1" ? activities : []) });
  });
  await ctx.route("https://worker.test/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      access_token: "at-new", refresh_token: "rt-new", expires_at: Math.floor(Date.now() / 1000) + 21600,
      athlete: { id: 42 } }) }));
  const page = await ctx.newPage();
  // Zeit einfrieren: die Tests prüfen konkrete Plan-Tage, sie dürfen nicht
  // davon abhängen, wann sie laufen. 07.09.2026 = Woche 2, Montag, Easy run.
  await page.clock.setFixedTime(new Date(now));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.addInitScript(([conn]) => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    if (conn) localStorage.setItem("test.strava", JSON.stringify({
      refresh_token: "rt", access_token: "at", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  }, [connected]);
  return { page, ctx, errors };
}

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

// Kein horizontales Scrollen: sonst laufen Karten/Eingabefelder aus dem Bild.
// Wochen-Tab: Zeile aufklappen und über "Tag öffnen" in die Tagesansicht
// Tab wechseln; auf Detailseiten (Kraft-/Lauf-Tag) gibt es keine Leiste, also erst zurück.
async function goTab(page, tab) {
  if (await page.locator("#app.is-detail").count()) await page.click('[data-action="back"]');
  await page.click(`[data-tab="${tab}"]`);
}

async function openDay(page, iso) {
  const row = page.locator(`.day-row[data-date="${iso}"]`);
  await row.locator('[data-action="toggle-day-detail"]').click();
  await row.locator('[data-action="open-day"]').click();
}

async function noHScroll(page, where) {
  const { doc, over } = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    over: [...document.querySelectorAll("#main *, #header *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => el.tagName + "." + el.className).slice(0, 5),
  }));
  ok(doc <= 0 && over.length === 0, `${where}: nichts ragt über den Rand (${doc}px, ${JSON.stringify(over)})`);
}

// ---- Heute-Seite: stabile Haken statt Layout-Klassen (docs/ui-markup-stride.md, Abschnitt 9) ----
// Karten tragen data-card, die Heute-Karte zusätzlich data-kind und data-progress.
const TODAY = '#today-slot [data-card="today"]';
const COACH = '#coach-slot [data-card="coach"]';
const waitStatusLoaded = (page, timeout = 10000) =>
  page.waitForSelector('[data-card="status"][aria-busy="false"]', { timeout });
// Vier Status-Zeilen als { key, status, title, detail }.
const statusRows = (page) =>
  page.locator('[data-card="status"] [data-action="open-info"]').evaluateAll((els) =>
    els.map((el) => ({
      key: el.dataset.info,
      status: el.dataset.status,
      title: el.querySelector(".sd-statusrow__title").textContent.trim(),
      detail: el.querySelector(".sd-statusrow__detail").textContent.trim(),
    })));
const statusByTitle = async (page) => Object.fromEntries((await statusRows(page)).map((r) => [r.title, r]));
// Coach-Tagessatz (ohne Wochenbilanz).
const coachText = (page) => page.textContent(`${COACH} .sd-coach__text`);
// C5: kein style="..." im gerenderten Heute-Markup.
const styleAttrCount = (page) => page.evaluate(() => document.querySelectorAll("#main [style], #header [style]").length);
// Slots, die laut Spezifikation leer sein müssen, sind wirklich leer (kein Leerraum, kein Kommentar).
const slotIsEmpty = (page, id) => page.evaluate((i) => document.getElementById(i)?.innerHTML === "", id);

// ---- 1. Dashboard, nicht verbunden (07.09.2026 = W2 Montag, Easy run) ----
// Ersetzt die alte "Heute"-Tagesansicht als Starttab (M2-4). Die
// Tagesansicht mit dem Strava-"Verbinden"-Einstieg bleibt über den
// Wochen-Tab erreichbar, siehe unten.
{
  scenario("1");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(TODAY);
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Woche 2 · Aufbau"), "Dashboard: Kopfzeile zeigt Woche + Wochentyp");
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Montag, 7. September", "Dashboard: Überschrift ist das Datum");
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Phase 1 · Basis"), "Dashboard: Phasen-Angabe");
  ok((await page.textContent("#main > header.sd-pagehead")).includes("237 Tage bis 02.05."), "Dashboard: Countdown mit bestätigtem Renndatum (237 Tage)");
  ok((await page.locator('#main > header.sd-pagehead progress[aria-label="Planfortschritt, Woche 2 von 35"]').count()) === 1, "Dashboard: Planfortschritt als Balken mit Beschriftung");
  const today = await page.textContent("#today-slot");
  ok((await page.locator(`${TODAY}[data-kind="lauf"]`).count()) === 1 && today.includes("Easy run") && today.includes("8 km"),
    "Dashboard: Heute-Karte zeigt den Lauftag (Easy run, 8 km)");
  ok((await page.locator(`${TODAY} [data-action="open-day"][data-date="2026-09-07"]`).count()) === 1,
    "Dashboard: Lauf-Karte ist sofort bedienbar, wartet nicht auf Strava");
  // Sobald feststeht, dass Strava nicht verbunden ist: klarer Hinweis statt Dauer-Laden
  await page.waitForSelector('#banner-slot [data-action="connect-strava"]', { timeout: 5000 });
  ok((await page.textContent('#banner-slot [data-card="strava-disconnected"]')).includes("Strava ist nicht verbunden"),
    "Dashboard: Banner nennt 'nicht verbunden' statt dauerhaft zu laden");
  ok((await page.locator(`${TODAY} [role="status"]`).count()) === 0 && !(await page.textContent("#today-slot")).includes("nicht verbunden"),
    "Dashboard: Lauf-Karte zeigt ohne Strava keinen Ist-Block (der Banner erklärt es)");
  ok((await page.locator(COACH).count()) === 1, "Dashboard: Coach-Platzhalter rendert sofort");
  ok((await page.locator('[data-card="status"] [data-action="open-info"]').count()) === 4, "Dashboard: vier Status-Zeilen (Platzhalter) sofort da");
  ok((await page.locator("#detail-slot").count()) === 0 && !(await page.textContent("#main")).includes("Im Detail"),
    "Dashboard: 'Im Detail' ist weg (F3), nichts blockiert");
  ok((await styleAttrCount(page)) === 0, "Dashboard: kein style-Attribut im Heute-Markup (C5)");
  await shot(page, "01-dashboard-nicht-verbunden");
  await noHScroll(page, "Dashboard");
  ok(errors.length === 0, "Dashboard: keine Konsolenfehler " + JSON.stringify(errors));

  await goTab(page, "woche");
  await openDay(page, "2026-09-07");
  await page.waitForSelector('[data-action="connect-strava"]');
  ok(true, "Wochen-Tab: 'Mit Strava verbinden' erscheint ohne Tokens (unverändert aus M1)");
  await ctx.close();
}

// ---- 2. Dashboard, verbunden -> Ist-Werte laden nach, ohne zu blockieren ----
{
  scenario("2");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY} .sd-result`);
  const txt = await page.textContent("#today-slot");
  ok(txt.includes("8,0") && txt.includes("Easy run"), "Dashboard: längster Lauf des Tages (8,0 km statt 2,0), mit Namen");
  ok((await page.locator(`${TODAY} .sd-result`).textContent()).includes("im Plan"), "Dashboard: Lauf ist 'im Plan' (8,0 von 8 km)");
  ok((await page.locator("#banner-slot").innerHTML()) === "", "Dashboard mit Strava: kein Banner, der Slot ist leer");
  ok(!txt.includes("/km /km") && !txt.includes("bpm bpm"), "Dashboard: Zielwerte ohne doppelte Einheit (pace/hf tragen /km und bpm schon)");
  await shot(page, "02-dashboard-mit-strava");
  await noHScroll(page, "Dashboard mit Strava");
  // Pace, Ø HF und Dauer zeigt nicht mehr die Heute-Karte (Markup 9.3: km, Urteil, Name),
  // sondern der Lauf-Tag, den "Lauf ansehen" öffnet.
  await page.click(`${TODAY} [data-action="open-day"]`);
  await page.waitForSelector("#strava-slot .metric-value");
  const run = await page.textContent("#strava-slot");
  ok(run.includes("6:15 /km"), "Lauf-Tag aus Heute: Pace korrekt berechnet");
  ok(run.includes("155 bpm"), "Lauf-Tag aus Heute: Ø HF angezeigt");
  ok(run.includes("50:10 min"), "Lauf-Tag aus Heute: Dauer formatiert");
  ok(errors.length === 0, "Dashboard mit Strava: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2b. Dashboard, Krafttag: Training starten -> Kraft-Tagesansicht -> zurück (F4) ----
{
  scenario("2b");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z")); // Di = Krafttag "Full Body A"
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="kraft"]`);
  const before = await page.textContent("#today-slot");
  ok(before.includes("Full Body A") && before.includes("8 Übungen"), "Dashboard: Krafttag mit Titel + Übungsanzahl");
  ok((await page.locator(`${TODAY}[data-progress="none"] [data-action="open-day"]`).textContent()) === "Training starten",
    "Dashboard: nicht begonnen heißt 'Training starten'");
  ok((await page.locator(`${TODAY} .sd-preview li.sd-preview__row`).count()) === 3 &&
     (await page.textContent(`${TODAY} .sd-preview__more`)).trim() === "+ 5 weitere Übungen",
    "Dashboard: Vorschau zeigt die ersten drei Übungen und '+ 5 weitere Übungen'");
  ok((await page.locator(`${TODAY} .sd-preview button, ${TODAY} .sd-preview a`).count()) === 0 &&
     (await page.locator(`${TODAY} [data-action]`).count()) === 1,
    "Dashboard: Vorschau-Zeilen sind nicht antippbar, der Primärbutton ist der einzige Einstieg");

  await page.click(`${TODAY} [data-action="open-day"]`);
  await page.waitForSelector('[data-ex="squats"]');
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Krafttraining", "Dashboard->Tagesansicht: Krafttag geöffnet");
  ok((await page.textContent('#main > header.sd-pagehead [data-action="back"]')).includes("Heute"), "Dashboard->Tagesansicht: Zurück-Knopf beschriftet mit 'Heute'");

  await page.locator('[data-ex="squats"] [data-kg]').fill("80");
  await page.locator('[data-ex="squats"] [data-reps]').fill("9");
  await page.click('[data-ex="squats"] [data-action="save"]');
  await page.waitForSelector('[data-status="squats"].ok');

  await page.click('[data-action="back"]');
  await page.waitForSelector(`${TODAY}[data-kind="kraft"]`);
  await page.waitForSelector(`${TODAY}[data-progress="partial"]`);
  ok((await page.textContent(TODAY)).includes("1 von 8 Übungen erfasst"), "Dashboard: zurück zeigt den aktualisierten Fortschritt (1 von 8 erfasst)");
  ok((await page.locator(`${TODAY} .sd-preview__row.is-done`).count()) === 1 &&
     (await page.locator(`${TODAY} [data-action="open-day"]`).textContent()) === "Weiter trainieren",
    "Dashboard: erste Übung als erfasst markiert, Button heißt 'Weiter trainieren'");
  await shot(page, "02b-dashboard-krafttag");
  await noHScroll(page, "Dashboard Krafttag");
  ok(errors.length === 0, "Dashboard Krafttag: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c. Dashboard: echte Ampeln (Wochensoll/Belastung/Kraft-Progression) + Info-Sheet (M2-5) ----
{
  scenario("2c");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.addInitScript(() => {
    // Squats und Deadlift hängen bei gleichem Soll/Gewicht zwei Einheiten in
    // Folge fest (Stagnation), Brustpresse steigert normal -> zwei betroffene
    // Übungen = rot (F5 Ampel 4), beide Daten liegen im 42-Tage-Fenster vor
    // dem eingefrorenen Test-Datum 07.09.2026.
    const stagnant = (kg) => [{ kg, reps: 9 }, { kg, reps: 9 }, { kg, reps: 9 }];
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-08-24_squats": { date: "2026-08-24", exercise: "squats", name: "Squats", soll: "3x8-10", topKg: 60, totalReps: 27, completed: true, sets: stagnant(60) },
      "2026-08-31_squats": { date: "2026-08-31", exercise: "squats", name: "Squats", soll: "3x8-10", topKg: 60, totalReps: 27, completed: true, sets: stagnant(60) },
      "2026-08-24_deadlift": { date: "2026-08-24", exercise: "deadlift", name: "Deadlift", soll: "3x8-10", topKg: 70, totalReps: 27, completed: true, sets: stagnant(70) },
      "2026-08-31_deadlift": { date: "2026-08-31", exercise: "deadlift", name: "Deadlift", soll: "3x8-10", topKg: 70, totalReps: 27, completed: true, sets: stagnant(70) },
      "2026-08-24_brustpresse": { date: "2026-08-24", exercise: "brustpresse", name: "Brustpresse", soll: "3x8-10", topKg: 50, totalReps: 24, completed: true, sets: [{ kg: 50, reps: 8 }, { kg: 50, reps: 8 }, { kg: 50, reps: 8 }] },
      "2026-08-31_brustpresse": { date: "2026-08-31", exercise: "brustpresse", name: "Brustpresse", soll: "3x8-10", topKg: 55, totalReps: 27, completed: true, sets: [{ kg: 55, reps: 9 }, { kg: 55, reps: 9 }, { kg: 55, reps: 9 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await waitStatusLoaded(page);

  const byTitle = await statusByTitle(page);

  ok(byTitle["Wochensoll"].status === "gruen", `Ampel Wochensoll: grün erwartet (${byTitle["Wochensoll"].status})`);
  // 16,1 km = Montag exakt (8,02 km) + der auf Mittwoch nachgeholte Lauf vom
  // 10.09. (8,1 km, per assignRuns automatisch zugeordnet) — die Anzeige
  // zeigt die ganze Woche, nicht nur den Anteil bis heute (F5).
  ok(byTitle["Wochensoll"].detail === "16,1 / 29 km · Kraft 0/2", `Ampel Wochensoll: Detailtext (${byTitle["Wochensoll"].detail})`);
  ok(byTitle["Belastung"].status === "grau", `Ampel Belastung: grau ohne 4 Wochen Historie (${byTitle["Belastung"].status})`);
  ok(byTitle["Kraft-Progression"].status === "rot", `Ampel Kraft-Progression: rot bei zwei betroffenen Übungen (${byTitle["Kraft-Progression"].status})`);
  ok(byTitle["Kraft-Progression"].detail.includes("Squats") && byTitle["Kraft-Progression"].detail.includes("+1 weitere"),
     `Ampel Kraft-Progression: Detailtext nennt die schlechteste Übung zuerst (${byTitle["Kraft-Progression"].detail})`);
  ok(["gruen", "gelb", "rot", "grau"].includes(byTitle["Easy-Disziplin"].status),
     `Ampel Easy-Disziplin: rechnet, ohne hängen zu bleiben (${byTitle["Easy-Disziplin"].status})`);

  // "Im Detail" gibt es nicht mehr (F3). Die Rechnungen dahinter bleiben über
  // metrics.test.mjs abgedeckt; hier zählt, dass Ampeln und Coach unverändert da sind.
  ok((await page.locator("#detail-slot").count()) === 0 && !(await page.textContent("#main")).includes("Im Detail"),
    "Im Detail ist weg: kein Detail-Slot, keine Karten (Wochenvolumen, Aerobe Effizienz, Adhärenz, Als Nächstes)");
  ok(JSON.stringify((await statusRows(page)).map((r) => r.title)) === JSON.stringify(["Wochensoll", "Easy-Disziplin", "Belastung", "Kraft-Progression"]),
    "Im Detail ist weg: die Status-Liste hat unverändert vier Zeilen in fester Reihenfolge");
  ok((await page.locator(COACH).count()) === 1, "Im Detail ist weg: die Coach-Karte steht unverändert da");

  // Info-Sheet (D1): öffnen per Klick, Grenzwerte aus THRESHOLDS im Text,
  // per Escape schließen, Fokus kehrt zur Status-Zeile zurück.
  const kraftInfoBtn = page.locator('[data-info="kraft"]');
  await kraftInfoBtn.focus();
  await kraftInfoBtn.press("Enter");
  await page.waitForSelector("#infoSheet.open");
  await page.waitForTimeout(300); // Einblenden abwarten
  await shot(page, "02c0-info-offen");
  // Das Sheet liegt über der Tableiste: an der Stelle der Tableiste trifft ein Klick das Sheet/den Backdrop
  const topEl = await page.evaluate(() => {
    const r = document.getElementById("tabbar").getBoundingClientRect();
    const el = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
    return el?.closest("#infoSheet, #infoBackdrop, #tabbar")?.id || el?.id || el?.tagName;
  });
  ok(topEl === "infoSheet" || topEl === "infoBackdrop", `Info-Sheet liegt über der Tableiste (oben: ${topEl})`);
  ok((await page.getByRole("dialog", { name: "Kraft-Progression" }).isVisible()), "Info-Sheet: Dialog mit dem Titel der Ampel");
  ok((await page.textContent("#infoSheetTitle")) === "Kraft-Progression", "Info-Sheet: Titel passt zur Ampel");
  const body = await page.textContent("#infoSheetBody");
  ok(body.includes("42 Tage"), `Info-Sheet: Grenzwert aus THRESHOLDS (windowDays) im Text (${body.slice(0, 120)})`);
  ok(body.includes("2 oder mehr"), "Info-Sheet: Grenzwert redAffectedCount im Text");
  const heads = await page.locator("#infoSheetBody .sd-sheet__blockhead").allTextContents();
  ok(JSON.stringify(heads) === JSON.stringify(["Berechnung", "Bedeutung", "Grau"]), `Info-Sheet: Blöcke in der Reihenfolge Berechnung, Bedeutung, Grau (${heads})`);
  ok(await page.evaluate(() => document.activeElement.id === "infoSheetTitle"), "Info-Sheet: Fokus springt auf den Titel");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#infoSheet:not(.open)");
  ok(await page.evaluate(() => document.activeElement.dataset.info === "kraft"), "Info-Sheet: Fokus kehrt zur auslösenden Status-Zeile zurück");

  // Backdrop schließt ebenfalls, Fokus kehrt zurück. Das × sitzt im Sheet, der Backdrop-Klick
  // trifft die obere Bildschirmhälfte (das Sheet deckt nur den unteren Teil).
  await page.click('[data-info="wochensoll"]');
  await page.waitForSelector("#infoSheet.open");
  await page.waitForTimeout(300);
  await page.mouse.click(195, 40);
  await page.waitForSelector("#infoSheet:not(.open)");
  ok(await page.evaluate(() => document.activeElement.dataset.info === "wochensoll"), "Info-Sheet: Klick auf den Backdrop schließt, Fokus kehrt zur Status-Zeile zurück");
  await shot(page, "02c-dashboard-ampeln-info");
  await noHScroll(page, "Dashboard Ampeln");
  ok(errors.length === 0, "Dashboard Ampeln: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c-2. Info-Sheet: schnelles Schließen + sofort wieder öffnen (Korrekturrunde 1, Bug 1; C6) ----
// closeInfo() setzte sheet.hidden erst nach 200ms; öffnete man währenddessen
// ein anderes Sheet, feuerte der alte Timer trotzdem noch und versteckte das
// gerade erst geöffnete neue Sheet wieder — Escape/× wirkten danach nicht
// mehr, weil closeInfo() sheet.hidden fälschlich als "schon zu" las.
// Mit createSheet() hat jedes Sheet seinen eigenen Timer; der Wechsel A -> B und
// B -> A zwischen Info- und Zuordnungs-Sheet wird in E6 ergänzt, sobald es das
// zweite Sheet gibt.
{
  scenario("2c-2");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector('[data-info="wochensoll"]');
  await page.click('[data-info="wochensoll"]');
  await page.waitForSelector("#infoSheet.open");
  // Schließen (startet den Ausblende-Timer) und im selben Atemzug ein ANDERES Sheet-Thema öffnen.
  // Per Skript statt per Maus: das gleitende Sheet würde die Zeile für Playwright noch verdecken.
  await page.evaluate(() => {
    document.getElementById("infoSheetClose").click();
    document.querySelector('[data-info="kraft"]').click();
  });
  await page.waitForSelector("#infoSheet.open");
  await page.waitForTimeout(400); // der alte Timer wäre jetzt längst gefeuert
  ok(await page.locator("#infoSheet.open").isVisible(), "Info-Sheet: bleibt nach dem alten Timeout weiterhin sichtbar offen");
  ok((await page.textContent("#infoSheetTitle")) === "Kraft-Progression", "Info-Sheet: zeigt das zuletzt geöffnete Sheet");
  await page.keyboard.press("Escape");
  // Kurzes Timeout statt unbegrenzt warten: bei einer Regression hängt
  // das Schließen sonst (stale hidden-Zustand lässt Escape verpuffen).
  let escapeWorked = true;
  try {
    await page.waitForSelector("#infoSheet:not(.open)", { timeout: 3000 });
  } catch {
    escapeWorked = false;
  }
  ok(escapeWorked, "Info-Sheet: Escape schließt weiterhin zuverlässig (kein stale-Zustand)");
  if (escapeWorked) {
    // hidden folgt der Ausblendzeit — darauf warten, nicht sofort zählen
    const hid = await page.waitForSelector("#infoSheet[hidden]", { state: "attached", timeout: 2000 }).then(() => true, () => false);
    ok(hid, "Info-Sheet: nach Escape auch tatsächlich hidden");
  }
  ok(await page.evaluate(() => document.activeElement.dataset.info === "kraft"), "Info-Sheet: nach schnellem Wechsel kehrt der Fokus zum zuletzt geöffneten Auslöser zurück");
  ok(errors.length === 0, "Info-Sheet Stale-Timeout: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c-3. Wochen-Tab: heutiger Krafttag mit Teilfortschritt (Korrekturrunde 1) ----
{
  scenario("2c-3");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z")); // Di = Full Body A
  await page.addInitScript(() => {
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-08_squats": { date: "2026-09-08", exercise: "squats", name: "Squats", soll: "3x8-10", topKg: 60, totalReps: 27, completed: true, sets: [{ kg: 60, reps: 9 }, { kg: 60, reps: 9 }, { kg: 60, reps: 9 }] },
      "2026-09-08_deadlift": { date: "2026-09-08", exercise: "deadlift", name: "Deadlift", soll: "3x5", topKg: 80, totalReps: 15, completed: true, sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }, { kg: 80, reps: 5 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  const row = page.locator('.day-row[data-date="2026-09-08"]');
  await row.waitFor();
  const pill = (await row.locator(".partial-pill").textContent()).trim();
  ok(pill === "Heute · 2/8", `Woche: heutiger Krafttag zeigt "Heute · 2/8" (${pill})`);
  ok(await row.evaluate((el) => el.classList.contains("today")), "Woche: heutiger Tag behält den Teal-Rahmen");
  await row.locator('[data-action="toggle-day-detail"]').click();
  const detail = await row.locator(".day-detail").textContent();
  ok(detail.includes("Squats:") && detail.includes("60 kg · 27 Wdh"), "Woche: Details zeigen geloggte Werte je Übung");
  ok(detail.includes("Nordic hamstring curl:") && detail.includes("–"), "Woche: noch nicht geloggte Übung mit Strich");
  ok(errors.length === 0, "Woche Teilfortschritt: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c-4. Tableiste folgt immer dem angezeigten Tab (Korrekturrunde 1) ----
{
  scenario("2c-4");
  const { page, ctx, errors } = await newPage();
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z")); // Di = Krafttag
  await page.goto(BASE + "/index.html");
  const active = () => page.locator("#tabbar button.active").getAttribute("data-tab");
  await page.waitForSelector(TODAY);
  ok((await active()) === "dashboard", "Tableiste: Start auf Dashboard markiert");
  await goTab(page, "woche");
  await page.waitForSelector(".week-summary");
  ok((await active()) === "woche", "Tableiste: Woche markiert im Wochen-Tab");
  await openDay(page, "2026-09-08");
  await page.waitForSelector("[data-ex]");
  ok((await active()) === "woche", "Tableiste: Tagesansicht aus der Woche bleibt bei Woche");
  await goTab(page, "dashboard");
  await page.click(`${TODAY} [data-action="open-day"]`);
  await page.waitForSelector("[data-ex]");
  ok((await active()) === "dashboard", "Tableiste: Tagesansicht aus dem Dashboard bleibt bei Dashboard");
  await page.click('[data-action="back"]');
  await page.waitForSelector(TODAY);
  ok((await page.locator("#tabbar button.active").count()) === 1 && (await active()) === "dashboard", "Tableiste: nach Zurück genau ein aktiver Tab");
  ok(errors.length === 0, "Tableiste: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2d. Dashboard: Coach — Cache, Escaping, Fallback (M2-9/M2-10) ----
// 07.09.2026 ist ein Montag (Woche 2) mit einer echten Vorwoche (Woche 1,
// nicht platzhaltergefüllt) — hier lösen also sowohl der Tagessatz als auch
// die Wochenbilanz je einen eigenen /coach-Request aus (unterschieden über
// das "kind"-Feld im Request-Body, wie im Worker-Schema).
{
  scenario("2d");
  const { page, ctx, errors } = await newPage({ connected: true });
  const requestKinds = [];
  let dailyBody = null;
  await ctx.route("https://worker.test/coach", (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    requestKinds.push(body.kind);
    if (body.kind === "daily") dailyBody = body;
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: '<img src=x onerror="window.__xss=1">', kind: body.kind, model: "m", promptVersion: "v1" }),
    });
  });
  const countKind = (k) => requestKinds.filter((x) => x === k).length;

  await page.goto(BASE + "/index.html");
  await page.waitForSelector(COACH);
  await page.waitForFunction(() => document.querySelector('#coach-slot [data-card="coach"] .sd-coach__text')?.textContent.includes("<img"));
  const coachTxt = await coachText(page);
  ok(coachTxt.includes("<img src=x"), `Coach: KI-Text wird als Text angezeigt, nicht ausgeführt (${coachTxt})`);
  ok((await page.evaluate(() => window.__xss)) === undefined, "Coach: eingebetteter onerror-Handler wird NICHT ausgeführt (A5)");

  // Montag -> Wochenbilanz automatisch ausgeklappt (F6/D4), gleiche Escaping-Regel.
  await page.getByRole("heading", { name: "Wochenbilanz · Woche 1" }).waitFor();
  await page.waitForFunction(() => document.querySelector("#coach-slot #bilanzBody")?.textContent.includes("<img"));
  ok((await page.evaluate(() => window.__xss)) === undefined, "Wochenbilanz: eingebetteter onerror-Handler wird NICHT ausgeführt (A5)");
  ok((await page.locator('#coach-slot [data-action="toggle-bilanz"]').count()) === 0 && (await page.locator("#bilanzBody").isVisible()),
    "Wochenbilanz: montags offen, ohne Auslöser (F3)");
  ok(countKind("daily") === 1, `Coach: genau ein daily-Request beim ersten Laden (${JSON.stringify(requestKinds)})`);
  ok(dailyBody?.today?.name === "Easy run 8 km · HF bis 163", `Coach: Lauftag schickt Distanz und HF-Obergrenze mit (${dailyBody?.today?.name})`);
  ok(countKind("weekly") === 1, `Coach: genau ein weekly-Request für die Wochenbilanz (${JSON.stringify(requestKinds)})`);

  // Gleicher Hash beim erneuten Aufruf des Dashboards -> kein zweiter Request je kind.
  await goTab(page, "verlauf");
  await goTab(page, "dashboard");
  await page.waitForSelector(COACH);
  await page.waitForTimeout(300);
  ok(countKind("daily") === 1, `Coach: gleicher Hash löst keinen zweiten daily-Request aus (${JSON.stringify(requestKinds)})`);
  ok(countKind("weekly") === 1, `Coach: gleicher Hash löst keinen zweiten weekly-Request aus (${JSON.stringify(requestKinds)})`);
  await shot(page, "02d-dashboard-coach");
  ok(errors.length === 0, "Coach: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2d-2. Wochenbilanz an einem anderen Wochentag: eingeklappt, per Tap auf (M2-10) ----
{
  scenario("2d-2");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => {
    const page = new URL(r.request().url()).searchParams.get("page");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(page === "1" ? ACTIVITIES : []) });
  });
  await ctx.route("https://worker.test/coach", (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: body.kind === "weekly" ? "Wochenbilanz-Text." : "Tagessatz.", kind: body.kind, model: "m", promptVersion: "v1" }),
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z")); // Dienstag, Woche 2
  await page.addInitScript(() => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    localStorage.setItem("test.strava", JSON.stringify({ refresh_token: "rt", access_token: "at", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(COACH);
  await page.waitForSelector('[data-action="toggle-bilanz"]');
  const label = await page.textContent('[data-action="toggle-bilanz"]');
  ok(label.includes("Wochenbilanz W1"), `Wochenbilanz: Kurzform nennt die bilanzierte Woche (${label.trim()})`);
  ok((await page.locator("#bilanzBody").isVisible()) === false && (await page.getAttribute('[data-action="toggle-bilanz"]', "aria-expanded")) === "false",
    "Wochenbilanz: an einem anderen Tag als Montag eingeklappt");
  await page.click('[data-action="toggle-bilanz"]');
  await page.waitForSelector("#bilanzBody:not([hidden])");
  ok((await page.textContent("#bilanzBody")).includes("Wochenbilanz-Text."), "Wochenbilanz: per Tap aufklappbar");
  ok((await page.getAttribute('[data-action="toggle-bilanz"]', "aria-expanded")) === "true" && await page.evaluate(() => document.activeElement.dataset.action === "toggle-bilanz"),
    "Wochenbilanz: aria-expanded folgt, der Fokus bleibt auf dem Auslöser");
  await noHScroll(page, "Wochenbilanz eingeklappt");
  ok(errors.length === 0, "Wochenbilanz eingeklappt: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2e. Coach: abgeschalteter Worker -> Regel-Fallback ----
{
  scenario("2e");
  const { page, ctx, errors } = await newPage();
  await ctx.route("https://worker.test/coach", (r) => r.abort("failed"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(COACH);
  await page.waitForFunction(() => (document.querySelector('#coach-slot [data-card="coach"] .sd-coach__text')?.textContent.length ?? 0) > 0);
  const txt = await coachText(page);
  ok(txt.length > 0, `Coach: Regel-Fallback erscheint bei abgeschaltetem Worker (${txt})`);
  // Kein "keine Konsolenfehler"-Check hier: route.abort() erzeugt absichtlich
  // ein "Failed to load resource"-Netzwerkprotokoll, keinen echten App-Fehler
  // (wie schon bei der Strava-Herkunfts-Ablehnung in M2-3).
  await ctx.close();
}

// ---- 2f. Coach: Dokument nicht lesbar -> kein API-Aufruf (A4) ----
{
  scenario("2f");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({
    contentType: "application/javascript",
    body: `
      export const db = {};
      export async function authReady() { return { uid: "${TEST_UID}", email: "t@example.test", isAnonymous: false }; }
      export async function signIn() {}
      export async function signOutUser() {}
      export async function signOutAndWipeDevice() { return { ok: true }; }
      export async function waitForPendingWrites() {}
      export async function authHeaders() { return { Authorization: "Bearer test-token" }; }
      export async function ensureSignedIn() { return { uid: "t" }; }
      export async function loadCoach() { throw new Error("Missing or insufficient permissions."); }
      export async function saveCoach() {}
      export async function loadCoachWeek() { return null; }
      export async function saveCoachWeek() {}
      export async function loadLogsForDate() { return {}; }
      export async function loadDayPlan() { return { removed: [], added: [] }; }
      export async function saveDayPlan() {}
      export async function loadAllLogs() { return []; }
      export async function loadAllDayPlans() { return {}; }
      export async function loadLogsForExercise() { return []; }
      export async function loadRunLinks() { return {}; }
      export async function saveRunLink() {}
      export async function clearRunLink() {}
      export async function saveLog() {}
      export async function saveStravaTokens() {}
      export async function loadStravaTokens() { return null; }`,
  }));
  let coachRequests = 0;
  await ctx.route("https://worker.test/coach", (r) => { coachRequests++; r.fulfill({ contentType: "application/json", body: JSON.stringify({ text: "x" }) }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("hm-tracker.workerUrl", "https://worker.test"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(COACH);
  await page.waitForTimeout(300);
  ok(coachRequests === 0, `Coach: kein API-Aufruf, wenn das Coach-Dokument nicht lesbar ist (${coachRequests})`);
  ok((await page.locator(`${COACH} .sd-coach__text`).count()) === 1 && (await page.locator("#main [data-card=\"error\"]").count()) === 0,
    "Coach: trotzdem ein Fallback-Text sichtbar, keine Fehlerkarte");
  ok(errors.length === 0, "Coach ohne lesbares Dokument: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 35. Heute (Stride E3): Zustände der Heute-Karte und "Diese Woche" ----
// Neue Prüfabsichten aus E3, kein Altbestand. Pläne mit Platzhalterwoche bzw. zwei Ruhetagen in Folge
// werden aus REAL_PLAN_JSON abgeleitet (Review C8), damit die Checks mit der Re-Kalibrierung
// am 28.10. auf main nicht brechen.
function derivedPlan(edit) {
  const plan = JSON.parse(REAL_PLAN_JSON);
  edit(plan);
  return JSON.stringify(plan);
}
// Woche 3 und später sind Platzhalter (Details erst nach der Re-Kalibrierung am `recal`).
const placeholderPlanJSON = (recal) => derivedPlan((plan) => {
  plan.detailedUntilWeek = 2;
  plan.recalibrationDates = recal;
  plan.weeks = plan.weeks.map((w) => w.n <= 2 ? w
    : { n: w.n, start: w.start, phase: w.phase, weekType: w.weekType, deload: w.deload, focus: w.focus, placeholder: true, plannedKm: w.plannedKm });
});
const routePlan = (ctx, json) => ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ contentType: "application/json", body: json }));
const weekStripTexts = (page) => page.locator('[data-card="week"] .sd-wd .sd-vh').allTextContents();

// 35a. Ruhetag mit "Morgen"-Zeile (antippbar) und ohne (morgen ebenfalls Ruhe)
{
  scenario("35a");
  const { page, ctx, errors } = await newPage({ now: "2026-09-11T09:00:00Z" }); // Fr = Ruhe, Sa = Long run 13 km
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="rest"]`);
  const rest = await page.textContent(TODAY);
  ok(rest.includes("Heute · Ruhe") && rest.includes("Ruhetag") && rest.includes("Mobility"), "Ruhetag: Karte mit Hinweistext");
  const next = page.locator(`${TODAY} button[data-action="open-day"]`);
  ok((await next.getAttribute("data-date")) === "2026-09-12" && (await next.textContent()).includes("Morgen") && (await next.textContent()).includes("Long run · 13 km"),
    "Ruhetag: 'Morgen' nennt den Long Run und führt zum morgigen Tag");
  await next.click();
  await page.waitForSelector("#main > header.sd-pagehead h1");
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Lauf" && (await page.textContent('#main > header.sd-pagehead [data-action="back"]')).includes("Heute"),
    "Ruhetag: 'Morgen' öffnet den Lauf-Tag, Zurück heißt 'Heute'");
  ok(errors.length === 0, "Ruhetag: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();

  // Abgeleiteter Plan: der Long Run am Samstag entfällt, morgen ist ebenfalls Ruhe.
  const two = await newPage({ now: "2026-09-11T09:00:00Z" });
  await routePlan(two.ctx, derivedPlan((plan) => {
    plan.weeks[1].sessions = plan.weeks[1].sessions.filter((s) => s.date !== "2026-09-12");
  }));
  await two.page.goto(BASE + "/index.html");
  await two.page.waitForSelector(`${TODAY}[data-kind="rest"]`);
  ok((await two.page.textContent(TODAY)).includes("Morgen") && (await two.page.textContent(TODAY)).includes("Ruhetag") &&
     (await two.page.locator(`${TODAY} [data-action]`).count()) === 0,
    "Ruhetag: ist morgen auch Ruhe, steht die Zeile ohne Knopf da");
  await two.ctx.close();
}

// 35b. Long Run: eigene Art, "im Plan" bei 12,0 von 12 km
{
  scenario("35b");
  const { page, ctx } = await newPage({ connected: true, now: "2026-09-05T09:00:00Z" }); // Sa W1 = Long run 12 km
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="long"] .sd-result`);
  const long = await page.textContent(TODAY);
  ok(long.includes("Heute · Long run") && long.includes("12,0") && long.includes("im Plan"), "Long Run: Karte der Art 'long' mit Ist-Wert und 'im Plan'");
  ok(!long.includes("nachgeholt"), "Long Run: exakter Treffer ist nicht 'nachgeholt'");
  await ctx.close();
}

// 35c. Urteil zur Distanz: 89 % ist "zu kurz", 90 % ist "im Plan" (F8, THRESHOLDS.lauf.zuKurz)
for (const [meters, want, notWant, label] of [[7120, "zu kurz", "im Plan", "89 %"], [7200, "im Plan", "zu kurz", "90 %"]]) {
  scenario("35c");
  const acts = [{ id: 1, type: "Run", name: "Easy run", start_date_local: "2026-09-07T07:10:00Z", distance: meters, moving_time: 3000, average_heartrate: 150 }];
  const { page, ctx } = await newPage({ connected: true, activities: acts });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY} .sd-result`);
  const res = await page.textContent(`${TODAY} .sd-result`);
  ok(res.includes(want) && !res.includes(notWant), `Lauf-Urteil: ${label} von 8 km heißt '${want}' (${res.replace(/\s+/g, " ").trim()})`);
  await ctx.close();
}

// 35d. Nachgeholt: der Lauf vom Donnerstag gehört zum Mittwochs-Termin
{
  scenario("35d");
  const { page, ctx } = await newPage({ connected: true, now: "2026-09-09T09:00:00Z" }); // Mi = Easy run + 4x20s
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY} .sd-result`);
  const res = await page.textContent(`${TODAY} .sd-result`);
  ok(res.includes("nachgeholt") && res.includes("8,1") && res.includes("Nachgeholt"), `Nachgeholt: Pille, Distanz und Laufname (${res.replace(/\s+/g, " ").trim()})`);
  await ctx.close();
}

// 35e. Platzhalterwoche: keine erfundenen Einheiten, ehrlicher Satz, Slot "Diese Woche" leer
for (const [recal, wantText, label] of [
  [["2026-09-30"], ["stehen ab dem 30.09. fest", "Geplant sind 32 km"], "mit Re-Kalibrierungsdatum"],
  [[], ["stehen nach der Re-Kalibrierung fest"], "ohne bekanntes Datum"],
]) {
  scenario("35e");
  const { page, ctx, errors } = await newPage({ now: "2026-09-16T09:00:00Z" }); // Mi W3
  await routePlan(ctx, placeholderPlanJSON(recal));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="placeholder"]`);
  const txt = await page.textContent(TODAY);
  ok(wantText.every((t) => txt.includes(t)), `Platzhalterwoche (${label}): Text nennt Datum und Kilometer bzw. kürzere Fassung (${txt.replace(/\s+/g, " ").trim()})`);
  ok((await page.locator(`${TODAY} [data-action]`).count()) === 0 && (await page.textContent("#main > header.sd-pagehead")).includes("Woche 3 · Aufbau"),
    `Platzhalterwoche (${label}): Karte ohne Knopf, Kopf nennt die Woche`);
  await waitStatusLoaded(page);
  ok((await slotIsEmpty(page, "week-slot")) && (await statusRows(page)).every((r) => r.status === "grau") &&
     (await statusByTitle(page))["Wochensoll"].detail === "Woche ohne Details",
    `Platzhalterwoche (${label}): 'Diese Woche' leer, Status grau mit Grund`);
  ok(errors.length === 0, `Platzhalterwoche (${label}): keine Konsolenfehler ` + JSON.stringify(errors));
  await ctx.close();
}

// 35f. "Diese Woche": sieben Tage mit Zustand, Volumen, Tipp öffnet Woche; kein style-Attribut (C5)
{
  scenario("35f");
  // Do 10.09.: Mo erledigt (Lauf), Di verpasst (Kraft ohne Log), Mi erledigt (nachgeholt), Do heute.
  const { page, ctx, errors } = await newPage({ connected: true, now: "2026-09-10T09:00:00Z" });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector('[data-card="week"]');
  ok((await page.locator('[data-card="week"] .sd-wd').count()) === 7, "Diese Woche: immer sieben Tage");
  const strip = await weekStripTexts(page);
  ok(JSON.stringify(strip) === JSON.stringify([
    "Montag, Lauf 8 km, erledigt", "Dienstag, Kraft A, verpasst", "Mittwoch, Lauf 8 km, erledigt",
    "Donnerstag, Kraft B, offen, heute", "Freitag, Ruhetag", "Samstag, Long Run 13 km, offen", "Sonntag, Ruhetag",
  ]), `Diese Woche: Zustand je Tag für Screenreader (${JSON.stringify(strip)})`);
  ok((await page.locator('[data-card="week"] .sd-wd.is-done').count()) === 2 && (await page.locator('[data-card="week"] .sd-wd.is-missed').count()) === 1 &&
     (await page.locator('[data-card="week"] .sd-wd.is-today').count()) === 1 && (await page.locator('[data-card="week"] .sd-wd--long').count()) === 1,
    "Diese Woche: erledigt, verpasst, heute und Long Run sind unterscheidbar markiert");
  const bar = page.locator('[data-card="week"] progress');
  ok((await bar.getAttribute("value")) === "16.1" && (await bar.getAttribute("max")) === "29" &&
     (await page.textContent('[data-card="week"]')).includes("16,1 / 29 km"),
    "Diese Woche: Laufvolumen als <progress> mit Punkt im Attribut und Komma im Text (16,1 / 29 km)");
  ok((await styleAttrCount(page)) === 0, "Heute mit allen Karten: kein style-Attribut im Markup (C5)");
  await page.click('[data-action="go-tab"][data-tab="woche"]');
  await page.waitForSelector(".week-summary");
  ok((await page.locator("#tabbar button.active").getAttribute("data-tab")) === "woche" && (await page.textContent("#main > header.sd-pagehead .t1")).includes("Woche 2"),
    "Diese Woche: Tipp auf die Karte öffnet den Tab Woche (aktuelle Woche), die Tab-Leiste folgt");
  ok(errors.length === 0, "Diese Woche: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();

  // Dasselbe mit vollständig erfasstem Dienstag: erledigt statt verpasst.
  const full = await newPage({ connected: true, now: "2026-09-10T09:00:00Z" });
  await full.page.addInitScript(() => {
    const logs = {};
    for (const ex of ["squats", "deadlift", "nordic-hamstring-curl", "klimmzuege", "brustpresse", "soleus-raises", "pallof-press", "planks-wechselnd"]) {
      logs["2026-09-08_" + ex] = { date: "2026-09-08", exercise: ex, name: ex, soll: "3x5", topKg: 40, totalReps: 15, completed: true, sets: [{ kg: 40, reps: 5 }] };
    }
    localStorage.setItem("test.logs", JSON.stringify(logs));
  });
  await full.page.goto(BASE + "/index.html");
  await full.page.waitForSelector('[data-card="week"]');
  const strip2 = await weekStripTexts(full.page);
  ok(strip2[1] === "Dienstag, Kraft A, erledigt" && (await full.page.locator('[data-card="week"] .sd-wd.is-missed').count()) === 0 &&
     (await full.page.locator('[data-card="week"] .sd-wd.is-done').count()) === 3,
    `Diese Woche: voll erfasster Krafttag ist erledigt, nichts verpasst (${strip2[1]})`);
  await full.ctx.close();
}

// 35g. Fremder Text auf Heute läuft durch esc(): Strava-Laufname
{
  scenario("35g");
  const acts = [{ id: 1, type: "Run", name: '<img src=x onerror="window.__xss=1">', start_date_local: "2026-09-07T07:10:00Z", distance: 8000, moving_time: 3000, average_heartrate: 150 }];
  const { page, ctx, errors } = await newPage({ connected: true, activities: acts });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY} .sd-result`);
  ok((await page.textContent(`${TODAY} .sd-result__name`)).includes("<img src=x") && (await page.evaluate(() => window.__xss)) === undefined &&
     (await page.locator(`${TODAY} .sd-result img`).count()) === 0,
    "Heute: Laufname aus Strava wird als Text angezeigt, nicht ausgeführt");
  ok(errors.length === 0, "Heute Escaping: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 3. Woche: Navigation, Tag öffnen (M2-7: neue Tagesliste statt Grid) ----
{
  scenario("3");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await page.waitForSelector(".day-row");
  ok((await page.locator(".day-row").count()) === 7, "Woche: 7 Tage");
  ok((await page.textContent("#main > header.sd-pagehead .t1")).includes("Woche 2"), "Woche: aktuelle Woche 2");
  ok((await page.locator(".day-row.today").count()) === 1, "Woche: heute markiert");
  ok((await page.locator('[data-action="week-today"]').count()) === 0, "Woche: kein 'Heute'-Knopf, wenn schon die aktuelle Woche zu sehen ist");
  await page.click('[data-action="week-next"]');
  await page.waitForFunction(() => document.querySelector("#main > header.sd-pagehead .t1")?.textContent.includes("Woche 3"));
  ok(true, "Woche: vorwärts blättern");
  await page.click('[data-action="week-prev"]');
  await page.click('[data-action="week-prev"]');
  await page.waitForFunction(() => document.querySelector("#main > header.sd-pagehead .t1")?.textContent.includes("Woche 1"));
  ok(true, "Woche: rückwärts blättern");
  ok(await page.locator('[data-action="week-prev"]').isDisabled(), "Woche: bei Woche 1 kein Zurück");
  ok((await page.locator('[data-action="week-today"]').count()) === 1, "Woche: 'Heute'-Knopf erscheint außerhalb der aktuellen Woche");
  await page.click('[data-action="week-today"]');
  await page.waitForFunction(() => document.querySelector("#main > header.sd-pagehead .t1")?.textContent.includes("Woche 2"));
  ok(true, "Woche: 'Heute' springt zurück");
  await page.waitForSelector(".week-summary");
  await shot(page, "03-woche");
  await noHScroll(page, "Woche");

  // Status-Symbole und Ist/Ziel-Zeile der neuen Tagesliste
  const rows = await page.locator(".day-row.solid").evaluateAll((els) =>
    els.map((el) => el.querySelector(".mid .n").textContent.trim()));
  ok(rows.includes("Easy run") && rows.includes("Full Body A"), `Woche: Tagesliste zeigt Lauf- und Krafteinheiten (${rows.join(", ")})`);
  const monday = page.locator('.day-row[data-date="2026-09-07"]');
  ok((await monday.locator(".mid .s").textContent()).startsWith("Ist:"), "Woche: bereits gelaufener Tag zeigt Ist statt Ziel");

  // Antippen klappt Details auf, ohne die Ansicht zu wechseln
  const tue = page.locator('.day-row[data-date="2026-09-08"]');
  ok(!(await tue.locator(".day-detail").isVisible()), "Woche: Details zunächst zu");
  await tue.locator('[data-action="toggle-day-detail"]').click();
  ok(await tue.locator(".day-detail").isVisible(), "Woche: Antippen klappt die Details auf");
  ok((await tue.locator('[data-action="toggle-day-detail"]').getAttribute("aria-expanded")) === "true", "Woche: aria-expanded folgt dem Zustand");
  ok((await tue.locator(".day-detail").textContent()).includes("Übungen"), "Woche: Kraft-Details zeigen die Übungsliste");
  ok((await page.locator(".week-summary").count()) === 1, "Woche: Aufklappen bleibt im Wochen-Tab");
  ok((await page.locator('.day-row.rest [data-action]').count()) === 0, "Woche: Ruhetage sind nicht antippbar");
  await tue.locator('[data-action="toggle-day-detail"]').click();
  ok(!(await tue.locator(".day-detail").isVisible()), "Woche: zweites Antippen klappt wieder zu");

  // Dienstag = Krafttag über "Tag öffnen" in die Tagesansicht
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex]');
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Krafttraining", "Tagesansicht: Krafttag geöffnet");
  ok((await page.locator("[data-ex]").count()) === 8, "Krafttag: 8 Übungen");
  await page.click('[data-action="back"]');
  await page.waitForSelector(".day-row");
  ok(true, "Tagesansicht: Zurück zur Woche");
  ok(errors.length === 0, "Woche: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 4. Kraft eintragen, speichern, nach Reload noch da ----
{
  scenario("4");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="squats"]');

  const squats = page.locator('[data-ex="squats"]');
  ok((await squats.textContent()).includes("Gilt für alle 3 Sätze"), "Kraft: einfacher Modus mit Satzanzahl");
  await squats.locator("[data-kg]").fill("80");
  await squats.locator("[data-reps]").fill("9");
  await squats.locator('[data-action="save"]').click();
  await page.waitForSelector('[data-status="squats"].ok');
  ok((await squats.locator(".status").textContent()) === "Gespeichert.", "Kraft: Speicher-Rückmeldung");
  ok((await page.textContent("#progress-line")) === "1 von 8 Übungen erfasst", "Kraft: Fortschritt aktualisiert");

  // ohne Eingabe speichern -> Warnung
  const dl = page.locator('[data-ex="deadlift"]');
  await dl.locator('[data-action="save"]').click();
  ok((await dl.locator(".status").textContent()) === "Nichts eingetragen.", "Kraft: leere Eingabe wird abgefangen");

  // Einzelsätze
  await squats.locator('[data-action="toggle-sets"]').click();
  ok((await squats.locator(".set-row").count()) === 3, "Kraft: Umschalten auf 3 Einzelsätze");
  const kgs = await squats.locator("[data-kg]").evaluateAll((els) => els.map((e) => e.value));
  ok(kgs.join(",") === "80,80,80", "Kraft: Werte bleiben beim Umschalten erhalten");
  await squats.locator(".set-row").nth(2).locator("[data-kg]").fill("85");
  await squats.locator('[data-action="save"]').click();
  await shot(page, "04-krafttag");
  await noHScroll(page, "Krafttag");

  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="squats"]');
  const sq2 = page.locator('[data-ex="squats"]');
  ok((await sq2.locator(".set-row").count()) === 3, "Kraft: nach Reload wieder Einzelsatz-Ansicht (Werte unterschiedlich)");
  const kgs2 = await sq2.locator("[data-kg]").evaluateAll((els) => els.map((e) => e.value));
  ok(kgs2.join(",") === "80,80,85", "Kraft: Werte nach Reload erhalten");
  ok((await page.textContent("#progress-line")) === "1 von 8 Übungen erfasst", "Kraft: Fortschritt nach Reload");
  ok(errors.length === 0, "Kraft: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 5. Verlauf ----
{
  scenario("5");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.addInitScript(() => {
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-01_squats": { date: "2026-09-01", exercise: "squats", topKg: 70, totalReps: 27, completed: true, sets: [{ kg: 70, reps: 9 }] },
      "2026-09-08_squats": { date: "2026-09-08", exercise: "squats", topKg: 80, totalReps: 27, completed: true, sets: [{ kg: 80, reps: 9 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await goTab(page, "verlauf");
  await page.waitForSelector("#ex-picker");
  ok((await page.locator(".bar").count()) === 2, "Verlauf Kraft: 2 Balken");
  const heights = await page.locator(".bar").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  ok(heights[1] > heights[0] && heights[1] > 10, `Verlauf Kraft: Balkenhöhen echt (${heights.join(", ")})`);
  ok((await page.textContent("#main")).includes("80 kg"), "Verlauf Kraft: Werte gelabelt");
  await shot(page, "05-verlauf-kraft");
  await noHScroll(page, "Verlauf Kraft");

  await page.selectOption("#ex-picker", "deadlift");
  await page.waitForSelector(".center-note");
  ok((await page.textContent("#main")).includes("Noch nichts erfasst"), "Verlauf Kraft: leere Übung sauber");

  await page.click('[data-action="hist-mode"][data-mode="lauf"]');
  await page.waitForSelector(".bars");
  ok((await page.locator(".bar").count()) === 5, "Verlauf Lauf: 5 Läufe (Radfahrt gefiltert)");
  const h2 = await page.locator(".bar").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  ok(new Set(h2).size > 1 && Math.min(...h2) >= 8, `Verlauf Lauf: Balken haben echte Höhen (${h2.join(", ")})`);
  const t = await page.textContent("#main");
  ok(t.includes("29,1 km"), "Verlauf Lauf: 7-Tage-Summe zählt nur bis heute");
  await shot(page, "06-verlauf-lauf");
  await noHScroll(page, "Verlauf Lauf");
  ok(errors.length === 0, "Verlauf: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 6. Plan-Tab ----
{
  scenario("6");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await goTab(page, "plan");
  await page.waitForSelector(".zone-line");
  const t = await page.textContent("#main");
  ok((await page.textContent("#main > header.sd-pagehead .eyebrow")).includes("Woche 2 von 35"), "Plan: aktuelle Woche (35 Wochen)");
  ok((await page.locator(".phase-card.is-current").count()) === 1, "Plan: laufende Phase hervorgehoben");
  ok((await page.locator(".phase-card").count()) === 4, "Plan: 4 Phasenkarten, farblich getrennt");
  ok((await page.locator(".zone-line").count()) === 5, "Plan: 5 Zonen");
  ok(t.includes("148–163 bpm"), "Plan: HF-Werte sichtbar");
  ok(t.includes("1:29:59 h"), "Plan: Zielzeit prominent");
  ok((await page.locator(".timeline .seg").count()) === 4, "Plan: Zeitleiste über alle vier Phasen");
  const fill = await page.locator(".timeline .seg i").first().evaluate((el) => el.getBoundingClientRect().width);
  ok(fill > 0, `Plan: Fortschritt in der laufenden Phase sichtbar (${Math.round(fill)}px)`);
  const tones = await page.locator(".phase-card").evaluateAll((els) =>
    [...new Set(els.map((e) => getComputedStyle(e).backgroundColor))]);
  ok(tones.length === 4, `Plan: jede Phase hat eine eigene Farbe (${tones.length} verschiedene)`);
  await shot(page, "07-plan");
  await noHScroll(page, "Plan");
  ok(errors.length === 0, "Plan: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 7. Zeitzonen-Regression: 00:30 Berlin = Vortag in UTC ----
{
  scenario("7");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-08T22:30:00Z")); // = 09.09. 00:30 Berlin
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main > header.sd-pagehead h1");
  const eyebrow = await page.textContent("#main > header.sd-pagehead h1");
  ok(eyebrow.includes("Mittwoch") && eyebrow.includes("9. September"),
     `Zeitzone: 00:30 Berlin zeigt den 09.09. (war: "${eyebrow.trim()}")`);
  await ctx.close();
}

// ---- 8. Worker nicht konfiguriert -> klarer Hinweis statt Hänger ----
{
  scenario("8");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  // config.js hat inzwischen eine echte Worker-URL — den unkonfigurierten
  // Zustand deshalb hier gezielt nachstellen.
  await ctx.route(/config\.js/, (r) => r.fulfill({
    contentType: "application/javascript",
    body: `export const ALLOWED_UID = "${TEST_UID}"; export const STRAVA_WORKER_URL = ""; export const STRAVA_CLIENT_ID = "277715"; export const isWorkerConfigured = false; export const COACH_URL = ""; export const WORKER_URL = "";
      export const THRESHOLDS = ${JSON.stringify(REAL_THRESHOLDS)};`,
  }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  // Der "Strava noch nicht eingerichtet"-Hinweis erscheint in der
  // Tagesansicht (Wochen-Tab), nicht mehr auf dem Dashboard-Starttab.
  await goTab(page, "woche");
  await openDay(page, "2026-09-07");
  await page.waitForSelector("#strava-slot .card");
  ok((await page.textContent("#strava-slot")).includes("Strava noch nicht eingerichtet"),
     "Setup: fehlender Worker wird erklärt statt zu hängen");
  await shot(page, "08-worker-fehlt");
  await ctx.close();
}

// ---- 10. Übungen anpassen: entfernen, hinzufügen, zurückholen ----
{
  scenario("10");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="squats"]');
  ok((await page.locator("[data-ex]").count()) === 8, "Anpassen: Ausgangslage 8 Übungen");

  // Speichern-Knopf ist eine sichtbare Hauptaktion, kein weißer Kasten
  const btn = page.locator('[data-ex="squats"] [data-action="save"]');
  const look = await btn.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    text: el.textContent.trim(),
    w: el.getBoundingClientRect().width,
  }));
  ok(look.bg === "rgb(15, 110, 86)", `Speichern: eingefärbt statt weiß (${look.bg})`);
  ok(look.text === "Speichern", "Speichern: beschriftet, nicht nur ein Symbol");
  ok(look.w > 200, `Speichern: volle Breite (${Math.round(look.w)}px)`);

  await page.click('[data-action="toggle-edit"]');
  await page.waitForSelector('[data-action="add-exercise"]');
  ok((await page.locator('[data-action="remove-exercise"]').count()) === 8, "Anpassen: Entfernen-Knopf je Übung");

  await page.click('[data-ex="deadlift"] [data-action="remove-exercise"]');
  await page.waitForSelector('[data-action="restore-exercise"]');
  ok((await page.locator("[data-ex]").count()) === 7, "Anpassen: Übung entfernt");

  await page.fill("#new-ex-name", "Beinpresse");
  await page.fill("#new-ex-soll", "4x10");
  await page.click('[data-action="add-exercise"]');
  await page.waitForSelector('[data-ex="beinpresse"]');
  ok((await page.locator("[data-ex]").count()) === 8, "Anpassen: eigene Übung hinzugefügt");
  ok((await page.textContent('[data-ex="beinpresse"]')).includes("Soll 4x10"), "Anpassen: Sollvorgabe übernommen");
  ok((await page.locator('[data-ex="beinpresse"] .custom-tag').count()) === 1, "Anpassen: als eigene Übung markiert");

  // Doppelte Namen werden abgefangen
  await page.fill("#new-ex-name", "Beinpresse");
  await page.click('[data-action="add-exercise"]');
  ok((await page.locator("[data-ex]").count()) === 8, "Anpassen: doppelte Übung wird abgelehnt");

  await page.click('[data-action="toggle-edit"]');
  await page.waitForSelector('[data-action="toggle-sets"]');
  await shot(page, "11-uebungen-anpassen");
  await noHScroll(page, "Anpassen");

  // In die eigene Übung eintragen und speichern
  const bp = page.locator('[data-ex="beinpresse"]');
  await bp.locator("[data-kg]").fill("120");
  await bp.locator("[data-reps]").fill("10");
  await bp.locator('[data-action="save"]').click();
  await page.waitForSelector('[data-status="beinpresse"].ok');
  ok((await bp.locator('[data-action="save"]').textContent()).includes("Gespeichert"),
     "Speichern: Knopf zeigt den erledigten Zustand");
  ok((await page.locator('[data-ex="beinpresse"].done').count()) === 1, "Speichern: Karte wird als erledigt markiert");

  // Nach Reload muss die angepasste Liste stehen
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="beinpresse"]');
  ok((await page.locator('[data-ex="deadlift"]').count()) === 0, "Anpassen: Entfernung überlebt den Reload");
  ok((await page.locator('[data-ex="beinpresse"] [data-kg]').inputValue()) === "120", "Anpassen: Werte der eigenen Übung bleiben");

  // Zurückholen
  await page.click('[data-action="toggle-edit"]');
  await page.click('[data-action="restore-exercise"]');
  await page.waitForSelector('[data-ex="deadlift"]');
  ok((await page.locator("[data-ex]").count()) === 9,
     "Anpassen: Übung zurückgeholt (8 aus dem Plan + die eigene)");

  // Andere Tage bleiben unberührt
  await page.click('[data-action="toggle-edit"]');
  await page.click('[data-action="back"]');
  await openDay(page, "2026-09-10");
  await page.waitForSelector("[data-ex]");
  ok((await page.locator('[data-ex="beinpresse"]').count()) === 0, "Anpassen: gilt nur für den bearbeiteten Tag");
  ok(errors.length === 0, "Anpassen: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 9. Firestore verweigert Zugriff: als Firebase-Problem erkennbar ----
{
  scenario("9");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({
    contentType: "application/javascript",
    body: `
      class FirebaseAccessError extends Error {
        constructor(m) { super("Firebase: " + m); this.source = "firebase"; }
      }
      const boom = () => { throw new FirebaseAccessError("Missing or insufficient permissions."); };
      export const db = {};
      export async function authReady() { return { uid: "${TEST_UID}", email: "t@example.test", isAnonymous: false }; }
      export async function signIn() {}
      export async function signOutUser() {}
      export async function signOutAndWipeDevice() { return { ok: true }; }
      export async function waitForPendingWrites() {}
      export async function authHeaders() { return { Authorization: "Bearer test-token" }; }
      export async function ensureSignedIn() { return { uid: "t" }; }
      export async function saveLog() { boom(); }
      export async function loadLog() { boom(); }
      export async function loadLogsForDate() { boom(); }
      export async function loadLogsForExercise() { boom(); }
      export async function saveStravaTokens() { boom(); }
      export async function loadStravaTokens() { boom(); }
      export async function loadDayPlan() { boom(); }
      export async function saveDayPlan() { boom(); }
      export async function loadAllLogs() { boom(); }
      export async function loadAllDayPlans() { boom(); }
      export async function loadCoach() { boom(); }
      export async function saveCoach() { boom(); }
      export async function loadCoachWeek() { boom(); }
      export async function saveCoachWeek() { boom(); }
      export async function loadRunLinks() { boom(); }
      export async function saveRunLink() { boom(); }
      export async function clearRunLink() { boom(); }`,
  }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("hm-tracker.workerUrl", "https://worker.test"));
  await page.goto(BASE + "/index.html");

  // Der Fehler-Karten-Vergleich (Firebase vs. Strava) lebt in der
  // Tagesansicht (#strava-slot), nicht auf dem Dashboard-Starttab.
  await goTab(page, "woche");
  await openDay(page, "2026-09-07");
  await page.waitForSelector("#strava-slot .error-card");
  const runTxt = await page.textContent("#strava-slot");
  ok(runTxt.includes("Daten-Problem (Firebase)"), "Fehlerquelle: Firestore-Fehler wird nicht als Strava-Problem gezeigt");
  ok(runTxt.includes("Missing or insufficient permissions."), "Fehlerquelle: Originalmeldung sichtbar");
  ok(runTxt.includes("angemeldet"), "Fehlerquelle: Hinweis auf die tatsächliche Ursache");
  ok((await page.locator('#strava-slot [data-action="connect-strava"]').count()) === 0,
     "Fehlerquelle: kein irreführendes 'Neu verbinden' bei Firebase-Fehlern");
  await shot(page, "09-firebase-fehler-lauftag");

  // Krafttag: Meldung muss stehen bleiben, nicht als Toast verschwinden
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector("#main .error-card");
  ok((await page.textContent("#main")).includes("Gespeicherte Sätze nicht geladen"),
     "Krafttag: Ladefehler als dauerhafte Karte");
  ok((await page.locator("[data-ex]").count()) === 8, "Krafttag: Eingabe bleibt trotz Fehler möglich");
  await page.waitForTimeout(7000); // länger als die Toast-Dauer
  ok((await page.locator("#main .error-card").count()) === 1, "Krafttag: Meldung verschwindet nicht wieder");
  await shot(page, "10-firebase-fehler-krafttag");
  await ctx.close();
}

// ---- 11. Verschobener Lauf: Mittwoch geplant, Donnerstag gelaufen ----
{
  scenario("11");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await openDay(page, "2026-09-09"); // Mi = Easy run + 4x20s
  await page.waitForSelector("#strava-slot .card");
  const txt = await page.textContent("#strava-slot");
  ok(txt.includes("Erfasst (Strava)"), "Verschoben: Lauf wird trotzdem gefunden");
  ok(txt.includes("Nachgeholt"), "Verschoben: der richtige Lauf (Do 10.09.)");
  ok(txt.includes("einen Tag später nachgeholt"), "Verschoben: als nachgeholt ausgewiesen");
  ok(txt.includes("Do, 10.09."), "Verschoben: tatsächliches Datum sichtbar");
  ok((await page.locator("#strava-slot .card.shifted").count()) === 1, "Verschoben: optisch markiert");
  await shot(page, "13-verschobener-lauf");

  // Der Montagslauf darf davon unberührt bleiben
  await page.click('[data-action="back"]');
  await openDay(page, "2026-09-07");
  await page.waitForSelector("#strava-slot .card");
  const mo = await page.textContent("#strava-slot");
  ok(mo.includes("8,0 km") && !mo.includes("nachgeholt"), "Verschoben: exakter Treffer bleibt exakt");

  // "Passt nicht" -> Automatik aus, Angebot zur Zuordnung
  await page.click('[data-action="back"]');
  await openDay(page, "2026-09-09");
  await page.waitForSelector('[data-action="ignore-run"]');
  await page.click('[data-action="ignore-run"]');
  await page.waitForSelector('[data-action="pick-run"]');
  ok((await page.textContent("#strava-slot")).includes("bewusst kein Lauf"),
     "Verschoben: 'Passt nicht' merkt sich die Entscheidung");

  // Manuell zuordnen
  await page.click('[data-action="pick-run"]');
  await page.waitForSelector(".pick-row");
  const rows = await page.locator(".pick-row .pick-main").allTextContents();
  ok(rows.length > 0 && rows[0].includes("Do, 10.09."), `Auswahl: nächstliegender Lauf zuerst (${rows[0]})`);
  ok(rows[0].includes("+1 Tag") && !rows[0].includes("+1 Tage"), `Auswahl: Einzahl bei einem Tag (${rows[0]})`);
  await noHScroll(page, "Lauf-Auswahl");
  await shot(page, "14-lauf-zuordnen");
  await page.click('.pick-row');
  await page.waitForSelector("#strava-slot .card.shifted");
  ok((await page.textContent("#strava-slot")).includes("Zuordnung aufheben"),
     "Auswahl: manuell zugeordnet");

  // Überlebt den Reload
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await goTab(page, "woche");
  await openDay(page, "2026-09-09");
  await page.waitForSelector("#strava-slot .card");
  ok((await page.textContent("#strava-slot")).includes("Nachgeholt"), "Zuordnung überlebt den Reload");

  // Zurück auf Automatik
  await page.click('[data-action="reset-run"]');
  await page.waitForSelector("#strava-slot .card");
  ok((await page.textContent("#strava-slot")).includes("Passt nicht"),
     "Zurücksetzen: wieder automatisch zugeordnet");
  ok(errors.length === 0, "Verschoben: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 12. Tableiste klebt unten (Tab-Seite mit langem Inhalt) + Detailseiten ohne Leiste ----
{
  scenario("12");
  const { page, ctx } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await goTab(page, "plan"); // lange Liste (35 Wochen)
  await page.waitForSelector("#main .goal-card");

  const vh = 844;
  // Stride: die Leiste schwebt 26 px über dem unteren Rand (Handoff §4, Safe-Area im Test 0).
  const before = await page.locator("#tabbar").boundingBox();
  ok(Math.abs(before.y + before.height - (vh - 26)) < 2,
     `Tableiste: schwebt 26 px über dem unteren Rand (${Math.round(before.y + before.height)} von ${vh})`);

  const scrolled = await page.evaluate(() => {
    const m = document.getElementById("main");
    m.scrollTop = m.scrollHeight;
    return { top: m.scrollTop, scrollable: m.scrollHeight > m.clientHeight };
  });
  ok(scrolled.scrollable && scrolled.top > 100, `Tableiste: Inhalt ist scrollbar (${scrolled.top}px)`);

  const after = await page.locator("#tabbar").boundingBox();
  ok(Math.abs(after.y - before.y) < 1, "Tableiste: bleibt beim Scrollen an Ort und Stelle");
  const lastBottom = await page.evaluate(() => document.getElementById("main").lastElementChild.getBoundingClientRect().bottom);
  ok(lastBottom <= after.y + 1, `Tableiste: letztes Element scrollt ganz über die Leiste (${Math.round(lastBottom)} <= ${Math.round(after.y)})`);
  ok((await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)) <= 0,
     "Tableiste: die Seite selbst scrollt nicht mit");
  await shot(page, "15-leiste-unten");

  // Kopf: Stride-Zeichen auf allen vier Tabs
  for (const tab of ["dashboard", "woche", "verlauf", "plan"]) {
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForSelector("#main > header.sd-pagehead .sd-brand .sd-mark");
    const brand = await page.evaluate(() => {
      const m = document.querySelector("#main > header.sd-pagehead .sd-brand .sd-mark").getBoundingClientRect();
      return { w: Math.round(m.width), h: Math.round(m.height), text: document.querySelector("#main > header.sd-pagehead .sd-brand").textContent.trim() };
    });
    ok(brand.w === 28 && brand.h === 28 && brand.text === "Stride", `Kopf ${tab}: Stride-Zeichen 28 px + Wortmarke (${brand.w}x${brand.h}, "${brand.text}")`);
  }

  // Seitenkopf scrollt mit dem Inhalt weg (docs/plan-stride.md "Ansatz"): #header bleibt leer,
  // der Kopf ist genau ein Block IM #main und liegt nach 300 px Scrollen über dem Viewport.
  const headTopAfterScroll = (pg) => pg.evaluate(() => {
    const m = document.getElementById("main");
    m.scrollTop = 300;
    return { top: document.querySelector("#main > header.sd-pagehead").getBoundingClientRect().top, scrolled: m.scrollTop };
  });
  const pageHeadCount = (pg) => pg.locator('#main > [data-region="pagehead"]').count();
  await goTab(page, "dashboard");
  await page.waitForSelector("#today-slot");
  const heuteHead = await headTopAfterScroll(page);
  ok(heuteHead.scrolled === 300 && heuteHead.top < 0, `Kopf Heute: scrollt mit weg (top ${Math.round(heuteHead.top)})`);
  await goTab(page, "woche");
  await page.waitForSelector(".day-row");
  const wocheHead = await headTopAfterScroll(page);
  ok(wocheHead.scrolled > 0 && wocheHead.top < 0, `Kopf Woche: scrollt mit weg (top ${Math.round(wocheHead.top)})`);
  await openDay(page, "2026-09-08"); // Krafttag
  await page.waitForSelector("[data-ex]");
  const kraftHead = await headTopAfterScroll(page);
  ok(kraftHead.scrolled > 0 && kraftHead.top < 0, `Kopf Kraft-Tag: scrollt mit weg (top ${Math.round(kraftHead.top)})`);
  await page.click('[data-action="back"]');
  await page.waitForSelector(".day-row");
  ok((await page.locator("#header").innerHTML()) === "", "Kopf: #header bleibt leer (Kopf steckt im #main)");
  // Statische Sperre: #main wird nur über renderMain() geschrieben, sonst fehlt der Seitenkopf.
  const appSrc = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const directWrites = appSrc.split("\n").filter((l) => /\bmain\.innerHTML\s*=(?!=)/.test(l) && !l.trim().startsWith("//"));
  ok(directWrites.length === 1 && directWrites[0].includes("pagehead"),
     `Kopf: app.js schreibt #main nur in renderMain (${directWrites.length} direkte Zuweisung)`);
  for (const tab of ["dashboard", "verlauf", "plan", "woche", "dashboard"]) await goTab(page, tab);
  await page.waitForSelector("#coach-slot");
  await page.waitForTimeout(400); // Coach-/Strava-Nachlader haben ihre Slots gepatcht
  ok((await pageHeadCount(page)) === 1 && (await page.locator("#main header.sd-pagehead").count()) === 1,
     "Kopf: nach Tabwechseln und Nachladern genau ein Seitenkopf im #main");

  // Detailseiten: Leiste weg, nach Zurück wieder da
  await goTab(page, "woche");
  await openDay(page, "2026-09-08"); // Krafttag
  await page.waitForSelector("[data-ex]");
  ok((await page.locator("#app.is-detail").count()) === 1 && !(await page.locator("#tabbar").isVisible()),
     "Kraft-Tag: Tableiste ausgeblendet (#app.is-detail)");
  await page.click('[data-action="back"]');
  await page.waitForSelector(".day-row");
  ok((await page.locator("#app.is-detail").count()) === 0 && (await page.locator("#tabbar").isVisible()),
     "Zurück vom Kraft-Tag: Tableiste wieder sichtbar");
  await openDay(page, "2026-09-09"); // Lauftag
  await page.waitForSelector("#strava-slot");
  ok((await page.locator("#app.is-detail").count()) === 1 && !(await page.locator("#tabbar").isVisible()),
     "Lauf-Tag: Tableiste ausgeblendet");
  await page.click('[data-action="back"]');
  await page.waitForSelector(".day-row");
  ok((await page.locator("#tabbar").isVisible()), "Zurück vom Lauf-Tag: Tableiste wieder sichtbar");
  await ctx.close();
}

// ---- 13. Progression aus den Wiederholungen statt RPE ----
{
  scenario("13");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.addInitScript(() => {
    // Vorwoche: Squats 3x10 bei 80 kg (Spanne voll), Deadlift 3x4 (unter Soll 3x5)
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-01_squats": { date: "2026-09-01", exercise: "squats", completed: true,
        sets: [{ kg: 80, reps: 10 }, { kg: 80, reps: 10 }, { kg: 80, reps: 10 }] },
      "2026-09-01_deadlift": { date: "2026-09-01", exercise: "deadlift", completed: true,
        sets: [{ kg: 100, reps: 4 }, { kg: 100, reps: 4 }, { kg: 100, reps: 4 }] },
      "2026-09-01_klimmzuege": { date: "2026-09-01", exercise: "klimmzuege", completed: true,
        sets: [{ kg: null, reps: 8 }, { kg: null, reps: 8 }, { kg: null, reps: 8 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector(".tip");

  const squats = await page.textContent('[data-ex="squats"] .tip');
  ok(squats.includes("80 kg") && squats.includes("85 kg"),
     `Progression: Spanne ausgeschöpft -> mehr Gewicht (${squats})`);
  ok((await page.locator('[data-ex="squats"] .tip-up').count()) === 1, "Progression: als Steigerung eingefärbt");

  const dl = await page.textContent('[data-ex="deadlift"] .tip');
  ok(dl.includes("unter dem Soll"), `Progression: unter dem Soll erkannt (${dl})`);
  ok((await page.locator('[data-ex="deadlift"] .tip-down').count()) === 1, "Progression: als Rücknahme eingefärbt");

  const kz = await page.textContent('[data-ex="klimmzuege"] .tip');
  ok(!kz.includes("kg"), `Progression: Körpergewichtsübung ohne Gewichtsvorschlag (${kz})`);

  ok((await page.locator('[data-ex="brustpresse"] .tip').count()) === 0,
     "Progression: ohne Vorgeschichte kein Vorschlag");

  // Herzfrequenz der Einheit aus Strava
  await page.waitForSelector(".session-card");
  const sess = await page.textContent(".session-card");
  ok(sess.includes("118 bpm") && sess.includes("155 bpm"), `Einheit: Herzfrequenz aus Strava (${sess.replace(/\s+/g, " ").slice(0, 80)})`);
  ok(sess.includes("64:28 min") || sess.includes("1:04:28"), "Einheit: Dauer angezeigt");
  ok(sess.includes("Relative Effort 15"), "Einheit: Relative Effort angezeigt");
  await noHScroll(page, "Progression");
  await shot(page, "16-progression");

  // Kein RPE-Feld — die Eingabe bleibt kg und Wdh
  ok((await page.locator('[data-ex="squats"] input').count()) === 2,
     "Progression: keine zusätzliche Eingabe nötig");
  ok(errors.length === 0, "Progression: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 14. Übung im Gym ersetzen und schnell ergänzen ----
{
  scenario("14");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="squats"]');

  // Hinzufügen ohne Umweg über den Bearbeitungsmodus
  ok((await page.locator('[data-action="quick-add"]').count()) === 1,
     "Ergänzen: Knopf steht direkt unter der Liste");
  await page.click('[data-action="quick-add"]');
  await page.fill("#new-ex-name", "Beinpresse");
  await page.fill("#new-ex-soll", "4x10");
  await page.click('[data-action="add-exercise"]');
  await page.waitForSelector('[data-ex="beinpresse"]');
  ok((await page.locator("[data-ex]").count()) === 9, "Ergänzen: Übung ist da");
  const order = await page.locator("[data-ex]").evaluateAll((els) => els.map((e) => e.dataset.ex));
  ok(order[order.length - 1] === "beinpresse", "Ergänzen: neue Übung hängt hinten an");

  // Ersetzen: Bank belegt, also Brustpresse gegen Kurzhantelbank tauschen
  await page.click('[data-action="toggle-edit"]');
  await page.click('[data-ex="brustpresse"] [data-action="replace-exercise"]');
  await page.waitForSelector("#rep-ex-name");
  ok((await page.inputValue("#rep-ex-soll")) === "3x8-10", "Ersetzen: Sollvorgabe wird übernommen");
  await page.fill("#rep-ex-name", "Kurzhantelbank");
  await page.click('[data-action="confirm-replace"]');
  await page.waitForSelector('[data-ex="kurzhantelbank"]');

  const after = await page.locator("[data-ex]").evaluateAll((els) => els.map((e) => e.dataset.ex));
  ok(!after.includes("brustpresse"), "Ersetzen: alte Übung ist weg");
  ok(after.indexOf("kurzhantelbank") === order.indexOf("brustpresse"),
     `Ersetzen: neue Übung steht an derselben Stelle (${after.indexOf("kurzhantelbank")})`);
  ok((await page.textContent('[data-ex="kurzhantelbank"]')).includes("Ersetzt Brustpresse"),
     "Ersetzen: Herkunft bleibt sichtbar");
  await shot(page, "17-uebung-ersetzen");
  await noHScroll(page, "Ersetzen");

  // Überlebt den Reload
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="kurzhantelbank"]');
  ok((await page.locator('[data-ex="brustpresse"]').count()) === 0, "Ersetzen: überlebt den Reload");

  // Tausch rückgängig -> Original kommt zurück
  await page.click('[data-action="toggle-edit"]');
  await page.click('[data-ex="kurzhantelbank"] [data-action="remove-exercise"]');
  await page.waitForSelector('[data-ex="brustpresse"]');
  ok((await page.locator('[data-ex="kurzhantelbank"]').count()) === 0,
     "Ersetzen: Tausch entfernt, Original zurück");
  ok(errors.length === 0, "Ersetzen: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 15. Glasleiste ----
{
  scenario("15");
  const { page, ctx } = await newPage();
  await page.goto(BASE + "/index.html");
  await goTab(page, "plan"); // Tab-Seite mit langem Inhalt (Detailseiten haben keine Leiste)
  await page.waitForSelector("#main .goal-card");

  const bar = await page.locator("#tabbar").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
      position: cs.position,
      bg: cs.backgroundColor,
      rect: el.getBoundingClientRect().toJSON(),
    };
  });
  ok(bar.backdrop.includes("blur"), `Glas: Unschärfe aktiv (${bar.backdrop})`);
  ok(bar.backdrop.includes("saturate"), "Glas: Sättigung angehoben");
  ok(/rgba?\([^)]*0?\.\d+\)/.test(bar.bg), `Glas: Fläche ist durchscheinend (${bar.bg})`);
  ok(bar.position === "absolute", "Glas: Leiste liegt über dem Inhalt");
  ok(Math.abs(bar.rect.bottom - (844 - 26)) < 2, "Glas: schwebt weiterhin 26 px über dem unteren Rand");

  // Damit die Unschärfe etwas zu tun hat, muss Inhalt darunter durchlaufen
  const passesUnder = await page.evaluate(() => {
    const m = document.getElementById("main");
    const bar = document.getElementById("tabbar").getBoundingClientRect();
    m.scrollTop = m.scrollHeight / 2;
    return [...document.querySelectorAll("#main .card")].some((el) => {
      const r = el.getBoundingClientRect();
      return r.top < bar.top && r.bottom > bar.top;
    });
  });
  ok(passesUnder, "Glas: Inhalt scrollt unter der Leiste durch");

  // Kapsel hinter dem aktiven Tab. Sie blendet über 150 ms ein; ohne Warten
  // liest der Check im ersten Frame noch "transparent" (wackelte ~jeder 2. Lauf).
  await page.waitForFunction(() => {
    const el = document.querySelector("#tabbar button.active");
    return el && getComputedStyle(el, "::after").backgroundColor !== "rgba(0, 0, 0, 0)";
  }, null, { timeout: 1000 }).catch(() => {});
  const capsule = await page.locator("#tabbar button.active").evaluate((el) => {
    const cs = getComputedStyle(el, "::after");
    return { bg: cs.backgroundColor, radius: cs.borderRadius };
  });
  ok(capsule.bg !== "rgba(0, 0, 0, 0)", `Glas: aktiver Tab hat eine Kapsel (${capsule.bg})`);
  ok(parseFloat(capsule.radius) > 0, "Glas: Kapsel ist abgerundet");
  await shot(page, "18-glasleiste");
  await ctx.close();
}

// ---- 16. Nur senkrecht scrollen, nichts zoomt ungefragt ----
{
  scenario("16");
  const { page, ctx } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");

  // Jedes Feld, das man antippen kann, muss mindestens 16px haben —
  // darunter zoomt iOS Safari hinein und die Seite lässt sich danach
  // seitlich schieben.
  const views = [
    ["Krafttag", async () => { await goTab(page, "woche"); await openDay(page, "2026-09-08"); await page.waitForSelector("[data-ex]"); }],
    ["Übung hinzufügen", async () => { await page.click('[data-action="quick-add"]'); await page.waitForSelector("#new-ex-name"); }],
    ["Verlauf", async () => { await goTab(page, "verlauf"); await page.waitForSelector("#ex-picker"); }],
  ];
  for (const [name, go] of views) {
    await go();
    const small = await page.locator("input, select, textarea").evaluateAll((els) =>
      els.map((el) => ({ tag: el.tagName, type: el.type, px: parseFloat(getComputedStyle(el).fontSize) }))
         .filter((f) => f.px < 16));
    ok(small.length === 0, `${name}: kein Feld unter 16px (${JSON.stringify(small)})`);
  }

  // Seitwärts darf nichts scrollen — weder die Seite noch der Inhalt
  const scroll = await page.evaluate(() => {
    const d = document.documentElement, m = document.getElementById("main");
    return {
      docX: d.scrollWidth - d.clientWidth,
      mainX: m.scrollWidth - m.clientWidth,
      bodyOverflow: getComputedStyle(document.body).overflowX,
      mainOverscroll: getComputedStyle(m).overscrollBehaviorX,
    };
  });
  ok(scroll.docX <= 0 && scroll.mainX <= 0, `Nur senkrecht: nichts ragt seitlich heraus (${scroll.docX}/${scroll.mainX})`);
  ok(scroll.bodyOverflow === "hidden", "Nur senkrecht: die Seite selbst scrollt nicht");
  ok(scroll.mainOverscroll === "none", "Nur senkrecht: kein seitliches Nachfedern");

  // Sicherheitsabstände greifen (auf dem Home-Bildschirm liegt sonst der
  // Kopf unter der Uhr)
  const insets = await page.evaluate(() => {
    // Oben trägt der Seitenkopf den Statusbar-Abstand, seitlich das Polster von #main.
    return { top: getComputedStyle(document.querySelector("#main > header.sd-pagehead")).paddingTop,
             left: getComputedStyle(document.getElementById("main")).paddingLeft };
  });
  ok(parseFloat(insets.top) >= 16, `Sicherheitsabstand oben berücksichtigt (${insets.top})`);
  ok(parseFloat(insets.left) >= 20, `Sicherheitsabstand seitlich berücksichtigt (${insets.left})`);

  // Der Inhalt füllt die volle Gerätebreite
  const appW = await page.locator("#app").evaluate((el) => el.getBoundingClientRect().width);
  ok(Math.abs(appW - 390) < 1, `Seite füllt die Breite (${Math.round(appW)} von 390)`);
  await ctx.close();
}

// ---- 17. Plan-JSON 404, aber eine gültige Kopie in localStorage (A1) ----
{
  scenario("17");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(([planJson]) => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    localStorage.setItem("hm-tracker.plan.hm-2027", planJson);
  }, [REAL_PLAN_JSON]);
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#toast.show");
  ok((await page.textContent("#toast")).includes("Plan aus letzter Kopie"), "Plan-404 mit Kopie: dezenter Hinweis erscheint");
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Woche 2 · Aufbau"), "Plan-404 mit Kopie: App läuft normal weiter (Lauftag erkannt)");

  // Satz-Logging funktioniert weiterhin mit der Kopie
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('[data-ex="squats"]');
  await page.locator('[data-ex="squats"] [data-kg]').fill("80");
  await page.locator('[data-ex="squats"] [data-reps]').fill("9");
  await page.click('[data-ex="squats"] [data-action="save"]');
  await page.waitForSelector('[data-status="squats"].ok');
  ok((await page.locator('[data-ex="squats"] .status').textContent()) === "Gespeichert.", "Plan-404 mit Kopie: Satz-Logging funktioniert");
  await shot(page, "19-plan-404-mit-kopie");
  await ctx.close();
}

// ---- 18. Plan-JSON 404, keine Kopie vorhanden (A1) ----
{
  scenario("18");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main .error-card");
  const txt = await page.textContent("#main");
  ok(txt.includes("Plan konnte nicht geladen werden"), "Plan-404 ohne Kopie: dauerhafte Fehlerkarte erscheint");
  ok(!txt.includes("Strava") && !txt.includes("Firebase"), "Plan-404 ohne Kopie: nicht als Strava-/Firebase-Fehler erkennbar");
  await shot(page, "20-plan-404-ohne-kopie");
  await ctx.close();
}

// ---- 19. Plan-JSON kaputt (kein gültiges JSON) — wie 404 behandelt ----
{
  scenario("19");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{ kaputt" }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main .error-card");
  ok((await page.textContent("#main")).includes("Plan konnte nicht geladen werden"), "Kaputte Plan-JSON: wie 404 behandelt");
  await ctx.close();
}

// ---- 19b. Plan-JSON 404 + Kopie mit passender schemaVersion, aber ungültiger Form (K1) ----
{
  scenario("19b");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(() => {
    // schemaVersion passt, aber die Kopie hat keine Wochen — validatePlan
    // muss das ablehnen, statt die App bei "Plan wird geladen …" hängen
    // zu lassen (K1).
    localStorage.setItem("hm-tracker.plan.hm-2027", JSON.stringify({ id: "hm-2027", schemaVersion: 1 }));
  });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main .error-card");
  ok((await page.textContent("#main")).includes("Plan konnte nicht geladen werden"), "Plan-404 + ungültige Kopie: Fehlerkarte statt Hängenbleiben (K1)");
  await ctx.close();
}

// ---- 20. Simuliertes Datum in der Rennlücke -> "Bis zum Rennen" (A8/E7) ----
{
  scenario("20");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  // Seit das Renndatum (02.05.2027) in der letzten Planwoche liegt, gibt es im
  // echten Plan keine Lücke mehr. Der Zustand "Bis zum Rennen" bleibt aber
  // erhalten (z. B. für künftige Pläne), deshalb hier mit einer Plan-Kopie
  // mit unbestätigtem, späterem Renndatum (09.05.2027) geprüft.
  const gapPlan = JSON.parse(REAL_PLAN_JSON);
  gapPlan.goal.raceDate = "2027-05-09";
  gapPlan.goal.raceDateConfirmed = false;
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(gapPlan) }));
  await page.clock.setFixedTime(new Date("2027-05-05T09:00:00Z")); // 05.05.2027 Berlin
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="race"]`);
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Zwischen zwei Planwochen") && !(await page.textContent("#main > header.sd-pagehead")).includes("Woche 35"),
     "Rennlücke: kein 'Woche 35', Kopf sagt 'Zwischen zwei Planwochen'");
  ok((await page.textContent("#today-slot")).includes("Der Plan endet vor dem Renntag"),
     "Rennlücke: 'Heute dran' zeigt die neutrale Karte statt einer erfundenen Einheit");
  ok((await page.getByRole("heading", { name: "Bis zum Rennen" }).count()) === 1 && (await page.locator("#main > header.sd-pagehead progress, #main > header.sd-pagehead .sd-chip").count()) === 0,
     "Rennlücke: Karte 'Bis zum Rennen' als Überschrift, Kopf ohne Chip und Balken");
  ok((await slotIsEmpty(page, "week-slot")) && (await page.locator('[data-card="week"]').count()) === 0,
     "Rennlücke: der Slot 'Diese Woche' bleibt wirklich leer");
  await shot(page, "21-bis-zum-rennen");
  ok(errors.length === 0, "Rennlücke: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 21. Datum nach dem Renntag -> "Kein aktiver Plan" (A8/E7) ----
{
  scenario("21");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  let coachRequests = 0;
  await ctx.route("https://worker.test/coach", (r) => { coachRequests++; r.fulfill({ contentType: "application/json", body: "{}" }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.clock.setFixedTime(new Date("2027-05-03T09:00:00Z")); // Tag nach dem Rennen (So 02.05.2027)
  await page.addInitScript(() => localStorage.setItem("hm-tracker.workerUrl", "https://worker.test"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="noplan"]`);
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Ohne Plan"), "Nach dem Rennen: Kopf sagt 'Ohne Plan'");
  await page.waitForTimeout(300);
  ok(coachRequests === 0, `Nach dem Rennen: kein Coach-API-Aufruf (F7, gezählt: ${coachRequests})`);
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Rennen am 02.05.2027"),
     "Nach dem Rennen: Kopfzeile nennt das vergangene Renndatum");
  ok((await page.textContent("#today-slot")).includes("Läufe werden weiter aus Strava angezeigt"),
     "Nach dem Rennen: 'Heute dran' zeigt die neutrale Karte (F7)");
  ok((await page.textContent("#coach-slot")).includes("Ein neues Ziel legst du im Plan-Tab an"),
     "Nach dem Rennen: Coach zeigt einen festen Hinweis statt eines API-Aufrufs (F7)");
  ok((await slotIsEmpty(page, "week-slot")) && (await statusRows(page)).length === 4,
     "Nach dem Rennen: 'Diese Woche' bleibt leer, die Status-Zeilen stehen mit Grund (grau)");
  // go-tab: "Zum Plan" macht dasselbe wie ein Klick auf den Tab.
  await page.click(`${TODAY} [data-action="go-tab"][data-tab="plan"]`);
  await page.waitForSelector(".zone-line");
  ok((await page.locator("#tabbar button.active").getAttribute("data-tab")) === "plan", "Nach dem Rennen: 'Zum Plan' öffnet den Plan-Tab, die Tab-Leiste folgt");
  await goTab(page, "dashboard");
  await page.waitForSelector(`${TODAY}[data-kind="noplan"]`);
  await shot(page, "22-kein-plan");
  ok(errors.length === 0, "Nach dem Rennen: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 20b. Der Renntag liegt jetzt in Woche 35, keine Rennlücke mehr ----
{
  scenario("20b");
  const { page, ctx, errors } = await newPage({ now: "2027-05-02T09:00:00Z" }); // Renntag, So 02.05.2027
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(TODAY);
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Woche 35") && (await page.locator(`${TODAY}[data-kind="race"]`).count()) === 0,
     "Renntag: Dashboard zeigt Woche 35, nicht 'Bis zum Rennen'");
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Rennen heute"), "Renntag: Countdown 'Rennen heute!'");
  ok(errors.length === 0, "Renntag: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 22. Datum vor Planstart -> Woche 1, nicht Woche 31 (I3) ----
{
  scenario("22");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-08-25T09:00:00Z")); // vor Planstart 31.08.2026
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY}[data-kind="noplan"]`);
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Ohne Plan") && (await page.textContent(TODAY)).includes("Kein Plan aktiv"), "Vor Planstart: 'Kein Plan aktiv' auf 'Heute'");

  await goTab(page, "woche");
  await page.waitForSelector(".day-row, .card");
  ok((await page.textContent("#main > header.sd-pagehead .t1")).includes("Woche 1"), "Vor Planstart: Wochen-Tab zeigt Woche 1, nicht Woche 35");

  await goTab(page, "plan");
  await page.waitForSelector(".zone-line");
  ok((await page.textContent("#main > header.sd-pagehead .eyebrow")).includes("Woche 1 von 35"), "Vor Planstart: Plan-Tab zeigt Woche 1, nicht Woche 35");
  ok((await page.textContent("#main > header.sd-pagehead .eyebrow")).includes("0% geschafft"), "Vor Planstart: 0% geschafft, nicht 97%");
  await ctx.close();
}

// ---- 23. Die Kopie wird beim normalen Laden wirklich geschrieben (I2) ----
{
  scenario("23");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));

  // 1) Normal laden — writeCache() muss die Kopie wirklich anlegen (nicht
  // nur behaupten, das zu tun: dieser Test belegt localStorage NICHT
  // vorab, anders als die 404-Tests weiter oben).
  await page.goto(BASE + "/index.html");
  await page.waitForSelector('#main [data-card="today"]');
  const stored = await page.evaluate(() => localStorage.getItem("hm-tracker.plan.hm-2027"));
  ok(!!stored, "Normales Laden: es landet wirklich eine Kopie in localStorage");
  ok(!!stored && JSON.parse(stored).id === "hm-2027", "Geschriebene Kopie hat die erwartete Form (id hm-2027)");

  // 2) Jetzt erst auf 404 umstellen und neu laden — greift die Kopie, die
  // die App selbst gerade geschrieben hat (nicht eine vorab injizierte)?
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await page.reload();
  await page.waitForSelector("#toast.show");
  ok((await page.textContent("#toast")).includes("Plan aus letzter Kopie"), "Nach 404: die selbst geschriebene Kopie greift beim Reload wirklich");
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Woche 2 · Aufbau"), "Nach 404 mit echter Kopie: App läuft normal weiter");
  await ctx.close();
}

// ---- 24. Kopie mit fremder schemaVersion wird ignoriert (I2) ----
{
  scenario("24");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(([planJson]) => {
    const foreign = { ...JSON.parse(planJson), schemaVersion: 99 };
    localStorage.setItem("hm-tracker.plan.hm-2027", JSON.stringify(foreign));
  }, [REAL_PLAN_JSON]);
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main .error-card");
  ok((await page.textContent("#main")).includes("Plan konnte nicht geladen werden"), "Kopie mit fremder schemaVersion wird ignoriert -> Fehlerkarte statt falscher Daten");
  await ctx.close();
}

// ---- 25. Plan-Hinweis und Strava-Redirect gleichzeitig -> beide Hinweise sichtbar (M4) ----
{
  scenario("25");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await ctx.route("https://worker.test/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      access_token: "at-new", refresh_token: "rt-new", expires_at: Math.floor(Date.now() / 1000) + 21600,
      athlete: { id: 42 } }) }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(([planJson]) => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    localStorage.setItem("hm-tracker.plan.hm-2027", planJson);
  }, [REAL_PLAN_JSON]);
  await page.goto(BASE + "/index.html?code=test-code-123");
  await page.waitForSelector("#toast.show");
  const toastText = await page.textContent("#toast");
  ok(toastText.includes("Plan aus letzter Kopie"), `Beide Hinweise: Plan-Hinweis nicht verschluckt (${toastText})`);
  ok(toastText.includes("Mit Strava verbunden."), `Beide Hinweise: Strava-Hinweis nicht verschluckt (${toastText})`);
  await ctx.close();
}

// ---- 26. Strava-Worker lehnt die Herkunft ab (403/CORS) -> Meldung nennt beide Möglichkeiten ----
// Ein per ALLOWED_ORIGINS abgelehnter Origin sieht aus dem Browser heraus wie
// ein Netzwerkfehler aus (der Browser blockiert die Antwort schon wegen des
// fehlenden CORS-Headers, bevor JS den Status sieht) — fetch() wirft in
// beiden Fällen dieselbe TypeError. route.abort() simuliert genau das.
{
  scenario("26");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Sicherheitsnetz (M2-9/M2-10): verhindert einen echten Netzwerkaufruf an
  // den produktiven Worker, falls dieser Testkontext keine eigene
  // Worker-URL/​eigenen /coach-Stub setzt — das Dashboard ruft jetzt auf
  // jedem Render fillCoach()/fillWeeklyBilanz() auf. fulfill() statt
  // abort(), damit kein "Failed to load resource"-Netzwerkprotokoll
  // bestehende "keine Konsolenfehler"-Prüfungen anderer Tests verfälscht.
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await ctx.route("https://worker.test/**", (r) => r.abort("failed"));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(([planJson]) => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    localStorage.setItem("hm-tracker.plan.hm-2027", planJson);
  }, [REAL_PLAN_JSON]);
  await page.goto(BASE + "/index.html?code=test-code-123");
  await page.waitForSelector("#toast.show");
  const toastText = await page.textContent("#toast");
  ok(toastText.includes("nicht erreichbar") && toastText.includes("nicht für Strava freigeschaltet"),
     `Strava-Herkunft abgelehnt: Meldung nennt Netzwerk UND CORS statt nur "nicht erreichbar" (${toastText})`);
  await ctx.close();
}

// ---- 26b. Token-Fehler beim Strava-Aufruf: offline vs. abgemeldet (Review N2) ----
for (const [fail, want, notWant, label] of [
  ["auth/network-request-failed", "nicht erreichbar", "Anmeldung abgelaufen", "offline"],
  [true, "Anmeldung abgelaufen", "nicht erreichbar", "abgemeldet"],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await ctx.route("https://worker.test/**", (r) => r.abort("failed"));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(([planJson, f]) => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    localStorage.setItem("hm-tracker.plan.hm-2027", planJson);
    window.__TOKEN_FAIL__ = f;
  }, [REAL_PLAN_JSON, fail]);
  await page.goto(BASE + "/index.html?code=test-code-123");
  await page.waitForSelector("#toast.show");
  const t = await page.textContent("#toast");
  ok(t.includes(want) && !t.includes(notWant), `Strava-Token-Fehler (${label}): Meldung passt (${t})`);
  await ctx.close();
}

// ---- 27. loadStrava dedupliziert parallele Aufrufe (I3) ----
// paintDashboardMain startet fünf fill*-Funktionen, jede ruft loadStrava()
// auf. Ohne ein gemerktes In-Flight-Promise lösen diese fünf parallelen
// Aufrufe fünf echte Abrufe von /athlete/activities aus.
{
  scenario("27");
  const { page, ctx, errors } = await newPage({ connected: true });
  let activityCalls = 0;
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => {
    activityCalls++;
    const p = new URL(r.request().url()).searchParams.get("page");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(p === "1" ? ACTIVITIES : []) });
  });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(`${TODAY} .sd-result`);
  await waitStatusLoaded(page);
  await page.waitForTimeout(300); // Zeit für eventuelle, fälschlich parallele Abrufe
  ok(activityCalls === 1, `loadStrava: genau ein Abruf von /athlete/activities pro Dashboard-Start, nicht fünf (${activityCalls})`);
  ok(errors.length === 0, "loadStrava-Dedup: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 28. Strava verbunden, aber der Abruf schlägt fehl -> Lauf-Ampeln grau statt falschem Rot, keine Wochenbilanz-Anfrage (I2) ----
{
  scenario("28");
  const { page, ctx } = await newPage({ connected: true });
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => r.fulfill({ status: 500, body: "boom" }));
  const coachKinds = [];
  await ctx.route("https://worker.test/coach", (r) => {
    coachKinds.push(JSON.parse(r.request().postData()).kind);
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ text: "x" }) });
  });
  // Donnerstag W3 (17.09.2026): Montag + Mittwoch (Easy-Läufe) liegen schon
  // in der Vergangenheit, ohne Strava-Daten wäre das Wochensoll sonst "rot"
  // statt grau/neutral (Review-Beleg: "computeRealAmpeln rechnet das
  // Wochensoll mit 0 km" -> Rot). Wochenbilanz ist tagunabhängig fällig
  // (weeklyDue), wäre ohne den I2-Fix also auch hier ausgelöst worden.
  await page.clock.setFixedTime(new Date("2026-09-17T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  await waitStatusLoaded(page);
  const byTitle = await statusByTitle(page);
  ok(byTitle["Wochensoll"].status !== "rot", `Ampel Wochensoll: ohne Strava-Daten nicht fälschlich rot (${byTitle["Wochensoll"].status})`);
  ok((byTitle["Wochensoll"].detail || "").includes("Lauf: Strava fehlt"), `Ampel Wochensoll: benennt die fehlende Quelle statt "0 / 0 km" (${byTitle["Wochensoll"].detail})`);
  ok(byTitle["Easy-Disziplin"].status === "grau", `Ampel Easy-Disziplin: grau bei Strava-Abrufsfehler statt falschem Rot (${byTitle["Easy-Disziplin"].status})`);
  ok(byTitle["Belastung"].status === "grau", `Ampel Belastung: grau bei Strava-Abrufsfehler statt falschem Rot (${byTitle["Belastung"].status})`);
  // Der Ladefehler steht als Fehlerkarte im Banner-Slot (mit "Neu laden"); die Lauf-Karte zeigt keinen Ist-Block.
  ok((await page.locator('#banner-slot [data-card="error"][data-source="strava"][role="alert"] [data-action="reload-strava"]').count()) === 1 &&
     (await page.locator(`${TODAY} [role="status"]`).count()) === 0 && (await page.locator('#banner-slot [data-card="strava-disconnected"]').count()) === 0,
    "Strava-Abrufsfehler: Fehlerbanner mit 'Neu laden' statt 'nicht verbunden', Lauf-Karte ohne Ist-Block");
  await page.waitForSelector(COACH);
  await page.waitForTimeout(500); // Zeit für eine mögliche (falsche) Wochenbilanz-Anfrage
  ok(!coachKinds.includes("weekly"), `Wochenbilanz: keine Anfrage ohne echte Strava-Daten (${JSON.stringify(coachKinds)})`);
  await ctx.close();
}

// ---- 29. Firestore-Ausfall (Logs/Dayplans/Coach) -> Kraft-Ampel grau, Rest rechnet normal, Coach zeigt Text statt Dauer-Skelett (I1) ----
{
  scenario("29");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  // Nur die Logs-/Dayplan-/Coach-Pfade fallen aus — Strava bleibt bewusst
  // funktionsfähig, damit sich I1 (Firestore) sauber von I2 (Strava) trennen
  // lässt: "Easy-Disziplin und Belastung rechnen normal" lässt sich nur
  // zeigen, wenn Strava tatsächlich echte Daten liefert.
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({
    contentType: "application/javascript",
    body: `
      export const db = {};
      export async function authReady() { return { uid: "${TEST_UID}", email: "t@example.test", isAnonymous: false }; }
      export async function signIn() {}
      export async function signOutUser() {}
      export async function signOutAndWipeDevice() { return { ok: true }; }
      export async function waitForPendingWrites() {}
      export async function authHeaders() { return { Authorization: "Bearer test-token" }; }
      export async function ensureSignedIn() { return { uid: "t" }; }
      export async function loadAllLogs() { throw new Error("Missing or insufficient permissions."); }
      export async function loadAllDayPlans() { throw new Error("Missing or insufficient permissions."); }
      export async function loadCoach() { throw new Error("Missing or insufficient permissions."); }
      export async function saveCoach() {}
      export async function loadCoachWeek() { throw new Error("Missing or insufficient permissions."); }
      export async function saveCoachWeek() {}
      export async function loadLogsForDate() { return {}; }
      export async function loadDayPlan() { return { removed: [], added: [] }; }
      export async function saveDayPlan() {}
      export async function loadLogsForExercise() { return []; }
      export async function loadRunLinks() { return {}; }
      export async function saveRunLink() {}
      export async function clearRunLink() {}
      export async function saveLog() {}
      export async function saveStravaTokens() {}
      export async function loadStravaTokens() {
        return { refresh_token: "rt", access_token: "at", expires_at: Math.floor(Date.now() / 1000) + 3600 };
      }`,
  }));
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => {
    const p = new URL(r.request().url()).searchParams.get("page");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(p === "1" ? ACTIVITIES : []) });
  });
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  await ctx.route("https://worker.test/**", (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("hm-tracker.workerUrl", "https://worker.test"));
  await page.goto(BASE + "/index.html");

  await waitStatusLoaded(page);
  const byTitle = await statusByTitle(page);
  ok(byTitle["Kraft-Progression"].status === "grau", `Firestore-Ausfall: Kraft-Ampel grau (${byTitle["Kraft-Progression"].status})`);
  ok(byTitle["Kraft-Progression"].detail === "Kraftdaten nicht geladen",
     `Firestore-Ausfall: eigener Hinweistext statt "noch zu wenig Daten" (${byTitle["Kraft-Progression"].detail})`);
  ok(["gruen", "gelb", "rot"].includes(byTitle["Easy-Disziplin"].status),
     `Firestore-Ausfall: Easy-Disziplin rechnet weiter normal statt grau zu werden (${byTitle["Easy-Disziplin"].status})`);

  // Statt der alten Adhärenz-Kachel ("Im Detail", F3) meldet jetzt ein Fehlerbanner den Ausfall.
  await page.waitForSelector('#banner-slot [data-card="error"][data-source="firebase"]');
  ok((await page.locator('#banner-slot [data-card="error"][data-source="firebase"][role="alert"] [data-action="reload"]').count()) === 1 &&
     (await page.textContent('#banner-slot [data-card="error"]')).includes("Daten nicht geladen"),
     "Firestore-Ausfall: Fehlerbanner 'Daten nicht geladen' mit 'Neu laden' statt einer falschen 0%-Zahl");

  // Coach: direkter Regel-Fallback, kein dauerhaftes Skelett (requestCoach()
  // würde ohnehin an loadCoach() scheitern — fillCoach spart sich den
  // Umweg und zeigt den Fallback sofort).
  await page.waitForSelector(COACH);
  await page.waitForFunction(() => (document.querySelector('#coach-slot [data-card="coach"] .sd-coach__text')?.textContent.length ?? 0) > 0, { timeout: 5000 });
  ok((await page.locator('#coach-slot [data-state="loading"], #coach-slot .sd-skel').count()) === 0, "Firestore-Ausfall: kein dauerhaftes Coach-Skelett");

  await noHScroll(page, "Firestore-Ausfall");
  ok(pageErrors.length === 0, "Firestore-Ausfall: keine unbehandelten Fehler " + JSON.stringify(pageErrors));
  await ctx.close();
}

// ---- 30. Strava-Paginierung: 200 + 13 Aktivitäten -> genau 2 Seiten (A6, I5) ----
{
  scenario("30");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route(/workers\.dev\/coach/, (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
  const page1 = Array.from({ length: 200 }, (_, i) => ({
    id: 1000 + i, type: "Run", name: `Run ${i}`, start_date_local: "2026-09-01T07:00:00Z", distance: 5000, moving_time: 1500,
  }));
  const page2 = Array.from({ length: 13 }, (_, i) => ({
    id: 2000 + i, type: "Run", name: `Run B${i}`, start_date_local: "2026-09-02T07:00:00Z", distance: 5000, moving_time: 1500,
  }));
  let activityCalls = 0;
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => {
    activityCalls++;
    const p = new URL(r.request().url()).searchParams.get("page");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(p === "1" ? page1 : p === "2" ? page2 : []) });
  });
  await ctx.route("https://worker.test/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      access_token: "at-new", refresh_token: "rt-new", expires_at: Math.floor(Date.now() / 1000) + 21600,
      athlete: { id: 42 } }) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    localStorage.setItem("test.strava", JSON.stringify({
      refresh_token: "rt", access_token: "at", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  });
  await page.goto(BASE + "/index.html");
  await waitStatusLoaded(page);
  await page.waitForTimeout(300);
  ok(activityCalls === 2, `Strava-Paginierung: 200+13 Aktivitäten brauchen genau 2 Seiten (${activityCalls})`);
  ok(errors.length === 0, "Strava-Paginierung: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 24. Plan-Phase 2: Woche 9 (Kalibrierungstest, optionale Kraft), 35 Wochen ----
{
  scenario("24p");
  // Montag 02.11.2026 = Woche 10; Woche 9 (26.10.–01.11.) liegt komplett in der Vergangenheit.
  // Der Kalibrierungstest (Mi 28.10.) läuft mit Ø HF 178 — weit über jeder Easy-Grenze.
  const acts = [
    { id: 11, type: "Run", name: "Easy run", start_date_local: "2026-10-26T07:00:00Z", distance: 9000, moving_time: 3200, average_heartrate: 150 },
    { id: 12, type: "Run", name: "Kalibrierung", start_date_local: "2026-10-28T07:00:00Z", distance: 11000, moving_time: 3500, average_heartrate: 178 },
    { id: 13, type: "Run", name: "Long run", start_date_local: "2026-10-31T09:00:00Z", distance: 15000, moving_time: 5100, average_heartrate: 150 },
  ];
  const { page, ctx, errors } = await newPage({ connected: true, activities: acts, now: "2026-11-02T09:00:00Z" });
  await page.goto(BASE + "/index.html");
  await waitStatusLoaded(page);
  const tiles = await statusByTitle(page);
  ok(tiles["Easy-Disziplin"].status === "gruen",
    `Test-Lauf mit Ø HF 178 verfälscht die Easy-Disziplin nicht (${tiles["Easy-Disziplin"].status})`);

  await goTab(page, "woche");
  await page.waitForSelector(".day-row");
  ok((await page.textContent("#main > header.sd-pagehead .t1")).includes("Woche 10"), "W9-Test: Woche 10 aktuell");
  await page.click('[data-action="week-prev"]');
  await page.waitForFunction(() => document.querySelector("#main > header.sd-pagehead .t1")?.textContent.includes("Woche 9"));
  await page.waitForSelector(".week-summary");
  const names = await page.locator(".day-row.solid .mid .n").allTextContents();
  ok(names.includes("Kalibrierungstest"), `W9: Kalibrierungstest in der Tagesliste (${names.join(", ")})`);
  ok(names.includes("Full Body B (optional)"), "W9: Do-Kraft als optional gekennzeichnet");
  const wed = page.locator('.day-row[data-date="2026-10-28"]');
  ok(!(await wed.textContent()).includes("verpasst"), "W9: Kalibrierungstest erledigt, nicht verpasst");
  ok((await wed.locator(".status-icon").first().evaluate((el) => el.classList.contains("fg-ok"))),
    "W9: Kalibrierungstest mit hoher HF zeigt Haken statt 'Zu schnell'-Warnung");
  const opt = page.locator('.day-row[data-date="2026-10-29"]');
  ok((await opt.locator(".optional-pill").count()) === 1 && (await opt.locator(".missed-pill").count()) === 0,
    "W9: vergangene, nicht erledigte optionale Kraft ist neutral ('optional'), nicht 'verpasst'");
  const tue = page.locator('.day-row[data-date="2026-10-27"]');
  ok((await tue.locator(".missed-pill").count()) === 1, "W9: nicht erledigte Pflicht-Kraft bleibt 'verpasst'");
  ok((await page.textContent(".week-summary")).includes("0/1 Einheiten"), "W9: optionale Kraft zählt nicht im Wochensoll (0/1)");
  await wed.locator('[data-action="toggle-day-detail"]').click();
  ok((await wed.locator(".day-detail").textContent()).includes("Ø Pace und Ø HF der 30 min notieren"), "W9: Hinweis zum Kalibrierungstest in den Details");
  await opt.locator('[data-action="toggle-day-detail"]').click();
  ok((await opt.locator(".day-detail").textContent()).includes("weder im Wochensoll noch als verpasst"), "W9: Details erklären 'optional'");
  await shot(page, "24-woche-9");
  await noHScroll(page, "Woche 9");

  // Woche 35 per Vorwärts-Blättern erreichbar, danach kein Weiter mehr
  await page.click('[data-action="week-today"]');
  for (let i = 10; i < 35; i++) await page.click('[data-action="week-next"]');
  await page.waitForFunction(() => document.querySelector("#main > header.sd-pagehead .t1")?.textContent.includes("Woche 35"));
  ok(await page.locator('[data-action="week-next"]').isDisabled(), "Woche 35: kein Weiter");
  ok((await page.textContent("#main > header.sd-pagehead .t2")).includes("26.04.") && (await page.textContent("#main > header.sd-pagehead .t2")).includes("02.05."), "Woche 35: 26.04.–02.05.");
  ok((await page.textContent("#main")).includes("Details folgen"), "Woche 35: Platzhalterkarte");

  await goTab(page, "plan");
  await page.waitForSelector(".zone-line");
  ok((await page.textContent("#main > header.sd-pagehead .eyebrow")).includes("Woche 10 von 35"), "Plan-Tab: Woche 10 von 35");
  const planTxt = await page.textContent("#main");
  ok(planTxt.includes("26.10.2026–17.01.2027") && planTxt.includes("18.01.–18.04.2027") && planTxt.includes("19.04.–02.05.2027"),
    "Plan-Tab: neue Phasenzeiträume");
  ok(planTxt.includes("5:45–6:15 /km") && planTxt.includes("> 6:30 /km"), "Plan-Tab: neue Z1/Z2-Pace");
  ok(planTxt.includes("Halbmarathon, 02.05.2027"), "Plan-Tab: bestätigtes Renndatum");
  ok((await page.locator(".timeline .seg").count()) === 4, "Plan-Tab: Zeitleiste mit 4 Phasen");
  await noHScroll(page, "Plan (35 Wochen)");
  ok(errors.length === 0, "Plan-Phase 2: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 30. Login-Gate (Schritt 1b, A1): Auth-Zustände ----
// Auth-Zustand und Stub-Schalter per addInitScript (window.__AUTH__ usw.,
// siehe FIREBASE_STUB). __FS_CALLS__ zählt jeden Firestore-Datenzugriff.
async function authPage(auth, { url = "/index.html", flags = {}, viewport } = {}) {
  const made = await newPage();
  if (viewport) await made.page.setViewportSize(viewport);
  await made.page.addInitScript(([a, f]) => {
    window.__AUTH__ = a;
    Object.assign(window, f);
  }, [auth, flags]);
  await made.page.goto(BASE + url);
  return made;
}
const fsCalls = (page) => page.evaluate(() => window.__FS_CALLS__ || 0);
const signouts = (page) => page.evaluate(() => Number(sessionStorage.getItem("test.signouts") || 0));

// 30a. Abgemeldet: Anmeldebildschirm, keine Tableiste, 0 Firestore-Aufrufe
{
  scenario("30a");
  const { page, ctx, errors } = await authPage("signedOut");
  await page.waitForSelector('form[data-form="login"]');
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Anmelden", "Login: Überschrift 'Anmelden'");
  const gate = await page.evaluate(() => {
    const m = document.getElementById("main").getBoundingClientRect();
    // Der Seitenkopf steht jetzt im #main: zentriert wird in dem Raum darunter.
    const head = document.querySelector("#main > header.sd-pagehead").getBoundingClientRect();
    const c = document.querySelector(".auth-card").getBoundingClientRect();
    return { above: c.top - head.bottom, below: m.bottom - c.bottom, logo: (() => { const r = document.querySelector(".auth-brand .sd-mark--lg")?.getBoundingClientRect(); return r ? Math.round(r.width) : 0; })() };
  });
  ok(gate.above > 40 && Math.abs(gate.above - gate.below) < 24, `Login: Karte vertikal zentriert (oben ${gate.above}, unten ${gate.below})`);
  ok(gate.logo === 64, `Login: Stride-Zeichen 64 px in der Karte (${gate.logo})`);
  const email = page.locator('form[data-form="login"] input[name="email"]');
  const pw = page.locator('form[data-form="login"] input[name="password"]');
  ok((await email.getAttribute("autocomplete")) === "username", "Login: E-Mail-Feld mit autocomplete=username (Schlüsselbund)");
  ok((await pw.getAttribute("autocomplete")) === "current-password", "Login: Passwortfeld mit autocomplete=current-password");
  ok((await email.getAttribute("type")) === "email" && (await pw.getAttribute("type")) === "password", "Login: Feldtypen email/password");
  const sizes = await page.locator("form[data-form=login] input").evaluateAll((els) =>
    els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  ok(sizes.length === 2 && sizes.every((n) => n >= 16), `Login: Felder mindestens 16px (${sizes})`);
  ok((await page.locator("#tabbar").isVisible()) === false, "Login: keine Tableiste ohne Anmeldung");
  ok((await page.locator('[data-card="today"]').count()) === 0, "Login: kein Dashboard-Inhalt ohne Anmeldung");
  await page.waitForTimeout(300);
  ok((await fsCalls(page)) === 0, "Login: abgemeldet = 0 Firestore-Aufrufe");
  await shot(page, "30a-login");
  await noHScroll(page, "Login 390");
  await page.setViewportSize({ width: 320, height: 568 });
  await noHScroll(page, "Login 320");
  await page.setViewportSize({ width: 1280, height: 800 });
  await noHScroll(page, "Login 1280");
  await page.emulateMedia({ colorScheme: "dark" });
  await shot(page, "30a-login-dark");
  ok(errors.length === 0, "Login: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// 30b. Anmelden: Erfolg führt ins Dashboard, Fehler bleiben im Formular
{
  scenario("30b");
  const { page, ctx, errors } = await authPage("signedOut", { flags: { __SIGNIN_FAIL__: "auth/invalid-credential" } });
  await page.waitForSelector('form[data-form="login"]');
  await page.click('form[data-form="login"] button[type="submit"]');
  ok((await page.textContent(".auth-error")).includes("Bitte E-Mail und Passwort eingeben"), "Login: leere Felder werden abgefangen");
  ok((await page.evaluate(() => window.__SIGNIN_CALLS__ || 0)) === 0, "Login: leere Felder lösen keinen Anmeldeversuch aus");
  await page.fill('input[name="email"]', "louis@example.test");
  await page.fill('input[name="password"]', "falsch");
  await page.click('form[data-form="login"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector(".auth-error")?.textContent.includes("E-Mail oder Passwort stimmt nicht"));
  ok(await page.locator(".auth-error").isVisible(), "Login: falsches Passwort zeigt die deutsche Meldung");
  ok((await page.inputValue('input[name="email"]')) === "louis@example.test", "Login: E-Mail bleibt nach einem Fehler stehen");
  ok((await page.locator("#tabbar").isVisible()) === false, "Login: nach Fehler weiter ohne Tableiste");
  await page.evaluate(() => { window.__SIGNIN_FAIL__ = null; });
  await page.fill('input[name="password"]', "richtig");
  await page.click('form[data-form="login"] button[type="submit"]');
  await page.waitForSelector('#main [data-card="today"]');
  ok((await page.evaluate(() => window.__SIGNIN_ARGS__)).join("|") === "louis@example.test|richtig", "Login: Zugangsdaten gehen unverändert an signIn");
  ok(await page.locator("#tabbar").isVisible(), "Login: nach dem Anmelden erscheint die Tableiste");
  ok((await page.textContent("#main > header.sd-pagehead")).includes("Woche 2"), "Login: nach dem Anmelden lädt das Dashboard im selben Seitenaufruf");
  ok(errors.length === 0, "Login: Erfolg ohne Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// 30c. Fremdes Konto: Kein Zugriff + Abmelden
{
  scenario("30c");
  const { page, ctx, errors } = await authPage("forbidden");
  await page.waitForSelector('[data-action="forbidden-logout"]');
  const txt = await page.textContent("#main");
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Kein Zugriff", "Fremdes Konto: Überschrift 'Kein Zugriff'");
  ok(txt.includes("fremde-uid-1234567890") && txt.includes("fremd@example.test"), "Fremdes Konto: zeigt E-Mail und UID des angemeldeten Kontos");
  ok((await page.locator("#tabbar").isVisible()) === false, "Fremdes Konto: keine Tableiste");
  await page.waitForTimeout(300);
  ok((await fsCalls(page)) === 0, "Fremdes Konto: 0 Firestore-Aufrufe");
  await noHScroll(page, "Kein Zugriff");
  await shot(page, "30c-kein-zugriff");
  await page.click('[data-action="forbidden-logout"]');
  await page.waitForSelector('form[data-form="login"]');
  ok((await signouts(page)) === 1, "Fremdes Konto: Abmelden ruft signOutUser genau einmal auf, danach Login");
  ok(errors.length === 0, "Fremdes Konto: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// 30d. Anonyme Altsitzung: Einträge übertragen, still abmelden, Login
{
  scenario("30d");
  const { page, ctx } = await authPage("anonymous");
  await page.waitForSelector('form[data-form="login"]');
  ok((await signouts(page)) === 1, "Anonym: nach erfolgreichem Flush genau ein stilles Abmelden");
  ok((await page.evaluate(() => window.__FLUSH_CALLS__ || 0)) === 1, "Anonym: waitForPendingWrites wurde vor dem Abmelden abgewartet");
  ok((await fsCalls(page)) === 0, "Anonym: keine Datenzugriffe");
  await ctx.close();
}

// 30e. Anonyme Altsitzung mit hängendem Flush: Karte statt Abmelden (B5)
{
  scenario("30e");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-09-07T09:00:00Z") });
  await page.addInitScript(() => { window.__AUTH__ = "anonymous"; window.__PENDING__ = "hang"; });
  await page.goto(BASE + "/index.html");
  await page.waitForFunction(() => (window.__FLUSH_CALLS__ || 0) === 1);
  await page.clock.runFor(11000);
  await page.waitForSelector('[data-action="retry-pending"]');
  ok((await page.textContent("#main")).includes("noch nicht übertragene Einträge"), "Anonym hängend: Hinweiskarte zu offenen Einträgen");
  ok((await signouts(page)) === 0, "Anonym hängend: es wird NICHT abgemeldet");
  ok((await page.locator('form[data-form="login"]').count()) === 0, "Anonym hängend: kein Login-Formular, kein Weitermachen");
  await noHScroll(page, "Hinweiskarte offene Einträge");
  // Erneut versuchen, diesmal löst der Flush auf
  await page.evaluate(() => { window.__PENDING__ = null; });
  await page.click('[data-action="retry-pending"]');
  await page.waitForSelector('form[data-form="login"]');
  ok((await signouts(page)) === 1, "Anonym: nach 'Erneut versuchen' und gelungenem Flush wird abgemeldet");
  await ctx.close();
}

// 30f. Konto-Karte im Plan-Tab: Anzeige, Abmelden räumt das Gerät, offene Einträge brechen ab
{
  scenario("30f");
  const { page, ctx, errors } = await authPage("ok");
  await page.waitForSelector('#main [data-card="today"]');
  await goTab(page, "plan");
  await page.waitForSelector(".account-card");
  const card = await page.textContent(".account-card");
  ok(card.includes("louis@example.test") && card.includes(TEST_UID), "Konto-Karte: zeigt E-Mail und UID");
  ok(card.includes("räumt dieses Gerät"), "Konto-Karte: weist darauf hin, dass Abmelden das Gerät räumt");
  const btn = await page.locator('.account-card [data-action="logout"]').boundingBox();
  ok(btn && btn.height >= 44, `Konto-Karte: Abmelden-Knopf mindestens 44px hoch (${btn?.height})`);
  await shot(page, "30f-konto-karte");
  await noHScroll(page, "Konto-Karte");
  await page.setViewportSize({ width: 320, height: 568 });
  await noHScroll(page, "Konto-Karte 320");
  await page.setViewportSize({ width: 1280, height: 800 });
  await noHScroll(page, "Konto-Karte 1280");

  // offene Einträge: abbrechen, nichts löschen, kein Neuladen
  await page.evaluate(() => { window.__PENDING__ = "hang"; });
  await page.click('.account-card [data-action="logout"]');
  await page.waitForFunction(() => document.getElementById("account-status")?.textContent.includes("noch nicht übertragene"));
  ok((await page.evaluate(() => sessionStorage.getItem("test.wiped"))) === null, "Abmelden mit offenen Einträgen: es wird nichts gelöscht");
  ok((await page.locator('form[data-form="login"]').count()) === 0, "Abmelden mit offenen Einträgen: bleibt angemeldet, kein Login");
  ok(await page.locator('.account-card [data-action="logout"]').isEnabled(), "Abmelden mit offenen Einträgen: Knopf wieder bedienbar");

  // sonst: räumen, neu laden, Login
  await page.evaluate(() => { window.__PENDING__ = null; });
  await page.click('.account-card [data-action="logout"]');
  await page.waitForSelector('form[data-form="login"]');
  ok((await page.evaluate(() => sessionStorage.getItem("test.wiped"))) === "1", "Abmelden: Gerät wird geräumt (signOutAndWipeDevice)");
  ok(errors.length === 0, "Konto-Karte: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// 30g. Abmelden bei offenem zweitem Tab: Cache bleibt, der Hinweis sagt es ehrlich (Review N4)
{
  scenario("30g");
  const { page, ctx, errors } = await authPage("ok", { flags: { __CACHE_KEPT__: true } });
  await page.waitForSelector('#main [data-card="today"]');
  await goTab(page, "plan");
  await page.waitForSelector(".account-card");
  await page.click('.account-card [data-action="logout"]');
  await page.waitForSelector('form[data-form="login"]');
  const notice = await page.textContent("[data-notice]");
  ok(notice.includes("Offline-Speicher") && notice.includes("nicht geleert"), `Abmelden mit zweitem Tab: ehrlicher Hinweis statt "geräumt" (${notice})`);
  await page.reload();
  await page.waitForSelector('form[data-form="login"]');
  ok((await page.locator("[data-notice]").count()) === 0, "Abmelden mit zweitem Tab: Hinweis erscheint nur einmal");
  ok(errors.length === 0, "Abmelden mit zweitem Tab: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 31. Worker-Token (A2): Coach und Strava senden Authorization ----
// Coach: der Header ist da, genau ein Retry bei 401 unauthorized, kein Aufruf
// ohne Token, bei 503 sofort Fallback. Krafttag (08.09.), damit der Coach
// wirklich abgefragt wird.
async function coachPage({ replies, flags = {} }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route(/firebase-init\.js/, (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const seen = [];
  await ctx.route("https://worker.test/coach", (r) => {
    const reply = replies[Math.min(seen.length, replies.length - 1)];
    seen.push(r.request().headers().authorization || null);
    r.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z"));
  await page.addInitScript((f) => {
    localStorage.setItem("hm-tracker.workerUrl", "https://worker.test");
    Object.assign(window, f);
  }, flags);
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(COACH);
  await page.waitForTimeout(500);
  return { page, ctx, seen, errors };
}

{
  scenario("31");
  const { page, ctx, seen, errors } = await coachPage({ replies: [{ status: 200, body: { text: "Coach sagt hallo." } }] });
  ok(seen.length === 1 && seen[0] === "Bearer test-token", `Coach: Anfrage trägt Authorization: Bearer <Token> (${JSON.stringify(seen)})`);
  ok((await page.textContent("#coach-slot")).includes("Coach sagt hallo."), "Coach: Antwort wird angezeigt");
  ok(errors.length === 0, "Coach mit Token: keine Seitenfehler " + JSON.stringify(errors));
  await ctx.close();
}
{
  const { page, ctx, seen } = await coachPage({ replies: [
    { status: 401, body: { error: "unauthorized", message: "Anmeldung erforderlich" } },
    { status: 200, body: { text: "Nach dem Retry." } },
  ] });
  ok(seen.length === 2 && seen[0] === "Bearer test-token" && seen[1] === "Bearer fresh-token",
     `Coach: 401 unauthorized -> genau ein Retry mit frischem Token (${JSON.stringify(seen)})`);
  ok((await page.textContent("#coach-slot")).includes("Nach dem Retry."), "Coach: Antwort nach dem Retry wird angezeigt");
  await ctx.close();
}
{
  const { ctx, seen } = await coachPage({ replies: [{ status: 401, body: { error: "unauthorized" } }] });
  ok(seen.length === 2, `Coach: bleibt es bei 401, bleibt es bei einem einzigen Retry (${seen.length})`);
  await ctx.close();
}
{
  const { page, ctx, seen } = await coachPage({ replies: [{ status: 503, body: { error: "auth_unavailable" } }] });
  ok(seen.length === 1, `Coach: 503 auth_unavailable -> sofort Fallback, kein Retry (${seen.length})`);
  ok((await page.locator(COACH).count()) === 1, "Coach: Karte bleibt bei 503 erhalten (Fallback)");
  await ctx.close();
}
{
  const { page, ctx, seen, errors } = await coachPage({ replies: [{ status: 200, body: { text: "nie gesehen" } }], flags: { __TOKEN_FAIL__: true } });
  ok(seen.length === 0, `Coach: ohne Token gibt es keinen Worker-Aufruf (${seen.length})`);
  ok(!(await page.textContent("#coach-slot")).includes("nie gesehen"), "Coach: ohne Token greift der Fallback");
  ok(errors.length === 0, "Coach ohne Token: keine Seitenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// Strava /refresh: abgelaufener Access-Token zwingt zum Worker-Aufruf
async function refreshPage(replies) {
  const { page, ctx, errors } = await newPage();
  const seen = [];
  await ctx.route("https://worker.test/refresh", (r) => {
    const reply = replies[Math.min(seen.length, replies.length - 1)];
    seen.push({ auth: r.request().headers().authorization || null });
    r.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  await page.addInitScript(() => {
    localStorage.setItem("test.strava", JSON.stringify({ refresh_token: "rt", access_token: "at", expires_at: 1 }));
  });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector('#main [data-card="today"]');
  await page.waitForTimeout(800);
  return { page, ctx, seen, errors };
}
const refreshOk = { status: 200, body: { access_token: "at2", refresh_token: "rt2", expires_at: 9999999999 } };
{
  const { ctx, seen } = await refreshPage([refreshOk]);
  ok(seen.length >= 1 && seen.every((s) => s.auth === "Bearer test-token"), `Strava /refresh: Anfrage trägt Authorization (${JSON.stringify(seen)})`);
  await ctx.close();
}
{
  const { ctx, seen } = await refreshPage([{ status: 401, body: { error: "unauthorized" } }, refreshOk]);
  ok(seen[0]?.auth === "Bearer test-token" && seen[1]?.auth === "Bearer fresh-token",
     `Strava /refresh: 401 unauthorized -> Retry mit frischem Token (${JSON.stringify(seen)})`);
  await ctx.close();
}
{
  // 401 ohne error-Feld = Strava lehnt ab, nicht der Worker: kein Retry
  const { page, ctx, seen } = await refreshPage([{ status: 401, body: { message: "Authorization Error" } }]);
  ok(seen.length === 1, `Strava /refresh: 401 ohne error-Feld -> KEIN Retry (${seen.length} Aufrufe)`);
  ok((await page.evaluate(() => window.__TOKEN_CALLS__ || [])).every((f) => f === false), "Strava /refresh: kein erzwungenes Token bei Strava-401");
  await ctx.close();
}
{
  const { page, ctx, seen } = await refreshPage([{ status: 503, body: { error: "auth_unavailable", message: "x" } }]);
  ok(seen.length === 1, `Strava /refresh: 503 auth_unavailable -> kein Retry (${seen.length})`);
  await ctx.close();
}

// ---- 32. Strava-Redirect überlebt den Login (B4) ----
{
  scenario("32");
  const exchanges = [];
  const made = await newPage();
  const { page, ctx, errors } = made;
  await ctx.route("https://worker.test/exchange", (r) => {
    exchanges.push({ auth: r.request().headers().authorization || null, body: r.request().postData() });
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      access_token: "at-new", refresh_token: "rt-new", expires_at: 9999999999, athlete: { id: 42 } }) });
  });
  await page.addInitScript(() => { window.__AUTH__ = "signedOut"; });
  await page.goto(BASE + "/index.html?code=redirect-code-1&scope=read,activity:read_all");
  await page.waitForSelector('form[data-form="login"]');
  await page.waitForTimeout(300);
  ok(exchanges.length === 0, "Strava-Redirect: abgemeldet wird der Code noch nicht eingelöst");
  ok(page.url().includes("code=redirect-code-1"), "Strava-Redirect: der Code bleibt in der URL, bis angemeldet");
  await page.fill('input[name="email"]', "louis@example.test");
  await page.fill('input[name="password"]', "richtig");
  await page.click('form[data-form="login"] button[type="submit"]');
  await page.waitForFunction(() => document.getElementById("toast")?.textContent.includes("Mit Strava verbunden"));
  ok(exchanges.length === 1, `Strava-Redirect: nach dem Login genau ein /exchange-Aufruf (${exchanges.length})`);
  ok(exchanges[0]?.auth === "Bearer test-token" && JSON.parse(exchanges[0].body).code === "redirect-code-1",
     "Strava-Redirect: /exchange trägt Token und den ursprünglichen Code");
  ok(!page.url().includes("code="), "Strava-Redirect: URL danach bereinigt");
  ok(errors.length === 0, "Strava-Redirect: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 33. Daten exportieren (Plan-Tab, Karte "Daten") ----
async function exportPage({ activities = ACTIVITIES, stravaFail = false, share = "" } = {}) {
  const made = await newPage({ connected: true, activities });
  const { page, ctx } = made;
  if (stravaFail) {
    await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => r.fulfill({ status: 500, body: "boom" }));
  }
  const urls = [];
  page.on("request", (r) => { if (r.url().includes("/athlete/activities")) urls.push(r.url()); });
  await page.addInitScript((s) => {
    localStorage.setItem("test.logs", JSON.stringify({ "2026-09-08_kniebeuge": {
      date: "2026-09-08", exercise: "kniebeuge", name: "Kniebeuge", soll: "3x8",
      sets: [{ kg: 60, reps: 8 }], topKg: 60, totalReps: 8, week: 2, completed: true } }));
    localStorage.setItem("test.dayplan.2026-09-08", JSON.stringify({ removed: ["x"], added: [] }));
    localStorage.setItem("test.runlinks", JSON.stringify({ "2026-09-07": { activityId: 1 } }));
    if (s) {
      window.__SHARED__ = null;
      // Touch-Gerät simulieren, außer im Desktop-Fall
      if (s !== "desktop") {
        const mm = window.matchMedia.bind(window);
        window.matchMedia = (q) => (q === "(pointer: coarse)" ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));
      }
      navigator.canShare = () => true;
      navigator.share = async (d) => {
        window.__SHARED__ = { name: d.files[0].name, title: d.title };
        if (s === "abort") throw new DOMException("x", "AbortError");
      };
    }
  }, share);
  await page.goto(BASE + "/index.html");
  await page.waitForSelector('[data-tab="plan"]');
  await goTab(page, "plan");
  await page.waitForSelector('[data-action="export-data"]');
  return { ...made, urls };
}
const stripPlan = (s) => s.replace(/"plan":[\s\S]*?"strava":/, "");
{
  scenario("33");
  const activities = ACTIVITIES.map((a, i) => i === 0
    ? { ...a, sport_type: "Run", map: { summary_polyline: "GEHEIMEPOLYLINE" }, athlete: { id: 42 }, start_latlng: [1, 2] }
    : a);
  const { page, ctx, errors, urls } = await exportPage({ activities });
  ok(await page.locator(".export-card").count() === 1, "Export: Karte Daten im Plan-Tab");
  const btnBox = await page.locator('[data-action="export-data"]').boundingBox();
  ok(btnBox && btnBox.height >= 44, "Export: Knopf mindestens 44px hoch");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-action="export-data"]'),
  ]);
  ok(/^trainingsdaten-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), "Export: Dateiname " + download.suggestedFilename());
  const body = readFileSync(await download.path(), "utf8");
  const data = JSON.parse(body);
  ok(data.strava.activities.length === ACTIVITIES.length, "Export: alle Strava-Aktivitäten, auch Rad und Kraft");
  ok(data.strava.activities.some((a) => a.type === "WeightTraining" && a.suffer_score === 15), "Export: Krafttraining mit Belastungswert");
  ok(data.strength.logs.length === 1 && data.strength.logs[0].topKg === 60, "Export: Stub-Log enthalten");
  ok(data.strength.dayplans[0]?.removed[0] === "x" && data.runLinks[0]?.activityId === 1, "Export: Dayplans und Lauf-Zuordnungen");
  ok(data.plan?.id === "hm-2027" && data.meta.planId === "hm-2027", "Export: Plan und meta");
  ok(!/refresh_token|access_token|polyline|GEHEIMEPOLYLINE|latlng|rt-new|at-new/i.test(stripPlan(body)),
    "Export: kein Token, keine Polyline, keine Koordinaten in der Datei");
  ok(data.meta.warnings.length === 0, "Export: ohne Fehler keine Warnungen");
  const since = String(Math.floor(new Date("2026-01-01T00:00:00").getTime() / 1000));
  ok(urls.some((u) => /per_page=200/.test(u) && new URL(u).searchParams.get("after") === since),
    "Export: eigener Abruf ab 2026-01-01 mit per_page=200");
  await page.waitForFunction(() => document.getElementById("export-status")?.textContent === "Export fertig.");
  ok(await page.isEnabled('[data-action="export-data"]'), "Export: Knopf danach wieder aktiv");
  await noHScroll(page, "Plan-Tab mit Export-Karte");
  ok(errors.length === 0, "Export: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}
{
  // Strava fällt aus: übrige Daten kommen trotzdem, Hinweis in meta.warnings
  const { page, ctx } = await exportPage({ stravaFail: true });
  const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-action="export-data"]')]);
  const data = JSON.parse(readFileSync(await download.path(), "utf8"));
  ok(data.strava.activities.length === 0 && data.strength.logs.length === 1, "Export ohne Strava: Logs trotzdem enthalten");
  ok(data.meta.warnings.length === 1 && data.meta.warnings[0].startsWith("Strava:") && !data.meta.warnings[0].includes("—") && !data.meta.warnings[0].startsWith("Strava: Strava"),
    "Export ohne Strava: Warnung in meta.warnings " + JSON.stringify(data.meta.warnings));
  await page.waitForFunction(() => document.getElementById("export-status")?.textContent.startsWith("Exportiert, aber unvollständig"));
  await ctx.close();
}
{
  // Teilen-Blatt (iPhone): navigator.share statt Download
  const { page, ctx } = await exportPage({ share: "ok" });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.click('[data-action="export-data"]');
  await page.waitForFunction(() => window.__SHARED__);
  const shared = await page.evaluate(() => window.__SHARED__);
  ok(/^trainingsdaten-.*\.json$/.test(shared.name) && shared.title === shared.name, "Export: navigator.share mit Datei " + shared.name);
  await page.waitForTimeout(200);
  ok(downloads === 0, "Export: beim Teilen kein zusätzlicher Download");
  await ctx.close();
}
{
  // Mac/Desktop: Teilen wäre verfügbar, trotzdem normaler Download
  const { page, ctx } = await exportPage({ share: "desktop" });
  const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-action="export-data"]')]);
  ok(/^trainingsdaten-.*\.json$/.test(download.suggestedFilename()), "Export Desktop: Download statt Teilen-Blatt");
  ok((await page.evaluate(() => window.__SHARED__)) === null, "Export Desktop: navigator.share nicht benutzt");
  await ctx.close();
}
{
  // Abbruch des Teilens ist kein Fehler
  const { page, ctx } = await exportPage({ share: "abort" });
  await page.click('[data-action="export-data"]');
  await page.waitForFunction(() => window.__SHARED__);
  await page.waitForTimeout(200);
  ok(await page.locator("#toast.error").count() === 0 && !(await page.textContent("#export-status")).includes("fehlgeschlagen"),
    "Export: Abbruch des Teilens zeigt keinen Fehler");
  ok(await page.isEnabled('[data-action="export-data"]'), "Export: Knopf nach Abbruch wieder aktiv");
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} Browser-Checks bestanden`);
console.log("Checks je Szenario: " + [...perScenario].map(([k, v]) => `${k}=${v}`).join(" "));
process.exit(fails ? 1 : 0);
