# Tests

Die App selbst braucht keinen Build-Step — diese Tests sind nur für die
Entwicklung.

```bash
npm install            # http-server + playwright
npx playwright install chromium

npm run serve          # in einem zweiten Terminal: Server auf :8099
npm test               # Plan-Daten + Browser-Tests
```

- `plan.test.mjs` — prüft `plans/hm-2027.json` direkt (Struktur, lückenlose
  Wochen, Wochentage der Kraft-/Lauftage, Platzhalterwochen, `validatePlan`
  inkl. Negativ-Fixturen) sowie die reine Logik aus `plan.js`:
  `weekNumberFor`/`weekDates` (inkl. beider Zeitumstellungen im Plan),
  `planDayState`/`activePlanFor` an den Grenzen, `formatGoal`, `phaseRange`.
- `plan-golden.test.mjs` — Sicherheitsnetz für den M1-Umbau (A2): vergleicht
  für jeden Tag vom 24.08. bis 31.10.2026 die neue Logik
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
