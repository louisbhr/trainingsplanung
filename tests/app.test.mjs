import pw from "playwright";
const { chromium } = pw;

const BASE = "http://127.0.0.1:8099";
const SHOTS = process.env.SHOTS;
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

const FIREBASE_STUB = `
const KEY = "test.logs";
const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
export const db = {};
export async function ensureSignedIn() { return { uid: "test-user" }; }
export async function saveLog(dateISO, slug, data) {
  const s = read(); s[dateISO + "_" + slug] = { date: dateISO, exercise: slug, ...data }; write(s);
}
export async function loadLog(d, s) { return read()[d + "_" + s] || null; }
export async function loadLogsForDate(d) {
  const out = {}; for (const v of Object.values(read())) if (v.date === d) out[v.exercise] = v; return out;
}
export async function loadLogsForExercise(slug) {
  return Object.values(read()).filter((v) => v.exercise === slug).sort((a, b) => (a.date < b.date ? -1 : 1));
}
export async function loadRunLinks() {
  return JSON.parse(localStorage.getItem("test.runlinks") || "{}");
}
export async function saveRunLink(date, activityId) {
  const all = JSON.parse(localStorage.getItem("test.runlinks") || "{}");
  all[date] = { activityId: activityId ?? null };
  localStorage.setItem("test.runlinks", JSON.stringify(all));
}
export async function clearRunLink(date) {
  const all = JSON.parse(localStorage.getItem("test.runlinks") || "{}");
  delete all[date];
  localStorage.setItem("test.runlinks", JSON.stringify(all));
}
export async function loadDayPlan(dateISO) {
  const d = JSON.parse(localStorage.getItem("test.dayplan." + dateISO) || "null");
  return { removed: d?.removed || [], added: d?.added || [] };
}
export async function saveDayPlan(dateISO, dp) {
  localStorage.setItem("test.dayplan." + dateISO, JSON.stringify(dp));
}
export async function saveStravaTokens(t) {
  const cur = JSON.parse(localStorage.getItem("test.strava") || "null") || {};
  localStorage.setItem("test.strava", JSON.stringify({ ...cur, ...t }));
}
export async function loadStravaTokens() { return JSON.parse(localStorage.getItem("test.strava") || "null"); }
`;

const ACTIVITIES = [
  { id: 1, type: "Run", name: "Easy run", start_date_local: "2026-09-07T07:10:00Z", distance: 8020, moving_time: 3010, average_heartrate: 155 },
  { id: 2, type: "Run", name: "Kurzer Trab", start_date_local: "2026-09-07T18:00:00Z", distance: 2000, moving_time: 800 },
  { id: 3, type: "Run", name: "Long run", start_date_local: "2026-09-05T09:00:00Z", distance: 12030, moving_time: 4700, average_heartrate: 151 },
  { id: 4, type: "Ride", name: "Rad", start_date_local: "2026-09-04T09:00:00Z", distance: 30000, moving_time: 3600 },
  { id: 5, type: "Run", name: "Easy run", start_date_local: "2026-09-02T07:00:00Z", distance: 7010, moving_time: 2680 },
  { id: 6, type: "Run", name: "Nachgeholt", start_date_local: "2026-09-10T18:30:00Z", distance: 8100, moving_time: 3050 },
];

const browser = await chromium.launch();

async function newPage({ connected = false, tz = "Europe/Berlin" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: tz });
  const errors = [];
  await ctx.route("**/firebase-init.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  await ctx.route("https://www.strava.com/api/v3/athlete/activities*", (r) => {
    const page = new URL(r.request().url()).searchParams.get("page");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(page === "1" ? ACTIVITIES : []) });
  });
  await ctx.route("https://worker.test/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      access_token: "at-new", refresh_token: "rt-new", expires_at: Math.floor(Date.now() / 1000) + 21600,
      athlete: { id: 42 } }) }));
  const page = await ctx.newPage();
  // Zeit einfrieren: die Tests prüfen konkrete Plan-Tage, sie dürfen nicht
  // davon abhängen, wann sie laufen. 07.09.2026 = Woche 2, Montag, Easy run.
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
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
async function noHScroll(page, where) {
  const { doc, over } = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    over: [...document.querySelectorAll("#main *, #header *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => el.tagName + "." + el.className).slice(0, 5),
  }));
  ok(doc <= 0 && over.length === 0, `${where}: nichts ragt über den Rand (${doc}px, ${JSON.stringify(over)})`);
}

// ---- 1. Heute, nicht verbunden (07.09.2026 = W2 Montag, Easy run) ----
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main .card");
  ok((await page.textContent("#header h1")) === "Lauf", "Heute: Lauftag erkannt");
  ok((await page.textContent("#header .badge")).includes("Easy run"), "Heute: Badge 'Easy run + 4x20s'");
  ok((await page.textContent("#main")).includes("8 km"), "Heute: Ziel-Distanz 8 km");
  await page.waitForSelector('[data-action="connect-strava"]');
  ok(true, "Heute: 'Mit Strava verbinden' erscheint ohne Tokens");
  await shot(page, "01-heute-nicht-verbunden");
  await noHScroll(page, "Heute");
  ok(errors.length === 0, "Heute: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2. Heute, verbunden -> Strava-Daten ----
{
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#strava-slot .card");
  const txt = await page.textContent("#strava-slot");
  ok(txt.includes("Erfasst (Strava)"), "Strava: Lauf gematcht");
  ok(txt.includes("8.0 km"), "Strava: längster Lauf des Tages (8.0 km statt 2.0)");
  ok(txt.includes("6:15 /km"), "Strava: Pace korrekt berechnet");
  ok(txt.includes("155 bpm"), "Strava: Ø HF angezeigt");
  ok(txt.includes("50:10 min"), "Strava: Dauer formatiert");
  await shot(page, "02-heute-mit-strava");
  ok(errors.length === 0, "Strava: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 3. Woche: Navigation, Tag öffnen ----
{
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await page.waitForSelector(".day-grid");
  ok((await page.locator(".day-pill").count()) === 7, "Woche: 7 Tage");
  ok((await page.textContent("#header h1")).includes("Woche 2"), "Woche: aktuelle Woche 2");
  ok((await page.locator(".day-pill.today").count()) === 1, "Woche: heute markiert");
  await page.click('[data-action="week-next"]');
  ok((await page.textContent("#header h1")).includes("Woche 3"), "Woche: vorwärts blättern");
  await page.click('[data-action="week-prev"]');
  await page.click('[data-action="week-prev"]');
  ok((await page.textContent("#header h1")).includes("Woche 1"), "Woche: rückwärts blättern");
  ok(await page.locator('[data-action="week-prev"]').isDisabled(), "Woche: bei Woche 1 kein Zurück");
  await page.click('[data-action="week-today"]');
  ok((await page.textContent("#header h1")).includes("Woche 2"), "Woche: 'Heute' springt zurück");
  await shot(page, "03-woche");
  await noHScroll(page, "Woche");
  // Dienstag = Krafttag öffnen
  await page.click('[data-date="2026-09-08"]');
  await page.waitForSelector('[data-ex]');
  ok((await page.textContent("#header h1")) === "Krafttraining", "Tagesansicht: Krafttag geöffnet");
  ok((await page.locator("[data-ex]").count()) === 8, "Krafttag: 8 Übungen");
  await page.click('[data-action="back"]');
  await page.waitForSelector(".day-grid");
  ok(true, "Tagesansicht: Zurück zur Woche");
  ok(errors.length === 0, "Woche: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 4. Kraft eintragen, speichern, nach Reload noch da ----
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-08"]');
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
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-08"]');
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
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.addInitScript(() => {
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-01_squats": { date: "2026-09-01", exercise: "squats", topKg: 70, totalReps: 27, completed: true, sets: [{ kg: 70, reps: 9 }] },
      "2026-09-08_squats": { date: "2026-09-08", exercise: "squats", topKg: 80, totalReps: 27, completed: true, sets: [{ kg: 80, reps: 9 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="verlauf"]');
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
  ok(t.includes("29.1 km"), "Verlauf Lauf: 7-Tage-Summe zählt nur bis heute");
  await shot(page, "06-verlauf-lauf");
  await noHScroll(page, "Verlauf Lauf");
  ok(errors.length === 0, "Verlauf: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 6. Plan-Tab ----
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="plan"]');
  await page.waitForSelector(".zone-line");
  const t = await page.textContent("#main");
  ok((await page.textContent("#header .eyebrow")).includes("Woche 2 von 31"), "Plan: aktuelle Woche");
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route("**/firebase-init.js", (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-08T22:30:00Z")); // = 09.09. 00:30 Berlin
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#header h1");
  const eyebrow = await page.textContent("#header .eyebrow");
  ok(eyebrow.includes("09.09.") && eyebrow.includes("Mi"), `Zeitzone: 00:30 Berlin zeigt den 09.09. (war: "${eyebrow.trim()}")`);
  await ctx.close();
}

// ---- 8. Worker nicht konfiguriert -> klarer Hinweis statt Hänger ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route("**/firebase-init.js", (r) => r.fulfill({ contentType: "application/javascript", body: FIREBASE_STUB }));
  // config.js hat inzwischen eine echte Worker-URL — den unkonfigurierten
  // Zustand deshalb hier gezielt nachstellen.
  await ctx.route("**/config.js", (r) => r.fulfill({
    contentType: "application/javascript",
    body: 'export const STRAVA_WORKER_URL = ""; export const STRAVA_CLIENT_ID = "277715"; export const isWorkerConfigured = false;',
  }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#strava-slot .card");
  ok((await page.textContent("#strava-slot")).includes("Strava noch nicht eingerichtet"),
     "Setup: fehlender Worker wird erklärt statt zu hängen");
  await shot(page, "08-worker-fehlt");
  await ctx.close();
}

// ---- 10. Übungen anpassen: entfernen, hinzufügen, zurückholen ----
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-08"]');
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
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-08"]');
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
  await page.click('[data-date="2026-09-10"]');
  await page.waitForSelector("[data-ex]");
  ok((await page.locator('[data-ex="beinpresse"]').count()) === 0, "Anpassen: gilt nur für den bearbeiteten Tag");
  ok(errors.length === 0, "Anpassen: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 9. Firestore verweigert Zugriff: als Firebase-Problem erkennbar ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
  await ctx.route("**/firebase-init.js", (r) => r.fulfill({
    contentType: "application/javascript",
    body: `
      class FirebaseAccessError extends Error {
        constructor(m) { super("Firebase: " + m); this.source = "firebase"; }
      }
      const boom = () => { throw new FirebaseAccessError("Missing or insufficient permissions."); };
      export const db = {};
      export async function ensureSignedIn() { return { uid: "t" }; }
      export async function saveLog() { boom(); }
      export async function loadLog() { boom(); }
      export async function loadLogsForDate() { boom(); }
      export async function loadLogsForExercise() { boom(); }
      export async function saveStravaTokens() { boom(); }
      export async function loadStravaTokens() { boom(); }
      export async function loadDayPlan() { boom(); }
      export async function saveDayPlan() { boom(); }
      export async function loadRunLinks() { boom(); }
      export async function saveRunLink() { boom(); }
      export async function clearRunLink() { boom(); }`,
  }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("hm-tracker.workerUrl", "https://worker.test"));
  await page.goto(BASE + "/index.html");

  await page.waitForSelector("#strava-slot .error-card");
  const runTxt = await page.textContent("#strava-slot");
  ok(runTxt.includes("Daten-Problem (Firebase)"), "Fehlerquelle: Firestore-Fehler wird nicht als Strava-Problem gezeigt");
  ok(runTxt.includes("Missing or insufficient permissions."), "Fehlerquelle: Originalmeldung sichtbar");
  ok(runTxt.includes("Anonymous"), "Fehlerquelle: Hinweis auf die tatsächliche Ursache");
  ok((await page.locator('#strava-slot [data-action="connect-strava"]').count()) === 0,
     "Fehlerquelle: kein irreführendes 'Neu verbinden' bei Firebase-Fehlern");
  await shot(page, "09-firebase-fehler-lauftag");

  // Krafttag: Meldung muss stehen bleiben, nicht als Toast verschwinden
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-08"]');
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
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-09"]'); // Mi = Easy run + 4x20s
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
  await page.click('[data-date="2026-09-07"]');
  await page.waitForSelector("#strava-slot .card");
  const mo = await page.textContent("#strava-slot");
  ok(mo.includes("8.0 km") && !mo.includes("nachgeholt"), "Verschoben: exakter Treffer bleibt exakt");

  // "Passt nicht" -> Automatik aus, Angebot zur Zuordnung
  await page.click('[data-action="back"]');
  await page.click('[data-date="2026-09-09"]');
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
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-09"]');
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

// ---- 12. Tableiste klebt unten ----
{
  const { page, ctx } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await page.click('[data-date="2026-09-08"]'); // Krafttag, lange Liste
  await page.waitForSelector("[data-ex]");

  const vh = 844;
  const before = await page.locator("#tabbar").boundingBox();
  ok(Math.abs(before.y + before.height - vh) < 2,
     `Tableiste: sitzt am unteren Rand (${Math.round(before.y + before.height)} von ${vh})`);

  const scrolled = await page.evaluate(() => {
    const m = document.getElementById("main");
    m.scrollTop = m.scrollHeight;
    return { top: m.scrollTop, scrollable: m.scrollHeight > m.clientHeight };
  });
  ok(scrolled.scrollable && scrolled.top > 100, `Tableiste: Inhalt ist scrollbar (${scrolled.top}px)`);

  const after = await page.locator("#tabbar").boundingBox();
  ok(Math.abs(after.y - before.y) < 1, "Tableiste: bleibt beim Scrollen an Ort und Stelle");
  ok((await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)) <= 0,
     "Tableiste: die Seite selbst scrollt nicht mit");
  await shot(page, "15-leiste-unten");
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} Browser-Checks bestanden`);
process.exit(fails ? 1 : 0);
