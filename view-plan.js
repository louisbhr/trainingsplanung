// Rendering des Plan-Tabs (Stride E7): Ziel-Karte mit Phasenbalken, Phasen, Trainingsbereiche.
// Reine Funktionen (Auflage C5: kein Firebase, Strava oder app.js). Der Balken ist ein
// Inline-SVG mit Zahlen-Attributen, kein style="..." (Entscheid E7). Das Konto-Teil liefert
// view-account.js und kommt als fertiger String herein. Markup: docs/ui-markup-stride.md,
// Abschnitt 14. Plan-Texte (Phase, Zone, Ziel) laufen durch esc(); tone nur aus fester Liste.
import { formatGoal, germanDate, monthLabel, phaseRange } from "./plan.js?v=202610221048";
import { esc } from "./ui.js?v=202610221048";

const BAR_W = 300;
const BAR_GAP = 3;
const TONES = ["teal", "coral", "purple", "sky", "amber"];
const tone = (t) => (TONES.includes(t) ? t : "teal");

const svgNum = (x) => (Number.isFinite(x) ? String(Math.round(x * 10) / 10) : "0");

// ---------- Kopf (14.0) ----------

/** Inhalt von <header class="sd-pagehead">; das Leerzeichen vor "%" ist geschützt, sonst bricht die Zahl ab. */
export function headHTML({ week, totalWeeks, pct }) {
  return `<div class="sd-tabhead">
  <div class="sd-tabhead__titles">
    <p class="sd-intro__sub">Woche ${week} von ${totalWeeks} · ${pct} % geschafft</p>
    <h1 class="sd-display" tabindex="-1">Trainingsplan</h1>
  </div>
</div>`;
}

// ---------- Phasenbalken (14.2) ----------

/**
 * Segmente und Füllungen des Balkens. doneWeeks = erledigte Wochen (Kopfzeile: week - 1);
 * erledigte Phasen sind ganz gefüllt, die laufende anteilig, spätere gar nicht.
 * Rückgabe je Phase { x, width, fill, tone } als Zahlen (fill = gefüllte Breite).
 */
export function phaseBarGeometry(phases, doneWeeks) {
  const lens = phases.map((p) => p.weeks.to - p.weeks.from + 1);
  const total = lens.reduce((a, b) => a + b, 0);
  const usable = BAR_W - BAR_GAP * (phases.length - 1);
  let x = 0;
  return phases.map((p, i) => {
    const width = (usable * lens[i]) / total;
    const done = Math.min(lens[i], Math.max(0, doneWeeks - (p.weeks.from - 1)));
    const seg = { x, width, fill: (width * done) / lens[i], tone: tone(p.tone) };
    x += width + BAR_GAP;
    return seg;
  });
}

function phaseBarHTML(plan, doneWeeks, currentPhaseN) {
  const parts = phaseBarGeometry(plan.phases, doneWeeks).map((s) => {
    const seg = `<rect class="sd-phasebar__seg sd-phasebar__seg--${s.tone}" x="${svgNum(s.x)}" y="0" width="${svgNum(s.width)}" height="10" rx="5"/>`;
    const fill = s.fill > 0 ? `\n  <rect class="sd-phasebar__fill" x="${svgNum(s.x)}" y="0" width="${svgNum(s.fill)}" height="10" rx="5"/>` : "";
    return seg + fill;
  });
  const label = plan.phases
    .map((p) => `Phase ${p.n} ${p.name}, Woche ${p.weeks.from} bis ${p.weeks.to}${p.n === currentPhaseN ? ", läuft" : ""}.`)
    .join(" ");
  return `<svg class="sd-phasebar" viewBox="0 0 ${BAR_W} 10" preserveAspectRatio="none" role="img" focusable="false" aria-label="${esc(`Phasen über ${plan.totalWeeks} Wochen: ${label}`)}">
  ${parts.join("\n  ")}
</svg>`;
}

// ---------- Ziel-Karte (14.1) ----------

function goalHTML(plan, doneWeeks, currentPhaseN) {
  const g = plan.goal;
  const confirmed = g.raceDateConfirmed;
  const pace = g.targetPace
    ? `\n      <p class="sd-goal__pace sd-mono">${esc(g.targetPace)}${/\/km/.test(g.targetPace) ? "" : " /km"}</p>`
    : "";
  const hint = confirmed ? "" : '\n  <p class="sd-hint">Das Renndatum ist noch nicht bestätigt.</p>';
  return `<section class="sd-card sd-goal" data-card="goal" aria-labelledby="goalTitle">
  <div class="sd-goal__top">
    <div class="sd-goal__main">
      <h2 class="sd-goal__label" id="goalTitle">Ziel · ${esc(g.distance)}</h2>
      <p class="sd-goal__time sd-mono">${esc(formatGoal(g).time)}</p>
    </div>
    <div class="sd-goal__race">
      <p class="sd-goal__k">${confirmed ? "Renntag" : "Rennen ca."}</p>
      <p class="sd-goal__date sd-mono">${confirmed ? germanDate(g.raceDate) : monthLabel(g.raceDate)}</p>${pace}
    </div>
  </div>
  ${phaseBarHTML(plan, doneWeeks, currentPhaseN)}${hint}
</section>`;
}

// ---------- Phasen (14.3) und Zonen (14.4) ----------

function phasesHTML(plan, currentPhaseN) {
  const rows = plan.phases.map((p) => {
    const current = p.n === currentPhaseN;
    return `<li class="sd-phase tone-${tone(p.tone)}${current ? " is-current" : ""}" role="listitem"${current ? ' aria-current="true"' : ""} data-phase="${p.n}">
    <span class="sd-phase__num" aria-hidden="true">${p.n}</span>
    <span class="sd-phase__main">
      <span class="sd-phase__name"><span class="sd-vh">Phase ${p.n}: </span>${esc(p.name)}</span>
      <span class="sd-phase__sub">${esc(phaseRange(plan, p))} · ${esc(p.focus)}</span>
    </span>${current ? '\n    <span class="sd-pill sd-pill--teal">läuft</span>' : ""}
  </li>`;
  }).join("\n  ");
  return `<ul class="sd-card sd-card--list sd-rows" role="list" data-card="phases" aria-label="Phasen">
  ${rows}
</ul>`;
}

function zonesHTML(plan) {
  const rows = plan.zones.map((z) => {
    const [tag, label] = z.zone.split(" – ");
    return `<li class="sd-zone tone-${tone(z.tone)}" role="listitem" data-zone="${esc(tag)}">
    <span class="sd-zone__badge">${esc(tag)}</span>
    <span class="sd-zone__main"><span class="sd-zone__name">${esc(label)}</span><span class="sd-zone__use">${esc(z.use)}</span></span>
    <span class="sd-zone__vals"><span class="sd-zone__hf">${esc(z.hf)} bpm</span><span class="sd-zone__pace">${esc(z.pace)}</span></span>
  </li>`;
  }).join("\n  ");
  return `<ul class="sd-card sd-card--list sd-rows" role="list" data-card="zones" aria-label="Trainingsbereiche">
  ${rows}
</ul>`;
}

/**
 * Inhalt von #main unter dem Kopf. vm: { plan, week, status ("before" | "in" | "after"),
 * accountHTML }. Vor dem Plan ist nichts erledigt und keine Phase läuft, danach ist alles
 * erledigt; die Kopfzeile zählt weiter week - 1.
 */
export function pageHTML({ plan, week, status, accountHTML }) {
  const doneWeeks = status === "after" ? plan.totalWeeks : status === "before" ? 0 : Math.max(0, week - 1);
  const currentPhase = status === "in" ? plan.phases.find((p) => week >= p.weeks.from && week <= p.weeks.to) : null;
  const cp = currentPhase?.n ?? null;
  return `<div class="sd-main sd-main--tight">
  ${goalHTML(plan, doneWeeks, cp)}
  <h2 class="sd-label">Phasen</h2>
  ${phasesHTML(plan, cp)}
  <h2 class="sd-label">Trainingsbereiche</h2>
  ${zonesHTML(plan)}
  ${accountHTML}
</div>`;
}
