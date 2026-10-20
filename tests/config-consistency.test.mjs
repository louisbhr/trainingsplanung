// Hält die Stellen gleich, an denen die erlaubte UID und die Projekt-ID
// stehen: config.js (Client), firestore.rules, wrangler.toml (Worker) und
// firebase-init.js (projectId). Ein Tippfehler in der UID würde Louis aus
// der App aussperren, ein Platzhalter würde es ebenso tun.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");

const UID_PATTERN = /^[A-Za-z0-9]{20,128}$/;

const configUid = read("config.js").match(/export const ALLOWED_UID\s*=\s*"([^"]*)"/)?.[1];
const rulesUids = [...read("firestore.rules").matchAll(/request\.auth\.uid\s*==\s*"([^"]*)"/g)].map((m) => m[1]);
const wranglerUid = read("wrangler.toml").match(/^ALLOWED_UID\s*=\s*"([^"]*)"/m)?.[1];

test("UID steht in config.js, firestore.rules und wrangler.toml", () => {
  assert.ok(configUid, "ALLOWED_UID in config.js fehlt");
  assert.equal(rulesUids.length, 1, "firestore.rules braucht genau eine UID-Pruefung");
  assert.ok(wranglerUid, "ALLOWED_UID in wrangler.toml fehlt");
});

test("die drei UIDs sind identisch", () => {
  assert.equal(rulesUids[0], configUid, "firestore.rules weicht von config.js ab");
  assert.equal(wranglerUid, configUid, "wrangler.toml weicht von config.js ab");
});

test("die UID ist kein Platzhalter, sondern hat das Muster einer Firebase-UID", () => {
  assert.match(configUid, UID_PATTERN);
});

test("FIREBASE_PROJECT_ID in wrangler.toml = projectId in firebase-init.js", () => {
  const worker = read("wrangler.toml").match(/^FIREBASE_PROJECT_ID\s*=\s*"([^"]*)"/m)?.[1];
  const client = read("firebase-init.js").match(/projectId:\s*"([^"]*)"/)?.[1];
  assert.ok(worker && client);
  assert.equal(worker, client);
});

test("firestore.rules: eine rekursive Regel, Anmeldung Pflicht, keine offene Variante", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /request\.auth != null && request\.auth\.uid == "/);
  assert.ok(!/allow [^;]*if true/.test(rules));
  assert.ok(!/request\.auth != null;/.test(rules), "reine Anmeldepruefung ohne UID ist zu offen");
});

test("wrangler.toml und worker.js: kein AUTH_MODE-Schalter mehr (Token-Pruefung immer verbindlich)", () => {
  assert.ok(!/AUTH_MODE/.test(read("wrangler.toml")), "AUTH_MODE in wrangler.toml");
  assert.ok(!/AUTH_MODE/.test(read("worker.js")), "AUTH_MODE in worker.js");
});
