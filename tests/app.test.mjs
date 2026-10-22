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
  // Test-Haken: __SAVE_DELAY__ (ms) verzögert, __SAVE_FAIL__ (Text) lässt das Schreiben scheitern.
  if (window.__SAVE_DELAY__) await new Promise((r) => setTimeout(r, window.__SAVE_DELAY__));
  if (window.__SAVE_FAIL__) throw new Error(window.__SAVE_FAIL__);
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
  const row = page.locator(`.sd-day[data-date="${iso}"]`);
  const toggle = row.locator('[data-action="toggle-day-detail"]');
  // Nach einem Rücksprung aus dem Tag ist die Zeile schon offen (state.openDayIndex): nicht wieder zuklappen.
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await row.locator('[data-action="open-day"]').click();
}

// Wochen-Tab: Kopf (Titel "Woche N", Untertitel mit Zeitraum und Typ), offene Zeilen, Pillen.
const WEEK_HEAD = "#main > header.sd-pagehead";
const weekTitle = (page) => page.textContent(`${WEEK_HEAD} h1`);
const weekSub = (page) => page.textContent(`${WEEK_HEAD} .sd-intro__sub`);
const waitWeek = (page, n) =>
  page.waitForFunction((t) => document.querySelector("#main > header.sd-pagehead h1")?.textContent.trim() === t, `Woche ${n}`);
const waitWeekRows = (page) => page.waitForSelector('[data-card="days"] .sd-day');
const openRows = (page) => page.locator(".sd-day.is-open").count();
const rowPills = (row) => row.locator(".sd-day__status .sd-pill").allTextContents().then((a) => a.map((t) => t.trim()));
const activeAction = (page) => page.evaluate(() => document.activeElement?.dataset?.action ?? null);

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

// ---- Kraft-Tag (Stride E5): stabile Haken, docs/ui-markup-stride.md Abschnitt 11 ----
// Jetzt-Karte [data-card="now"][data-slug][data-mode], Sätze .sd-set(.is-done|.is-open|.sd-set--active),
// Reihenfolge .sd-order__row, Fortschrittspunkte .sd-dots__seg. Gesprochen wird nur über data-action.
const NOW = '[data-card="now"][data-slug]';
const PRIMARY = '[data-card="now"] .sd-btn--primary';
const KRAFT_META = "#main > header.sd-pagehead .sd-nav__meta";
const waitKraft = (page) => page.waitForSelector(NOW);
const nowSlug = (page) => page.getAttribute('[data-card="now"]', "data-slug");
const nowMode = (page) => page.getAttribute('[data-card="now"]', "data-mode");
const primaryText = async (page) => (await page.textContent(PRIMARY)).trim();
const primaryAction = (page) => page.getAttribute(PRIMARY, "data-action");
const kraftMeta = async (page) => (await page.textContent(KRAFT_META)).trim();
// Zustand je Satz: "done", "open" oder "active"
const setStates = (page) => page.locator('[data-card="now"] .sd-set').evaluateAll((els) =>
  els.map((el) => (el.classList.contains("sd-set--active") ? "active" : el.classList.contains("is-done") ? "done" : "open")));
// Werte der nicht aktiven Sätze als Text ("80 kg × 9"), aktive als "*"
const setValues = (page) => page.locator('[data-card="now"] .sd-set').evaluateAll((els) =>
  els.map((el) => (el.classList.contains("sd-set--active") ? "*" : el.querySelector(".sd-set__value").textContent.trim())));
// Zahl im Stepper des aktiven Satzes ("62,5")
const stepperNum = (page, field) =>
  page.textContent(`.sd-set--active [data-action="edit-value"][data-field="${field}"] .sd-stepper__num`);
const orderSlugs = (page) => page.locator(".sd-order__row").evaluateAll((els) => els.map((e) => e.dataset.slug));
const dotStates = (page) => page.locator(".sd-dots__seg").evaluateAll((els) =>
  els.map((e) => (e.classList.contains("is-current") ? "current" : e.classList.contains("is-done") ? "done" : "open")));
// V1: Tipp auf den Wert, Zahl eintippen, Enter
async function enterValue(page, field, text) {
  await page.click(`.sd-set--active [data-action="edit-value"][data-field="${field}"]`);
  await page.fill(".sd-stepper__input", text);
  await page.press(".sd-stepper__input", "Enter");
}
// Sätze der Jetzt-Übung abhaken, bis der Primärbutton nicht mehr "Satz n fertig" heißt (gespeichert).
async function finishExercise(page) {
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector(`${PRIMARY}:not([disabled])`);
    if ((await primaryAction(page)) !== "finish-set") return;
    await page.click(PRIMARY);
  }
}
// Gespeichertes Log-Dokument aus dem Stub-Speicher (null = nicht geschrieben)
const storedLog = (page, iso, slug) =>
  page.evaluate(([k]) => JSON.parse(localStorage.getItem("test.logs") || "{}")[k] ?? null, [`${iso}_${slug}`]);
const storedLogKeys = (page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("test.logs") || "{}")));
const liveText = (page) => page.evaluate(() => document.getElementById("kraftLive")?.textContent ?? null);
const waitLive = (page, text) =>
  page.waitForFunction((t) => document.getElementById("kraftLive")?.textContent === t, text, { timeout: 3000 }).then(() => true, () => false);
// Kraft-Tag über den Wochen-Tab öffnen (Di 08.09. = "Full Body A")
async function openKraftViaWeek(page, iso = "2026-09-08") {
  await goTab(page, "woche");
  await openDay(page, iso);
  await waitKraft(page);
}

// ---- Lauf-Tag (Stride E6): stabile Haken, docs/ui-markup-stride.md Abschnitt 12 ----
// Slot #strava-slot trägt [data-card="compare"|"strava-run"|"empty"|"missed"|"no-strava"|"ignored"|"error"],
// das Zuordnungs-Sheet #assignSheet seine Optionen als .sd-option[role="radio"]. Gesprochen wird nur über data-action.
const CMP = '#strava-slot [data-card="compare"]';
const RUNROW = '#strava-slot [data-card="strava-run"]';
const ASSIGN = "#assignSheet";
const OPTIONS = '#assignSheet .sd-option[role="radio"]';
const RUN_HEAD = "#main > header.sd-pagehead";
const waitRunSlot = (page) => page.waitForSelector('#strava-slot [data-card]:not([data-card="loading"])');
// Lauf-Tag von Heute aus öffnen (die Uhr steht auf dem Plantag)
async function openRunToday(page) {
  await page.waitForSelector(`${TODAY} [data-action="open-day"]`);
  await page.click(`${TODAY} [data-action="open-day"]`);
  await waitRunSlot(page);
}
// Aktiviertes Element als Kurzbeschreibung: { id, action, tag }
const activeEl = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { id: a?.id || "", action: a?.dataset?.action || "", tag: a?.tagName || "", card: a?.dataset?.card || "" };
});
const sheetIsOpen = (page, sel = ASSIGN) => page.evaluate((s) => document.querySelector(s).classList.contains("open"), sel);
const sheetIsHidden = (page, sel = ASSIGN) => page.evaluate((s) => document.querySelector(s).hidden, sel);
const waitSheetHidden = (page, sel = ASSIGN) => page.waitForFunction((s) => document.querySelector(s).hidden, sel, { timeout: 2000 }).then(() => true, () => false);
const rangeTexts = (page) => page.locator(`${CMP} .sd-range`).evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
// Zahlen der SVG-Geometrie je Range-Zeile: Band (x, width) und Marker (x1, x2); null = nicht vorhanden
const svgGeometry = (page) => page.locator(`${CMP} .sd-range`).evaluateAll((rows) => rows.map((row) => {
  const rect = row.querySelector(".sd-range__band rect");
  const tick = row.querySelector(".sd-range__tick");
  return {
    band: rect ? { x: rect.getAttribute("x"), width: rect.getAttribute("width") } : null,
    mark: tick ? { x1: tick.getAttribute("x1"), x2: tick.getAttribute("x2") } : null,
    axis: [...row.querySelectorAll(".sd-range__axis span")].map((e) => e.textContent),
    ampel: row.querySelector(".sd-ampel")?.className ?? null,
    value: row.querySelector(".sd-range__value")?.className ?? null,
  };
}));
// Strava-Aktivität für die Lauf-Tag-Fixtures
const run = (id, name, date, time, meters, sec, hr) => ({
  id, type: "Run", name, start_date_local: `${date}T${time}:00Z`, distance: meters, moving_time: sec,
  ...(hr ? { average_heartrate: hr } : {}),
});

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
  await page.waitForSelector(CMP);
  const runTxt = await page.textContent("#strava-slot");
  ok(runTxt.includes("6:15 /km"), "Lauf-Tag aus Heute: Pace korrekt berechnet");
  ok(runTxt.includes("155 bpm"), "Lauf-Tag aus Heute: Ø HF angezeigt");
  ok(runTxt.includes("50:10 min"), "Lauf-Tag aus Heute: Dauer formatiert");
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
  await waitKraft(page);
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Full Body A" && (await nowSlug(page)) === "squats",
    "Dashboard->Tagesansicht: Krafttag geöffnet (Titel der Einheit im Kopf, erste Übung ist Jetzt)");
  ok((await page.textContent('#main > header.sd-pagehead [data-action="back"]')).includes("Heute") && (await kraftMeta(page)) === "0 von 8 erledigt",
    "Dashboard->Tagesansicht: Zurück-Knopf beschriftet mit 'Heute', Zähler '0 von 8 erledigt'");

  await enterValue(page, "kg", "80");
  await enterValue(page, "reps", "9");
  await finishExercise(page);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  ok((await kraftMeta(page)) === "1 von 8 erledigt", "Dashboard->Tagesansicht: nach der ersten Übung '1 von 8 erledigt'");

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
// B -> A zwischen Info- und Zuordnungs-Sheet steht in Szenario 38h (E6).
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
  const row = page.locator('.sd-day[data-date="2026-09-08"]');
  await row.waitFor();
  const pills = await rowPills(row);
  ok(pills.length === 1 && pills[0] === "Heute · 2/8", `Woche: heutiger Krafttag zeigt genau eine kombinierte Pille "Heute · 2/8" (${JSON.stringify(pills)})`);
  ok(await row.evaluate((el) => el.classList.contains("is-today")), "Woche: heutiger Tag ist als Heute-Zeile getönt");
  await row.locator('[data-action="toggle-day-detail"]').click();
  const detail = await row.locator(".sd-day__detail").textContent();
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
  await page.waitForSelector('[data-card="week-sums"]');
  ok((await active()) === "woche", "Tableiste: Woche markiert im Wochen-Tab");
  await openDay(page, "2026-09-08");
  await waitKraft(page);
  ok((await active()) === "woche", "Tableiste: Tagesansicht aus der Woche bleibt bei Woche");
  await goTab(page, "dashboard");
  await page.click(`${TODAY} [data-action="open-day"]`);
  await waitKraft(page);
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
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Long run · 13 km" && (await page.textContent('#main > header.sd-pagehead [data-action="back"]')).includes("Heute"),
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
  await page.waitForSelector('[data-card="week-sums"]');
  ok((await page.locator("#tabbar button.active").getAttribute("data-tab")) === "woche" && (await weekTitle(page)) === "Woche 2",
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

// ---- 3. Woche: Navigation, Akkordeon, Tag öffnen (Stride E4: sd-day, ein Zeilen-Button, genau eine offene Zeile) ----
{
  scenario("3");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await waitWeekRows(page);
  ok((await page.locator(".sd-day").count()) === 7, "Woche: 7 Tage");
  ok((await weekTitle(page)) === "Woche 2", "Woche: aktuelle Woche 2");
  ok((await page.locator(".sd-day.is-today").count()) === 1, "Woche: heute markiert");
  ok((await page.locator('[data-action="week-today"]').count()) === 0, "Woche: kein 'Zu heute', wenn schon die aktuelle Woche zu sehen ist");
  await page.click('[data-action="week-next"]');
  await waitWeek(page, 3);
  ok(true, "Woche: vorwärts blättern");
  await page.waitForFunction(() => document.activeElement?.dataset?.action === "week-next");
  ok((await activeAction(page)) === "week-next", "Woche: nach dem Blättern liegt der Fokus wieder auf dem Pfeil");
  await page.click('[data-action="week-prev"]');
  await page.click('[data-action="week-prev"]');
  await waitWeek(page, 1);
  ok(true, "Woche: rückwärts blättern");
  ok(await page.locator('[data-action="week-prev"]').isDisabled(), "Woche: bei Woche 1 kein Zurück");
  ok(!(await page.locator('[data-action="week-next"]').isDisabled()), "Woche: bei Woche 1 geht Weiter noch");
  ok((await page.locator('[data-action="week-today"]').count()) === 1 && (await page.textContent('[data-action="week-today"]')).trim() === "Zu heute",
    "Woche: 'Zu heute' erscheint außerhalb der aktuellen Woche");
  await page.click('[data-action="week-today"]');
  await waitWeek(page, 2);
  ok(true, "Woche: 'Zu heute' springt zurück");
  await page.waitForSelector('[data-card="week-sums"]');
  await shot(page, "03-woche");
  await noHScroll(page, "Woche");
  ok((await styleAttrCount(page)) === 0, "Woche: kein style-Attribut im Markup (C5)");

  // Tageszeilen: Titel mit Distanz, Ist statt Ziel für gelaufene Tage
  const titles = await page.locator(".sd-day__title").allTextContents();
  ok(titles.some((t) => t.startsWith("Easy run · ")) && titles.includes("Full Body A"), `Woche: Tagesliste zeigt Lauf- und Krafteinheiten (${titles.join(", ")})`);
  const monday = page.locator('.sd-day[data-date="2026-09-07"]');
  ok((await monday.locator(".sd-day__sub").textContent()).startsWith("Ist:"), "Woche: bereits gelaufener Tag zeigt Ist statt Ziel");

  // Antippen klappt Details auf, ohne die Ansicht zu wechseln
  const tue = page.locator('.sd-day[data-date="2026-09-08"]');
  ok(!(await tue.locator(".sd-day__detail").isVisible()) && (await tue.locator(".sd-day__detail").getAttribute("hidden")) !== null, "Woche: Details zunächst zu (hidden)");
  await tue.locator('[data-action="toggle-day-detail"]').click();
  ok(await tue.locator(".sd-day__detail").isVisible() && await tue.evaluate((el) => el.classList.contains("is-open")), "Woche: Antippen klappt die Details auf");
  ok((await tue.locator('[data-action="toggle-day-detail"]').getAttribute("aria-expanded")) === "true", "Woche: aria-expanded folgt dem Zustand");
  ok((await tue.locator(".sd-day__detail").textContent()).includes("Übungen"), "Woche: Kraft-Details zeigen die Übungsliste");
  ok((await page.locator('[data-card="week-sums"]').count()) === 1, "Woche: Aufklappen bleibt im Wochen-Tab");
  ok((await page.locator('.sd-day.is-rest [data-action], .sd-day.is-rest button, .sd-day.is-rest [aria-expanded]').count()) === 0 &&
     (await page.locator(".sd-day.is-rest").count()) === 2, "Woche: Ruhetage sind nicht antippbar (kein Knopf, kein data-action, kein aria-expanded)");

  // Genau eine Zeile offen: eine zweite öffnen schließt die erste
  await monday.locator('[data-action="toggle-day-detail"]').click();
  ok((await openRows(page)) === 1 && await monday.evaluate((el) => el.classList.contains("is-open")) &&
     !(await tue.locator(".sd-day__detail").isVisible()), "Woche: eine zweite Zeile zu öffnen schließt die erste (genau eine offen)");
  const expanded = await page.locator('[data-action="toggle-day-detail"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-expanded")));
  ok(expanded.filter((x) => x === "true").length === 1 && expanded.every((x) => x === "true" || x === "false") &&
     (await page.locator(".sd-day__detail:not([hidden])").count()) === 1, `Woche: aria-expanded und hidden laufen mit dem Zustand (${expanded.join(",")})`);
  await monday.locator('[data-action="toggle-day-detail"]').click();
  ok((await openRows(page)) === 0 && !(await monday.locator(".sd-day__detail").isVisible()), "Woche: zweites Antippen klappt wieder zu");

  // Dienstag = Krafttag über "Tag öffnen" in die Tagesansicht, Rücksprung "‹ Woche"
  await openDay(page, "2026-09-08");
  await waitKraft(page);
  ok((await page.textContent("#main > header.sd-pagehead h1")) === "Full Body A", "Tagesansicht: Krafttag geöffnet (Titel der Einheit im Kopf)");
  ok((await page.locator(".sd-order__row").count()) === 8, "Krafttag: 8 Übungen");
  ok((await page.locator('[data-action="back"]').textContent()).trim() === "Woche", "Tagesansicht aus der Woche: Rücksprung heißt 'Woche' (‹ Woche)");
  await page.click('[data-action="back"]');
  await waitWeekRows(page);
  ok((await weekTitle(page)) === "Woche 2", "Tagesansicht: Zurück zur Woche (gleiche Woche)");
  ok((await openRows(page)) === 1 && await page.locator('.sd-day[data-date="2026-09-08"]').evaluate((el) => el.classList.contains("is-open")),
    "Tagesansicht: nach dem Rücksprung ist die zuletzt geöffnete Zeile wieder offen");
  await page.click('[data-action="week-next"]');
  await waitWeek(page, 3);
  ok((await openRows(page)) === 0, "Woche: beim Wechsel der Woche sind alle Zeilen zu");
  ok(errors.length === 0, "Woche: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 3b. Woche: Status-Pillen und Rangfolge, Entlastung, Ruhetag (Stride E4, neu) ----
// Entlastungswoche 8 (19.–25.10.), heute Sonntag 25.10.: Mo HF zu hoch UND zu kurz (eine Pille: HF),
// Di Pflicht-Kraft ohne Log (verpasst), Mi 89 % (zu kurz), Do Kraft 2/8 (vergangen, teilweise),
// Fr Ruhe, Sa Long run am Freitag gelaufen (nachgeholt), So Recovery heute offen.
{
  scenario("3b");
  const acts = [
    { id: 21, type: "Run", name: "Easy run", start_date_local: "2026-10-19T07:00:00Z", distance: 7000, moving_time: 2700, average_heartrate: 163 },
    { id: 22, type: "Run", name: "Easy run", start_date_local: "2026-10-21T07:00:00Z", distance: 7100, moving_time: 2700, average_heartrate: 150 },
    { id: 23, type: "Run", name: "Long run", start_date_local: "2026-10-23T09:00:00Z", distance: 11000, moving_time: 4100, average_heartrate: 150 },
  ];
  const { page, ctx, errors } = await newPage({ connected: true, activities: acts, now: "2026-10-25T09:00:00Z" });
  await page.addInitScript(() => {
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-10-22_bulgarian-split-squats": { date: "2026-10-22", exercise: "bulgarian-split-squats", name: "Bulgarian split squats", soll: "3x8", topKg: 20, totalReps: 24, completed: true, sets: [{ kg: 20, reps: 8 }] },
      "2026-10-22_single-leg-rdl": { date: "2026-10-22", exercise: "single-leg-rdl", name: "Single leg RDL", soll: "3x8", topKg: 30, totalReps: 24, completed: true, sets: [{ kg: 30, reps: 8 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await waitWeekRows(page);
  await page.waitForSelector('.sd-day[data-date="2026-10-19"] .sd-day__status .sd-pill, .sd-day[data-date="2026-10-19"] .sd-day__status .sd-check');
  const row = (iso) => page.locator(`.sd-day[data-date="${iso}"]`);
  ok((await weekTitle(page)) === "Woche 8" && (await weekSub(page)).includes("19.–25. Oktober") && (await weekSub(page)).includes("Entlastung"),
    `Woche 8: Kopf mit Zeitraum und Wochentyp (${await weekSub(page)})`);
  const mo = await rowPills(row("2026-10-19"));
  ok(mo.length === 1 && mo[0] === "HF zu hoch", `Status: Ø HF über der Grenze zeigt "HF zu hoch" (${JSON.stringify(mo)})`);
  ok(/Kürzer als geplant/.test(await row("2026-10-19").locator(".sd-day__detail").textContent()),
    "Rangfolge: der zweite Grund (zu kurz) steht in den Details, nicht als zweite Pille");
  const we = await rowPills(row("2026-10-21"));
  ok(we.length === 1 && we[0] === "zu kurz", `Status: 7,1 von 8 km (89 %) zeigt "zu kurz" (${JSON.stringify(we)})`);
  const di = await rowPills(row("2026-10-20"));
  ok(di.length === 1 && di[0] === "verpasst", `Status: Pflicht-Kraft ohne Log ist "verpasst" (${JSON.stringify(di)})`);
  const dop = await rowPills(row("2026-10-22"));
  ok(dop.length === 1 && dop[0] === "2/8", `Status: vergangene Kraft teilweise zeigt "2/8" (${JSON.stringify(dop)})`);
  const sa = await rowPills(row("2026-10-24"));
  ok(sa.length === 1 && sa[0] === "nachgeholt", `Status: Lauf an anderem Tag zeigt "nachgeholt" (${JSON.stringify(sa)})`);
  ok(await row("2026-10-25").evaluate((el) => el.classList.contains("is-today")) && JSON.stringify(await rowPills(row("2026-10-25"))) === '["Heute"]',
    "Status: heute ohne Lauf zeigt 'Heute'");
  ok((await row("2026-10-22").locator(".sd-day__sub").textContent()).includes("2/8 erfasst · Deload") &&
     (await row("2026-10-20").locator(".sd-day__sub").textContent()).endsWith(" · Deload"),
    "Entlastungswoche: Kraftzeilen tragen ' · Deload' in der Sub-Zeile");
  ok(!(await row("2026-10-19").locator(".sd-day__sub").textContent()).includes("Deload"), "Entlastungswoche: Laufzeilen tragen kein Deload");
  ok((await row("2026-10-23").getAttribute("class")).includes("is-rest") && (await row("2026-10-23").locator("button, [data-action], [aria-expanded]").count()) === 0 &&
     (await row("2026-10-23").locator(".sd-day__row").textContent()).includes("Ruhe"), "Ruhetag: Zeile ohne Knopf, data-action und aria-expanded");
  const rest = row("2026-10-23");
  await rest.locator(".sd-day__row").click({ force: true });
  ok((await openRows(page)) === 0, "Ruhetag: Tippen öffnet nichts");
  ok((await page.locator('[data-card="days"] [aria-label], [data-card="days"] .sd-vh').count()) > 0 &&
     (await row("2026-10-25").locator(".sd-day__dow .sd-vh").textContent()).trim() === "Sonntag, heute", "Barrierefreiheit: heutiger Wochentag trägt 'heute' für Screenreader");
  // Summen: Laufkilometer 25,1 von 30 (7,0 + 7,1 + 11,0 — keine Zuordnung doppelt), Kraft 0/2 (2/8 zählt nicht als erledigt)
  const lauf = page.locator('[data-sum="lauf"]');
  ok((await lauf.textContent()).includes("25,1 / 30") && (await lauf.locator("progress").getAttribute("value")) === "25.1" && (await lauf.locator("progress").getAttribute("max")) === "30",
    `Summen: Laufvolumen als <progress> (Punkt im Attribut, Komma im Text): ${(await lauf.textContent()).trim()}`);
  ok((await page.locator('[data-sum="kraft"]').textContent()).includes("0 / 2"), "Summen: Kraft 0 / 2 Einheiten");
  ok((await styleAttrCount(page)) === 0, "Woche mit allen Zuständen: kein style-Attribut im Markup (C5)");
  await noHScroll(page, "Woche 8");
  ok(errors.length === 0, "Woche 8: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 3c. Woche ohne Details: "Tagesdetails folgen" (Stride E4, neu; planunabhängige Fixtures, Auflage C8) ----
// Das Re-Kalibrierungsdatum aus dem Plan-Objekt (früher Heute, Szenario 2c) wohnt jetzt hier.
for (const [recal, wantText, notText, label] of [
  [["2026-09-30"], ["am 30.09. stehen hier die Einheiten", "Geplant sind 32 km"], [], "mit künftigem Datum"],
  [["2026-10-28", "2026-11-22"], ["Re-Kalibrierung am 28.10. stehen"], ["22.11."], "Re-Kalibrierung 28.10. (nächstes Datum, nicht das spätere)"],
  [[], ["Nach der Re-Kalibrierung stehen hier die Einheiten", "Geplant sind 32 km"], [" am "], "ohne Datum"],
  [["2026-09-01"], ["Nach der Re-Kalibrierung stehen hier die Einheiten"], [" am ", "01.09."], "nur vergangenes Datum"],
]) {
  scenario("3c");
  const { page, ctx, errors } = await newPage({ now: "2026-09-16T09:00:00Z" }); // Mi W3
  await routePlan(ctx, placeholderPlanJSON(recal));
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await page.waitForSelector('[data-card="week-placeholder"]');
  const card = await page.textContent('[data-card="week-placeholder"]');
  ok(card.includes("Tagesdetails folgen") && wantText.every((t) => card.includes(t)) && notText.every((t) => !card.includes(t)),
    `Platzhalterwoche (${label}): "${card.replace(/\s+/g, " ").trim()}"`);
  ok((await page.locator('[data-card="week-sums"], [data-card="days"]').count()) === 0 && (await weekTitle(page)) === "Woche 3",
    `Platzhalterwoche (${label}): keine Summen-Karte, keine Tagesliste, Kopf bleibt`);
  if (label === "mit künftigem Datum") {
    ok((await page.locator('[data-action="week-prev"]').isDisabled()) === false && (await page.locator('[data-action="week-next"]').isDisabled()) === false &&
       (await page.locator('[data-action="week-today"]').count()) === 0, "Platzhalterwoche: Pfeile bedienbar, in der aktuellen Woche kein 'Zu heute'");
    await page.click('[data-action="week-next"]');
    await waitWeek(page, 4);
    await page.waitForFunction(() => document.activeElement?.dataset?.action === "week-next");
    ok((await activeAction(page)) === "week-next" && (await page.locator('[data-action="week-today"]').count()) === 1,
      "Platzhalterwoche: Weiterblättern hält den Fokus auf dem Pfeil, 'Zu heute' erscheint");
    ok((await styleAttrCount(page)) === 0, "Platzhalterwoche: kein style-Attribut im Markup (C5)");
    await noHScroll(page, "Platzhalterwoche");
  }
  ok(errors.length === 0, `Platzhalterwoche (${label}): keine Konsolenfehler ` + JSON.stringify(errors));
  await ctx.close();
}

// ---- 4. Kraft eintragen, speichern, nach Reload noch da (Stride E5: Satz für Satz) ----
{
  scenario("4");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);

  ok(JSON.stringify(await setStates(page)) === '["active","open","open"]' && (await nowMode(page)) === "weight" && (await primaryText(page)) === "Satz 1 fertig",
    "Kraft: Satz-für-Satz-Ansicht, drei Sätze (einer aktiv), Gewichts-Modus, Primärbutton 'Satz 1 fertig'");
  await enterValue(page, "kg", "80");
  await enterValue(page, "reps", "9");
  await page.click(PRIMARY);
  ok(JSON.stringify(await setStates(page)) === '["done","active","open"]' && (await setValues(page))[0] === "80 kg × 9" && (await primaryText(page)) === "Satz 2 fertig",
    "Kraft: Satz 1 fertig ('80 kg × 9'), Satz 2 wird aktiv, Primärbutton 'Satz 2 fertig'");
  ok((await stepperNum(page, "kg")) === "80" && (await stepperNum(page, "reps")) === "8",
    "Kraft: Gewicht des vorigen Satzes gilt weiter, Wiederholungen starten wieder beim Startwert");

  // Einzelsätze: Satz 3 bekommt mehr Gewicht
  await page.click(PRIMARY);
  await enterValue(page, "kg", "85");
  await page.click(PRIMARY);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  ok((await primaryText(page)) === "Weiter: Deadlift", "Kraft: Speicher-Rückmeldung, Primärbutton heißt 'Weiter: Deadlift'");
  ok((await kraftMeta(page)) === "1 von 8 erledigt", "Kraft: Fortschritt aktualisiert");
  const doc = await storedLog(page, "2026-09-08", "squats");
  ok(JSON.stringify(doc.sets) === JSON.stringify([{ kg: 80, reps: 9 }, { kg: 80, reps: 8 }, { kg: 85, reps: 8 }]) && doc.topKg === 85 && doc.totalReps === 25,
    "Kraft: gespeichert sind die drei Einzelsätze (80/9, 80/8, 85/8), Summen stimmen " + JSON.stringify(doc));

  // Ohne fertigen Satz gibt es nichts zu speichern: kein "Mit n Sätzen abschließen", kein Speichern-Knopf
  await page.click(PRIMARY);
  ok((await nowSlug(page)) === "deadlift" && (await page.locator('[data-action="finish-early"], [data-action="save"]').count()) === 0,
    "Kraft: leere Übung lässt sich nicht speichern (kein 'Mit n Sätzen abschließen', kein Speichern-Knopf)");
  await shot(page, "04-krafttag");
  await noHScroll(page, "Krafttag");

  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await openKraftViaWeek(page);
  ok((await nowSlug(page)) === "deadlift", "Kraft: nach Reload startet die erste nicht gespeicherte Übung (Deadlift)");
  await page.click('.sd-order__row[data-slug="squats"]');
  ok(JSON.stringify(await setStates(page)) === '["done","done","done"]' && JSON.stringify(await setValues(page)) === '["80 kg × 9","80 kg × 8","85 kg × 8"]',
    "Kraft: Werte nach Reload erhalten (80 kg × 9, 80 kg × 8, 85 kg × 8, alle fertig)");
  ok((await kraftMeta(page)) === "1 von 8 erledigt", "Kraft: Fortschritt nach Reload");
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
  await page.waitForSelector('#strava-slot [data-card="error"][data-source="worker"]');
  ok((await page.textContent("#strava-slot")).includes("Strava noch nicht eingerichtet"),
     "Setup: fehlender Worker wird erklärt statt zu hängen");
  ok((await page.locator('#strava-slot [data-card="error"][role="alert"] button').count()) === 0 &&
     (await page.textContent(`${RUN_HEAD} .sd-target`)).includes("Ziel 6:10–6:35 /km"),
     "Setup: Worker-Fehlerkarte ohne Aktion (Alarm, nichts zu tun), Ziel-Zeile steht im Kopf");
  await shot(page, "08-worker-fehlt");
  await ctx.close();
}

// ---- 10. Übungen anpassen: entfernen, hinzufügen, zurückholen (Stride E5: Anpassen-Ansicht) ----
{
  scenario("10");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  const editRows = (n) => page.locator(".sd-edit__row" + (n === "all" ? "" : ":not(.is-removed)"));
  ok((await page.locator(".sd-order__row").count()) === 8, "Anpassen: Ausgangslage 8 Übungen");

  // Der Primärbutton ist eine sichtbare Hauptaktion, kein weißer Kasten
  const look = await page.locator(PRIMARY).evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    text: el.textContent.trim(),
    w: el.getBoundingClientRect().width,
  }));
  ok(look.bg === "rgb(15, 110, 86)", `Primärbutton: eingefärbt statt weiß (${look.bg})`);
  ok(look.text === "Satz 1 fertig", "Primärbutton: beschriftet, nicht nur ein Symbol");
  ok(look.w > 200, `Primärbutton: volle Breite (${Math.round(look.w)}px)`);

  await page.click('[data-action="toggle-edit"]');
  await page.waitForSelector('[data-card="edit-list"]');
  ok((await page.locator('[data-action="remove-exercise"]').count()) === 8 && (await page.locator('[data-card="now"], .sd-dots').count()) === 0,
    "Anpassen: eigene Ansicht, Entfernen-Knopf je Übung, keine Jetzt-Karte und keine Punkte");

  await page.click('.sd-edit__row[data-slug="deadlift"] [data-action="remove-exercise"]');
  await page.waitForSelector('[data-action="restore-exercise"]');
  ok((await editRows().count()) === 7 && (await editRows("all").count()) === 8,
    "Anpassen: Übung entfernt (bleibt als 'Für heute entfernt' in der Zeile stehen)");

  await page.click('[data-action="quick-add"]');
  await page.fill("#new-ex-name", "Beinpresse");
  await page.fill("#new-ex-soll", "4x10");
  await page.click('[data-action="add-exercise"]');
  await page.waitForSelector('.sd-edit__row[data-slug="beinpresse"]');
  ok((await editRows().count()) === 8, "Anpassen: eigene Übung hinzugefügt");
  ok((await page.textContent('.sd-edit__row[data-slug="beinpresse"] .sd-edit__sub')).includes("4×10"), "Anpassen: Sollvorgabe übernommen");
  ok((await page.locator('.sd-edit__row[data-slug="beinpresse"] .sd-pill--purple').count()) === 1, "Anpassen: als eigene Übung markiert");

  // Doppelte Namen werden abgefangen
  await page.click('[data-action="quick-add"]');
  await page.fill("#new-ex-name", "Beinpresse");
  await page.click('[data-action="add-exercise"]');
  ok((await editRows().count()) === 8 && (await page.textContent('[data-form="add-exercise"] [data-slot="form-error"]')).includes("schon auf der Liste"),
    "Anpassen: doppelte Übung wird abgelehnt (Meldung im Formular)");
  await page.click('[data-action="cancel-add"]');

  await page.click('[data-action="toggle-edit"]');
  await waitKraft(page);
  await shot(page, "11-uebungen-anpassen");
  await noHScroll(page, "Anpassen");

  // In die eigene Übung eintragen und speichern
  await page.click('.sd-order__row[data-slug="beinpresse"]');
  await enterValue(page, "kg", "120");
  await enterValue(page, "reps", "10");
  await finishExercise(page);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  ok((await primaryText(page)).startsWith("Weiter:"), "Speichern: Primärbutton zeigt den erledigten Zustand ('Weiter: …')");
  ok((await page.locator('.sd-order__row.is-done[data-slug="beinpresse"]').count()) === 1, "Speichern: Zeile wird als erledigt markiert");

  // Nach Reload muss die angepasste Liste stehen
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await openKraftViaWeek(page);
  ok((await page.locator('.sd-order__row[data-slug="deadlift"]').count()) === 0, "Anpassen: Entfernung überlebt den Reload");
  await page.click('.sd-order__row[data-slug="beinpresse"]');
  ok((await setValues(page)).every((v) => v === "120 kg × 10") && (await setValues(page)).length === 4, "Anpassen: Werte der eigenen Übung bleiben (4 Sätze, 120 kg × 10)");

  // Zurückholen
  await page.click('[data-action="toggle-edit"]');
  await page.click('[data-action="restore-exercise"]');
  await page.waitForSelector('.sd-edit__row[data-slug="deadlift"] [data-action="remove-exercise"]');
  ok((await editRows().count()) === 9, "Anpassen: Übung zurückgeholt (8 aus dem Plan + die eigene)");

  // Andere Tage bleiben unberührt
  await page.click('[data-action="toggle-edit"]');
  await page.click('[data-action="back"]');
  await openDay(page, "2026-09-10");
  await waitKraft(page);
  ok((await page.locator('.sd-order__row[data-slug="beinpresse"]').count()) === 0, "Anpassen: gilt nur für den bearbeiteten Tag");
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
  await page.waitForSelector('#strava-slot [data-card="error"][data-source="firebase"]');
  const runTxt = await page.textContent("#strava-slot");
  ok(runTxt.includes("Daten-Problem (Firebase)"), "Fehlerquelle: Firestore-Fehler wird nicht als Strava-Problem gezeigt");
  ok(runTxt.includes("Missing or insufficient permissions."), "Fehlerquelle: Originalmeldung sichtbar");
  ok(runTxt.includes("angemeldet"), "Fehlerquelle: Hinweis auf die tatsächliche Ursache");
  ok((await page.locator('#strava-slot [data-action="connect-strava"]').count()) === 0,
     "Fehlerquelle: kein irreführendes 'Neu verbinden' bei Firebase-Fehlern");
  ok((await page.locator('#strava-slot [data-card="error"][role="alert"] [data-action="reload-strava"]').count()) === 1 &&
     (await page.locator('#strava-slot [data-source="strava"]').count()) === 0,
     "Fehlerquelle: Firebase-Karte (Alarm) mit 'Nochmal versuchen', keine Strava-Karte daneben");
  await shot(page, "09-firebase-fehler-lauftag");

  // Krafttag: Meldung muss stehen bleiben, nicht als Toast verschwinden
  await goTab(page, "woche");
  await openDay(page, "2026-09-08");
  await page.waitForSelector('#banner-slot [data-card="load-error"]');
  ok((await page.textContent("#main")).includes("Gespeicherte Sätze nicht geladen"),
     "Krafttag: Ladefehler als dauerhafte Karte");
  ok((await page.locator(".sd-order__row").count()) === 8 && (await primaryText(page)) === "Satz 1 fertig",
     "Krafttag: Eingabe bleibt trotz Fehler möglich (8 Übungen, Satz 1 bedienbar)");
  ok((await page.locator('[data-card="load-error"][role="alert"] [data-action="reload"]').count()) === 1 &&
     (await page.textContent('[data-card="load-error"]')).includes("Missing or insufficient permissions."),
     "Krafttag: Fehlerkarte nennt die Originalmeldung und bietet 'Neu laden' an");
  await page.waitForTimeout(7000); // länger als die Toast-Dauer
  ok((await page.locator('[data-card="load-error"]').count()) === 1, "Krafttag: Meldung verschwindet nicht wieder");
  await shot(page, "10-firebase-fehler-krafttag");
  await ctx.close();
}

// ---- 11. Verschobener Lauf: Mittwoch geplant, Donnerstag gelaufen; Zuordnungs-Sheet (Stride E6) ----
{
  scenario("11");
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await goTab(page, "woche");
  await openDay(page, "2026-09-09"); // Mi = Easy run + 4x20s
  await waitRunSlot(page);
  ok((await page.locator(CMP).count()) === 1 && (await page.locator(`${RUNROW}[data-source="auto"]`).count()) === 1,
     "Verschoben: Lauf wird trotzdem gefunden (Vergleichs-Karte plus Strava-Zeile, automatisch)");
  ok((await page.textContent(`${RUNROW} .sd-linkrow__name`)).includes("Nachgeholt"), "Verschoben: der richtige Lauf (Do 10.09.)");
  const shiftText = (await page.textContent(`${RUNROW} [data-slot="shift-note"]`)).trim();
  ok(shiftText === "nachgeholt · Do, 10.09.", `Verschoben: als nachgeholt ausgewiesen, mit dem tatsächlichen Datum (${shiftText})`);
  ok((await page.locator(`${RUNROW} [data-slot="shift-note"]`).count()) === 1 && (await page.locator("#strava-slot .shifted, #strava-slot .shift-note").count()) === 0,
     "Verschoben: genau eine Notiz in der Strava-Zeile, die alten Klassen sind weg");
  await shot(page, "13-verschobener-lauf");

  // Der Montagslauf darf davon unberührt bleiben
  await page.click('[data-action="back"]');
  await openDay(page, "2026-09-07");
  await waitRunSlot(page);
  ok((await page.textContent(`${CMP} .sd-bigkm`)).includes("8,0") && (await page.locator('[data-slot="shift-note"]').count()) === 0,
     "Verschoben: exakter Treffer bleibt exakt (8,0 km, keine Notiz)");

  // Sheet öffnen: Kopf, Fokus, Auswahl, gesperrte Läufe
  await page.click('[data-action="back"]');
  await openDay(page, "2026-09-09");
  await waitRunSlot(page);
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  ok((await page.textContent("#assignSheetTitle")) === "Lauf für Mi, 09.09." && (await activeEl(page)).id === "assignSheetTitle",
     "Sheet: Titel nennt den Plantag, Fokus liegt auf dem Titel");
  const optTexts = await page.locator(OPTIONS).evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  ok(optTexts.length === 5 && optTexts[0].startsWith("Do, 10.09. · Nachgeholt"), `Auswahl: nächstliegender Lauf zuerst (${optTexts[0]})`);
  ok(optTexts[0].includes("1 Tag später") && !optTexts[0].includes("1 Tage"), `Auswahl: Einzahl bei einem Tag (${optTexts[0]})`);
  ok((await page.locator(`${OPTIONS}.is-selected[aria-checked="true"]`).count()) === 1 &&
     (await page.locator(`${ASSIGN} .sd-option.is-selected`).textContent()).includes("Nachgeholt"),
     "Auswahl: der aktuell zugeordnete Lauf ist gewählt (auch bei automatischer Zuordnung)");
  const taken = await page.locator(`${ASSIGN} .sd-option[aria-disabled="true"]`).evaluateAll((els) =>
    els.map((e) => ({ why: e.querySelector(".sd-option__why")?.textContent, action: e.dataset.action ?? null, tag: e.tagName })));
  ok(taken.length === 3 && taken.every((t) => t.action === null && t.tag === "DIV") &&
     taken.map((t) => t.why).join("|") === "gehört schon zu Mo, 07.09.|gehört schon zu Sa, 05.09.|gehört schon zu Mi, 02.09.",
     `Auswahl: Läufe anderer Plantage sind gesperrt und nennen ihren Tag (${JSON.stringify(taken.map((t) => t.why))})`);
  ok((await page.locator(`${ASSIGN} [data-action="assign-run"]`).count()) === 2, "Auswahl: nur die zwei freien Läufe sind antippbar");
  ok((await page.locator(`${ASSIGN} [data-action="reset-run"]`).count()) === 0 && (await page.locator(`${ASSIGN} [data-action="reload-strava"]`).count()) === 1 &&
     (await page.locator(`${ASSIGN} [data-action="ignore-run"]`).textContent()).trim() === "Kein Lauf an diesem Tag",
     "Sheet: bei automatischer Zuordnung kein 'Automatik zurück', aber 'Neu laden' und 'Kein Lauf an diesem Tag'");
  await noHScroll(page, "Lauf-Auswahl");
  await shot(page, "14-lauf-zuordnen");

  // Schließen: Escape, ×, Backdrop; der Fokus kehrt zur Strava-Zeile zurück
  await page.keyboard.press("Escape");
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  const afterEsc = await activeEl(page);
  ok(afterEsc.card === "strava-run" && afterEsc.action === "pick-run", `Sheet: Escape schließt, Fokus zurück auf die Strava-Zeile (${JSON.stringify(afterEsc)})`);
  ok(await waitSheetHidden(page), "Sheet: nach Escape auch tatsächlich hidden");
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  await page.click("#assignSheetClose");
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  ok((await activeEl(page)).card === "strava-run", "Sheet: das × schließt, Fokus zurück auf die Strava-Zeile");
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  await page.click("#assignBackdrop", { position: { x: 12, y: 12 } });
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  ok((await activeEl(page)).card === "strava-run", "Sheet: Tipp auf den Hintergrund schließt, Fokus zurück auf die Strava-Zeile");

  // Der schon zugeordnete Lauf: Tipp schließt ohne Änderung
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  await page.click(`${ASSIGN} .sd-option.is-selected`);
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  ok((await page.locator(`${RUNROW}[data-source="auto"]`).count()) === 1 && (await page.evaluate(() => localStorage.getItem("test.runlinks"))) === null,
     "Sheet: Tipp auf den schon zugeordneten Lauf ändert nichts und schreibt nichts");

  // Einen anderen Lauf wählen: von Hand, "vorgezogen", Fokus auf der neuen Zeile
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  await page.click(`${ASSIGN} [data-action="assign-run"][data-run="2"]`); // Kurzer Trab, Mo 07.09.
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  ok((await page.locator(`${RUNROW}[data-source="manual"]`).count()) === 1 && (await page.textContent(RUNROW)).includes("von Hand") &&
     (await page.textContent(`${RUNROW} .sd-linkrow__name`)).includes("Kurzer Trab"),
     "Auswahl: manuell zugeordnet (Zeile 'von Hand', neuer Laufname)");
  const early = (await page.textContent(`${RUNROW} [data-slot="shift-note"]`)).trim();
  ok(early === "vorgezogen · Mo, 07.09.", `Auswahl: negativer Abstand heißt 'vorgezogen' (${early})`);
  const afterPick = await activeEl(page);
  ok(afterPick.card === "strava-run" && afterPick.action === "pick-run", `Auswahl: Fokus liegt auf der neu gezeichneten Strava-Zeile (${JSON.stringify(afterPick)})`);

  // Überlebt den Reload; "Automatik zurück" nur bei manueller Zuordnung
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await goTab(page, "woche");
  await openDay(page, "2026-09-09");
  await waitRunSlot(page);
  ok((await page.locator(`${RUNROW}[data-source="manual"]`).count()) === 1, "Zuordnung überlebt den Reload");
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  ok((await page.locator(`${ASSIGN} .sd-option.is-selected`).textContent()).includes("Kurzer Trab") &&
     (await page.locator(`${ASSIGN} [data-action="reset-run"]`).count()) === 1,
     "Sheet: bei manueller Zuordnung ist der Lauf gewählt und 'Automatik zurück' sichtbar");

  // Zurück auf Automatik, Fokus auf der Zeile
  await page.click(`${ASSIGN} [data-action="reset-run"]`);
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  ok((await page.locator(`${RUNROW}[data-source="auto"]`).count()) === 1 && (await page.textContent(`${RUNROW} [data-slot="shift-note"]`)).includes("nachgeholt"),
     "Zurücksetzen: wieder automatisch zugeordnet");
  ok((await activeEl(page)).card === "strava-run", "Zurücksetzen: Fokus auf der neu gezeichneten Strava-Zeile");
  ok((await page.evaluate(() => localStorage.getItem("test.runlinks"))) === "{}", "Zurücksetzen: Zuordnung im Speicher gelöscht");

  // "Kein Lauf an diesem Tag" -> Karte 'Bewusst leer gelassen' -> 'Automatik zurück'
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector(`${ASSIGN}.open`);
  await page.click(`${ASSIGN} [data-action="ignore-run"]`);
  await page.waitForSelector('#strava-slot [data-card="ignored"]');
  ok((await page.textContent('#strava-slot [data-card="ignored"]')).includes("Bewusst leer gelassen") && (await page.locator(CMP).count()) === 0,
     "Ignoriert: Karte 'Bewusst leer gelassen' statt Vergleich");
  await page.waitForSelector(`${ASSIGN}:not(.open)`);
  ok((await activeEl(page)).action === "reset-run", "Ignoriert: Fokus auf 'Automatik zurück' der neuen Karte (der Auslöser existiert nicht mehr)");
  ok((await page.textContent(`${RUN_HEAD} .sd-target`)).includes("Ziel 6:10–6:35 /km"), "Ignoriert: Ziel-Zeile steht wieder im Kopf");
  await page.click('#strava-slot [data-action="reset-run"]');
  await page.waitForSelector(RUNROW);
  ok((await page.locator(`${RUNROW}[data-source="auto"]`).count()) === 1 && (await page.locator(`${RUN_HEAD} .sd-target`).count()) === 0,
     "Ignoriert: 'Automatik zurück' bringt Vergleich und Strava-Zeile wieder, die Ziel-Zeile verschwindet aus dem Kopf");
  ok((await activeEl(page)).action === "pick-run", "Ignoriert: Fokus liegt danach auf der Strava-Zeile, nicht auf body");
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
    if (tab === "woche") {
      // Der Wochenkopf (Markup 10.1) ist eine Titelzeile mit Rundtasten, ohne Markenzeile.
      await page.waitForSelector("#main > header.sd-pagehead > .sd-weekhead h1");
      ok((await page.locator("#main > header.sd-pagehead .sd-brand").count()) === 0 && (await page.locator("#main > header.sd-pagehead .sd-roundbtn").count()) === 2,
        "Kopf woche: Titelzeile 'Woche N' mit zwei Rundtasten, ohne Markenzeile (Markup 10.0/10.1)");
      continue;
    }
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
  await waitWeekRows(page);
  // Die kompakte Woche passt fast auf einen Bildschirm: eine offene Zeile macht sie sicher scrollbar.
  await page.click('.sd-day[data-date="2026-09-08"] [data-action="toggle-day-detail"]');
  const wocheHead = await headTopAfterScroll(page);
  ok(wocheHead.scrolled > 0 && wocheHead.top < 0, `Kopf Woche: scrollt mit weg (top ${Math.round(wocheHead.top)}, gescrollt ${wocheHead.scrolled})`);
  await openDay(page, "2026-09-08"); // Krafttag
  await waitKraft(page);
  const kraftHead = await headTopAfterScroll(page);
  ok(kraftHead.scrolled > 0 && kraftHead.top < 0, `Kopf Kraft-Tag: scrollt mit weg (top ${Math.round(kraftHead.top)})`);
  await page.click('[data-action="back"]');
  await waitWeekRows(page);
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
  await waitKraft(page);
  ok((await page.locator("#app.is-detail").count()) === 1 && !(await page.locator("#tabbar").isVisible()),
     "Kraft-Tag: Tableiste ausgeblendet (#app.is-detail)");
  await page.click('[data-action="back"]');
  await waitWeekRows(page);
  ok((await page.locator("#app.is-detail").count()) === 0 && (await page.locator("#tabbar").isVisible()),
     "Zurück vom Kraft-Tag: Tableiste wieder sichtbar");
  await openDay(page, "2026-09-09"); // Lauftag
  await page.waitForSelector("#strava-slot");
  ok((await page.locator("#app.is-detail").count()) === 1 && !(await page.locator("#tabbar").isVisible()),
     "Lauf-Tag: Tableiste ausgeblendet");
  await page.click('[data-action="back"]');
  await waitWeekRows(page);
  ok((await page.locator("#tabbar").isVisible()), "Zurück vom Lauf-Tag: Tableiste wieder sichtbar");
  await ctx.close();
}

// ---- 13. Progression aus den Wiederholungen statt RPE (Stride E5: Chip, Startwerte, Letztes Mal, Strava-Zeile) ----
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
  await openKraftViaWeek(page);
  await page.waitForSelector('[data-card="now"] .sd-tip');
  const chip = async (slug) => {
    await page.click(`.sd-order__row[data-slug="${slug}"]`);
    const el = page.locator('[data-card="now"] .sd-tip');
    return (await el.count()) ? { text: (await el.textContent()).trim(), cls: await el.getAttribute("class") } : null;
  };

  const squats = await chip("squats");
  ok(squats?.text === "Heute 85 kg" && squats.cls.includes("sd-tip--up"),
     `Progression: Spanne ausgeschöpft -> mehr Gewicht, als Steigerung eingefärbt (${squats?.text})`);
  ok((await stepperNum(page, "kg")) === "85" && (await stepperNum(page, "reps")) === "10",
     "Startwerte (F4): vorgeschlagenes Gewicht und Wiederholungen der letzten Einheit stehen schon im Stepper");
  ok((await page.textContent('[data-card="now"] .sd-last')).trim() === "Letztes Mal 3×10 · 80 kg", "Letztes Mal: '3×10 · 80 kg'");

  const dl = await chip("deadlift");
  ok(dl?.text === "Heute 95 kg" && dl.cls.includes("sd-tip--down"), `Progression: unter dem Soll erkannt, als Rücknahme eingefärbt (${dl?.text})`);

  const kz = await chip("klimmzuege");
  ok(kz && !kz.text.includes("kg") && (await nowMode(page)) === "reps",
     `Progression: Körpergewichtsübung ohne Gewichtsvorschlag, Wdh-Modus (${kz?.text})`);

  ok((await chip("brustpresse")) === null, "Progression: ohne Vorgeschichte kein Vorschlag");

  // Herzfrequenz und Dauer der Einheit aus Strava (F7)
  await page.waitForSelector('[data-card="strava-session"]');
  const sess = (await page.textContent('[data-card="strava-session"]')).replace(/\s+/g, " ");
  ok(sess.includes("64 min") && sess.includes("Ø 118 bpm") && sess.includes("max 155 bpm"), `Einheit: Dauer und Herzfrequenz aus Strava (${sess.trim()})`);
  ok(sess.includes("Relative Effort 15"), "Einheit: Relative Effort angezeigt");
  ok((await page.locator('[data-card="strava-session"] button, [data-card="strava-session"] a').count()) === 0, "Einheit: Strava-Zeile ist nicht antippbar");
  await noHScroll(page, "Progression");
  await shot(page, "16-progression");

  // Kein RPE-Feld: pro Satz nur Gewicht und Wiederholungen
  await page.click('.sd-order__row[data-slug="squats"]');
  ok((await page.locator(".sd-set--active .sd-stepper").count()) === 2 && (await page.locator("input").count()) === 0,
     "Progression: keine zusätzliche Eingabe nötig (zwei Stepper, kein Textfeld)");
  ok(errors.length === 0, "Progression: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 14. Übung im Gym ersetzen und schnell ergänzen (Stride E5: beides im Anpassen-Modus) ----
{
  scenario("14");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  const editSlugs = () => page.locator(".sd-edit__row").evaluateAll((els) => els.map((e) => e.dataset.slug));

  // Hinzufügen gibt es nur im Anpassen-Modus, nicht mehr in der Normalansicht
  ok((await page.locator('[data-action="quick-add"]').count()) === 0, "Ergänzen: in der Normalansicht kein '+ Übung hinzufügen' mehr");
  await page.click('[data-action="toggle-edit"]');
  ok((await page.locator('[data-action="quick-add"]').count()) === 1, "Ergänzen: der Knopf steht im Anpassen-Modus unter der Liste");
  await page.click('[data-action="quick-add"]');
  await page.fill("#new-ex-name", "Beinpresse");
  await page.fill("#new-ex-soll", "4x10");
  await page.click('[data-action="add-exercise"]');
  await page.waitForSelector('.sd-edit__row[data-slug="beinpresse"]');
  const order = await editSlugs();
  ok(order.length === 9, "Ergänzen: Übung ist da");
  ok(order[order.length - 1] === "beinpresse", "Ergänzen: neue Übung hängt hinten an");

  // Ersetzen: Bank belegt, also Brustpresse gegen Kurzhantelbank tauschen
  await page.click('.sd-edit__row[data-slug="brustpresse"] [data-action="replace-exercise"]');
  await page.waitForSelector("#rep-ex-name");
  ok((await page.inputValue("#rep-ex-soll")) === "3x8-10", "Ersetzen: Sollvorgabe wird übernommen");
  await page.fill("#rep-ex-name", "Kurzhantelbank");
  await page.click('[data-action="confirm-replace"]');
  await page.waitForSelector('.sd-edit__row[data-slug="kurzhantelbank"]');

  const after = await editSlugs();
  ok(!after.includes("brustpresse"), "Ersetzen: alte Übung ist weg");
  ok(after.indexOf("kurzhantelbank") === order.indexOf("brustpresse"),
     `Ersetzen: neue Übung steht an derselben Stelle (${after.indexOf("kurzhantelbank")})`);
  await page.click('[data-action="toggle-edit"]');
  await page.click('.sd-order__row[data-slug="kurzhantelbank"]');
  ok((await page.textContent(".sd-now__soll")).includes("Ersetzt Brustpresse"), "Ersetzen: Herkunft bleibt sichtbar ('Ersetzt Brustpresse')");
  await shot(page, "17-uebung-ersetzen");
  await noHScroll(page, "Ersetzen");

  // Überlebt den Reload
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await openKraftViaWeek(page);
  ok((await page.locator('.sd-order__row[data-slug="brustpresse"]').count()) === 0 && (await page.locator('.sd-order__row[data-slug="kurzhantelbank"]').count()) === 1,
     "Ersetzen: überlebt den Reload");

  // Tausch rückgängig -> Original kommt zurück
  await page.click('[data-action="toggle-edit"]');
  await page.click('.sd-edit__row[data-slug="kurzhantelbank"] [data-action="remove-exercise"]');
  await page.waitForSelector('.sd-edit__row[data-slug="brustpresse"] [data-action="remove-exercise"]');
  ok((await page.locator('.sd-edit__row[data-slug="kurzhantelbank"]').count()) === 0,
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
    ["Krafttag", async () => { await goTab(page, "woche"); await openDay(page, "2026-09-08"); await waitKraft(page); }],
    ["Direkte Eingabe (V1)", async () => { await page.click('.sd-set--active [data-action="edit-value"][data-field="kg"]'); await page.waitForSelector(".sd-stepper__input"); }],
    ["Übung hinzufügen", async () => { await page.click('[data-action="toggle-edit"]'); await page.click('[data-action="quick-add"]'); await page.waitForSelector("#new-ex-name"); }],
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
  await waitKraft(page);
  await enterValue(page, "kg", "80");
  await enterValue(page, "reps", "9");
  await finishExercise(page);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  const kopieDoc = await storedLog(page, "2026-09-08", "squats");
  ok((await primaryText(page)) === "Weiter: Deadlift" && kopieDoc?.week === 2 && kopieDoc.sets.length === 3, "Plan-404 mit Kopie: Satz-Logging funktioniert");
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
  await waitWeekRows(page);
  ok((await weekTitle(page)) === "Woche 1", "Vor Planstart: Wochen-Tab zeigt Woche 1, nicht Woche 35");

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
  // Lauf-Tag (Stride E6): das Öffnen nutzt den Zwischenspeicher, kein zweiter Abruf; erst 'Neu laden' holt neu
  await page.click(`${TODAY} [data-action="open-day"]`);
  await waitRunSlot(page);
  ok(activityCalls === 1, `loadStrava: der Lauf-Tag öffnet ohne zweiten Abruf (${activityCalls})`);
  await page.click(`${RUNROW}[data-action="pick-run"]`);
  await page.waitForSelector("#assignSheet.open");
  await page.click('#assignSheet [data-action="reload-strava"]');
  await page.waitForSelector('#assignSheet [data-action="reload-strava"]:not([disabled])');
  ok(activityCalls === 2 && (await sheetIsOpen(page)), `loadStrava: 'Neu laden' im Sheet ruft genau einmal neu ab und lässt das Sheet offen (${activityCalls})`);
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

  // Lauf-Tag (Stride E6): derselbe Abruffehler als Strava-Karte mit beiden Aktionen, Ziel im Kopf
  await goTab(page, "woche");
  await openDay(page, "2026-09-16"); // Mi = Easy run + 4x20s
  await page.waitForSelector('#strava-slot [data-card="error"][data-source="strava"]');
  ok((await page.locator('#strava-slot [data-card="error"][role="alert"] [data-action="reload-strava"]').count()) === 1 &&
     (await page.locator('#strava-slot [data-card="error"] [data-action="connect-strava"]').count()) === 1 &&
     (await page.locator('#strava-slot [data-source="firebase"]').count()) === 0,
     "Lauf-Tag bei Abruffehler: Strava-Karte (Alarm) mit 'Nochmal versuchen' und 'Neu verbinden'");
  ok((await page.textContent(`${RUN_HEAD} .sd-target`)).includes("Ziel 6:10–6:35 /km") && (await page.locator(CMP).count()) === 0,
     "Lauf-Tag bei Abruffehler: Ziel-Zeile im Kopf, kein Vergleich");
  // 'Nochmal versuchen': Platzhalter während des Abrufs, danach wieder die Karte; Fokus auf dem Titel
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", async (r) => {
    await new Promise((res) => setTimeout(res, 500));
    r.fulfill({ status: 500, body: "boom" });
  });
  await page.click('#strava-slot [data-action="reload-strava"]');
  await page.waitForSelector('#strava-slot [data-card="loading"][aria-busy="true"]');
  ok((await activeEl(page)).tag === "H1", "Lauf-Tag bei Abruffehler: Fokus wandert beim Neu-Laden auf den Titel");
  await page.waitForSelector('#strava-slot [data-card="error"][data-source="strava"]');
  ok((await activeEl(page)).tag === "H1" && (await page.locator('#strava-slot [data-card="loading"]').count()) === 0,
     "Lauf-Tag bei Abruffehler: nach dem Abruf wieder die Fehlerkarte, Fokus bleibt auf dem Titel");
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
  await waitWeekRows(page);
  ok((await weekTitle(page)) === "Woche 10", "W9-Test: Woche 10 aktuell");
  await page.click('[data-action="week-prev"]');
  await waitWeek(page, 9);
  await page.waitForSelector('[data-card="week-sums"]');
  const names = await page.locator(".sd-day__title").allTextContents();
  ok(names.some((n) => n.startsWith("Kalibrierungstest")), `W9: Kalibrierungstest in der Tagesliste (${names.join(", ")})`);
  const wed = page.locator('.sd-day[data-date="2026-10-28"]');
  const opt = page.locator('.sd-day[data-date="2026-10-29"]');
  ok(names.includes("Full Body B") && (await opt.locator(".sd-day__sub").textContent()).includes("Optional"), "W9: Do-Kraft als optional gekennzeichnet");
  ok(!(await wed.textContent()).includes("verpasst"), "W9: Kalibrierungstest erledigt, nicht verpasst");
  ok((await wed.locator(".sd-day__status .sd-check").count()) === 1 && (await wed.locator(".sd-day__status .sd-pill").count()) === 0,
    "W9: Kalibrierungstest mit hoher HF zeigt Haken statt 'HF zu hoch'-Pille");
  ok(JSON.stringify(await rowPills(opt)) === '["optional"]' && (await opt.locator(".sd-pill--danger").count()) === 0,
    "W9: vergangene, nicht erledigte optionale Kraft ist neutral ('optional'), nicht 'verpasst'");
  const tue = page.locator('.sd-day[data-date="2026-10-27"]');
  ok(JSON.stringify(await rowPills(tue)) === '["verpasst"]', "W9: nicht erledigte Pflicht-Kraft bleibt 'verpasst'");
  ok((await page.textContent('[data-sum="kraft"]')).includes("0 / 1"), "W9: optionale Kraft zählt nicht im Wochensoll (0 / 1)");
  await wed.locator('[data-action="toggle-day-detail"]').click();
  ok((await wed.locator(".sd-day__detail").textContent()).includes("Ø Pace und Ø HF der 30 min notieren"), "W9: Hinweis zum Kalibrierungstest in den Details");
  await opt.locator('[data-action="toggle-day-detail"]').click();
  ok((await opt.locator(".sd-day__detail").textContent()).includes("weder im Wochensoll noch als verpasst"), "W9: Details erklären 'optional'");
  ok((await openRows(page)) === 1, "W9: nach dem zweiten Aufklappen ist genau eine Zeile offen");
  await shot(page, "24-woche-9");
  await noHScroll(page, "Woche 9");

  // Woche 35 per Vorwärts-Blättern erreichbar, danach kein Weiter mehr
  await page.click('[data-action="week-today"]');
  for (let i = 10; i < 35; i++) await page.click('[data-action="week-next"]');
  await waitWeek(page, 35);
  ok(await page.locator('[data-action="week-next"]').isDisabled(), "Woche 35: kein Weiter (Pfeil gesperrt)");
  await page.waitForFunction(() => document.activeElement?.dataset?.action === "week-prev");
  ok((await activeAction(page)) === "week-prev", "Woche 35: der gesperrte Pfeil gibt den Fokus an den anderen Pfeil ab");
  ok((await weekSub(page)).includes("26. April–2. Mai"), `Woche 35: 26. April–2. Mai (${await weekSub(page)})`);
  ok((await page.textContent('[data-card="week-placeholder"]')).includes("Tagesdetails folgen"), "Woche 35: Platzhalterkarte");

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

// ============================================================================
// 36. Kraft-Tag "Fokus" (Stride E5a, neu). Markup: docs/ui-markup-stride.md Abschnitt 11.
// ============================================================================

// ---- 36a. Satz für Satz durch den ganzen Tag, Training abschließen -> zurück zur Herkunft (Heute UND Woche) ----
for (const origin of ["Heute", "Woche"]) {
  scenario("36a");
  const { page, ctx, errors } = await newPage();
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  if (origin === "Heute") {
    await page.waitForSelector(TODAY);
    await page.click(`${TODAY} [data-action="open-day"]`);
    await waitKraft(page);
  } else {
    await openKraftViaWeek(page);
  }
  const tag = `Satz-Ablauf (von ${origin})`;
  ok((await page.locator('#app.is-detail').count()) === 1 && !(await page.locator("#tabbar").isVisible()), `${tag}: Tableiste ausgeblendet`);
  ok((await page.textContent('#main > header.sd-pagehead [data-action="back"]')).trim() === origin, `${tag}: Zurück heißt '${origin}'`);

  await page.click(PRIMARY);
  ok(JSON.stringify(await setStates(page)) === '["done","active","open"]' && (await primaryText(page)) === "Satz 2 fertig" && (await activeAction(page)) === "finish-set",
     `${tag}: Satz 1 fertig -> Satz 2 aktiv, Fokus bleibt auf dem Primärbutton`);
  await page.click(PRIMARY);
  ok(JSON.stringify(await setStates(page)) === '["done","done","active"]' && (await primaryText(page)) === "Satz 3 fertig", `${tag}: Satz 2 fertig -> Satz 3 aktiv`);
  await page.click(PRIMARY);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  ok(JSON.stringify(await setStates(page)) === '["done","done","done"]' && (await primaryText(page)) === "Weiter: Deadlift" && (await page.textContent('[data-card="now"] .sd-eyebrow')).includes("Erledigt"),
     `${tag}: nach dem letzten Satz gespeichert, Eyebrow 'Erledigt', Primärbutton 'Weiter: Deadlift'`);
  ok((await storedLogKeys(page)).join() === "2026-09-08_squats" && (await kraftMeta(page)) === "1 von 8 erledigt", `${tag}: genau ein Dokument geschrieben, Zähler 1 von 8`);

  const weiter = [];
  for (let i = 0; i < 7; i++) {
    weiter.push(await primaryText(page));
    await page.click(PRIMARY);
    await finishExercise(page);
  }
  ok(weiter[0] === "Weiter: Deadlift" && weiter[1] === "Weiter: Nordic hamstring curl" && weiter[6] === "Weiter: Planks (wechselnd)" && weiter.length === 7,
     `${tag}: 'Weiter: …' führt durch alle 8 Übungen in Plan-Reihenfolge (${weiter.join(" | ")})`);
  ok((await primaryText(page)) === "Training abschließen" && (await primaryAction(page)) === "finish-session", `${tag}: nach der letzten Übung heißt der Primärbutton 'Training abschließen'`);
  ok((await page.textContent('[data-card="all-done"]')).includes("Alle 8 Übungen erfasst") && (await kraftMeta(page)) === "8 von 8 erledigt" && (await storedLogKeys(page)).length === 8,
     `${tag}: Karte 'Alle 8 Übungen erfasst', Zähler 8 von 8, 8 Dokumente`);
  ok(await waitLive(page, "Alle Übungen erfasst."), `${tag}: Live-Region meldet 'Alle Übungen erfasst.'`);

  await page.click(PRIMARY);
  if (origin === "Heute") {
    await page.waitForSelector(TODAY);
    ok((await page.locator("#app.is-detail").count()) === 0 && (await page.locator("#tabbar").isVisible()) && (await page.locator("#tabbar button.active").getAttribute("data-tab")) === "dashboard",
       `${tag}: Training abschließen führt zurück zu Heute (Tab-Leiste wieder da)`);
  } else {
    await waitWeekRows(page);
    ok((await weekTitle(page)) === "Woche 2" && (await page.locator("#tabbar button.active").getAttribute("data-tab")) === "woche",
       `${tag}: Training abschließen führt zurück zur Woche`);
  }
  ok(errors.length === 0, `${tag}: keine Konsolenfehler ` + JSON.stringify(errors));
  await ctx.close();
}

// ---- 36b. Fokus wechseln: per Liste und per Fortschrittspunkt, Seite springt nicht, Eingaben bleiben ----
{
  scenario("36b");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  const planOrder = await orderSlugs(page);
  await page.click(PRIMARY); // Squats: Satz 1 fertig

  const before = await page.evaluate(() => { const m = document.getElementById("main"); m.scrollTop = 150; return m.scrollTop; });
  await page.dispatchEvent('.sd-order__row[data-slug="klimmzuege"]', "click");
  const afterRow = await page.evaluate(() => document.getElementById("main").scrollTop);
  ok((await nowSlug(page)) === "klimmzuege" && (await page.locator(".sd-order__row.is-current").count()) === 1 &&
     (await page.getAttribute(".sd-order__row.is-current", "data-slug")) === "klimmzuege" && (await page.getAttribute(".sd-order__row.is-current", "aria-current")) === "true",
     "Fokus: Tipp auf eine Zeile macht die Übung zur Jetzt-Übung (genau eine aktuelle Zeile, aria-current)");
  ok(before > 0 && afterRow === before, `Fokus: die Seite springt nicht (scrollTop ${before} -> ${afterRow})`);
  ok(await page.evaluate(() => document.activeElement?.classList.contains("sd-order__row") && document.activeElement.dataset.slug === "klimmzuege"),
     "Fokus: nach dem Tipp bleibt der Fokus auf der getippten Zeile");
  ok(JSON.stringify(await orderSlugs(page)) === JSON.stringify(planOrder), "Fokus: Plan-Reihenfolge der Liste bleibt unverändert");

  await page.dispatchEvent('.sd-dots__seg[data-slug="brustpresse"]', "click");
  const ds = await dotStates(page);
  ok((await nowSlug(page)) === "brustpresse" && ds[planOrder.indexOf("brustpresse")] === "current" && ds.filter((d) => d === "current").length === 1,
     "Fokus: Tipp auf einen Fortschrittspunkt wechselt die Übung, genau ein aktueller Punkt");
  ok(await page.evaluate(() => document.activeElement?.classList.contains("sd-dots__seg") && document.activeElement.dataset.slug === "brustpresse"),
     "Fokus: nach dem Tipp auf den Punkt bleibt der Fokus auf dem Punkt");
  ok((await page.getAttribute('.sd-dots__seg[data-slug="brustpresse"]', "aria-label")) === "Brustpresse, aktuelle Übung" &&
     (await page.getAttribute('.sd-dots__seg[data-slug="deadlift"]', "aria-label")) === "Deadlift, offen",
     "Fokus: Punkte tragen den Status im aria-label");

  await page.dispatchEvent('.sd-order__row[data-slug="squats"]', "click");
  ok(JSON.stringify(await setStates(page)) === '["done","active","open"]', "Fokus: beim Zurückwechseln ist Satz 1 von Squats noch fertig (nichts ging verloren)");
  ok(errors.length === 0, "Fokus: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 36c. Stepper: Gewicht wirkt auf folgende Sätze, Wdh nur auf den Satz; Schrittweiten und Untergrenze 0 ----
{
  scenario("36c");
  const { page, ctx } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  const step = (field, dir) => page.click(`.sd-set--active [data-action="step"][data-field="${field}"][data-dir="${dir}"]`);

  ok((await page.isDisabled('.sd-set--active [data-action="step"][data-field="kg"][data-dir="-1"]')) && (await stepperNum(page, "kg")) === "0",
     "Stepper: Gewicht startet ohne Historie bei 0, '−' ist gesperrt (Untergrenze 0)");
  await step("kg", 1);
  ok((await stepperNum(page, "kg")) === "2,5", "Stepper: Gewicht ±2,5 kg (0 -> 2,5)");
  await step("kg", 1);
  ok((await stepperNum(page, "kg")) === "5" && JSON.stringify(await setValues(page)) === '["*","5 kg × 8","5 kg × 8"]',
     "Stepper: Gewicht wirkt auf die folgenden Sätze (5 kg in Satz 2 und 3)");
  await step("reps", 1);
  ok((await stepperNum(page, "reps")) === "9" && JSON.stringify(await setValues(page)) === '["*","5 kg × 8","5 kg × 8"]',
     "Stepper: Wiederholungen ±1 und nur für diesen Satz (Satz 2 und 3 bleiben bei 8)");
  await step("reps", -1); await step("reps", -1);
  await page.click(PRIMARY);
  ok((await stepperNum(page, "kg")) === "5" && (await stepperNum(page, "reps")) === "8" && (await setValues(page))[0] === "5 kg × 7",
     "Stepper: Satz 2 startet mit dem Gewicht von Satz 1 und dem Wdh-Startwert; Satz 1 steht bei '5 kg × 7'");
  await step("kg", -1);
  ok(JSON.stringify(await setValues(page)) === '["5 kg × 7","*","2,5 kg × 8"]', "Stepper: Gewicht in Satz 2 ändern lässt fertige Sätze unberührt, wirkt auf Satz 3");

  for (let i = 0; i < 8; i++) await step("reps", -1);
  ok((await stepperNum(page, "reps")) === "0" && (await page.isDisabled('.sd-set--active [data-action="step"][data-field="reps"][data-dir="-1"]')),
     "Stepper: Wiederholungen enden bei 0 ('−' gesperrt)");
  ok((await page.getAttribute('.sd-set--active [data-action="step"][data-field="kg"][data-dir="1"]', "aria-label")) === "Gewicht erhöhen" &&
     (await page.getAttribute('.sd-set--active .sd-stepper--weight', "aria-label")) === "Gewicht in kg" &&
     (await page.getAttribute('.sd-set--active [data-action="edit-value"][data-field="kg"]', "aria-label")) === "Gewicht eintippen, aktuell 2,5 kg",
     "Stepper: Tasten und Gruppe tragen aria-labels");

  // Zeit-Übung: Sekunden ±5, Gruppe "Dauer in Sekunden", kein "+ Gewicht"
  await page.click('.sd-order__row[data-slug="planks-wechselnd"]');
  ok((await nowMode(page)) === "time" && (await page.locator(".sd-set--active .sd-stepper").count()) === 1 && (await stepperNum(page, "sec")) === "30" &&
     (await page.getAttribute(".sd-set--active .sd-stepper", "aria-label")) === "Dauer in Sekunden" && (await page.locator('[data-action="add-weight"]').count()) === 0,
     "Stepper Zeit: ein Stepper in Sekunden (Start 30 s), Gruppe 'Dauer in Sekunden', kein '+ Gewicht'");
  await page.click('.sd-set--active [data-action="step"][data-field="sec"][data-dir="1"]');
  ok((await stepperNum(page, "sec")) === "35" && (await page.getAttribute('.sd-set--active [data-action="step"][data-field="sec"][data-dir="1"]', "aria-label")) === "Sekunden erhöhen",
     "Stepper Zeit: Schritt ±5 s (30 -> 35)");
  for (let i = 0; i < 7; i++) await page.click('.sd-set--active [data-action="step"][data-field="sec"][data-dir="-1"]');
  ok((await stepperNum(page, "sec")) === "0" && (await page.isDisabled('.sd-set--active [data-action="step"][data-field="sec"][data-dir="-1"]')),
     "Stepper Zeit: endet bei 0 s");
  await ctx.close();
}

// ---- 36d. V1 direkte Eingabe: Tipp auf den Wert, Zahlentastatur, >= 16 px, Enter/Fertig/Verlassen/± übernehmen ----
{
  scenario("36d");
  const { page, ctx } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  await page.click('.sd-set--active [data-action="edit-value"][data-field="kg"]');
  const input = await page.locator(".sd-stepper__input").evaluate((el) => ({
    px: parseFloat(getComputedStyle(el).fontSize), mode: el.getAttribute("inputmode"), label: el.getAttribute("aria-label"),
    value: el.value, focused: document.activeElement === el, selected: el.selectionStart === 0 && el.selectionEnd === el.value.length,
  }));
  ok(input.px >= 16 && input.mode === "decimal" && input.label === "Gewicht in kg" && input.focused && input.selected,
     `V1: Feld hat Fokus, Inhalt markiert, inputmode decimal, aria-label, Schrift ${input.px}px (>= 16)`);
  ok((await page.locator('.sd-set__head [data-action="commit-value"]').textContent()).trim() === "Fertig" && (await page.locator(".sd-stepper__input").count()) === 1,
     "V1: im Satzkopf erscheint 'Fertig', es ist nur ein Feld offen");
  await page.fill(".sd-stepper__input", "82,5");
  await page.press(".sd-stepper__input", "Enter");
  ok((await stepperNum(page, "kg")) === "82,5" && (await setValues(page))[1] === "82,5 kg × 8" && (await page.locator(".sd-stepper__input").count()) === 0,
     "V1: Enter übernimmt die Kommazahl (82,5), Feld schließt, Gewicht gilt für Satz 2 und 3");
  ok((await activeAction(page)) === "edit-value" && (await page.evaluate(() => document.activeElement.dataset.field)) === "kg", "V1: nach dem Übernehmen steht der Fokus wieder auf dem Wert");
  await enterValue(page, "kg", "abc");
  ok((await stepperNum(page, "kg")) === "82,5", "V1: ungültige Eingabe lässt den alten Wert stehen");

  await page.click('.sd-set--active [data-action="edit-value"][data-field="reps"]');
  ok((await page.getAttribute(".sd-stepper__input", "inputmode")) === "numeric" && (await page.getAttribute(".sd-stepper__input", "aria-label")) === "Wiederholungen",
     "V1: Wiederholungen mit numerischer Tastatur");
  await page.fill(".sd-stepper__input", "11");
  await page.click('[data-action="commit-value"]');
  ok((await stepperNum(page, "reps")) === "11" && (await activeAction(page)) === "edit-value", "V1: 'Fertig' übernimmt den Wert");

  // Verlassen und Tipp auf ± übernehmen den getippten Wert
  await page.click('.sd-set--active [data-action="edit-value"][data-field="reps"]');
  await page.fill(".sd-stepper__input", "5");
  await page.click('.sd-set--active [data-action="step"][data-field="kg"][data-dir="1"]');
  ok((await stepperNum(page, "reps")) === "5" && (await stepperNum(page, "kg")) === "85", "V1: Tipp auf ± übernimmt zuerst den getippten Wert");
  await page.click('.sd-set--active [data-action="edit-value"][data-field="kg"]');
  await page.fill(".sd-stepper__input", "70");
  await page.click(PRIMARY); // ohne Enter: das Verlassen übernimmt, der Tipp auf "Satz fertig" geht nicht verloren
  ok((await setValues(page))[0] === "70 kg × 5" && JSON.stringify(await setStates(page)) === '["done","active","open"]',
     "V1: 'Satz fertig' direkt aus dem offenen Feld übernimmt den Wert (70 kg × 5), der Tipp geht nicht verloren");
  await page.click('.sd-set--active [data-action="edit-value"][data-field="kg"]');
  await page.press(".sd-stepper__input", "Escape");
  ok((await page.locator(".sd-stepper__input").count()) === 0 && (await stepperNum(page, "kg")) === "70", "V1: Escape schließt das Feld ohne Änderung");
  await ctx.close();
}

// ---- 36e. "+ Gewicht" in einer Nur-Wdh-Übung (E3), Zeit-Übung ohne ----
{
  scenario("36e");
  const { page, ctx } = await newPage();
  await page.addInitScript(() => {
    if (localStorage.getItem("test.logs")) return; // der Init-Skript läuft bei jedem Reload erneut
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-01_klimmzuege": { date: "2026-09-01", exercise: "klimmzuege", completed: true, soll: "3x6-8",
        sets: [{ kg: null, reps: 8 }, { kg: null, reps: 8 }, { kg: 0, reps: 8 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  await page.click('.sd-order__row[data-slug="klimmzuege"]');
  ok((await nowMode(page)) === "reps" && (await page.locator(".sd-set--active .sd-stepper--solo").count()) === 1 && (await page.locator(".sd-set--active .sd-stepper").count()) === 1 &&
     (await page.textContent('.sd-set__head [data-action="add-weight"]')).trim() === "+ Gewicht",
     "+ Gewicht: Übung ohne Gewicht (null und Altbestand 0) zeigt nur Wiederholungen und den Text-Button '+ Gewicht'");
  await page.click('[data-action="add-weight"]');
  ok((await nowMode(page)) === "weight" && (await page.locator(".sd-set--active .sd-stepper").count()) === 2 && (await stepperNum(page, "kg")) === "0" &&
     (await page.getAttribute(".sd-set--active .sd-stepper--weight", "aria-label")) === "Zusatzgewicht in kg" && (await page.locator('[data-action="add-weight"]').count()) === 0,
     "+ Gewicht: Gewichts-Stepper erscheint (Start 0, 'Zusatzgewicht in kg'), der Knopf verschwindet");
  ok((await activeAction(page)) === "edit-value" && (await page.evaluate(() => document.activeElement.dataset.field)) === "kg", "+ Gewicht: Fokus wandert auf den neuen Gewichts-Wert");
  await enterValue(page, "kg", "10");
  await finishExercise(page);
  const doc = await storedLog(page, "2026-09-08", "klimmzuege");
  ok(JSON.stringify(doc.sets) === JSON.stringify([{ kg: 10, reps: 8 }, { kg: 10, reps: 8 }, { kg: 10, reps: 8 }]) && doc.topKg === 10,
     "+ Gewicht: Zusatzgewicht wird mitgespeichert (kg 10 in allen Sätzen) " + JSON.stringify(doc.sets));
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await openKraftViaWeek(page);
  await page.click('.sd-order__row[data-slug="klimmzuege"]');
  ok((await nowMode(page)) === "weight" && JSON.stringify(await setValues(page)) === '["10 kg × 8","10 kg × 8","10 kg × 8"]',
     "+ Gewicht: nach dem Reload bleibt die Übung im Gewichts-Modus (heute mit Gewicht gespeichert)");
  await ctx.close();
}

// ---- 36f. Vorzeitig abschließen: nur die fertigen Sätze, nie Startwerte (Auflage C1) ----
{
  scenario("36f");
  const { page, ctx } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  ok((await page.locator('[data-action="finish-early"]').count()) === 0, "Früh abschließen: ohne fertigen Satz kein Knopf");
  await enterValue(page, "kg", "80");
  await enterValue(page, "reps", "9");
  await page.click(PRIMARY);
  ok((await page.textContent('[data-action="finish-early"]')).trim() === "Mit 1 Satz abschließen", "Früh abschließen: nach einem Satz 'Mit 1 Satz abschließen' (Einzahl)");
  await enterValue(page, "reps", "7");
  await page.click(PRIMARY);
  ok((await page.textContent('[data-action="finish-early"]')).trim() === "Mit 2 Sätzen abschließen", "Früh abschließen: nach zwei Sätzen 'Mit 2 Sätzen abschließen'");
  await page.click('[data-action="finish-early"]');
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  const doc = await storedLog(page, "2026-09-08", "squats");
  ok(JSON.stringify(doc.sets) === JSON.stringify([{ kg: 80, reps: 9 }, { kg: 80, reps: 7 }]) && doc.totalReps === 16 && doc.topKg === 80,
     "Früh abschließen: gespeichert sind genau die 2 fertigen Sätze, der vorbelegte dritte (80 × 8) fehlt " + JSON.stringify(doc.sets));
  ok(JSON.stringify(await setStates(page)) === '["done","done","open"]' && (await primaryText(page)) === "Weiter: Deadlift" && (await kraftMeta(page)) === "1 von 8 erledigt" &&
     (await page.locator('[data-action="finish-early"]').count()) === 0,
     "Früh abschließen: Satz 3 bleibt offen, Primärbutton 'Weiter: Deadlift', Knopf weg, Zähler 1 von 8");
  await page.reload();
  await page.waitForSelector("#tabbar button.active");
  await openKraftViaWeek(page);
  await page.click('.sd-order__row[data-slug="squats"]');
  ok(JSON.stringify(await setStates(page)) === '["done","done","active"]' && (await primaryText(page)) === "Satz 3 fertig",
     "Früh abschließen: wieder geöffnet kommen die 2 gespeicherten Sätze plus der restliche Satz laut Soll");
  ok(JSON.stringify((await storedLog(page, "2026-09-08", "squats")).sets.length) === "2", "Früh abschließen: das Öffnen ändert das gespeicherte Dokument nicht");
  await ctx.close();
}

// ---- 36g. Korrektur (F6): gespeicherte Übung und fertigen Satz wieder öffnen, erneutes Speichern überschreibt ----
{
  scenario("36g");
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  await enterValue(page, "kg", "60");
  await finishExercise(page);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);

  await page.click('[data-action="reopen-set"][data-set="1"]');
  ok(JSON.stringify(await setStates(page)) === '["done","active","done"]' && (await stepperNum(page, "kg")) === "60" && (await stepperNum(page, "reps")) === "8" &&
     (await page.getAttribute('.sd-set--active', "aria-label")) === "Satz 2" && (await activeAction(page)) === "step",
     "Korrektur: Tipp auf den fertigen Satz 2 öffnet ihn wieder (Stepper mit gespeicherten Werten), Fokus im Stepper");
  for (let i = 0; i < 4; i++) await page.click('.sd-set--active [data-action="step"][data-field="reps"][data-dir="1"]');
  ok((await primaryText(page)) === "Satz 2 fertig", "Korrektur: Primärbutton 'Satz 2 fertig'");
  await page.click(PRIMARY);
  await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
  const doc = await storedLog(page, "2026-09-08", "squats");
  ok(doc.sets.length === 3 && doc.sets[1].reps === 12 && doc.totalReps === 28 && (await storedLogKeys(page)).filter((k) => k.endsWith("_squats")).length === 1,
     "Korrektur: erneutes Speichern überschreibt dasselbe Dokument (Satz 2 jetzt 12 Wdh, ein Dokument) " + JSON.stringify(doc.sets));
  ok((await primaryText(page)) === "Weiter: Deadlift" && (await kraftMeta(page)) === "1 von 8 erledigt", "Korrektur: danach wieder 'Weiter: Deadlift', Zähler unverändert");

  // gespeicherte Übung per Liste und per Punkt wieder zur Jetzt-Übung machen
  await page.click('.sd-order__row[data-slug="deadlift"]');
  ok((await dotStates(page))[0] === "done" && (await page.getAttribute('.sd-dots__seg[data-slug="squats"]', "aria-label")) === "Squats, erledigt",
     "Korrektur: erledigte Übung ist im Punkt als erledigt markiert (aria-label 'Squats, erledigt')");
  await page.click('.sd-dots__seg[data-slug="squats"]');
  ok((await nowSlug(page)) === "squats" && (await page.textContent('[data-card="now"] .sd-eyebrow')).includes("Erledigt") && (await dotStates(page))[0] === "current" &&
     (await page.getAttribute('.sd-dots__seg[data-slug="squats"]', "aria-label")) === "Squats, aktuelle Übung, erledigt",
     "Korrektur: Tipp auf den erledigten Punkt macht Squats wieder aktuell (Eyebrow 'Erledigt', aria-label '… aktuelle Übung, erledigt')");
  await page.click('.sd-order__row[data-slug="deadlift"]');
  await page.click('.sd-order__row[data-slug="squats"]');
  ok((await nowSlug(page)) === "squats" && (await page.locator('.sd-order__row.is-current.is-done[data-slug="squats"]').count()) === 1,
     "Korrektur: Tipp auf die erledigte Zeile macht sie wieder aktuell (is-current + is-done)");
  ok(errors.length === 0, "Korrektur: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 36h. Firestore-Stub-Write gleich dem Vorher-Payload (Auflage C1, Fixture kraft-payload-before.json) ----
{
  scenario("36h");
  const FIX = JSON.parse(readFileSync(new URL("./fixtures/kraft-payload-before.json", import.meta.url), "utf8"));
  const { page, ctx, errors } = await newPage();
  await page.addInitScript(() => {
    // Körpergewicht: letzte Einheit ohne Gewicht -> Wdh-Modus (F5). Eigene Übung über die Tagesanpassung.
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-01_klimmzuege": { date: "2026-09-01", exercise: "klimmzuege", completed: true, soll: "3x6-8",
        sets: [{ kg: null, reps: 6 }, { kg: null, reps: 6 }, { kg: null, reps: 6 }] },
    }));
    localStorage.setItem("test.dayplan.2026-09-08", JSON.stringify({ removed: [], added: [{ name: "Beinpresse", soll: "4x10", hint: "Eigene Übung" }] }));
  });
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  for (const c of FIX.cases) {
    const slug = c.docId.replace(/^logs\/\d{4}-\d{2}-\d{2}_/, "");
    await page.click(`.sd-order__row[data-slug="${slug}"]`);
    await page.waitForSelector(`[data-card="now"][data-slug="${slug}"]`);
    const modeOk = (await nowMode(page)) === c.mode;
    for (const set of c.input.sets) {
      if (c.mode === "weight" && set.kg > 0) await enterValue(page, "kg", String(set.kg).replace(".", ","));
      await enterValue(page, c.mode === "time" ? "sec" : "reps", String(set.reps));
      await page.click(PRIMARY);
    }
    await page.waitForSelector(`${PRIMARY}:not([disabled])`);
    const doc = await storedLog(page, "2026-09-08", slug);
    const expected = c.after ?? c.before;
    const { date, exercise, ...rest } = doc ?? {};
    ok(modeOk && doc && (await storedLogKeys(page)).includes(c.docId.replace(/^logs\//, "")) && date === "2026-09-08" && exercise === slug,
       `Payload '${c.label}': Modus ${c.mode}, gleiche Doc-ID (${c.docId}), date und exercise gesetzt`);
    ok(JSON.stringify(Object.keys(doc ?? {})) === JSON.stringify(["date", "exercise", ...Object.keys(expected)]) && JSON.stringify(rest) === JSON.stringify(expected),
       `Payload '${c.label}': gleiche Feldnamen in gleicher Reihenfolge und gleiche Werte ${JSON.stringify(rest)}`);
  }
  ok(errors.length === 0, "Payload: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 36i. Speichern: "Speichert …", optimistisch, Rücknahme bei Fehler (sofort und spät) ----
{
  scenario("36i");
  // A: der Schreibvorgang scheitert sofort
  {
    const { page, ctx } = await newPage();
    await page.addInitScript(() => { window.__SAVE_FAIL__ = "Kaputt"; });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await enterValue(page, "kg", "80");
    for (let i = 0; i < 3; i++) await page.click(PRIMARY);
    await page.waitForSelector('[data-slot="save-error"]');
    ok((await page.textContent('[data-slot="save-error"]')).includes("Nicht gespeichert: Kaputt") && (await page.getAttribute('[data-slot="save-error"]', "role")) === "alert",
       "Rücknahme: Fehler steht als Meldung in der Karte (role=alert, mit Originaltext)");
    ok(JSON.stringify(await setStates(page)) === '["done","done","active"]' && (await primaryText(page)) === "Satz 3 fertig",
       "Rücknahme: der letzte Satz ist wieder aktiv, Primärbutton 'Satz 3 fertig'");
    ok((await kraftMeta(page)) === "0 von 8 erledigt" && (await dotStates(page))[0] === "current" && !(await storedLogKeys(page)).length,
       "Rücknahme: nichts als gespeichert gezählt, Punkt nicht erledigt, kein Dokument geschrieben");
    ok((await page.textContent("#toast.error")).includes("Speichern fehlgeschlagen"), "Rücknahme: zusätzlich der Fehler-Toast");
    await page.evaluate(() => { window.__SAVE_FAIL__ = null; });
    await page.click(PRIMARY);
    await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
    ok((await page.locator('[data-slot="save-error"]').count()) === 0 && (await storedLogKeys(page)).length === 1 && (await kraftMeta(page)) === "1 von 8 erledigt",
       "Rücknahme: erneuter Versuch klappt, Meldung weg, ein Dokument");
    await ctx.close();
  }
  // B: "Speichert …" solange das Schreiben dauert
  {
    const { page, ctx } = await newPage();
    await page.addInitScript(() => { window.__SAVE_DELAY__ = 500; });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    for (let i = 0; i < 3; i++) await page.click(PRIMARY);
    ok((await primaryText(page)) === "Speichert …" && (await page.isDisabled(PRIMARY)) && (await page.getAttribute(PRIMARY, "aria-busy")) === "true",
       "Speichert: Primärbutton 'Speichert …' ist gesperrt und aria-busy");
    await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
    ok((await primaryText(page)) === "Weiter: Deadlift", "Speichert: danach 'Weiter: Deadlift'");
    await ctx.close();
  }
  // C: Offline-Cache: nach 800 ms gilt die Übung optimistisch als gespeichert, ein späterer Fehler nimmt sie zurück
  {
    const { page, ctx } = await newPage();
    await page.addInitScript(() => { window.__SAVE_DELAY__ = 1400; window.__SAVE_FAIL__ = "Spät"; });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    for (let i = 0; i < 3; i++) await page.click(PRIMARY);
    await page.waitForSelector(`${NOW} [data-action="next-exercise"]`);
    ok((await kraftMeta(page)) === "1 von 8 erledigt", "Optimistisch: nach dem Zeitfenster gilt die Übung als gespeichert (Offline-Cache wartet nicht)");
    await page.waitForSelector('[data-slot="save-error"]', { timeout: 4000 });
    ok((await kraftMeta(page)) === "0 von 8 erledigt" && (await page.textContent('[data-slot="save-error"]')).includes("Spät") && (await primaryText(page)) === "Satz 3 fertig",
       "Optimistisch: der späte Fehler nimmt alles zurück (0 von 8, Meldung, Satz 3 wieder aktiv)");
    await ctx.close();
  }
}

// ---- 36j. Live-Region #kraftLive: außerhalb des neu gezeichneten #main, Text kommt erst nach dem Einfügen ----
{
  scenario("36j");
  const { page, ctx } = await newPage();
  await page.goto(BASE + "/index.html");
  await openKraftViaWeek(page);
  const live = await page.evaluate(() => {
    const el = document.getElementById("kraftLive");
    return { exists: !!el, role: el?.getAttribute("role"), polite: el?.getAttribute("aria-live"), inMain: !!document.querySelector("#main #kraftLive"), text: el?.textContent };
  });
  ok(live.exists && live.role === "status" && live.polite === "polite" && !live.inMain && live.text === "",
     "Live-Region: #kraftLive (role=status, polite) liegt außerhalb von #main und startet leer");
  await page.click(PRIMARY);
  ok(await waitLive(page, "Satz 1 fertig. Als Nächstes Satz 2."), "Live-Region: nach 'Satz 1 fertig' -> 'Satz 1 fertig. Als Nächstes Satz 2.'");
  await page.click(PRIMARY);
  await page.click(PRIMARY);
  ok(await waitLive(page, "Squats gespeichert. Als Nächstes Deadlift."), "Live-Region: nach dem Speichern -> 'Squats gespeichert. Als Nächstes Deadlift.'");
  await page.click('.sd-order__row[data-slug="klimmzuege"]');
  ok(await waitLive(page, "Jetzt: Klimmzüge."), "Live-Region: nach dem Wechsel -> 'Jetzt: Klimmzüge.'");
  ok((await page.evaluate(() => document.getElementById("kraftLive").isConnected && document.querySelectorAll("#kraftLive").length === 1)), "Live-Region: bleibt über alle Neuzeichnungen derselbe einzelne Knoten");
  await ctx.close();
}

// ---- 36k. Strava-Zeile der Einheit (F7): mit Daten, ohne Verbindung, Teile entfallen einzeln ----
{
  scenario("36k");
  const wt = (extra) => [{ id: 7, type: "WeightTraining", name: "Weights", start_date_local: "2026-09-08T10:10:00Z", distance: 0, moving_time: 3868, ...extra }];
  const line = (page) => page.textContent('[data-card="strava-session"] dd').then((t) => t.replace(/\s+/g, " ").trim());
  {
    const { page, ctx } = await newPage({ connected: true });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.waitForSelector('[data-card="strava-session"]');
    ok((await line(page)) === "64 min · Ø 118 bpm · max 155 bpm · Relative Effort 15" && (await page.textContent('[data-card="strava-session"] dt')).trim() === "Einheit laut Strava",
       "Strava-Zeile: 'Einheit laut Strava' mit Dauer, Ø und max HF, Relative Effort");
    await page.click('.sd-order__row[data-slug="deadlift"]');
    ok((await page.locator('#session-slot [data-card="strava-session"]').count()) === 1, "Strava-Zeile: bleibt nach einem Fokus-Wechsel stehen");
    await ctx.close();
  }
  {
    const { page, ctx } = await newPage({ connected: true, activities: wt({ average_heartrate: 118.4, max_heartrate: 155 }) });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.waitForSelector('[data-card="strava-session"]');
    ok((await line(page)) === "64 min · Ø 118 bpm · max 155 bpm", "Strava-Zeile: ohne Relative Effort entfällt der Teil");
    await ctx.close();
  }
  {
    const { page, ctx } = await newPage({ connected: true, activities: wt({}) });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.waitForSelector('[data-card="strava-session"]');
    ok((await line(page)) === "64 min", "Strava-Zeile: nur die Dauer, wenn keine Herzfrequenz da ist");
    await ctx.close();
  }
  {
    const { page, ctx } = await newPage({ connected: false });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.waitForTimeout(500);
    ok((await page.locator('[data-card="strava-session"]').count()) === 0 && (await slotIsEmpty(page, "session-slot")), "Strava-Zeile: nicht verbunden -> kein Platzhalter, Slot wirklich leer");
    await ctx.close();
  }
  {
    const { page, ctx } = await newPage({ connected: true, activities: [] });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.waitForTimeout(500);
    ok((await page.locator('[data-card="strava-session"]').count()) === 0 && (await slotIsEmpty(page, "session-slot")), "Strava-Zeile: verbunden, aber keine Einheit an dem Tag -> Slot leer");
    await ctx.close();
  }
}

// ---- 36l. Kraft-Tag allgemein: kein style=, Tab-Leiste weg, Scroll nach oben beim Öffnen, leerer Tag, 320 px ----
{
  scenario("36l");
  const { page, ctx, errors } = await newPage();
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(TODAY);
  const heuteScroll = await page.evaluate(() => { const m = document.getElementById("main"); m.scrollTop = 120; return m.scrollTop; });
  await page.dispatchEvent(`${TODAY} [data-action="open-day"]`, "click");
  await waitKraft(page);
  ok(heuteScroll > 0 && (await page.evaluate(() => document.getElementById("main").scrollTop)) === 0, `Kraft-Tag: öffnet oben (vorher gescrollt ${heuteScroll})`);
  ok((await styleAttrCount(page)) === 0, "Kraft-Tag: kein style= im gerenderten Markup (Normalansicht)");
  ok(!(await page.locator("#tabbar").isVisible()) && (await page.locator("#header").innerHTML()) === "", "Kraft-Tag: Tab-Leiste ausgeblendet, #header leer");
  await page.setViewportSize({ width: 320, height: 640 });
  await noHScroll(page, "Kraft-Tag 320 px");
  const stacked = await page.locator(".sd-set--active .sd-stepper").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  ok(stacked.length === 2 && stacked[1] > stacked[0], `Kraft-Tag 320 px: die beiden Stepper stehen untereinander (${stacked.join("/")})`);
  await page.setViewportSize({ width: 390, height: 844 });

  // Anpassen-Ansicht und leerer Tag
  await page.click('[data-action="toggle-edit"]');
  await page.waitForSelector('[data-card="edit-list"]');
  ok((await styleAttrCount(page)) === 0, "Kraft-Tag: kein style= in der Anpassen-Ansicht");
  for (let i = 0; i < 8; i++) await page.click('[data-action="remove-exercise"]');
  await page.click('[data-action="toggle-edit"]');
  await page.waitForSelector('[data-card="no-exercises"]');
  ok((await page.textContent('[data-card="no-exercises"]')).includes("Keine Übungen für heute") && (await kraftMeta(page)) === "Keine Übungen" &&
     (await page.locator(".sd-dots, .sd-order, [data-card='now']").count()) === 0 && (await page.locator('[data-action="toggle-edit"]').count()) === 1,
     "Leer: Karte 'Keine Übungen für heute', Zähler 'Keine Übungen', keine Punkte/Liste/Jetzt-Karte, nur ein 'Anpassen'");
  await page.click('[data-card="no-exercises"] [data-action="toggle-edit"]');
  await page.waitForSelector('[data-card="edit-list"]');
  ok((await page.locator('.sd-edit__row.is-removed [data-action="restore-exercise"]').count()) === 8, "Leer: 'Anpassen' führt zum Zurückholen (8 entfernte Übungen)");
  ok(errors.length === 0, "Kraft-Tag: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 37. V2 Satz-Entwurf (Auflage C2): hm-tracker.kraftDraft.<Datum> in localStorage ----
{
  const DRAFT = "hm-tracker.kraftDraft.";
  const TOAST_TEXT = "Eingaben von vorhin wiederhergestellt";
  const NOW_ISO = "2026-09-08T09:00:00Z"; // heute = Di 08.09. (Kraft-Tag)
  const draftKeys = (page) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)).sort(), DRAFT);
  const draftOf = (page, iso) => page.evaluate((k) => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }, DRAFT + iso);
  const draftRaw = (page, iso) => page.evaluate((k) => localStorage.getItem(k), DRAFT + iso);
  const toastState = (page) => page.evaluate(() => { const t = document.getElementById("toast"); return { text: t?.textContent ?? "", shown: !!t && t.classList.contains("show") }; });
  const mkDraft = (ex, focus = null) => JSON.stringify({ v: 1, focus, ex });
  const sets3 = (kg, reps) => [0, 1, 2].map(() => ({ kg, reps }));
  const stepKg = (page, dir) => page.click(`.sd-set--active [data-action="step"][data-field="kg"][data-dir="${dir}"]`);
  const seed = (page, entries) => page.addInitScript((e) => { for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v); }, entries);
  const today = () => newPage({ now: NOW_ISO });

  // A: Neuladen mitten in der Übung: Sätze, fertige Sätze, Fokus, Toast (einmal)
  {
    scenario("37a");
    const { page, ctx, errors } = await today();
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    ok((await draftKeys(page)).length === 0, "Entwurf: ein bloßes Öffnen schreibt nichts");
    await page.click(PRIMARY);                    // Squats Satz 1 fertig
    await stepKg(page, "1");                      // Satz 2: Gewicht +2,5
    const kgSquat = await stepperNum(page, "kg");
    await page.click('.sd-order__row[data-slug="deadlift"]');
    await page.click(PRIMARY);                    // Deadlift Satz 1 fertig
    const d = await draftOf(page, "2026-09-08");
    ok(d && d.v === 1 && d.focus === "deadlift" && d.ex.squats.doneSets === 1 && d.ex.deadlift.doneSets === 1 && d.ex.squats.sets.length === 3,
       "Entwurf: Fokus und je Übung Sätze mit fertigen Sätzen stehen unter hm-tracker.kraftDraft.2026-09-08");
    ok((await draftKeys(page)).join() === DRAFT + "2026-09-08", "Entwurf: genau ein Schlüssel, das Datum des Kraft-Tags");
    await page.reload();
    await openKraftViaWeek(page);
    const t1 = await toastState(page);
    ok(t1.shown && t1.text === TOAST_TEXT, "Entwurf: nach dem Neuladen erscheint 'Eingaben von vorhin wiederhergestellt'");
    ok((await nowSlug(page)) === "deadlift" && JSON.stringify(await setStates(page)) === '["done","active","open"]', "Entwurf: Fokus (Deadlift) und fertiger Satz kommen zurück");
    await page.click('.sd-order__row[data-slug="squats"]');
    ok(JSON.stringify(await setStates(page)) === '["done","active","open"]' && (await stepperNum(page, "kg")) === kgSquat,
       `Entwurf: Squats hat Satz 1 fertig und das geänderte Gewicht (${kgSquat}) im aktiven Satz`);
    ok((await storedLogKeys(page)).length === 0, "Entwurf: wiederherstellen schreibt kein Dokument");
    // einmal: Toast räumen, Tag verlassen und wieder öffnen -> kein zweiter Toast
    await page.evaluate(() => { const t = document.getElementById("toast"); t.className = ""; t.textContent = ""; });
    await page.click('[data-action="back"]');
    await openDay(page, "2026-09-08");
    await waitKraft(page);
    const t2 = await toastState(page);
    ok(!t2.shown && t2.text === "", "Entwurf: der Hinweis kommt nur einmal, nicht bei jedem Öffnen");
    ok(errors.length === 0, "Entwurf A: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // B: ein gespeichertes Dokument (anderes Gerät) gewinnt gegen den Entwurf (R9)
  {
    scenario("37b");
    const { page, ctx, errors } = await today();
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.click(PRIMARY);                    // Squats Satz 1 fertig (Entwurf)
    await page.click('.sd-order__row[data-slug="deadlift"]');
    await page.click(PRIMARY);                    // Deadlift Satz 1 fertig (Entwurf)
    // anderes Gerät hat Squats gespeichert
    await page.evaluate(() => {
      const logs = JSON.parse(localStorage.getItem("test.logs") || "{}");
      logs["2026-09-08_squats"] = { date: "2026-09-08", exercise: "squats", completed: true, soll: "3x8-10",
        sets: [{ kg: 77.5, reps: 6 }, { kg: 77.5, reps: 6 }, { kg: 77.5, reps: 5 }] };
      localStorage.setItem("test.logs", JSON.stringify(logs));
    });
    await page.reload();
    await openKraftViaWeek(page);
    ok((await kraftMeta(page)) === "1 von 8 erledigt", "Entwurf R9: Squats zählt als gespeichert");
    await page.click('.sd-order__row[data-slug="squats"]');
    const vals = await setValues(page);
    ok(vals.length === 3 && vals.every((v) => v.includes("77,5")), `Entwurf R9: Squats zeigt das gespeicherte Dokument, nicht den Entwurf (${vals.join(" | ")})`);
    const d = await draftOf(page, "2026-09-08");
    ok(d && Object.keys(d.ex).join() === "deadlift", "Entwurf R9: der Entwurf behält nur noch Deadlift");
    ok(JSON.stringify((await storedLog(page, "2026-09-08", "squats")).sets) === JSON.stringify([{ kg: 77.5, reps: 6 }, { kg: 77.5, reps: 6 }, { kg: 77.5, reps: 5 }]),
       "Entwurf R9: das gespeicherte Dokument bleibt unverändert");
    ok(errors.length === 0, "Entwurf B: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // C: ein vergangener Tag aus der Woche rührt den Entwurf von heute nicht an
  {
    scenario("37c");
    const { page, ctx, errors } = await today();
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);                 // heute
    await page.click(PRIMARY);
    const before = await draftRaw(page, "2026-09-08");
    await page.click('[data-action="back"]');
    await page.click('[data-action="week-prev"]');
    await openDay(page, "2026-09-01");
    await waitKraft(page);
    ok((await draftRaw(page, "2026-09-08")) === before && before !== null, "Entwurf: das Öffnen eines vergangenen Tags löscht den Entwurf von heute nicht");
    ok((await draftKeys(page)).join() === DRAFT + "2026-09-08", "Entwurf: ein vergangener Tag ohne Eingabe schreibt keinen Entwurf");
    await page.click(PRIMARY);
    ok((await draftKeys(page)).join() === `${DRAFT}2026-09-01,${DRAFT}2026-09-08` && (await draftRaw(page, "2026-09-08")) === before,
       "Entwurf: der vergangene Tag bekommt seinen eigenen Entwurf, der von heute bleibt unverändert");
    ok(errors.length === 0, "Entwurf C: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // D: Entwürfe älter als 7 Tage fallen beim Start weg, jüngere bleiben
  {
    scenario("37d");
    const { page, ctx, errors } = await today();
    const ex = mkDraft({ squats: { sets: sets3(60, 8), doneSets: 1 } });
    await seed(page, {
      [DRAFT + "2026-08-31"]: ex, // 8 Tage alt
      [DRAFT + "2026-09-01"]: ex, // 7 Tage alt: bleibt
      [DRAFT + "2026-09-02"]: ex, // 6 Tage alt
      [DRAFT + "2026-09-20"]: ex, // künftig
      [DRAFT + "kaputt"]: ex,     // Datum nicht lesbar
      "hm-tracker.other": "x",    // fremder Schlüssel
    });
    await page.goto(BASE + "/index.html");
    await page.waitForSelector(TODAY);
    ok((await draftKeys(page)).join() === `${DRAFT}2026-09-01,${DRAFT}2026-09-02,${DRAFT}2026-09-20`,
       "Entwurf: 8 Tage alt und nicht lesbare Schlüssel sind weg; 7, 6 Tage alte und künftige bleiben");
    ok((await page.evaluate(() => localStorage.getItem("hm-tracker.other"))) === "x", "Entwurf: fremde Schlüssel bleiben unberührt");
    ok(errors.length === 0, "Entwurf D: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // E: kaputte oder fremde Entwürfe werden ohne Fehler verworfen
  {
    scenario("37e");
    const good = { sets: sets3(60, 8), doneSets: 1 };
    const cases = [
      ["kein JSON", "{"],
      ["falsche Version", JSON.stringify({ v: 2, focus: null, ex: { squats: good } })],
      ["__proto__ als Übung", '{"v":1,"focus":null,"ex":{"__proto__":{"sets":[{"kg":1,"reps":1}],"doneSets":0}}}'],
      ["mehr als 8 Sätze", mkDraft({ squats: { sets: Array.from({ length: 9 }, () => ({ kg: 1, reps: 1 })), doneSets: 0 } })],
      ["Wert über 1000", mkDraft({ squats: { sets: [{ kg: 1001, reps: 5 }, { kg: 1, reps: 5 }, { kg: 1, reps: 5 }], doneSets: 0 } })],
      ["negativer Wert", mkDraft({ squats: { sets: [{ kg: -5, reps: 5 }], doneSets: 0 } })],
      ["doneSets zu groß", mkDraft({ squats: { sets: sets3(60, 8), doneSets: 4 } })],
      ["Text statt Zahl", mkDraft({ squats: { sets: [{ kg: "60", reps: 5 }], doneSets: 0 } })],
      ["nur unbekannte Übung", mkDraft({ gibtsnicht: good })],
      ["ex ist ein Array", JSON.stringify({ v: 1, focus: null, ex: [good] })],
    ];
    for (const [label, raw] of cases) {
      const { page, ctx, errors } = await today();
      await seed(page, { [DRAFT + "2026-09-08"]: raw });
      await page.goto(BASE + "/index.html");
      await openKraftViaWeek(page);
      const t = await toastState(page);
      ok(JSON.stringify(await setStates(page)) === '["active","open","open"]' && !t.shown && (await draftKeys(page)).length === 0 && errors.length === 0,
         `Entwurf kaputt (${label}): ignoriert und gelöscht, Standardwerte, kein Hinweis, kein Fehler ${JSON.stringify(errors)}`);
      await ctx.close();
    }
    // unbekannte Übung neben einer gültigen: nur die gültige kommt zurück
    const { page, ctx, errors } = await today();
    await seed(page, { [DRAFT + "2026-09-08"]: mkDraft({ gibtsnicht: good, deadlift: good }, "deadlift") });
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    ok((await nowSlug(page)) === "deadlift" && JSON.stringify(await setStates(page)) === '["done","active","open"]' && (await toastState(page)).shown,
       "Entwurf: unbekannte Übungen fallen weg, die gültige Übung kommt zurück");
    ok((await stepperNum(page, "kg")) === "60" && errors.length === 0, "Entwurf: gespeicherte Werte (60 kg) kommen als Zahlen zurück " + JSON.stringify(errors));
    await ctx.close();
  }

  // F: nach 'Training abschließen' und nach dem Speichern aller Übungen ist der Entwurf weg
  {
    scenario("37f");
    const { page, ctx, errors } = await today();
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.click(PRIMARY);
    ok((await draftKeys(page)).length === 1, "Entwurf: mitten im Training vorhanden");
    await finishExercise(page);                   // Squats fertig gespeichert
    ok((await draftKeys(page)).length === 0, "Entwurf: eine einzige Übung, die gespeichert wird, nimmt ihren Eintrag mit (kein Rest)");
    await page.click('.sd-order__row[data-slug="deadlift"]');
    await page.click(PRIMARY);
    ok((await draftKeys(page)).length === 1, "Entwurf: neue Eingabe schreibt ihn wieder");
    await finishExercise(page);
    for (let i = 0; i < 6; i++) { await page.click(PRIMARY); await finishExercise(page); }
    await page.waitForSelector('[data-card="all-done"]');
    ok((await draftKeys(page)).length === 0 && (await storedLogKeys(page)).length === 8, "Entwurf: nach dem Speichern aller 8 Übungen ist der Entwurf gelöscht");
    // Rest eines anderen Tabs o. ä.: 'Training abschließen' räumt ihn ebenfalls
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, focus: null, ex: { squats: { sets: [{ kg: 1, reps: 1 }], doneSets: 0 } } })), DRAFT + "2026-09-08");
    await page.click(PRIMARY);
    ok((await page.locator("#app.is-detail").count()) === 0 && (await draftKeys(page)).length === 0, "Entwurf: 'Training abschließen' löscht den Entwurf des Tages");
    ok(errors.length === 0, "Entwurf F: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // G: Abmelden räumt über das hm-tracker.-Präfix (die echte Funktion braucht Firebase, deshalb Quelltext-Prüfung)
  {
    scenario("37g");
    const { DRAFT_PREFIX } = await import("../kraftflow.js");
    const src = readFileSync(new URL("../firebase-init.js", import.meta.url), "utf8");
    ok(DRAFT_PREFIX.startsWith("hm-tracker.") && DRAFT_PREFIX === DRAFT, "Abmelden: Entwurfs-Präfix liegt unter hm-tracker.");
    ok(/Object\.keys\(localStorage\)\s*\.filter\(\(k\) => k\.startsWith\("hm-tracker\."\)\)\s*\.forEach\(\(k\) => localStorage\.removeItem\(k\)\)/.test(src),
       "Abmelden: signOutAndWipeDevice räumt alle localStorage-Schlüssel mit hm-tracker.");
  }

  // H: localStorage wirft für den Entwurf -> Kraft-Tag voll nutzbar, kein Konsolenfehler
  {
    scenario("37h");
    const { page, ctx, errors } = await today();
    await page.addInitScript((p) => {
      const boom = (orig) => function (k, ...rest) {
        if (String(k).startsWith(p)) throw new DOMException("gesperrt", "SecurityError");
        return orig.call(this, k, ...rest);
      };
      Storage.prototype.getItem = boom(Storage.prototype.getItem);
      Storage.prototype.setItem = boom(Storage.prototype.setItem);
      Storage.prototype.removeItem = boom(Storage.prototype.removeItem);
    }, DRAFT);
    await page.goto(BASE + "/index.html");
    await openKraftViaWeek(page);
    await page.click(PRIMARY);
    await stepKg(page, "1");
    await enterValue(page, "reps", "9");
    await page.click('.sd-order__row[data-slug="deadlift"]');
    await page.click(PRIMARY);
    ok(JSON.stringify(await setStates(page)) === '["done","active","open"]', "Speicher gesperrt: Sätze lassen sich weiter abhaken");
    await finishExercise(page);
    ok((await kraftMeta(page)) === "1 von 8 erledigt" && (await storedLogKeys(page)).join() === "2026-09-08_deadlift", "Speicher gesperrt: Übung wird trotzdem gespeichert");
    await page.reload();
    await openKraftViaWeek(page);
    ok(!(await toastState(page)).shown && (await kraftMeta(page)) === "1 von 8 erledigt", "Speicher gesperrt: nach dem Neuladen kein Hinweis, Tag öffnet normal");
    ok(errors.length === 0, "Speicher gesperrt: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }
}

// ---- 38. Lauf-Tag B "Vergleich" (Stride E6, docs/ui-markup-stride.md Abschnitt 12) ----
// Alle Geometriezahlen der Range-Balken liegen als SVG-Attribute im DOM (kein style=, keine Custom Properties).
const geoInRange = (geo) => geo.every((g) =>
  (!g.band || (Number(g.band.x) >= 0 && Number(g.band.width) >= 0 && Number(g.band.x) + Number(g.band.width) <= 100.05)) &&
  (!g.mark || (g.mark.x1 === g.mark.x2 && Number(g.mark.x1) >= 0 && Number(g.mark.x1) <= 100)));
{
  // A: Easy run im Plan: Karte, Balken, Ampel-Form, Achse, Kopf, Strava-Zeile
  {
    scenario("38a");
    const { page, ctx, errors } = await newPage({ connected: true, activities: [run(101, "Easy run", "2026-09-07", "07:10", 8200, 3050, 150)] });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    ok((await page.getAttribute(CMP, "data-status")) === "ok" && (await page.textContent(`${CMP} .sd-pill`)).trim() === "im Plan" &&
       (await page.textContent(`${CMP} .sd-bigkm`)).trim() === "8,2km" && (await page.textContent(`${CMP} .sd-compare__sub`)).trim() === "von 8 km · 50:50 min",
       "Vergleich im Plan: 8,2 km von 8 km, Dauer, Pille 'im Plan'");
    const bar = await page.locator(`${CMP} progress`).evaluate((el) => ({ cls: el.className, value: el.getAttribute("value"), max: el.getAttribute("max"), label: el.getAttribute("aria-label") }));
    ok(bar.cls.includes("sd-prog--coral") && !bar.cls.includes("purple") && bar.value === "8.2" && bar.max === "8" && bar.label === "Distanz, 8,2 von 8 km",
       `Distanzbalken: <progress> in Koralle, Punkt im Attribut, Komma im Label (${JSON.stringify(bar)})`);
    const geo = await svgGeometry(page);
    ok((await page.locator(`${CMP} .sd-range`).count()) === 2 && geo[0].band.x === "35.3" && geo[0].band.width === "29.4" && geo[0].mark.x1 === "37.6" && geo[0].mark.x2 === "37.6",
       `Pace-Balken: geschlossenes Band 35,3 + 29,4, Marker bei 37,6 (${JSON.stringify(geo[0])})`);
    ok(geo[1].band.x === "35.3" && geo[1].band.width === "29.4" && geo[1].mark.x1 === "39.2", `HF-Balken: Band und Marker bei 39,2 (${JSON.stringify(geo[1])})`);
    ok(JSON.stringify(geo[0].axis) === '["5:40","Ziel 6:10–6:35","7:05"]' && JSON.stringify(geo[1].axis) === '["130","Ziel 148–163","181"]',
       `Achsen: immer drei Spans, Mitte mit Originaltext (${JSON.stringify([geo[0].axis, geo[1].axis])})`);
    const rows = await rangeTexts(page);
    ok(geo[0].ampel.includes("sd-ampel--ok") && geo[0].value.includes("is-ok") && rows[0].includes("6:12 /km, im Zielbereich") && rows[1].includes("150 bpm, im Zielbereich"),
       `Werte: Ampel-Form (Kreis) und verstecktes Wort statt nur Farbe (${rows[0]})`);
    ok(geoInRange(geo), "Range-Balken: alle SVG-Zahlen liegen zwischen 0 und 100");
    const head = await page.textContent(RUN_HEAD);
    ok((await page.locator(`${RUN_HEAD} .sd-eyebrow--coral`).textContent()).includes("Lauf · Mo, 07.09.") && (await page.textContent(`${RUN_HEAD} h1`)) === "Easy run · 8 km" &&
       (await page.getAttribute(`${RUN_HEAD} h1`, "tabindex")) === "-1" && head.includes("Heute"),
       "Kopf: Überzeile 'Lauf · Mo, 07.09.' in Koralle, Titel mit tabindex -1, Zurück heißt 'Heute'");
    ok((await page.locator(`${RUN_HEAD} .sd-target`).count()) === 0, "Kopf: mit Vergleichs-Karte keine Ziel-Zeile (das Ziel steht in der Achse)");
    const row = await page.textContent(RUNROW);
    ok((await page.textContent(`${RUNROW} .sd-linkrow__name`)).trim() === "Easy run · 07:10" && row.includes("automatisch") && (await page.locator('[data-slot="shift-note"]').count()) === 0 &&
       (await page.getAttribute(RUNROW, "aria-haspopup")) === "dialog",
       "Strava-Zeile: 'Name · Uhrzeit' (startTime), Pille 'automatisch', keine Verschiebe-Notiz, öffnet ein Dialog-Sheet");
    ok((await page.locator('[data-card="plan-note"]').count()) === 0, "Plan-Hinweis: ohne Notiz im Plan kein Hinweis");
    ok((await page.locator("#app.is-detail").count()) === 1 && !(await page.locator("#tabbar").isVisible()), "Lauf-Tag: Tab-Leiste ausgeblendet");
    ok((await styleAttrCount(page)) === 0, "Lauf-Tag: kein style-Attribut im Markup (C5)");
    await shot(page, "38a-lauf-im-plan");
    await noHScroll(page, "Lauf-Tag");
    await page.setViewportSize({ width: 320, height: 700 });
    await noHScroll(page, "Lauf-Tag bei 320 px");
    const tight = await page.evaluate(() => {
      const el = document.querySelector('#strava-slot [data-card="compare"] .sd-bigkm');
      return { right: el.getBoundingClientRect().right, win: window.innerWidth, font: parseFloat(getComputedStyle(el).fontSize) };
    });
    ok(tight.right <= tight.win && tight.font >= 40, `Lauf-Tag bei 320 px: große Zahl bleibt im Bild und mindestens 40 px groß (${JSON.stringify(tight)})`);
    ok(errors.length === 0, "Lauf-Tag: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // B: 'zu kurz' und 'im Plan' auf der angezeigten Genauigkeit (Auflage C4), 8 km Soll
  scenario("38b");
  for (const [meters, status, pillText, shown] of [
    [7100, "short", "zu kurz", "7,1"],   // 88,75 %
    [7140, "short", "zu kurz", "7,1"],   // gerundet 7,1
    [7160, "ok", "im Plan", "7,2"],      // gerundet 7,2 = genau 90 %
    [7200, "ok", "im Plan", "7,2"],      // 90 %
  ]) {
    const { page, ctx } = await newPage({ connected: true, activities: [run(111, "Easy run", "2026-09-07", "07:10", meters, 3000, 150)] });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    const info = await page.locator(CMP).evaluate((el) => ({
      status: el.dataset.status, pill: el.querySelector(".sd-pill").textContent.trim(), pillCls: el.querySelector(".sd-pill").className,
      big: el.querySelector(".sd-bigkm").textContent, value: Number(el.querySelector("progress").getAttribute("value")), max: Number(el.querySelector("progress").getAttribute("max")),
    }));
    ok(info.status === status && info.pill === pillText && info.big.startsWith(shown) && info.pillCls.includes(status === "ok" ? "sd-pill--ok" : "sd-pill--amber") && info.value < info.max,
       `Distanz ${meters / 1000} km von 8: '${pillText}' bei angezeigten ${shown} km (${JSON.stringify(info)})`);
    await ctx.close();
  }

  // C: Long Run in Violett, Laufname wird escaped
  {
    scenario("38c");
    const { page, ctx } = await newPage({ connected: true, now: "2026-09-05T09:00:00Z",
      activities: [run(121, 'Long <i>run</i> & "co"', "2026-09-05", "09:00", 12030, 4700, 151)] });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    ok((await page.locator(`${CMP} progress.sd-prog--purple`).count()) === 1 && (await page.locator(`${CMP} progress.sd-prog--coral`).count()) === 0 &&
       (await page.locator(`${RUN_HEAD} .sd-eyebrow--purple`).count()) === 1 && (await page.locator(`${RUN_HEAD} .sd-eyebrow--coral`).count()) === 0,
       "Long Run: Distanzbalken und Überzeile in Violett statt Koralle");
    ok((await page.textContent(`${RUNROW} .sd-linkrow__name`)).includes('Long <i>run</i> & "co"') && (await page.locator("#strava-slot i").count()) === 0,
       "Laufname mit HTML erscheint als Text (kein Element im Slot)");
    ok((await page.getAttribute(`${CMP} progress`, "aria-label")) === "Distanz, 12,0 von 12 km" && (await page.getAttribute(CMP, "data-status")) === "ok",
       "Long Run: 12,0 von 12 km im Plan");
    await ctx.close();
  }

  // D: Range-Balken: offen unten/oben, Marker geklemmt, Pace neutral, kein Messwert, frei
  {
    scenario("38d");
    // D1: Recovery, Pace "> 6:40" (zu schnell, Marker am Rand geklemmt) und HF "< 148"
    let { page, ctx } = await newPage({ connected: true, now: "2026-10-04T09:00:00Z",
      activities: [run(131, "Recovery", "2026-10-04", "08:00", 4200, 1500, 140)] });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    let geo = await svgGeometry(page);
    ok(geo[0].band.x === "33.3" && geo[0].band.width === "66.7" && JSON.stringify(geo[0].axis) === '["6:10","Ziel > 6:40","7:40"]',
       `Offen unten ('> 6:40'): Band bis zum rechten Rand, Achsenmitte als Text (${JSON.stringify(geo[0])})`);
    ok(geo[1].band.x === "0" && geo[1].band.width === "66.7" && geo[1].mark.x1 === "51.9" && JSON.stringify(geo[1].axis) === '["112","Ziel < 148","166"]',
       `Offen oben ('< 148'): Band ab dem linken Rand, Marker bei 51,9 (${JSON.stringify(geo[1])})`);
    ok(geo[0].mark.x1 === "0" && geoInRange(geo), `Marker außerhalb der Skala wird auf 0 geklemmt (${geo[0].mark.x1}), alle Zahlen zwischen 0 und 100`);
    const rows = await rangeTexts(page);
    ok(geo[0].ampel.includes("sd-ampel--warn") && geo[0].value.includes("is-warn") && rows[0].includes(", außerhalb des Zielbereichs") && geo[1].ampel.includes("sd-ampel--ok"),
       "Außerhalb des Bands: Raute (warn) mit verstecktem Wort, HF im Bereich: Kreis (ok)");
    await ctx.close();

    // D2: Schwelle, ohne Herzfrequenz: Pace neutral (Notiz statt Balken), HF "–" ohne Marker
    ({ page, ctx } = await newPage({ connected: true, now: "2026-11-04T09:00:00Z",
      activities: [run(132, "Schwelle", "2026-11-04", "18:00", 11000, 3400)] }));
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    geo = await svgGeometry(page);
    const rowsS = await rangeTexts(page);
    ok(rowsS[0].includes("Der Schnitt enthält Ein- und Auslaufen, darum ohne Zielband.") && geo[0].band === null && geo[0].mark === null && geo[0].ampel === null && !geo[0].value.includes("is-"),
       `Pace neutral (Schwelle): Notiz statt Spur, keine Ampel, keine Farbe (${rowsS[0]})`);
    ok(geo[1].band !== null && geo[1].mark === null && geo[1].ampel === null && rowsS[1].startsWith("Ø HF–"),
       "Kein Messwert: HF zeigt '–' ohne Marker und ohne Ampel, das Band bleibt");
    ok((await page.textContent('[data-card="plan-note"]')).includes("2 min Trabpause") && (await page.locator('[data-card="plan-note"] .sd-planhint__label').textContent()) === "Hinweis aus dem Plan",
       "Plan-Hinweis: Notiz der Einheit unter den Karten");
    ok((await styleAttrCount(page)) === 0, "Range-Zustände: kein style-Attribut");
    await ctx.close();

    // D3: Kalibrierungstest: beide Ziele frei, genau eine Hinweiszeile, keine Spur
    ({ page, ctx } = await newPage({ connected: true, now: "2026-10-28T09:00:00Z",
      activities: [run(133, "Test", "2026-10-28", "18:00", 11000, 3600, 160)] }));
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    ok((await page.locator(`${CMP} .sd-range--plain`).count()) === 2 && (await page.locator(`${CMP} .sd-range__track`).count()) === 0 && (await page.locator(`${CMP} .sd-ampel`).count()) === 0,
       "Frei (Test): zwei Zeilen ohne Spur und ohne Ampel");
    ok((await page.locator(`${CMP} .sd-range__note`).count()) === 1 && (await page.textContent(`${CMP} .sd-range__note`)) === "Für den Test gibt es kein Zielband. Die Werte stehen nur zur Info.",
       "Frei (Test): genau der abgenommene Hinweis-Satz");
    await ctx.close();

    // D4: Long run mit zügigem Schluss: Pace und HF frei, allgemeiner Hinweis, violett
    ({ page, ctx } = await newPage({ connected: true, now: "2026-11-28T09:00:00Z",
      activities: [run(134, "Long progressiv", "2026-11-28", "09:00", 17000, 6000, 155)] }));
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    ok((await page.locator(`${CMP} .sd-range--plain`).count()) === 2 && (await page.textContent(`${CMP} .sd-range__note`)) === "Für diesen Lauf gibt es kein Zielband. Die Werte stehen nur zur Info." &&
       (await page.locator(`${CMP} progress.sd-prog--purple`).count()) === 1,
       "Frei (zusammengesetztes Ziel): allgemeiner Hinweis, Long Run violett");
    await ctx.close();
  }

  // E: Zustände ohne Vergleich: Zukunft/heute, ignoriert, verpasst, Strava nicht verbunden
  {
    scenario("38e");
    // E1: heute, noch kein Lauf; Sheet ohne Auswahl; Escape; ignorieren; Automatik zurück
    let { page, ctx } = await newPage({ connected: true, activities: [] });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    ok((await page.textContent('#strava-slot [data-card="empty"]')).includes("Noch kein Lauf") &&
       (await page.textContent('#strava-slot [data-card="empty"]')).includes("Sobald der Lauf in Strava liegt, erscheint er hier.") &&
       (await page.locator('#strava-slot [data-card="empty"] [data-action="pick-run"]').textContent()).trim() === "Lauf von Hand zuordnen",
       "Heute ohne Lauf: Karte 'Noch kein Lauf' mit 'Lauf von Hand zuordnen'");
    ok((await page.textContent(`${RUN_HEAD} .sd-target`)).trim() === "Ziel 6:10–6:35 /km · HF 148–163 bpm" && (await page.locator(CMP).count()) === 0,
       "Heute ohne Lauf: Ziel-Zeile im Kopf, kein Vergleich");
    ok((await styleAttrCount(page)) === 0, "Zustandskarte: kein style-Attribut");
    await page.click('#strava-slot [data-action="pick-run"]');
    await page.waitForSelector(`${ASSIGN}.open`);
    ok((await page.locator(`${ASSIGN} [data-slot="no-options"]`).count()) === 1 && (await page.locator(`${ASSIGN} [role="radiogroup"]`).count()) === 0 &&
       (await page.locator(`${ASSIGN} [data-action="reset-run"]`).count()) === 0 && (await page.locator(`${ASSIGN} [data-action="reload-strava"]`).count()) === 1,
       "Sheet ohne freien Lauf: Hinweis statt Liste, 'Neu laden' und 'Kein Lauf an diesem Tag' bleiben, kein 'Automatik zurück'");
    await page.keyboard.press("Escape");
    await page.waitForSelector(`${ASSIGN}:not(.open)`);
    const back = await activeEl(page);
    ok(back.action === "pick-run" && back.tag === "BUTTON", `Sheet: Fokus zurück auf 'Lauf von Hand zuordnen' (${JSON.stringify(back)})`);
    await page.click('#strava-slot [data-action="pick-run"]');
    await page.waitForSelector(`${ASSIGN}.open`);
    await page.click(`${ASSIGN} [data-action="ignore-run"]`);
    await page.waitForSelector('#strava-slot [data-card="ignored"]');
    ok((await page.textContent('#strava-slot [data-card="ignored"]')).includes("Kein Lauf an diesem Tag. Zählt als verpasst."), "Ignoriert: Karte erklärt, dass der Tag als verpasst zählt");
    await page.waitForSelector(`${ASSIGN}:not(.open)`);
    ok((await activeEl(page)).action === "reset-run", "Ignoriert: Fokus auf 'Automatik zurück'");
    await page.click('#strava-slot [data-action="reset-run"]');
    await page.waitForSelector('#strava-slot [data-card="empty"]');
    ok((await activeEl(page)).action === "pick-run", "Automatik zurück: Karte 'Noch kein Lauf' wieder da, Fokus nicht auf body");
    await ctx.close();

    // E2: Tag vorbei, kein Lauf: verpasst; 'Neu laden' zeigt den Platzhalter und fokussiert den Titel
    ({ page, ctx } = await newPage({ connected: true, activities: [], now: "2026-09-10T09:00:00Z" }));
    await ctx.route("https://www.strava.com/api/v3/athlete/activities*", async (r) => {
      await new Promise((res) => setTimeout(res, 500));
      r.fulfill({ contentType: "application/json", body: "[]" });
    });
    await page.goto(BASE + "/index.html");
    await goTab(page, "woche");
    await openDay(page, "2026-09-07");
    await page.waitForSelector('#strava-slot [data-card="missed"]');
    const missed = await page.textContent('#strava-slot [data-card="missed"]');
    ok(missed.includes("verpasst") && missed.includes("Kein Lauf gefunden") && missed.includes("von einem Tag davor bis drei Tage danach") &&
       (await page.locator('#strava-slot [data-card="missed"] .sd-pill--danger').count()) === 1 &&
       (await page.locator('#strava-slot [data-card="missed"] [data-action="pick-run"]').count()) === 1,
       "Verpasst: vergangener Tag ohne Lauf zeigt Pille, Titel, Suchfenster und 'Lauf von Hand zuordnen'");
    await page.click('#strava-slot [data-action="reload-strava"]');
    await page.waitForSelector('#strava-slot [data-card="loading"][aria-busy="true"]');
    ok((await activeEl(page)).tag === "H1" && (await page.locator(RUN_HEAD).count()) === 1, "Neu laden im Slot: Platzhalter, Kopf bleibt stehen, Fokus auf dem Titel");
    await page.waitForSelector('#strava-slot [data-card="missed"]');
    ok((await activeEl(page)).tag === "H1", "Neu laden im Slot: nach dem Abruf bleibt der Fokus auf dem Titel");
    await ctx.close();

    // E3: Strava nicht verbunden
    ({ page, ctx } = await newPage({ connected: false }));
    await page.goto(BASE + "/index.html");
    await goTab(page, "woche");
    await openDay(page, "2026-09-07");
    await page.waitForSelector('#strava-slot [data-card="no-strava"]');
    ok((await page.textContent('#strava-slot [data-card="no-strava"]')).includes("Verbinde Strava, dann erscheint der Lauf hier automatisch.") &&
       (await page.locator('#strava-slot [data-card="no-strava"] .sd-btn--primary[data-action="connect-strava"]').textContent()).trim() === "Mit Strava verbinden" &&
       (await page.locator("#main .sd-btn--primary").count()) === 1,
       "Strava nicht verbunden: Karte mit der einen gefüllten Schaltfläche 'Mit Strava verbinden'");
    ok((await page.locator(`${RUN_HEAD} .sd-target`).count()) === 1, "Strava nicht verbunden: Ziel-Zeile im Kopf");
    await ctx.close();
  }

  // F: Sheet 'Neu laden': Knopf gesperrt, Sheet bleibt offen, danach nur der Körper neu
  {
    scenario("38f");
    const { page, ctx } = await newPage({ connected: true });
    let calls = 0;
    await ctx.route("https://www.strava.com/api/v3/athlete/activities*", async (r) => {
      const isFirstPage = new URL(r.request().url()).searchParams.get("page") === "1";
      if (isFirstPage) calls++;
      if (calls > 1) await new Promise((res) => setTimeout(res, 500));
      const extra = run(99, "Neu hochgeladen", "2026-09-06", "10:00", 5000, 1800);
      r.fulfill({ contentType: "application/json", body: JSON.stringify(!isFirstPage ? [] : calls > 1 ? [...ACTIVITIES, extra] : ACTIVITIES) });
    });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    await page.click(`${RUNROW}[data-action="pick-run"]`);
    await page.waitForSelector(`${ASSIGN}.open`);
    const before = await page.locator(OPTIONS).count();
    await page.click(`${ASSIGN} [data-action="reload-strava"]`);
    const busy = await page.locator(`${ASSIGN} [data-action="reload-strava"]`).evaluate((el) => ({ disabled: el.disabled, busy: el.getAttribute("aria-busy"), text: el.textContent.trim() }));
    ok(busy.disabled && busy.busy === "true" && busy.text === "Neu laden" && (await sheetIsOpen(page)) && (await page.locator('#strava-slot [data-card="loading"]').count()) === 0,
       `Sheet 'Neu laden': Knopf gesperrt mit aria-busy, Beschriftung bleibt, Sheet bleibt offen, Slot dahinter ohne Platzhalter (${JSON.stringify(busy)})`);
    await page.waitForSelector(`${ASSIGN} [data-action="reload-strava"]:not([disabled])`);
    ok((await page.locator(OPTIONS).count()) === before + 1 && (await page.textContent("#assignSheetTitle")) === "Lauf für Mo, 07.09." && (await sheetIsOpen(page)),
       `Sheet 'Neu laden': neuer Lauf erscheint in der Liste (${before} -> ${before + 1}), Titel bleibt, Sheet bleibt offen`);
    ok((await activeEl(page)).action === "reload-strava" && !(await page.getAttribute(`${ASSIGN} [data-action="reload-strava"]`, "aria-busy")),
       "Sheet 'Neu laden': Fokus bleibt auf 'Neu laden', aria-busy ist wieder weg");
    await ctx.close();
  }

  // G: Zwei Sheets (Auflage C6): Info-Sheet und Zuordnungs-Sheet direkt nacheinander, jeder Timer für sich
  {
    scenario("38h");
    const { page, ctx, errors } = await newPage({ connected: true });
    await page.goto(BASE + "/index.html");
    await openRunToday(page);
    // Auslöser fürs Info-Sheet: der Lauf-Tag hat keinen, darum ein Prüfknopf mit denselben Attributen
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.id = "probe-info"; b.dataset.action = "open-info"; b.dataset.info = "wochensoll"; b.textContent = "i";
      document.getElementById("main").appendChild(b);
    });
    const state = () => page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      return {
        info: q("#infoSheet").classList.contains("open"), infoHidden: q("#infoSheet").hidden, infoBackdropHidden: q("#infoBackdrop").hidden,
        assign: q("#assignSheet").classList.contains("open"), assignHidden: q("#assignSheet").hidden, assignBackdropHidden: q("#assignBackdrop").hidden,
        focus: document.activeElement?.id || document.activeElement?.dataset?.card || "",
      };
    });
    const ROW = '#strava-slot [data-action="pick-run"]';
    // A -> B: Info offen, im selben Atemzug das Zuordnungs-Sheet
    await page.evaluate((row) => { document.getElementById("probe-info").click(); document.querySelector(row).click(); }, ROW);
    let st = await state();
    ok(!st.info && st.infoHidden && st.infoBackdropHidden && st.assign && !st.assignHidden && st.focus === "assignSheetTitle",
       `A->B: Info-Sheet schließt sofort ohne Animation (hidden), Zuordnungs-Sheet offen, Fokus auf dessen Titel (${JSON.stringify(st)})`);
    await page.waitForTimeout(400);
    st = await state();
    ok(st.assign && !st.assignHidden && !st.info, "A->B: nach der Ausblendzeit bleibt das Zuordnungs-Sheet offen (kein alter Timer versteckt es)");
    // B -> A
    await page.evaluate(() => document.getElementById("probe-info").click());
    st = await state();
    ok(st.info && !st.infoHidden && !st.assign && st.assignHidden && st.assignBackdropHidden && st.focus === "infoSheetTitle",
       `B->A: Zuordnungs-Sheet schließt sofort, Info-Sheet offen, Fokus auf dessen Titel (${JSON.stringify(st)})`);
    await page.waitForTimeout(400);
    st = await state();
    ok(st.info && !st.infoHidden && st.assignHidden, "B->A: nach der Ausblendzeit bleibt das Info-Sheet offen");
    // Escape schließt, dann sofort das andere Sheet: der Timer des geschlossenen darf das neue nicht verstecken
    await page.evaluate((row) => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.querySelector(row).click();
    }, ROW);
    await page.waitForTimeout(400);
    st = await state();
    ok(st.assign && !st.assignHidden && st.infoHidden && !st.info, `Escape auf dem Info-Sheet, sofort Zuordnung: das neue bleibt offen (${JSON.stringify(st)})`);
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.getElementById("probe-info").click();
    });
    await page.waitForTimeout(400);
    st = await state();
    ok(st.info && !st.infoHidden && st.assignHidden && !st.assign, `Escape auf der Zuordnung, sofort Info-Sheet: das neue bleibt offen (${JSON.stringify(st)})`);
    // Ein globaler Escape-Handler: schließt genau das offene Sheet, Fokus zum eigenen Auslöser
    await page.keyboard.press("Escape");
    await page.waitForSelector("#infoSheet:not(.open)");
    ok((await state()).focus === "probe-info", "Escape: Fokus kehrt zum Auslöser des Info-Sheets zurück, nicht zu dem des Zuordnungs-Sheets");
    await page.click(ROW);
    await page.waitForSelector(`${ASSIGN}.open`);
    await page.keyboard.press("Escape");
    await page.waitForSelector(`${ASSIGN}:not(.open)`);
    st = await state();
    ok(st.focus === "strava-run" && !st.info, "Escape: Fokus kehrt zur Strava-Zeile zurück, das Info-Sheet bleibt zu");
    // Seitenwechsel bei offenem Sheet schließt es sofort
    await page.click(ROW);
    await page.waitForSelector(`${ASSIGN}.open`);
    await page.evaluate(() => document.querySelector('#main [data-action="back"]').click());
    st = await state();
    ok(!st.assign && st.assignHidden, "Zurück bei offenem Zuordnungs-Sheet: schließt sofort, es bleibt nicht über der nächsten Seite stehen");
    ok(errors.length === 0, "Zwei Sheets: keine Konsolenfehler " + JSON.stringify(errors));
    await ctx.close();
  }

  // H: Quelltext-Wächter: kein style=, keine alten Lauf-Klassen, kein Gedankenstrich in neuen Texten
  {
    scenario("38i");
    const code = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const view = code("view-run.js");
    ok(!/\bstyle\s*=/.test(view) && !/var\(--|--[a-z-]+\s*:/.test(view), "view-run.js: kein style= und keine Custom Property im Markup");
    ok(!view.includes("—"), "view-run.js: kein Gedankenstrich in den Texten");
    const app = code("app.js");
    ok(!/pick-row|pick-main|pick-sub|shift-note|strava-note|close-picker|Wird nicht hier eingetragen|runPickerFor|planRunCard|stravaResultHTML|runPickerHTML/.test(app),
       "app.js: die alten Lauf-Tag-Klassen, close-picker und der Em-Dash-Satz sind weg");
    ok(/createSheet\("assignSheet", "assignBackdrop"\)/.test(app) && !/import[^;]*from "\.\/(firebase-init|strava)\.js/.test(view),
       "Lauf-Tag: Zuordnungs-Sheet über die gemeinsame Fabrik, view-run.js importiert weder Firebase noch Strava (C5)");
  }
}

await browser.close();
console.log(`\n${checks - fails}/${checks} Browser-Checks bestanden`);
console.log("Checks je Szenario: " + [...perScenario].map(([k, v]) => `${k}=${v}`).join(" "));
process.exit(fails ? 1 : 0);
