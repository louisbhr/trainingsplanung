// Rendering des Kraft-Tags "Fokus" (Stride E5). Reine Render-Funktionen: sie
// bekommen fertige Daten und geben HTML-Strings zurück. State, Laden, Speichern
// und Events bleiben in app.js (Auflage C5: dieses Modul importiert nie
// Firebase, Strava oder app.js). Keine eigenen Styles und kein style="...":
// alle Klassen kommen aus style.css, das Markup steht in
// docs/ui-markup-stride.md, Abschnitt 11. Fremde Texte immer durch esc().
//
// Ein Übungs-Modell (vm) trägt alles, was eine Übung zeigt:
//   { slug, name, soll, hint, custom, mode: "weight"|"reps"|"time", weightAdded,
//     sets: [{ kg, reps, done }], activeIndex: number|null, saved, saving,
//     saveError: string|null, editing: { field, text }|null,
//     chip: { level, text }|null, lastText: string|null, savedSets: [{ kg, reps }],
//     nextSlug, nextName }   // nextSlug/nextName nur an der Jetzt-Übung gesetzt
import { esc, checkCircle, ringOpen, ringRunning, pill } from "./ui.js?v=202610221048";

const I_CHEV_L = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

// Deutsche Kommazahl: 62.5 -> "62,5", 20 -> "20"
export const fmtNum = (n) => String(Math.round(Number(n) * 10) / 10).replace(".", ",");

// Chip-Stufen kommen aus progression.js; nur diese Klassen gibt es (Markup 11.3).
const TIP_LEVELS = ["up", "hold", "down"];

// ---------- Zusammenfassungen ----------

/** "2× 6 · 60 kg", "2× 5 Wdh", "2× 30 s" aus den gespeicherten Sätzen. */
export function summaryText(savedSets, mode) {
  const sets = (savedSets ?? []).filter((s) => s && typeof s.reps === "number");
  if (!sets.length) return "";
  const reps = sets.map((s) => s.reps);
  const repText = reps.every((r) => r === reps[0]) ? `${sets.length}× ${reps[0]}` : reps.join("/");
  const topKg = Math.max(0, ...sets.map((s) => s.kg ?? 0));
  if (mode === "time") return `${repText} s`;
  if (topKg > 0) return `${repText} · ${fmtNum(topKg)} kg`;
  return `${repText} Wdh`;
}

// "3x10/Seite" -> "3×10/Seite" (nur Anzeige in der Liste)
const sollText = (soll) => String(soll ?? "").replace(/(\d)\s*x\s*(?=\d)/gi, "$1×");

// ---------- Kopf (11.1, 11.2) ----------

function dotsHTML(exercises, focusSlug) {
  const segs = exercises.map((vm) => {
    const current = vm.slug === focusSlug;
    const cls = current ? " is-current" : vm.saved ? " is-done" : "";
    const label = current
      ? `${vm.name}, aktuelle Übung${vm.saved ? ", erledigt" : ""}`
      : `${vm.name}, ${vm.saved ? "erledigt" : "offen"}`;
    return `<button type="button" class="sd-dots__seg${cls}" data-action="focus-exercise" data-slug="${esc(vm.slug)}" aria-label="${esc(label)}"${current ? ' aria-current="true"' : ""}></button>`;
  }).join("");
  return `<div class="sd-dots" role="group" aria-label="Übungen">${segs}</div>`;
}

const backButton = (backLabel) =>
  `<button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${I_CHEV_L}${esc(backLabel)}</button>`;

/**
 * Inhalt von <header class="sd-pagehead"> (setPageHead). exercises = null beim Laden
 * (Zähler leer, aber im Markup, damit nichts springt).
 */
export function headHTML({ label, backLabel, exercises }) {
  let meta = '<span class="sd-nav__meta"></span>';
  if (exercises) {
    if (!exercises.length) {
      meta = '<span class="sd-nav__meta">Keine Übungen</span>';
    } else {
      meta = `<span class="sd-nav__meta">${exercises.filter((e) => e.saved).length} von ${exercises.length} erledigt</span>`;
    }
  }
  return `<h1 class="sd-vh">${esc(label)}</h1>
<nav class="sd-nav" aria-label="Kopfzeile">${backButton(backLabel)}${meta}</nav>`;
}

/** Kopf mit Fortschrittspunkten (Normalansicht, mindestens eine Übung). */
export function headWithDotsHTML({ label, backLabel, exercises, focusSlug }) {
  return headHTML({ label, backLabel, exercises }) + (exercises.length ? dotsHTML(exercises, focusSlug) : "");
}

/** Kopf des Anpassen-Modus (11.10): Fertig statt Zähler, Tagestitel statt Punkte. */
export function editHeadHTML({ label, backLabel, dateText }) {
  return `<nav class="sd-nav" aria-label="Kopfzeile">${backButton(backLabel)}<button type="button" class="sd-btn sd-btn--text" data-action="toggle-edit">Fertig</button></nav>
<div class="sd-daytitle">
  <p class="sd-eyebrow sd-eyebrow--teal sd-eyebrow--plain">Anpassen · ${esc(dateText)}</p>
  <h1 class="sd-display">${esc(label)}</h1>
  <p class="sd-target">Änderungen gelten nur für heute.</p>
</div>`;
}

// ---------- Stepper (11.4a) ----------

const FIELDS = {
  kg: {
    cls: " sd-stepper--weight", unit: "kg", inputmode: "decimal",
    group: (vm) => (vm.weightAdded ? "Zusatzgewicht in kg" : "Gewicht in kg"),
    dec: "Gewicht verringern", inc: "Gewicht erhöhen",
    valLabel: (v) => `Gewicht eintippen, aktuell ${fmtNum(v)} kg`,
  },
  reps: {
    cls: "", unit: "Wdh", inputmode: "numeric",
    group: () => "Wiederholungen",
    dec: "Wiederholungen verringern", inc: "Wiederholungen erhöhen",
    valLabel: (v) => `Wiederholungen eintippen, aktuell ${fmtNum(v)}`,
  },
  sec: {
    cls: "", unit: "s", inputmode: "numeric",
    group: () => "Dauer in Sekunden",
    dec: "Sekunden verringern", inc: "Sekunden erhöhen",
    valLabel: (v) => `Sekunden eintippen, aktuell ${fmtNum(v)} s`,
  },
};

function stepperHTML(field, value, vm, solo) {
  const f = FIELDS[field];
  const group = f.group(vm);
  const editing = vm.editing?.field === field;
  const mid = editing
    ? `<span class="sd-stepper__field"><input class="sd-stepper__input" type="text" inputmode="${f.inputmode}" enterkeyhint="done" autocomplete="off" aria-label="${esc(group)}" value="${esc(vm.editing.text)}"><span class="sd-stepper__unit">${f.unit}</span></span>`
    : `<button type="button" class="sd-stepper__val" data-action="edit-value" data-field="${field}" aria-label="${esc(f.valLabel(value))}"><span class="sd-stepper__num sd-mono" aria-live="polite">${fmtNum(value)}</span><span class="sd-stepper__unit">${f.unit}</span></button>`;
  return `<div class="sd-stepper${f.cls}${solo ? " sd-stepper--solo" : ""}" role="group" aria-label="${esc(group)}">
<button type="button" class="sd-stepper__btn" data-action="step" data-field="${field}" data-dir="-1" aria-label="${f.dec}"${value <= 0 ? " disabled" : ""}>−</button>
${mid}
<button type="button" class="sd-stepper__btn" data-action="step" data-field="${field}" data-dir="1" aria-label="${f.inc}">+</button>
</div>`;
}

function steppersHTML(vm, set) {
  if (vm.mode === "time") return stepperHTML("sec", set.reps ?? 0, vm, true);
  if (vm.mode === "reps") return stepperHTML("reps", set.reps ?? 0, vm, true);
  return stepperHTML("kg", set.kg ?? 0, vm, false) + stepperHTML("reps", set.reps ?? 0, vm, false);
}

// ---------- Sätze (11.4) ----------

function setValueText(vm, set) {
  if (vm.mode === "time") return `${fmtNum(set.reps ?? 0)} s`;
  if (vm.mode === "reps") return `${fmtNum(set.reps ?? 0)} Wdh`;
  return `${fmtNum(set.kg ?? 0)} kg × ${fmtNum(set.reps ?? 0)}`;
}

function activeSetHTML(vm, i) {
  const set = vm.sets[i];
  let action = "";
  if (vm.editing) action = '<button type="button" class="sd-btn sd-btn--text" data-action="commit-value">Fertig</button>';
  else if (vm.mode === "reps") action = '<button type="button" class="sd-btn sd-btn--text" data-action="add-weight">+ Gewicht</button>';
  return `<div class="sd-set sd-set--active" role="group" aria-label="Satz ${i + 1}">
<div class="sd-set__head"><span class="sd-set__title">Satz ${i + 1}</span>${action}</div>
<div class="sd-steppers">${steppersHTML(vm, set)}</div>
</div>`;
}

function setRowHTML(vm, i) {
  const set = vm.sets[i];
  if (i === vm.activeIndex) return activeSetHTML(vm, i);
  const value = setValueText(vm, set);
  if (set.done) {
    return `<button type="button" class="sd-set is-done" data-action="reopen-set" data-set="${i}" aria-label="Satz ${i + 1} wieder öffnen, bisher ${esc(value)}">
<span class="sd-set__label">Satz ${i + 1}</span><span class="sd-set__value sd-mono">${esc(value)}</span>${checkCircle("kraft", 22)}
</button>`;
  }
  return `<div class="sd-set is-open"><span class="sd-set__label">Satz ${i + 1}</span><span class="sd-set__value sd-mono">${esc(value)}</span><span class="sd-vh">offen</span></div>`;
}

// ---------- Jetzt-Karte (11.3, 11.5) ----------

function primaryHTML(vm) {
  if (vm.saving) {
    return '<button type="button" class="sd-btn sd-btn--primary sd-btn--lg" data-action="finish-set" disabled aria-busy="true">Speichert …</button>';
  }
  if (vm.activeIndex != null) {
    return `<button type="button" class="sd-btn sd-btn--primary sd-btn--lg" data-action="finish-set">Satz ${vm.activeIndex + 1} fertig</button>`;
  }
  if (vm.nextSlug) {
    return `<button type="button" class="sd-btn sd-btn--primary sd-btn--lg" data-action="next-exercise" data-slug="${esc(vm.nextSlug)}">Weiter: ${esc(vm.nextName)}</button>`;
  }
  return '<button type="button" class="sd-btn sd-btn--primary sd-btn--lg" data-action="finish-session">Training abschließen</button>';
}

function earlyHTML(vm) {
  const n = vm.sets.filter((s) => s.done).length;
  if (vm.saving || vm.activeIndex == null || n < 1 || n >= vm.sets.length) return "";
  return `<button type="button" class="sd-btn sd-btn--text sd-btn--block" data-action="finish-early">Mit ${n} ${n === 1 ? "Satz" : "Sätzen"} abschließen</button>`;
}

function nowCardHTML(vm) {
  const finished = vm.saved && vm.activeIndex == null;
  const last = vm.lastText ? `<span class="sd-last sd-mono">Letztes Mal ${esc(vm.lastText)}</span>` : "";
  const chip = vm.chip
    ? `<p class="sd-tip${TIP_LEVELS.includes(vm.chip.level) ? ` sd-tip--${vm.chip.level}` : ""}">${esc(vm.chip.text)}</p>`
    : "";
  const soll = `<b>${esc(vm.soll)}</b>${vm.hint ? ` · ${esc(vm.hint)}` : ""}`;
  const error = vm.saveError
    ? `<p class="sd-notice sd-notice--danger" role="alert" data-slot="save-error">Nicht gespeichert: ${esc(vm.saveError)}. Der Satz bleibt offen, versuch es noch einmal.</p>`
    : "";
  return `<article class="sd-card sd-now" data-card="now" data-slug="${esc(vm.slug)}" data-mode="${vm.mode}" aria-labelledby="nowTitle">
<div class="sd-card__top">
<p class="sd-eyebrow sd-eyebrow--teal"><span class="sd-eyebrow__dot"></span>${finished ? "Erledigt" : "Jetzt"}</p>
${last}
</div>
<div>
<h2 class="sd-now__name" id="nowTitle">${esc(vm.name)}</h2>
<p class="sd-now__soll">${soll}</p>
</div>
${chip}
<div class="sd-sets">${vm.sets.map((_, i) => setRowHTML(vm, i)).join("")}</div>
${error}
${primaryHTML(vm)}
${earlyHTML(vm)}
</article>`;
}

// ---------- Reihenfolge (11.6) ----------

function orderRowHTML(vm, focusSlug) {
  const current = vm.slug === focusSlug;
  const cls = `${current ? " is-current" : ""}${vm.saved ? " is-done" : ""}`;
  const icon = vm.saved ? checkCircle("kraft", 22) : current ? ringRunning(22) : ringOpen(22);
  const prefix = vm.custom ? "eigene · " : "";
  let sub;
  let hidden = "";
  if (vm.saved) {
    sub = summaryText(vm.savedSets, vm.mode);
    hidden = '<span class="sd-vh">erledigt</span>';
  } else if (current) {
    sub = `läuft · Satz ${vm.activeIndex != null ? vm.activeIndex + 1 : vm.sets.length} von ${vm.sets.length}`;
  } else {
    sub = sollText(vm.soll);
    hidden = '<span class="sd-vh">offen</span>';
  }
  return `<button type="button" class="sd-order__row${cls}" data-action="focus-exercise" data-slug="${esc(vm.slug)}"${current ? ' aria-current="true"' : ""}>
<span class="sd-order__pos sd-mono">${vm.pos}</span>${icon}
<span class="sd-order__main"><span class="sd-order__name">${esc(vm.name)}</span><span class="sd-order__sub sd-mono">${esc(prefix + sub)}</span>${hidden}</span>
</button>`;
}

function orderHTML(exercises, focusSlug) {
  const rows = exercises.map((vm, i) => orderRowHTML({ ...vm, pos: i + 1 }, focusSlug)).join("\n");
  return `<div class="sd-label-row"><p class="sd-label" id="orderLabel">Reihenfolge</p><p class="sd-hint">Antippen, um sie als Nächstes zu machen</p></div>
<div class="sd-card sd-card--list sd-order" data-card="order" role="group" aria-labelledby="orderLabel">
${rows}
</div>`;
}

// ---------- Hinweiskarten (11.7 bis 11.9) ----------

function allDoneHTML(total) {
  const title = total === 1 ? "Die Übung ist erfasst" : `Alle ${total} Übungen erfasst`;
  return `<div class="sd-card sd-card--done" data-card="all-done">${checkCircle("kraft", 22)}
<div><p class="sd-card__title">${title}</p><p class="sd-card__text">Zum Korrigieren eine Übung antippen.</p></div>
</div>`;
}

function loadErrorHTML(message) {
  return `<div class="sd-card sd-card--danger" role="alert" data-card="load-error" data-source="firebase">
<p class="sd-card__title sd-card__title--danger">Gespeicherte Sätze nicht geladen</p>
<p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
<p class="sd-card__text sd-card__text--danger">Eintragen geht trotzdem. Gespeichert wird erst, wenn das behoben ist.</p>
<div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button></div>
</div>`;
}

/**
 * Strava-Zeile der Einheit (F7). Leerer String, wenn weder Dauer noch Herzfrequenz da sind.
 * @param {{movingTimeSec?:number, avgHr?:number|null, maxHr?:number|null, effort?:number|null}|null} session
 */
export function stravaSessionHTML(session) {
  if (!session) return "";
  const parts = [];
  if (session.movingTimeSec > 0) parts.push(`${Math.round(session.movingTimeSec / 60)} min`);
  if (session.avgHr) parts.push(`Ø ${session.avgHr} bpm`);
  if (session.maxHr) parts.push(`max ${session.maxHr} bpm`);
  if (!parts.length) return "";
  if (session.effort != null) parts.push(`Relative Effort ${session.effort}`);
  return `<div class="sd-card sd-card--pad-sm" data-card="strava-session">
<dl class="sd-kv"><dt>Einheit laut Strava</dt><dd class="sd-mono">${esc(parts.join(" · "))}</dd></dl>
</div>`;
}

/** Ladezustand der Seite (ersetzt die Lade-Karte). */
export function loadingMainHTML() {
  return `<div class="sd-main sd-main--tight">
<article class="sd-card sd-now" data-card="now" aria-busy="true" role="status">
<div class="sd-skelstack sd-skelstack--fill">
<span class="sd-skel sd-skel--w40"></span><span class="sd-skel sd-skel--name"></span>
<span class="sd-skel sd-skel--set"></span><span class="sd-skel sd-skel--set"></span>
<span class="sd-skel sd-skel--btn"></span>
<span class="sd-vh">Gespeicherte Sätze werden geladen</span>
</div>
</article>
</div>`;
}

/**
 * Inhalt von #main (nach dem Seitenkopf) in der Normalansicht.
 * @param {{exercises: object[], focusSlug: string|null, loadError: string|null, sessionHTML: string}} model
 */
export function mainHTML({ exercises, focusSlug, loadError, sessionHTML }) {
  const banner = `<div id="banner-slot">${loadError ? loadErrorHTML(loadError) : ""}</div>`;
  if (!exercises.length) {
    return `<div class="sd-main sd-main--tight">${banner}
<div class="sd-card sd-card--center" data-card="no-exercises">
<h2 class="sd-card__title">Keine Übungen für heute</h2>
<p class="sd-card__text">Im Anpassen-Modus lassen sich Übungen zurückholen oder hinzufügen.</p>
<div class="sd-actions"><button type="button" class="sd-btn sd-btn--md" data-action="toggle-edit">Anpassen</button></div>
</div>
</div>`;
  }
  const current = exercises.find((e) => e.slug === focusSlug) ?? exercises[0];
  const allDone = exercises.every((e) => e.saved);
  return `<div class="sd-main sd-main--tight">
${banner}
<div id="now-slot">${allDone ? allDoneHTML(exercises.length) : ""}${nowCardHTML(current)}</div>
<div id="order-slot">${orderHTML(exercises, current.slug)}</div>
<div id="session-slot">${sessionHTML || ""}</div>
<button type="button" class="sd-btn sd-btn--text sd-btn--block" data-action="toggle-edit">Anpassen</button>
</div>`;
}

// ---------- Anpassen-Modus (11.10) ----------

function replaceFormHTML(row, form) {
  const error = form.error
    ? `<p class="sd-notice sd-notice--danger" role="alert" data-slot="form-error">${esc(form.error)}</p>`
    : "";
  return `<form class="sd-edit__form" data-form="replace">
<p class="sd-hint">Ersetzt ${esc(row.name)} an dieser Stelle.</p>
<label class="sd-field"><span class="sd-field__label">Neue Übung</span><input class="sd-input" type="text" id="rep-ex-name" name="name" value="${esc(form.name)}" autocomplete="off"></label>
<label class="sd-field"><span class="sd-field__label">Soll</span><input class="sd-input" type="text" id="rep-ex-soll" name="soll" value="${esc(form.soll)}" autocomplete="off"></label>
${error}
<div class="sd-actions">
<button type="submit" class="sd-btn sd-btn--primary sd-btn--grow" data-action="confirm-replace" data-slug="${esc(row.slug)}">Übernehmen</button>
<button type="button" class="sd-btn sd-btn--text" data-action="cancel-replace">Abbrechen</button>
</div>
</form>`;
}

function addFormHTML(form, dateText) {
  const error = form.error
    ? `<p class="sd-notice sd-notice--danger" role="alert" data-slot="form-error">${esc(form.error)}</p>`
    : "";
  return `<form class="sd-card" data-form="add-exercise">
<div><h2 class="sd-card__title">Übung hinzufügen</h2><p class="sd-hint">Gilt nur für diesen Tag (${esc(dateText)}).</p></div>
<label class="sd-field"><span class="sd-field__label">Name</span><input class="sd-input" type="text" id="new-ex-name" name="name" value="${esc(form.name)}" placeholder="z. B. Beinpresse" autocomplete="off"></label>
<label class="sd-field"><span class="sd-field__label">Soll</span><input class="sd-input" type="text" id="new-ex-soll" name="soll" value="${esc(form.soll)}" placeholder="z. B. 3x8-10" autocomplete="off"></label>
${error}
<div class="sd-actions">
<button type="submit" class="sd-btn sd-btn--primary sd-btn--grow" data-action="add-exercise">Hinzufügen</button>
<button type="button" class="sd-btn sd-btn--text" data-action="cancel-add">Abbrechen</button>
</div>
</form>`;
}

function editRowHTML(row, form) {
  const replacing = form?.kind === "replace" && form.slug === row.slug;
  if (row.removed) {
    return `<div class="sd-edit__row is-removed" data-slug="${esc(row.slug)}">
<div class="sd-edit__lead">${ringOpen(22)}<div class="sd-edit__main"><p class="sd-edit__name">${esc(row.name)}</p><p class="sd-edit__sub">Für heute entfernt</p></div></div>
<div class="sd-edit__actions"><button type="button" class="sd-btn" data-action="restore-exercise" data-slug="${esc(row.slug)}" aria-label="Zurückholen: ${esc(row.name)}">Zurückholen</button></div>
</div>`;
  }
  const icon = row.saved ? checkCircle("kraft", 22) : ringOpen(22);
  const sub = row.saved ? summaryText(row.savedSets, row.mode) : sollText(row.soll);
  const tag = row.custom ? pill("purple", "eigene") : "";
  const actions = replacing
    ? replaceFormHTML(row, form)
    : `<div class="sd-edit__actions">
<button type="button" class="sd-btn" data-action="replace-exercise" data-slug="${esc(row.slug)}" aria-label="Ersetzen: ${esc(row.name)}">Ersetzen</button>
<button type="button" class="sd-btn sd-btn--danger" data-action="remove-exercise" data-slug="${esc(row.slug)}" aria-label="Entfernen: ${esc(row.name)}">Entfernen</button>
</div>`;
  return `<div class="sd-edit__row" data-slug="${esc(row.slug)}"${replacing ? ` data-replace="${esc(row.slug)}"` : ""}>
<div class="sd-edit__lead">${icon}<div class="sd-edit__main"><p class="sd-edit__name">${esc(row.name)}${tag}</p><p class="sd-edit__sub sd-mono">${esc(sub)}</p></div></div>
${actions}
</div>`;
}

/**
 * Inhalt von #main im Anpassen-Modus.
 * @param {{rows: object[], form: {kind:string, slug?:string, name:string, soll:string, error:string|null}|null, dateText: string}} model
 *   rows: { slug, name, soll, custom, saved, savedSets, mode, removed }
 */
export function editMainHTML({ rows, form, dateText }) {
  const adding = form?.kind === "add";
  return `<div class="sd-main">
<div class="sd-card sd-card--list" data-card="edit-list">
${rows.map((r) => editRowHTML(r, form)).join("\n")}
</div>
${adding ? addFormHTML(form, dateText) : '<button type="button" class="sd-btn sd-btn--dashed" data-action="quick-add">+ Übung hinzufügen</button>'}
</div>`;
}
