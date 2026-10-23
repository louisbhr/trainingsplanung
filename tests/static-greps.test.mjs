// Statische Prüfungen über den Quelltext (Stride E9, docs/plan-stride.md Abschnitt 4):
// kein sichtbares "Dashboard", keine Koralle in Fehlerklassen, kein statisches style=,
// kein Gedankenstrich in UI-Texten, der alte Name nur an erlaubten Orten.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const rootFiles = readdirSync(root, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
const jsFiles = rootFiles.filter((f) => f.endsWith(".js"));
const viewFiles = rootFiles.filter((f) => /^view-.*\.js$/.test(f));
// Render-Code: alles, was Markup oder UI-Text erzeugt (worker.js läuft auf Cloudflare, plan-Daten liegen in plans/)
const renderFiles = [...viewFiles, "app.js", "ui.js", "export.js"];

// Kommentare entfernen (Zeilen- und Blockkommentare, Nachlauf nach Leerzeichen), damit nur Code geprüft wird.
function codeLines(file) {
  const text = read(file).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return text.split("\n").map((line, i) => ({ n: i + 1, text: line.replace(/(^|\s)\/\/.*$/, "$1") }));
}
const hits = (file, re, skip = () => false) =>
  codeLines(file).filter((l) => re.test(l.text) && !skip(l.text)).map((l) => `${file}:${l.n}: ${l.text.trim().slice(0, 100)}`);

test("kein sichtbares Wort Dashboard in Markup und UI-Texten", () => {
  const found = renderFiles.flatMap((f) => hits(f, /\bDashboard\b/));
  assert.deepEqual(found, []);
  assert.doesNotMatch(read("index.html").replace(/<!--[\s\S]*?-->/g, ""), /\bDashboard\b/);
  assert.doesNotMatch(read("manifest.webmanifest"), /\bDashboard\b/);
});

test("style.css: keine Koralle in Fehler- und Danger-Regeln", () => {
  const css = read("style.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const bad = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (/error|danger/i.test(selector) && /var\(--coral/.test(m[2])) bad.push(selector.slice(0, 80));
  }
  assert.deepEqual(bad, []);
});

test("kein statisches style= im Render-Code und in index.html", () => {
  const found = jsFiles.filter((f) => f !== "worker.js").flatMap((f) => hits(f, /\bstyle\s*=\s*["'\\]/));
  assert.deepEqual(found, []);
  assert.doesNotMatch(read("index.html").replace(/<!--[\s\S]*?-->/g, ""), /\sstyle\s*=/);
});

test("kein Gedankenstrich in den UI-Texten der Ansichten und von app.js", () => {
  // console.*-Meldungen sind Entwicklertext; die Regex in app.js (replace(/\s+—\s+/)) entfernt Gedankenstriche aus Fremdtexten.
  const skip = (t) => /console\.(error|warn|log)/.test(t) || /\\s\+—\\s\+/.test(t);
  const found = [...viewFiles, "app.js"].flatMap((f) => hits(f, /—/, skip));
  assert.deepEqual(found, []);
});

test("alter Name (Halbmarathon Tracker, HM Tracker) steht nur in docs, tests und Agent-Notizen", () => {
  const files = rootFiles.filter((f) => /\.(js|html|css|md|json|webmanifest|toml|rules|svg)$/.test(f));
  const found = files.filter((f) => /Halbmarathon Tracker|HM Tracker/.test(read(f)));
  assert.deepEqual(found, []);
});

test("kein natives confirm()/alert()/prompt(): Bestätigungen laufen über das Sheet (Lösch-Funktion)", () => {
  const found = renderFiles.flatMap((f) => hits(f, /(^|[^.\w$])(confirm|alert|prompt)\s*\(/));
  assert.deepEqual(found, []);
});
