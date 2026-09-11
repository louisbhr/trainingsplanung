import { parseSoll, suggestProgression, previousEntry } from "../progression.js";

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

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Progressions-Tests bestanden");
process.exit(fails ? 1 : 0);
