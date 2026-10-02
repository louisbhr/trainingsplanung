import pw from "playwright";
import { readFileSync } from "node:fs";
const { chromium } = pw;

const BASE = "http://127.0.0.1:8099";
const SHOTS = process.env.SHOTS;
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// Für die Plan-Lade-Tests (A1): eine echte, gültige Kopie zum Vorbelegen
// von localStorage, damit "JSON 404 mit Kopie" nicht künstlich wirkt.
const REAL_PLAN_JSON = readFileSync(new URL("../plans/hm-2027.json", import.meta.url), "utf8");

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
export async function loadAllLogs() { return Object.values(read()); }
export async function loadAllDayPlans() {
  const out = {};
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("test.dayplan.")) continue;
    const d = JSON.parse(localStorage.getItem(key) || "null");
    out[key.slice("test.dayplan.".length)] = { removed: d?.removed || [], added: d?.added || [] };
  }
  return out;
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
export async function loadCoach(dateISO) {
  return JSON.parse(localStorage.getItem("test.coach." + dateISO) || "null");
}
export async function saveCoach(dateISO, data) {
  localStorage.setItem("test.coach." + dateISO, JSON.stringify(data));
}
export async function loadCoachWeek(key) {
  return JSON.parse(localStorage.getItem("test.coachweek." + key) || "null");
}
export async function saveCoachWeek(key, data) {
  localStorage.setItem("test.coachweek." + key, JSON.stringify(data));
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
  { id: 7, type: "WeightTraining", name: "Morning Weight Training", start_date_local: "2026-09-08T10:10:00Z",
    distance: 0, moving_time: 3868, average_heartrate: 118.4, max_heartrate: 155, suffer_score: 15 },
];

const browser = await chromium.launch();

async function newPage({ connected = false, tz = "Europe/Berlin" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: tz });
  const errors = [];
  await ctx.route(/firebase-init\.js/, (r) =>
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
// Wochen-Tab: Zeile aufklappen und über "Tag öffnen" in die Tagesansicht
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

// ---- 1. Dashboard, nicht verbunden (07.09.2026 = W2 Montag, Easy run) ----
// Ersetzt die alte "Heute"-Tagesansicht als Starttab (M2-4). Die
// Tagesansicht mit dem Strava-"Verbinden"-Einstieg bleibt über den
// Wochen-Tab erreichbar, siehe unten.
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#main .today-card");
  ok((await page.textContent("#header h1")) === "Woche 2 · Aufbau", "Dashboard: Kopfzeile zeigt Woche + Wochentyp");
  ok((await page.textContent("#header .badge")).includes("Phase 1 · Basis"), "Dashboard: Phasen-Badge");
  ok((await page.textContent("#header .countdown")).includes("Datum offen"), "Dashboard: Countdown 'Datum offen' ohne bestätigtes Renndatum");
  const today = await page.textContent("#today-slot");
  ok(today.includes("Easy run") && today.includes("8 km"), "Dashboard: 'Heute dran' zeigt den Lauftag (Easy run, 8 km)");
  // Je nach Tempo der Strava-Prüfung steht hier schon der Endzustand
  ok(today.includes("Ist-Werte werden nach dem Lauf aus Strava geladen") || today.includes("Strava ist nicht verbunden"),
    "Dashboard: Lauftag wartet sichtbar auf Strava, blockiert aber nicht");
  // Sobald feststeht, dass Strava nicht verbunden ist: klarer Hinweis statt Dauer-Laden
  await page.waitForSelector('#today-slot [data-action="connect-strava"]', { timeout: 5000 });
  ok((await page.textContent("#today-slot")).includes("Strava ist nicht verbunden"), "Dashboard: Lauf-Karte nennt 'nicht verbunden' statt dauerhaft zu laden");
  ok((await page.locator("#coach-slot .coach-card").count()) === 1, "Dashboard: Coach-Platzhalter rendert sofort");
  ok((await page.locator("#ampel-slot .ampel-tile").count()) === 4, "Dashboard: vier Ampel-Kacheln (Platzhalter) sofort da");
  // Placeholder oder (falls das schnelle Nachladen inzwischen durch ist)
  // schon die echten "Im Detail"-Karten — beides zeigt: nichts blockiert.
  ok((await page.locator("#detail-slot .card").count()) >= 1, "Dashboard: 'Im Detail' rendert sofort etwas, blockiert nicht");
  await shot(page, "01-dashboard-nicht-verbunden");
  await noHScroll(page, "Dashboard");
  ok(errors.length === 0, "Dashboard: keine Konsolenfehler " + JSON.stringify(errors));

  await page.click('[data-tab="woche"]');
  await openDay(page, "2026-09-07");
  await page.waitForSelector('[data-action="connect-strava"]');
  ok(true, "Wochen-Tab: 'Mit Strava verbinden' erscheint ohne Tokens (unverändert aus M1)");
  await ctx.close();
}

// ---- 2. Dashboard, verbunden -> Ist-Werte laden nach, ohne zu blockieren ----
{
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#today-slot .metric-value");
  const txt = await page.textContent("#today-slot");
  ok(txt.includes("8.0 km"), "Dashboard: längster Lauf des Tages (8.0 km statt 2.0)");
  ok(txt.includes("6:15 /km"), "Dashboard: Pace korrekt berechnet");
  ok(txt.includes("155 bpm"), "Dashboard: Ø HF angezeigt");
  ok(txt.includes("50:10 min"), "Dashboard: Dauer formatiert");
  await shot(page, "02-dashboard-mit-strava");
  await noHScroll(page, "Dashboard mit Strava");
  ok(errors.length === 0, "Dashboard mit Strava: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2b. Dashboard, Krafttag: Starten -> Übung -> Kraft-Tagesansicht -> zurück (F4) ----
{
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
  await page.waitForSelector("#today-slot .today-card.k-kraft");
  const before = await page.textContent("#today-slot");
  ok(before.includes("Full Body A") && before.includes("8 Übungen"), "Dashboard: Krafttag mit Titel + Übungsanzahl");
  ok((await page.locator("#todayExList").isVisible()) === false, "Dashboard: Übungsliste startet zugeklappt");

  await page.click('[data-action="toggle-today-exercises"]');
  await page.waitForSelector("#todayExList.open");
  await page.waitForFunction(() => !document.querySelector("#todayExList .ex-progress")?.textContent.includes("…"));
  ok((await page.locator("#todayExList .ex-row").count()) === 8, "Dashboard: aufgeklappte Liste zeigt alle 8 Übungen");
  ok((await page.textContent("#todayExList .ex-progress")).includes("0/8"), "Dashboard: Fortschritt aus Firestore nachgeladen (0/8)");

  // Tippen auf eine Übungszeile öffnet die bestehende Kraft-Tagesansicht.
  await page.locator('#todayExList .ex-row').first().click();
  await page.waitForSelector('[data-ex="squats"]');
  ok((await page.textContent("#header h1")) === "Krafttraining", "Dashboard->Tagesansicht: Krafttag geöffnet");
  ok((await page.textContent("#header .eyebrow")).includes("Dashboard"), "Dashboard->Tagesansicht: Zurück-Knopf beschriftet mit 'Dashboard'");

  await page.locator('[data-ex="squats"] [data-kg]').fill("80");
  await page.locator('[data-ex="squats"] [data-reps]').fill("9");
  await page.click('[data-ex="squats"] [data-action="save"]');
  await page.waitForSelector('[data-status="squats"].ok');

  await page.click('[data-action="back"]');
  await page.waitForSelector("#today-slot .today-card.k-kraft");
  await page.waitForFunction(() =>
    document.querySelector("#todayExList .ex-progress")?.textContent.includes("1/8 geloggt"));
  ok(true, "Dashboard: zurück zeigt den aktualisierten Fortschritt (1/8 geloggt)");
  await shot(page, "02b-dashboard-krafttag");
  await noHScroll(page, "Dashboard Krafttag");
  ok(errors.length === 0, "Dashboard Krafttag: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c. Dashboard: echte Ampeln (Wochensoll/Belastung/Kraft-Progression) + Info-Sheet (M2-5) ----
{
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
  await page.waitForFunction(() => !document.querySelector("#ampel-slot .ampel-dot")?.classList.contains("st-loading"));

  const tiles = await page.locator("#ampel-slot .ampel-tile").evaluateAll((els) =>
    els.map((el) => ({
      title: el.querySelector(".title").textContent.trim(),
      status: [...el.querySelector(".ampel-dot").classList].find((c) => c.startsWith("st-")),
      detail: el.querySelector(".detail")?.textContent.trim(),
    })));
  const byTitle = Object.fromEntries(tiles.map((t) => [t.title, t]));

  ok(byTitle["Wochensoll"].status === "st-gruen", `Ampel Wochensoll: grün erwartet (${byTitle["Wochensoll"].status})`);
  // 16,1 km = Montag exakt (8,02 km) + der auf Mittwoch nachgeholte Lauf vom
  // 10.09. (8,1 km, per assignRuns automatisch zugeordnet) — die Anzeige
  // zeigt die ganze Woche, nicht nur den Anteil bis heute (F5).
  ok(byTitle["Wochensoll"].detail === "16.1 / 29 km · Kraft 0/2", `Ampel Wochensoll: Detailtext (${byTitle["Wochensoll"].detail})`);
  ok(byTitle["Belastung"].status === "st-grau", `Ampel Belastung: grau ohne 4 Wochen Historie (${byTitle["Belastung"].status})`);
  ok(byTitle["Kraft-Progression"].status === "st-rot", `Ampel Kraft-Progression: rot bei zwei betroffenen Übungen (${byTitle["Kraft-Progression"].status})`);
  ok(byTitle["Kraft-Progression"].detail.includes("Squats") && byTitle["Kraft-Progression"].detail.includes("+1 weitere"),
     `Ampel Kraft-Progression: Detailtext nennt die schlechteste Übung zuerst (${byTitle["Kraft-Progression"].detail})`);
  ok(["st-gruen", "st-gelb", "st-rot", "st-grau"].includes(byTitle["Easy-Disziplin"].status),
     `Ampel Easy-Disziplin: rechnet, ohne hängen zu bleiben (${byTitle["Easy-Disziplin"].status})`);

  // "Im Detail" (F8, M2-6): Wochenvolumen der aktuellen Phase (Woche 1–8),
  // Aerobe Effizienz, Adhärenz 4 Wochen, "Als Nächstes".
  await page.waitForSelector("#detail-slot .si-bar-col");
  ok((await page.locator("#detail-slot .si-bar-col").count()) === 8, "Im Detail: Wochenvolumen zeigt alle 8 Wochen der Phase 'Basis'");
  ok((await page.textContent("#detail-slot .si-bar-label.current")) === "W2", "Im Detail: aktuelle Woche im Wochenvolumen hervorgehoben");
  ok((await page.locator("#detail-slot .si-bar-col").nth(2).locator(".si-bar-ist").count()) === 0,
     "Im Detail: künftige Woche (W3) zeigt keinen Ist-Balken");
  const detailTxt = await page.textContent("#detail-slot");
  ok(detailTxt.includes("-15 s/km seit Woche 1"), `Im Detail: Aerobe Effizienz nennt das Delta seit der ersten Woche mit Daten (${detailTxt.match(/[-+]\d+ s\/km[^.]*/)?.[0]})`);
  ok(detailTxt.includes("50 %") && detailTxt.includes("3 von 6 Einheiten"),
     `Im Detail: Adhärenz 4 Wochen (${detailTxt.match(/\d+ %/)?.[0]}, ${detailTxt.match(/\d+ von \d+ Einheiten/)?.[0]})`);
  ok(detailTxt.includes("Nächster Long Run: Sa 12.09., 13 km"), "Im Detail: nächster Long Run");
  ok(detailTxt.includes("Nächste Woche: Aufbau"), "Im Detail: Typ der nächsten Woche");
  ok(detailTxt.includes("Re-Kalibrierung: 25.10."), "Im Detail: nächste Re-Kalibrierung aus dem Plan-Objekt");

  // Info-Sheet (D1): öffnen per Klick, Grenzwerte aus THRESHOLDS im Text,
  // per Escape schließen, Fokus kehrt zum Info-Knopf zurück.
  const kraftInfoBtn = page.locator('[data-info="kraft"]');
  await kraftInfoBtn.focus();
  await kraftInfoBtn.press("Enter");
  await page.waitForSelector("#infoSheet.open");
  ok((await page.textContent("#infoSheetTitle")) === "Kraft-Progression", "Info-Sheet: Titel passt zur Ampel");
  const body = await page.textContent("#infoSheetBody");
  ok(body.includes("42 Tage"), `Info-Sheet: Grenzwert aus THRESHOLDS (windowDays) im Text (${body.slice(0, 120)})`);
  ok(body.includes("2 oder mehr"), "Info-Sheet: Grenzwert redAffectedCount im Text");
  ok(await page.evaluate(() => document.activeElement.id === "infoSheetClose"), "Info-Sheet: Fokus springt auf den Schließen-Knopf");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#infoSheet:not(.open)");
  ok(await page.evaluate(() => document.activeElement.dataset.info === "kraft"), "Info-Sheet: Fokus kehrt zum auslösenden Info-Knopf zurück");
  await shot(page, "02c-dashboard-ampeln-info");
  await noHScroll(page, "Dashboard Ampeln");
  ok(errors.length === 0, "Dashboard Ampeln: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c-2. Info-Sheet: schnelles Schließen + ein ANDERES Sheet öffnen (Korrekturrunde 1, Bug 1) ----
// closeInfo() setzte sheet.hidden erst nach 200ms; öffnete man währenddessen
// ein anderes Sheet, feuerte der alte Timer trotzdem noch und versteckte das
// gerade erst geöffnete neue Sheet wieder — Escape/× wirkten danach nicht
// mehr, weil closeInfo() sheet.hidden fälschlich als "schon zu" las.
{
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.waitForSelector('[data-info="wochensoll"]');
  await page.click('[data-info="wochensoll"]');
  await page.waitForSelector("#infoSheet.open");
  await page.click("#infoSheetClose"); // schließt sofort, startet den 200ms-Timer
  await page.click('[data-info="kraft"]'); // noch innerhalb der 200ms ein ANDERES Sheet öffnen
  await page.waitForSelector("#infoSheet.open");
  await page.waitForTimeout(300); // der alte Timer wäre jetzt längst gefeuert
  ok(await page.locator("#infoSheet.open").isVisible(), "Info-Sheet: bleibt nach dem alten Timeout weiterhin sichtbar offen");
  ok((await page.textContent("#infoSheetTitle")) === "Kraft-Progression", "Info-Sheet: zeigt das zuletzt geöffnete Sheet");
  await page.keyboard.press("Escape");
  // Kurzes Timeout statt unbegrenzt warten: bei einer Regression hängt
  // closeInfo() sonst (stale hidden-Zustand lässt Escape verpuffen).
  let escapeWorked = true;
  try {
    await page.waitForSelector("#infoSheet:not(.open)", { timeout: 3000 });
  } catch {
    escapeWorked = false;
  }
  ok(escapeWorked, "Info-Sheet: Escape schließt weiterhin zuverlässig (kein stale-Zustand)");
  if (escapeWorked) {
    // hidden folgt der Ausblendzeit (200ms) — darauf warten, nicht sofort zählen
    const hid = await page.waitForSelector("#infoSheet[hidden]", { state: "attached", timeout: 2000 }).then(() => true, () => false);
    ok(hid, "Info-Sheet: nach Escape auch tatsächlich hidden");
  }
  ok(errors.length === 0, "Info-Sheet Stale-Timeout: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2c-3. Wochen-Tab: heutiger Krafttag mit Teilfortschritt (Korrekturrunde 1) ----
{
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z")); // Di = Full Body A
  await page.addInitScript(() => {
    localStorage.setItem("test.logs", JSON.stringify({
      "2026-09-08_squats": { date: "2026-09-08", exercise: "squats", name: "Squats", soll: "3x8-10", topKg: 60, totalReps: 27, completed: true, sets: [{ kg: 60, reps: 9 }, { kg: 60, reps: 9 }, { kg: 60, reps: 9 }] },
      "2026-09-08_deadlift": { date: "2026-09-08", exercise: "deadlift", name: "Deadlift", soll: "3x5", topKg: 80, totalReps: 15, completed: true, sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }, { kg: 80, reps: 5 }] },
    }));
  });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
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
  const { page, ctx, errors } = await newPage();
  await page.clock.setFixedTime(new Date("2026-09-08T09:00:00Z")); // Di = Krafttag
  await page.goto(BASE + "/index.html");
  const active = () => page.locator("#tabbar button.active").getAttribute("data-tab");
  await page.waitForSelector("#today-slot .today-card");
  ok((await active()) === "dashboard", "Tableiste: Start auf Dashboard markiert");
  await page.click('[data-tab="woche"]');
  await page.waitForSelector(".week-summary");
  ok((await active()) === "woche", "Tableiste: Woche markiert im Wochen-Tab");
  await openDay(page, "2026-09-08");
  await page.waitForSelector("[data-ex]");
  ok((await active()) === "woche", "Tableiste: Tagesansicht aus der Woche bleibt bei Woche");
  await page.click('[data-tab="dashboard"]');
  await page.click('[data-action="toggle-today-exercises"]');
  await page.locator("#todayExList .ex-row").first().click();
  await page.waitForSelector("[data-ex]");
  ok((await active()) === "dashboard", "Tableiste: Tagesansicht aus dem Dashboard bleibt bei Dashboard");
  await page.click('[data-action="back"]');
  await page.waitForSelector("#today-slot .today-card");
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
  const { page, ctx, errors } = await newPage({ connected: true });
  const requestKinds = [];
  await ctx.route("https://worker.test/coach", (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    requestKinds.push(body.kind);
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: '<img src=x onerror="window.__xss=1">', kind: body.kind, model: "m", promptVersion: "v1" }),
    });
  });
  const countKind = (k) => requestKinds.filter((x) => x === k).length;

  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#coach-slot .coach-card");
  await page.waitForFunction(() => document.querySelector("#coach-slot .text")?.textContent.includes("<img"));
  const coachTxt = await page.textContent("#coach-slot .text");
  ok(coachTxt.includes("<img src=x"), `Coach: KI-Text wird als Text angezeigt, nicht ausgeführt (${coachTxt})`);
  ok((await page.evaluate(() => window.__xss)) === undefined, "Coach: eingebetteter onerror-Handler wird NICHT ausgeführt (A5)");

  // Montag -> Wochenbilanz automatisch ausgeklappt (F6/D4), gleiche Escaping-Regel.
  await page.waitForSelector("#coach-slot .bilanz-heading");
  await page.waitForFunction(() => document.querySelector("#coach-slot .bilanz-body")?.textContent.includes("<img"));
  ok((await page.evaluate(() => window.__xss)) === undefined, "Wochenbilanz: eingebetteter onerror-Handler wird NICHT ausgeführt (A5)");
  ok(countKind("daily") === 1, `Coach: genau ein daily-Request beim ersten Laden (${JSON.stringify(requestKinds)})`);
  ok(countKind("weekly") === 1, `Coach: genau ein weekly-Request für die Wochenbilanz (${JSON.stringify(requestKinds)})`);

  // Gleicher Hash beim erneuten Aufruf des Dashboards -> kein zweiter Request je kind.
  await page.click('[data-tab="verlauf"]');
  await page.click('[data-tab="dashboard"]');
  await page.waitForSelector("#coach-slot .coach-card");
  await page.waitForTimeout(300);
  ok(countKind("daily") === 1, `Coach: gleicher Hash löst keinen zweiten daily-Request aus (${JSON.stringify(requestKinds)})`);
  ok(countKind("weekly") === 1, `Coach: gleicher Hash löst keinen zweiten weekly-Request aus (${JSON.stringify(requestKinds)})`);
  await shot(page, "02d-dashboard-coach");
  ok(errors.length === 0, "Coach: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2d-2. Wochenbilanz an einem anderen Wochentag: eingeklappt, per Tap auf (M2-10) ----
{
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
  await page.waitForSelector("#coach-slot .coach-card");
  await page.waitForSelector('[data-action="toggle-bilanz"]');
  const label = await page.textContent('[data-action="toggle-bilanz"]');
  ok(label.includes("Wochenbilanz W1"), `Wochenbilanz: Kurzform nennt die bilanzierte Woche (${label.trim()})`);
  ok((await page.locator("#bilanzBody").isVisible()) === false, "Wochenbilanz: an einem anderen Tag als Montag eingeklappt");
  await page.click('[data-action="toggle-bilanz"]');
  await page.waitForSelector("#bilanzBody:not([hidden])");
  ok((await page.textContent("#bilanzBody")).includes("Wochenbilanz-Text."), "Wochenbilanz: per Tap aufklappbar");
  await noHScroll(page, "Wochenbilanz eingeklappt");
  ok(errors.length === 0, "Wochenbilanz eingeklappt: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 2e. Coach: abgeschalteter Worker -> Regel-Fallback ----
{
  const { page, ctx, errors } = await newPage();
  await ctx.route("https://worker.test/coach", (r) => r.abort("failed"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#coach-slot .coach-card");
  await page.waitForFunction(() => (document.querySelector("#coach-slot .text")?.textContent.length ?? 0) > 0);
  const txt = await page.textContent("#coach-slot .text");
  ok(txt.length > 0, `Coach: Regel-Fallback erscheint bei abgeschaltetem Worker (${txt})`);
  // Kein "keine Konsolenfehler"-Check hier: route.abort() erzeugt absichtlich
  // ein "Failed to load resource"-Netzwerkprotokoll, keinen echten App-Fehler
  // (wie schon bei der Strava-Herkunfts-Ablehnung in M2-3).
  await ctx.close();
}

// ---- 2f. Coach: Dokument nicht lesbar -> kein API-Aufruf (A4) ----
{
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
  await page.waitForSelector("#coach-slot .coach-card");
  await page.waitForTimeout(300);
  ok(coachRequests === 0, `Coach: kein API-Aufruf, wenn das Coach-Dokument nicht lesbar ist (${coachRequests})`);
  ok((await page.locator("#coach-slot .text").count()) === 1, "Coach: trotzdem ein Fallback-Text sichtbar, keine Fehlerkarte");
  ok(errors.length === 0, "Coach ohne lesbares Dokument: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 3. Woche: Navigation, Tag öffnen (M2-7: neue Tagesliste statt Grid) ----
{
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await page.waitForSelector(".day-row");
  ok((await page.locator(".day-row").count()) === 7, "Woche: 7 Tage");
  ok((await page.textContent("#header .t1")).includes("Woche 2"), "Woche: aktuelle Woche 2");
  ok((await page.locator(".day-row.today").count()) === 1, "Woche: heute markiert");
  ok((await page.locator('[data-action="week-today"]').count()) === 0, "Woche: kein 'Heute'-Knopf, wenn schon die aktuelle Woche zu sehen ist");
  await page.click('[data-action="week-next"]');
  await page.waitForFunction(() => document.querySelector("#header .t1")?.textContent.includes("Woche 3"));
  ok(true, "Woche: vorwärts blättern");
  await page.click('[data-action="week-prev"]');
  await page.click('[data-action="week-prev"]');
  await page.waitForFunction(() => document.querySelector("#header .t1")?.textContent.includes("Woche 1"));
  ok(true, "Woche: rückwärts blättern");
  ok(await page.locator('[data-action="week-prev"]').isDisabled(), "Woche: bei Woche 1 kein Zurück");
  ok((await page.locator('[data-action="week-today"]').count()) === 1, "Woche: 'Heute'-Knopf erscheint außerhalb der aktuellen Woche");
  await page.click('[data-action="week-today"]');
  await page.waitForFunction(() => document.querySelector("#header .t1")?.textContent.includes("Woche 2"));
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
  ok((await page.textContent("#header h1")) === "Krafttraining", "Tagesansicht: Krafttag geöffnet");
  ok((await page.locator("[data-ex]").count()) === 8, "Krafttag: 8 Übungen");
  await page.click('[data-action="back"]');
  await page.waitForSelector(".day-row");
  ok(true, "Tagesansicht: Zurück zur Woche");
  ok(errors.length === 0, "Woche: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 4. Kraft eintragen, speichern, nach Reload noch da ----
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
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
  await page.click('[data-tab="woche"]');
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
  await page.waitForSelector("#header h1");
  const eyebrow = await page.textContent("#header .eyebrow");
  ok(eyebrow.includes("Mittwoch") && eyebrow.includes("9. September"),
     `Zeitzone: 00:30 Berlin zeigt den 09.09. (war: "${eyebrow.trim()}")`);
  await ctx.close();
}

// ---- 8. Worker nicht konfiguriert -> klarer Hinweis statt Hänger ----
{
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
    body: `export const STRAVA_WORKER_URL = ""; export const STRAVA_CLIENT_ID = "277715"; export const isWorkerConfigured = false; export const COACH_URL = "";
      export const THRESHOLDS = { wochensoll: { gruen: 0.9, gelb: 0.7 }, easy: { gelbMaxOver: 8 },
      belastung: { gruen: 1.3, gelb: 1.5 }, kraft: { windowDays: 42, stallSessions: 2, minExercisesWithData: 3, redAffectedCount: 2, redConsecutiveBelow: 2 }, coach: { dailyLimit: 3, weeklyLimit: 2 } };`,
  }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-07T09:00:00Z"));
  await page.goto(BASE + "/index.html");
  // Der "Strava noch nicht eingerichtet"-Hinweis erscheint in der
  // Tagesansicht (Wochen-Tab), nicht mehr auf dem Dashboard-Starttab.
  await page.click('[data-tab="woche"]');
  await openDay(page, "2026-09-07");
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
  await page.click('[data-tab="woche"]');
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
  await page.click('[data-tab="woche"]');
  await openDay(page, "2026-09-07");
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
  const { page, ctx, errors } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
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
  ok(mo.includes("8.0 km") && !mo.includes("nachgeholt"), "Verschoben: exakter Treffer bleibt exakt");

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
  await page.click('[data-tab="woche"]');
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

// ---- 12. Tableiste klebt unten ----
{
  const { page, ctx } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await openDay(page, "2026-09-08"); // Krafttag, lange Liste
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

// ---- 13. Progression aus den Wiederholungen statt RPE ----
{
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
  await page.click('[data-tab="woche"]');
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
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
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
  await page.click('[data-tab="woche"]');
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
  const { page, ctx } = await newPage();
  await page.goto(BASE + "/index.html");
  await page.click('[data-tab="woche"]');
  await openDay(page, "2026-09-08");
  await page.waitForSelector("[data-ex]");

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
  ok(Math.abs(bar.rect.bottom - 844) < 2, "Glas: sitzt weiterhin am unteren Rand");

  // Damit die Unschärfe etwas zu tun hat, muss Inhalt darunter durchlaufen
  const passesUnder = await page.evaluate(() => {
    const m = document.getElementById("main");
    const bar = document.getElementById("tabbar").getBoundingClientRect();
    m.scrollTop = m.scrollHeight / 2;
    return [...document.querySelectorAll("[data-ex]")].some((el) => {
      const r = el.getBoundingClientRect();
      return r.top < bar.top && r.bottom > bar.top;
    });
  });
  ok(passesUnder, "Glas: Inhalt scrollt unter der Leiste durch");

  // Kapsel hinter dem aktiven Tab
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
  const { page, ctx } = await newPage({ connected: true });
  await page.goto(BASE + "/index.html");

  // Jedes Feld, das man antippen kann, muss mindestens 16px haben —
  // darunter zoomt iOS Safari hinein und die Seite lässt sich danach
  // seitlich schieben.
  const views = [
    ["Krafttag", async () => { await page.click('[data-tab="woche"]'); await openDay(page, "2026-09-08"); await page.waitForSelector("[data-ex]"); }],
    ["Übung hinzufügen", async () => { await page.click('[data-action="quick-add"]'); await page.waitForSelector("#new-ex-name"); }],
    ["Verlauf", async () => { await page.click('[data-tab="verlauf"]'); await page.waitForSelector("#ex-picker"); }],
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
    const cs = getComputedStyle(document.getElementById("header"));
    return { top: cs.paddingTop, left: cs.paddingLeft };
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
  ok((await page.textContent("#header h1")) === "Woche 2 · Aufbau", "Plan-404 mit Kopie: App läuft normal weiter (Lauftag erkannt)");

  // Satz-Logging funktioniert weiterhin mit der Kopie
  await page.click('[data-tab="woche"]');
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
  await page.clock.setFixedTime(new Date("2027-04-07T09:00:00Z")); // 07.04.2027 Berlin
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#header h1");
  ok((await page.textContent("#header h1")) === "Bis zum Rennen", "Rennlücke: kein 'Woche 31', Zustand 'Bis zum Rennen'");
  ok((await page.textContent("#today-slot")).includes("Der Plan endet vor dem Renntag"),
     "Rennlücke: 'Heute dran' zeigt die neutrale Karte statt einer erfundenen Einheit");
  await shot(page, "21-bis-zum-rennen");
  ok(errors.length === 0, "Rennlücke: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 21. Datum nach dem Renntag -> "Kein aktiver Plan" (A8/E7) ----
{
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
  await page.clock.setFixedTime(new Date("2027-04-20T09:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("hm-tracker.workerUrl", "https://worker.test"));
  await page.goto(BASE + "/index.html");
  await page.waitForSelector("#header h1");
  ok((await page.textContent("#header h1")) === "Kein aktiver Plan", "Nach dem Rennen: 'Kein aktiver Plan'");
  await page.waitForTimeout(300);
  ok(coachRequests === 0, `Nach dem Rennen: kein Coach-API-Aufruf (F7, gezählt: ${coachRequests})`);
  ok((await page.textContent("#header .countdown")).includes("Rennen am 11.04.2027"),
     "Nach dem Rennen: Kopfzeile nennt das vergangene Renndatum");
  ok((await page.textContent("#today-slot")).includes("Läufe werden weiter aus Strava gezeigt"),
     "Nach dem Rennen: 'Heute dran' zeigt die neutrale Karte (F7)");
  ok((await page.textContent("#coach-slot")).includes("Ein neues Ziel legst du im Plan-Tab an"),
     "Nach dem Rennen: Coach zeigt einen festen Hinweis statt eines API-Aufrufs (F7)");
  await shot(page, "22-kein-plan");
  ok(errors.length === 0, "Nach dem Rennen: keine Konsolenfehler " + JSON.stringify(errors));
  await ctx.close();
}

// ---- 22. Datum vor Planstart -> Woche 1, nicht Woche 31 (I3) ----
{
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
  await page.waitForSelector("#header h1");
  ok((await page.textContent("#header h1")) === "Kein aktiver Plan", "Vor Planstart: 'Kein aktiver Plan' auf 'Heute'");

  await page.click('[data-tab="woche"]');
  await page.waitForSelector(".day-row, .card");
  ok((await page.textContent("#header .t1")).includes("Woche 1"), "Vor Planstart: Wochen-Tab zeigt Woche 1, nicht Woche 31");

  await page.click('[data-tab="plan"]');
  await page.waitForSelector(".zone-line");
  ok((await page.textContent("#header .eyebrow")).includes("Woche 1 von 31"), "Vor Planstart: Plan-Tab zeigt Woche 1, nicht Woche 31");
  ok((await page.textContent("#header .eyebrow")).includes("0% geschafft"), "Vor Planstart: 0% geschafft, nicht 97%");
  await ctx.close();
}

// ---- 23. Die Kopie wird beim normalen Laden wirklich geschrieben (I2) ----
{
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
  await page.waitForSelector("#main .card");
  const stored = await page.evaluate(() => localStorage.getItem("hm-tracker.plan.hm-2027"));
  ok(!!stored, "Normales Laden: es landet wirklich eine Kopie in localStorage");
  ok(!!stored && JSON.parse(stored).id === "hm-2027", "Geschriebene Kopie hat die erwartete Form (id hm-2027)");

  // 2) Jetzt erst auf 404 umstellen und neu laden — greift die Kopie, die
  // die App selbst gerade geschrieben hat (nicht eine vorab injizierte)?
  await ctx.route(/plans\/hm-2027\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await page.reload();
  await page.waitForSelector("#toast.show");
  ok((await page.textContent("#toast")).includes("Plan aus letzter Kopie"), "Nach 404: die selbst geschriebene Kopie greift beim Reload wirklich");
  ok((await page.textContent("#header h1")) === "Woche 2 · Aufbau", "Nach 404 mit echter Kopie: App läuft normal weiter");
  await ctx.close();
}

// ---- 24. Kopie mit fremder schemaVersion wird ignoriert (I2) ----
{
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

await browser.close();
console.log(`\n${checks - fails}/${checks} Browser-Checks bestanden`);
process.exit(fails ? 1 : 0);
