// Rendering des Verlaufs (Stride E7). Reine Funktionen: sie bekommen fertige Daten und
// geben HTML-Strings zurück. State, Laden und Events bleiben in app.js (Auflage C5:
// dieses Modul importiert nie Firebase, Strava oder app.js). Kein style="...": die Balken
// sind Inline-SVG mit Zahlen-Attributen, die Farbe kommt über Klassen (Entscheid E7).
// Markup und Klassen: docs/ui-markup-stride.md, Abschnitt 13. Fremde Texte (Laufname,
// Übungsname, Fehlermeldung) laufen immer durch esc().
import { addDays, weekNumberFor, weekOf } from "./plan.js?v=202610221024";
import { formatKm1 } from "./metrics.js?v=202610221024";
import { esc, dayNameDE, shortDate } from "./ui.js?v=202610221024";
import { kraftWeeklyBars, kraftTrendText, runsSince } from "./history-data.js?v=202610221024";
import { errorHTML as stravaErrorHTML, workerMissingHTML } from "./view-run.js?v=202610221024";

const I_INFO = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/></svg>';

const PLOT_W = 320;
const MAX_LIST = 10;
const MAX_LABELS = 10;
const BASELINE_OVERSHOOT = 5; // das Rect ragt unter die Grundlinie, das SVG schneidet ab

// Geometrie in SVG-Attributen: Punkt als Trenner, eine Nachkommastelle, nie formatKm1().
export const svgNum = (x) => (Number.isFinite(x) ? String(Math.round(x * 10) / 10) : "0");
const de1 = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Pace "m:ss" ohne Einheit; ohne Wert "–". */
export function mmss(sec) {
  if (!sec || !Number.isFinite(sec)) return "–";
  let min = Math.floor(sec / 60);
  let rest = Math.round(sec % 60);
  if (rest === 60) { min += 1; rest = 0; }
  return `${min}:${String(rest).padStart(2, "0")}`;
}

// ---------- Kopf (13.0, 13.5) ----------

function segmentHTML(mode) {
  const opt = (m, label) =>
    `<button type="button" class="sd-seg__opt${mode === m ? " is-active" : ""}" aria-pressed="${mode === m}" data-action="hist-mode" data-mode="${m}">${label}</button>`;
  return `<div class="sd-seg" role="group" aria-label="Ansicht">${opt("lauf", "Lauf")}${opt("kraft", "Kraft")}</div>`;
}

function chipsHTML(exercises, activeSlug) {
  const chips = exercises.map((e) => {
    const on = e.slug === activeSlug;
    return `<button type="button" class="sd-filter__chip${on ? " is-active" : ""}" aria-pressed="${on}" data-action="pick-exercise" data-slug="${esc(e.slug)}"><span>${esc(e.name)}</span></button>`;
  }).join("");
  return `<div class="sd-filter" role="group" aria-label="Übung wählen">${chips}</div>`;
}

/** Inhalt von <header class="sd-pagehead">. exercises: [{ name, slug }], Chips nur im Modus Kraft. */
export function headHTML({ mode, exercises, activeSlug }) {
  return `<div class="sd-tabhead">
  <div class="sd-tabhead__titles"><h1 class="sd-display" tabindex="-1">Verlauf</h1></div>
  ${segmentHTML(mode)}
</div>${mode === "kraft" ? chipsHTML(exercises, activeSlug) : ""}`;
}

/** Inhalt von #main unter dem Kopf: der Slot lädt nach und ist nie leer. */
export function pageHTML({ slotHTML }) {
  return `<div class="sd-main sd-main--tight"><div id="hist-slot">${slotHTML}</div></div>`;
}

// ---------- Laden (13.1a, 13.6) ----------

export const runLoadingHTML = () => `<div class="sd-tiles" aria-hidden="true">
  ${'<div class="sd-tile"><span class="sd-skel sd-skel--w60"></span><span class="sd-skel sd-skel--val"></span></div>'.repeat(4)}
</div>
<div class="sd-card" data-card="loading" role="status" aria-busy="true">
  <span class="sd-skel sd-skel--w40"></span>
  <span class="sd-skel sd-skel--chart"></span>
  <span class="sd-vh">Verlauf wird geladen</span>
</div>`;

export const strengthLoadingHTML = () => `<div class="sd-card" data-card="loading" role="status" aria-busy="true">
  <span class="sd-skel sd-skel--w40"></span>
  <span class="sd-skel sd-skel--val"></span>
  <span class="sd-skel sd-skel--chart"></span>
  <span class="sd-vh">Verlauf wird geladen</span>
</div>
<div class="sd-card" aria-hidden="true">
  <span class="sd-skel sd-skel--w92"></span><span class="sd-skel sd-skel--w92"></span><span class="sd-skel sd-skel--w92"></span>
</div>`;

// ---------- Diagramme (13.3, 13.6): Geometrie und Achse ----------

/**
 * Balken-Rects für ein Diagramm mit n Plätzen. values: Zahl oder null (leerer Platz).
 * Rückgabe je Platz { x, y, width, height, rx } als Strings, null für leere Plätze.
 */
export function barRects(values, { plotHeight, gap, maxRx = 5 }) {
  const n = values.length;
  const max = Math.max(0, ...values.filter((v) => v != null));
  if (!n || max <= 0) return [];
  const slot = PLOT_W / n;
  const bw = Math.min(24, slot - gap);
  return values.map((v, i) => {
    if (v == null) return null;
    const h = Math.max(4, (v / max) * plotHeight);
    const y = Math.round((plotHeight - h) * 10) / 10;
    return {
      x: svgNum(slot * i + (slot - bw) / 2),
      y: svgNum(y),
      width: svgNum(bw),
      // Höhe aus dem gerundeten y, damit y + height genau auf Grundlinie + Überstand endet
      height: svgNum(plotHeight + BASELINE_OVERSHOOT - y),
      rx: svgNum(Math.min(maxRx, bw / 2)),
    };
  });
}

/**
 * Achsen-Spans: immer genau n, gleich breit. Ein Label steht nur, wenn
 * (n - 1 - i) % step === 0 (vom neuesten Platz aus gezählt), sonst bleibt der Span leer.
 * labels: Text je Platz; currentIndex bekommt is-current.
 */
export function axisHTML(labels, currentIndex = -1) {
  const n = labels.length;
  const step = Math.ceil(n / MAX_LABELS);
  const spans = labels.map((text, i) => {
    const shown = (n - 1 - i) % step === 0 || i === currentIndex;
    const cls = i === currentIndex ? ' class="is-current"' : "";
    return `<span${cls}>${shown ? esc(text) : ""}</span>`;
  });
  return `<div class="sd-chart__axis" aria-hidden="true">${spans.join("")}</div>`;
}

const legendItem = (kind, text) =>
  `<span><span class="sd-chart__swatch sd-chart__swatch--${kind}" aria-hidden="true"></span>${text}</span>`;

// ---------- Modus Lauf ----------

/** Kennzahlen der Läufe: 7 und 28 Tage bis heute, Ø Pace der letzten 10, Läufe ab Planstart. */
export function runStats(runs, today, planStart) {
  const sumKm = (days) => {
    const cutoff = addDays(today, -days + 1);
    // Obergrenze heute: ein Lauf mit Datum in der Zukunft gehört nicht in "die letzten 7 Tage".
    return runs.filter((r) => r.date >= cutoff && r.date <= today).reduce((a, r) => a + r.distanceKm, 0);
  };
  const withPace = runs.slice(-MAX_LIST).filter((r) => r.paceSecPerKm);
  const avgPace = withPace.length ? withPace.reduce((a, r) => a + r.paceSecPerKm, 0) / withPace.length : null;
  return { km7: sumKm(7), km28: sumKm(28), avgPace, count: runsSince(runs, planStart).length };
}

function tilesHTML(stats, planStart) {
  const tile = (key, label, value, unit = "") =>
    `<div class="sd-tile" data-tile="${key}"><dt class="sd-tile__label">${label}</dt><dd class="sd-tile__value sd-mono">${value}${unit ? `<span class="sd-unit">${unit}</span>` : ""}</dd></div>`;
  const paceLabel = `Ø Pace<button type="button" class="sd-infobtn" data-action="open-info" data-info="verlauf-pace" aria-haspopup="dialog" aria-label="Erklärung: Ø Pace">${I_INFO}</button>`;
  return `<dl class="sd-tiles" data-card="run-stats">
  ${tile("km7", "Letzte 7 Tage", formatKm1(stats.km7), "km")}
  ${tile("km28", "Letzte 28 Tage", formatKm1(stats.km28), "km")}
  ${tile("pace", paceLabel, mmss(stats.avgPace), stats.avgPace ? "/km" : "")}
  ${tile("count", `Läufe seit ${shortDate(planStart)}`, String(stats.count))}
</dl>`;
}

const runKind = (r) => (r.long ? "long" : "lauf");

function runChartHTML(last) {
  const rects = barRects(last.map((r) => r.distanceKm), { plotHeight: 120, gap: 6 });
  if (!rects.length) return "";
  const kms = last.map((r) => r.distanceKm);
  const bars = rects.map((g, i) => {
    const r = last[i];
    return `<rect class="sd-chart__bar sd-chart__bar--${runKind(r)}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="${g.rx}"><title>${shortDate(r.date)}: ${formatKm1(r.distanceKm)} km</title></rect>`;
  }).join("");
  const n = last.length;
  const aria = `Balkendiagramm: Distanz ${n === 1 ? "des letzten Laufs" : `der letzten ${n} Läufe`}, von ${formatKm1(Math.min(...kms))} bis ${formatKm1(Math.max(...kms))} km. Die einzelnen Werte stehen in der Liste darunter.`;
  const axis = axisHTML(last.map((r) => String(Number(r.date.slice(8, 10)))));
  const legend = last.some((r) => r.long)
    ? `\n  <p class="sd-chart__legend">${legendItem("lauf", "Lauf")}${legendItem("long", "Long Run")}</p>`
    : "";
  return `<section class="sd-card" data-card="run-chart" aria-labelledby="runChartTitle">
  <div class="sd-card__top">
    <h2 class="sd-card__title" id="runChartTitle">Distanz je Lauf</h2>
    <p class="sd-hint">${n === 1 ? "Letzter Lauf" : `Letzte ${n} Läufe`}</p>
  </div>
  <figure class="sd-chart">
    <svg class="sd-chart__plot" viewBox="0 0 ${PLOT_W} 120" preserveAspectRatio="none" role="img" focusable="false" aria-label="${esc(aria)}">${bars}</svg>
    ${axis}
  </figure>${legend}
</section>`;
}

function runListHTML(last) {
  const rows = last.slice().reverse().map((r) => {
    const kind = runKind(r);
    const pace = r.paceSecPerKm
      ? `<span class="sd-hrow__sep" aria-hidden="true">·</span><span><span class="sd-vh">Pace </span>${mmss(r.paceSecPerKm)}</span>`
      : "<span>–</span>";
    return `<li class="sd-hrow" role="listitem" data-kind="${kind}" data-run="${esc(r.id)}">
    <span class="sd-stripe sd-stripe--${kind}" aria-hidden="true"></span>
    <span class="sd-hrow__main"><span class="sd-hrow__title">${esc(r.planType || r.name)}</span><span class="sd-hrow__sub sd-mono">${dayNameDE(r.date)}, ${shortDate(r.date)}</span></span>
    <span class="sd-hrow__val sd-mono"><span>${formatKm1(r.distanceKm)} km</span>${pace}</span>
  </li>`;
  }).join("\n  ");
  return `<ul class="sd-card sd-card--list sd-rows" role="list" data-card="run-list" aria-label="Letzte Läufe">
  ${rows}
</ul>`;
}

const noStravaHTML = () => `<article class="sd-card sd-card--center" data-card="no-strava">
  <h2 class="sd-card__title">Strava ist nicht verbunden</h2>
  <p class="sd-card__text">Verbinde Strava, dann erscheinen deine Läufe hier.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--primary" data-action="connect-strava">Mit Strava verbinden</button></div>
</article>`;

const noRunsHTML = (sinceISO) => `<article class="sd-card sd-card--center" data-card="empty">
  <h2 class="sd-card__title">Noch keine Läufe</h2>
  <p class="sd-card__text">Seit ${shortDate(sinceISO)} liegt noch kein Lauf in Strava.</p>
</article>`;

/**
 * Slot-Inhalt im Modus Lauf. vm: { workerConfigured, error, errorSource, connected, runs,
 * today, planStart, sinceISO }. Läufe tragen optional planType (Plan-Typ des Plantags) und
 * long (Long Run), beides vom Aufrufer aus der Zuordnung abgeleitet.
 */
export function runSlotHTML(vm) {
  if (!vm.workerConfigured) return workerMissingHTML();
  if (vm.error) return stravaErrorHTML({ source: vm.errorSource, message: vm.error });
  if (vm.connected === false) return noStravaHTML();
  const runs = vm.runs || [];
  if (!runs.length) return noRunsHTML(vm.sinceISO);
  const last = runs.slice(-MAX_LIST);
  return [
    tilesHTML(runStats(runs, vm.today, vm.planStart), vm.planStart),
    runChartHTML(last),
    runListHTML(last),
  ].filter(Boolean).join("\n");
}

// ---------- Modus Kraft ----------

/** Fehlerkarte für Firebase-Fehler beim Laden der Logs (13.6). */
export const strengthErrorHTML = (message) => `<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="firebase">
  <p class="sd-card__title sd-card__title--danger">Verlauf konnte nicht geladen werden</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button></div>
</div>`;

const strengthEmptyHTML = (name) => `<article class="sd-card sd-card--center" data-card="strength-empty">
  <h2 class="sd-card__title">Noch nichts erfasst</h2>
  <p class="sd-card__text">Für ${esc(name)} gibt es noch keinen Eintrag. Er erscheint hier, sobald du die Übung im Kraft-Tag abschließt.</p>
</article>`;

/** Einträge für die Liste: Log mit Gewicht oder Wiederholungen, älteste zuerst, höchstens 10. */
export function strengthEntries(logs, plan) {
  return (logs || [])
    .filter((l) => l.completed !== false)
    .map((l) => {
      const sets = l.sets || [];
      const topKg = l.topKg ?? Math.max(0, ...sets.map((s) => s.kg ?? 0));
      const totalReps = l.totalReps ?? sets.reduce((a, s) => a + (s.reps ?? 0), 0);
      const week = weekNumberFor(plan, l.date);
      const w = week == null ? null : weekOf(plan, week);
      return { date: l.date, topKg, totalReps, week, deload: w?.weekType === "Entlastung" || w?.deload === true };
    })
    .filter((e) => e.topKg > 0 || e.totalReps > 0)
    .slice(-MAX_LIST);
}

/** Ein Platz je Planwoche von der ersten Woche mit Eintrag bis zur aktuellen; leere Wochen bleiben null. */
function weekSlots(bars, currentWeek) {
  const first = bars[0].week;
  const last = Math.max(bars[bars.length - 1].week, currentWeek ?? 0);
  const byWeek = new Map(bars.map((b) => [b.week, b]));
  return Array.from({ length: last - first + 1 }, (_, i) => ({ week: first + i, bar: byWeek.get(first + i) ?? null }));
}

function trendHTML(bars) {
  const text = kraftTrendText(bars);
  if (!text) return "";
  const [delta, since] = text.split(" seit ");
  const unchanged = delta.startsWith("±");
  const up = delta.startsWith("+");
  return `<p class="sd-trend sd-mono${up ? " is-up" : ""}"><span>${unchanged ? "unverändert" : esc(delta)}</span><span class="sd-trend__since">seit ${esc(since)}</span><button type="button" class="sd-infobtn" data-action="open-info" data-info="verlauf-trend" aria-haspopup="dialog" aria-label="Erklärung: Trend">${I_INFO}</button></p>`;
}

function strengthChartHTML(slots, unit, weightMode, currentWeek) {
  const rects = barRects(slots.map((s) => s.bar?.value ?? null), { plotHeight: 130, gap: 3 });
  const bars = rects.map((g, i) => {
    if (!g) return "";
    const { week, bar } = slots[i];
    const cls = bar.deload ? " sd-chart__bar--deload" : "";
    const tip = `W${week}: ${de1(bar.value)} ${unit}${bar.deload ? " (Entlastung)" : ""}`;
    return `<rect class="sd-chart__bar${cls}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="${g.rx}"><title>${esc(tip)}</title></rect>`;
  }).join("");
  const values = slots.filter((s) => s.bar).map((s) => s.bar.value);
  const hasDeload = slots.some((s) => s.bar?.deload);
  const cur = slots.find((s) => s.week === currentWeek)?.bar;
  const aria = `Balkendiagramm: ${weightMode ? "bestes Satzgewicht" : "Wiederholungen"} je Woche, W${slots[0].week} bis W${slots[slots.length - 1].week}, von ${de1(Math.min(...values))} bis ${de1(Math.max(...values))} ${unit}. `
    + `Aktuelle Woche: ${cur ? `${de1(cur.value)} ${unit}` : "noch kein Eintrag"}.${hasDeload ? " Hellere Balken sind Entlastungswochen." : ""}`;
  const axis = axisHTML(slots.map((s) => `W${s.week}`), slots.findIndex((s) => s.week === currentWeek));
  const legend = hasDeload ? `\n  <p class="sd-chart__legend">${legendItem("deload", "Entlastungswoche")}</p>` : "";
  return `<figure class="sd-chart">
    <svg class="sd-chart__plot sd-chart__plot--tall" viewBox="0 0 ${PLOT_W} 130" preserveAspectRatio="none" role="img" focusable="false" aria-label="${esc(aria)}">${bars}</svg>
    ${axis}
  </figure>${legend}`;
}

function strengthBestHTML(bars, currentWeek) {
  const unit = bars[0].unit;
  const weightMode = unit === "kg";
  const slots = weekSlots(bars, currentWeek);
  // Der aktuelle Platz ist der letzte; liegt die aktuelle Woche vor dem letzten Eintrag, zählt dieser.
  const cur = slots[slots.length - 1].week;
  return `<section class="sd-card" data-card="strength-best" aria-labelledby="bestTitle">
  <div>
    <h2 class="sd-card__title" id="bestTitle">${weightMode ? "Bestes Satzgewicht" : "Wiederholungen gesamt"}</h2>
    <p class="sd-hint">${weightMode ? "Schwerster Satz je Woche" : "Höchste Summe je Woche"}</p>
  </div>
  <div class="sd-best">
    <p class="sd-best__val sd-mono"><span class="sd-vh">Zuletzt </span>${de1(bars[bars.length - 1].value)}<span class="sd-unit">${unit}</span></p>
    ${trendHTML(bars)}
  </div>
  ${strengthChartHTML(slots, unit, weightMode, cur)}
</section>`;
}

function strengthListHTML(entries) {
  const rows = entries.slice().reverse().map((e) => {
    const reps = `<span>${e.totalReps} Wdh</span>`;
    const val = e.topKg > 0 ? `<span>${de1(e.topKg)} kg</span><span class="sd-hrow__sep" aria-hidden="true">·</span>${reps}` : reps;
    const sub = e.week == null ? "" : `<span class="sd-hrow__sub sd-mono">Woche ${e.week}${e.deload ? " · Entlastung" : ""}</span>`;
    return `<li class="sd-hrow" role="listitem" data-date="${esc(e.date)}">
    <span class="sd-stripe sd-stripe--kraft" aria-hidden="true"></span>
    <span class="sd-hrow__main"><span class="sd-hrow__title">${dayNameDE(e.date)}, ${shortDate(e.date)}</span>${sub}</span>
    <span class="sd-hrow__val sd-mono">${val}</span>
  </li>`;
  }).join("\n  ");
  return `<ul class="sd-card sd-card--list sd-rows" role="list" data-card="strength-list" aria-label="Letzte Einträge">
  ${rows}
</ul>`;
}

/**
 * Slot-Inhalt im Modus Kraft. vm: { name, slug, logs, plan, today }. Wochenbalken kommen aus
 * history-data.kraftWeeklyBars, der Trend aus kraftTrendText.
 */
export function strengthSlotHTML({ name, slug, logs, plan, today }) {
  const entries = strengthEntries(logs, plan);
  if (!entries.length) return strengthEmptyHTML(name);
  const bars = kraftWeeklyBars(logs, slug, plan);
  const currentWeek = weekNumberFor(plan, today) ?? (today < plan.start ? null : plan.totalWeeks);
  return [bars.length ? strengthBestHTML(bars, currentWeek) : "", strengthListHTML(entries)].filter(Boolean).join("\n");
}

// ---------- Info-Sheet (13.7) ----------

export const infoContent = () => ({
  "verlauf-pace": {
    title: "Ø Pace",
    blocks: [
      { heading: "Berechnung", text: "Mittel der Pace aus den letzten bis zu 10 Läufen, die eine Pace haben. Jeder Lauf zählt gleich, unabhängig von der Distanz." },
      { heading: "Bedeutung", text: "Ein Richtwert für dein Grundtempo. Intervalle und Long Runs ziehen den Schnitt, er sagt darum wenig über einzelne Einheiten." },
    ],
  },
  "verlauf-trend": {
    title: "Trend",
    blocks: [
      { heading: "Berechnung", text: "Differenz zwischen dem Wert der letzten Woche mit Eintrag und dem Wert der ersten Woche im Diagramm. Es zählt je Woche der schwerste Satz (bei Übungen ohne Gewicht die höchste Wiederholungssumme)." },
      { heading: "Bedeutung", text: "Ein Plus heißt: Du bewegst mehr als zu Beginn. In Entlastungswochen darf der Wert sinken, das ist gewollt." },
    ],
  },
});
