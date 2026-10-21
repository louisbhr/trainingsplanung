# Tests

Die App selbst braucht keinen Build-Step — diese Tests sind nur für die
Entwicklung.

```bash
npm install            # http-server + playwright
npx playwright install chromium

npm run serve          # in einem zweiten Terminal: Server auf :8099
npm test               # 13 Läufe: Logik-/Worker-Tests ohne Browser, dann Browser-Tests
```

- `plan.test.mjs` — prüft `plans/hm-2027.json` direkt (Struktur, lückenlose
  Wochen, Wochentage der Kraft-/Lauftage, Platzhalterwochen, `validatePlan`
  inkl. Negativ-Fixturen) sowie die reine Logik aus `plan.js`:
  `weekNumberFor`/`weekDates` (inkl. beider Zeitumstellungen im Plan),
  `planDayState`/`activePlanFor` an den Grenzen, `formatGoal`, `phaseRange`.
- `plan-golden.test.mjs` — Sicherheitsnetz für den M1-Umbau (A2): vergleicht
  für jeden Tag vom 24.08. bis 25.10.2026 (Wochen 1–8) die neue Logik
  (`sessionOn`/`plans/hm-2027.json`) mit der eingefrorenen alten Logik
  (`fixtures/plan-legacy.mjs`, unverändert seit vor dem Umzug) — Kraft/Lauf-
  Details, Notizen und `slug()` müssen übereinstimmen. Bleibt bis zum Ende
  von M2 liegen.
- `stubs.test.mjs` — Stub-Wächter (A9): vergleicht, welche Namen die
  Browser-Module tatsächlich aus `config.js`/`firebase-init.js` importieren,
  gegen die Stub-Literale in `app.test.mjs` — macht einen vergessenen
  Stub-Nachzug laut, bevor die (langsameren) Browser-Tests mittendrin
  abbrechen.
- `runmatch.test.mjs` — prüft die Zuordnung von Strava-Läufen zu
  Plan-Lauftagen ohne Browser: exakte Treffer, nachgeholte Läufe,
  manuelle Zuordnung, und dass kein Lauf doppelt vergeben wird.
- `progression.test.mjs` — prüft den Gewichtsvorschlag aus den
  Wiederholungen der Vorwoche: Spanne ausgeschöpft, unter dem Soll,
  Körpergewichts- und Zeitübungen, Deload.
- `version.test.mjs` — prüft, dass der Versionsstempel in `index.html`
  und in allen Modul-Importen gesetzt und überall derselbe ist. Fängt
  den Fall ab, dass ein neues Modul angelegt, aber im Stempel-Skript
  vergessen wurde.
- `access.test.mjs` — Zugangslogik ohne Browser: Sitzungszustand gegen die
  erlaubte UID, deutsche Anmeldefehler, Timeout-Helfer und der Worker-Aufruf
  mit Token (Retry nur bei 401 mit `error: "unauthorized"`).
- `config-consistency.test.mjs` — UID in `config.js`, `firestore.rules` und
  `wrangler.toml` gleich und kein Platzhalter; Projekt-ID in Worker und
  Client gleich.
- `worker.test.mjs` — `/coach`, `/exchange`, `/refresh` und die Token-
  Prüfung: Testschlüssel und Token werden im Test selbst erzeugt, Googles
  Schlüssel-Endpunkt ist gemockt (401-Matrix, 503, Cache, Rotation,
  stale-if-error, fehlende Konfiguration; die Token-Pflicht ist immer an).
- `export.test.mjs` — reiner Teil des Exports (`export.js`) ohne Browser:
  Feldauswahl, Datenschutz (keine Zugangs- und Standortdaten), Dateiname und
  lokale Zeit. Teilausfälle mit Warnung prüft `app.test.mjs`.
- `metrics.test.mjs`, `coach.test.mjs` — Ampeln und Kennzahlen; Coach-
  Eingabe, Hash, Cache-Entscheidung, Tageslimit (Anmeldefehler des Workers
  verbrauchen es nicht) und Fallback-Texte.
- `app.test.mjs` — startet Chromium gegen `http://127.0.0.1:8099`.
  Firebase wird durch einen localStorage-Stub ersetzt, die Strava-API
  durch feste Beispieldaten — es werden also keine echten Konten
  benötigt. Geprüft werden u. a.: Tagesansicht, Strava-Matching,
  Wochennavigation, Speichern und Wiederherstellen der Sätze,
  Verlaufs-Diagramme, Zeitzonenverhalten um Mitternacht, dass nichts
  horizontal aus dem Bild läuft, sowie das Plan-Laden (A1): JSON 404 mit
  und ohne gültige Kopie, eine ungültige oder fremd-versionierte Kopie,
  dass die Kopie beim normalen Laden wirklich geschrieben wird, und die
  Zustände außerhalb der Planwochen (vor Planstart, Rennlücke, nach dem
  Rennen).

Mit `SHOTS=./shots npm run test:app` werden zusätzlich Screenshots
abgelegt.

**Port 8099:** `app.test.mjs` verbindet fest mit `127.0.0.1:8099`. Vorher
`lsof -ti :8099` prüfen; ein Server aus einem anderen Worktree würde fremden
Code testen. Der Server muss aus dem Verzeichnis laufen, das getestet wird.

## Abdeckungs-Ledger (Stride, Auflage C8)

Das Ledger führt **Prüfabsichten**, die Zahl der Checks ist nur ein zweites Signal. `app.test.mjs`
druckt am Ende „Checks je Szenario“ (`scenario("…")` steht in der ersten Zeile jedes Blocks). Regel:
kein Szenario verschwindet, keine Absicht fällt weg. Aufgefüllt wird nicht, um eine Zahl zu halten.

Baseline: der Plan nennt 336 Checks; gemessen am Merge-Base `a6e6c4b` waren es **390** (Login und
Export kamen auf main nach dem Planstand dazu). Nach E1/E2 399, nach E3 **441**.

| Szenario | Prüfabsichten | a6e6c4b | E2 | E3 | Etappe |
| --- | --- | --- | --- | --- | --- |
| 1 | Kopf (Woche, Typ, Phase, Countdown 237 Tage, Planbalken); Lauf-Karte sofort bedienbar; Banner „nicht verbunden“ statt Dauer-Laden, Lauf-Karte ohne Ist-Block; Coach-Karte und vier Status-Zeilen sofort; Im Detail weg; kein `style=`; kein H-Scroll; keine Konsolenfehler; Wochen-Tab zeigt „Mit Strava verbinden“ | 12 | 12 | 16 | E3 |
| 2 | Längster Lauf des Tages (8,0 km); „im Plan“; Banner-Slot leer bei Verbindung; keine doppelten Einheiten; Pace, Ø HF, Dauer (zogen vom Heute-Kachelblock in den Lauf-Tag um, Karte zeigt nur km, Urteil, Name) | 6 | 6 | 9 | E3 |
| 2b | Krafttag-Karte mit Titel und Anzahl; „Training starten“; Vorschau 3 Zeilen + „+ 5 weitere“; Zeilen nicht antippbar; Einstieg öffnet Kraft-Tag; Zurück „Heute“; Fortschritt nach Speichern „1 von 8“ (Rest des Blocks: Kraft-Tag, E5) | 9 | 9 | 10 | E3 (bis Kraft-Tag) |
| 2c | Ampel Wochensoll/Detail, Belastung, Kraft rot + Detail, Easy; Info-Sheet über Tab-Leiste, Titel, Grenzwerte (42 Tage, 2 oder mehr), Fokus auf Titel, Escape + Fokus zurück; neu: Dialog-Rolle, Blockreihenfolge, Backdrop schließt | 22 | 22 | 20 | E3 |
| 2c-2 | Timer-Race: Schließen und sofort neu öffnen bleibt offen, Escape wirkt, hidden folgt; neu: Fokus zum letzten Auslöser. A→B / B→A mit zweitem Sheet folgt in E6 | 5 | 5 | 6 | E3 |
| 2c-4 | Tab-Leiste folgt dem Tab (Start, Woche, Tag aus Woche, Tag aus Heute, Zurück) | 6 | 6 | 6 | E3 |
| 2d | Coach: KI-Text als Text, kein XSS (Tag und Bilanz), ein daily/weekly-Request, gleicher Hash kein zweiter; neu: Montag offen ohne Auslöser | 9 | 9 | 10 | E3 |
| 2d-2 | Bilanz Di–So eingeklappt, Kurzform W1, per Tap auf, kein H-Scroll; neu: aria-expanded, Fokus | 5 | 5 | 6 | E3 |
| 2e, 2f | Coach-Fallback bei abgeschaltetem Worker; kein API-Aufruf bei unlesbarem Dokument, keine Fehlerkarte | 1, 3 | 1, 3 | 1, 3 | E3 |
| 20 | Rennlücke: kein „Woche 35“, neutrale Karte; neu: Kopf ohne Chip/Balken, „Diese Woche“ leer | 3 | 3 | 5 | E3 |
| 20b | Renntag in Woche 35, „Rennen heute“ | 3 | 3 | 3 | E3 |
| 21 | Nach Rennen: Kein Plan, kein Coach-Aufruf, Renndatum, neutrale Karte, fester Coach-Text; neu: Slot leer, Status mit Grund, „Zum Plan“ (go-tab) | 6 | 6 | 8 | E3 |
| 22 | Vor Planstart: Kein Plan, Woche 1 im Wochen- und Plan-Tab, 0 % | 4 | 4 | 4 | E3 |
| 25 | Plan-Hinweis und Strava-Redirect beide sichtbar (Toast, unverändert) | 2 | 2 | 2 | E3 |
| 28 | Strava-Fehler: Wochensoll nicht rot, nennt Quelle, Easy/Belastung grau, keine Wochenbilanz; neu: Fehlerbanner mit „Neu laden“ | 5 | 5 | 6 | E3 |
| 29 | Firestore-Ausfall: Kraft grau + Text, Easy rechnet, Coach ohne Dauer-Skelett, Adhärenz-Kachel „nicht geladen“ wird durch Fehlerbanner „Daten nicht geladen“ ersetzt | 7 | 7 | 7 | E3 |
| 35a–35g (neu) | Ruhetag mit/ohne „Morgen“; Long Run; „zu kurz“ 89 % / „im Plan“ 90 %; nachgeholt; Platzhalterwoche (mit/ohne Datum, Plan aus REAL_PLAN_JSON abgeleitet); Diese Woche (7 Tage, Zustände, Volumen, Tipp öffnet Woche); Escaping Laufname | – | – | 28 | E3 |
| 12 | Tab-Leiste klebt, Detailseiten ohne Leiste (E1 +9: Glas, Kapsel, Marke) | 4 | 13 | 13 | E1 |
| übrige (3–11, 13–19b, 23, 24, 24p, 26, 27, 30–33) | unverändert; nur Selektoren auf Heute angepasst (27, 24p, 23, 30b) | – | – | – | – |

**Bewusste Ausnahmen in 2c („Im Detail“, einzeln):** Wochenvolumen (8 Wochen, aktuelle Woche, kein Ist
in der Zukunft), Aerobe Effizienz (−15 s/km), Adhärenz (50 %, 3 von 6), „Nächster Long Run“,
„Nächste Woche: Aufbau“ ersetzt durch drei Checks „Im Detail ist weg, Coach/Ampeln unverändert“;
die Rechnungen bleiben über `metrics.test.mjs` abgedeckt. **Zieht um:** „Re-Kalibrierung: 28.10.“
aus dem Plan-Objekt wandert nach Woche („Tagesdetails folgen …“, E4) und fällt nicht weg; bis dahin
ist diese Absicht offen. Die Aerobe/Adhärenz-Rechnung für den Coach-Request bleibt in `app.js`.
