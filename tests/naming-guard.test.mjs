// Wächter für die Umbenennung zu "Stride": der sichtbare Name ist neu, die
// internen Bezeichner (Speicherschlüssel, Paketname) bleiben "hm-tracker",
// sonst gehen gespeicherte Pläne verloren und das Abmelden räumt nicht mehr auf.
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const manifest = JSON.parse(read("manifest.webmanifest"));

test("package.json behält den Namen hm-tracker", () => {
  assert.equal(JSON.parse(read("package.json")).name, "hm-tracker");
});

test("Speicherschlüssel behalten das Präfix hm-tracker.", () => {
  assert.match(read("plan-store.js"), /`hm-tracker\.plan\.\$\{/);
  assert.match(read("config.js"), /OVERRIDE_KEY\s*=\s*"hm-tracker\./);
  assert.match(read("firebase-init.js"), /startsWith\("hm-tracker\."\)/);
});

test("Abmelde-Hinweis-Schlüssel bleibt hm-tracker-notice", () => {
  assert.match(read("app.js"), /LOGOUT_NOTICE_KEY\s*=\s*"hm-tracker-notice"/);
});

test("alter Name steht nicht mehr in index.html, Manifest und view-account.js", () => {
  for (const file of ["index.html", "manifest.webmanifest", "view-account.js"]) {
    const text = read(file);
    assert.doesNotMatch(text, /Halbmarathon Tracker/, `${file}: "Halbmarathon Tracker"`);
    assert.doesNotMatch(text, /HM Tracker/, `${file}: "HM Tracker"`);
  }
});

test("Manifest: Name und Farben", () => {
  assert.equal(manifest.name, "Stride");
  assert.equal(manifest.short_name, "Stride");
  assert.equal(manifest.theme_color, "#f4f3ef");
  assert.equal(manifest.background_color, "#f4f3ef");
});

test("jedes Manifest-Icon existiert als Datei", () => {
  assert.ok(manifest.icons.length >= 3);
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(root, icon.src)), `${icon.src} fehlt`);
  }
});

test("index.html verweist auf apple-touch-icon.png, das existiert", () => {
  assert.match(read("index.html"), /rel="apple-touch-icon"\s+href="apple-touch-icon\.png"/);
  assert.ok(existsSync(join(root, "apple-touch-icon.png")));
});
