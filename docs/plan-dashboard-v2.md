# Umsetzungsplan: Dashboard v2 (Schritt 1)

Stand: 27.09.2026 · Planner · **verbindlich** (Architektur-Review eingearbeitet,
Entscheidungen E1–E7 von Louis am 27.09.2026 bestätigt: „alles ja“)
Grundlage: `docs/requirements-dashboard-v2.md` (FREIGEGEBEN), `docs/mockup-dashboard-v2.html`
(Optik), `docs/review-architecture-dashboard-v2.md` (Auflagen A1–A10). HANDOFF-v2 (Desktop)
gilt nur, wo das Requirements-Dokument nichts Abweichendes sagt. Die Weichen für
`docs/requirements-login.md` (1b) und `docs/requirements-marathon-coaching.md` (2) sind
berücksichtigt; beides wird hier nicht umgesetzt.

## Ziel

Die Plandaten wandern aus `plan.js` in `plans/hm-2027.json` (Stufe 1, Firestore-tauglich,
`week.sessions[]`). Alle Logik liest nur noch über Accessoren, die den Plan als Parameter
bekommen. Darauf entstehen der Starttab **Dashboard** (Kopfzeile, „Heute dran“, Coach, vier
Ampeln aus `metrics.js`, „Im Detail“), der neue **Wochen-Tab** und der **Coach** (täglich,
montags zusätzlich die Wochenbilanz) über `POST /coach` im bestehenden Worker, mit
Firestore-Cache und Regel-Fallback. Liegt ein Datum hinter dem Planende, zeigt die App
„Plan beendet“.

Die Umsetzung läuft in **zwei Meilensteinen**:

- **M1 – Plan als JSON (Ziel: ca. 19.10.2026 auf `main`).** Die App verhält sich wie
  vorher. M1 bekommt einen eigenen Durchlauf mit Run-Verify, Tests, Review, Security,
  Louis' Test und Commit. Die harte Frist 26.10. (ab dann werden die Wochen 9–31 in die
  JSON geschrieben) hängt damit nur noch an M1.
- **M2 – Dashboard, Wochen-Tab, Coach.** Baut auf dem gemergten M1 auf.

---

## Entschieden (nicht erneut fragen)

| Nr. | Entscheidung |
| --- | --- |
| E1 | Neue Firestore-Sammlungen `coach/{YYYY-MM-DD}` und `coachweek/{planId}_W{n}` mit `planId`, `text`, `generatedAt`, `inputHash`, `generations`, `model`, `promptVersion` (bei `coachweek` zusätzlich `week`). |
| E2 | `/coach` wie in Abschnitt 5 und A3. Louis legt einen **eigenen Workspace mit eigenem Key** an, Monatslimit **ca. 5 USD**. `/coach` wird **erst kurz vor dem M2-Merge** deployt, 1b folgt direkt danach. |
| E3 | Modell `claude-haiku-4-5` (Alias), `max_tokens` 200 täglich / 450 Wochenbilanz. |
| E4 | Ordner `plans/`, flache Module im Repo-Stamm. `app.js` wird nur teilweise zerlegt (bleibt bei ca. 900 Zeilen, bewusst akzeptiert). |
| E5 | Die letzte gültige Plandatei wird als Kopie in `localStorage` gehalten (A1). |
| E6 | Meilenstein M1 = Schritte 1–2 inkl. Versionsstempel. Er geht früh nach `main` (Ziel ca. 19.10.) und bekommt einen eigenen Verify-/Test-/Review-Durchlauf. |
| E7 | Datumsangaben nach der letzten Planwoche, aber vor dem Renndatum, bekommen einen generischen Zustand **„Bis zum Rennen“**. `validatePlan` erzwingt, dass ein bestätigtes Renndatum in den Planwochen liegt. |

Keine neuen npm-Abhängigkeiten. `wrangler` läuft nur über `npx`.

---

## 1. Datei-Map

Alle Browser-Module bleiben **flach im Repo-Stamm**. Grund: `tools/bump-version.mjs`
stempelt nur Importe der Form `./name.js`, und `tests/version.test.mjs` sammelt alle
`*.js` im Stamm ein (außer `worker.js`).

### Neu

| Datei | M | Inhalt |
| --- | --- | --- |
| `plans/hm-2027.json` | M1 | Plan-Objekt (Schema unten) |
| `plan-store.js` | M1 | `loadPlans()`: URL `new URL("./plans/hm-2027.json?v=<stempel>", import.meta.url)`, `fetch(url, { cache: "no-cache" })`, danach `validatePlan`. Kopie in `localStorage` (Schlüssel `plan.<id>`, wird nur bei gleichem `schemaVersion` genutzt). Fallback auf die Kopie mit dem Hinweis „Plan aus letzter Kopie“. `PlanLoadError` mit `source: "plan"`. Einzige Andockstelle für 1b. |
| `tests/fixtures/plan-legacy.mjs` | M1 | Die **alte `plan.js` unverändert** (A2), mit Datenstand Wochen 1–8. Sie liegt nicht im Stamm und ist deshalb vom Versionstest nicht betroffen. Bleibt bis zum Abschluss von Schritt 1 (Ende M2) liegen. |
| `tests/plan-golden.test.mjs` | M1 | Golden-Test pro Tag, alt gegen neu (A2) |
| `tests/stubs.test.mjs` | M1 | Stub-Wächter (A9): vergleicht die Exportnamen von `config.js` und `firebase-init.js` mit den Stubs in `app.test.mjs` |
| `tools/generate-plan-json.mjs` | M1 | Temporär: erzeugt die JSON aus den alten Generatoren. Wird am Ende von M1 gelöscht. |
| `metrics.js` | M2 | Reine Funktionen: `wochensoll`, `easyDisziplin`, `belastung`, `kraftProgression`, `adherence4w`, `aerobeEffizienz`, `weeklyVolume`, `worstStatus`. `THRESHOLDS` kommt als Parameter. Alle Zeitfenster laufen über ISO-Daten (A7). |
| `coach.js` | M2 | `buildDailyInput`, `buildWeeklyInput`, `hashInput` (kanonisches JSON + SHA-256), `decideGeneration`, `fallbackDaily`, `fallbackWeekly`, `requestCoach`, `weeklyDue` |
| `ui.js` | M2 | `esc`, `badge`, `ICONS`, `dayNameDE`, `shortDate`, `toast`, `errorCard`, `loadingCard`, Info-Sheet |
| `view-dashboard.js`, `view-week.js` | M2 | Rendering von Dashboard und Wochen-Tab |
| `tests/metrics.test.mjs`, `tests/coach.test.mjs`, `tests/worker.test.mjs` | M2 | Node-Tests ohne Browser |

### Geändert

| Datei | M | Änderung |
| --- | --- | --- |
| `plan.js` | M1 | Enthält nur noch Logik: `toISO/fromISO/addDays`, `slug` (Zeichen für Zeichen aus `app.js` übernommen), `weekStart(plan,w)`, `weekDates(plan,w)`, `weekNumberFor(plan,iso)` (liefert `null`, wenn das Datum in keiner Planwoche liegt), `weekOf`, `phaseOf`, `phaseRange` (abgeleitet), `sessionsFor(plan,week)`, `sessionOn(plan,iso)`, `planEnd`, `activePlanFor(iso,plans)`, `planDayState(iso,plans)` → `"woche"｜"bisZumRennen"｜"keinPlan"` (E7), `exerciseCatalog(plan)`, `validatePlan(plan)`, `formatGoal(goal)`. |
| `app.js` | M1 | `init()` wartet auf `loadPlans()`. Alle Plan-Zugriffe auf Modulebene (`state.weekNo`, `defaultHistoryExercise`, `exerciseCatalog`) wandern **nach** `loadPlans()` (A1). `dayInfo` nutzt `sessionOn`, `allPlanRunDays` nutzt `sessionsFor` + `km`. `null`-Wochen werden an allen Stellen behandelt (ehemals Zeilen 44, 53, 93, 147, 537, 764, 959, 1021, 1059); beim Log-Speichern wird nie `week: null` geschrieben. Der Plan-Tab zeigt Ziel und Rennen über `formatGoal`. `STRAVA_SINCE` wird aus `plan.start − 14` berechnet (wie bisher). |
| `app.js` | M2 | Tab `dashboard`; Router ruft die View-Module auf; `renderWeek`/`weekKm` entfallen |
| `tools/bump-version.mjs`, `tests/version.test.mjs` | M1/M2 | M1: Stempel auf die JSON-URL in `plan-store.js` plus Prüfung darauf; `plan-store.js` kommt in die MODULES-Liste. M2: die neuen Module ebenfalls eintragen. |
| `tests/plan.test.mjs` | M1 | Prüft die JSON-Datei und die Logik gegen die geladene Datei. Die 81 bestehenden Prüfungen werden übernommen; die Klemm-Checks werden zu `=== null`. |
| `tests/app.test.mjs` | M1/M2 | M1: JSON-Szenarien (A1); Stubs bleiben vollständig. M2: „Heute“-Checks ziehen aufs Dashboard um, dazu neue Szenarien. |
| `config.js` | M2 | `THRESHOLDS`, `WORKER_URL` (`STRAVA_WORKER_URL` bleibt als Alias), `COACH_URL`. Der `config.js`-Stub in `app.test.mjs` wird vollständig nachgezogen (A9 wacht darüber). |
| `firebase-init.js` | M2 | `loadAllDayPlans`, `loadCoach`, `saveCoach`, `loadCoachWeek`, `saveCoachWeek`; `FIREBASE_STUB` wird nachgezogen |
| `strava.js` | M2 | `since` = min(`plan.start − 35`, heute − 35); `per_page=200`, Abbruch bei `batch.length < 200`, höchstens 5 Seiten, mit Kommentar (A6) |
| `worker.js`, `wrangler.toml` | M2 | `/coach` (Abschnitt 5); Hinweis auf das neue Secret |
| `index.html` | M2 (D0) | D5-Icon-Fix; Tab `dashboard` |
| `style.css` | M2 (D0) | Tokens und Komponenten aus dem Mockup |
| `package.json` | M1/M2 | M1: `test:golden`, `test:stubs` in `npm test`. M2: `test:metrics`, `test:coach`, `test:worker`. |
| `README.md`, `HANDOFF.md`, `tests/README.md` | M1/M2 | Plandaten liegen jetzt in der JSON; nach JSON-Änderungen `npm run version`; neue Tests |

### Plan-Objekt (`plans/hm-2027.json`, `schemaVersion: 1`)

```json
{
  "id": "hm-2027", "schemaVersion": 1, "fileVersion": "2026-10-05T10:00",
  "goal": { "distance": "Halbmarathon", "distanceKm": 21.0975, "targetTime": "1:29:59",
            "targetPace": "4:16 /km", "raceDate": "2027-04-11", "raceDateConfirmed": false },
  "start": "2026-08-31", "totalWeeks": 31, "detailedUntilWeek": 8,
  "recalibrationDates": ["2026-10-25"],
  "zones": [ { "id": "z2", "zone": "Z2 – Easy", "hfMin": 148, "hfMax": 163,
               "hf": "148–163", "pace": "6:10–6:35 /km", "use": "Grundlage", "tone": "teal" } ],
  "phases": [ { "n": 1, "name": "Basis", "weeks": { "from": 1, "to": 8 },
                "focus": "Volumenaufbau, Maximalkraft", "tone": "teal" } ],
  "weeks": [
    { "n": 4, "start": "2026-09-21", "phase": 1, "weekType": "Entlastung", "deload": true,
      "focus": "…", "plannedKm": 24, "placeholder": false,
      "sessions": [
        { "date": "2026-09-21", "kind": "lauf", "type": "Easy run", "shortType": "Easy",
          "dist": "7 km", "km": 7, "pace": "6:15–6:40 /km", "hf": "148–160 bpm", "hfMax": 160 },
        { "date": "2026-09-22", "kind": "kraft", "label": "Full Body A", "shortLabel": "FB A",
          "exercises": [ { "name": "Squats", "soll": "2x8 (Deload)", "hint": "…" } ] } ] },
    { "n": 9, "start": "2026-10-26", "phase": 2, "weekType": "Aufbau", "deload": false,
      "focus": "Schwelle, Plyometrie", "placeholder": true }
  ]
}
```

Nicht gespeichert, sondern abgeleitet: `end`, `dateRange`, `phase.range`, der Ziel-Text im
Plan-Tab. `hfMax` je Lauftyp: Easy 163, Easy-Deload 160, Long 160, Recovery 148.

**`validatePlan`** (wird von `plan-store.js` und von den Tests genutzt) prüft:
- Pflichtfelder und Typen;
- lückenlose Wochen `1…totalWeeks`, jede `start` = `start + 7·(n−1)`;
- alle Einheiten liegen in ihrer Woche;
- keine Arrays in Arrays;
- `fileVersion` passt auf `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/`;
- `placeholder` ist genau dann gesetzt, wenn `n > detailedUntilWeek`;
- bei `raceDateConfirmed: true` liegt `raceDate` in einer Planwoche (A8/E7).

Bekannte Grenze für Schritt 2: `runlinks/{datum}` geht von einem Lauf pro Tag aus.

---

## 2. Meilenstein M1 – Plan als JSON (verhaltenserhaltend)

**Umfang:** Schritte 1–2 plus die Auflagen A1, A2, A8 (Logik und Validierung), A9 und der
Versionsstempel auf die JSON-URL.
**Kein** Teil von M1: `THRESHOLDS`, `metrics.js`, Strava-Änderungen, jede UI-Änderung
(auch Tokens und Icon). Einzige sichtbare Änderung: Ziel und Rennen im Plan-Tab kommen
jetzt aus `formatGoal`. Die Textabweichung wird im Test bewusst angepasst und nicht als
Regression gewertet.

### Arbeitspakete für den coder (in dieser Reihenfolge)

**M1-1 – Sicherheitsnetz zuerst.**
- `tests/fixtures/plan-legacy.mjs` anlegen (Kopie der heutigen `plan.js`).
- `tests/stubs.test.mjs` schreiben (A9): Exportnamen per Regex aus `config.js` und
  `firebase-init.js` gegen die Stub-Strings in `app.test.mjs` vergleichen.
- Beides in `npm test` aufnehmen.

*Abnahme:* Der Stub-Wächter ist grün. Einmal testweise einen Export aus dem Stub entfernen:
Der Test wird rot. Alle 81 + 141 bestehenden Checks bleiben grün.

**M1-2 – JSON erzeugen, App unverändert.**
- `tools/generate-plan-json.mjs` erzeugt `plans/hm-2027.json`, inklusive `km`, `hfMax`,
  `weekType`, `plannedKm`, `sessions[]` und Phasen im Format `{from,to}`.
- `tests/plan.test.mjs` prüft die JSON über `validatePlan`. Die 81 Prüfungen werden
  übertragen; neu kommen Array-in-Array, `fileVersion`-Format, Konsistenz von
  `placeholder`/`detailedUntilWeek` und die Renndatum-Regel dazu (mit einer Negativ-Fixture
  `raceDateConfirmed: true` außerhalb der Wochen).

*Abnahme:* Die JSON ist valide, und `npm test` ist grün, während die App noch die alte
`plan.js` nutzt.

**M1-3 – Umschalten.**
- `plan-store.js` anlegen (A1: URL über `import.meta.url`, `no-cache`, Kopie in
  `localStorage`, Hinweis „Plan aus letzter Kopie“, Fehlerkarte nur, wenn es keine Kopie
  gibt).
- `plan.js` auf reine Logik umstellen (inkl. `planDayState`, `formatGoal`, `slug`).
- `app.js`:
  - Top-Level-Zugriffe wandern in `init()`;
  - Platzhalter anzeigen, bis der Plan geladen ist;
  - `null`-Wochen überall behandeln; in der Tagesansicht zeigen Tage im Zustand
    `bisZumRennen` bzw. `keinPlan` eine neutrale Karte statt „Woche 31“.
- `bump-version` und `version.test` um die JSON-URL und `plan-store.js` erweitern.
- Generator löschen; Doku anpassen.

*Abnahme:*
- `plan.js` enthält keine Plandaten (grep nach `"Squats"` und `runDist`).
- `plan-golden.test.mjs` (A2) ist grün, für **jeden Tag vom 24.08. bis 31.10.2026**:
  - Wochen 1–8: `sessionOn` liefert dieselbe Einheit wie das alte `dayInfo` (Art, Datum,
    Titel/Label, Distanz, Pace, HF, Übungsnamen, Soll, Hinweise, Notiz);
  - 26.–31.10.: auf beiden Seiten Platzhalter;
  - 24.–30.08.: neu `keinPlan` (bewusste Abweichung, alt: auf Woche 1 geklemmt).
- `slug(name)` ist für jede Übung im Katalog identisch zum alten `slug`. Damit bleiben die
  Log-IDs `logs/{datum}_{slug}` gültig.
- `version.test` prüft den Stempel auf der JSON-URL.
- Kein Browser-Check wurde gestrichen; umgezogene Checks sind im Diff einzeln
  nachvollziehbar.
- Neue Browser-Checks:
  - JSON 404 **mit** Kopie → App läuft, Hinweis „Plan aus letzter Kopie“, Satz speichern
    funktioniert;
  - JSON 404 **ohne** Kopie → Fehlerkarte „Plan konnte nicht geladen werden“, nicht als
    Strava- oder Firebase-Fehler;
  - kaputte JSON → wie 404;
  - simuliertes Datum 07.04.2027 → kein „Woche 31“, Zustand „Bis zum Rennen“;
  - Datum nach dem Renntag → „Kein aktiver Plan“.

**M1-4 – Ausliefern vorbereiten.**
`npm run version`, `npm test` komplett grün, lokal mit `npm run serve` klicken
(Heute, Woche 1/4/8/9, Verlauf, Plan). Commit(s) auf Deutsch.

### frontend-designer parallel zu M1?

**Ja.** D0 (siehe M2) kann parallel laufen, ohne dass sich Dateien überschneiden. D0 ändert
nur `style.css` und die Tab-Icon-SVG-Zeilen in `index.html`. M1 ändert weder `style.css`
noch das Markup von `index.html`; `npm run version` schreibt dort nur die `?v=`-Stempel.
Dafür gelten drei Regeln:
- D0 arbeitet auf einem eigenen Branch (`dashboard-v2-ui`) und führt **kein**
  `npm run version` aus.
- D0 wird erst **nach** dem M1-Merge auf den M2-Branch gebracht.
- M1 geht ohne D0-Änderungen nach `main`, weil M1 optisch unverändert bleiben soll.

### Agenten-Reihenfolge M1

1. coder: M1-1 → M1-2 → M1-3 → M1-4 (parallel dazu der frontend-designer mit D0 auf dem
   eigenen Branch)
2. run-verifier
3. test-runner
4. reviewer
5. security-checker (Schwerpunkt: `localStorage`-Kopie, keine Secrets)
6. Louis testet (iPhone-Home-Bildschirm und MacBook: sieht aus wie vorher, Satz-Logging,
   Flugmodus-Test mit Kopie)
7. Commit
8. **Push/PR nach `main` erst auf Louis' Ansage.** Ziel ist ca. 19.10.2026.

---

## 3. Meilenstein M2 – Dashboard, Wochen-Tab, Coach

Voraussetzung: M1 ist auf `main`, und der M2-Branch ist darauf aufgebaut. Nach jedem
Schritt startet die App und `npm test` ist grün.

**D0 – frontend-designer: CSS-Port** (kann schon parallel zu M1 laufen).
- Tokens `--ok-*`, `--danger-*`, `--soll-fill` und `--text-muted` dark `#918f87`.
- Mockup-Komponenten: Dashboard-Karten, Ampel mit Formen, Info-Sheet mit mindestens
  44 px Trefferfläche, Soll/Ist-Balken mit Legende, Coach-Karte ein- und ausgeklappt,
  Wochen-Tab-Tagesliste auf dem bestehenden Abstandsraster.
- D5-Icon-Fix (alle Icons prüfen).
- Kurze Markup-Referenz je Komponente.

*Abnahme:* Soll/Ist-Kontrast mindestens 3:1 in Hell und Dunkel, gemessen und notiert;
das Plan-Icon zeigt seine Punkte.

**M2-3 – `metrics.js` + `THRESHOLDS` + Datenzugänge.** (coder)
- `metrics.js`, `THRESHOLDS` in `config.js` und `loadAllDayPlans`; der `config.js`-Stub
  wird vollständig nachgezogen.
- Strava: `since`, `per_page` und Paginierung nach A6.
- Alle Fenster (7/28/42 Tage) laufen über `addDays`/`daysBetween`, nie über
  Millisekunden-Arithmetik (A7).

*Abnahme:* Die Node-Tests zeigen jede Ampel einmal grün, gelb, rot und grau. Außerdem
grün:
- ein nachgeholter Lauf zählt;
- die Belastung ist unter 4 Wochen Daten grau und rechnet auch ohne Plan;
- Kraft-Progression mit Deload-Woche und dem Soll-Wechsel W3→W5 (keine Stagnation);
- zwei Einheiten in Folge unter Soll ergeben Rot;
- Ampel und `suggestProgression` sind konsistent;
- eine Änderung in `THRESHOLDS` kippt den Status;
- **die Fenster rechnen über den 25.10.2026 und den 28.03.2027 hinweg richtig** (A7);
- ein Strava-Stub mit 200 + 13 Aktivitäten holt 2 Seiten (A6);
- die Kraftwerte werden gegen Louis' echte Logs aus W1–4 plausibilisiert (Export nur
  lokal, nicht committen).

**M2-4 – Dashboard-Gerüst.** (coder)
- `ui.js` herauslösen.
- Tab „Dashboard“ als Starttab.
- Kopfzeile mit Wochentyp, Phasen-Badge und Countdown („Datum offen“ oder „Noch X
  Wochen/Tage“).
- „Heute dran“ in allen Varianten: Kraft mit „Starten“ → Übungsliste → bestehende
  Kraft-Tagesansicht und zurück; Lauf mit Ist-Werten über `assignRuns`; Ruhe;
  Platzhalter.
- Coach, Ampeln und „Im Detail“ zunächst als graue Platzhalter.
- Die Zustände „Bis zum Rennen“ (E7) und „Plan beendet“ (F7) werden gerendert.
- Ein Firebase-Ausfall leert das Dashboard nicht.

*Abnahme:*
- Die Checks der alten „Heute“-Ansicht sind umgezogen, keiner wurde gestrichen.
- Das Dashboard rendert vor Strava.
- Die Satz-Eingabe aus „Heute dran“ speichert wie bisher.
- Datum nach Planende → „Plan beendet“; 07.04.2027 → „Bis zum Rennen“.
- 390×844 ohne seitliches Scrollen.

**M2-5 – Vier Ampeln und Info-Sheets.** (coder)
- Status, Detailzeile und Form je Ampel.
- Info-Sheets an allen vier Ampeln und an „Aerobe Effizienz“; die Werte kommen aus
  `THRESHOLDS`; `aria-label` und Tastaturbedienung.
- Ohne Plan und im Zustand „Bis zum Rennen“: drei Ampeln grau, die Belastung rechnet.

*Abnahme:*
- Je Ampel mindestens ein Zustand, der nicht grau ist.
- Anzeige im Format „Verhältnis 0,72“.
- Das Sheet lässt sich per Tastatur öffnen und schließen.
- Ändert sich der Stub-Schwellwert, ändert sich die Zahl im Sheet.

**M2-6 – „Im Detail“.** (coder)
- Wochenvolumen Soll/Ist: Platzhalterwochen ohne Balken; ein Ist von 0 zeichnet keinen
  Rest-Balken.
- Aerobe Effizienz mit der Z2-Zone aus dem Plan.
- Adhärenz über 4 Wochen.
- „Als Nächstes“ mit `recalibrationDates`.
- Nach Planende bleibt nur die Effizienz-Karte.

*Abnahme:* Die Werte stimmen mit den Stub-Daten überein; die Legende ist vorhanden.

**M2-7 – Wochen-Tab.** (coder)
- `view-week.js` mit Navigation `1…totalWeeks`.
- Außerhalb des Plans: letzte Planwoche mit dem Hinweis „Plan beendet“.
- Alle Status-Symbole inklusive „nachgeholt“; Details aufklappen; Weg in die
  Tagesansicht; Ruhetage sind nicht antippbar.

*Abnahme:* Die alten Navigations-Checks sind übertragen; je Status-Symbol gibt es einen
Check.

**M2-8 – Worker `POST /coach`.** (coder, parallel zu 4–7 möglich; **noch nicht deployen**,
siehe E2)

*Abnahme:* `tests/worker.test.mjs` prüft:
- 403 bei falschem oder leerem Origin, ebenso bei leerem `ALLOWED_ORIGINS`;
- 413 ab einem Body über 8192 Byte (auch ohne `Content-Length`);
- 400 bei unbekanntem `kind`, Zusatzfeldern, Zeilenumbruch oder unerlaubtem Zeichen in
  einem String-Feld, bei zu langen Strings oder Arrays und bei falschen Enums;
- der System-Prompt ist fest und enthält den Zielsatz aus `goal`; die Eingabe steht
  als markierter JSON-Datenblock in der User-Nachricht;
- 500, wenn der Key fehlt;
- 502 bei Upstream-5xx oder -401 (401 wird intern unterscheidbar geloggt), bei
  `refusal` und bei leerem Text;
- `max_tokens` führt zum Kürzen auf den letzten vollständigen Satz;
- `/exchange` und `/refresh` verhalten sich unverändert.

**M2-9 – `coach.js` täglich.** (coder)
- **9a:** Regel-Fallback nach der schlechtesten Ampel (Rot vor Gelb vor Grün; bei
  Gleichstand Belastung → Easy → Wochensoll → Kraft), mit eigenen Kraft-Bausteinen.
- **9b:** Schema `daily`, Hash und `coach/{datum}` nach A4:
  - `generations` zählt Versuche und wird **vor** dem API-Aufruf geschrieben;
  - kann das Dokument nicht gelesen oder geschrieben werden, gibt es keinen Aufruf;
  - ist das Limit erreicht, erscheint der letzte KI-Text des Tages, sonst der Fallback;
  - `model` und `promptVersion` werden mitgespeichert.
- Coach-Fehler erscheinen nie als Fehlerkarte. Texte werden nur über `esc()` bzw.
  `textContent` gerendert (A5).
- Ohne aktiven Plan und im Zustand „Bis zum Rennen“ gibt es keinen Aufruf.

*Abnahme:*
- Node: der Hash bleibt bei geänderter Schlüsselreihenfolge stabil; Limit 3 und Zählung
  vor dem Aufruf; Fallback-Priorität.
- Browser:
  - bei gleichem Hash kein zweiter Request;
  - ist der Worker abgeschaltet, erscheint der Fallback;
  - das Coach-Dokument ist nicht lesbar → 0 Requests;
  - ein Stub-Text `<img src=x onerror=…>` wird als Text angezeigt (A5);
  - nach Planende 0 Requests.

**M2-10 – Wochenbilanz montags.** (coder)
- Schema `weekly`; wird erst ausgelöst, wenn Strava geladen ist.
- `coachweek/{planId}_W{n}` nach A4, Limit 2.
- Regel-Kurzbilanz als Fallback.
- Montags ausgeklappt, dienstags bis sonntags eingeklappt als „Wochenbilanz W3“.

*Abnahme:*
- Node: `weeklyDue` (Montag, später in der Woche, nicht ohne Strava); Limit 2.
- Browser: montags ausgeklappt mit Kraft-Trend, dienstags eingeklappt und aufklappbar,
  Escaping wie in 9.

**M2-11 – Feinschliff und Abnahme-Vorbereitung.**
- frontend-designer: Vergleich mit dem Mockup in Hell und Dunkel, auf Handy und Laptop.
  Die Fensterbreite wird dabei tatsächlich verändert, nicht nur das CSS gelesen.
- coder: Doku, `tests/fixtures/plan-legacy.mjs` samt Golden-Test entfernen oder bewusst
  behalten (im Review entscheiden), `npm run version`, `git grep -n "sk-ant"`.

*Abnahme:* Alle Success Metrics des Requirements-Dokuments sind abgehakt, außer Louis'
manuellem Test.

**Agenten-Reihenfolge M2:**
1. frontend-designer D0 (falls noch nicht fertig)
2. coder M2-3 bis M2-10
3. frontend-designer M2-11, danach coder M2-11
4. run-verifier
5. test-runner
6. reviewer
7. security-checker
8. Deploy `/coach` (Abschnitt 6)
9. Louis testet
10. Commit
11. Push auf Ansage, danach sofort 1b

Rollen: Der **frontend-designer** ändert nur `style.css`, die Icons in `index.html` und die
Markup-Referenz. Der **coder** übernimmt Logik und Render-Funktionen mit den
Designer-Klassen, ohne eigene Styles und ohne Inline-CSS in neuem Code.

---

## 4. Firestore-Dokumente (E1)

| Pfad | Felder |
| --- | --- |
| `coach/{YYYY-MM-DD}` (lokales Datum) | `planId`, `text`, `generatedAt` (ms), `inputHash`, `generations` (Versuche, Limit 3), `model`, `promptVersion` |
| `coachweek/{planId}_W{n}` | `planId`, `week`, `text`, `generatedAt`, `inputHash`, `generations` (Limit 2), `model`, `promptVersion` |

- Fallback-Texte werden nicht gespeichert.
- Die bestehenden Regeln decken beide Sammlungen ab; die UID-Regel aus 1b ebenfalls.
- Die Limits gelten nur in der App. Mit zwei Geräten kann ein Limit um 1–2 überschritten
  werden; das ist akzeptiert.

## 5. Worker-API `POST /coach` (E2, A3)

- **Request:** Der Body wird als Text gelesen; über 8192 Byte → 413; danach `JSON.parse`.
  Akzeptiert werden genau zwei Schemas:
  - `kind: "daily"` mit folgenden Feldern:
    - `date` (ISO), `week` (1–60), `weekType`, `phase` (Strings bis 40 Zeichen);
    - `goal { distance ∈ ["Halbmarathon","Marathon","10 km"], targetTime /^\d:\d\d:\d\d$/, raceMonth 1–12, raceDateConfirmed }`;
    - `today { type ∈ Kraft|Lauf|Ruhe|Offen, name ≤ 60, done }`;
    - `checkpoints { wochensoll, easy, belastung, kraft }`, je `{ status ∈ gruen|gelb|rot|grau, detail ≤ 80 }`;
    - `next ≤ 60`, `aerobeEffizienzTrend ≤ 40 | null`.
  - `kind: "weekly"`: Schema aus dem Requirements-Dokument; `easyOverLimit` höchstens 7,
    `progression` höchstens 12 Einträge; Kraft-Status ∈ steigt|haelt|stagniert|unterSoll.

  Regeln für alle Felder:
  - Die Feldnamen sind eine Whitelist; alles andere → 400.
  - Freie String-Felder: keine Zeilenumbrüche. Erlaubt sind nur Buchstaben inkl. Umlaute,
    Ziffern, Leerzeichen und `.,:;/()+-–×%°'`; sonst 400.
- **Prompt:**
  - Der System-Prompt (Text aus HANDOFF-v2 C7) steht fest im Worker. Nur der Zielsatz
    wird aus validierten Enum-/Regex-Werten zusammengesetzt.
  - Die Eingabe steht als JSON in einem klar markierten Datenblock der User-Nachricht.
  - `promptVersion` ist eine Konstante im Worker und wird in der Antwort mitgeliefert.
- **Response 200:** `{ "text", "kind", "model", "promptVersion" }`.
- **Fehler** haben die Form `{ "error", "message" }`:

  | Status | Code |
  | --- | --- |
  | 400 | `invalid_input` |
  | 403 | `origin_not_allowed` |
  | 404 | unbekannter Pfad |
  | 405 | `method_not_allowed` |
  | 413 | `too_large` |
  | 500 | `not_configured` |
  | 502 | `upstream_error` |

  Upstream-Fehler, insbesondere 401 (falscher Key), werden per `console.log` unterscheidbar
  geloggt (`wrangler tail`). Der Client wechselt bei jedem Status außer 200 auf den
  Fallback, ohne erneuten Versuch.
- **Messages API** (geprüft mit der claude-api-Referenz, Stand 2026-06-24):
  - Aufruf: `POST https://api.anthropic.com/v1/messages`, Header `x-api-key`,
    `anthropic-version: 2023-06-01`, `content-type: application/json`.
  - Modell `claude-haiku-4-5` als **eine** Konstante; `max_tokens` 200 / 450; kein
    `thinking`.
  - Gelesen werden nur `text`-Blöcke; `stop_reason` wird geprüft.
  - Aufruf per `fetch` ohne SDK: Der Worker hat keinen Bundler, das SDK wäre eine neue
    Abhängigkeit.
- **Modellbegründung (A10):** Alias `claude-haiku-4-5` und Snapshot
  `claude-haiku-4-5-20251001` bezeichnen dasselbe Modell und werden gemeinsam
  stillgelegt. Der Alias springt auch nicht auf eine neue Generation. Gewählt ist der
  Alias, weil die Referenz Aliase empfiehlt und er gleichwertig ist. Den eigentlichen
  Schutz gegen eine Stilllegung bieten drei Dinge:
  - das Modell ist **eine Konstante** (ein Wechsel = eine Zeile + Deploy);
  - eine Stilllegung führt über den 502 sauber auf den **Regel-Fallback**;
  - Louis achtet auf die **Deprecation-Mails** der Console.
- **CORS:** Nur Origins aus `ALLOWED_ORIGINS` sind erlaubt; ist die Liste leer, wird
  abgelehnt. Allow-Headers: `Content-Type`. `checkAccess(request, env)` ist der
  Einhängepunkt für die ID-Token-Prüfung aus 1b.
  Ehrlicher Kommentar im Code: Der Origin-Check stoppt keine Anfragen außerhalb eines
  Browsers. Die harte Grenze ist das Ausgabenlimit (E2).

## 6. Deploy und was Louis selbst tut

**M1:** Kein Worker-Deploy. `npm run version` → Commit → Push/PR nur auf Louis' Ansage →
GitHub Pages. Wichtig für später: Nach **jeder** JSON-Änderung (Wochen 9–31,
Renndatum) `npm run version` ausführen. `no-cache` fängt ein Vergessen ab, ersetzt den
Stempel aber nicht.

**M2:**
1. **Louis:** In der Claude Console einen **eigenen Workspace nur für diese App** anlegen,
   darin einen eigenen API-Key erstellen, Guthaben aufladen und ein Monatslimit von
   **ca. 5 USD** setzen.
2. **Louis, kurz vor dem M2-Merge:** `! npx wrangler secret put ANTHROPIC_API_KEY` (den Key
   nur in den Prompt eingeben, nie in Chat oder Repo). Mit `npx wrangler secret list`
   prüfen, dass `ALLOWED_ORIGINS` gesetzt ist.
3. `npx wrangler deploy`. Die Strava-Endpunkte funktionieren danach unverändert.
   Smoke-Test mit `curl`:
   - richtiger Origin → 200;
   - falscher Origin → 403;
   - kaputtes Schema → 400;
   - Strava neu verbinden funktioniert weiterhin.
4. `npm run version`, `npm test`, Commit, Push/PR auf Louis' Ansage.
5. **1b direkt danach.** Bis dahin sind `/coach` und Firestore nur durch den Origin-Check,
   das Ausgabenlimit und die anonyme Anmeldung geschützt. Das Repo ist öffentlich.

Lokal lehnt der Live-Worker `127.0.0.1:8099` ab; lokal erscheint deshalb der Fallback. Die
Browser-Tests stubben `/coach`.

## 7. Risiken

- **Zeit:** M1 bis ca. 19.10. ist der kritische Pfad; M2 hat keine harte Frist. Wochen
  9–31 sind nicht Teil dieses Plans.
- **Schlüssel-tragende Namen:** Übungsnamen und `slug()` bestimmen die Log-IDs. Das
  Golden-Test-Paket in M1-3 schützt davor.
- **Test-Umzug in M2-4:** Viele „Heute“-Checks ziehen um. Es wird keiner gestrichen, und
  der Diff muss jeden Umzug nachvollziehbar zeigen.
- **Kraft-Schwellen sind ein erster Wurf:** Sie werden in M2-3 gegen echte Logs geprüft.
  Bei Dauer-Gelb werden die Schwellen angepasst, nicht die Logik.
- **Missbrauch von `/coach` bis 1b:** Er ist über den eigenen Workspace auf ca. 5 USD pro
  Monat begrenzt (E2).

## 8. Offene Fragen

Keine. E1–E7 sind entschieden, A1–A10 eingearbeitet.

Aufwand: **M1 klein bis mittel** (4 Arbeitspakete, 1–2 Sitzungen). **M2 mittel bis hoch**
(D0 + 8 Arbeitspakete, 3–4 Sitzungen).
