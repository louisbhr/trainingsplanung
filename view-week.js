// Rendering des Wochen-Tabs (F9, M2-7). Reine Render-Funktionen wie
// view-dashboard.js — Datenzugriff und Klick-Verdrahtung bleiben in app.js.
//
// Antippen klappt die Details der Zeile auf (Ziel, Ist, Hinweis, bei Kraft
// die Übungsliste); "Tag öffnen" führt von dort in die Tagesansicht mit
// Lauf-Zuordnung und Satz-Eingabe. Die Zeile ist deshalb kein Button,
// sondern ein Container mit zwei Knöpfen, damit keine Buttons geschachtelt
// werden.
import { esc, ICONS } from "./ui.js?v=202609290821";

export function weekNavHTML({ n, weekType, dateRange, hasPrev, hasNext, showToday }) {
  return `<div class="week-nav">
    <button type="button" class="icon-btn" data-action="week-prev" ${hasPrev ? "" : "disabled"} aria-label="Vorherige Woche">${ICONS.prev}</button>
    <div class="titles">
      <p class="t1">Woche ${n} · ${esc(weekType)}</p>
      <p class="t2">${esc(dateRange)}</p>
    </div>
    <button type="button" class="icon-btn" data-action="week-next" ${hasNext ? "" : "disabled"} aria-label="Nächste Woche">${ICONS.next}</button>
  </div>
  ${showToday ? `<button type="button" class="small-btn" data-action="week-today" style="display:block;margin:8px auto 0;">Heute</button>` : ""}`;
}

export function weekSummaryHTML({ ist, soll, pct, kraftDone, kraftPlanned }) {
  return `<div class="week-summary">
    <div class="line"><span class="lbl">Laufvolumen</span>
      <span class="val">${ist != null ? ist + " / " : ""}${soll} km</span></div>
    <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    <div class="line"><span class="lbl">Kraft</span>
      <span class="val">${kraftDone}/${kraftPlanned} Einheiten</span></div>
  </div>`;
}

export function restRowHTML(d, dt) {
  return `<div class="day-row rest">
    <div class="head">
      <div class="dcol"><p class="d">${esc(d)}</p><p class="dt">${esc(dt)}</p></div>
      <div class="mid"><p class="n">Ruhe</p></div>
    </div>
  </div>`;
}

export function dayRowHTML(day) {
  const detailId = `dayDetail-${day.iso}`;
  const lines = day.detailLines
    .map((l) => `<p${l.cls ? ` class="${l.cls}"` : ""}>${l.label ? `<span class="muted">${esc(l.label)}</span> ` : ""}${esc(l.text)}</p>`)
    .join("");
  return `<div class="day-row solid${day.isToday ? " today" : ""}" data-date="${day.iso}">
    <button type="button" class="day-toggle" data-action="toggle-day-detail" aria-expanded="false" aria-controls="${detailId}">
      <span class="head">
        <span class="dcol"><span class="d" style="color:${day.kindColorVar}">${esc(day.d)}</span><span class="dt">${esc(day.dt)}</span></span>
        <span class="mid">
          <span class="n">${esc(day.sessionName)}</span>
          <span class="s">${day.hasActual ? "Ist: " + esc(day.actualText) : "Ziel: " + esc(day.targetText)}</span>
        </span>
        ${day.statusHTML}
      </span>
    </button>
    <div class="day-detail" id="${detailId}">
      ${lines}
      <button type="button" class="small-btn day-open" data-action="open-day" data-date="${day.iso}">Tag öffnen</button>
    </div>
  </div>`;
}

export const statusCheckHTML = () => `<span class="status-icon" style="color:var(--ok-fg);">${ICONS.check}</span>`;
export const statusWarnHTML = () => `<span class="status-icon" style="color:var(--amber-fg);">${ICONS.warn}</span>`;
export const statusMissedHTML = () => `<span class="missed-pill">verpasst</span>`;
export const statusTodayHTML = () => `<span class="today-pill">Heute</span>`;
export const statusPartialHTML = (done, total, isToday = false) =>
  `<span class="partial-pill">${isToday ? "Heute · " : ""}${done}/${total}</span>`;
export const statusFutureHTML = () => `<span class="status-icon" style="color:var(--text-muted);">${ICONS.dash}</span>`;

export function planBeendetHintHTML(lastWeek) {
  return `<p class="hint center">Plan beendet – zeigt Woche ${lastWeek}.</p>`;
}
