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
  ok((await page.locator(".bar").count()) === 4, "Verlauf Lauf: 4 Läufe (Radfahrt gefiltert)");
  const h2 = await page.locator(".bar").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  ok(new Set(h2).size > 1 && Math.min(...h2) >= 8, `Verlauf Lauf: Balken haben echte Höhen (${h2.join(", ")})`);
  const t = await page.textContent("#main");
  ok(t.includes("29.1 km"), "Verlauf Lauf: 7-Tage-Summe korrekt");
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
  await page.waitForSelector(".zone-row");
  const t = await page.textContent("#main");
  ok(t.includes("Aktuell Woche 2 von 31"), "Plan: aktuelle Woche");
  ok((await page.locator(".card.current").count()) === 1, "Plan: laufende Phase hervorgehoben");
  ok((await page.locator(".zone-row").count()) === 5, "Plan: 5 Zonen");
  ok(t.includes("148–163 bpm"), "Plan: HF-Werte sichtbar (vorher fehlten sie)");
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

await browser.close();
console.log(`\n${checks - fails}/${checks} Browser-Checks bestanden`);
process.exit(fails ? 1 : 0);
