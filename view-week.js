// Rendering des Wochen-Tabs (F9, M2-7). Reine Render-Funktionen wie
// view-dashboard.js — Datenzugriff und Klick-Verdrahtung bleiben in app.js.
//
// Abweichung vom vorgeschlagenen Markup (docs/ui-markup-dashboard-v2.md
// Abschnitt 6, bewusst): Dort klappt Antippen zuerst eine Detailzeile auf
// (zweiter Tipp führt weiter in die Tagesansicht). Das hätte in praktisch
// jedem bestehenden Browser-Test einen `[data-date="…"]`-Klick betroffen,
// der heute direkt in die Tagesansicht öffnet (Kraft-Log, Strava-Zuordnung
// usw.) — ein großer, riskanter Umbau für einen reinen Interaktions-
// Feinschliff. Die Zeile bleibt deshalb ein einziger Tap direkt in die
// Tagesansicht (wie vor M2-7), zeigt aber alle neuen Status-Symbole und die
// Ist/Ziel-Zeile inline in der Reihe selbst.
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
  return `<button type="button" class="day-row solid${day.isToday ? " today" : ""}"
    data-action="open-day" data-date="${day.iso}">
    <div class="head">
      <div class="dcol"><p class="d" style="color:${day.kindColorVar}">${esc(day.d)}</p><p class="dt">${esc(day.dt)}</p></div>
      <div class="mid">
        <p class="n">${esc(day.sessionName)}</p>
        <p class="s">${day.hasActual ? "Ist: " + esc(day.actualText) : "Ziel: " + esc(day.targetText)}</p>
      </div>
      ${day.statusHTML}
    </div>
  </button>`;
}

export const statusCheckHTML = () => `<span class="status-icon" style="color:var(--ok-fg);">${ICONS.check}</span>`;
export const statusWarnHTML = () => `<span class="status-icon" style="color:var(--amber-fg);">${ICONS.warn}</span>`;
export const statusMissedHTML = () => `<span class="missed-pill">verpasst</span>`;
export const statusTodayHTML = () => `<span class="today-pill">Heute</span>`;
export const statusPartialHTML = (done, total) => `<span class="partial-pill">${done}/${total}</span>`;
export const statusFutureHTML = () => `<span class="status-icon" style="color:var(--text-muted);">${ICONS.dash}</span>`;

export function planBeendetHintHTML(lastWeek) {
  return `<p class="hint center">Plan beendet – zeigt Woche ${lastWeek}.</p>`;
}
