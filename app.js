import {
  goal, zones, phases, weeks, exerciseCatalog,
  PLAN_START, TOTAL_WEEKS,
  toISO, fromISO, addDays, weekStart, weekDates, weekNumberFor,
} from "./plan.js?v=202609110852";
import {
  saveLog, loadLogsForDate, loadLogsForExercise, ensureSignedIn, loadDayPlan, saveDayPlan,
  loadRunLinks, saveRunLink, clearRunLink, loadAllLogs,
} from "./firebase-init.js?v=202609110852";
import {
  isAuthorized, startAuthorization, handleAuthRedirect, fetchRecentRuns,
  formatPace, formatDuration, isWorkerConfigured, sessionForDate,
} from "./strava.js?v=202609110852";
import { suggestProgression, previousEntry } from "./progression.js?v=202609110852";
import { assignRuns, pickableRuns, offsetLabel, daysBetween } from "./runmatch.js?v=202609110852";

const ICONS = {
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none"/><path d="M13 7l-2 3 3 2 1 5M11 10l-4 1-2 4M8 14l-3 1M13.5 11l3 1 2-2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>',
};

const STRAVA_SINCE = addDays(PLAN_START, -14); // etwas Vorlauf für den Verlauf

// ---------- kleine Helfer ----------
const slug = (s) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const todayISO = () => toISO(new Date());
const dayNameDE = (iso) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][fromISO(iso).getDay()];
const shortDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const header = document.getElementById("header");
const main = document.getElementById("main");

const state = {
  tab: "heute",
  weekNo: weekNumberFor(todayISO()),
  selectedDate: null,
  historyMode: "kraft",
  historyExercise: defaultHistoryExercise(),
};

// Vorauswahl im Verlauf: die erste Übung der laufenden Woche — der alte
// Split aus Woche 1 steht sonst dauerhaft als Standard da.
function defaultHistoryExercise() {
  const week = weeks[weekNumberFor(todayISO())];
  if (week && !week.placeholder) return slug(week.kraft.di.exercises[0].name);
  return slug(exerciseCatalog[0]?.name || "Squats");
}

// Kraft-Eingaben der gerade sichtbaren Tagesansicht
const logState = new Map();
// Pro Tag angepasste Übungsliste: { removed: [slug], added: [{name, soll, hint}] }
let dayPlan = { removed: [], added: [] };
let currentKraftDay = { info: null, iso: null };
let editMode = false;
let replaceFor = null; // Slug der Übung, die gerade getauscht wird
let quickAdd = false;  // Maske zum schnellen Hinzufügen offen
// Strava: null = noch nicht geladen, false = nicht verbunden
let stravaState = { runs: null, error: null, errorSource: null, connected: null };
// Plan-Datum -> { run, offset, source }
let runAssignment = {};
let runLinks = {};
let runPickerFor = null; // Plan-Datum, für das gerade die Auswahl offen ist
let allLogs = null; // Kraft-Verlauf, für die Progressionsvorschläge

function badge(text, color, bg) {
  return `<span class="badge" style="background:${bg};color:${color}">${esc(text)}</span>`;
}

function toast(msg, isError = false) {
  let box = document.getElementById("toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    document.getElementById("app").appendChild(box);
  }
  box.textContent = msg;
  box.className = isError ? "show error" : "show";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (box.className = ""), isError ? 6000 : 3000);
}

// ---------- Plan-Zugriff ----------
function dayInfo(iso) {
  const w = weekNumberFor(iso);
  const week = weeks[w];
  if (!week || week.placeholder) return { kind: "placeholder", week: w, focus: week?.focus };
  if (week.kraft.di.date === iso) return { kind: "kraft", ...week.kraft.di };
  if (week.kraft.do.date === iso) return { kind: "kraft", ...week.kraft.do };
  const run = week.runs.find((r) => r.date === iso);
  if (run) return { kind: "lauf", ...run };
  return { kind: "ruhe" };
}

function colorsFor(info) {
  if (info.kind === "kraft") return ["var(--teal-fg)", "var(--teal-bg)"];
  if (info.kind === "lauf")
    return info.shortType === "Long"
      ? ["var(--purple-fg)", "var(--purple-bg)"]
      : ["var(--coral-fg)", "var(--coral-bg)"];
  return ["var(--text-secondary)", "var(--surface-1)"];
}

function badgeForKind(info) {
  const [color, bg] = colorsFor(info);
  if (info.kind === "kraft") return badge(info.label, color, bg);
  if (info.kind === "lauf") return badge(info.type, color, bg);
  if (info.kind === "placeholder") return badge("Offen", color, bg);
  return badge("Ruhe", color, bg);
}

// ---------- Rendering ----------
function render() {
  try {
    if (state.tab === "heute") return renderDay(todayISO(), { showBack: false });
    if (state.tab === "woche") {
      return state.selectedDate ? renderDay(state.selectedDate, { showBack: true }) : renderWeek();
    }
    if (state.tab === "verlauf") return renderHistory();
    if (state.tab === "plan") return renderPlan();
  } catch (err) {
    console.error(err);
    header.innerHTML = `<h1>Fehler</h1>`;
    main.innerHTML = errorCard("Etwas ist schiefgelaufen: " + err.message);
  }
}

function errorCard(msg) {
  return `<div class="card error-card"><p class="name">Problem</p><p class="hint">${esc(msg)}</p>
    <button data-action="reload" style="margin-top:8px;">Neu laden</button></div>`;
}
function loadingCard(msg = "Lädt …") {
  return `<p class="center-note">${esc(msg)}</p>`;
}

// ---------- Tagesansicht ----------
async function renderDay(iso, { showBack }) {
  const info = dayInfo(iso);
  const w = weekNumberFor(iso);
  const isToday = iso === todayISO();

  header.innerHTML = `
    <p class="eyebrow">${showBack ? `<button class="link-btn" data-action="back">${ICONS.back} Woche ${w}</button> · ` : ""}${dayNameDE(iso)} · ${shortDate(iso)}${isToday ? " · heute" : ""}</p>
    <div class="title-row"><h1>${info.kind === "kraft" ? "Krafttraining" : info.kind === "lauf" ? "Lauf" : info.kind === "placeholder" ? `Woche ${w}` : "Ruhetag"}</h1>${badgeForKind(info)}</div>`;

  if (info.kind !== "kraft") { editMode = false; replaceFor = null; quickAdd = false; }
  if (info.kind === "kraft") return renderKraftDay(info, iso);
  if (info.kind === "lauf") return renderRunDay(info, iso);
  if (info.kind === "placeholder") {
    main.innerHTML = `<div class="card"><p class="name">Details folgen</p>
      <p class="hint">${esc(info.focus || "")} — die genauen Werte tragen wir nach der Re-Kalibrierung nach.</p></div>`;
    return;
  }
  main.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem 1rem;">
    <p class="name">Ruhetag</p><p class="hint">Mobility, Foam Rolling, Beine hoch.</p></div>`;
}

// ---------- Krafttag ----------
function setsCountFromSoll(soll) {
  const m = String(soll).match(/(\d+)\s*x/i);
  const n = m ? parseInt(m[1], 10) : 3;
  return Math.min(Math.max(n, 1), 8);
}

function numOrNull(v) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

function sameSets(sets) {
  if (!sets || sets.length < 2) return true;
  return sets.every((s) => s.kg === sets[0].kg && s.reps === sets[0].reps);
}

async function renderKraftDay(info, iso) {
  main.innerHTML = loadingCard("Lade gespeicherte Sätze …");

  let saved = {};
  let loadError = null;
  try {
    [saved, dayPlan, allLogs] = await Promise.all([
      loadLogsForDate(iso),
      loadDayPlan(iso),
      allLogs ? Promise.resolve(allLogs) : loadAllLogs(),
    ]);
  } catch (err) {
    console.error(err);
    dayPlan = { removed: [], added: [] };
    // Als Karte, nicht als Toast: die Meldung muss stehen bleiben, sonst
    // sieht man nur leere Felder und rät.
    loadError = err.source === "firebase" ? err.message : "Laden fehlgeschlagen: " + err.message;
  }

  currentKraftDay = { info, iso };
  buildLogState(effectiveExercises(info), saved);
  paintKraftDay(info, iso, loadError);
  fillSessionSlot(iso);
}

// Herzfrequenz und Dauer der Einheit aus Strava — ohne jede Eingabe.
// Über die einzelne Übung sagt das nichts, über die Einheit als Ganzes
// und ihren Verlauf über die Wochen schon.
async function fillSessionSlot(iso) {
  const slot = document.getElementById("session-slot");
  if (!slot) return;
  const s = await loadStrava();
  if (!slot.isConnected || s.error || !s.connected) return;
  const session = sessionForDate(iso);
  if (!session) return;
  slot.innerHTML = `<div class="card session-card">
    <div class="row" style="justify-content:space-between;">
      <p class="name">Einheit (Strava)</p>
      <span class="hint">${esc(formatDuration(session.movingTimeSec))}</span>
    </div>
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Ø HF</p><p class="metric-value" style="font-size:18px;">${session.avgHr ? session.avgHr + " bpm" : "–"}</p></div>
      <div><p class="metric-label">Max HF</p><p class="metric-value" style="font-size:18px;">${session.maxHr ? session.maxHr + " bpm" : "–"}</p></div>
    </div>
    ${session.effort != null ? `<p class="hint" style="margin-top:6px;">Relative Effort ${session.effort}</p>` : ""}
  </div>`;
}

// Plan-Übungen ohne die entfernten, plus die selbst hinzugefügten.
// Eine Ersetzung rückt an die Stelle der Übung, die sie ersetzt — sonst
// rutscht der Tausch ans Listenende und man sucht ihn.
function effectiveExercises(info) {
  const removed = new Set(dayPlan.removed);
  const replacements = new Map();
  for (const ex of dayPlan.added) if (ex.replaces) replacements.set(ex.replaces, ex);

  const out = [];
  for (const ex of info.exercises) {
    const sl = slug(ex.name);
    const rep = replacements.get(sl);
    if (rep) { out.push({ ...rep, custom: true }); continue; }
    if (removed.has(sl)) continue;
    out.push(ex);
  }
  for (const ex of dayPlan.added) if (!ex.replaces) out.push({ ...ex, custom: true });
  return out;
}

function buildLogState(exercises, saved) {
  logState.clear();
  for (const ex of exercises) {
    const s = slug(ex.name);
    const rec = saved[s];
    const count = setsCountFromSoll(ex.soll);
    const sets = rec?.sets?.length
      ? rec.sets.map((x) => ({ kg: x.kg ?? null, reps: x.reps ?? null }))
      : Array.from({ length: count }, () => ({ kg: null, reps: null }));
    logState.set(s, {
      slug: s, name: ex.name, soll: ex.soll, hint: ex.hint || "", custom: !!ex.custom,
      tip: progressionTip(s, ex.soll),
      setCount: Math.max(count, sets.length),
      sets,
      perSet: !sameSets(sets),
      saved: !!rec?.completed,
    });
  }
}

// Was die Zahlen vom letzten Mal für heute nahelegen — ersetzt die
// Frage nach dem Anstrengungsgrad.
function progressionTip(exSlug, soll) {
  if (!allLogs || !currentKraftDay.iso) return null;
  const history = allLogs.filter((l) => l.exercise === exSlug);
  return suggestProgression(soll, previousEntry(history, currentKraftDay.iso));
}

function paintKraftDay(info, iso, loadError) {
  const removedList = dayPlan.removed
    .map((sl) => info.exercises.find((ex) => slug(ex.name) === sl))
    .filter(Boolean);

  main.innerHTML =
    (loadError
      ? `<div class="card error-card">
           <p class="name">Gespeicherte Sätze nicht geladen</p>
           <p class="hint">${esc(loadError)}</p>
           <p class="hint" style="margin-top:6px;">Eintragen geht trotzdem — gespeichert wird aber erst, wenn das behoben ist.</p>
           <button data-action="reload" style="margin-top:8px;">Neu laden</button>
         </div>`
      : "") +
    `<div class="card summary-card">
       <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;">
         <div style="min-width:0;">
           <p class="name">${esc(info.label)}</p>
           <p class="hint" id="progress-line">${progressText()}</p>
         </div>
         <button class="small-btn" data-action="toggle-edit">${editMode ? "Fertig" : "Anpassen"}</button>
       </div>
     </div>` +
    `<div id="session-slot"></div>` +
    [...logState.values()].map(exerciseCard).join("") +
    (editMode ? "" : `<button class="add-inline" data-action="quick-add">+ Übung hinzufügen</button>`) +
    (quickAdd ? addFormHTML(iso) : "") +
    (editMode
      ? removedList.map((ex) => `<div class="card removed">
           <div class="row" style="justify-content:space-between;gap:10px;">
             <div style="min-width:0;"><p class="name">${esc(ex.name)}</p><p class="hint">Für diesen Tag entfernt</p></div>
             <button class="small-btn" data-action="restore-exercise" data-slug="${slug(ex.name)}">Zurückholen</button>
           </div></div>`).join("") +
        addFormHTML(iso)
      : "");
}

function addFormHTML(iso) {
  return `<div class="card">
    <p class="name">Übung hinzufügen</p>
    <p class="hint" style="margin-bottom:8px;">Gilt nur für diesen Tag (${shortDate(iso)}).</p>
    <div class="add-form">
      <input type="text" id="new-ex-name" placeholder="Name, z. B. Beinpresse" autocomplete="off" />
      <input type="text" id="new-ex-soll" placeholder="Soll, z. B. 3x8-10" autocomplete="off" />
      <div class="row" style="gap:8px;">
        <button class="save-btn" style="flex:1;" data-action="add-exercise">Hinzufügen</button>
        <button data-action="cancel-add">Abbrechen</button>
      </div>
    </div>
  </div>`;
}

function replaceFormHTML(st) {
  return `<div class="add-form">
    <p class="hint">Ersetzt ${esc(st.name)} an dieser Stelle.</p>
    <input type="text" id="rep-ex-name" placeholder="Neue Übung" value="" autocomplete="off" />
    <input type="text" id="rep-ex-soll" placeholder="Soll" value="${esc(st.soll)}" autocomplete="off" />
    <div class="row" style="gap:8px;">
      <button class="save-btn" style="flex:1;" data-action="confirm-replace" data-slug="${st.slug}">Übernehmen</button>
      <button data-action="cancel-replace">Abbrechen</button>
    </div>
  </div>`;
}

function progressText() {
  const total = logState.size;
  const done = [...logState.values()].filter((s) => s.saved).length;
  return `${done} von ${total} Übungen erfasst`;
}

function exerciseCard(st) {
  return `<div class="card${st.saved ? " done" : ""}" data-ex="${st.slug}">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;">
      <div style="min-width:0;">
        <p class="name">${esc(st.name)}${st.custom ? ' <span class="custom-tag">eigene</span>' : ""}</p>
        <p class="hint">Soll ${esc(st.soll)}${st.hint ? " · " + esc(st.hint) : ""}</p>
        ${st.tip ? `<p class="tip tip-${st.tip.level}">${esc(st.tip.text)}</p>` : ""}
      </div>
      ${editMode
        ? ""
        : `<button data-action="toggle-sets" data-slug="${st.slug}" class="small-btn">${st.perSet ? "Alle gleich" : "Sätze einzeln"}</button>`}
    </div>
    ${editMode && replaceFor !== st.slug
      ? `<div class="row edit-actions">
           <button class="small-btn" data-action="replace-exercise" data-slug="${st.slug}">Ersetzen</button>
           <button class="small-btn danger-btn" data-action="remove-exercise" data-slug="${st.slug}">Entfernen</button>
         </div>`
      : ""}
    <div class="ex-body">${
      replaceFor === st.slug ? replaceFormHTML(st) : st.perSet ? perSetRowsHTML(st) : simpleRowHTML(st)
    }</div>
    <p class="hint status" data-status="${st.slug}"></p>
  </div>`;
}

function saveButtonHTML(st, wide) {
  const label = st.saved ? "Gespeichert" : "Speichern";
  return `<button class="save-btn${wide ? " wide" : ""}${st.saved ? " is-saved" : ""}"
    data-action="save" data-slug="${st.slug}" aria-label="${label}">${ICONS.check}<span>${label}</span></button>`;
}

function simpleRowHTML(st) {
  const kg = st.sets[0]?.kg ?? "";
  const reps = st.sets[0]?.reps ?? "";
  return `<div class="row">
    <input type="number" inputmode="decimal" step="0.5" data-kg value="${kg}" placeholder="kg" aria-label="Gewicht" />
    <span class="times">×</span>
    <input type="number" inputmode="numeric" data-reps value="${reps}" placeholder="Wdh" aria-label="Wiederholungen" />
  </div>
  <p class="hint tiny">Gilt für alle ${st.setCount} Sätze</p>
  ${saveButtonHTML(st, true)}`;
}

function perSetRowsHTML(st) {
  let rows = "";
  for (let s = 0; s < st.setCount; s++) {
    const kg = st.sets[s]?.kg ?? "";
    const reps = st.sets[s]?.reps ?? "";
    rows += `<div class="set-row">
      <span class="set-label">Satz ${s + 1}</span>
      <input type="number" inputmode="decimal" step="0.5" data-kg value="${kg}" placeholder="kg" aria-label="Gewicht Satz ${s + 1}" />
      <input type="number" inputmode="numeric" data-reps value="${reps}" placeholder="Wdh" aria-label="Wiederholungen Satz ${s + 1}" />
    </div>`;
  }
  return rows + saveButtonHTML(st, true);
}

// Liest die aktuell sichtbaren Eingaben in den State zurück
function readCard(st) {
  const card = document.querySelector(`[data-ex="${st.slug}"]`);
  if (!card) return;
  // Zeigt die Karte gerade die Ersetzen-Maske, gibt es keine Eingabefelder
  if (!card.querySelector("[data-kg]")) return;
  if (st.perSet) {
    st.sets = [...card.querySelectorAll(".set-row")].map((row) => ({
      kg: numOrNull(row.querySelector("[data-kg]").value),
      reps: numOrNull(row.querySelector("[data-reps]").value),
    }));
  } else {
    const kg = numOrNull(card.querySelector("[data-kg]").value);
    const reps = numOrNull(card.querySelector("[data-reps]").value);
    st.sets = Array.from({ length: st.setCount }, () => ({ kg, reps }));
  }
}

function readAllCards() {
  for (const st of logState.values()) readCard(st);
}

function toggleSets(slugName) {
  const st = logState.get(slugName);
  if (!st) return;
  readCard(st);
  st.perSet = !st.perSet;
  const card = document.querySelector(`[data-ex="${slugName}"]`);
  card.querySelector(".ex-body").innerHTML = st.perSet ? perSetRowsHTML(st) : simpleRowHTML(st);
  card.querySelector("[data-action='toggle-sets']").textContent = st.perSet ? "Alle gleich" : "Sätze einzeln";
}

// --- Übungen anpassen ---
function toggleEditMode() {
  readAllCards();
  editMode = !editMode;
  replaceFor = null;
  quickAdd = false;
  paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null);
}

function persistDayPlan() {
  saveDayPlan(currentKraftDay.iso, dayPlan).catch((err) => {
    console.error(err);
    toast("Änderung an den Übungen nicht gespeichert: " + err.message, true);
  });
}

function removeExercise(slugName) {
  readAllCards();
  const st = logState.get(slugName);
  if (st?.custom) {
    const entry = dayPlan.added.find((ex) => slug(ex.name) === slugName);
    dayPlan.added = dayPlan.added.filter((ex) => slug(ex.name) !== slugName);
    // War es ein Tausch, soll die ursprüngliche Übung zurückkommen
    if (entry?.replaces) dayPlan.removed = dayPlan.removed.filter((x) => x !== entry.replaces);
  } else if (!dayPlan.removed.includes(slugName)) {
    dayPlan.removed.push(slugName);
  }
  refreshExercises();
}

function restoreExercise(slugName) {
  readAllCards();
  dayPlan.removed = dayPlan.removed.filter((s) => s !== slugName);
  refreshExercises();
}

function addExercise(replaces = null) {
  const nameEl = document.getElementById(replaces ? "rep-ex-name" : "new-ex-name");
  const sollEl = document.getElementById(replaces ? "rep-ex-soll" : "new-ex-soll");
  const name = (nameEl?.value || "").trim();
  const soll = (sollEl?.value || "").trim() || "3x8-10";
  if (!name) {
    nameEl?.focus();
    toast("Bitte einen Namen eintragen.", true);
    return;
  }
  const s = slug(name);
  if (!s) {
    toast("Der Name ergibt keine gültige Übung.", true);
    return;
  }
  if (logState.has(s)) {
    toast("Diese Übung steht heute schon auf der Liste.", true);
    return;
  }
  readAllCards();
  if (replaces) {
    // Tausch: die ersetzte Übung verschwindet, die neue rückt an ihre Stelle
    dayPlan.added = dayPlan.added.filter((ex) => ex.replaces !== replaces);
    dayPlan.added.push({ name, soll, hint: "Ersetzt " + (logState.get(replaces)?.name || replaces), replaces });
    if (!dayPlan.removed.includes(replaces)) dayPlan.removed.push(replaces);
  } else if (dayPlan.removed.includes(s)) {
    // Falls die Übung nur „entfernt" war: einfach wieder aufnehmen
    dayPlan.removed = dayPlan.removed.filter((x) => x !== s);
  } else {
    dayPlan.added.push({ name, soll, hint: "Eigene Übung" });
  }
  replaceFor = null;
  quickAdd = false;
  refreshExercises();
}

// Zustand der sichtbaren Eingaben behalten, Liste neu aufbauen
function refreshExercises() {
  const keep = {};
  for (const st of logState.values()) {
    keep[st.slug] = { sets: st.sets, completed: st.saved };
  }
  buildLogState(effectiveExercises(currentKraftDay.info), keep);
  persistDayPlan();
  paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null);
}

function saveExercise(slugName, dateISO) {
  const st = logState.get(slugName);
  if (!st) return;
  readCard(st);

  const hasInput = st.sets.some((s) => s.kg !== null || s.reps !== null);
  const status = document.querySelector(`[data-status="${slugName}"]`);
  if (!hasInput) {
    status.textContent = "Nichts eingetragen.";
    status.className = "hint status warn";
    return;
  }

  const payload = {
    week: weekNumberFor(dateISO),
    name: st.name,
    soll: st.soll,
    custom: st.custom,
    sets: st.sets.map((s) => ({ kg: s.kg, reps: s.reps })),
    topKg: Math.max(...st.sets.map((s) => s.kg ?? 0)),
    totalReps: st.sets.reduce((a, s) => a + (s.reps ?? 0), 0),
    completed: true,
  };

  // Optimistisch bestätigen: mit Offline-Cache landet der Schreibvorgang
  // lokal und wird später synchronisiert — das Promise löst dann erst
  // beim Sync auf, darauf wollen wir im Gym nicht warten.
  st.saved = true;
  status.textContent = "Gespeichert.";
  status.className = "hint status ok";
  const card = document.querySelector(`[data-ex="${slugName}"]`);
  card?.classList.add("done");
  const btn = card?.querySelector("[data-action='save']");
  if (btn) {
    btn.classList.add("is-saved");
    btn.querySelector("span").textContent = "Gespeichert";
  }
  const line = document.getElementById("progress-line");
  if (line) line.textContent = progressText();

  saveLog(dateISO, slugName, payload).catch((err) => {
    console.error(err);
    st.saved = false;
    status.textContent = "Speichern fehlgeschlagen: " + err.message;
    status.className = "hint status warn";
    card?.classList.remove("done");
    btn?.classList.remove("is-saved");
    if (btn) btn.querySelector("span").textContent = "Speichern";
  });
}

// ---------- Lauftag ----------
async function loadStrava({ force = false } = {}) {
  if (!force && stravaState.connected !== null) return stravaState;
  stravaState.error = null;
  stravaState.errorSource = null;
  try {
    const connected = await isAuthorized();
    stravaState.connected = connected;
    stravaState.runs = connected ? await fetchRecentRuns(STRAVA_SINCE, { force }) : null;
    if (connected) {
      runLinks = await loadRunLinks();
      recomputeAssignment();
    }
  } catch (err) {
    console.error(err);
    stravaState.error = err.message;
    // Ein Firestore-Fehler ist kein Strava-Fehler — sonst sucht man an
    // der falschen Stelle.
    stravaState.errorSource = err.source === "firebase" ? "firebase" : "strava";
    stravaState.runs = null;
    if (stravaState.errorSource === "firebase") stravaState.connected = null;
  }
  return stravaState;
}

// Alle Lauftage des Plans — Grundlage der Zuordnung
function allPlanRunDays() {
  const out = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const week = weeks[w];
    if (!week || week.placeholder) continue;
    for (const r of week.runs) out.push({ date: r.date, distKm: parseFloat(r.dist) || 0 });
  }
  return out;
}

function recomputeAssignment() {
  runAssignment = assignRuns(allPlanRunDays(), stravaState.runs || [], runLinks);
}

function setRunLink(planDate, activityId) {
  runLinks[planDate] = { activityId };
  recomputeAssignment();
  runPickerFor = null;
  render();
  saveRunLink(planDate, activityId).catch((err) => {
    console.error(err);
    toast("Zuordnung nicht gespeichert: " + err.message, true);
  });
}

function resetRunLink(planDate) {
  delete runLinks[planDate];
  recomputeAssignment();
  runPickerFor = null;
  render();
  clearRunLink(planDate).catch((err) => {
    console.error(err);
    toast("Zuordnung nicht zurückgesetzt: " + err.message, true);
  });
}

async function renderRunDay(info, iso) {
  main.innerHTML =
    planRunCard(info) +
    `<div id="strava-slot">${loadingCard("Strava wird geprüft …")}</div>` +
    `<div class="strava-note">${ICONS.run}<p>${esc(info.note || "Wird nicht hier eingetragen — die Daten kommen automatisch aus Strava.")}</p></div>`;

  const slot = document.getElementById("strava-slot");
  const s = await loadStrava();
  if (!slot.isConnected) return; // Nutzer hat inzwischen weitergeklickt
  slot.innerHTML = stravaResultHTML(s, iso);
}

function planRunCard(info) {
  return `<div class="card" style="background:var(--coral-bg);">
    <p class="name" style="color:var(--coral-fg);">${esc(info.type)}</p>
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Ziel-Distanz</p><p class="metric-value" style="color:var(--coral-fg);">${esc(info.dist)}</p></div>
      <div><p class="metric-label">Ziel-Pace</p><p class="metric-value" style="font-size:16px;">${esc(info.pace)}</p></div>
    </div>
    <p class="hint" style="margin-top:8px;">HF-Zone ${esc(info.hf)}</p>
  </div>`;
}

// Getrennte Karten für die beiden Fehlerwelten: an Firestore-Problemen
// hilft "Neu verbinden" nicht, und der Hinweis muss auf Firebase zeigen.
function problemCard(s) {
  if (s.errorSource === "firebase") {
    return `<div class="card error-card">
      <p class="name">Daten-Problem (Firebase)</p>
      <p class="hint">${esc(s.error)}</p>
      <p class="hint" style="margin-top:6px;">Nicht Strava, sondern der Datenspeicher. Prüfe in der Firebase-Console, ob die Anmeldeart <b>Anonymous</b> aktiviert und die Regeln aus <code>firestore.rules</code> veröffentlicht sind.</p>
      <button data-action="reload-strava" style="margin-top:8px;">Nochmal versuchen</button></div>`;
  }
  return `<div class="card error-card"><p class="name">Strava-Problem</p>
    <p class="hint">${esc(s.error)}</p>
    <div class="row" style="margin-top:8px;gap:8px;">
      <button data-action="reload-strava">Nochmal versuchen</button>
      <button data-action="connect-strava">Neu verbinden</button>
    </div></div>`;
}

function stravaResultHTML(s, iso) {
  if (!isWorkerConfigured) {
    return `<div class="card error-card">
      <p class="name">Strava noch nicht eingerichtet</p>
      <p class="hint">Der Token-Worker fehlt (siehe README, Abschnitt „Strava"). Ohne ihn kann der Browser sich nicht bei Strava anmelden.</p></div>`;
  }
  if (s.error) return problemCard(s);
  if (s.connected === false) {
    return `<button class="primary-btn" data-action="connect-strava" style="margin-top:10px;">Mit Strava verbinden</button>`;
  }

  const a = runAssignment[iso];
  const picker = runPickerFor === iso ? runPickerHTML(s, iso) : "";

  if (!a || !a.run) {
    return `<div class="card">
        <p class="name">Noch kein Lauf zugeordnet</p>
        <p class="hint">${a?.source === "ignored"
          ? "Für diesen Tag ist bewusst kein Lauf hinterlegt."
          : "In Strava liegt kein Lauf an diesem Tag und keiner in den Tagen danach."}</p>
        <div class="row" style="margin-top:8px;gap:8px;">
          <button data-action="pick-run" data-date="${iso}">Lauf zuordnen</button>
          ${a?.source === "ignored" ? `<button data-action="reset-run" data-date="${iso}">Automatik zurück</button>` : ""}
          <button class="icon-btn" data-action="reload-strava" aria-label="Neu laden">${ICONS.refresh}</button>
        </div>
      </div>${picker}`;
  }

  const m = a.run;
  const shifted = a.offset !== 0;
  return `<div class="card${shifted ? " shifted" : ""}" style="margin-top:10px;">
    <div class="row" style="justify-content:space-between;">
      <p class="name">Erfasst (Strava)</p>
      <button class="icon-btn" data-action="reload-strava" aria-label="Neu laden">${ICONS.refresh}</button>
    </div>
    <p class="hint">${esc(m.name)}</p>
    ${shifted
      ? `<p class="shift-note">${dayNameDE(m.date)}, ${shortDate(m.date)} · ${esc(offsetLabel(a.offset))}</p>`
      : ""}
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Distanz</p><p class="metric-value">${m.distanceKm.toFixed(1)} km</p></div>
      <div><p class="metric-label">Pace</p><p class="metric-value" style="font-size:18px;">${esc(m.paceLabel)}</p></div>
      <div><p class="metric-label">Dauer</p><p class="metric-value" style="font-size:18px;">${esc(formatDuration(m.movingTimeSec))}</p></div>
      <div><p class="metric-label">Ø HF</p><p class="metric-value" style="font-size:18px;">${m.avgHr ? m.avgHr + " bpm" : "–"}</p></div>
    </div>
    <div class="row" style="margin-top:10px;gap:8px;">
      ${a.source === "auto"
        ? `<button class="small-btn" data-action="ignore-run" data-date="${iso}">Passt nicht</button>` : ""}
      ${a.source === "manual"
        ? `<button class="small-btn" data-action="reset-run" data-date="${iso}">Zuordnung aufheben</button>` : ""}
      <button class="small-btn" data-action="pick-run" data-date="${iso}">Anderen Lauf</button>
    </div>
  </div>${picker}`;
}

function runPickerHTML(s, iso) {
  const options = pickableRuns(s.runs || [], runAssignment, iso);
  if (!options.length) {
    return `<div class="card">
      <p class="name">Kein Lauf zur Auswahl</p>
      <p class="hint">In Strava liegt im Umkreis von sieben Tagen kein freier Lauf.</p>
      <button data-action="close-picker" style="margin-top:8px;">Schließen</button></div>`;
  }
  const current = runAssignment[iso]?.run?.id;
  return `<div class="card">
    <div class="row" style="justify-content:space-between;">
      <p class="name">Lauf für ${dayNameDE(iso)}, ${shortDate(iso)}</p>
      <button class="small-btn" data-action="close-picker">Schließen</button>
    </div>
    ${options.map((r) => {
      const off = daysBetween(iso, r.date);
      return `<button class="pick-row${String(r.id) === String(current) ? " on" : ""}"
          data-action="assign-run" data-date="${iso}" data-run="${r.id}">
        <span class="pick-main">${dayNameDE(r.date)}, ${shortDate(r.date)}${off ? ` · ${off > 0 ? "+" : ""}${off} ${Math.abs(off) === 1 ? "Tag" : "Tage"}` : " · am Plantag"}</span>
        <span class="pick-sub">${esc(r.name)} · ${r.distanceKm.toFixed(1)} km · ${esc(r.paceLabel)}</span>
      </button>`;
    }).join("")}
    <button data-action="ignore-run" data-date="${iso}" style="width:100%;margin-top:8px;">Kein Lauf an diesem Tag</button>
  </div>`;
}

// ---------- Woche ----------
function renderWeek() {
  const w = state.weekNo;
  const week = weeks[w];
  const phase = phases.find((p) => p.n === week.phase);
  const start = weekStart(w);
  const isCurrent = w === weekNumberFor(todayISO());

  header.innerHTML = `
    <p class="eyebrow">Phase ${phase.n} – ${esc(phase.name)} · ${shortDate(start)}–${shortDate(addDays(start, 6))}${week.deload ? " · Deload" : ""}</p>
    <div class="title-row">
      <h1>Woche ${w} <span class="of">von ${TOTAL_WEEKS}</span></h1>
      <div class="row" style="gap:4px;">
        <button class="icon-btn" data-action="week-prev" ${w <= 1 ? "disabled" : ""} aria-label="Vorherige Woche">${ICONS.prev}</button>
        ${isCurrent ? "" : `<button class="small-btn" data-action="week-today">Heute</button>`}
        <button class="icon-btn" data-action="week-next" ${w >= TOTAL_WEEKS ? "disabled" : ""} aria-label="Nächste Woche">${ICONS.next}</button>
      </div>
    </div>`;

  if (week.placeholder) {
    main.innerHTML = `<div class="card"><p class="name">${esc(phase.name)}</p>
      <p class="hint">${esc(phase.focus)}. Details folgen nach der Re-Kalibrierung.</p></div>`;
    return;
  }

  const today = todayISO();
  const days = weekDates(w).map((iso) => {
    const info = dayInfo(iso);
    const [color, bg] = colorsFor(info);
    const label =
      info.kind === "ruhe" ? "Ruhe"
      : info.kind === "kraft" ? info.shortLabel
      : `${info.shortType}\n${info.dist}`;
    return { iso, info, color, bg, label };
  });

  main.innerHTML = `<div class="day-grid">
      ${days.map((d) => `<button class="day-pill${d.iso === today ? " today" : ""}" data-action="open-day" data-date="${d.iso}" style="background:${d.bg};">
        <p class="d" style="color:${d.color}">${dayNameDE(d.iso)}</p>
        <p class="t" style="color:${d.color}">${esc(d.label).replace("\n", "<br>")}</p>
      </button>`).join("")}
    </div>
    <p class="center-note">Tag antippen für Details</p>
    <div class="card">
      <p class="name">Wochenumfang Laufen</p>
      <p class="hint">${week.runs.map((r) => `${r.shortType} ${r.dist}`).join(" · ")} — zusammen ${weekKm(week)} km</p>
    </div>`;
}

function weekKm(week) {
  return week.runs.reduce((a, r) => a + (parseFloat(r.dist) || 0), 0);
}

// ---------- Verlauf ----------
async function renderHistory() {
  const m = state.historyMode;
  header.innerHTML = `<div class="title-row"><h1>Verlauf</h1>
    <div class="seg">
      <button data-action="hist-mode" data-mode="kraft" class="${m === "kraft" ? "on" : ""}">Kraft</button>
      <button data-action="hist-mode" data-mode="lauf" class="${m === "lauf" ? "on" : ""}">Lauf</button>
    </div></div>`;
  main.innerHTML = loadingCard();
  if (m === "kraft") await renderKraftHistory();
  else await renderRunHistory();
}

async function renderKraftHistory() {
  const options = exerciseCatalog
    .map((e) => `<option value="${slug(e.name)}" ${slug(e.name) === state.historyExercise ? "selected" : ""}>${esc(e.name)}</option>`)
    .join("");

  let logs = [];
  try {
    logs = await loadLogsForExercise(state.historyExercise);
  } catch (err) {
    main.innerHTML = errorCard("Verlauf konnte nicht geladen werden: " + err.message);
    return;
  }

  const points = logs
    .map((l) => {
      const sets = l.sets || [];
      const topKg = l.topKg ?? Math.max(0, ...sets.map((s) => s.kg ?? 0));
      const totalReps = l.totalReps ?? sets.reduce((a, s) => a + (s.reps ?? 0), 0);
      return { date: l.date, topKg, totalReps };
    })
    .filter((p) => p.topKg > 0 || p.totalReps > 0)
    .slice(-10);

  const usesWeight = points.some((p) => p.topKg > 0);
  const valueOf = (p) => (usesWeight ? p.topKg : p.totalReps);
  const unit = usesWeight ? "kg" : "Wdh";

  const picker = `<select id="ex-picker" aria-label="Übung wählen">${options}</select>`;

  if (!points.length) {
    main.innerHTML = `${picker}<p class="center-note">Noch nichts erfasst für diese Übung.</p>`;
    wirePicker();
    return;
  }

  main.innerHTML = `${picker}
    <div class="card">
      <p class="name">${usesWeight ? "Bestes Satzgewicht" : "Wiederholungen gesamt"}</p>
      <p class="hint">Letzte ${points.length} Einheiten</p>
      ${barsHTML(points.map((p) => ({ value: valueOf(p), label: shortDate(p.date), value_label: `${valueOf(p)} ${unit}` })), "var(--teal-fg)")}
    </div>
    <div class="card">
      <p class="name">Einträge</p>
      ${points.slice().reverse().map((p) => `<div class="row list-row"><span>${shortDate(p.date)}</span>
        <span style="color:var(--text-secondary)">${p.topKg > 0 ? p.topKg + " kg" : "–"} · ${p.totalReps} Wdh</span></div>`).join("")}
    </div>`;
  wirePicker();
}

function wirePicker() {
  const sel = document.getElementById("ex-picker");
  if (!sel) return;
  sel.addEventListener("change", () => {
    state.historyExercise = sel.value;
    renderHistory();
  });
}

async function renderRunHistory() {
  const s = await loadStrava();

  if (!isWorkerConfigured) {
    main.innerHTML = `<div class="card error-card"><p class="name">Strava noch nicht eingerichtet</p>
      <p class="hint">Siehe README, Abschnitt „Strava".</p></div>`;
    return;
  }
  if (s.error) {
    main.innerHTML = errorCard(s.error);
    return;
  }
  if (s.connected === false) {
    main.innerHTML = `<button class="primary-btn" data-action="connect-strava">Mit Strava verbinden</button>`;
    return;
  }
  const runs = s.runs || [];
  if (!runs.length) {
    main.innerHTML = `<p class="center-note">Noch keine Läufe seit ${shortDate(STRAVA_SINCE)} in Strava.</p>`;
    return;
  }

  const last = runs.slice(-10);
  const km7 = sumKm(runs, 7);
  const km28 = sumKm(runs, 28);
  const withPace = last.filter((r) => r.paceSecPerKm);
  const avgPace = withPace.length
    ? withPace.reduce((a, r) => a + r.paceSecPerKm, 0) / withPace.length
    : null;

  main.innerHTML = `
    <div class="card">
      <div class="metric-grid">
        <div><p class="metric-label">Letzte 7 Tage</p><p class="metric-value">${km7.toFixed(1)} km</p></div>
        <div><p class="metric-label">Letzte 28 Tage</p><p class="metric-value">${km28.toFixed(1)} km</p></div>
        <div><p class="metric-label">Ø Pace (${withPace.length} ${withPace.length === 1 ? "Lauf" : "Läufe"})</p><p class="metric-value" style="font-size:18px;">${esc(formatPace(avgPace))}</p></div>
        <div><p class="metric-label">Läufe gesamt</p><p class="metric-value">${runs.length}</p></div>
      </div>
    </div>
    <div class="card">
      <p class="name">Distanz je Lauf</p>
      <p class="hint">Label = Pace</p>
      ${barsHTML(last.map((r) => ({ value: r.distanceKm, label: esc(r.paceLabel.replace(" /km", "")), value_label: r.distanceKm.toFixed(1) + " km" })), "var(--coral-fg)")}
    </div>
    <div class="card">
      <p class="name">Läufe</p>
      ${last.slice().reverse().map((r) => `<div class="row list-row"><span>${shortDate(r.date)} ${esc(r.name)}</span>
        <span style="color:var(--text-secondary)">${r.distanceKm.toFixed(1)} km · ${esc(r.paceLabel)}</span></div>`).join("")}
    </div>`;
}

function sumKm(runs, days) {
  const today = todayISO();
  const cutoff = addDays(today, -days + 1);
  // Obergrenze heute: ein Lauf mit Datum in der Zukunft (Zeitzone, manuell
  // in Strava nachgetragen) gehört nicht in „die letzten 7 Tage".
  return runs.filter((r) => r.date >= cutoff && r.date <= today).reduce((a, r) => a + r.distanceKm, 0);
}

// Balken mit echten Höhen — Werte werden auf 8..90 px abgebildet.
function barsHTML(points, color) {
  const max = Math.max(...points.map((p) => p.value), 0);
  if (max <= 0) return `<p class="center-note">Keine Werte.</p>`;
  return `<div class="bars">
    ${points.map((p) => {
      const h = Math.max(8, Math.round((p.value / max) * 90));
      return `<div class="bar-col" title="${esc(p.value_label)}">
        <span class="bar-value">${esc(p.value_label)}</span>
        <div class="bar" style="height:${h}px;background:${color}"></div>
        <span class="bar-label">${p.label}</span>
      </div>`;
    }).join("")}
  </div>`;
}

// ---------- Plan ----------
function renderPlan() {
  const w = weekNumberFor(todayISO());
  const done = Math.max(0, w - 1);
  const pct = Math.round((done / TOTAL_WEEKS) * 100);

  header.innerHTML = `<h1>Trainingsplan</h1>
    <p class="eyebrow" style="margin-top:2px;">Woche ${w} von ${TOTAL_WEEKS} · ${pct}% geschafft</p>`;

  main.innerHTML = `
    <div class="card goal-card">
      <p class="metric-label">Ziel</p>
      <p class="goal-time">${esc(goal.time)}</p>
      <p class="hint" style="margin-top:4px;">${esc(goal.race)} · Renntempo ${esc(goal.targetPace)}</p>
      <div class="timeline">
        ${phases.map((p) => {
          const len = p.weeks[1] - p.weeks[0] + 1;
          // Anteil dieser Phase, der schon hinter dir liegt
          const fill = w > p.weeks[1] ? 100 : w < p.weeks[0] ? 0 : ((w - p.weeks[0] + 1) / len) * 100;
          return `<div class="seg tone-${p.tone}" style="flex:${len}" title="Phase ${p.n}"><i style="width:${fill}%"></i></div>`;
        }).join("")}
      </div>
      <div class="timeline-marker"><span>${shortDate(PLAN_START)}</span><span>Wettkampf</span></div>
      <div class="timeline-legend">
        ${phases.map((p) => `<span class="tone-${p.tone}"><i></i>${esc(p.name)}</span>`).join("")}
      </div>
    </div>

    ${phases.map((p) => {
      const current = w >= p.weeks[0] && w <= p.weeks[1];
      return `<div class="phase-card tone-${p.tone}${current ? " is-current" : ""}">
        <div class="phase-head">
          <p class="name">Phase ${p.n} – ${esc(p.name)}</p>
          <span class="phase-weeks">W${p.weeks[0]}–${p.weeks[1]}</span>
        </div>
        <p class="hint" style="margin-top:2px;">${esc(p.range)}</p>
        <p class="hint" style="margin-top:4px;">${esc(p.focus)}${current ? " · läuft gerade" : ""}</p>
      </div>`;
    }).join("")}

    <div class="card">
      <p class="name">Trainingsbereiche</p>
      ${zones.map((z) => {
        const [tag, label] = z.zone.split(" – ");
        return `<div class="zone-line tone-${z.tone}">
          <span class="zone-chip">${esc(tag)}</span>
          <span class="zname">${esc(label)}<br><span style="color:var(--text-muted);font-size:11px;">${esc(z.use)}</span></span>
          <span class="zvals">${esc(z.hf)} bpm<br>${esc(z.pace)}</span>
        </div>`;
      }).join("")}
    </div>`;
}

// ---------- Interaktion ----------
document.getElementById("app").addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "reload") return location.reload();
  if (action === "back") { state.selectedDate = null; runPickerFor = null; return render(); }
  if (action === "open-day") { state.selectedDate = target.dataset.date; runPickerFor = null; return render(); }
  if (action === "week-prev") { state.weekNo = Math.max(1, state.weekNo - 1); return render(); }
  if (action === "week-next") { state.weekNo = Math.min(TOTAL_WEEKS, state.weekNo + 1); return render(); }
  if (action === "week-today") { state.weekNo = weekNumberFor(todayISO()); return render(); }
  if (action === "toggle-sets") return toggleSets(target.dataset.slug);
  if (action === "toggle-edit") return toggleEditMode();
  if (action === "remove-exercise") return removeExercise(target.dataset.slug);
  if (action === "restore-exercise") return restoreExercise(target.dataset.slug);
  if (action === "add-exercise") return addExercise();
  if (action === "quick-add") { quickAdd = true; paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); document.getElementById("new-ex-name")?.focus(); return; }
  if (action === "cancel-add") { quickAdd = false; return paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); }
  if (action === "replace-exercise") { readAllCards(); replaceFor = target.dataset.slug; paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); document.getElementById("rep-ex-name")?.focus(); return; }
  if (action === "cancel-replace") { replaceFor = null; return paintKraftDay(currentKraftDay.info, currentKraftDay.iso, null); }
  if (action === "confirm-replace") return addExercise(target.dataset.slug);
  if (action === "save") return saveExercise(target.dataset.slug, currentDateISO());
  if (action === "hist-mode") { state.historyMode = target.dataset.mode; return render(); }
  if (action === "connect-strava") return startAuthorization();
  if (action === "pick-run") { runPickerFor = target.dataset.date; return render(); }
  if (action === "close-picker") { runPickerFor = null; return render(); }
  if (action === "assign-run") return setRunLink(target.dataset.date, Number(target.dataset.run));
  if (action === "ignore-run") return setRunLink(target.dataset.date, null);
  if (action === "reset-run") return resetRunLink(target.dataset.date);
  if (action === "reload-strava") {
    target.disabled = true;
    await loadStrava({ force: true });
    recomputeAssignment();
    return render();
  }
});

function currentDateISO() {
  return state.tab === "woche" && state.selectedDate ? state.selectedDate : todayISO();
}

document.querySelectorAll("#tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tabbar button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.tab = btn.dataset.tab;
    state.selectedDate = null;
    runPickerFor = null;
    if (state.tab === "woche") state.weekNo = weekNumberFor(todayISO());
    render();
  });
});

// ---------- Start ----------
(async function init() {
  const hasRedirect = /[?&](code|error)=/.test(location.search);
  document.querySelector('[data-tab="heute"]').classList.add("active");

  if (hasRedirect) {
    header.innerHTML = `<h1>Strava</h1>`;
    main.innerHTML = loadingCard("Strava-Verbindung wird abgeschlossen …");
    const res = await handleAuthRedirect();
    if (res.status === "connected") toast("Mit Strava verbunden.");
    else if (res.status !== "none") toast(res.message, true);
  }

  // Anmeldung früh anstoßen, damit der erste Firestore-Zugriff nicht wartet.
  ensureSignedIn().catch((err) => {
    console.error(err);
    toast("Firebase-Anmeldung fehlgeschlagen: " + err.message, true);
  });

  render();
})();
