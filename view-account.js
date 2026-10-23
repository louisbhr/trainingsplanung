// Markup für Anmelden, "Kein Zugriff", Hinweis auf offene Einträge und den Abschnitt
// "Daten und Konto" im Plan-Tab. Reine String-Funktionen (wie view-dashboard.js); alles
// aus Nutzer- oder Firebase-Daten läuft durch esc(). Die Klassen stehen in style.css
// (Abschnitte "Anmeldung" und "Verlauf + Plan (E7)").
import { esc, markSVG } from "./ui.js?v=202610231554";

const TAGLINE = "Trainingsplan, Strava-Läufe und Krafteinheiten an einem Ort.";

/**
 * Markenblock über der Karte (Markup 15.0): Zeichen und Name liegen auf --bg, nie in der
 * Karte (das dunkle Zeichen hat eine Kachel in Kartenfarbe). Name ist ein <p>, kein h1.
 */
export function authBrandHTML(tagline = "") {
  return `<div class="sd-auth__brand">
    ${markSVG(64)}
    <p class="sd-auth__name">Stride</p>${tagline ? `
    <p class="sd-auth__tag">${esc(tagline)}</p>` : ""}
  </div>`;
}

/** Warte-Zustand ohne Karte (Markup 15.4): Marke plus Statuszeile. */
export function renderGateWait(text) {
  return `<div class="sd-auth" data-card="auth-wait">
  <h1 class="sd-vh">Stride</h1>
  <div class="sd-auth__brand">
    ${markSVG(64)}
    <p class="sd-auth__name">Stride</p>
    <p class="sd-auth__tag" role="status">${esc(text)}</p>
  </div>
</div>`;
}

/** Fehler beim Prüfen der Anmeldung (Markup 15.5). */
export function renderGateError(message) {
  return `<div class="sd-auth">
  ${authBrandHTML()}
  <section class="sd-card sd-card--danger" data-card="gate-error" role="alert" aria-labelledby="gateErrorTitle">
    <div>
      <h1 class="sd-card__title sd-card__title--danger" id="gateErrorTitle">Problem</h1>
      <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
    </div>
    <button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button>
  </section>
</div>`;
}

// Eingabefeld mit label[for]. invalid: Ring plus aria-invalid; describe: hängt am allgemeinen Fehler.
function loginField({ id, label, invalid, describe, inputAttrs }) {
  const aria = (invalid ? ' aria-invalid="true"' : "") + (describe ? ' aria-describedby="login-error"' : "");
  return `<div class="sd-field${invalid ? " is-invalid" : ""}">
      <label class="sd-field__label" for="${id}">${label}</label>
      <input class="sd-input" id="${id}" ${inputAttrs}${aria} />
    </div>`;
}

// Anmeldeformular. Ein echtes <form> mit autocomplete username und
// current-password, damit der iCloud-Schlüsselbund ausfüllt und speichert.
// Die Felder haben mindestens 16px (iOS zoomt sonst beim Antippen).
// invalid: Namen der leeren Felder ("email" | "password"); der Text bleibt ein einziger
// allgemeiner Fehler. Der Fehlerblock hängt per aria-describedby an allen markierten
// Feldern, bei einem Firebase-Fehler (invalid leer) am Passwortfeld.
export function renderLogin({ email = "", error = "", notice = "", invalid = [] } = {}) {
  const emailBad = invalid.includes("email");
  const pwBad = invalid.includes("password");
  const describePw = !!error && (pwBad || !emailBad);
  return `<div class="sd-auth">
  ${authBrandHTML(TAGLINE)}
  <form class="sd-card" data-form="login" data-card="login" novalidate aria-labelledby="loginTitle">
    <h1 class="sd-vh" id="loginTitle">Anmelden</h1>${notice ? `
    <p class="sd-notice sd-notice--amber" role="status" data-notice>${esc(notice)}</p>` : ""}
    ${loginField({ id: "login-email", label: "E-Mail", invalid: emailBad, describe: !!error && emailBad,
      inputAttrs: `type="email" name="email" autocomplete="username" inputmode="email" enterkeyhint="next" autocapitalize="none" autocorrect="off" spellcheck="false" required value="${esc(email)}"` })}
    ${loginField({ id: "login-password", label: "Passwort", invalid: pwBad, describe: describePw,
      inputAttrs: 'type="password" name="password" autocomplete="current-password" enterkeyhint="go" required' })}${error ? `
    <p class="sd-notice sd-notice--danger" role="alert" id="login-error" data-slot="login-error">${esc(error)}</p>` : ""}
    <button type="submit" class="sd-btn sd-btn--primary">Anmelden</button>
  </form>
  <p class="sd-auth__foot">Registrieren ist in der App nicht möglich.</p>
</div>`;
}

// Fremdes Konto: kein Zugriff, nur Abmelden. Die UID wird angezeigt (nur hier), damit
// ein Tippfehler in der erlaubten UID auffällt.
export function renderNoAccess({ email, uid }) {
  return `<div class="sd-auth">
  ${authBrandHTML()}
  <section class="sd-card" data-card="no-access" aria-labelledby="noAccessTitle">
    <div>
      <h1 class="sd-title sd-title--sm" id="noAccessTitle">Kein Zugriff</h1>
      <p class="sd-text">Dieses Konto ist für die App nicht freigegeben.</p>
    </div>
    <dl class="sd-kvlist">
      <div class="sd-kv"><dt>E-Mail</dt><dd>${esc(email || "unbekannt")}</dd></div>
      <div class="sd-kv"><dt>UID</dt><dd class="sd-mono">${esc(uid)}</dd></div>
    </dl>
    <button type="button" class="sd-btn sd-btn--primary" data-action="forbidden-logout">Abmelden</button>
  </section>
</div>`;
}

// Anonyme Altsitzung mit noch nicht übertragenen Einträgen: nicht abmelden.
export function renderPendingWrites() {
  return `<div class="sd-auth">
  ${authBrandHTML()}
  <section class="sd-card" data-card="pending-writes" aria-labelledby="pendingTitle">
    <div>
      <h1 class="sd-title sd-title--sm" id="pendingTitle">Noch nicht übertragene Einträge</h1>
      <p class="sd-text">Es gibt noch nicht übertragene Einträge. Bitte mit Netz erneut öffnen.</p>
    </div>
    <button type="button" class="sd-btn sd-btn--primary" data-action="retry-pending">Erneut versuchen</button>
  </section>
</div>`;
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
