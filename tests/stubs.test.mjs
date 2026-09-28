// Stub-Wächter (A9).
//
// Die Browser-Tests in app.test.mjs ersetzen config.js und firebase-init.js
// durch eigene Stub-Module (per ctx.route), damit sie ohne echte Firebase-/
// Strava-Zugänge laufen. Bekommt eine der echten Dateien einen neuen Export,
// den ein Browser-Modul tatsächlich braucht, aber der Stub zieht nicht nach,
// bricht das erst mitten in den (langsamen) Browser-Tests mit einem
// Modul-Fehler ab. Dieser Test macht das vorher und ohne Browser laut.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// Alle Browser-Module (worker.js läuft bei Cloudflare, nicht im Browser).
const browserModules = readdirSync(root).filter((f) => f.endsWith(".js") && f !== "worker.js");

// Alle Namen, die irgendein Browser-Modul aus "./<targetFile>" importiert.
function importedNamesFrom(targetFile) {
  const names = new Set();
  const esc = targetFile.replace(".", "\\.");
  const re = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']\\./${esc}(\\?[^"']*)?["']`, "g");
  for (const mod of browserModules) {
    const src = read(mod);
    for (const m of src.matchAll(re)) {
      for (const raw of m[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (name) names.add(name);
      }
    }
  }
  return names;
}

// Alle exportierten Namen aus einem Stück Quelltext (egal ob eine echte
// Datei oder ein Stub-Modul-Literal — beides ist einfach "export ...").
function exportedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  return names;
}

// Jedes einzelne Stub-Literal für <targetFile> in tests/app.test.mjs — nicht
// alle Exporte über alle Stubs hinweg gepoolt (M2 aus dem Code-Review): ein
// Name, der nur im Firebase-Stub steht, darf die Anforderung an den
// config.js-Stub nicht erfüllen, und umgekehrt. Mehrere Stub-Literale für
// dieselbe Datei (z. B. der Standard-Stub und der Fehler-Stub in Test 9)
// müssen JEDES FÜR SICH die gebrauchten Namen abdecken, weil sie einzeln
// (ohne den jeweils anderen) eingesetzt werden.
function stubLiteralsFor(targetFile) {
  const src = read("tests/app.test.mjs");
  // Der Dateiname taucht im Testtext als Regex-Literal auf, z. B.
  // `ctx.route(/config\.js/, …)` — der Backslash vor dem Punkt steht dort
  // wörtlich im Quelltext, deshalb hier \\\\\\. (matcht einen echten
  // Backslash gefolgt von einem echten Punkt), nicht \\. wie beim Vergleich
  // von Importpfaden in importedNamesFrom().
  const base = targetFile.replace(/\.js$/, "");
  const re = new RegExp(
    `ctx\\.route\\(\\/${base}\\\\\\.js\\/,[\\s\\S]{0,400}?body:\\s*([A-Za-z_$][A-Za-z0-9_$]*|\`[\\s\\S]*?\`|'[^']*'|"[^"]*")`,
    "g"
  );
  const bodies = new Set();
  for (const m of src.matchAll(re)) bodies.add(m[1]);
  // Eine Konstante (z. B. FIREBASE_STUB) auflösen: die Definition suchen.
  return [...bodies].map((body) => {
    const constMatch = body.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    if (!constMatch) return { label: body.slice(0, 24) + "…", text: body };
    const defRe = new RegExp(`const\\s+${body}\\s*=\\s*(\`[\\s\\S]*?\`|'[^']*'|"[^"]*")`);
    const def = src.match(defRe);
    return { label: body, text: def ? def[1] : "" };
  });
}

for (const file of ["config.js", "firebase-init.js"]) {
  const real = exportedNames(read(file));
  const needed = importedNamesFrom(file);
  ok(needed.size > 0, `${file}: mindestens ein Import aus einem Browser-Modul gefunden (${[...needed].join(", ")})`);
  for (const name of needed) {
    ok(real.has(name), `${file}: echter Export "${name}" existiert wirklich`);
  }

  const literals = stubLiteralsFor(file);
  ok(literals.length > 0, `${file}: mindestens ein Stub-Literal in tests/app.test.mjs gefunden`);
  for (const literal of literals) {
    const stubbed = exportedNames(literal.text);
    for (const name of needed) {
      ok(stubbed.has(name), `${file}: Stub "${literal.label}" deckt "${name}" ab`);
    }
  }
}

console.log(fails ? `\n${fails} FEHLER` : "\nStub-Wächter: alle gebrauchten Exporte sind in jedem Stub-Literal einzeln abgedeckt");
process.exit(fails ? 1 : 0);
