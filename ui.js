// Geteilte Render-Helfer über alle Tabs hinweg (M2-4): Escaping, Icons,
// Datumsformatierung, Toast, Fehler-/Lade-Karten, Skeleton-Zeilen und das
// eine gemeinsame Info-Sheet (D1). Bewusst ohne Firebase-Abhängigkeiten,
// nur plan.js für die reinen Datums-Helfer.
import { fromISO } from "./plan.js?v=202609281043";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Unverändert aus app.js übernommen (M1-Icons) + neu für M2 (ui-markup #0).
// Jedes neue Icon trägt stroke-linecap:round, damit kein weiteres D5
// entsteht (unsichtbare Null-Längen-Striche).
export const ICONS = {
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none"/><path d="M13 7l-2 3 3 2 1 5M11 10l-4 1-2 4M8 14l-3 1M13.5 11l3 1 2-2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
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

const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

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
    <button data-action="reload" style="margin-top:8px;">Neu laden</button></div>`;
}
export function loadingCard(msg = "Lädt …") {
  return `<p class="center-note">${esc(msg)}</p>`;
}
export function skelLine(width, height) {
  return `<div class="skel skel-line" style="width:${width};${height ? `height:${height};` : ""}"></div>`;
}

// ---------- Info-Sheet (D1) ----------
// Ein gemeinsames Element in index.html (#infoSheet/#infoBackdrop), wird
// hier nur geöffnet/geschlossen, nicht pro Ampel neu erzeugt.
let infoReturnFocus = null;

export function openInfo(title, bodyParagraphs, triggerEl) {
  const sheet = document.getElementById("infoSheet");
  const backdrop = document.getElementById("infoBackdrop");
  if (!sheet || !backdrop) return;
  infoReturnFocus = triggerEl || null;
  document.getElementById("infoSheetTitle").textContent = title;
  document.getElementById("infoSheetBody").innerHTML = bodyParagraphs.map((p) => `<p>${esc(p)}</p>`).join("");
  sheet.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add("open");
    sheet.classList.add("open");
  });
  document.getElementById("infoSheetClose")?.focus();
}

export function closeInfo() {
  const sheet = document.getElementById("infoSheet");
  const backdrop = document.getElementById("infoBackdrop");
  if (!sheet || sheet.hidden) return;
  backdrop.classList.remove("open");
  sheet.classList.remove("open");
  setTimeout(() => {
    sheet.hidden = true;
  }, 200);
  if (infoReturnFocus) infoReturnFocus.focus();
}
