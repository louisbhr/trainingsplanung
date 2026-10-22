// Rendering des Lauf-Tags "Vergleich" (Stride E6). Reine Render-Funktionen: sie
// bekommen fertige Daten und geben HTML-Strings zurück. State, Laden und Events
// bleiben in app.js (Auflage C5: dieses Modul importiert nie Firebase, Strava
// oder app.js). Keine eigenen Styles und kein style="...", auch keine Custom
// Properties: der Distanzbalken ist ein <progress>, die Range-Balken sind
// Inline-SVG mit Zahlen-Attributen (Auflage C5, Entscheid E6). Alle Klassen
// kommen aus style.css, das Markup steht in docs/ui-markup-stride.md, Abschnitt 12.
// Fremde Texte (Plan, Laufname, Fehlermeldung) laufen immer durch esc().
import { formatKm1 } from "./metrics.js?v=202610220932";
import { esc, pill, numAttr, dayNameDE, shortDate } from "./ui.js?v=202610220932";
import {
  parseTarget, rangeScale, rangeBar, distanceStatus, paceStatus, hrStatus,
} from "./runcompare.js?v=202610220932";
import { daysBetween, pickableRuns, PICKER_WINDOW } from "./runmatch.js?v=202610220932";

const I_CHEV_L = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const I_CHEV_R = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const I_REFRESH = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.4 5.8"/><path d="M20 4v7h-7"/></svg>';

// SVG-Geometrie: Prozent der Spur, 0 bis 100, eine Nachkommastelle, Punkt als Trenner.
const pct = (x) => (Number.isFinite(x) ? String(Math.round(Math.min(100, Math.max(0, x)) * 10) / 10) : "0");

// ---------- Kopf (12.1) ----------

const dayEyebrow = (iso) => `Lauf · ${dayNameDE(iso)}, ${shortDate(iso)}`;

/** "Ziel 6:15–6:40 /km · HF 148–160 bpm"; fehlt ein Teil, entfällt er samt Trennpunkt. */
function targetLine(info) {
  const parts = [info.pace && `Ziel ${info.pace}`, info.hf && `HF ${info.hf}`].filter(Boolean);
  return parts.length ? `<p class="sd-target sd-mono">${esc(parts.join(" · "))}</p>` : "";
}

/**
 * Inhalt von <header class="sd-pagehead"> (setPageHead). showTarget nur in den
 * Zuständen ohne Vergleichs-Karte; mit Karte steht das Ziel in der Balkenachse.
 */
export function headHTML({ iso, info, isLong, backLabel, showTarget }) {
  const tone = isLong ? "purple" : "coral";
  return `<nav class="sd-nav" aria-label="Kopfzeile"><button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${I_CHEV_L}${esc(backLabel)}</button></nav>
<div class="sd-daytitle">
  <p class="sd-eyebrow sd-eyebrow--${tone} sd-eyebrow--plain">${dayEyebrow(iso)}</p>
  <h1 class="sd-display" tabindex="-1">${esc(info.type)} · ${esc(info.dist)}</h1>
  ${showTarget ? targetLine(info) : ""}
</div>`;
}

/** Plan-Hinweis, in jedem Zustand sichtbar; ohne Notiz nichts. */
export function planHintHTML(note) {
  if (!note) return "";
  return `<div class="sd-planhint" data-card="plan-note"><p class="sd-planhint__label">Hinweis aus dem Plan</p><p class="sd-planhint__text">${esc(note)}</p></div>`;
}

/** Inhalt von #main unter dem Kopf: der Slot (lädt nach) plus der statische Plan-Hinweis. */
export function pageHTML({ slotHTML, note }) {
  return `<div class="sd-main sd-main--tight"><div id="strava-slot">${slotHTML}</div>${planHintHTML(note)}</div>`;
}

// ---------- Laden (12.2) ----------

export function loadingHTML() {
  return `<article class="sd-card sd-compare" data-card="loading" aria-busy="true" role="status">
  <div class="sd-skelstack sd-skelstack--fill">
    <span class="sd-skel sd-skel--km"></span><span class="sd-skel sd-skel--w60"></span>
    <span class="sd-skel sd-skel--bar"></span>
    <span class="sd-skel sd-skel--w92"></span><span class="sd-skel sd-skel--w92"></span>
    <span class="sd-vh">Strava wird geprüft</span>
  </div>
</article>`;
}

// ---------- Range-Zeilen (12.3a, 12.4) ----------

const AMPEL_WORD = { ok: ", im Zielbereich", warn: ", außerhalb des Zielbereichs" };

/** Wert mit Ampel-Form und verstecktem Wort; ohne ok/warn ein neutraler Wert. */
function valueHTML(status, text) {
  const colored = status === "ok" || status === "warn";
  const ampel = colored ? `<span class="sd-ampel sd-ampel--${status}" aria-hidden="true"></span>` : "";
  const word = colored ? `<span class="sd-vh">${AMPEL_WORD[status]}</span>` : "";
  return `<span class="sd-range__value sd-mono${colored ? ` is-${status}` : ""}">${ampel}${esc(text)}${word}</span>`;
}

const headRow = (label, valueMarkup) =>
  `<div class="sd-range__head"><span class="sd-range__label">${label}</span>${valueMarkup}</div>`;

const paceAxis = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
// Achsenmitte: der Originaltext der Zone ohne Einheit ("6:15–6:40 /km" -> "6:15–6:40")
const bareTarget = (text) => String(text).replace(/\s*(\/\s*km|bpm)\s*$/i, "").trim();

function trackHTML(bar) {
  const band = `<svg class="sd-range__band" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="${pct(bar.from)}" y="0" width="${pct(bar.to - bar.from)}" height="6"/></svg>`;
  const mark = bar.at == null ? "" :
    `<svg class="sd-range__mark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line class="sd-range__halo" x1="${pct(bar.at)}" y1="2" x2="${pct(bar.at)}" y2="16"/><line class="sd-range__tick" x1="${pct(bar.at)}" y1="2" x2="${pct(bar.at)}" y2="16"/></svg>`;
  return `<div class="sd-range__track">${band}${mark}</div>`;
}

/**
 * Eine Zeile (Pace oder Ø HF); jede entscheidet für sich:
 * frei -> ohne Balken, Pace neutral -> Notiz statt Balken, sonst Spur mit Band und Marker.
 * kind: "pace" | "hr"; status: "ok" | "warn" | "neutral" | null (kein Messwert / keine Grenze).
 */
function rangeRowHTML({ kind, label, targetText, value, valueText, status }) {
  const target = parseTarget(targetText, kind);
  if (target.type === "free") {
    return `<div class="sd-range sd-range--plain">${headRow(label, valueHTML(null, valueText))}</div>`;
  }
  if (kind === "pace" && status === "neutral") {
    return `<div class="sd-range">${headRow(label, valueHTML(null, valueText))}<p class="sd-range__note">Der Schnitt enthält Ein- und Auslaufen, darum ohne Zielband.</p></div>`;
  }
  const scale = rangeScale(target, kind);
  const fmt = kind === "pace" ? paceAxis : (n) => String(Math.round(n));
  return `<div class="sd-range">
    ${headRow(label, valueHTML(status, valueText))}
    ${trackHTML(rangeBar(scale, target, value))}
    <div class="sd-range__axis"><span>${fmt(scale.min)}</span><span>Ziel ${esc(bareTarget(targetText))}</span><span>${fmt(scale.max)}</span></div>
  </div>`;
}

/** Hinweiszeile, wenn mindestens eine Zeile ohne Zielband ist (12.4). */
function plainNoteHTML({ paceFree, hrFree, isTest }) {
  if (!paceFree && !hrFree) return "";
  let text;
  if (paceFree && hrFree) {
    text = isTest
      ? "Für den Test gibt es kein Zielband. Die Werte stehen nur zur Info."
      : "Für diesen Lauf gibt es kein Zielband. Die Werte stehen nur zur Info.";
  } else {
    text = paceFree ? "Für die Pace gibt es kein Zielband." : "Für die Herzfrequenz gibt es kein Zielband.";
  }
  return `<p class="sd-range__note">${text}</p>`;
}

// ---------- Vergleichs-Karte (12.3) ----------

/**
 * Karte "Vergleich mit dem Plan". run = Laufmodell aus strava.js
 * ({ distanceKm, movingTimeSec, paceSecPerKm, paceLabel, avgHr }),
 * formatDuration als Funktion hereingereicht (dieses Modul importiert strava.js nie).
 */
export function compareHTML({ info, run, isLong, THRESHOLDS, formatDuration }) {
  const hasSoll = typeof info.km === "number" && info.km > 0;
  const distance = hasSoll ? distanceStatus(run.distanceKm, info.km, THRESHOLDS) : null;
  const dataStatus = distance === "imPlan" ? "ok" : distance === "zuKurz" ? "short" : "none";
  const duration = formatDuration(run.movingTimeSec);
  const sub = dataStatus === "none" ? `Dauer ${esc(duration)}` : `von ${esc(info.dist)} · ${esc(duration)}`;
  const statusPill = dataStatus === "ok" ? pill("ok", "im Plan") : dataStatus === "short" ? pill("amber", "zu kurz") : "";
  const bar = dataStatus === "none" ? "" :
    `<progress class="sd-prog sd-prog--lg sd-prog--${isLong ? "purple" : "coral"}" value="${numAttr(run.distanceKm)}" max="${numAttr(info.km)}" aria-label="Distanz, ${formatKm1(run.distanceKm)} von ${esc(info.dist)}"></progress>`;

  const paceTarget = parseTarget(info.pace, "pace");
  const hrTarget = parseTarget(info.hf, "hr");
  const rows = [
    rangeRowHTML({
      kind: "pace", label: "Pace", targetText: info.pace, value: run.paceSecPerKm,
      valueText: run.paceSecPerKm ? run.paceLabel : "–",
      status: paceStatus(paceTarget, run.paceSecPerKm, info.shortType),
    }),
    rangeRowHTML({
      kind: "hr", label: "Ø HF", targetText: info.hf, value: run.avgHr,
      valueText: run.avgHr ? `${run.avgHr} bpm` : "–",
      status: hrStatus(run.avgHr, info.hfMax),
    }),
  ].join("\n  ");
  const note = plainNoteHTML({
    paceFree: paceTarget.type === "free",
    hrFree: hrTarget.type === "free",
    isTest: /test|kalibrierung/i.test(`${info.shortType ?? ""} ${info.type ?? ""}`),
  });

  return `<article class="sd-card sd-compare" data-card="compare" data-status="${dataStatus}" aria-label="Vergleich mit dem Plan">
  <div class="sd-compare__top">
    <div>
      <p class="sd-bigkm sd-mono">${formatKm1(run.distanceKm)}<span class="sd-unit">km</span></p>
      <p class="sd-compare__sub">${sub}</p>
    </div>
    ${statusPill}
  </div>
  ${bar}
  ${rows}
  ${note}
</article>`;
}

// ---------- Strava-Zeile (12.5) ----------

/** a = Eintrag aus assignRuns ({ run, offset, source }); startTime nur, wenn bekannt. */
export function stravaRowHTML({ iso, assignment: a }) {
  const run = a.run;
  const manual = a.source === "manual";
  const name = run.startTime ? `${run.name} · ${run.startTime}` : run.name;
  const when = `${dayNameDE(run.date)}, ${shortDate(run.date)}`;
  const shift = a.offset === 0 ? "" :
    `<span class="sd-linkrow__note" data-slot="shift-note">${a.offset > 0 ? "nachgeholt" : "vorgezogen"} · ${when}</span>`;
  return `<button type="button" class="sd-linkrow" data-card="strava-run" data-source="${manual ? "manual" : "auto"}" data-action="pick-run" data-date="${esc(iso)}" aria-haspopup="dialog">
  <span class="sd-linkrow__main">
    <span class="sd-linkrow__label">Aus Strava</span>
    <span class="sd-linkrow__name">${esc(name)}</span>
    ${shift}
  </span>
  ${manual ? pill("amber", "von Hand") : pill("", "automatisch")}
  ${I_CHEV_R}
</button>`;
}

// ---------- Zustandskarten (12.6) ----------

const pickButton = (iso) => `<button type="button" class="sd-btn" data-action="pick-run" data-date="${esc(iso)}">Lauf von Hand zuordnen</button>`;

export const emptyHTML = (iso) => `<article class="sd-card sd-card--center" data-card="empty">
  <h2 class="sd-card__title">Noch kein Lauf</h2>
  <p class="sd-card__text">Sobald der Lauf in Strava liegt, erscheint er hier.</p>
  <div class="sd-actions">${pickButton(iso)}</div>
</article>`;

export const missedHTML = (iso) => `<article class="sd-card sd-card--center" data-card="missed">
  ${pill("danger", "verpasst")}
  <h2 class="sd-card__title">Kein Lauf gefunden</h2>
  <p class="sd-card__text">Strava-Läufe von einem Tag davor bis drei Tage danach.</p>
  <div class="sd-actions">
    ${pickButton(iso)}
    <button type="button" class="sd-btn sd-btn--text" data-action="reload-strava">${I_REFRESH}Neu laden</button>
  </div>
</article>`;

export const noStravaHTML = () => `<article class="sd-card sd-card--center" data-card="no-strava">
  <h2 class="sd-card__title">Strava ist nicht verbunden</h2>
  <p class="sd-card__text">Verbinde Strava, dann erscheint der Lauf hier automatisch.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--primary" data-action="connect-strava">Mit Strava verbinden</button></div>
</article>`;

export const ignoredHTML = (iso) => `<article class="sd-card sd-card--center" data-card="ignored">
  <h2 class="sd-card__title">Bewusst leer gelassen</h2>
  <p class="sd-card__text">Kein Lauf an diesem Tag. Zählt als verpasst.</p>
  <div class="sd-actions"><button type="button" class="sd-btn" data-action="reset-run" data-date="${esc(iso)}">Automatik zurück</button></div>
</article>`;

// ---------- Fehler (12.7): drei getrennte Welten ----------

export const workerMissingHTML = () => `<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="worker">
  <p class="sd-card__title sd-card__title--danger">Strava noch nicht eingerichtet</p>
  <p class="sd-card__text sd-card__text--danger">Der Token-Worker fehlt (siehe README, Abschnitt „Strava“). Ohne ihn kann der Browser sich nicht bei Strava anmelden.</p>
</div>`;

export function errorHTML({ source, message }) {
  if (source === "firebase") {
    return `<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="firebase">
  <p class="sd-card__title sd-card__title--danger">Daten-Problem (Firebase)</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <p class="sd-card__text sd-card__text--danger">Nicht Strava, sondern der Datenspeicher. Prüfe, ob du angemeldet bist (Plan-Tab, Daten und Konto) und ob die Regeln aus <code>firestore.rules</code> in der Firebase-Console veröffentlicht sind.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload-strava">Nochmal versuchen</button></div>
</div>`;
  }
  return `<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="strava">
  <p class="sd-card__title sd-card__title--danger">Strava-Problem</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <div class="sd-actions">
    <button type="button" class="sd-btn sd-btn--onbanner" data-action="reload-strava">Nochmal versuchen</button>
    <button type="button" class="sd-btn sd-btn--onbanner" data-action="connect-strava">Neu verbinden</button>
  </div>
</div>`;
}

// ---------- Slot-Inhalt (12.8) ----------

/**
 * Welche Karte(n) im #strava-slot stehen. Rangfolge wie bisher: Worker fehlt, Fehler
 * (Firebase vor Strava), nicht verbunden, bewusst ignoriert, zugeordnet, sonst
 * verpasst (Tag vorbei) oder noch kein Lauf (heute/Zukunft).
 * vm: { iso, info, isLong, past, workerConfigured, error, errorSource, connected,
 *       assignment, THRESHOLDS, formatDuration }
 * showTarget sagt dem Kopf, ob die Ziel-Zeile dort stehen muss.
 */
export function slotState(vm) {
  if (!vm.workerConfigured) return { html: workerMissingHTML(), showTarget: true };
  if (vm.error) return { html: errorHTML({ source: vm.errorSource, message: vm.error }), showTarget: true };
  if (vm.connected === false) return { html: noStravaHTML(), showTarget: true };
  const a = vm.assignment;
  if (a?.source === "ignored") return { html: ignoredHTML(vm.iso), showTarget: true };
  if (a?.run) {
    const html = compareHTML({
      info: vm.info, run: a.run, isLong: vm.isLong, THRESHOLDS: vm.THRESHOLDS, formatDuration: vm.formatDuration,
    }) + "\n" + stravaRowHTML({ iso: vm.iso, assignment: a });
    return { html, showTarget: false };
  }
  return { html: vm.past ? missedHTML(vm.iso) : emptyHTML(vm.iso), showTarget: true };
}

// ---------- Zuordnungs-Sheet (12.9) ----------

export const sheetTitle = (iso) => `Lauf für ${dayNameDE(iso)}, ${shortDate(iso)}`;

/**
 * Auswahl für das Sheet: pickableRuns (runmatch.js, unverändert) liefert die freien
 * Läufe; Läufe, die fest zu einem anderen Plantag gehören (manuell oder am eigenen
 * Tag gelaufen), kommen mit takenBy (ISO des anderen Tags) gesperrt dazu.
 * Sortierung: nächster Tag zuerst.
 * @returns {{ run: object, takenBy: string|null }[]}
 */
export function pickerOptions(runs, assignment, planDate) {
  const free = new Set(pickableRuns(runs, assignment, planDate).map((r) => String(r.id)));
  const owner = new Map();
  for (const [date, a] of Object.entries(assignment)) {
    if (a.run && date !== planDate && (a.source === "manual" || a.source === "exact")) owner.set(String(a.run.id), date);
  }
  return runs
    .filter((r) => Math.abs(daysBetween(planDate, r.date)) <= PICKER_WINDOW)
    .filter((r) => free.has(String(r.id)) || owner.has(String(r.id)))
    .sort((a, b) => Math.abs(daysBetween(planDate, a.date)) - Math.abs(daysBetween(planDate, b.date)))
    .map((r) => ({ run: r, takenBy: free.has(String(r.id)) ? null : owner.get(String(r.id)) }));
}

/** "am Plantag", "1 Tag später", "2 Tage früher" */
export function distanceLabel(offset) {
  if (!offset) return "am Plantag";
  const n = Math.abs(offset);
  return `${n} ${n === 1 ? "Tag" : "Tage"} ${offset > 0 ? "später" : "früher"}`;
}

function optionHTML({ run, takenBy }, { iso, selectedId }) {
  const name = `<span class="sd-option__name">${dayNameDE(run.date)}, ${shortDate(run.date)} · ${esc(run.name)}</span>`;
  const sub = (extra) => `<span class="sd-option__sub">${formatKm1(run.distanceKm)} km · ${esc(run.paceLabel)}${extra}</span>`;
  if (takenBy) {
    return `<div class="sd-option" role="radio" aria-checked="false" aria-disabled="true">
      <span class="sd-radio"></span>
      <span class="sd-option__main">${name}${sub("")}<span class="sd-option__why">gehört schon zu ${dayNameDE(takenBy)}, ${shortDate(takenBy)}</span></span>
    </div>`;
  }
  const selected = String(run.id) === String(selectedId);
  return `<button type="button" class="sd-option${selected ? " is-selected" : ""}" role="radio" aria-checked="${selected}" data-action="assign-run" data-date="${esc(iso)}" data-run="${esc(run.id)}">
      <span class="sd-radio"></span>
      <span class="sd-option__main">${name}${sub(` · ${distanceLabel(daysBetween(iso, run.date))}`)}</span>
    </button>`;
}

/**
 * Körper des Sheets. options aus pickerOptions(); selectedId = aktuell zugeordneter
 * Lauf (egal ob automatisch oder von Hand); source = Quelle der Zuordnung des Tages;
 * busy = "Neu laden" läuft (Knopf gesperrt, Sheet bleibt offen).
 */
export function sheetBodyHTML({ iso, options, selectedId, source, busy }) {
  const list = options.length
    ? `<p class="sd-sheet__lead">Strava-Läufe im Umkreis von sieben Tagen.</p>
<div class="sd-sheet__list" role="radiogroup" aria-label="Lauf wählen">
  ${options.map((o) => optionHTML(o, { iso, selectedId })).join("\n  ")}
</div>`
    : `<p class="sd-sheet__lead" data-slot="no-options">Im Zeitfenster liegt kein freier Lauf. Mit „Neu laden“ holst du gerade hochgeladene Läufe.</p>`;
  const reset = source === "manual" || source === "ignored"
    ? `<button type="button" class="sd-btn sd-btn--text" data-action="reset-run" data-date="${esc(iso)}">Automatik zurück</button>` : "";
  const busyAttrs = busy ? ' disabled aria-busy="true"' : "";
  return `${list}
<div class="sd-sheet__tools">
  ${reset}
  <button type="button" class="sd-btn sd-btn--text" data-action="reload-strava"${busyAttrs}>${I_REFRESH}Neu laden</button>
</div>
<button type="button" class="sd-btn sd-btn--danger sd-btn--md sd-btn--block" data-action="ignore-run" data-date="${esc(iso)}">Kein Lauf an diesem Tag</button>`;
}
