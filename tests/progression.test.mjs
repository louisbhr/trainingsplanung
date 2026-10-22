import { parseSoll, suggestProgression, previousEntry, progressionChip } from "../progression.js";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fails++; } else console.log("ok  :", msg); };

// --- Sollvorgaben lesen ---
{
  const a = parseSoll("3x8-10");
  ok(a.sets === 3 && a.repMin === 8 && a.repMax === 10, "3x8-10 wird gelesen");
  const b = parseSoll("4x6/Seite");
  ok(b.sets === 4 && b.repMin === 6 && b.repMax === 6, "4x6/Seite: feste Wiederholungszahl");
  const c = parseSoll("3x30-45s");
  ok(c.timeBased, "3x30-45s wird als zeitbasiert erkannt");
  ok(parseSoll("2x8 (Deload)").deload, "Deload wird erkannt");
  ok(parseSoll("3x15/Seite").timeBased === false, "Wiederholungen mit /Seite sind nicht zeitbasiert");
  ok(parseSoll("Körpergewicht") === null, "Freitext ergibt keine Spanne");
}

const entry = (kg, reps, date = "2026-09-01") => ({ date, sets: reps.map((r) => ({ kg, reps: r })) });

// --- Der Kernfall: Spanne ausgeschöpft -> mehr Gewicht ---
{
  const s = suggestProgression("3x8-10", entry(80, [10, 10, 10]));
  ok(s.level === "up", "Alle Sätze am oberen Ende -> steigern");
  ok(s.text.includes("85 kg"), `Schrittweite 5 kg an der Langhantel (${s.text})`);
  const leicht = suggestProgression("3x8-10", entry(12, [10, 10, 10]));
  ok(leicht.text.includes("13 kg"), `Kleine Gewichte in 1-kg-Schritten (${leicht.text})`);
  const mittel = suggestProgression("3x8-10", entry(30, [10, 10, 10]));
  ok(mittel.text.includes("32.5 kg"), `Mittlere Gewichte in 2.5-kg-Schritten (${mittel.text})`);
}

// --- In der Spanne -> halten ---
{
  const s = suggestProgression("3x8-10", entry(80, [9, 9, 8]));
  ok(s.level === "hold", "Innerhalb der Spanne -> Gewicht halten");
  ok(s.text.includes("10 Wdh"), "Nennt das Ziel der Spanne");
  const abfall = suggestProgression("3x8-10", entry(80, [10, 9, 8]));
  ok(!abfall.text.includes("Abfall"), "Kleiner Abfall wird nicht kommentiert");
  const starkerAbfall = suggestProgression("4x5-7", entry(80, [7, 7, 6, 4]));
  ok(starkerAbfall.level === "down", "Ein Satz unter dem Soll zählt als zu schwer");
}

// --- Unter dem Soll -> reduzieren ---
{
  const s = suggestProgression("3x8-10", entry(80, [8, 7, 6]));
  ok(s.level === "down", "Unter der unteren Grenze -> reduzieren");
  ok(s.text.includes("75 kg"), `Schlägt weniger Gewicht vor (${s.text})`);
}

// --- Körpergewicht und Zeit ---
{
  const kg0 = suggestProgression("3x6-8", { date: "2026-09-01", sets: [{ kg: null, reps: 8 }, { kg: null, reps: 8 }, { kg: null, reps: 8 }] });
  ok(kg0.level === "up" && !kg0.text.includes("kg"), `Körpergewicht: über Wiederholungen steigern (${kg0.text})`);
  const zeit = suggestProgression("3x30-45s", entry(0, [45, 45, 45]));
  ok(zeit.level === "up" && !zeit.text.includes("kg"), "Zeitbasiert: kein Gewichtsvorschlag");
}

// --- Deload wird nicht hochgerechnet ---
{
  const s = suggestProgression("2x8 (Deload)", entry(64, [8, 8]));
  ok(s.level === "info" && !s.text.includes("versuchen"), "Deload schlägt keine Steigerung vor");
}

// --- Fehlende oder unbrauchbare Daten ---
{
  ok(suggestProgression("3x8-10", null) === null, "Ohne letzten Eintrag kein Vorschlag");
  ok(suggestProgression("3x8-10", { sets: [] }) === null, "Leere Sätze ergeben keinen Vorschlag");
  ok(suggestProgression("3x8-10", { sets: [{ kg: 80, reps: null }] }) === null, "Ohne Wiederholungen kein Vorschlag");
  ok(suggestProgression("Körpergewicht", entry(0, [10])) === null, "Ohne lesbare Spanne kein Vorschlag");
}

// --- Den letzten Eintrag vor einem Datum finden ---
{
  const entries = [entry(70, [9], "2026-09-01"), entry(80, [9], "2026-09-08"), entry(85, [9], "2026-09-15")];
  ok(previousEntry(entries, "2026-09-15").date === "2026-09-08", "Nimmt den jüngsten davorliegenden Eintrag");
  ok(previousEntry(entries, "2026-09-01") === null, "Vor dem ersten Eintrag gibt es keinen");
  ok(previousEntry([], "2026-09-15") === null, "Leere Historie");
  const mitLeerem = [{ date: "2026-09-08", sets: [] }, entry(70, [9], "2026-09-01")];
  ok(previousEntry(mitLeerem, "2026-09-15").date === "2026-09-01", "Überspringt Einträge ohne Sätze");
}

// --- Chip (Kurzform für den Kraft-Tag) ---
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(progressionChip("3x8-10", null) === null, "Chip: ohne Historie null");
  ok(progressionChip("Körpergewicht", entry(0, [10])) === null, "Chip: ohne lesbares Soll null");
  ok(progressionChip("3x8-10", { sets: [] }) === null, "Chip: ohne Sätze null");

  ok(same(progressionChip("3x8-10", entry(80, [10, 10, 10])), { level: "up", text: "Heute 85 kg", nextKg: 85 }),
     "Chip up: Langhantel +5 kg");
  const klein = progressionChip("3x8-10", entry(12, [10, 10, 10]));
  ok(klein.level === "up" && klein.nextKg === 13 && klein.text === "Heute 13 kg", "Chip up: kleine Gewichte +1 kg");
  const komma = progressionChip("3x8-10", entry(30, [10, 10, 10]));
  ok(komma.nextKg === 32.5 && komma.text === "Heute 32,5 kg", `Chip up: deutsche Kommazahl (${komma.text})`);

  ok(same(progressionChip("3x8-10", entry(80, [8, 8, 8])), { level: "hold", text: "80 kg halten", nextKg: 80 }),
     "Chip hold: Gewicht halten");
  const down = progressionChip("3x8-10", entry(80, [6, 6, 5]));
  ok(down.level === "down" && down.nextKg === 75 && down.text === "Heute 75 kg", "Chip down: Gewicht senken");

  const deload = progressionChip("2x8 (Deload)", entry(60, [8, 8]));
  ok(deload.level === "info" && deload.text === "Deload, 60 kg" && deload.nextKg === null, "Chip: Deload-Woche ist info");
  ok(progressionChip("2x8 (Deload)", entry(62.5, [8, 8])).text === "Deload, 62,5 kg", "Chip: Deload mit Komma");

  const bw = progressionChip("3x6-8", entry(null, [8, 8, 8]));
  ok(bw.level === "up" && bw.nextKg === null && bw.text === "Mehr Wdh oder schwerere Variante", "Chip: Körpergewicht voll ausgeschöpft");
  const bwInfo = progressionChip("3x6-8", entry(0, [6, 6, 7]));
  ok(bwInfo.level === "info" && bwInfo.text === "Wdh steigern" && bwInfo.nextKg === null, "Chip: Körpergewicht kg 0 wie null");

  const zeitUp = progressionChip("3x30-45s", entry(null, [45, 45, 45]));
  ok(zeitUp.level === "up" && zeitUp.text === "Länger halten" && zeitUp.nextKg === null, "Chip: Zeit voll ausgeschöpft");
  ok(progressionChip("3x30-45s", entry(null, [35, 40, 40])).text === "Zeit halten", "Chip: Zeit noch nicht ausgeschöpft");

  // Dieselbe Entscheidung wie suggestProgression
  for (const [soll, kg, reps] of [["3x8-10", 80, [10, 10, 10]], ["3x8-10", 80, [8, 9, 8]], ["3x8-10", 80, [7, 7, 7]], ["3x6-8", null, [8, 8, 8]]]) {
    ok(progressionChip(soll, entry(kg, reps)).level === suggestProgression(soll, entry(kg, reps)).level, `Chip: Stufe wie suggestProgression (${soll}, ${reps})`);
  }
}

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Progressions-Tests bestanden");
process.exit(fails ? 1 : 0);
