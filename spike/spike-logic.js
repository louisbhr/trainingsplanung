// Reine Logik der Login-Spike-Seite (S0, docs/plan-login-1b.md), ohne DOM
// und ohne Firebase-Import — deshalb ohne Browser testbar (siehe
// tests/spike-logic.test.mjs). login.js bindet diese Funktionen nur an
// echte Browser-/Firebase-APIs an (ID-Token-Claims, performance-Einträge,
// navigator.standalone, Firestore-Snapshot).
//
// Wegwerfseite: dieses Modul und die ganze spike/-Mappe werden direkt nach
// S0 wieder gelöscht (B8, docs/review-architecture-login-1b.md).

/** Formatiert einen Unix-Zeitstempel in Sekunden (z. B. den auth_time-Claim
 * aus dem ID-Token) als deutsche Datum/Zeit-Angabe. */
export function formatUnixSeconds(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "unbekannt";
  return new Date(seconds * 1000).toLocaleString("de-DE");
}

/** Formatiert einen Millisekunden-Zeitstempel (z. B. aus localStorage, "zuletzt
 * geöffnet"). Ohne Wert war die Seite noch nie offen. */
export function formatMillis(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "noch nie";
  return new Date(ms).toLocaleString("de-DE");
}

/**
 * Wertet Einträge von performance.getEntriesByType("resource") aus. Trennt
 * Script- von iframe-Quellen und markiert, ob ein iframe von
 * firebaseapp.com geladen wurde — das soll bei initializeAuth ohne
 * popupRedirectResolver nicht passieren (G1, docs/plan-login-1b.md).
 */
export function analyzeNetworkResources(entries) {
  const scripts = [];
  const iframes = [];
  for (const entry of entries || []) {
    const name = entry?.name || "";
    const type = entry?.initiatorType;
    if (type === "script") scripts.push(name);
    else if (type === "iframe") iframes.push(name);
  }
  const hasFirebaseAppIframe = iframes.some((src) => src.includes("firebaseapp.com"));
  return { scripts, iframes, hasFirebaseAppIframe };
}

/** Läuft die Seite im Standalone-Modus (Home-Bildschirm-App)? iOS kennt nur
 * navigator.standalone, andere Browser nur die Media Query — deshalb beide
 * prüfen. */
export function isStandaloneMode({ navigatorStandalone, displayModeStandalone }) {
  return navigatorStandalone === true || displayModeStandalone === true;
}

/** Anzeige-Text für den Firestore-Lesetest. Zeigt nur die Anzahl Dokumente
 * und ob das Ergebnis aus dem Offline-Cache kam (Flugmodus-Test) — nie
 * Inhalte (B8). */
export function describeReadResult({ count, fromCache }) {
  if (typeof count !== "number") return "Lesen fehlgeschlagen";
  const cacheNote = fromCache ? " (aus Cache)" : "";
  return `Lesen ok (${count} Dokument${count === 1 ? "" : "e"})${cacheNote}`;
}
