// Markup für Anmelden, "Kein Zugriff", Hinweis auf offene Einträge und den Abschnitt
// "Daten und Konto" im Plan-Tab. Reine String-Funktionen (wie view-dashboard.js); alles
// aus Nutzer- oder Firebase-Daten läuft durch esc(). Die Klassen stehen in style.css
// (Abschnitte "Anmeldung" und "Verlauf + Plan (E7)").
import { esc, markSVG } from "./ui.js?v=202610221024";

// Anmeldeformular. Ein echtes <form> mit autocomplete username und
// current-password, damit der iCloud-Schlüsselbund ausfüllt und speichert.
// Die Felder haben mindestens 16px (iOS zoomt sonst beim Antippen).
export function renderLogin({ email = "", error = "", notice = "" } = {}) {
  return `<form class="card auth-card" data-form="login" novalidate>
    <div class="auth-brand">
      ${markSVG(64)}
      <span class="auth-brand-name">Stride</span>
    </div>
    <p class="name">Anmelden</p>
    <p class="hint">Diese App ist privat. Anmelden geht nur mit dem Konto des Besitzers.</p>
    ${notice ? `<p class="hint" role="status" data-notice>${esc(notice)}</p>` : ""}
    <label class="field">
      <span class="field-label">E-Mail</span>
      <input class="text-input" type="email" name="email" autocomplete="username" inputmode="email"
        autocapitalize="none" autocorrect="off" spellcheck="false" required value="${esc(email)}" />
    </label>
    <label class="field">
      <span class="field-label">Passwort</span>
      <input class="text-input" type="password" name="password" autocomplete="current-password" required />
    </label>
    <p class="auth-error" role="alert" ${error ? "" : "hidden"}>${esc(error)}</p>
    <button type="submit" class="primary-btn auth-submit">Anmelden</button>
  </form>`;
}

// Fremdes Konto: kein Zugriff, nur Abmelden. Die UID wird angezeigt, damit
// ein Tippfehler in der erlaubten UID auffällt.
export function renderNoAccess({ email, uid }) {
  return `<div class="card auth-card">
    <p class="name">Kein Zugriff</p>
    <p class="hint">Dieses Konto ist für die App nicht freigegeben.</p>
    ${accountRows({ email, uid })}
    <button type="button" class="primary-btn auth-submit" data-action="forbidden-logout">Abmelden</button>
  </div>`;
}

// Anonyme Altsitzung mit noch nicht übertragenen Einträgen: nicht abmelden.
export function renderPendingWrites() {
  return `<div class="card auth-card">
    <p class="name">Noch nicht übertragene Einträge</p>
    <p class="hint">Es gibt noch nicht übertragene Einträge. Bitte mit Netz erneut öffnen.</p>
    <button type="button" class="primary-btn auth-submit" data-action="retry-pending">Erneut versuchen</button>
  </div>`;
}

function accountRows({ email, uid }) {
  return `<dl class="account-rows">
    <div class="account-row"><dt>E-Mail</dt><dd>${esc(email || "unbekannt")}</dd></div>
    <div class="account-row"><dt>UID</dt><dd class="account-uid">${esc(uid)}</dd></div>
  </dl>`;
}

// ---------- Daten und Konto im Plan-Tab (Stride E7, Markup 14.5) ----------

const two = (n) => String(n).padStart(2, "0");

/** "Sync heute 07:12" bzw. "Sync 20.10. 07:12"; ohne Zeitpunkt leer. Ortszeit des Geräts. */
export function syncText(fetchedAt, now) {
  if (typeof fetchedAt !== "number") return "";
  const at = new Date(fetchedAt);
  const ref = new Date(now);
  const time = `${two(at.getHours())}:${two(at.getMinutes())}`;
  const sameDay = at.getFullYear() === ref.getFullYear() && at.getMonth() === ref.getMonth() && at.getDate() === ref.getDate();
  return sameDay ? `Sync heute ${time}` : `Sync ${two(at.getDate())}.${two(at.getMonth() + 1)}. ${time}`;
}

const connectButton = (cls = "sd-btn sd-btn--coral", label = "Strava verbinden") =>
  `<button type="button" class="${cls}" data-action="connect-strava">${label}</button>`;

/**
 * Strava-Zeile plus Aktion darunter. s: { workerConfigured, connected, error, fetchedAt, now }.
 * Rückgabe { dd, ddClass, below }.
 */
export function stravaStatus(s) {
  if (!s.workerConfigured) return { dd: "nicht eingerichtet", ddClass: "", below: "" };
  if (s.error) {
    return {
      dd: "Abruf fehlgeschlagen",
      ddClass: ' class="is-danger"',
      below: `<p class="sd-notice sd-notice--danger" role="alert">${esc(s.error)}</p>
  <div class="sd-actions"><button type="button" class="sd-btn" data-action="reload-strava">Nochmal versuchen</button>${connectButton(undefined, "Neu verbinden")}</div>`,
    };
  }
  if (s.connected === null) return { dd: "wird geprüft …", ddClass: "", below: "" };
  if (s.connected === false) return { dd: "nicht verbunden", ddClass: "", below: `<div>${connectButton()}</div>` };
  const sync = syncText(s.fetchedAt, s.now);
  return { dd: sync ? `verbunden · ${sync}` : "verbunden", ddClass: "", below: "" };
}

/**
 * Abschnitt "Daten und Konto": Export, Angemeldet-als, Strava, Plan-Quelle, Abmelden.
 * vm: { email, strava (siehe stravaStatus), planVersion }. Die Plan-Zeile ist reine Anzeige,
 * ein Knopf kommt erst mit Login 1b Teil B (F1). Die UID steht nur auf "Kein Zugriff".
 */
export function renderAccountSection({ email, strava, planVersion = null }) {
  const st = stravaStatus(strava);
  const plan = planVersion ? `Plandatei · Version ${esc(planVersion)}` : "Plandatei";
  return `<h2 class="sd-label" id="accountTitle">Daten und Konto</h2>
<section class="sd-card sd-card--loose" data-card="account" aria-labelledby="accountTitle">
  <div class="sd-split">
    <div class="sd-split__main">
      <p class="sd-split__title">Daten exportieren</p>
      <p class="sd-split__hint">Alle Trainingsdaten als JSON-Datei, ohne Zugangs- und Standortdaten.</p>
      <p class="sd-split__hint sd-split__status" id="export-status" role="status" hidden></p>
    </div>
    <button type="button" class="sd-btn" data-action="export-data">Export</button>
  </div>
  <hr class="sd-rule" />
  <dl class="sd-kvlist">
    <div class="sd-kv"><dt>Angemeldet als</dt><dd>${esc(email || "unbekannt")}</dd></div>
    <div class="sd-kv" data-slot="strava-status"><dt>Strava</dt><dd${st.ddClass}>${esc(st.dd)}</dd></div>
    <div class="sd-kv" data-slot="plan-source"><dt>Plan</dt><dd>${plan}</dd></div>
  </dl>
  ${st.below ? `${st.below}\n  ` : ""}<hr class="sd-rule" />
  <p class="sd-hint">Abmelden räumt dieses Gerät: lokale Kopien und der Offline-Speicher werden gelöscht. Nicht übertragene Einträge werden vorher gesendet.</p>
  <p class="sd-notice sd-notice--quiet" id="account-status" role="status" hidden></p>
  <div><button type="button" class="sd-btn sd-btn--danger" data-action="logout">Abmelden</button></div>
</section>`;
}
