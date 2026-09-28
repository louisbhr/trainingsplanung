// Rendering des Dashboards (F1–F8, M2-4ff.). Reine Render-Funktionen: sie
// bekommen fertige Daten und geben HTML-Strings zurück; State und
// Datenzugriff (Firestore, Strava, Plan) bleiben in app.js. Keine eigenen
// Styles — alle Klassen kommen aus style.css (D0), siehe
// docs/ui-markup-dashboard-v2.md für die genaue Markup-Referenz.
import { esc, ICONS, skelLine } from "./ui.js?v=202609281048";
import { formatDuration } from "./strava.js?v=202609281048";

export const AMPEL_LABELS = { wochensoll: "Wochensoll", easy: "Easy-Disziplin", belastung: "Belastung", kraft: "Kraft-Progression" };

// ---------- Kopfzeile (F2) ----------
export function headerHTML({ eyebrow, title, badge, countdown }) {
  return `<p class="eyebrow">${esc(eyebrow)}</p>
    <div class="title-row"><h1>${esc(title)}</h1>${badge}</div>
    <p class="countdown">${esc(countdown)}</p>`;
}
export function phaseBadgeHTML(n, name, tone) {
  return `<span class="badge tone-${tone}">Phase ${n} · ${esc(name)}</span>`;
}
export function noPlanBadgeHTML() {
  return `<span class="badge">Ohne Plan</span>`;
}

// ---------- "Heute dran" (F4) ----------
export function todayCardKraftHTML(session, { expanded, progressText, exercises }) {
  const first = exercises[0];
  return `<div class="card today-card k-kraft">
    <div class="top">
      <div>
        <p class="eyebrow2">Heute dran</p>
        <p class="name2">${esc(session.label)}</p>
        <p class="sub">${exercises.length} ${exercises.length === 1 ? "Übung" : "Übungen"}${first ? " · " + esc(first.soll) : ""}</p>
      </div>
      <button type="button" class="start-btn" data-action="toggle-today-exercises"
        aria-expanded="${expanded ? "true" : "false"}" aria-controls="todayExList">${expanded ? "Schließen" : "Starten"}</button>
    </div>
    <div class="ex-list${expanded ? " open" : ""}" id="todayExList">
      <div class="ex-list-head"><span class="ex-progress">${esc(progressText)}</span></div>
      ${exercises.map((ex) => `
        <button type="button" class="ex-row" data-action="open-day" data-date="${session.date}">
          <span class="exn">${esc(ex.name)}</span>
          <span class="exs">${esc(ex.soll)}</span>
          ${ICONS.chevronRight}
        </button>`).join("")}
      <p class="ex-hint">Tippen auf eine Übung öffnet die bestehende Kraft-Tagesansicht (Sätze, Anpassen, Progressionsvorschlag).</p>
    </div>
  </div>`;
}

export function todayCardLaufHTML(session, actualHTML) {
  const cls = session.shortType === "Long" ? "k-long" : "k-lauf";
  return `<div class="card today-card ${cls}">
    <p class="eyebrow2">Heute dran</p>
    <p class="name2">${esc(session.type)} ${esc(session.dist)}</p>
    <p class="sub">Ziel-Pace ${esc(session.pace)} · HF-Zone ${esc(session.hf)}</p>
    ${actualHTML}
  </div>`;
}
export function laufLoadingHTML() {
  return `<p class="sub loading-hint">Ist-Werte werden nach dem Lauf aus Strava geladen.</p><div class="skel skel-line" style="width:70%;height:10px;"></div>`;
}
export function laufActualHTML(a) {
  if (!a || !a.run) return `<p class="sub loading-hint">Noch kein Lauf zugeordnet.</p>`;
  const m = a.run;
  return `<div class="metric-grid" style="margin-top:8px;">
      <div><p class="metric-label">Distanz</p><p class="metric-value" style="font-size:18px;">${m.distanceKm.toFixed(1)} km</p></div>
      <div><p class="metric-label">Pace</p><p class="metric-value" style="font-size:18px;">${esc(m.paceLabel)}</p></div>
      <div><p class="metric-label">Dauer</p><p class="metric-value" style="font-size:18px;">${esc(formatDuration(m.movingTimeSec))}</p></div>
      <div><p class="metric-label">Ø HF</p><p class="metric-value" style="font-size:18px;">${m.avgHr ? m.avgHr + " bpm" : "–"}</p></div>
    </div>${a.offset !== 0 ? `<p class="sub">nachgeholt</p>` : ""}`;
}

export function todayCardRuheHTML() {
  return `<div class="card today-card k-ruhe"><p class="name">Ruhetag</p><p class="hint">Mobility, Foam Rolling, Beine hoch.</p></div>`;
}
export function todayCardPlaceholderHTML(phaseN, focus) {
  return `<div class="card notice"><p class="name">Details nach Re-Kalibrierung</p><p class="hint">Phase ${phaseN} · ${esc(focus || "")}</p></div>`;
}
export function todayCardNoPlanHTML(stravaSummary) {
  return `<div class="card today-card k-noplan">
    <p class="name">Kein Plan aktiv</p>
    <p class="hint">Läufe werden weiter aus Strava gezeigt.</p>
    ${stravaSummary ? `<p class="hint strava-fallback">Heute: ${esc(stravaSummary)} (aus Strava)</p>` : ""}
  </div>`;
}
export function todayCardBisZumRennenHTML() {
  return `<div class="card notice"><p class="name">Bis zum Rennen</p><p class="hint">Der Plan endet vor dem Renntag — für diesen Tag gibt es keine Einheit mehr.</p></div>`;
}

// ---------- Coach (F6) ----------
// M2-4: nur der Lade-Platzhalter und der feste "kein Plan"-Hinweis; echte
// Inhalte (täglich/Wochenbilanz) kommen mit M2-9/M2-10 dazu.
export function coachPlaceholderHTML() {
  return `<div class="coach-card"><div class="head">${ICONS.chat}
    <div class="body"><p class="label">Coach</p>${skelLine("92%")}${skelLine("60%")}
    <p class="note">Wird vorbereitet. Das Dashboard wartet nicht darauf.</p></div></div></div>`;
}
export function coachNoPlanHTML(text) {
  return `<div class="coach-card"><div class="head">${ICONS.info}
    <div class="body"><p class="label">Coach</p><p class="text">${esc(text)}</p></div></div></div>`;
}
export function coachTextHTML(text, bilanzHTML = "") {
  return `<div class="coach-card"><div class="head">${ICONS.chat}
    <div class="body"><p class="label">Coach</p><p class="text">${esc(text)}</p></div></div>${bilanzHTML}</div>`;
}
export function bilanzExpandedHTML(weekN, text) {
  return `<div class="divider"></div>
    <p class="bilanz-heading">Wochenbilanz · Woche ${weekN}</p>
    <p class="bilanz-body">${esc(text)}</p>`;
}
export function bilanzCollapsedHTML(weekN, expanded, text) {
  return `<div class="divider"></div>
    <button type="button" class="bilanz-toggle" data-action="toggle-bilanz"
      aria-expanded="${expanded ? "true" : "false"}" aria-controls="bilanzBody">
      Wochenbilanz W${weekN} ${ICONS.chevronDown}
    </button>
    <div class="bilanz-body" id="bilanzBody"${expanded ? "" : " hidden"}>${esc(text)}</div>`;
}

// ---------- Ampeln (F5) + Info-Sheets (D1) ----------
// M2-4: Lade-Platzhalter für alle vier; echte Werte kommen mit M2-5.
export function ampelPlaceholderGridHTML() {
  return `<div class="ampel-grid">${Object.entries(AMPEL_LABELS)
    .map(
      ([, label]) => `
    <div class="ampel-tile">
      <div class="row1"><span class="ampel-dot st-loading"></span><p class="title">${esc(label)}</p></div>
      <div style="margin-top:6px;">${skelLine("80%")}</div>
    </div>`
    )
    .join("")}</div>`;
}
export function ampelGridHTML(list) {
  return `<div class="ampel-grid">${list
    .map(
      (a) => `
    <div class="ampel-tile">
      <div class="row1"><span class="ampel-dot st-${a.status}"></span><p class="title">${esc(AMPEL_LABELS[a.key])}</p>
        <button type="button" class="info-btn" data-action="open-info" data-info="${a.key}"
          aria-label="Erklärung: ${esc(AMPEL_LABELS[a.key])}">${ICONS.info}</button></div>
      <p class="detail">${esc(a.detail)}</p>
    </div>`
    )
    .join("")}</div>`;
}

// ---------- Info-Sheets (D1) ----------
// Texte je Ampel + Aerobe Effizienz; Grenzwerte kommen aus THRESHOLDS
// (config.js), nicht als fester Text — F5/D1.
export function infoContent(THRESHOLDS) {
  const w = THRESHOLDS.wochensoll, b = THRESHOLDS.belastung, k = THRESHOLDS.kraft;
  const pct = (n) => Math.round(n * 100);
  const comma = (n) => String(n).replace(".", ",");
  return {
    wochensoll: {
      title: "Wochensoll",
      body: [
        "Berechnung: gelaufene Kilometer der Planwoche bis heute im Verhältnis zu den geplanten Kilometern derselben Tage, dazu die erledigten Krafteinheiten.",
        `Bedeutung: Grün ab ${pct(w.gruen)} % der geplanten Kilometer. Gelb zwischen ${pct(w.gelb)} % und ${pct(w.gruen)} %. Rot darunter. Eine verpasste, bereits vergangene Einheit zählt mindestens als Gelb.`,
        "Grau: kein aktiver Plan oder die Woche hat noch keine Details.",
      ],
    },
    easy: {
      title: "Easy-Disziplin",
      body: [
        "Berechnung: die Herzfrequenz deiner letzten drei Easy-, Long- oder Recovery-Läufe im Vergleich zur Obergrenze der jeweiligen Zone.",
        `Bedeutung: Grün, wenn alle drei im Rahmen liegen. Gelb bei einem Ausreißer bis ${THRESHOLDS.easy.gelbMaxOver} Schläge über der Grenze. Rot bei zwei oder mehr Ausreißern oder einem deutlich über der Grenze.`,
        "Grau: noch kein zugeordneter Lauf vorhanden.",
      ],
    },
    belastung: {
      title: "Belastung",
      body: [
        "Berechnung: Kilometer der letzten 7 Tage geteilt durch die durchschnittlichen Wochenkilometer der 28 Tage davor.",
        `Bedeutung: 1,0 heißt so viel wie zuletzt üblich. In Entlastungswochen ist ein Wert unter 1 gewollt. Über ${comma(b.gruen)} steht auf Gelb, du steigerst schnell. Über ${comma(b.gelb)} steht auf Rot, das ist ein deutlich zu schneller Anstieg.`,
        "Ehrlicher Hinweis: eine grobe Faustregel (Acute:Chronic), gedacht als Warnsignal, keine Verletzungsprognose.",
        "Grau: weniger als 4 Wochen Lauf-Historie.",
      ],
    },
    kraft: {
      title: "Kraft-Progression",
      body: [
        `Berechnung: deine Gewichtsübungen der letzten ${k.windowDays} Tage, Deload-Wochen zählen nicht mit.`,
        `Bedeutung: Grün, wenn keine Übung feststeckt. Gelb bei einer Übung ohne Steigerung oder unter Soll. Rot bei ${k.redAffectedCount} oder mehr betroffenen Übungen oder wenn dieselbe Übung ${k.redConsecutiveBelow}-mal in Folge unter Soll bleibt.`,
        `Grau: weniger als ${k.minExercisesWithData} Gewichtsübungen mit Daten, oder kein aktiver Plan.`,
      ],
    },
    aerobe: {
      title: "Aerobe Effizienz",
      body: [
        "Berechnung: die durchschnittliche Pace deiner Läufe mit Herzfrequenz in der Easy-Zone, pro Woche.",
        "Bedeutung: sinkt die Pace bei gleicher Herzfrequenz, wird deine Grundlagenausdauer besser. Wochen ohne passenden Lauf zählen nicht mit.",
      ],
    },
  };
}

// ---------- "Im Detail" (F8) ----------
// M2-4: ein einzelner Lade-Platzhalter; die echten Karten (Wochenvolumen,
// Aerobe Effizienz, Adhärenz, Als Nächstes) kommen mit M2-6.
export function detailPlaceholderHTML() {
  return `<p class="section-label">Im Detail</p>
    <div class="card">${skelLine("40%")}<div class="skel-tile-body" style="height:90px;"><div class="skel-bar" style="height:60%;"></div></div></div>`;
}

export function volumeCardHTML(weeks) {
  const maxV = Math.max(1, ...weeks.map((w) => w.soll || 0), ...weeks.map((w) => w.ist || 0));
  const bar = (v) => Math.max(4, Math.round((v / maxV) * 84));
  return `<div class="card">
    <p class="name">Wochenvolumen · Soll vs. Ist</p>
    <div class="si-bar-legend">
      <span class="lg-item"><span class="lg-swatch lg-soll"></span>Soll</span>
      <span class="lg-item"><span class="lg-swatch lg-ist"></span>Ist</span>
    </div>
    <div class="si-bars">
      ${weeks
        .map(
          (w) => `
        <div class="si-bar-col">
          <div class="si-bar-pair">
            ${w.soll != null ? `<div class="si-bar-soll" style="height:${bar(w.soll)}px"></div>` : ""}
            ${w.ist != null && w.ist > 0 ? `<div class="si-bar-ist" style="height:${bar(w.ist)}px"></div>` : ""}
          </div>
          <span class="si-bar-label${w.isCurrent ? " current" : ""}">W${w.w}</span>
        </div>`
        )
        .join("")}
    </div>
  </div>`;
}

export function aerobeCardHTML({ points, deltaText, good }) {
  const width = 300, height = 60, pad = 6;
  const paces = points.map((p) => p.avgPace);
  const minP = Math.min(...paces), maxP = Math.max(...paces);
  const range = maxP - minP || 1;
  const pts = points
    .map((p, i) => {
      const x = points.length > 1 ? pad + (i / (points.length - 1)) * (width - 2 * pad) : width / 2;
      // Schnellere Pace (kleinerer Wert) höher im Chart.
      const y = pad + ((p.avgPace - minP) / range) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<div class="card">
    <div class="aerobe-head">
      <span class="aerobe-title"><span class="name">Aerobe Effizienz</span>
        <button type="button" class="info-btn" data-action="open-info" data-info="aerobe" aria-label="Erklärung: Aerobe Effizienz">${ICONS.info}</button></span>
      ${deltaText ? `<p class="aerobe-delta ${good ? "good" : "bad"}">${esc(deltaText)}</p>` : ""}
    </div>
    <p class="hint">Ø Pace bei Läufen mit HF in der Z2-Zone</p>
    ${
      points.length
        ? `<svg class="aerobe-chart" viewBox="0 0 ${width} ${height}">
      <polyline points="${pts}" fill="none" stroke="var(--coral-fg)" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`
        : `<p class="center-note">Noch keine Läufe in der Zone.</p>`
    }
  </div>`;
}

export function adherenceTileHTML({ pct, done, planned }) {
  return `<div class="metric-tile">
    <p class="metric-label">Adhärenz 4 Wo.</p>
    <p class="metric-value">${pct} %</p>
    <div class="metric-bar-track"><div class="metric-bar-fill" style="width:${pct}%"></div></div>
    <p class="metric-sub">${done} von ${planned} Einheiten</p>
  </div>`;
}
export function nextUpTileHTML(lines) {
  return `<div class="metric-tile">
    <p class="metric-label">Als Nächstes</p>
    <p class="metric-sub">${lines.map(esc).join("<br>")}</p>
  </div>`;
}
