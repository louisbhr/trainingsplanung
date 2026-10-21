// Markup für Anmelden, "Kein Zugriff", Hinweis auf offene Einträge und die
// Konto-Karte. Reine String-Funktionen (wie view-dashboard.js); alles aus
// Nutzer- oder Firebase-Daten läuft durch esc(). Die Klassen stehen in
// style.css (Abschnitt "Anmeldung").
import { esc, markSVG } from "./ui.js?v=202610211239";

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

// Konto-Karte am Ende des Plan-Tabs. status: kurzer Hinweistext unter dem
// Knopf (z. B. wenn das Abmelden wegen offener Einträge abgebrochen wurde).
export function renderAccountCard({ email, uid, status = "" }) {
  return `<div class="card account-card">
    <p class="name">Konto</p>
    ${accountRows({ email, uid })}
    <p class="hint">Abmelden räumt dieses Gerät: lokale Kopien und der Offline-Speicher werden gelöscht. Nicht übertragene Einträge werden vorher gesendet.</p>
    <p class="auth-error" role="status" id="account-status" ${status ? "" : "hidden"}>${esc(status)}</p>
    <button type="button" class="small-btn danger-btn account-logout" data-action="logout">Abmelden</button>
  </div>`;
}

// Karte "Daten" im Plan-Tab (über der Konto-Karte): Export aller
// Trainingsdaten als JSON-Datei. Der Fortschritt steht im Status-Absatz.
export function renderExportCard() {
  return `<div class="card export-card">
    <p class="name">Daten</p>
    <p class="hint">Alle Trainingsdaten (Strava, Kraft-Logs, Plan) als eine JSON-Datei herausgeben. Es sind keine Zugangsdaten und keine Standortdaten enthalten.</p>
    <p class="hint" role="status" id="export-status" hidden></p>
    <button type="button" class="small-btn export-btn" data-action="export-data">Daten exportieren</button>
  </div>`;
}
