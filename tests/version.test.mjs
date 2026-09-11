// Prüft, dass der Versionsstempel überall konsistent gesetzt ist.
//
// Der gefährliche Fall ist nicht "gar kein Stempel", sondern ein halber:
// Der Browser lädt dann ein neues app.js mit einem alten plan.js dazu.
// Besonders leicht passiert das, wenn ein neues Modul dazukommt und im
// Stempel-Skript vergessen wird.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

const stamps = new Set();

// --- index.html ---
const html = read("index.html");
for (const asset of ["style.css", "app.js", "manifest.webmanifest"]) {
  const m = html.match(new RegExp(`${asset.replace(".", "\\.")}\\?v=(\\d+)`));
  ok(!!m, `index.html: ${asset} trägt einen Versionsstempel`);
  if (m) stamps.add(m[1]);
}

// --- Module, die der Browser lädt ---
const browserModules = readdirSync(root)
  .filter((f) => f.endsWith(".js") && f !== "worker.js");

ok(browserModules.length > 0, `Module gefunden (${browserModules.join(", ")})`);

// Das Stempel-Skript muss jedes davon kennen
const bump = read("tools/bump-version.mjs");
const listed = [...bump.matchAll(/^\s*"([a-z0-9-]+\.js)",$/gim)].map((m) => m[1]);
for (const mod of browserModules) {
  ok(listed.includes(mod), `tools/bump-version.mjs kennt ${mod}`);
}

// Jeder Import zwischen den Modulen braucht denselben Stempel
for (const mod of browserModules) {
  const src = read(mod);
  const imports = [...src.matchAll(/from\s+["']\.\/([a-z0-9-]+\.js)(\?v=(\d+))?["']/gi)];
  for (const [, target, , stamp] of imports) {
    ok(!!stamp, `${mod}: Import von ./${target} trägt einen Stempel`);
    if (stamp) stamps.add(stamp);
  }
}

ok(stamps.size === 1, `Überall derselbe Stempel (gefunden: ${[...stamps].join(", ") || "keiner"})`);

console.log(fails ? `\n${fails} FEHLER` : "\nVersionsstempel konsistent");
process.exit(fails ? 1 : 0);
