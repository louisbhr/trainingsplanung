# Code-Review M1 – Plan als JSON (Dashboard v2, Schritt 1)

Stand: 27.09.2026 · Branch `dashboard-v2-m1` · Diff `820386f..HEAD` (733f2f6 … ba2ab00)
Maßstab: docs/plan-dashboard-v2.md (M1, A1/A2/A8/A9), docs/review-architecture-dashboard-v2.md,
HANDOFF.md, CLAUDE.md.

**Urteil (Runde 2): freigegeben.** K1, I1–I3, S1 sowie M2, M3, M4 und M6 sind behoben und
im Code nachgeprüft. Offen sind nur die bewusst zurückgestellten Minor-Punkte M1 und M5.
Runde 1 hatte noch 1 kritischen Befund, Details unten im Abschnitt „Runde 2“.

## Selbst geprüft (nicht aus Selbstberichten übernommen)

- `npm test` mit `npm run serve` (:8099) selbst gelaufen: alle Node-Tests und 151/151
  Browser-Checks grün.
- Eigener Tiefenvergleich alt ↔ neu (Wegwerf-Skript, nicht committet), jeder Tag vom
  31.08.2026 bis 04.04.2027: `weekNumberFor` identisch; `sessionOn` ↔ altes `dayInfo`
  unterscheidet sich **nur additiv** (`km`, `hfMax` neu; `note: null` → fehlt).
  Außerdem gleich: `km === parseFloat(dist)` für alle Läufe (Strava-Zuordnung),
  `plannedKm` gleich der alten `weekKm`, `phaseRange` gleich den alten hartkodierten
  Zeiträumen, Platzhalter-`focus`, Phase je Woche, Übungskatalog (Namen, Reihenfolge,
  `firstWeek`). Zonen nur additiv (`id`, `hfMin`, `hfMax`).
- Firestore-IDs: `logs/{datum}_{slug}`, `dayplans/{datum}`, `runlinks/{datum}` sind
  unverändert. `slug()` wurde Zeichen für Zeichen übernommen, die Übungsnamen sind
  identisch. Das Feld `week` in Logs hat für jeden Krafttag denselben Wert wie vorher.
  `week: null` wird nirgends geschrieben: Im Fall `null` fällt das Feld weg, und
  `saveLog` nutzt `merge: true`. Deshalb geht dabei auch kein bestehender Wert
  verloren.
- Race conditions: `render()` kehrt zurück, solange `plans` leer ist. Tab-Klicks
  während des Ladens sind harmlos, weil `init()` danach mit dem gewählten Tab rendert.
  Der Strava-Redirect läuft erst nach dem Plan-Laden (siehe M3).
- Browser-Proben (Wegwerf-Skript): Beim normalen Laden entsteht die
  localStorage-Kopie (22 KB). Vor Planstart zeigen der Wochen- und der Plan-Tab
  „Woche 31“ (siehe I3). Nach dem Rennen gibt es in keinem Tab Konsolenfehler.

## Stufe 1 – Spec-Abweichungen (keine Code-Defekte)

- **S1 Doku nicht angepasst** (Plan M1-3: „Generator löschen; Doku anpassen“).
  `README.md:111` beschreibt `plan.js` noch als „Trainingsplan; Daten werden aus
  `PLAN_START` berechnet“. `README.md:123-125` sagt, die Wochen 9–31 kämen „wie Woche
  1–8 in `plan.js`“. Das ist genau die Arbeit ab 26.10., und sie gehört jetzt in
  `plans/hm-2027.json`. Außerdem fehlen `plan-store.js` und `plans/` in der
  Dateitabelle. `tests/README.md` kennt `plan-golden.test.mjs` und `stubs.test.mjs`
  nicht und beschreibt `plan.test.mjs` veraltet. `HANDOFF.md:95` nennt noch „alle fünf
  Testläufe“, es sind jetzt sieben. Die Falle „nach jeder JSON-Änderung
  `npm run version`“ steht nur als Code-Kommentar in plan-store.js. Sie gehört in die
  Fallen-Liste von HANDOFF.md.
- **S2 A1 „letzte gültige Kopie“**: Die Kopie wird vor der Nutzung nicht validiert,
  siehe K1. Das ist gleichzeitig eine Spec-Abweichung und der kritische Befund.

Alles Übrige aus M1 ist umgesetzt: JSON, `plan.js` ohne Daten (kein „Squats“/`runDist`),
`import.meta.url` + `?v=` + `no-cache`, Stempel in bump-version und version.test,
Top-Level-Zugriffe in `init()`, `bisZumRennen`/`keinPlan`, Golden-Test 24.08.–31.10.,
Stub-Wächter, 5 neue Browser-Szenarien, kein Browser-Check gestrichen, Generator gelöscht.

## Stufe 2 – Code-Qualität

### Critical

- **K1 Ungültige localStorage-Kopie lässt die App dauerhaft hängen** –
  `plan-store.js:37-45` (`readCache`) und `app.js:1148-1150` (`init`).
  `readCache` prüft nur `schemaVersion`, nicht `validatePlan`. Wenn der Abruf scheitert
  (also im Funkloch, genau dem Fall, für den A1 gedacht ist) und die Kopie zwar
  `schemaVersion: 1` hat, aber nicht zur Form passt, die der Code erwartet, wirft
  `init()` *nach* dem try-Block (`weekNoForTab` → `plan.totalWeeks`/`weeks`). Das
  Ergebnis ist eine unbehandelte Promise-Rejection. Der Bildschirm bleibt dauerhaft
  bei „Plan wird geladen …“, ohne Fehlerkarte und ohne „Neu laden“, und alle Tabs sind
  tot. Per Browser-Probe reproduziert (Kopie `{schemaVersion:1,id:"hm-2027"}` + JSON
  404). Realistisch wird das ab M2: Neue Pflichtfelder kommen ohne
  `schemaVersion`-Sprung, eine alte Kopie wird im Gym mit neuem Code geladen.
  **Fix:**
  1. In `readCache` zusätzlich `validatePlan(plan).length === 0` verlangen, sonst
     `null` zurückgeben. `validatePlan` ist in plan-store.js schon importiert.
  2. In `init()` die Zeilen nach `loadPlans()` (`state.weekNo`, `historyExercise`,
     `STRAVA_SINCE`) mit in den try-Block nehmen, damit jeder Fehler dort die
     Fehlerkarte zeigt.
  3. Browser-Check: JSON 404 + Kopie mit passender `schemaVersion`, aber ungültig →
     Fehlerkarte „Plan konnte nicht geladen werden“.

### Important

- **I1 Neue Plan-Logik ohne Unit-Tests; alte DST-/Wochennummer-Tests entfallen** –
  `tests/plan.test.mjs`. Die Prüfungen `weekNumberFor("2026-10-26") === 9` (nach der
  Zeitumstellung), `weekDates(9)[0]`, „Woche hat 7 Tage“ und „vor Planstart/nach
  Planende“ sind ersatzlos gestrichen. Für die neuen reinen Funktionen fehlt jeder
  Node-Test:
  - `weekNumberFor` → `null` außerhalb, Grenze 04.04./05.04.2027, zweite
    Zeitumstellung am 28.03.2027;
  - `activePlanFor`/`planDayState`: Renntag inklusive → `bisZumRennen`, Tag danach →
    `keinPlan`, Tag vor Start → `keinPlan`;
  - `formatGoal`: der Zweig `raceDateConfirmed: true` wird live, sobald Louis das
    Datum bestätigt, und ist heute ungetestet; ebenso Anfang/Mitte/Ende;
  - `phaseRange`: Zweig über den Jahreswechsel.

  Nur zwei Browser-Checks berühren das (07.04./20.04.2027). Das widerspricht „Jede
  Verhaltensänderung bekommt einen Test“ und „Logik ohne Browser prüfbar → Node-Test“
  (HANDOFF.md).
  **Fix:** `tests/plan.test.mjs` (oder eine neue `plan-logic.test.mjs`) mit genau
  diesen Fällen ergänzen.
- **I2 Das Schreiben der Kopie ist nicht getestet** – `tests/app.test.mjs`
  (Szenario 17). Der Test belegt localStorage vorab. Wenn `writeCache` still kaputtgeht
  (falscher Schlüssel, Aufruf entfernt), bleiben alle Tests grün, aber die
  Funkloch-Rettung funktioniert in echt nie. Außerdem fehlt ein Test für eine Kopie mit
  fremder `schemaVersion` (→ Fehlerkarte).
  **Fix:** Einen Browser-Check ergänzen: Nach einem normalen Laden steht unter
  `hm-tracker.plan.hm-2027` ein Plan mit `id === "hm-2027"`. Besser noch als Ablauf:
  normal laden → Kontext behalten → JSON auf 404 routen → neu laden → Hinweis „Plan aus
  letzter Kopie“. Dazu ein Check: 404 + Kopie mit `schemaVersion: 99` → Fehlerkarte.
- **I3 Vor Planstart springen Wochen- und Plan-Tab auf Woche 31** – `app.js:61`
  (`weekNoForTab`) und `app.js:1021` (`renderPlan`, `?? plan.totalWeeks`). Vorher war
  es Woche 1. Per Probe: am 25.08.2026 „Woche 31 von 31“ und „97 % geschafft“. Heute
  ist das unsichtbar, weil wir in Woche 5 sind. Es ist aber eine
  Verhaltensänderung, die nicht zu den zwei bewusst erlaubten zählt, und sie trifft
  jeden künftigen Plan vor seinem Start (Marathon 2028).
  **Fix:** in beiden Fällen `iso < plan.start ? 1 : plan.totalWeeks`.
  In `weekNoForTab` statt `plans[0]` den nächsten künftigen Plan nehmen, oder vorerst
  `plans[0]` mit dieser Unterscheidung.

### Minor

- **M1** `plan.js:169ff` `validatePlan` prüft die Form der Einheiten nicht (`kind` ∈
  {kraft, lauf}, `exercises` als nicht leeres Array, `km` als Zahl, `km` ==
  `parseFloat(dist)`). Für Wochen ≥ 9 greift das heute nur über plan.test.mjs
  (Schleife bis `detailedUntilWeek`). Zur Laufzeit würde eine kaputte Einheit
  durchrutschen und z. B. `defaultHistoryExercise` (`firstKraft.exercises[0]`) werfen.
  Mit K1-Fix 2 gibt es dann wenigstens die Fehlerkarte. Die Prüfungen gehören
  trotzdem in `validatePlan`, spätestens bevor die Wochen 9–31 ab 26.10. geschrieben
  werden.
- **M2** `tests/stubs.test.mjs:52` sammelt die Exporte *aller* Stubs in einer Menge.
  Ein Name, den nur der Firebase-Stub exportiert, erfüllt deshalb auch die Anforderung
  an den config-Stub. Besser wäre es, pro Stub-Literal zu trennen. Geringes Risiko.
- **M3** `app.js:1131-1150`: Scheitert das Plan-Laden, wird ein Strava-Redirect
  (`?code=`) nicht verarbeitet, und der Code bleibt in der URL. Nach „Neu laden“
  klappt es in der Regel (der Code ist einmalig und noch unbenutzt). Das sollte
  aber als Kommentar dokumentiert werden.
- **M4** `app.js:1140`: Der Toast „Plan aus letzter Kopie“ wird bei gleichzeitigem
  Strava-Redirect sofort vom Strava-Toast überschrieben. Beides kommt selten zusammen
  vor und ist kosmetisch.
- **M5** `app.js:195/201`: Die neuen Karten für bisZumRennen/keinPlan kopieren das
  Inline-`style` der Ruhetag-Karte. Das entspricht dem bestehenden Muster, laut
  CLAUDE.md gehört es aber in eine Klasse. Übernimmt der frontend-designer in M2/D0.
- **M6** `tests/plan-golden.test.mjs:60`: Der Katalog wird nur über die Länge
  verglichen. Die Namen sind über den Tagesvergleich abgedeckt, ein direkter Vergleich
  von Namen und `firstWeek` kostet aber eine Zeile. Die Slug-Parität vergleicht zwei
  identische Kopien der Funktion. Das ist als Wächter gegen spätere Änderungen an
  `plan.js` sinnvoll, aber kein Beleg für den Umzug selbst. Den liefert der
  Tagesvergleich der Übungsnamen.

## Tests: tautologisch?

Größtenteils nein. Der Golden-Test vergleicht eine eingefrorene Kopie der alten Logik
mit der neuen und hat echte Aussagekraft (eigene Tiefenprüfung bestätigt ihn). Die
Negativ-Fixturen in plan.test.mjs prüfen jeweils die konkrete Meldung. Die Lücken
liegen woanders, nämlich bei den *neuen* Pfaden: Kopie schreiben (I2), ungültige
Kopie (K1), reine Logik außerhalb der Planwochen und `formatGoal` (I1).

## Korrektur-Loop

| Runde | Auftrag an coder | Ergebnis |
| --- | --- | --- |
| 1/2 | K1 (Pflicht); I1–I3 und S1 im selben Durchgang empfohlen | behoben (065b55b … becb226), in Runde 2 bestätigt |

## Runde 2

Stand: 27.09.2026 · Diff `ba2ab00..becb226` (065b55b … becb226). Geprüft wurde im Code,
nicht anhand des coder-Berichts.

- **K1 behoben.** `plan-store.js` `readCache` verlangt jetzt zusätzlich
  `validatePlan(plan).length === 0`. In `app.js` `init()` stehen `state.weekNo`,
  `historyExercise` und `STRAVA_SINCE` im try-Block.
  Die K1-Probe habe ich erneut laufen lassen (Kopie `{schemaVersion:1,id:"hm-2027"}` +
  JSON 404). Ergebnis: Fehlerkarte „Plan konnte nicht geladen werden: HTTP 404“ mit
  „Neu laden“, keine pageerror.
  Zusätzlich geprüft:
  - Eine unlesbare Kopie (`{nope`) führt zur Fehlerkarte.
  - Eine Kopie, die `validatePlan` besteht, aber eine Kraft-Einheit ohne `exercises`
    enthält, führt ebenfalls zur Fehlerkarte statt zum Hängen. Die Meldung ist dort
    technisch („Cannot read properties of undefined“), das ist der bewusst
    zurückgestellte Minor-Punkt M1.
  - Neuer Browser-Check 19b deckt den Fall ab.
- **I1 behoben.** `tests/plan.test.mjs` prüft jetzt:
  - `weekNumberFor`: `null` vor Start und nach Ende, Start, letzter Tag, 26.10.2026 und
    28.03.2027 (beide Zeitumstellungen);
  - `weekDates(9)`;
  - `planDayState`/`activePlanFor` an den Grenzen (Renntag inklusive, Tag danach, Tag
    vor Start);
  - `formatGoal` in beiden Zweigen plus Anfang/Mitte/Ende;
  - `phaseRange` innerhalb eines Jahres und über den Jahreswechsel.

  Die Erwartungswerte sind feste Literale und nicht aus dem Code abgeleitet, die Tests
  sind also nicht tautologisch.
- **I2 behoben.** Browser-Check 23 belegt localStorage nicht vorab. Er lädt normal,
  prüft die geschriebene Kopie, schaltet dann auf 404 und lädt neu, und prüft, dass die
  selbst geschriebene Kopie greift. Check 24 prüft `schemaVersion: 99` → Fehlerkarte.
- **I3 behoben.** `weekNoForTab` und `renderPlan` liefern vor dem Start Woche 1. Per
  Probe am 25.08.2026: „Woche 1 von 31“ und „0% geschafft“. Nach dem Rennen bleibt es
  bei Woche 31, ohne Fehler. Browser-Check 22 deckt das ab.
- **S1 behoben.** README (Dateitabelle mit `plans/hm-2027.json` und `plan-store.js`,
  Wochen 9–31 jetzt in der JSON), `tests/README.md`, HANDOFF.md (sieben Testläufe, neue
  Falle 7 „nach jeder JSON-Änderung `npm run version`“).
- **M2** (Stub-Wächter prüft jedes Stub-Literal einzeln), **M3** (Kommentar),
  **M4** (Plan- und Strava-Hinweis werden zusammengeführt, Browser-Check 25) und
  **M6** (Katalog Eintrag für Eintrag mit Name und `firstWeek`) sind umgesetzt.
- **Bewusst zurückgestellt:** M1 (Form der Einheiten in `validatePlan`, vor dem
  26.10. nachziehen, wenn die Wochen 9–31 geschrieben werden) und M5 (Inline-Styles,
  gehören zum frontend-designer).
- **`npm test`** habe ich selbst mit `npm run serve` auf :8099 laufen lassen: alle
  Node-Tests grün, Stub-Wächter grün, **163/163 Browser-Checks** grün.

Keine neuen Befunde. Critical und Important sind leer. Schritt 10 für M1 ist
abgehakt, nächster Schritt: security-checker.
