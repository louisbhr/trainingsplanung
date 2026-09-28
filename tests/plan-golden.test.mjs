// Golden-Test (A2): vergleicht für jeden Tag vom 24.08. bis 31.10.2026 die
// neue Logik (sessionOn/planDayState gegen plans/hm-2027.json) mit der
// eingefrorenen alten Logik (tests/fixtures/plan-legacy.mjs, unverändert
// seit vor dem Umzug). Das ist das Sicherheitsnetz für den Umbau in M1-3:
// Übungsnamen und slug() bestimmen die Log-IDs (logs/{datum}_{slug}) — eine
// unbeabsichtigte Abweichung würde hier echte, bereits gespeicherte Logs
// "verschwinden" lassen.
//
// Bewusste Abweichung (siehe docs/plan-dashboard-v2.md, M1-3): Tage vor dem
// Planstart (24.–30.08.2026) liefern jetzt "keinPlan" statt (wie früher)
// stumm auf Woche 1 geklemmt zu werden.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, sessionOn, planDayState, slug as newSlug, exerciseCatalog } from "../plan.js";
import {
  weeks as oldWeeks,
  weekNumberFor as oldWeekNumberFor,
  exerciseCatalog as oldExerciseCatalog,
} from "../tests/fixtures/plan-legacy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(readFileSync(join(root, "plans", "hm-2027.json"), "utf8"));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// Die alte slug()-Funktion, Zeichen für Zeichen aus der Git-Historie von
// app.js — bewusst hier dupliziert, nicht importiert, weil der ganze Sinn
// des Golden-Tests ist, unabhängig vom heutigen Code zu prüfen.
const oldSlug = (s) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Alte dayInfo()-Logik, Zeichen für Zeichen aus der Git-Historie von
// app.js — arbeitet auf dem eingefrorenen tests/fixtures/plan-legacy.mjs.
function oldDayInfo(iso) {
  const w = oldWeekNumberFor(iso);
  const week = oldWeeks[w];
  if (!week || week.placeholder) return { kind: "placeholder", week: w, focus: week?.focus };
  if (week.kraft.di.date === iso) return { kind: "kraft", ...week.kraft.di };
  if (week.kraft.do.date === iso) return { kind: "kraft", ...week.kraft.do };
  const run = week.runs.find((r) => r.date === iso);
  if (run) return { kind: "lauf", ...run };
  return { kind: "ruhe" };
}

function exercisesEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((ex, i) => ex.name === b[i].name && ex.soll === b[i].soll && (ex.hint || "") === (b[i].hint || ""));
}

// ---- Slug-Parität: identisch für jede Übung im (alten) Katalog ----
for (const ex of oldExerciseCatalog) {
  ok(newSlug(ex.name) === oldSlug(ex.name), `slug("${ex.name}") ist bei alt und neu identisch`);
}

// ---- Übungskatalog (M6): Namen und firstWeek Eintrag für Eintrag vergleichen,
// nicht nur die Länge — sonst würde eine vertauschte oder falsch datierte
// Übung unbemerkt bleiben, solange die Gesamtzahl stimmt.
{
  const newCatalog = exerciseCatalog(plan);
  ok(newCatalog.length === oldExerciseCatalog.length, `Übungskatalog gleich groß (alt ${oldExerciseCatalog.length}, neu ${newCatalog.length})`);
  const len = Math.min(newCatalog.length, oldExerciseCatalog.length);
  for (let i = 0; i < len; i++) {
    const a = oldExerciseCatalog[i];
    const b = newCatalog[i];
    ok(a.name === b.name, `Übungskatalog[${i}]: gleicher Name ("${a.name}" vs. "${b.name}")`);
    ok(a.firstWeek === b.firstWeek, `Übungskatalog[${i}] "${a.name}": gleiches firstWeek (${a.firstWeek} vs. ${b.firstWeek})`);
  }
}

// ---- Tag für Tag, 24.08.–31.10.2026 ----
const START = "2026-08-24";
const END = "2026-10-31";
let iso = START;
let checked = 0;
while (iso <= END) {
  checked++;
  if (iso < plan.start) {
    // Bewusste Abweichung: vor Planstart jetzt "keinPlan" statt Woche 1.
    ok(planDayState(iso, [plan]) === "keinPlan", `${iso}: vor Planstart jetzt "keinPlan" (bewusste Abweichung)`);
  } else {
    const old = oldDayInfo(iso);
    const neu = sessionOn(plan, iso);

    ok(neu.kind === old.kind, `${iso}: gleiche Art (alt ${old.kind}, neu ${neu.kind})`);

    if (old.kind === "kraft" && neu.kind === "kraft") {
      ok(neu.date === old.date, `${iso}: Kraft — gleiches Datum`);
      ok(neu.label === old.label, `${iso}: Kraft — gleicher Titel ("${old.label}")`);
      ok(exercisesEqual(neu.exercises, old.exercises), `${iso}: Kraft — Übungen, Soll und Hinweise identisch`);
    } else if (old.kind === "lauf" && neu.kind === "lauf") {
      ok(neu.date === old.date, `${iso}: Lauf — gleiches Datum`);
      ok(neu.type === old.type, `${iso}: Lauf — gleicher Titel ("${old.type}")`);
      ok(neu.dist === old.dist, `${iso}: Lauf — gleiche Distanz (${old.dist})`);
      ok(neu.pace === old.pace, `${iso}: Lauf — gleiche Pace`);
      ok(neu.hf === old.hf, `${iso}: Lauf — gleiche HF-Zone`);
      ok((neu.note ?? null) === (old.note ?? null), `${iso}: Lauf — gleiche Notiz (${JSON.stringify(old.note ?? null)})`);
    } else if (old.kind === "placeholder" && neu.kind === "placeholder") {
      ok(true, `${iso}: beide Platzhalter`);
    }
  }
  iso = addDays(iso, 1);
}
ok(checked === 69, `Zeitraum vollständig geprüft (${checked} Tage, 24.08.–31.10.2026)`);

console.log(fails ? `\n${fails} FEHLER` : "\nGolden-Test bestanden — alte und neue Plan-Logik stimmen überein");
process.exit(fails ? 1 : 0);
