# Tests

Die App selbst braucht keinen Build-Step — diese Tests sind nur für die
Entwicklung.

```bash
npm install            # http-server + playwright
npx playwright install chromium

npm run serve          # in einem zweiten Terminal: Server auf :8099
npm test               # Plan-Daten + Browser-Tests
```

- `plan.test.mjs` — prüft die Plan-Daten ohne Browser: Wochennummern
  (inkl. Zeitumstellung), Wochentage der Kraft-/Lauftage, Vollständigkeit
  der Wochen 1–31.
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
  Verlaufs-Diagramme, Zeitzonenverhalten um Mitternacht und dass nichts
  horizontal aus dem Bild läuft.

Mit `SHOTS=./shots npm run test:app` werden zusätzlich Screenshots
abgelegt.
