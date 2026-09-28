# Requirements: Dashboard v2 (Schritt 1)

**Status: FREIGEGEBEN von Louis am 27.09.2026.** Das Mockup
`docs/mockup-dashboard-v2.html` ist abgenommen (27.09.2026: „sehr
zufrieden, ready“). Nach der Freigabe dieses Dokuments folgt die Planung.

Stand: 27.09.2026 · Basis: `HANDOFF-v2-dashboard.md` (Desktop) +
**abgenommenes Mockup `docs/mockup-dashboard-v2.html`** (Optik, ersetzt
`mockup-v3.html` als Referenz) + Entscheidungen aus den Discovery-Runden.
Wo dieses Dokument von HANDOFF-v2 abweicht, gilt dieses Dokument; jede
Abweichung ist mit **[Abweichung]** markiert.

Schritt 2 (Mehrziel, Marathon-Coaching, Plan-Erzeugung durch Claude) ist
**nicht** Teil dieses Dokuments und wird parallel weiter erhoben.

---

## Feature Vision

Ein Dashboard als Starttab, das auf einen Blick zeigt, was heute dran ist,
ob Louis auf Kurs ist und was er anders machen soll — mit einem KI-Coach,
der täglich kurz kommentiert und montags eine Wochenbilanz zieht. Unter der
Haube liest alles aus einem Plan-Objekt statt aus festen Konstanten, damit
die App das Planende übersteht und später weitere Ziele tragen kann.

## User Stories / Use Cases

- Louis will beim Öffnen der App im Gym mit einer Hand sofort zur heutigen
  Einheit und den Sätzen kommen, ohne erst am Coach vorbeizuscrollen.
- Louis will an vier Ampeln sehen, ob Wochenumfang, Easy-Disziplin,
  Belastung und Kraftentwicklung im grünen Bereich sind — und bei Gelb/Rot
  konkret lesen, woran es liegt.
- Louis will täglich einen kurzen, ehrlichen Trainer-Satz, der die
  schlechteste Ampel anspricht, und montags eine Wochenbilanz inklusive
  Kraft-Trend.
- Louis will im Wochen-Tab jede Woche als Tagesliste mit Soll/Ist und
  Status sehen.
- Louis will, dass die App nach dem letzten Planwochentag nicht mehr
  „Woche 31“ vortäuscht, sondern ehrlich „Plan beendet“ zeigt.
- Louis will das Renndatum eintragen können, sobald er es kennt; bis dahin
  soll die App keine falsche Genauigkeit vorgaukeln.

## Functional Requirements

### F0. Plan-Objekt und Trennung Daten/Logik (Stufe 1 von 3)

**Entscheidung Louis (27.09.2026): Der Plan kommt in drei Stufen in die
Datenbank.** Stufe 1 gehört zu diesem Schritt:
- **Stufe 1 (Schritt 1, hier):** `plan.js` wird getrennt. Die Plandaten
  kommen in eine **reine Datendatei `plans/hm-2027.json`** im
  Plan-Objekt-Format (F0a). Die **Logik bleibt Code** (Datums-/Wochenlogik,
  Accessoren, `activePlanFor`, Ampeln in `metrics.js`). Auch die künftigen
  Wochen 9–31 (Ausformulierung ab 26.10.2026) werden in diese JSON-Datei
  geschrieben, nicht mehr in `plan.js`.
- Stufe 2 (Schritt 1b, mit dem Login): einmalige Übertragung nach
  Firestore; die Datei wird Fallback — siehe `docs/requirements-login.md`.
- Stufe 3 (Schritt 2): neue Pläne direkt in Firestore mit Versionshistorie
  — siehe `docs/requirements-marathon-coaching.md`.

Anforderungen für Stufe 1:
- `plans/hm-2027.json` enthält das vollständige Plan-Objekt mit
  **ausgeschriebenen** Wochen, Einheiten und ISO-Daten (keine Generator-
  Funktionen mehr zur Laufzeit). Die bisherigen Generatoren in `plan.js`
  (`easy()`, `fullBodyA()` …) dürfen **einmalig** genutzt werden, um die
  JSON-Datei zu erzeugen; danach wird die JSON-Datei gepflegt.
- Einheiten liegen in der Datei als `week.sessions[]` (F0a Punkt 2). Das
  ergibt sich aus der Trennung: Wenn die Daten ohnehin neu geschrieben
  werden, gleich im Zielformat.
- Die App lädt die Datei per `fetch` beim Start (kein Build-Schritt;
  JSON-Module-Imports sind in Safari nicht verlässlich genug — in der
  Planung gegen aktuelle Browser-Unterstützung prüfen). Das Laden ist
  asynchron; die App rendert bis dahin Platzhalter (wie bei Strava). Der
  Versionsstempel (`tools/bump-version.mjs`) muss auch die JSON-URL
  erfassen, sonst liefert der Cache alte Plandaten aus.
- **Die Plandaten-Tests (`tests/plan.test.mjs`) prüfen künftig die
  JSON-Datei** (Node liest sie direkt): Struktur, lückenlose Wochen,
  Datumskonsistenz, Pflichtfelder (`km`, `hfMax`), dazu die Logik-Tests
  gegen die geladene Datei. Die bestehenden 81 Prüfungen werden
  übertragen, nicht verworfen.
- Ergebnis der Trennung: `plan.js` (bzw. ein umbenanntes Logik-Modul)
  enthält keine Plandaten mehr.

Das Plan-Objekt:
- `{ id: "hm-2027", schemaVersion: 1, fileVersion, goal, start, totalWeeks, detailedUntilWeek, phases, weeks, zones }`.
  `fileVersion` ist ein Datum-Zeit-Stempel, der bei jeder Änderung der
  Datei erhöht wird (Grundlage für Stufe 2: „Datei neuer als Firestore?“).
- `goal = { distance: "Halbmarathon", distanceKm: 21.0975, targetTime: "1:29:59", targetPace: "4:16 /km", raceDate: "2027-04-11", raceDateConfirmed: false }`.
- Eine Funktion `activePlanFor(iso)` liefert den Plan, in dessen Zeitraum
  (Planstart bis einschließlich Renntag bzw. letzter Planwoche, je
  nachdem was später liegt) das Datum fällt, sonst `null`. In Schritt 1
  gibt es genau einen Plan; die Registry ist trotzdem schon eine Liste.
- `weekNumberFor(iso)` begrenzt **nicht mehr** stumm auf 1…31, sondern
  liefert `null` außerhalb des Plans. Alle Aufrufer behandeln `null`
  (siehe F7). **[Abweichung vom Ist-Code]**
- Dashboard, Wochen-Tab, Plan-Tab, Coach und `metrics.js` lesen Renndatum,
  Distanz, Zielzeit, Phasen, Wochen, Gesamtwochenzahl und Zonen **nur** aus
  dem Plan-Objekt.
- Renndatum wird **in `plans/hm-2027.json`** gepflegt (mit Claude Code).
  Eine Eingabe in der App gibt es in Schritt 1 nicht; sie kommt mit
  Schritt 2 („neues Ziel in der Plan-Karte“).
- Laufeinheiten bekommen die numerischen Felder `km` (z. B. 8 für
  „8 km + 4x20s“) und `hfMax` (Obergrenze der Zielzone: Easy 163,
  Easy-Deload 160, Long 160, Recovery 148).
- Strava-Läufe werden ab `plan.start − 35 Tage` geladen (= 27.07.2026),
  `per_page=200`, einmal pro Sitzung, im Speicher gehalten.
  **[Abweichung vom Ist-Code: bisher `PLAN_START − 14`]**

#### F0a. Weichen für Schritt 2 **[NEU — ergibt sich aus docs/requirements-marathon-coaching.md]**

Schritt 2 legt erzeugte Pläne **im selben Format** in Firestore ab. Damit
das ohne Umbau andockt, muss das Plan-Objekt aus Schritt 1 so geschnitten
sein:

1. **Reine Daten, JSON.** Mit Stufe 1 ist das Plan-Objekt eine
   JSON-Datei — nur Strings (ISO-Daten), Zahlen, Booleans, Arrays und
   Objekte. Datums-/Wochenlogik (`weekNumberFor`, `weekDates` …) nimmt den
   Plan als Parameter statt `PLAN_START` global zu lesen. **Firestore-
   tauglich:** keine direkt verschachtelten Arrays (Array in Array), weil
   Firestore sie nicht speichert — z. B. `phases[].weeks` als
   `{ from: 1, to: 8 }` statt `[1, 8]`. Ein Test prüft das, damit Stufe 2
   die Datei unverändert übertragen kann.
2. **Einheiten als Liste, nicht als feste Wochentags-Schlüssel.** Heute:
   `week.runs[]` + `week.kraft.di` / `week.kraft.do`. Ein Marathon- oder
   Übergangsblock hat Kraft an anderen Tagen oder nur einmal. Die
   JSON-Datei speichert deshalb `week.sessions[]` =
   `[{ date, kind: "lauf"|"kraft", … }]`; der Accessor
   `sessionsFor(plan, week)` ist der einzige Lesezugriff für **allen**
   Code (`metrics.js`, Dashboard, Wochen-Tab, Tagesansicht, Coach).
3. **Wochen tragen Wochenwerte auch ohne Tagesdetails.** Jede Woche hat
   `{ n, start, phase, weekType, deload, focus, plannedKm?, placeholder }`.
   Das ist exakt das „Grobgerüst“ aus Schritt 2; eine Platzhalterwoche ist
   eine Woche ohne `sessions`. Wochensoll nutzt `plannedKm`, wenn keine
   Tageswerte da sind.
4. **Registry statt Einzelplan, als injizierbare Liste.**
   `activePlanFor(iso, plans)` bekommt die Plan-Liste übergeben, damit
   Schritt 2 später Firestore-Pläne asynchron dazuladen kann, ohne die
   Aufrufer zu ändern.
5. **`schemaVersion: 1`** im Plan-Objekt und `planId` in jedem
   `coach`/`coachweek`-Dokument, damit Schritt 2 Formate migrieren und
   Coach-Texte Plänen zuordnen kann.
6. **Woche immer aus Datum + Plan ableiten, nie aus `logs.week`.** Das
   Feld `week` in bestehenden Logs ist planrelativ und bleibt, wie es ist;
   neuer Code liest es nicht.
7. **Zonen und `hfMax` gehören zum Plan**, nicht zu `THRESHOLDS` — ein
   späterer Block kann neu getestete Zonen haben.

Aufwand-Einschätzung: mittel. Die Trennung Daten/Logik mit
`week.sessions[]` ist der größte Einzelposten; sie berührt `app.js`
(bisherige Zugriffe auf `weeks`, `kraft.di/do`, `PLAN_START`,
`TOTAL_WEEKS`) und `tests/plan.test.mjs`. Sie sollte im Plan **vor** den
Dashboard-Funktionen stehen, weil alles Weitere darauf aufbaut.

### F1. Tab-Leiste

- `Dashboard | Woche | Verlauf | Plan`. Dashboard ist Starttab und ersetzt
  den Tab „Heute“. Verlauf und Plan bleiben inhaltlich wie bisher (Plan-Tab
  liest Ziel/Renndatum aus dem Plan-Objekt).

### F2. Kopfzeile Dashboard

- Datum (Wochentag, Tag, Monat).
- `Woche N · <Wochentyp>` — „Entlastung“ in Deload-Wochen (4, 8),
  „Aufbau“ sonst in Phase 1, ab Woche 9 der Phasenname.
- Badge `Phase n · <Name>`.
- Countdown-Zeile:
  - `raceDateConfirmed: false` → „Rennen ca. Mitte April 2027 · Datum offen“
    (Monat aus `raceDate`, keine Wochenzahl). **[Abweichung: HANDOFF-v2
    zeigt „Noch X Wochen“ auch beim Platzhalter]**
  - `raceDateConfirmed: true` → „Noch X Wochen bis zum Rennen“, in der
    letzten Woche „Noch X Tage“.

### F3. Reihenfolge der Dashboard-Inhalte **[Abweichung vom Mockup v3]**

1. Kopfzeile
2. Karte **„Heute dran“** (F4)
3. **Coach-Karte** (F6)
4. **Vier Ampeln** 2×2 (F5)
5. **„Im Detail“** (F8)

### F4. Karte „Heute dran“

- Farbe nach Typ: Teal Kraft, Koralle Lauf, Lila Long Run, grau Ruhe.
- **Kraft:** Titel, Anzahl Übungen, Satz-Kurzinfo. Button „Starten“ klappt
  die Übungsliste auf; Fortschritt „x/y geloggt“ sichtbar. Tippen auf eine
  Übung **springt in die bestehende Kraft-Tagesansicht** (mit allen
  vorhandenen Funktionen: Alle Sätze gleich / einzeln, Anpassen,
  Progressionsvorschlag). Kein Inline-Duplikat der Satz-Eingabe.
  **[Abweichung/Präzisierung zu HANDOFF-v2 A4]**
- **Lauf:** Ziel-Distanz, Ziel-Pace, HF-Zone; nach dem Lauf Ist-Werte aus
  Strava (Zuordnung über `assignRuns`, also auch nachgeholte Läufe mit
  Hinweis „nachgeholt“). Keine Eingabefelder.
- **Ruhe:** schlichte graue Karte mit ggf. Hinweis (z. B. „Mobility“).
- **Platzhalterwoche (9–31 vor Ausformulierung):** „Details nach
  Re-Kalibrierung“, Phase und Fokus.

### F5. Vier Ampeln

Jede Kachel: Punkt (grün/gelb/rot/grau), Titel, eine Detailzeile. Bei
gelb/rot nennt die Detailzeile konkret, was los ist. Alle Grenzwerte in
`THRESHOLDS` in der **bestehenden** `config.js`. **[Abweichung: HANDOFF-v2
spricht von einer neuen Datei `config.js`; die gibt es schon.]**

Gemeinsame Regel: „erledigt“ bei Läufen heißt **über `assignRuns` aus
`runmatch.js` zugeordnet** (exakt, nachgeholt oder manuell) — nicht
„Strava-Lauf am selben Datum“. Kraft „erledigt“ heißt: alle Übungen der
effektiven Übungsliste des Tages (nach `dayplans`-Anpassungen) in
Firestore geloggt. **[Abweichung von HANDOFF-v2 A3.1]**

**Ampel 1 — Wochensoll** (wie HANDOFF-v2 A3.2)
- Lauf: zugeordnete Ist-km der Plan-Lauftage Mo bis heute vs. geplante km
  derselben Tage (anteilig). Grün ≥ 90 %, gelb 70–90 %, rot < 70 %.
- Kraft: erledigte vs. bis heute geplante Einheiten; eine verpasste
  vergangene Einheit → mindestens gelb. Die heutige, noch offene Einheit
  zählt nicht als verpasst.
- Gesamtstatus = schlechterer der beiden Teilwerte.
- Anzeige: `14 / 24 km · Kraft 1/2` (Wochensoll gesamt, nicht anteilig).
- Grau „Woche ohne Details“ in Platzhalterwochen; grau „kein aktiver Plan“
  außerhalb eines Plans.

**Ampel 2 — Easy-Disziplin** (wie HANDOFF-v2 A3.3)
- Die letzten 3 abgeschlossenen, über `assignRuns` zugeordneten Läufe vom
  Typ Easy, Long oder Recovery.
- Obergrenze je Lauf aus `hfMax` der Plan-Einheit.
- Grün: alle ≤ Obergrenze. Gelb: genau einer drüber (≤ 8 bpm). Rot: zwei
  oder mehr drüber, oder einer mehr als 8 bpm drüber.
- Detailzeile nennt Tag und Ø HF des schlechtesten Laufs
  („Mi: Ø 166 bpm, Obergrenze 160“).
- Grau bei weniger als 1 zugeordnetem Lauf.

**Ampel 3 — Belastung** (wie HANDOFF-v2 A3.4)
- Verhältnis = km der letzten 7 Tage ÷ (km der 28 Tage davor ÷ 4), über
  **alle** Strava-Läufe (auch ungeplante).
- Grün ≤ 1,3, gelb 1,3–1,5, rot > 1,5. Werte < 1 bleiben grün.
- Anzeige als Verhältnis: „Verhältnis 0,72“ — **nicht in Prozent**.
  **[Abweichung vom Mockup v3, das „−28 %“ zeigt]**
- Grau „noch zu wenig Daten“ bei weniger als 4 Wochen Strava-Historie.
- Code-Kommentar und Coach: grobe Heuristik (Acute:Chronic), Warnsignal,
  keine Diagnose.
- Funktioniert auch ohne aktiven Plan.
- **Info-Knopf** an der Kachel (D1): erklärt in wenigen Sätzen die
  Berechnung (7 Tage ÷ Wochenschnitt der 28 Tage davor), die Grenzen
  (≤ 1,3 / 1,3–1,5 / > 1,5 aus `THRESHOLDS`, nicht fest im Text), warum
  < 1 in Entlastungswochen gewollt ist und dass es ein Warnsignal, keine
  Diagnose ist.

**Ampel 4 — Kraft-Progression** (NEU, ersetzt Ampel „Heute“)
**[Abweichung von HANDOFF-v2 A3.1]**

Beantwortet: Steigen die Gewichte wie geplant, oder hängt eine Übung fest?
Baut auf derselben Double-Progression-Logik wie `progression.js` auf, damit
Ampel und Progressionsvorschlag in der Tagesansicht sich nie widersprechen.

- **Betrachtet:** Übungen mit Gewicht (`parseSoll` nicht zeitbasiert,
  `topKg > 0`), die im Betrachtungsfenster geloggt wurden — Plan-Übungen
  und eigene/ersetzte Übungen gleichermaßen. Körpergewichts- und
  Zeitübungen zählen nicht.
- **Betrachtungsfenster:** die letzten `THRESHOLDS.kraft.windowDays` (42)
  Tage. **Deload-Einheiten** (Soll enthält „Deload“) werden übersprungen,
  weder als Fortschritt noch als Rückschritt gewertet.
- **Soll je Einheit:** das Soll, das an dem Tag galt (Plan-Woche des
  Log-Datums bzw. `dayplans.added[].soll`), nicht das heutige.
- **Pro Übung, aus den letzten Nicht-Deload-Einheiten:**
  - *unter Soll* — die jüngste Einheit hat Level „down“ in
    `suggestProgression`-Logik (mindestens ein Satz unter der unteren
    Wdh-Grenze).
  - *stagniert* — die letzten `THRESHOLDS.kraft.stallSessions` (2, von
    Louis am 24.09.2026 entschieden)
    Nicht-Deload-Einheiten **mit demselben Soll-Schema** (gleiche
    Satzzahl und Wdh-Spanne laut `parseSoll`) haben dasselbe `topKg`, und
    die Gesamt-Wdh der jüngsten ist nicht höher als die der ältesten
    dieser Einheiten. Wechselt das Soll (z. B. Woche 3 → 5: 3x8-10 →
    4x4-6), beginnt die Zählung neu; weniger Wdh nach einem planmäßigen
    Wechsel sind keine Stagnation.
  - sonst *ok* (steigt oder baut Wdh aus).
- **Status:**
  - Grün: keine Übung *unter Soll* oder *stagniert*.
  - Gelb: genau eine Übung *unter Soll* oder *stagniert*.
  - Rot: zwei oder mehr Übungen betroffen, **oder** dieselbe Übung zwei
    Nicht-Deload-Einheiten in Folge *unter Soll*.
  - Grau „noch zu wenig Daten“: weniger als
    `THRESHOLDS.kraft.minExercisesWithData` (3) Gewichtsübungen mit
    mindestens einer Nicht-Deload-Einheit im Fenster (in einer
    Deload-Woche also typischerweise noch nicht grau, weil das Fenster 42
    Tage zurückreicht). Grau „kein aktiver
    Plan“ außerhalb eines Plans.
- **Detailzeile:** grün → „6 Übungen, keine hängt fest“; gelb/rot → die
  schlechteste Übung zuerst, z. B. „Squats: 3× 60 kg ohne Steigerung“ oder
  „Deadlift unter Soll (4/3/3 bei 3x5)“, bei mehreren „+1 weitere“.
- **THRESHOLDS-Einträge:** `kraft.windowDays: 42`, `kraft.stallSessions: 2`,
  `kraft.minExercisesWithData: 3`, `kraft.redAffectedCount: 2`,
  `kraft.redConsecutiveBelow: 2`.

### F6. Coach

**Täglich (wie HANDOFF-v2 Teil C, mit Änderungen)**
- Ein bis zwei Sätze, lila Karte, unterhalb von „Heute dran“.
- Worker-Endpunkt `POST /coach` im **bestehenden** Worker
  `trainingsplanung-auth` (`wrangler.toml`), neues Secret
  `ANTHROPIC_API_KEY` per `npx wrangler secret put ANTHROPIC_API_KEY`.
  Die Worker-URL steht in `config.js` (nicht in `strava.js`, wie HANDOFF-v2
  voraussetzt). **[Präzisierung]**
- Modell und `anthropic-version` werden in der Planung **gegen die aktuelle
  Doku geprüft** (Spec nennt `claude-haiku-4-5-20251001`, `max_tokens: 200`).
- Eingabeschema = HANDOFF-v2 C3 mit diesen Änderungen:
  - neues Feld `kind: "daily"`;
  - neues Objekt `goal: { distance, targetTime, raceMonth, raceDateConfirmed }`
    aus dem Plan-Objekt;
  - Checkpoint `heute` entfällt, dafür `kraft: { status, detail }`;
  - `today` bleibt (Typ, Name, erledigt).
- **System-Prompt:** Text aus HANDOFF-v2 C7, aber der Satz „Er bereitet
  sich auf einen Halbmarathon mit Zielzeit 1:29:59 im April 2027 vor“ wird
  vom Worker aus `goal` zusammengesetzt, nicht fest eingetragen. Die Werte
  werden streng validiert (Distanz aus fester Liste, Zeit per Regex, Monat
  als Zahl), damit darüber kein freier Text in den Prompt gelangt.
- Caching wie C5: `coach/{YYYY-MM-DD}` mit `{ text, generatedAt, inputHash }`,
  neu bei geändertem Hash, **max. 3 Generierungen pro Tag**. Dashboard
  wartet nie auf den Coach.
- Regel-Fallback wie C6, priorisiert nach der schlechtesten Ampel
  (rot vor gelb vor grün, bei Gleichstand Reihenfolge Belastung →
  Easy-Disziplin → Wochensoll → Kraft). Für die neue Kraft-Ampel gibt es
  eigene Bausteine.

**Wochenbilanz montags (NEU)** **[Erweiterung gegenüber HANDOFF-v2]**
- **Inhalt:** Bilanz der zurückliegenden Planwoche (Mo–So) in 4 bis 6
  Sätzen, Du-Form, gleicher Ton wie täglich:
  1. Laufumfang Soll/Ist und erledigte Einheiten;
  2. Easy-Disziplin der Woche (welche Läufe über der Zone);
  3. **Kraft-Trend** (welche Übungen steigen, welche hängen, aus F5 Ampel 4);
  4. Belastungsverhältnis und aerobe Effizienz, nur wenn auffällig;
  5. ein konkreter Schwerpunkt für die neue Woche (Wochentyp,
     Schlüsseleinheit).
- **Anzeige:** In der Coach-Karte. Am Montag unter dem Tagessatz
  ausgeklappt, Dienstag bis Sonntag eingeklappt zum Aufklappen. Die
  eingeklappte Zeile heißt in Kurzform **„Wochenbilanz W3“** (Nummer der
  bilanzierten Woche). (Darstellung sonst wie im abgenommenen Mockup, D4.)
- **Auslösung:** beim ersten Öffnen des Dashboards ab Montag der neuen
  Woche, sobald Strava geladen ist (nicht aus einem Zustand ohne
  Strava-Daten). Wird Montag übersprungen, entsteht sie beim ersten Öffnen
  später in der Woche.
- **Caching:** Firestore `coachweek/{planId}_W{n}` mit
  `{ text, generatedAt, inputHash, week }`. Ändert sich der Eingabe-Hash
  (z. B. Sonntags-Lauf wird erst Montag synchronisiert), wird neu erzeugt —
  **max. 2 Generierungen pro Bilanz-Woche**, getrennt vom Tageslimit.
- **Fallback:** ohne Worker/API eine regelbasierte Kurzbilanz aus festen
  Bausteinen (Umfang, Kraft-Trend, Schwerpunkt).
- **Modell/Länge:** dasselbe Modell wie täglich, `max_tokens` ca. 400
  (Wert in der Planung festlegen).
- **Eingabeschema `kind: "weekly"`** (vom Client berechnet):

  ```json
  {
    "kind": "weekly",
    "goal": { "distance": "Halbmarathon", "targetTime": "1:29:59", "raceMonth": 4, "raceDateConfirmed": false },
    "week": 4, "weekType": "Entlastung", "phase": "Basis",
    "run": {
      "plannedKm": 24, "actualKm": 24.3,
      "sessionsPlanned": 3, "sessionsDone": 3,
      "easyOverLimit": [ { "day": "Mi", "avgHr": 166, "limit": 160 } ]
    },
    "kraft": {
      "sessionsPlanned": 2, "sessionsDone": 2,
      "progression": [ { "exercise": "Squats", "status": "stagniert", "detail": "3× 60 kg" } ]
    },
    "belastung": { "ratio": 0.72, "status": "gruen" },
    "aerobeEffizienzTrend": "-7 s/km seit Woche 1",
    "adherence4w": { "done": 11, "planned": 12 },
    "nextWeek": { "n": 5, "type": "Aufbau", "keySession": "Sa: Long Run 13 km" }
  }
  ```

- **Worker-Validierung:** `/coach` akzeptiert genau zwei Schemas
  (`kind: "daily"` und `kind: "weekly"`), prüft Typen, Enums
  (`status`: gruen/gelb/rot/grau; Kraft-Status: steigt/haelt/stagniert/unterSoll),
  Zahlenbereiche und maximale String-Längen und Array-Längen; alles andere
  → 400. Für jedes Schema baut der Worker seinen eigenen Prompt.
- **Absicherung** wie HANDOFF-v2 C4: Origin-Check (CORS für `/coach` nicht
  `*`), Schema-Prüfung, kleines `max_tokens`, **monatliches Ausgabenlimit
  in der Claude Console** als eigentliche Grenze; ehrlicher Code-Kommentar,
  dass der Origin-Check gezielte Anfragen nicht stoppt.

### F7. Zustand ohne aktiven Plan (nach Planende)

- Ab dem Tag nach Plan-/Rennende zeigt das Dashboard „Plan beendet“ statt
  „Woche 31“:
  - Kopfzeile: Datum, „Kein aktiver Plan“, bei vergangenem Rennen „Rennen
    am TT.MM.JJJJ“.
  - „Heute dran“: neutrale Karte „Kein Plan aktiv — Läufe werden weiter
    aus Strava gezeigt“, darunter ggf. der heutige Strava-Lauf.
  - Ampeln: Belastung rechnet weiter; Wochensoll, Easy-Disziplin und
    Kraft-Progression grau „kein aktiver Plan“.
  - Coach: **kein API-Aufruf** ohne aktiven Plan; fester Hinweistext.
    (Weiter-gecoacht-werden zwischen den Zielen ist Thema von Schritt 2.)
  - „Im Detail“: nur Karten, die ohne Plan Sinn ergeben (aerobe Effizienz);
    der Rest entfällt.
- Wochen-Tab: blättert nur innerhalb der Planwochen; außerhalb öffnet er
  die letzte Planwoche mit dem Hinweis „Plan beendet“.
- Freies Kraft-Loggen außerhalb des Plans ist **nicht** Teil von Schritt 1.

### F8. „Im Detail“ (wie HANDOFF-v2 A5, mit Präzisierungen)

- **Wochenvolumen Soll vs. Ist:** Balkenpaare der Wochen der aktuellen
  Phase; künftige Wochen nur Soll; aktuelle Woche hervorgehoben;
  Platzhalterwochen ohne Soll-Balken (kein falsches 0). Farben siehe D2
  (gilt ebenso für den Laufvolumen-Balken im Wochen-Tab).
- **Aerobe Effizienz:** pro Woche Ø Pace aller Läufe mit Ø HF zwischen den
  Grenzen aus der Z2-Zone des Plan-Objekts (heute 148–163, nicht hart
  codiert); Linie über die Wochen; oben rechts Differenz zur ersten Woche
  mit Daten, grün wenn schneller; Wochen ohne passenden Lauf auslassen.
- **Adhärenz 4 Wochen:** erledigte vs. geplante Einheiten (ohne Ruhetage)
  der letzten 28 Tage, Läufe über `assignRuns`. In % mit Balken und „x von y
  Einheiten“.
- **Als Nächstes:** nächster Long Run, Typ der nächsten Woche, Datum der
  nächsten Re-Kalibrierung (aus dem Plan-Objekt, derzeit 25.10.2026).

### F9. Wochen-Tab (wie HANDOFF-v2 Teil B)

- Navigation Woche 1 bis `plan.totalWeeks` (nicht fest 31), Start auf der
  aktuellen Woche. Platzhalterwochen zeigen Phase, Zeitraum, Fokus und
  „Details nach Re-Kalibrierung“.
- Zusammenfassung oben: Laufvolumen Ist/Soll mit Balken, Kraft
  erledigt/geplant.
- Tagesliste vertikal: Tag + Datum, Einheit, darunter Ist (falls vorhanden)
  sonst Ziel, rechts Status-Symbol.
- Status-Symbole: erledigt und im Ziel → grüner Haken; erledigt, aber
  Ø HF > `hfMax` → gelbes Warnsymbol; Kraft teilweise geloggt → gelb „5/8“;
  heute → Badge „Heute“ + Teal-Rahmen; Zukunft → gestrichelter Kreis;
  Vergangenheit nicht erledigt → rotes „verpasst“. Nachgeholte Läufe
  (über `assignRuns`) zählen als erledigt und tragen den Hinweis
  „nachgeholt“.
- Antippen klappt Details auf (Ziel, Ist, Hinweis; bei Kraft Übungsliste
  mit geloggten Werten). Von dort erreichbar: die bestehende Tagesansicht
  (für „Anderen Lauf“, Satz-Eingabe).
- Ruhetage schlicht, nicht antippbar.
- Abstände im Wochen-Tab folgen dem Abstandsraster aus `style.css` (D3).

## Design & UX Requirements

- **Abgenommene Referenz: `docs/mockup-dashboard-v2.html`**
  (frontend-designer; von Louis am 27.09.2026 abgenommen: „sehr zufrieden,
  ready“). Die Umsetzung folgt dem Mockup **für die Optik**, dieses
  Dokument **für die Logik**. Verbindlich aus dem Mockup insbesondere:
  - Reihenfolge und Karten des Dashboards, alle Zustände des Mockups
    (inkl. „Plan beendet“, „Datum offen“, Wochenbilanz ein-/ausgeklappt);
  - die **Info-Sheets** (D1);
  - die **gefüllten Soll-Balken** mit Legende (D2);
  - das **Wochen-Tab-Layout** (Tagesliste, Status-Symbole, Abstände, D3).
- **Entschieden:** Die neuen Rot/Grün-Tokens für die Ampeln bleiben, ebenso
  die zusätzlichen Formen an den Ampelpunkten (Status auch ohne Farbe
  erkennbar). Warn- und Info-Icon tragen einen sichtbaren Punkt (letzter
  Mockup-Fix).
- **Detail-Anforderungen aus der Mockup-Abnahme (im Mockup umgesetzt):**
  - **D1 Info-Sheets:** Info-Knopf an **allen vier Ampeln und an der Karte
    „Aerobe Effizienz“** (Entscheidung des frontend-designers, im Mockup
    umgesetzt). Jedes Sheet erklärt Berechnung, Grenzwerte und Bedeutung;
    Grenzwerte werden aus `THRESHOLDS` eingesetzt, nicht fest in den Text
    geschrieben. Inhalt für die Belastung siehe F5 Ampel 3; die übrigen
    Texte wie im Mockup. Per Tastatur/Screenreader bedienbar
    (`aria-label`), Tippfläche ≥ 44 px (im Mockup über vergrößerte
    Trefferfläche gelöst).
  - **D2 Soll/Ist-Balken:** beide Balken gefüllt, Soll in eigener
    Soll-Farbe, Ist in Teal, feste Reihenfolge (Soll links, Ist rechts)
    und Legende — damit auch ohne Farbwahrnehmung unterscheidbar. Beide
    erreichen **mindestens 3:1 Kontrast gegen die Kartenfläche** in Hell-
    **und** Dunkelmodus. Ein Ist von 0 zeichnet keinen Rest-Balken.
  - **D3 Wochen-Tab-Abstände** auf das Raster von `style.css`, keine
    Einzelwerte.
  - **D4** Eingeklappte Wochenbilanz heißt „Wochenbilanz W3“ (Kurzform).
- **D5 Icon-Bug in der echten App (mit beheben):** Das Plan-Tab-Icon in
  `index.html` zeichnet seine Listenpunkte als Strich der Länge 0
  (`M3 6h.01` …) ohne `stroke-linecap: round` — die Punkte werden deshalb
  nicht gerendert. Beheben (runde Linienenden oder echte Punkte), und alle
  übrigen Icons der App auf dasselbe Muster prüfen.
- Visual style: wie das abgenommene Mockup und `style.css` (Teal = Kraft,
  Koralle = Lauf, Lila = Long Run und Coach), inkl. Dark Mode und
  Glas-Tableiste.
- User flow: App öffnen → „Heute dran“ → „Starten“ → Übung antippen →
  Kraft-Tagesansicht → zurück zum Dashboard.
- Handy zuerst (Tests gegen 390×844), fluid-responsive: nichts clippt oder
  verschwindet, nichts scrollt seitlich, Eingabefelder ≥ 16 px.
- Dashboard rendert Platzhalter sofort und lädt Strava/Coach nach.
- Oberfläche, Kommentare, Commits auf Deutsch.

## Technical Preferences

- Stack: Vanilla-JS-PWA ohne Build-Step, GitHub Pages, Firestore (anonyme
  Anmeldung), Cloudflare Worker `trainingsplanung-auth`.
- Neue Module `metrics.js` (Ampeln, Adhärenz, Effizienz, Kraft-Progression;
  ohne Browser testbar) und `coach.js` (Schema-Aufbau, Hash, Cache,
  Fallback). Beide müssen in `tools/bump-version.mjs` eingetragen werden.
- `THRESHOLDS` in der bestehenden `config.js`.
- Neue Firestore-Sammlungen `coach/` und `coachweek/`; die bestehenden
  Regeln (jeder angemeldete Nutzer) decken sie ab — Schema-Änderung, also
  Approval-Gate in der Planung.
- Neue Datei/Ordnerstruktur `plans/hm-2027.json` und Trennung von
  `plan.js` in Daten und Logik — Datei-Organisation, also Approval-Gate in
  der Planung.
- Keine neuen npm-Abhängigkeiten.
- Keine Secrets im Repo; `ANTHROPIC_API_KEY` nur als Worker-Secret.

## Suggested Additions (aus dem Opportunities-Pass)

In Schritt 1 aufgenommen:
- Ampel „Kraft-Progression“ statt „Heute“.
- Wochenbilanz montags.
- „Heute dran“ nach oben.
- Plan-Objekt mit `raceDateConfirmed` und sauberem Zustand nach Planende.

Backlog-Kandidaten (Louis gefallen sie, später besprechen — **nicht** in
Schritt 1):
- Zielzeit-Prognose „Schaffe ich die 1:29:59?“ (sinnvoll ab Phase 2).
- Tagesnotiz Schmerz/Müdigkeit, die in den Coach einfließt
  (REQUIREMENTS #11).
- Export als JSON/CSV, auch als Eingabe für eine spätere Planerzeugung
  (REQUIREMENTS #10).
- Robustere aerobe Effizienz (Geschwindigkeit ÷ Ø HF über Easy/Long).

## Success Metrics (Abnahme)

- [x] Mockup `docs/mockup-dashboard-v2.html` von Louis abgenommen
      (27.09.2026).
- [ ] Umsetzung entspricht optisch dem Mockup (Handy und Laptop,
      Hell und Dunkel verglichen).
- [ ] Soll/Ist-Balken: ≥ 3:1 gegen die Kartenfläche in Hell und Dunkel
      (gemessen), Soll/Ist ohne Farbe unterscheidbar.
- [ ] Info-Sheets an allen vier Ampeln und an „Aerobe Effizienz“ erklären
      Berechnung und Bedeutung, Grenzwerte kommen aus `THRESHOLDS`.
- [ ] Plan-Tab-Icon zeigt seine Listenpunkte (D5); kein weiteres Icon mit
      unsichtbaren Null-Strichen.
- [ ] Plandaten liegen in `plans/hm-2027.json`; `plan.js` enthält keine
      Plandaten mehr; `tests/plan.test.mjs` prüft die JSON-Datei; der
      Versionsstempel erfasst die JSON-URL.
- [ ] Dashboard lädt ohne auf Coach oder Strava zu warten.
- [ ] Alle vier Ampeln rechnen korrekt; mit Testdaten je einmal grün,
      gelb, rot, grau gezeigt — inkl. Kraft-Progression mit Deload-Woche
      und Soll-Wechsel zwischen Woche 3 und 5.
- [ ] Nachgeholter Lauf zählt in Wochensoll, Easy-Disziplin, Adhärenz und
      Woche als erledigt.
- [ ] Belastung wird als „Verhältnis 0,72“ angezeigt.
- [ ] Coach-Text erscheint, wird gecacht; zweiter Aufruf ohne Änderung löst
      keine Anfrage aus; Tageslimit 3 und Wochenlimit 2 greifen.
- [ ] Wochenbilanz erscheint montags, enthält den Kraft-Trend, ist
      Di–So aufklappbar.
- [ ] Coach und Wochenbilanz funktionieren bei abgeschaltetem Worker über
      den Fallback.
- [ ] `/coach` lehnt falschen Origin und jedes Schema außer daily/weekly
      mit 400 ab; der Prompt enthält Ziel/Distanz/Zielzeit aus dem Plan.
- [ ] Mit simuliertem Datum nach Planende: „Plan beendet“, keine Woche 31,
      kein Coach-API-Aufruf, Belastung rechnet weiter.
- [ ] Countdown zeigt „Datum offen“ bei `raceDateConfirmed: false`.
- [ ] Aller Code liest Einheiten nur über `sessionsFor`, Datumslogik
      nimmt den Plan als Parameter (Weichen F0a).
- [ ] Satz-Eingabe aus „Heute dran“ landet in der Kraft-Tagesansicht und
      speichert wie bisher.
- [ ] Wochen-Tab: Navigation 1…`totalWeeks`, Soll/Ist korrekt, alle
      Status-Symbole.
- [ ] Handy (390×844) und Laptop geprüft, bei mehreren Fensterbreiten.
- [ ] `npm test` komplett grün, Versionsstempel inkl. neuer Module.
- [ ] Kein Secret im Repo (`git grep` nach Key-Fragmenten).

## Open Questions / Risks

- **Kraft-Progression-Schwellen sind ein erster Wurf** (42 Tage, 2
  Einheiten, 3 Übungen Mindestdaten). In der Umsetzung gegen Louis' echte
  Logs aus Woche 1–4 prüfen; falls die Ampel schon jetzt dauernd gelb ist,
  Schwellen anpassen, nicht die Logik verbiegen.
- **Entschieden (24.09.2026): `stallSessions = 2`.** Weil die
  Stagnationszählung bei jedem Soll-Wechsel neu beginnt und die meisten
  Übungen nur einmal pro Woche vorkommen, erkennt die Ampel Stagnation so
  frühestens in der 2. Woche eines Blocks (mit 3 wäre es in Phase 1 erst
  Woche 7 gewesen). Bewusst in Kauf genommen: etwas anfälliger für einen
  einzelnen schwachen Tag.
- **Renndatum vs. Planende:** Woche 31 endet am 04.04.2027, Platzhalter
  `raceDate` ist der 11.04.2027 (bekannte Abweichung). Solange
  `raceDateConfirmed: false`, zeigt die App keinen Countdown; die Lücke
  wird bei der Ausformulierung der Wochen 9–31 (ab 26.10.2026) geschlossen.
  Erledigt (27.09.2026): `phases[3].range` in `plan.js` ist auf
  „08.03.–04.04.2027“ korrigiert und passt zur Datumslogik.
- **Platzhalterwochen 9–31:** bis zur Re-Kalibrierung haben Wochensoll,
  Easy-Disziplin und Kraft-Progression ab Woche 9 keine Plandaten. Die
  Umsetzung sollte vor dem 26.10.2026 live sein, sonst ist das Dashboard
  in Woche 9 überwiegend grau.
- **Modellname/Header** gegen aktuelle Doku prüfen (nicht aus HANDOFF-v2
  übernehmen).
- **Fremdaufrufe auf `/coach`:** in Schritt 1 nur durch das Ausgabenlimit
  wirklich begrenzt. Die ID-Token-Prüfung im Worker kommt direkt danach in
  **Schritt 1b** (`docs/requirements-login.md`).
- **Plandaten werden asynchron geladen** (Stufe 1): Fehlt die JSON-Datei
  oder ist sie ungültig, zeigt die App eine eigene Fehlerkarte „Plan konnte
  nicht geladen werden“ (nicht als Strava- oder Firebase-Fehler). Nach dem
  Laden bleibt der Plan für die Sitzung im Speicher.
- **Wochen 9–31 ab 26.10.2026** werden bereits in `plans/hm-2027.json`
  geschrieben. Liegt Schritt 1 dann noch nicht auf `main`, müssen sie
  einmalig nachgezogen werden → Schritt 1 möglichst vor dem 26.10.2026
  ausliefern.
- **Voraussetzung Louis:** API-Key in der Claude Console anlegen, Guthaben,
  monatliches Ausgabenlimit setzen (HANDOFF-v2 C1).
