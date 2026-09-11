import { assignRuns, pickableRuns, daysBetween, offsetLabel } from "../runmatch.js";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

const run = (id, date, km) => ({ id, date, distanceKm: km, name: "Lauf " + id });

// Woche 2: Mo 07.09. 8km, Mi 09.09. 8km, Sa 12.09. 13km
const plan = [
  { date: "2026-09-07", distKm: 8 },
  { date: "2026-09-09", distKm: 8 },
  { date: "2026-09-12", distKm: 13 },
];

ok(daysBetween("2026-09-09", "2026-09-10") === 1, "daysBetween: ein Tag später");
ok(daysBetween("2026-09-10", "2026-09-09") === -1, "daysBetween: ein Tag früher");
ok(daysBetween("2026-10-24", "2026-10-26") === 2, "daysBetween: über die Zeitumstellung");

// --- Der Anlass: Mittwochslauf am Donnerstag nachgeholt ---
{
  const runs = [run(1, "2026-09-07", 8.1), run(2, "2026-09-10", 8.3)];
  const a = assignRuns(plan, runs);
  ok(a["2026-09-07"].source === "exact", "Montag: exakter Treffer");
  ok(a["2026-09-09"]?.run?.id === 2, "Mittwoch: Donnerstagslauf wird zugeordnet");
  ok(a["2026-09-09"].source === "auto" && a["2026-09-09"].offset === 1, "Mittwoch: als nachgeholt markiert");
  ok(!a["2026-09-12"], "Samstag: noch kein Lauf");
  ok(offsetLabel(1) === "einen Tag später nachgeholt", "Beschriftung für +1 Tag");
  ok(offsetLabel(-2) === "2 Tage früher gelaufen", "Beschriftung für -2 Tage");
}

// --- Kein Lauf darf doppelt vergeben werden ---
{
  const runs = [run(1, "2026-09-07", 8), run(2, "2026-09-08", 8)];
  const a = assignRuns(plan, runs);
  const ids = Object.values(a).filter((x) => x.run).map((x) => x.run.id);
  ok(new Set(ids).size === ids.length, "Jeder Lauf wird höchstens einmal vergeben");
  ok(a["2026-09-09"].run.id === 2, "Dienstagslauf geht an den nächstgelegenen offenen Plantag");
}

// --- Ein Lauf, der auf einem anderen Lauftag liegt, wird nicht weggenommen ---
{
  const runs = [run(1, "2026-09-07", 8)];
  const a = assignRuns([{ date: "2026-09-06", distKm: 8 }, ...plan], runs);
  ok(a["2026-09-07"].run.id === 1, "Lauf bleibt bei seinem eigenen Plantag");
  ok(!a["2026-09-06"], "Nachbartag bekommt ihn nicht");
}

// --- Fenster: 4 Tage später ist zu weit ---
{
  const a = assignRuns(plan, [run(9, "2026-09-13", 8)]);
  ok(!a["2026-09-09"], "Vier Tage später wird nicht mehr automatisch zugeordnet");
  // Nur der Mittwoch offen: ein Lauf am Dienstag gehört dann zu ihm
  const b = assignRuns([{ date: "2026-09-09", distKm: 8 }], [run(9, "2026-09-08", 8)]);
  ok(b["2026-09-09"]?.run?.id === 9, "Ein Tag früher wird zugeordnet");
  // Steht auch der Montag offen, ist der Dienstagslauf eher dessen Nachholtermin
  const c = assignRuns(plan, [run(9, "2026-09-08", 8)]);
  ok(c["2026-09-07"]?.run?.id === 9 && !c["2026-09-09"],
     "Bei zwei offenen Tagen gewinnt der, für den es ein Nachholen wäre");
}

// --- Bei gleichem Abstand entscheidet die Distanz ---
{
  const runs = [run(1, "2026-09-10", 3), run(2, "2026-09-10", 8.2)];
  const a = assignRuns([{ date: "2026-09-09", distKm: 8 }], runs);
  ok(a["2026-09-09"].run.id === 2, "Bei gleichem Abstand gewinnt die passende Distanz");
}

// --- Manuelle Zuordnung schlägt alles ---
{
  const runs = [run(1, "2026-09-09", 8), run(2, "2026-09-11", 5)];
  const a = assignRuns(plan, runs, { "2026-09-09": { activityId: 2 } });
  ok(a["2026-09-09"].run.id === 2 && a["2026-09-09"].source === "manual", "Manuelle Zuordnung gewinnt");
  ok(a["2026-09-09"].offset === 2, "Manuelle Zuordnung kennt den Abstand");
  ok(Object.values(a).filter((x) => x.run?.id === 1).length === 0, "Der exakte Lauf bleibt dann frei");
}

// --- Bewusst leer lassen verhindert die Automatik ---
{
  const runs = [run(2, "2026-09-10", 8)];
  const a = assignRuns(plan, runs, { "2026-09-09": { activityId: null } });
  ok(a["2026-09-09"].source === "ignored" && !a["2026-09-09"].run, "Bewusst leer lassen unterdrückt die Automatik");
  ok(pickableRuns(runs, a, "2026-09-09").some((r) => r.id === 2), "Der Lauf steht danach wieder zur Auswahl");
}

// --- Gelöschter Lauf: Zuordnung fällt sauber zurück ---
{
  const runs = [run(5, "2026-09-09", 8)];
  const a = assignRuns(plan, runs, { "2026-09-09": { activityId: 999 } });
  ok(a["2026-09-09"].run.id === 5, "Verschwundener Lauf fällt auf den exakten Treffer zurück");
}

// --- Auswahl für die manuelle Zuordnung ---
{
  const runs = [run(1, "2026-09-07", 8), run(2, "2026-09-10", 8), run(3, "2026-08-20", 8)];
  const a = assignRuns(plan, runs);
  const pick = pickableRuns(runs, a, "2026-09-12");
  ok(!pick.some((r) => r.id === 1), "Auswahl zeigt keine bereits vergebenen Läufe");
  ok(!pick.some((r) => r.id === 3), "Auswahl zeigt nichts außerhalb von ±7 Tagen");
  const pickOwn = pickableRuns(runs, a, "2026-09-09");
  ok(pickOwn.some((r) => r.id === 2), "Der eigene zugeordnete Lauf bleibt in der Auswahl");
  ok(pickOwn[0].id === 2, "Auswahl ist nach Nähe sortiert");
}

// --- Leere Eingaben ---
{
  ok(Object.keys(assignRuns(plan, [])).length === 0, "Keine Läufe: keine Zuordnung");
  ok(Object.keys(assignRuns([], [run(1, "2026-09-07", 8)])).length === 0, "Keine Plantage: keine Zuordnung");
}

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Zuordnungs-Tests bestanden");
process.exit(fails ? 1 : 0);
