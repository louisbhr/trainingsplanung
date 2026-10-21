// Geteilte Render-Helfer über alle Tabs hinweg (M2-4): Escaping, Icons,
// Datumsformatierung, Toast, Fehler-/Lade-Karten und die Sheet-Fabrik
// (createSheet, Auflage C6). Bewusst ohne Firebase-Abhängigkeiten,
// nur plan.js für die reinen Datums-Helfer.
import { fromISO } from "./plan.js?v=202610211227";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Unverändert aus app.js übernommen (M1-Icons) + neu für M2 (ui-markup #0).
// Jedes neue Icon trägt stroke-linecap:round, damit kein weiteres D5
// entsteht (unsichtbare Null-Längen-Striche).
export const ICONS = {
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none"/><path d="M13 7l-2 3 3 2 1 5M11 10l-4 1-2 4M8 14l-3 1M13.5 11l3 1 2-2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  chat: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16v11H9l-4 4V5z"/><path d="M8 9h8M8 12.5h5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3.5 2.5 20.5h19L12 3.5z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="17.1" r="1.2" fill="currentColor" stroke="none"/></svg>',
  missed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3.2 3.2"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function badge(text, color, bg) {
  return `<span class="badge" style="background:${bg};color:${color}">${esc(text)}</span>`;
}

// ---- Stride-Bausteine (docs/ui-markup-stride.md, Abschnitte 3.1, 3.3, 3.4) ----
const CHECK_PATH = "M5 12.5l4.5 4.5L19 7.5";
const CHECK_KINDS = { kraft: "", lauf: " sd-check--lauf", long: " sd-check--long" };
const SIZE_CLASS = { 20: " sd-check--20", 22: " sd-check--22" };

// Flaches Zeichen; hell/dunkel über <picture>, nie die Glas-Optik. Größen: 28 (Kopf), 64 (Login).
export function markSVG(size = 28) {
  const lg = size >= 64 ? " sd-mark--lg" : "";
  return `<picture><source srcset="stride-mark-dark.svg" media="(prefers-color-scheme: dark)">` +
    `<img class="sd-mark${lg}" src="stride-mark.svg" alt="" width="${size}" height="${size}"></picture>`;
}

// Kopfzeile der Tab-Seiten: Zeichen + Wortmarke. Bewusst ohne .sd-head als direktes Kind
// von #header: das würde per :has() das Seitenpolster der noch alten Kopfinhalte nullen.
export function brandHeadHTML() {
  return `<div class="sd-brand">${markSVG(28)}<span>Stride</span></div>`;
}

// Gefüllter Haken-Kreis; kind: "kraft" | "lauf" | "long", size: 20 | 22 | 24.
export function checkCircle(kind = "kraft", size = 24) {
  return `<span class="sd-check${SIZE_CLASS[size] ?? ""}${CHECK_KINDS[kind] ?? ""}">` +
    `<svg viewBox="0 0 24 24"><path d="${CHECK_PATH}"/></svg></span>`;
}

// Offener (gestrichelter) Ring.
export function ringOpen(size = 24) {
  return `<span class="sd-ring${size === 22 ? " sd-ring--22" : size === 20 ? " sd-ring--20" : ""}"></span>`;
}

// Laufender Ring mit Punkt.
export function ringRunning(size = 24) {
  return `<span class="sd-ring${size === 22 ? " sd-ring--22" : size === 20 ? " sd-ring--20" : ""} sd-ring--run"></span>`;
}

const PILL_TONES = ["primary", "ok", "amber", "danger", "optional", "purple"];
// Pill; tone "" = neutral, "ok-check" = grün mit Haken. Text immer durch esc().
export function pill(tone, text) {
  if (tone === "ok-check") {
    return `<span class="sd-pill sd-pill--ok"><svg viewBox="0 0 24 24"><path d="${CHECK_PATH}"/></svg>${esc(text)}</span>`;
  }
  const mod = PILL_TONES.includes(tone) ? ` sd-pill--${tone}` : "";
  return `<span class="sd-pill${mod}">${esc(text)}</span>`;
}

const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Zahl für ein HTML-Attribut (<progress value/max>): Punkt als Dezimaltrenner,
// nie negativ, höchstens eine Nachkommastelle. Nie formatKm1() (Komma).
export const numAttr = (x) => (Number.isFinite(x) ? String(Math.round(Math.max(0, x) * 10) / 10) : "0");

export const dayNameDE = (iso) => WEEKDAYS_SHORT[fromISO(iso).getDay()];
export const dayLongDE = (iso) => WEEKDAYS_LONG[fromISO(iso).getDay()];
export const shortDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
// Kopfzeile Dashboard (F2): "Montag, 7. September"
export function longDateDE(iso) {
  const day = Number(iso.slice(8, 10));
  return `${dayLongDE(iso)}, ${day}. ${MONTHS_DE[Number(iso.slice(5, 7)) - 1]}`;
}

export function toast(msg, isError = false) {
  let box = document.getElementById("toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    document.getElementById("app").appendChild(box);
  }
  box.textContent = msg;
  box.className = isError ? "show error" : "show";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (box.className = ""), isError ? 6000 : 3000);
}

export function errorCard(msg) {
  return `<div class="card error-card"><p class="name">Problem</p><p class="hint">${esc(msg)}</p>
    <button data-action="reload" class="mt-8">Neu laden</button></div>`;
}
export function loadingCard(msg = "Lädt …") {
  return `<p class="center-note">${esc(msg)}</p>`;
}

// ---------- Sheets (Auflage C6) ----------
// Eine Fabrik für alle Bottom-Sheets (Info-Sheet, später Zuordnungs-Sheet).
// Jedes Sheet hat seinen eigenen Ausblende-Timer und sein eigenes Rücksprung-
// Ziel. Wird ein Sheet geöffnet, schließt jedes andere sofort und ohne
// Animation, ohne dass der Fokus zu dessen Auslöser zurückspringt. Escape ist
// ein einziger globaler Handler. Gemessen wird immer an der .open-Klasse, nie
// an hidden: hidden hinkt dem Schließen um die Ausblendzeit hinterher.
const SHEET_FADE_MS = 260; // etwas über der CSS-Übergangszeit (250 ms)
const sheetRegistry = new Map(); // sheetId -> Steuerobjekt
let escapeWired = false;

// Der Auslöser kann zwischenzeitlich neu gerendert worden sein (Slots laden
// nach, während das Sheet offen ist). Dann denselben Knopf per Attributen suchen.
const TRIGGER_ATTRS = ["data-action", "data-info", "data-date"];
function liveTrigger(el) {
  if (!el) return null;
  if (el.isConnected) return el;
  const selector = TRIGGER_ATTRS
    .filter((a) => el.hasAttribute?.(a))
    .map((a) => `[${a}="${CSS.escape(el.getAttribute(a))}"]`)
    .join("");
  return selector ? document.querySelector(selector) : null;
}

function wireEscapeOnce() {
  if (escapeWired || typeof document === "undefined") return;
  escapeWired = true;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOpenSheet();
  });
}

export function createSheet(sheetId, backdropId) {
  wireEscapeOnce();
  let hideTimer = null;
  let returnFocus = null;
  const sheetEl = () => document.getElementById(sheetId);
  const backdropEl = () => document.getElementById(backdropId);

  function hideNow() {
    clearTimeout(hideTimer);
    hideTimer = null;
    const sheet = sheetEl(), backdrop = backdropEl();
    if (sheet) { sheet.classList.remove("open"); sheet.hidden = true; }
    if (backdrop) { backdrop.classList.remove("open"); backdrop.hidden = true; }
  }

  const controller = {
    id: sheetId,
    isOpen() { return !!sheetEl()?.classList.contains("open"); },
    // Sofort, ohne Animation und ohne Fokus-Rückgabe (Wechsel zu einem anderen Sheet).
    closeImmediately() { returnFocus = null; hideNow(); },
    open(trigger) {
      const sheet = sheetEl(), backdrop = backdropEl();
      if (!sheet || !backdrop) return;
      for (const other of sheetRegistry.values()) if (other !== controller) other.closeImmediately();
      clearTimeout(hideTimer);
      hideTimer = null;
      returnFocus = trigger || null;
      sheet.hidden = false;
      backdrop.hidden = false;
      // Reflow erzwingen statt requestAnimationFrame: so ist das Sheet sofort
      // "offen" und ein schnelles Escape findet keinen Zwischenzustand vor.
      void sheet.offsetWidth;
      backdrop.classList.add("open");
      sheet.classList.add("open");
      sheet.querySelector(".sd-sheet__title")?.focus();
    },
    close() {
      const sheet = sheetEl(), backdrop = backdropEl();
      if (!sheet || !controller.isOpen()) return;
      backdrop?.classList.remove("open");
      sheet.classList.remove("open");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideNow, SHEET_FADE_MS);
      const target = liveTrigger(returnFocus);
      returnFocus = null;
      target?.focus();
    },
  };
  sheetRegistry.set(sheetId, controller);
  return controller;
}

// Schließt das gerade offene Sheet (Escape, ×-Knopf, Backdrop).
export function closeOpenSheet() {
  for (const sheet of sheetRegistry.values()) if (sheet.isOpen()) sheet.close();
}

// Info-Sheet: Titel plus Blöcke { heading, text }. Alles durch esc().
export function openInfo(title, blocks, triggerEl) {
  const sheet = sheetRegistry.get("infoSheet") ?? createSheet("infoSheet", "infoBackdrop");
  document.getElementById("infoSheetTitle").textContent = title;
  document.getElementById("infoSheetBody").innerHTML =
    `<div class="sd-sheet__blocks">${blocks.map((b) =>
      `<div><p class="sd-sheet__blockhead">${esc(b.heading)}</p><p class="sd-sheet__blocktext">${esc(b.text)}</p></div>`).join("")}</div>`;
  sheet.open(triggerEl);
}
