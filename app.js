import { goal, zones, phases, weeks } from "./plan.js";
import { saveLog, loadLog } from "./firebase-init.js";
import { isAuthorized, startAuthorization, handleAuthRedirect, fetchRecentRuns, matchRunForDate } from "./strava.js";

const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/></svg>',
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none"/><path d="M13 7l-2 3 3 2 1 5M11 10l-4 1-2 4M8 14l-3 1M13.5 11l3 1 2-2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const todayISO = () => new Date().toISOString().slice(0, 10);
const dayNameDE = (d) => ["So","Mo","Di","Mi","Do","Fr","Sa"][new Date(d + "T12:00:00").getDay()];

function currentWeekNumber() {
  const start = new Date("2026-08-31T00:00:00");
  const now = new Date();
  const diffDays = Math.floor((now - start) / 86400000);
  const w = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(w, 1), 31);
}

let stravaRuns = null; // cache

const header = document.getElementById("header");
const main = document.getElementById("main");

function badge(text, color, bg) {
  return `<span class="badge" style="background:${bg};color:${color}">${text}</span>`;
}

// ---------- Heute ----------
async function renderToday() {
  const dateISO = todayISO();
  const w = currentWeekNumber();
  const week = weeks[w];
  const dow = new Date(dateISO + "T12:00:00").getDay(); // 0=So..6=Sa

  header.innerHTML = `
    <p class="eyebrow">${dayNameDE(dateISO)} · ${dateISO.split("-").reverse().slice(0,2).join(".")}.</p>
    <div class="title-row"><h1>Woche ${w}</h1></div>`;

  if (week.placeholder) {
    main.innerHTML = `<div class="card"><p class="name">Details folgen</p><p class="hint">Phase ${week.phase} — ${week.focus}. Genaue Werte werden nach der jeweiligen Re-Kalibrierung ergänzt.</p></div>`;
    return;
  }

  let dayInfo = null;
  if (dow === 2 && week.kraft.di.date === dateISO) dayInfo = { kind: "kraft", ...week.kraft.di };
  else if (dow === 4 && week.kraft.do.date === dateISO) dayInfo = { kind: "kraft", ...week.kraft.do };
  else {
    const run = week.runs.find((r) => r.date === dateISO);
    if (run) dayInfo = { kind: "lauf", ...run };
  }
  if (!dayInfo) dayInfo = { kind: "ruhe" };

  header.querySelector(".title-row").innerHTML += badgeForKind(dayInfo);
  await renderDayBody(dayInfo, dateISO, true);
}

function badgeForKind(info) {
  if (info.kind === "kraft") return badge(info.label, "var(--teal)", "var(--teal-bg)");
  if (info.kind === "lauf") return badge(info.type, "var(--coral)", "var(--coral-bg)");
  return badge("Ruhe", "var(--text-secondary)", "var(--surface-1)");
}

async function renderDayBody(info, dateISO, editable) {
  if (info.kind === "kraft") {
    main.innerHTML = info.exercises.map((ex, i) => exerciseCard(ex, i, editable)).join("");
    if (editable) await wireExerciseCards(info.exercises, dateISO);
    else disableInputs();
  } else if (info.kind === "lauf") {
    main.innerHTML = await laufPanel(info, editable);
  } else {
    main.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem 1rem;"><p class="name">Ruhetag</p><p class="hint">Mobility, Foam Rolling, Beine hoch.</p></div>`;
  }
}

function exerciseCard(ex, idx, editable) {
  return `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start;">
      <div><p class="name">${ex.name}</p><p class="hint">Soll ${ex.soll} · ${ex.hint}</p></div>
      ${editable ? `<button data-toggle="${idx}">Sätze einzeln</button>` : ""}
    </div>
    <div data-body="${idx}" style="margin-top:10px;"></div>
  </div>`;
}

function setsCountFromSoll(soll) {
  const m = soll.match(/^(\d+)x/);
  return m ? parseInt(m[1], 10) : 3;
}

function simpleRowHTML(idx, saved) {
  const kg = saved?.sets?.[0]?.kg ?? "";
  const reps = saved?.sets?.[0]?.reps ?? "";
  return `<div class="row">
    <input type="number" data-kg="${idx}" value="${kg}" placeholder="kg" />
    <span style="color:var(--text-muted);font-size:12px;">×</span>
    <input type="number" data-reps="${idx}" value="${reps}" placeholder="Wdh" />
    <button class="icon-btn" data-save="${idx}">${ICONS.check}</button>
  </div>`;
}

function perSetRowsHTML(idx, sets, saved) {
  let rows = "";
  for (let s = 0; s < sets; s++) {
    const kg = saved?.sets?.[s]?.kg ?? "";
    const reps = saved?.sets?.[s]?.reps ?? "";
    rows += `<div class="set-row">
      <span class="set-label">Satz ${s + 1}</span>
      <input type="number" data-kg="${idx}" data-set="${s}" value="${kg}" placeholder="kg" />
      <input type="number" data-reps="${idx}" data-set="${s}" value="${reps}" placeholder="Wdh" />
    </div>`;
  }
  rows += `<button data-save="${idx}" style="width:100%;margin-top:4px;">Speichern</button>`;
  return rows;
}

async function wireExerciseCards(exercises, dateISO) {
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const exSlug = slug(ex.name);
    const saved = await loadLog(dateISO, exSlug);
    const body = document.querySelector(`[data-body="${i}"]`);
    let perSet = false;
    body.innerHTML = simpleRowHTML(i, saved);
    wireSave(i, ex, dateISO, exSlug, () => perSet);

    const toggleBtn = document.querySelector(`[data-toggle="${i}"]`);
    toggleBtn.addEventListener("click", () => {
      perSet = !perSet;
      toggleBtn.textContent = perSet ? "Alle Sätze gleich" : "Sätze einzeln";
      const sets = setsCountFromSoll(ex.soll);
      body.innerHTML = perSet ? perSetRowsHTML(i, sets, saved) : simpleRowHTML(i, saved);
      wireSave(i, ex, dateISO, exSlug, () => perSet);
    });
  }
}

function wireSave(idx, ex, dateISO, exSlug, isPerSet) {
  const btn = document.querySelector(`[data-save="${idx}"]`);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const kgInputs = document.querySelectorAll(`[data-kg="${idx}"]`);
    const repInputs = document.querySelectorAll(`[data-reps="${idx}"]`);
    const sets = [];
    kgInputs.forEach((el, i) => {
      sets.push({ kg: Number(el.value) || 0, reps: Number(repInputs[i]?.value) || 0 });
    });
    await saveLog(dateISO, exSlug, { week: currentWeekNumber(), name: ex.name, sets, completed: true });
    btn.innerHTML = ICONS.check;
    btn.style.color = "var(--teal)";
  });
}

function disableInputs() {
  main.querySelectorAll("input").forEach((i) => (i.disabled = true));
}

async function laufPanel(info, editable) {
  if (stravaRuns === null) {
    const authorized = await isAuthorized();
    stravaRuns = authorized ? await fetchRecentRuns("2026-08-01") : false;
  }
  const match = stravaRuns ? matchRunForDate(stravaRuns, info.date) : null;

  let resultHTML = "";
  if (match) {
    resultHTML = `<div class="card" style="margin-top:10px;">
      <p class="name">Erfasst (Strava)</p>
      <div class="metric-grid" style="margin-top:8px;">
        <div><p class="metric-label">Distanz</p><p class="metric-value">${match.distanceKm} km</p></div>
        <div><p class="metric-label">Pace</p><p class="metric-value" style="font-size:16px;">${match.paceMinPerKm}</p></div>
      </div>
      ${match.avgHr ? `<p class="hint" style="margin-top:6px;">Ø HF ${match.avgHr} bpm</p>` : ""}
    </div>`;
  } else if (stravaRuns === false) {
    resultHTML = `<button class="primary-btn" id="connect-strava" style="margin-top:10px;">Mit Strava verbinden</button>`;
  } else {
    resultHTML = `<p class="center-note" style="margin-top:10px;">Noch kein passender Lauf in Strava gefunden.</p>`;
  }

  return `<div class="card" style="background:var(--coral-bg);">
    <p class="name" style="color:var(--coral);">${info.type}</p>
    <div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Ziel-Distanz</p><p class="metric-value" style="color:var(--coral);">${info.dist}</p></div>
      <div><p class="metric-label">Ziel-Pace</p><p class="metric-value" style="font-size:16px;">${info.pace}</p></div>
    </div>
    <p class="hint" style="margin-top:8px;">HF-Zone ${info.hf}</p>
  </div>
  ${resultHTML}
  <div class="strava-note">${ICONS.run}<p>${info.note || "Wird nicht hier eingetragen — Daten kommen automatisch aus Strava."}</p></div>`;
}

// ---------- Woche ----------
function renderWeek() {
  const w = currentWeekNumber();
  const week = weeks[w];
  const phase = phases.find((p) => p.n === week.phase);
  header.innerHTML = `<h1>Woche ${w} von 31</h1><p class="eyebrow" style="margin-top:2px;">Phase ${phase.n} – ${phase.name} · ${week.dateRange || phase.range}</p>`;

  if (week.placeholder) {
    main.innerHTML = `<div class="card"><p class="name">${phase.name}</p><p class="hint">${phase.focus}. Details folgen nach Re-Kalibrierung.</p></div>`;
    return;
  }

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date("2026-08-31T12:00:00");
    date.setDate(date.getDate() + (w - 1) * 7 + i);
    const iso = date.toISOString().slice(0, 10);
    let info = null, color = "var(--text-secondary)", bg = "var(--surface-1)";
    if (week.kraft.di.date === iso) { info = { kind: "kraft", ...week.kraft.di }; color = "var(--teal)"; bg = "var(--teal-bg)"; }
    else if (week.kraft.do.date === iso) { info = { kind: "kraft", ...week.kraft.do }; color = "var(--teal)"; bg = "var(--teal-bg)"; }
    else {
      const run = week.runs.find((r) => r.date === iso);
      if (run) { info = { kind: "lauf", ...run }; color = run.type === "Long run" ? "var(--purple)" : "var(--coral)"; bg = run.type === "Long run" ? "var(--purple-bg)" : "var(--coral-bg)"; }
    }
    if (!info) info = { kind: "ruhe" };
    days.push({ iso, info, color, bg, label: info.kind === "ruhe" ? "Ruhe" : (info.label || info.type) });
  }

  main.innerHTML = `<div class="day-grid">
    ${days.map((d, i) => `<button class="day-pill" data-day="${i}" style="background:${d.bg};">
      <p class="d" style="color:${d.color}">${dayNameDE(d.iso)}</p>
      <p class="t" style="color:${d.color}">${d.label}</p>
    </button>`).join("")}
  </div><p class="center-note">Tag antippen für Details</p>`;

  days.forEach((d, i) => {
    document.querySelector(`[data-day="${i}"]`).addEventListener("click", async () => {
      header.innerHTML = `<p class="eyebrow">${dayNameDE(d.iso)} · ${d.iso.split("-").reverse().slice(0,2).join(".")}.</p><div class="title-row"><h1>Woche ${w}</h1>${badgeForKind(d.info)}</div>`;
      await renderDayBody(d.info, d.iso, d.iso === todayISO());
    });
  });
}

// ---------- Verlauf ----------
async function renderHistory(mode = "kraft") {
  header.innerHTML = `<div class="title-row"><h1>Verlauf</h1>
    <div class="row" style="gap:4px;">
      <button data-v="kraft" style="background:${mode === "kraft" ? "var(--teal-bg)" : "transparent"};color:${mode === "kraft" ? "var(--teal)" : "var(--text-secondary)"}">Kraft</button>
      <button data-v="lauf" style="background:${mode === "lauf" ? "var(--coral-bg)" : "transparent"};color:${mode === "lauf" ? "var(--coral)" : "var(--text-secondary)"}">Lauf</button>
    </div></div>`;
  document.querySelector('[data-v="kraft"]').addEventListener("click", () => renderHistory("kraft"));
  document.querySelector('[data-v="lauf"]').addEventListener("click", () => renderHistory("lauf"));

  if (mode === "kraft") {
    const w = currentWeekNumber();
    const vals = [];
    for (let i = 1; i <= Math.min(w, 8); i++) {
      const wk = weeks[i];
      if (wk.placeholder) continue;
      const log = await loadLog(wk.kraft.di.date, "squats");
      vals.push(log?.sets?.[0]?.kg || 0);
    }
    const max = Math.max(...vals, 1);
    main.innerHTML = `<p class="name">Squats · Gewicht pro Woche</p>
      <div class="bars" style="margin-top:10px;">
        ${vals.map((v, i) => `<div class="bar-col"><div class="bar" style="height:${(v / max) * 90 || 2}px"></div><span class="bar-label">W${i + 1}</span></div>`).join("")}
      </div>
      <p class="center-note">Läuft analog für jede Übung.</p>`;
  } else {
    const authorized = await isAuthorized();
    const runs = authorized ? await fetchRecentRuns("2026-08-01") : null;
    if (!runs || !runs.length) {
      main.innerHTML = `<p class="center-note">Noch keine Strava-Läufe gefunden.</p>`;
      return;
    }
    const points = runs.slice(-8);
    main.innerHTML = `<p class="name">Easy-run Pace (min/km)</p>
      <div class="bars" style="margin-top:10px;align-items:flex-end;">
        ${points.map((p) => `<div class="bar-col"><div class="bar" style="height:${40};background:var(--coral)"></div><span class="bar-label">${p.paceMinPerKm}</span></div>`).join("")}
      </div>`;
  }
}

// ---------- Plan ----------
function renderPlan() {
  header.innerHTML = `<h1>Trainingsplan</h1><p class="eyebrow" style="margin-top:2px;">31 Wochen · Ziel ${goal.time}, ${goal.race}</p>`;
  main.innerHTML = phases.map((p) => `<div class="card">
    <p class="name">Phase ${p.n} – ${p.name}</p>
    <p class="hint" style="margin-top:2px;">${p.range}</p>
    <p class="hint" style="margin-top:4px;color:var(--text-secondary);">${p.focus}</p>
  </div>`).join("") + `<div class="card"><p class="name">Trainingsbereiche</p>
    ${zones.map((z) => `<div class="row" style="justify-content:space-between;margin-top:6px;font-size:13px;">
      <span>${z.zone}</span><span style="color:var(--text-secondary);">${z.pace}</span>
    </div>`).join("")}
  </div>`;
}

// ---------- Tabs ----------
document.querySelectorAll("#tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tabbar button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    if (tab === "heute") renderToday();
    if (tab === "woche") renderWeek();
    if (tab === "verlauf") renderHistory();
    if (tab === "plan") renderPlan();
  });
});

// ---------- Start ----------
(async function init() {
  await handleAuthRedirect();
  renderToday();
  document.querySelector('[data-tab="heute"]').classList.add("active");

  main.addEventListener("click", (e) => {
    if (e.target.id === "connect-strava") startAuthorization();
  });
})();
