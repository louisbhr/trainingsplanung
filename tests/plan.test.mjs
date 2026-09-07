import { weeks, phases, weekNumberFor, weekDates, weekStart, addDays, exerciseCatalog, PLAN_START, TOTAL_WEEKS } from "../plan.js";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// Plan-Daten
ok(weekNumberFor("2026-08-31") === 1, "31.08.2026 = Woche 1");
ok(weekNumberFor("2026-09-06") === 1, "06.09.2026 = Woche 1 (Sonntag)");
ok(weekNumberFor("2026-09-07") === 2, "07.09.2026 = Woche 2");
ok(weekNumberFor("2026-08-01") === 1, "vor Planstart auf 1 begrenzt");
ok(weekNumberFor("2030-01-01") === TOTAL_WEEKS, "nach Planende begrenzt");
// über die Zeitumstellung (letzter So im Okt 2026 = 25.10.)
ok(weekNumberFor("2026-10-26") === 9, "26.10.2026 = Woche 9 (nach Zeitumstellung)");
ok(weekDates(9)[0] === "2026-10-26", "Woche 9 startet Montag 26.10.");
ok(weekDates(1).length === 7 && weekDates(1)[6] === "2026-09-06", "Woche hat 7 Tage, Sonntag zuletzt");

// Jede Detailwoche: Kraft Di/Do, Läufe an den richtigen Tagen
const dow = (iso) => new Date(iso + "T12:00:00").getDay();
for (let w = 1; w <= 8; w++) {
  const wk = weeks[w];
  ok(dow(wk.kraft.di.date) === 2, `W${w} Kraft A am Dienstag`);
  ok(dow(wk.kraft.do.date) === 4, `W${w} Kraft B am Donnerstag`);
  const days = weekDates(w);
  ok(wk.runs.every((r) => days.includes(r.date)), `W${w} alle Läufe in der Woche`);
  ok(wk.runs.every((r) => r.dist && r.pace && r.hf), `W${w} Läufe vollständig`);
  ok(wk.kraft.di.exercises.length > 0 && wk.kraft.do.exercises.length > 0, `W${w} Übungen vorhanden`);
  // keine Kollision Kraft/Lauf am selben Tag
  const runDates = wk.runs.map((r) => r.date);
  ok(!runDates.includes(wk.kraft.di.date) && !runDates.includes(wk.kraft.do.date), `W${w} keine Doppelbelegung`);
}
for (let w = 9; w <= 31; w++) ok(weeks[w] && weeks[w].placeholder, `W${w} als Platzhalter vorhanden`);
ok(phases.every((p) => weeks[p.weeks[0]] && weeks[p.weeks[1]]), "Phasengrenzen existieren");
ok(exerciseCatalog.length > 10, `Übungskatalog gefüllt (${exerciseCatalog.length})`);

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Unit-Tests bestanden");
process.exit(fails ? 1 : 0);
