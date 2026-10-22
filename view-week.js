// Rendering des Wochen-Tabs (Stride E4). Reine Render-Funktionen: sie bekommen
// fertige Daten und geben HTML-Strings zurück. State, Datenzugriff und die
// Klick-Verdrahtung bleiben in app.js (Auflage C5: dieses Modul importiert nie
// Firebase, Strava oder app.js). Keine eigenen Styles und kein style="...":
// alle Klassen kommen aus style.css, das Markup steht in
// docs/ui-markup-stride.md, Abschnitt 10. Fremde Texte immer durch esc().
//
// Die Tageszeile ist ein Akkordeon: der Zeilen-Button klappt die Details auf,
// "Tag öffnen" (eigener Button im Detail, keine verschachtelten Buttons) führt
// in die Tagesansicht.
import { formatKm } from "./metrics.js?v=202610221430";
import { esc, checkCircle, ringOpen, pill, numAttr, MONTHS_DE } from "./ui.js?v=202610221430";

const I_CHEV_L20 = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const I_CHEV_R20 = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const I_CHEV_R = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

// Streifenklasse aus fester Map, nie aus Daten (Markup 10.3).
const STRIPE_CLASS = { kraft: " sd-stripe--kraft", lauf: " sd-stripe--lauf", long: " sd-stripe--long" };

// ---------- Kopf (10.1) ----------
// "19.–25. Oktober" im selben Monat, "28. Oktober–3. November" über den Monatswechsel.
export function weekRangeText(startISO, endISO) {
  const d = (iso) => Number(iso.slice(8, 10));
  const m = (iso) => MONTHS_DE[Number(iso.slice(5, 7)) - 1];
  return startISO.slice(5, 7) === endISO.slice(5, 7)
    ? `${d(startISO)}.–${d(endISO)}. ${m(endISO)}`
    : `${d(startISO)}. ${m(startISO)}–${d(endISO)}. ${m(endISO)}`;
}

export function weekHeadHTML({ n, weekType, dateRange, hasPrev, hasNext, showToday }) {
  const sub = weekType ? `${dateRange} · ${weekType}` : dateRange;
  const today = showToday
    ? `<div class="sd-weekhead__today"><button type="button" class="sd-pillbtn" data-action="week-today">Zu heute</button></div>`
    : "";
  return `<div class="sd-weekhead">
  <div class="sd-weekhead__titles"><p class="sd-intro__sub">${esc(sub)}</p><h1 class="sd-display">Woche ${n}</h1></div>
  <div class="sd-weeknav" role="group" aria-label="Woche wechseln">
    <button type="button" class="sd-roundbtn" data-action="week-prev"${hasPrev ? "" : " disabled"} aria-label="Vorherige Woche">${I_CHEV_L20}</button>
    <button type="button" class="sd-roundbtn" data-action="week-next"${hasNext ? "" : " disabled"} aria-label="Nächste Woche">${I_CHEV_R20}</button>
  </div>${today}
</div>`;
}

// ---------- Summen-Karte (10.2) ----------
// istKm: null = kein Ist bekannt (Strava aus/lädt): dann nur das Soll.
// sollKm <= 0 und kraftPlanned = 0 lassen die jeweilige Spalte entfallen.
export function weekSumsHTML({ sollKm, istKm, kraftDone, kraftPlanned }) {
  const lauf = sollKm > 0
    ? `<div class="sd-sum" data-sum="lauf">
    <p class="sd-sum__label">Laufvolumen</p>
    <p class="sd-sum__value sd-mono">${istKm != null
      ? `${formatKm(istKm)} / ${formatKm(sollKm)}<span class="sd-unit">km</span>`
      : `${formatKm(sollKm)}<span class="sd-unit">km</span><span class="sd-vh">geplant</span>`}</p>
    <progress class="sd-prog sd-prog--coral" value="${numAttr(istKm ?? 0)}" max="${numAttr(sollKm)}" aria-label="Laufvolumen in Kilometern"></progress>
  </div>`
    : "";
  const kraft = kraftPlanned > 0
    ? `<div class="sd-sum" data-sum="kraft">
    <p class="sd-sum__label">Kraft</p>
    <p class="sd-sum__value sd-mono">${kraftDone} / ${kraftPlanned}<span class="sd-unit">Einheiten</span></p>
    <progress class="sd-prog" value="${numAttr(kraftDone)}" max="${numAttr(kraftPlanned)}" aria-label="Krafteinheiten"></progress>
  </div>`
    : "";
  if (!lauf && !kraft) return "";
  return `<section class="sd-card sd-sums" data-card="week-sums" aria-labelledby="weekSumsTitle">
  <h2 class="sd-vh" id="weekSumsTitle">Wochensumme</h2>
  ${lauf}${kraft}
</section>`;
}

// ---------- Status-Spalte (10.3) ----------
// status: { key, kind, done, total }. Genau eine Variante pro Zeile; die Rangfolge
// entscheidet app.js (weekDayStatus), hier wird nur gezeichnet.
//   key: future | done | hf | short | moved | partial | todayPartial | today | missed | optional
export function statusHTML({ key, kind = "kraft", done = 0, total = 0 }) {
  switch (key) {
    case "done": return `${checkCircle(kind, 22)}<span class="sd-vh">erledigt</span>`;
    case "hf": return pill("amber", "HF zu hoch");
    case "short": return pill("amber", "zu kurz");
    case "moved": return pill("amber", "nachgeholt");
    case "partial": return pill("amber", `${done}/${total}`);
    case "todayPartial": return pill("primary", `Heute · ${done}/${total}`);
    case "today": return pill("primary", "Heute");
    case "missed": return pill("danger", "verpasst");
    case "optional": return pill("optional", "optional");
    default: return `${ringOpen(22)}<span class="sd-vh">offen</span>`;
  }
}

// ---------- Tageszeilen (10.3, 10.4, 10.5) ----------
function whenHTML(day) {
  const long = day.isToday ? `${day.dowLong}, heute` : day.dowLong;
  return `<span class="sd-day__when">
      <span class="sd-day__dow"><span aria-hidden="true">${esc(day.dow)}</span><span class="sd-vh">${esc(long)}</span></span>
      <span class="sd-day__date sd-mono">${esc(day.dayOfMonth)}</span>
    </span>`;
}

// Ruhetag: kein Button, kein aria-expanded, kein data-action, nicht fokussierbar.
export function restRowHTML(day) {
  return `<div class="sd-day is-rest${day.isToday ? " is-today" : ""}" role="listitem" data-date="${esc(day.iso)}">
  <div class="sd-day__row">
    ${whenHTML(day)}
    <span class="sd-stripe"></span>
    <span class="sd-day__main"><span class="sd-day__title">Ruhe</span></span>
  </div>
</div>`;
}

// day: { iso, dow, dowLong, dayOfMonth, isToday, stripe, title, sub, status, lines, isOpen }
// lines: [{ text, tone?: "warn" | "danger" }]
export function dayRowHTML(day) {
  const detailId = `dayDetail-${day.iso}`;
  const lines = day.lines
    .map((l) => `<p${l.tone ? ` class="is-${l.tone}"` : ""}>${esc(l.text)}</p>`)
    .join("\n    ");
  const cls = `sd-day${day.isToday ? " is-today" : ""}${day.isOpen ? " is-open" : ""}`;
  return `<div class="${cls}" role="listitem" data-date="${esc(day.iso)}">
  <button type="button" class="sd-day__row" data-action="toggle-day-detail" aria-expanded="${day.isOpen ? "true" : "false"}" aria-controls="${detailId}">
    ${whenHTML(day)}
    <span class="sd-stripe${STRIPE_CLASS[day.stripe] ?? ""}"></span>
    <span class="sd-day__main"><span class="sd-day__title">${esc(day.title)}</span><span class="sd-day__sub">${esc(day.sub)}</span></span>
    <span class="sd-day__status">${statusHTML(day.status)}</span>
  </button>
  <div class="sd-day__detail" id="${detailId}"${day.isOpen ? "" : " hidden"}>
    ${lines}
    <button type="button" class="sd-btn" data-action="open-day" data-date="${esc(day.iso)}">Tag öffnen${I_CHEV_R}</button>
  </div>
</div>`;
}

export function daysCardHTML(rowsHTML) {
  return `<section class="sd-card sd-card--list sd-days" data-card="days" role="list" aria-labelledby="weekDaysTitle">
  <h2 class="sd-vh" id="weekDaysTitle">Tage dieser Woche</h2>
  ${rowsHTML}
</section>`;
}

// ---------- Platzhalterwoche (10.6) ----------
// fromDate: "28.10." | null; km: geplante Wochenkilometer | null
export function placeholderCardHTML({ fromDate, km }) {
  const first = fromDate
    ? `Nach der Re-Kalibrierung am ${fromDate} stehen hier die Einheiten.`
    : "Nach der Re-Kalibrierung stehen hier die Einheiten.";
  const second = km > 0 ? ` Geplant sind ${formatKm(km)} km.` : "";
  return `<section class="sd-card" data-card="week-placeholder">
  <h2 class="sd-card__title">Tagesdetails folgen</h2>
  <p class="sd-card__text">${esc(first + second)}</p>
</section>`;
}

export function planBeendetHintHTML(lastWeek) {
  return `<p class="sd-hint sd-hint--center">Plan beendet. Zeigt Woche ${lastWeek}.</p>`;
}

// ---------- Seitenrumpf (10.0) ----------
// errorHTML: fertige Fehlerkarte (view-dashboard bannersHTML) oder "".
export function weekMainHTML(...parts) {
  return `<div class="sd-main sd-main--tight">${parts.join("")}</div>`;
}

export function weekLoadingHTML() {
  return weekMainHTML(`<p class="sd-hint sd-hint--center" role="status">Woche wird geladen …</p>`);
}
