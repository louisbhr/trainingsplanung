// Hängt einen Versionsstempel an alle eigenen Dateiverweise, damit ein
// Deploy im Browser garantiert neu geladen wird.
//
// GitHub Pages lässt CSS und JS zehn Minuten cachen, und Safari hält
// sich auf dem Home-Bildschirm noch hartnäckiger daran. Ohne Stempel
// sieht man nach einem Deploy unter Umständen die alte Version — und
// das Tückische: teils neu, teils alt, weil jede Datei ihren eigenen
// Cache-Eintrag hat.
//
// Aufruf:  npm run version
// Danach committen. Der Stempel steht sichtbar im Diff.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const stamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 12); // JJJJMMTTHHMM

// Alle Module, die die App im Browser lädt. worker.js läuft bei
// Cloudflare und wird nicht über die Seite ausgeliefert.
const MODULES = [
  "app.js",
  "config.js",
  "firebase-init.js",
  "plan.js",
  "progression.js",
  "runmatch.js",
  "strava.js",
];
const ASSETS = ["style.css", "app.js", "manifest.webmanifest"];

let touched = 0;

function withVersion(path, transform) {
  const file = join(root, path);
  const before = readFileSync(file, "utf8");
  const after = transform(before);
  if (after !== before) {
    writeFileSync(file, after);
    touched++;
  }
}

// index.html: Stylesheet, Einstiegsmodul und Manifest
withVersion("index.html", (src) => {
  let out = src;
  for (const asset of ASSETS) {
    const re = new RegExp(`(["'])${asset.replace(".", "\\.")}(\\?v=\\d+)?\\1`, "g");
    out = out.replace(re, `$1${asset}?v=${stamp}$1`);
  }
  return out;
});

// Importe zwischen den Modulen — sonst lädt der Browser zwar ein neues
// app.js, aber die alten plan.js und strava.js dazu.
const importRe = /from\s+(["'])\.\/([a-z0-9-]+\.js)(\?v=\d+)?\1/gi;
for (const mod of MODULES) {
  withVersion(mod, (src) => src.replace(importRe, (_m, q, name) => `from ${q}./${name}?v=${stamp}${q}`));
}

console.log(`Version ${stamp} gesetzt (${touched} Datei${touched === 1 ? "" : "en"} geändert).`);
