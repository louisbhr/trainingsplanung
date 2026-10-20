// Prüft die reine Logik der Login-Spike-Seite (S0, docs/plan-login-1b.md)
// ohne Browser. Die Seite selbst (spike/login.html, spike/login.js) bindet
// diese Funktionen nur an echte Firebase-/Browser-APIs an und wird von
// Louis manuell auf iPhone und MacBook geprüft — das ist hier nicht
// nachstellbar (iCloud-Schlüsselbund, Face ID, Home-Bildschirm-Speicher).
//
// Wichtig: Dieses Modul liegt unter tests/, die Spike-Seite unter spike/.
// stubs.test.mjs und version.test.mjs lesen nur Dateien direkt im
// Projekt-Wurzelverzeichnis (readdirSync ohne Rekursion) — spike/ taucht
// dort nicht auf (B8-Auflage, docs/review-architecture-login-1b.md).

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatUnixSeconds,
  formatMillis,
  analyzeNetworkResources,
  isStandaloneMode,
  describeReadResult,
} from "../spike/spike-logic.js";

test("formatUnixSeconds: formatiert einen Sekunden-Zeitstempel", () => {
  // auth_time-Claims sind Sekunden seit Epoch (nicht Millisekunden).
  const text = formatUnixSeconds(1735689600);
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0);
  assert.notEqual(text, "unbekannt");
});

test("formatUnixSeconds: unbekannt bei fehlendem/ungültigem Wert", () => {
  assert.equal(formatUnixSeconds(undefined), "unbekannt");
  assert.equal(formatUnixSeconds(null), "unbekannt");
  assert.equal(formatUnixSeconds(NaN), "unbekannt");
  assert.equal(formatUnixSeconds("1735689600"), "unbekannt");
});

test("formatMillis: formatiert einen Millisekunden-Zeitstempel", () => {
  const text = formatMillis(Date.now());
  assert.equal(typeof text, "string");
  assert.notEqual(text, "noch nie");
});

test("formatMillis: 'noch nie' bei fehlendem Wert (erster Besuch)", () => {
  assert.equal(formatMillis(null), "noch nie");
  assert.equal(formatMillis(undefined), "noch nie");
});

test("analyzeNetworkResources: trennt Script- und iframe-Quellen", () => {
  const entries = [
    { name: "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js", initiatorType: "script" },
    { name: "../style.css", initiatorType: "link" },
    { name: "https://louisbhr.github.io/trainingsplanung/spike/login.js", initiatorType: "script" },
  ];
  const r = analyzeNetworkResources(entries);
  assert.deepEqual(r.scripts, [
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js",
    "https://louisbhr.github.io/trainingsplanung/spike/login.js",
  ]);
  assert.deepEqual(r.iframes, []);
  assert.equal(r.hasFirebaseAppIframe, false);
});

test("analyzeNetworkResources: erkennt ein iframe von firebaseapp.com (soll nicht vorkommen, G1)", () => {
  const entries = [
    { name: "https://trainingsplanung-2c6c0.firebaseapp.com/__/auth/iframe", initiatorType: "iframe" },
  ];
  const r = analyzeNetworkResources(entries);
  assert.deepEqual(r.iframes, ["https://trainingsplanung-2c6c0.firebaseapp.com/__/auth/iframe"]);
  assert.equal(r.hasFirebaseAppIframe, true);
});

test("analyzeNetworkResources: leere/fehlende Liste ergibt leeres Ergebnis ohne Fehler", () => {
  assert.deepEqual(analyzeNetworkResources([]), { scripts: [], iframes: [], hasFirebaseAppIframe: false });
  assert.deepEqual(analyzeNetworkResources(undefined), { scripts: [], iframes: [], hasFirebaseAppIframe: false });
});

test("isStandaloneMode: true, wenn navigator.standalone oder die Media Query es sagt", () => {
  assert.equal(isStandaloneMode({ navigatorStandalone: true, displayModeStandalone: false }), true);
  assert.equal(isStandaloneMode({ navigatorStandalone: false, displayModeStandalone: true }), true);
  assert.equal(isStandaloneMode({ navigatorStandalone: false, displayModeStandalone: false }), false);
  assert.equal(isStandaloneMode({}), false);
});

test("describeReadResult: Erfolgstext mit Dokumentanzahl, inkl. Singular/Plural", () => {
  assert.equal(describeReadResult({ count: 0, fromCache: false }), "Lesen ok (0 Dokumente)");
  assert.equal(describeReadResult({ count: 1, fromCache: false }), "Lesen ok (1 Dokument)");
  assert.equal(describeReadResult({ count: 3, fromCache: false }), "Lesen ok (3 Dokumente)");
});

test("describeReadResult: markiert Ergebnisse aus dem Offline-Cache (Flugmodus-Test)", () => {
  assert.equal(describeReadResult({ count: 1, fromCache: true }), "Lesen ok (1 Dokument) (aus Cache)");
});

test("describeReadResult: Fehlertext ohne Anzahl", () => {
  assert.equal(describeReadResult({ count: undefined, fromCache: false }), "Lesen fehlgeschlagen");
});
