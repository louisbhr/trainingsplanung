// Rendering des Heute-Tabs (Stride E3). Reine Render-Funktionen: sie bekommen
// fertige Daten und geben HTML-Strings zurück. State und Datenzugriff
// (Firestore, Strava, Plan) bleiben in app.js (Auflage C5: dieses Modul
// importiert nie Firebase, Strava oder app.js). Keine eigenen Styles und kein
// style="...": alle Klassen kommen aus style.css, das Markup steht in
// docs/ui-markup-stride.md, Abschnitt 9. Fremde Texte immer durch esc().
import { formatKm, formatKm1 } from "./metrics.js?v=202610211108";
import { esc, markSVG, checkCircle, ringOpen, pill } from "./ui.js?v=202610211108";
import { slug } from "./plan.js?v=202610211108";
import { distanceStatus } from "./runcompare.js?v=202610211108";

export const AMPEL_LABELS = { wochensoll: "Wochensoll", easy: "Easy-Disziplin", belastung: "Belastung", kraft: "Kraft-Progression" };

// Icons mit Größenklasse (die ICONS-Map in ui.js hat keine, siehe Markup-Doc 9).
const I_CHAT = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-4 4V5z"/><path d="M8 9h8M8 12.5h5"/></svg>';
const I_INFO = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/></svg>';
const I_CHEV_R = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const I_CHEV_D = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const I_CHECK_W = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// Zahl für ein HTML-Attribut (<progress value/max>): Punkt als Dezimaltrenner,
// nie negativ, höchstens eine Nachkommastelle. Nie formatKm1() (Komma).
export const numAttr = (x) => (Number.isFinite(x) ? String(Math.round(Math.max(0, x) * 10) / 10) : "0");

// ---------- Kopf (9.1) ----------
// chip / progress / meta sind optional: Bis zum Rennen und Kein Plan haben weder Chip noch Balken.
export function headHTML({ sub, title, chip = null, progress = null, meta = [] }) {
  const chipHTML = chip
    ? `<span class="sd-chip"><span aria-hidden="true">${esc(chip.text)}</span><span class="sd-vh">${esc(chip.label)}</span></span>`
    : "";
  const progressHTML = progress
    ? `<progress class="sd-prog" value="${numAttr(progress.value)}" max="${numAttr(progress.max)}" aria-label="${esc(progress.label)}"></progress>`
    : "";
  const metaHTML = meta.length ? `<div class="sd-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join("")}</div>` : "";
  return `<div class="sd-head"><div class="sd-brand">${markSVG(28)}<span>Stride</span></div>${chipHTML}</div>
<div class="sd-intro"><p class="sd-intro__sub">${esc(sub)}</p><h1 class="sd-display">${esc(title)}</h1>${progressHTML}${metaHTML}</div>`;
}

// ---------- Banner (9.2) ----------
function errorBannerHTML(source, title, message, action) {
  return `<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="${source}">
  <p class="sd-card__title sd-card__title--danger">${title}</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="${action}">Neu laden</button></div>
</div>`;
}

// dataError: Meldung | null (Firestore/Daten nicht geladen).
// strava: null (Prüfung läuft oder alles gut) | { state: "disconnected" } | { state: "error", message }.
export function bannersHTML({ dataError = null, strava = null } = {}) {
  let html = "";
  if (dataError) html += errorBannerHTML("firebase", "Daten nicht geladen", dataError, "reload");
  if (strava?.state === "error") {
    html += errorBannerHTML("strava", "Strava nicht geladen", strava.message, "reload-strava");
  } else if (strava?.state === "disconnected") {
    html += `<div class="sd-card sd-card--banner" role="status" data-card="strava-disconnected">
  <div class="sd-banner__main">
    <p class="sd-card__title">Strava ist nicht verbunden</p>
    <p class="sd-card__text">Ohne Strava fehlen die Ist-Werte der Läufe.</p>
  </div>
  <button type="button" class="sd-btn sd-btn--coral" data-action="connect-strava">Verbinden</button>
</div>`;
  }
  return html;
}

// ---------- Heute-Karte (9.3) ----------
const plural = (n, one, many) => (n === 1 ? one : many);

function eyebrowHTML(tone, text) {
  return `<p class="sd-eyebrow sd-eyebrow--${tone}"><span class="sd-eyebrow__dot"></span>${text}</p>`;
}

function titleBlockHTML(title, text) {
  return `<div><h2 class="sd-title" id="todayTitle">${esc(title)}</h2>${text}</div>`;
}

const KRAFT_BUTTON = { none: "Training starten", partial: "Weiter trainieren", done: "Einheit ansehen" };

function previewRowHTML(ex, done) {
  return `<li class="sd-preview__row${done ? " is-done" : ""}">${done ? checkCircle("kraft", 20) : ringOpen(20)}` +
    `<span class="sd-preview__name">${esc(ex.name)}</span><span class="sd-preview__soll sd-mono">${esc(ex.soll)}</span>` +
    `<span class="sd-vh">${done ? "erfasst" : "offen"}</span></li>`;
}

// exercises: effektive Übungsliste (Plan plus Anpassungen); doneSlugs: Set der erfassten Übungen.
export function todayKraftHTML({ session, exercises, doneSlugs, deload }) {
  const n = exercises.length;
  const done = exercises.filter((ex) => doneSlugs.has(slug(ex.name))).length;
  const progress = done === 0 ? "none" : done === n ? "done" : "partial";
  const text = progress === "none" ? `${n} ${plural(n, "Übung", "Übungen")}` : `${done} von ${n} ${plural(n, "Übung", "Übungen")} erfasst`;
  const pills = [
    deload ? pill("", "Deload") : "",
    session.optional ? pill("optional", "optional") : "",
    progress === "done" ? pill("ok-check", "erledigt") : "",
  ].join("");
  const rows = exercises.slice(0, 3).map((ex) => previewRowHTML(ex, doneSlugs.has(slug(ex.name)))).join("");
  const more = n > 3 ? `<li class="sd-preview__more">+ ${n - 3} ${plural(n - 3, "weitere Übung", "weitere Übungen")}</li>` : "";
  const list = n > 0 ? `<ul class="sd-preview" aria-label="Erste Übungen">${rows}${more}</ul>` : "";
  return `<article class="sd-card sd-card--loose" data-card="today" data-kind="kraft" data-progress="${progress}" aria-labelledby="todayTitle">
  <div class="sd-card__top">${eyebrowHTML("teal", "Heute · Kraft")}${pills ? `<span class="sd-pills">${pills}</span>` : ""}</div>
  ${titleBlockHTML(session.label, `<p class="sd-text">${text}</p>`)}
  ${list}
  <button type="button" class="sd-btn sd-btn--primary" data-action="open-day" data-date="${esc(session.date)}">${KRAFT_BUTTON[progress]}</button>
</article>`;
}

const STRIPE = { kraft: "sd-stripe--kraft", lauf: "sd-stripe--lauf", long: "sd-stripe--long" };

// tomorrow: null | { iso, kind: "kraft" | "lauf" | "long" | "rest", value }
function tomorrowRowHTML(tomorrow) {
  if (!tomorrow) return "";
  if (tomorrow.kind === "rest") {
    return `<div class="sd-nextrow"><span class="sd-stripe"></span><span class="sd-nextrow__main"><span class="sd-nextrow__label">Morgen</span><span class="sd-nextrow__value">Ruhetag</span></span></div>`;
  }
  return `<button type="button" class="sd-nextrow" data-action="open-day" data-date="${esc(tomorrow.iso)}">` +
    `<span class="sd-stripe ${STRIPE[tomorrow.kind] ?? ""}"></span>` +
    `<span class="sd-nextrow__main"><span class="sd-nextrow__label">Morgen</span><span class="sd-nextrow__value">${esc(tomorrow.value)}</span></span>${I_CHEV_R}</button>`;
}

export function todayRestHTML(tomorrow) {
  return `<article class="sd-card" data-card="today" data-kind="rest" aria-labelledby="todayTitle">
  ${eyebrowHTML("muted", "Heute · Ruhe")}
  ${titleBlockHTML("Ruhetag", `<p class="sd-text">Mobility, Foam Rolling, Beine hoch.</p>`)}
  ${tomorrowRowHTML(tomorrow)}
</article>`;
}

function laufResultHTML(run, offset, status) {
  const pills = [
    status === "imPlan" ? pill("ok", "im Plan") : status === "zuKurz" ? pill("amber", "zu kurz") : "",
    offset !== 0 ? pill("amber", "nachgeholt") : "",
  ].join("");
  return `<div class="sd-result">
  <p class="sd-result__km sd-mono">${formatKm1(run.distanceKm)}<span class="sd-unit">km</span></p>
  ${pills ? `<span class="sd-pills">${pills}</span>` : ""}
  <p class="sd-result__name">${esc(run.name)}</p>
</div>`;
}

const LAUF_LOADING = `<div class="sd-skelstack sd-skelstack--rule" role="status"><span class="sd-skel sd-skel--w60"></span><span class="sd-skel sd-skel--w40"></span><span class="sd-vh">Lauf aus Strava wird geladen</span></div>`;

// ist: { state: "loading" } | { state: "run", run, offset } | { state: "none" } (nicht verbunden, Fehler, noch kein Lauf).
// session.pace und session.hf tragen die Einheit schon im Text ("6:10–6:35 /km", "148–163 bpm").
export function todayLaufHTML({ session, isLong, ist }, THRESHOLDS) {
  let istHTML = "";
  if (ist.state === "loading") istHTML = LAUF_LOADING;
  else if (ist.state === "run") istHTML = laufResultHTML(ist.run, ist.offset, distanceStatus(ist.run.distanceKm, session.km, THRESHOLDS));
  return `<article class="sd-card" data-card="today" data-kind="${isLong ? "long" : "lauf"}" aria-labelledby="todayTitle">
  ${eyebrowHTML(isLong ? "purple" : "coral", isLong ? "Heute · Long run" : "Heute · Lauf")}
  ${titleBlockHTML(`${session.type} · ${session.dist}`, `<p class="sd-text">Ziel <span class="sd-mono">${esc(session.pace)}</span> · HF <span class="sd-mono">${esc(session.hf)}</span></p>`)}
  ${istHTML}
  <button type="button" class="sd-btn sd-btn--primary" data-action="open-day" data-date="${esc(session.date)}">Lauf ansehen</button>
</article>`;
}

// fromDate: "28.10." | null; km: geplante Wochenkilometer | null
export function todayPlaceholderHTML({ fromDate, km }) {
  const text = fromDate && km > 0
    ? `Die Einheiten dieser Woche stehen ab dem ${fromDate} fest. Geplant sind ${formatKm(km)} km.`
    : "Die Einheiten dieser Woche stehen nach der Re-Kalibrierung fest.";
  return `<article class="sd-card" data-card="today" data-kind="placeholder" aria-labelledby="todayTitle">
  ${eyebrowHTML("muted", "Heute · Offen")}
  ${titleBlockHTML("Details nach der Re-Kalibrierung", `<p class="sd-text">${esc(text)}</p>`)}
</article>`;
}

// race: null | { dayText: "Sonntag, 02.05.2027", daysText: "noch 26 Tage" } (null = Renndatum offen)
export function todayRaceHTML(race) {
  const row = race
    ? `<div class="sd-nextrow"><span class="sd-stripe sd-stripe--long"></span><div class="sd-nextrow__main"><span class="sd-nextrow__label">Renntag</span><span class="sd-nextrow__value">${esc(race.dayText)}</span></div><span class="sd-mono sd-hint">${esc(race.daysText)}</span></div>`
    : "";
  return `<article class="sd-card" data-card="today" data-kind="race" aria-labelledby="todayTitle">
  ${eyebrowHTML("muted", "Heute · Frei")}
  ${titleBlockHTML("Bis zum Rennen", `<p class="sd-text">Der Plan endet vor dem Renntag. Für diesen Tag gibt es keine Einheit mehr.</p>`)}
  ${row}
</article>`;
}

// summary: Strava-Zusammenfassung von heute | null; runsKnown: Läufe sind geladen (sonst keine "Heute"-Zeile).
export function todayNoPlanHTML({ summary, runsKnown }) {
  const today = summary ? `Heute: ${summary} (aus Strava)` : runsKnown ? "Heute: noch kein Lauf." : "";
  return `<article class="sd-card" data-card="today" data-kind="noplan" aria-labelledby="todayTitle">
  <div><h2 class="sd-title" id="todayTitle">Kein Plan aktiv</h2><p class="sd-text">Läufe werden weiter aus Strava angezeigt.</p>${today ? `<p class="sd-text">${esc(today)}</p>` : ""}</div>
  <button type="button" class="sd-btn sd-btn--block" data-action="go-tab" data-tab="plan">Zum Plan</button>
</article>`;
}

// ---------- Coach (9.4) ----------
export function coachLoadingHTML() {
  return `<article class="sd-card sd-card--coach" data-card="coach" data-state="loading" aria-busy="true">
  <p class="sd-eyebrow sd-eyebrow--purple">${I_CHAT}Coach</p>
  <div class="sd-skelstack" role="status"><span class="sd-skel sd-skel--purple sd-skel--w92"></span><span class="sd-skel sd-skel--purple sd-skel--w60"></span><span class="sd-vh">Coach wird vorbereitet</span></div>
</article>`;
}

// bilanzHTML: "" oder Ergebnis von bilanzOpenHTML/bilanzToggleHTML. Der feste Text für
// "Kein Plan"/"Bis zum Rennen" läuft durch dieselbe Karte.
export function coachHTML(text, bilanzHTML = "") {
  return `<article class="sd-card sd-card--coach" data-card="coach">
  <p class="sd-eyebrow sd-eyebrow--purple">${I_CHAT}Coach</p>
  <p class="sd-coach__text">${esc(text)}</p>${bilanzHTML}
</article>`;
}

// Montags offen. Das <p> trägt dieselbe ID wie im zugeklappten Fall, damit beide Varianten gleich ansprechbar sind.
export function bilanzOpenHTML(weekN, text) {
  return `<div class="sd-bilanz"><h2 class="sd-bilanz__heading">Wochenbilanz · Woche ${Number(weekN)}</h2><p class="sd-bilanz__body" id="bilanzBody">${esc(text)}</p></div>`;
}
// Di bis So: Auslöser plus zu-/aufgeklappter Text.
export function bilanzToggleHTML(weekN, expanded, text) {
  return `<div class="sd-bilanz"><button type="button" class="sd-bilanz__toggle" data-action="toggle-bilanz" aria-expanded="${expanded ? "true" : "false"}" aria-controls="bilanzBody">Wochenbilanz W${Number(weekN)}${I_CHEV_D}</button>` +
    `<p class="sd-bilanz__body" id="bilanzBody"${expanded ? "" : " hidden"}>${esc(text)}</p></div>`;
}

// ---------- Status (9.5) ----------
const STATUS_SHAPE = { gruen: "ok", gelb: "warn", rot: "crit", grau: "none", laedt: "load" };
const STATUS_SR = {
  gruen: "Status grün. Erklärung öffnen", gelb: "Status gelb. Erklärung öffnen", rot: "Status rot. Erklärung öffnen",
  grau: "Keine Daten. Erklärung öffnen", laedt: "Status wird geladen. Erklärung öffnen",
};

function statusRowHTML(key, status, detailHTML) {
  const st = STATUS_SHAPE[status] ? status : "grau";
  return `<button type="button" class="sd-statusrow" data-action="open-info" data-info="${key}" data-status="${st}">
  <span class="sd-statusrow__shape" aria-hidden="true"><span class="sd-ampel sd-ampel--${STATUS_SHAPE[st]}"></span></span>
  <span class="sd-statusrow__main"><span class="sd-statusrow__title">${esc(AMPEL_LABELS[key])}</span><span class="sd-statusrow__detail">${detailHTML}</span></span>
  ${I_INFO}<span class="sd-vh">${STATUS_SR[st]}</span>
</button>`;
}

// list: [{ key, status, detail }] in fester Reihenfolge | null = lädt (Titel echt, Detail ein Platzhalter).
export function statusCardHTML(list) {
  const rows = list
    ? list.map((a) => statusRowHTML(a.key, a.status, esc(a.detail))).join("")
    : Object.keys(AMPEL_LABELS).map((key) => statusRowHTML(key, "laedt", `<span class="sd-skel sd-skel--chip"></span>`)).join("");
  return `<h2 class="sd-label" id="statusLabel">Status</h2><div class="sd-card sd-card--list" role="group" aria-labelledby="statusLabel" data-card="status" aria-busy="${list ? "false" : "true"}">${rows}</div>`;
}

// ---------- Diese Woche (9.6) ----------
const WD_KIND = { kraft: "sd-wd--kraft", lauf: "sd-wd--lauf", long: "sd-wd--long", rest: "sd-wd--rest" };
const WD_STATE_WORD = { open: "offen", done: "erledigt", missed: "verpasst" };

// day: { dow: "Mo", dayLong: "Montag", kind: "kraft" | "lauf" | "long" | "rest", what: "Lauf 8 km",
//        dot: "8", state: "open" | "done" | "missed", today: boolean }
function weekDayHTML(day) {
  const rest = day.kind === "rest";
  const classes = ["sd-wd", WD_KIND[day.kind] ?? "sd-wd--rest"];
  if (!rest && day.state === "done") classes.push("is-done");
  if (!rest && day.state === "missed") classes.push("is-missed");
  if (day.today) classes.push("is-today");
  const dot = rest ? "–" : day.state === "done" ? I_CHECK_W : esc(day.dot);
  const sr = `${day.dayLong}, ${rest ? "Ruhetag" : `${day.what}, ${WD_STATE_WORD[day.state] ?? "offen"}`}${day.today ? ", heute" : ""}`;
  return `<span class="${classes.join(" ")}"><span class="sd-wd__dow" aria-hidden="true">${esc(day.dow)}</span>` +
    `<span class="sd-wd__dot" aria-hidden="true">${dot}</span><span class="sd-vh">${esc(sr)}</span></span>`;
}

// volume: { ist, soll } | null; ohne bekannte Soll-Summe entfallen Zeile und Balken.
export function weekCardHTML({ days, volume }) {
  const load = volume && volume.soll > 0
    ? `<span class="sd-weekload"><span class="sd-weekvol"><span class="sd-weekvol__label">Laufvolumen</span><span class="sd-weekvol__value sd-mono">${formatKm(volume.ist)} / ${formatKm(volume.soll)} km</span></span>` +
      `<progress class="sd-prog sd-prog--coral" value="${numAttr(volume.ist)}" max="${numAttr(volume.soll)}" aria-label="Laufvolumen in Kilometern"></progress></span>`
    : "";
  return `<h2 class="sd-label" id="weekLabel">Diese Woche</h2><button type="button" class="sd-card sd-weekcard" data-action="go-tab" data-tab="woche" data-card="week" aria-labelledby="weekLabel">` +
    `<span class="sd-weekstrip">${days.map(weekDayHTML).join("")}</span>${load}<span class="sd-vh">Woche öffnen</span></button>`;
}

// ---------- Info-Sheets (9.7) ----------
// Blöcke { heading, text } in der Reihenfolge Berechnung, Bedeutung, (Ehrlicher Hinweis), Grau.
// Grenzwerte kommen aus THRESHOLDS (config.js), nicht als fester Text.
export function infoContent(THRESHOLDS) {
  const w = THRESHOLDS.wochensoll, b = THRESHOLDS.belastung, k = THRESHOLDS.kraft;
  const pct = (n) => Math.round(n * 100);
  const comma = (n) => String(n).replace(".", ",");
  return {
    wochensoll: {
      title: "Wochensoll",
      blocks: [
        { heading: "Berechnung", text: "Gelaufene Kilometer der Planwoche bis heute im Verhältnis zu den geplanten Kilometern derselben Tage, dazu die erledigten Krafteinheiten." },
        { heading: "Bedeutung", text: `Grün ab ${pct(w.gruen)} % der geplanten Kilometer. Gelb zwischen ${pct(w.gelb)} % und ${pct(w.gruen)} %. Rot darunter. Eine verpasste, bereits vergangene Einheit zählt mindestens als Gelb.` },
        { heading: "Grau", text: "Kein aktiver Plan oder die Woche hat noch keine Details." },
      ],
    },
    easy: {
      title: "Easy-Disziplin",
      blocks: [
        { heading: "Berechnung", text: "Die Herzfrequenz deiner letzten drei Easy-, Long- oder Recovery-Läufe im Vergleich zur Obergrenze der jeweiligen Zone." },
        { heading: "Bedeutung", text: `Grün, wenn alle drei im Rahmen liegen. Gelb bei einem Ausreißer bis ${THRESHOLDS.easy.gelbMaxOver} Schläge über der Grenze. Rot bei zwei oder mehr Ausreißern oder einem deutlich über der Grenze.` },
        { heading: "Grau", text: "Noch kein zugeordneter Lauf vorhanden." },
      ],
    },
    belastung: {
      title: "Belastung",
      blocks: [
        { heading: "Berechnung", text: "Kilometer der letzten 7 Tage geteilt durch die durchschnittlichen Wochenkilometer der 28 Tage davor." },
        { heading: "Bedeutung", text: `1,0 heißt so viel wie zuletzt üblich. In Entlastungswochen ist ein Wert unter 1 gewollt. Über ${comma(b.gruen)} steht auf Gelb, du steigerst schnell. Über ${comma(b.gelb)} steht auf Rot, das ist ein deutlich zu schneller Anstieg.` },
        { heading: "Ehrlicher Hinweis", text: "Eine grobe Faustregel (Acute:Chronic), gedacht als Warnsignal, keine Verletzungsprognose." },
        { heading: "Grau", text: "Weniger als 4 Wochen Lauf-Historie." },
      ],
    },
    kraft: {
      title: "Kraft-Progression",
      blocks: [
        { heading: "Berechnung", text: `Deine Gewichtsübungen der letzten ${k.windowDays} Tage, Deload-Wochen zählen nicht mit.` },
        { heading: "Bedeutung", text: `Grün, wenn keine Übung feststeckt. Gelb bei einer Übung ohne Steigerung oder unter Soll. Rot bei ${k.redAffectedCount} oder mehr betroffenen Übungen oder wenn dieselbe Übung ${k.redConsecutiveBelow}-mal in Folge unter Soll bleibt.` },
        { heading: "Grau", text: `Weniger als ${k.minExercisesWithData} Gewichtsübungen mit Daten, oder kein aktiver Plan.` },
      ],
    },
  };
}
