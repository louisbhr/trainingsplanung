# Code-Review M2 – Dashboard, Wochen-Tab, Coach (Dashboard v2, Schritt 1)

Stand: 02.10.2026 · Branch `dashboard-v2-m2` · Diff `10f311c..HEAD` (fd126c5 D0, d6fe916 M2-3 …
a832cc7 M2-10, Korrekturrunde 1: 2f0ced7, ce2e54c, ccd94c6)
Maßstab: docs/plan-dashboard-v2.md (M2, A3–A7, A10, E1–E7), docs/requirements-dashboard-v2.md,
docs/review-architecture-dashboard-v2.md, docs/ui-markup-dashboard-v2.md, HANDOFF-v2 C7,
CLAUDE.md.

**Urteil (Runde 1): nicht freigegeben.** Es gibt 2 kritische Befunde (K1, K2) und 5 wichtige
(I1–I5). Alle Tests sind grün. Die beiden kritischen Fehler fallen trotzdem nicht auf: Die
Browser-Tests ersetzen den Worker durch einen Stub, der jeden Body annimmt. Die Worker-Tests
arbeiten nur mit handgebauten Bodies. Und kein Test lädt das Dashboard nach einem
fehlgeschlagenen Coach-Aufruf ein zweites Mal.

## Selbst geprüft (nicht aus Selbstberichten übernommen)

- `npm test` mit `npm run serve` (:8099) selbst laufen lassen: plan, golden, runmatch,
  progression, version und stubs grün; metrics 28/28, coach 23/23, worker 23/23; Browser
  249/249.
- Wegwerf-Proben (Playwright und Node, außerhalb des Repos, danach gelöscht):
  - **Vertrag Client ↔ Worker:** Die echten `/coach`-Bodies aus einem Dashboard-Lauf
    (07.09.2026) habe ich abgefangen und an `worker.fetch` übergeben. Ergebnis: Der
    `weekly`-Body wird **immer** mit 400 abgelehnt (K1). Der `daily`-Body wird angenommen,
    solange kein `∞` darin steht.
  - **Worker fällt aus, danach Reload:** Die Coach-Karte bleibt dauerhaft bei „Wird
    vorbereitet“ stehen (K2).
  - **Firestore verweigert den Zugriff:** Ampeln, „Im Detail“ und Coach bleiben dauerhaft
    im Skelett-Zustand (I1).
  - **Strava verbunden, aber der Abruf liefert 500:** Die Wochenbilanz wird trotzdem
    angefragt, mit `actualKm: 0` und `sessionsDone: 0` (I2).
  - **Ein einziger Dashboard-Start:** Er löst 5 parallele Abrufe von
    `/athlete/activities` aus, bei abgelaufenem Token zusätzlich 5 parallele `/refresh`
    (I3).
  - Alle Plan-Strings (Phasen, Wochentypen, Einheiten, Übungsnamen der Wochen 1–8) passen
    durch die Zeichen-Whitelist des Workers.
- Worker `/exchange` und `/refresh`: Ich habe den Code gegen `10f311c` verglichen. Die
  Logik ist unverändert, nur die CORS-Funktion bekommt den Pfad mit. Ist
  `ALLOWED_ORIGINS` leer, sind sie weiter offen (`*`), `/coach` antwortet dann mit 403.
- Firestore: `logs/{datum}_{slug}`, `dayplans/{datum}` und `runlinks/{datum}` sind
  unverändert. `saveExercise` schreibt nie `week: null` (`...(week != null ? { week } : {})`).
  Neu sind nur `coach/{datum}` und `coachweek/{planId}_W{n}`, beide mit `merge: true`.
- A7: In `metrics.js` und in den neuen Fenstern von `app.js` (Kraft-Fenster, Adhärenz) gibt
  es keine Millisekunden-Arithmetik. Alles läuft über `addDays`.

## Stufe 1 – Spec-Abweichungen (keine Code-Defekte)

- **S1 Abnahmetests aus dem Plan fehlen** (M2-3, M2-9).
  - Kein Strava-Stub-Test „200 + 13 Aktivitäten → 2 Seiten“ (A6).
  - Kein Test „Ampel und `suggestProgression` sind konsistent“.
  - Kein Test, der wirklich eine Deload-Einheit überspringt. Der Test
    `metrics.test.mjs:163` heißt zwar so, enthält aber gar keinen Deload-Eintrag. Der
    eigentliche Filter steckt in `app.js` `kraftHistoryByExercise` und ist nirgends
    getestet.
  - Die DST-Tests (`metrics.test.mjs:132/138`) legen die Läufe 3 bzw. 33 Tage vor
    „heute“, also weit weg von den Fenstergrenzen. Sie würden einen Off-by-one an den
    Grenzen (−6/−7, −34/−35) nicht bemerken.
  - Fix-Anweisung steht bei I5.
- **S2 `wrangler.toml` nennt das neue Secret nicht.** Laut Plan bekommt es in M2 einen
  Hinweis auf `ANTHROPIC_API_KEY`. Fix: Kommentarzeile
  `#   npx wrangler secret put ANTHROPIC_API_KEY   # eigener Workspace, Limit ~5 USD (E2)`.
- **S3 `app.js` hat 1947 statt ca. 900 Zeilen** (E4). Die Bewertung steht bei I4.
- **S4 Doku (README, HANDOFF, tests/README) ist noch nicht nachgezogen.** Das gehört laut
  Plan zu M2-11 und gilt hier nicht als Befund. Es bleibt aber auf der Liste: Abschnitt 6
  braucht die Deploy-Schritte, `tests/README.md` die neuen Suites.
- **Kraft „ok“ wird an den Worker als „steigt“ gemeldet:** tragbar, siehe M4.

## Stufe 2 – Befunde

### Critical

**K1 Die Wochenbilanz über die API kann nie gelingen: Der Worker lehnt jeden echten
`weekly`-Body mit 400 ab.**
`app.js:729` übergibt `adherence4w: adherence`. Das ist der Rückgabewert von
`metrics.adherence4w()` (`metrics.js:181-184`), also `{ pct, done, planned }`. Der Worker
erlaubt nur `["done", "planned"]` (`worker.js:125`). `pct` ist ein Zusatzfeld und führt zu
400. Die Probe zeigt es: Mit dem echten Body kommt 400, nach Entfernen von `pct` kommt 200.
Folgen:
- Die Wochenbilanz wäre nach dem Deploy immer der Regel-Fallback.
- Jeder Versuch verbraucht ein `generations` der Bilanz-Woche.

Fix (coder):
1. In `fillWeeklyBilanz` `adherence4w: { done: adherence.done, planned: adherence.planned }`
   übergeben.
2. Dieselbe Stelle, gleiche Fehlerklasse: `belastung.ratio` kann `Infinity` sein
   (`metrics.js:95`). `JSON.stringify` macht daraus `null`, der Worker antwortet 400.
   Außerdem steht dann im Detail `"Verhältnis ∞"`, das nicht auf der Whitelist steht und
   auch den `daily`-Body kippt. Lösung: Liefert `belastung()` kein endliches Verhältnis,
   gibt es `{ status: "rot", ratio: null, detail: "Verhältnis über 9,99" }` o. ä. zurück
   (nur Whitelist-Zeichen). Im weekly-Body dann `ratio: 0` senden oder den Wert auf 9,99
   kappen.
3. **Vertragstest** in `tests/worker.test.mjs` oder als neuer Node-Test:
   - `coach.buildDailyInput(...)` und `coach.buildWeeklyInput(...)` mit realistischen
     Daten aufrufen, und zwar so, wie `app.js` sie zusammensetzt. Dazu gehören die echten
     Rückgaben von `metrics.adherence4w`, `metrics.belastung` (auch der ∞-Fall) und
     `metrics.kraftProgression().results`.
   - Das Ergebnis durch `worker.fetch` schicken und 200 erwarten.
   - Damit das ohne Browser geht, die Zusammensetzung aus `fillCoach` und
     `fillWeeklyBilanz` (Felder → Input) in reine Funktionen ziehen, siehe I4.

**K2 Nach einem fehlgeschlagenen Coach-Aufruf hängt die Coach-Karte beim nächsten Laden
dauerhaft im Platzhalter. Hatte das Dokument vorher einen Text, wird stattdessen ein
veralteter KI-Text als aktuell gezeigt.**
Ursache:
- `coach.js:177` schreibt vor dem Aufruf `{ inputHash: hash, …, text: doc?.text ?? null }`.
- Scheitert der Worker (offline im Gym, nicht deployt, 502, lokal immer), bleibt das
  Dokument mit dem neuen Hash und `text: null` (oder dem Text eines alten Inputs) liegen.
- Beim nächsten Laden mit gleichem Input gilt `decideGeneration` (`coach.js:92`) als
  „reuse“ und gibt `text: null` zurück.
- `renderCoachSlot` (`app.js:583`) kehrt bei `null` sofort zurück, und das Skelett bleibt.

In der Probe ist das reproduziert: Der erste Lauf zeigt den Fallback, nach dem Reload steht
nur noch „Wird vorbereitet. Das Dashboard wartet nicht darauf.“. Für die Wochenbilanz gilt
derselbe Mechanismus. Das verletzt A4 und die Abnahme M2-9 („Worker abgeschaltet → Fallback
erscheint“). Nach meinem M1-Maßstab zählt ein Hänger ohne Abschluss als Critical.

Fix (coder), `coach.js` `requestCoach`:
1. Der Schreibvorgang vor dem Aufruf zählt nur noch den Versuch:
   `saveDoc({ generations, attemptAt: Date.now(), model, promptVersion })`. **Kein**
   `inputHash` und **kein** `text` (`saveCoach` nutzt `merge: true`, die alten Werte
   bleiben also erhalten).
2. Erst nach Erfolg `inputHash`, `text` und `generatedAt` schreiben, wie bisher in Zeile
   194.
3. `decideGeneration`: `reuse` nur bei `doc.inputHash === currentHash && doc.text`.
4. Das Ergebnis:
   - Ein fehlgeschlagener Versuch wird beim nächsten Laden erneut versucht, aber nur bis
     zum Limit.
   - Danach greift `limited`: Es erscheint der letzte echte KI-Text des Tages (A4), sonst
     der Fallback.
5. Zusätzlich in `fillCoach`/`fillWeeklyBilanz`: Bei `result.text == null` den
   `fallbackText` nehmen. Das ist der Gürtel zu den Hosenträgern.
6. Tests:
   - Node: Nach einem Fehlschlag mit In-Memory-`loadDoc`/`saveDoc` (echter Zustand
     zwischen zwei `requestCoach`-Aufrufen) liefert der zweite Aufruf einen Text, nie
     `null`.
   - Nach 3 Fehlschlägen kommt `limited`, und es gibt keinen weiteren Aufruf.
   - Browser: Szenario „Worker bricht ab → Reload → Coach-Karte zeigt Text, kein
     Skelett“.

### Important

**I1 Bei einem Firestore-Ausfall bleiben Ampeln, „Im Detail“ und Coach dauerhaft im
Skelett-Zustand.**
`fillAmpeln` (`app.js:388-412`), `fillDetail` (`app.js:502-543`) und `fillCoach`
(`app.js:596-656`) holen alles über `ensureAllLogsAndDayPlans()`. Wirft das, landet der
Fehler im `catch` (nur `console.error`), und der Platzhalter bleibt stehen. Bestätigt mit dem
Firestore-Stub aus Test 9, verbunden und nicht verbunden.
Plan M2-4 („Ein Firebase-Ausfall leert das Dashboard nicht“) und Architektur-Review
(„Ampeln mit Kraftdaten grau, Rest rendert“) verlangen etwas anderes.

Fix:
1. In allen drei Funktionen `ensureAllLogsAndDayPlans()` einzeln mit `try` absichern. Bei
   Fehler mit `logs = null` weiterrechnen:
   - Kraft-Progression wird grau mit „Kraftdaten nicht geladen“.
   - Der Kraftteil des Wochensolls zählt nicht.
   - Easy-Disziplin und Belastung rechnen normal.
2. In „Im Detail“ ist die Adhärenz-Kachel dann grau oder fehlt, Volumen und Effizienz werden
   gerendert.
3. Der Coach geht in diesem Fall direkt auf `fallbackDaily(ampeln)`: Ist das
   Coach-Dokument ohnehin nicht lesbar, gibt es ohnehin keinen Aufruf.
4. Browser-Test: Firestore-Stub „boom“ auf dem Dashboard. Belastung zeigt einen echten
   Status, Kraft ist grau, die Coach-Karte zeigt Text, kein `.skel` bleibt nach 3 s übrig.

**I2 Ein Strava-Fehler wird als „0 km gelaufen“ gewertet: Ampeln und Coach melden ein
falsches Rot, und die Wochenbilanz wird trotz fehlender Strava-Daten erzeugt.**
`loadStrava` setzt `connected = true`, bevor `fetchRecentRuns` wirft (`app.js:1258-1259`).
Danach gilt `runs = null` und `error` ist gesetzt. Folgen:
- `fillWeeklyBilanz` prüft nur `!!stravaState.connected` (`app.js:708`) und sendet in der
  Probe `actualKm: 0, sessionsDone: 0`. Damit verbraucht es eine der 2 Generationen und
  speichert eine falsche Bilanz. Das widerspricht F6 („nicht aus einem Zustand ohne
  Strava-Daten“).
- `computeRealAmpeln` rechnet das Wochensoll mit 0 km. Das ergibt Rot, und dieses Rot geht
  als `daily`-Checkpoint an die KI.

Fix:
1. Eine Hilfsfunktion `stravaReady()` einführen:
   `stravaState.connected === true && Array.isArray(stravaState.runs) && !stravaState.error`.
2. `weeklyDue({ hasStrava: stravaReady() })`.
3. In `computeRealAmpeln` bei `!stravaReady()` die Lauf-Ampeln grau setzen: Easy grau,
   Belastung grau, Wochensoll nur aus dem Kraftteil. Detail: „Strava nicht geladen“ bzw.
   „Strava nicht verbunden“.
4. Test: Strava-Stub mit 500 → keine `weekly`-Anfrage, Wochensoll nicht rot.

**I3 `loadStrava` ist nicht gegen parallele Aufrufe geschützt: 5 Strava-Abrufe pro
Dashboard-Start, bei abgelaufenem Token 5 parallele Refreshes.**
`paintDashboardMain` startet fünf `fill*`-Funktionen, und jede ruft `loadStrava()` auf. Der
Wächter `stravaState.connected !== null` (`app.js:1254`) greift erst, wenn der erste Aufruf
fertig ist. Den Cache in `fetchRecentRuns` gibt es ebenfalls erst danach. In der Probe sind
es 5× `/athlete/activities` und mit abgelaufenem Token 5× Worker-`/refresh` mit demselben
Refresh-Token. Das kostet Strava-Ratelimit (100 Abfragen pro 15 Minuten, bis zu 5 Seiten pro
Abruf). Außerdem entsteht bei der Token-Rotation ein Wettlauf um `saveStravaTokens`.
Fix: In `loadStrava` ein Modul-Promise `stravaLoading` merken. Läuft schon ein Laden (ohne
`force`), dieses Promise zurückgeben und es im `finally` zurücksetzen. Test: Zähler im
Strava-Stub, ein Dashboard-Start ergibt genau 1 Abruf.

**I4 Wartbarkeit von `app.js` (1947 Zeilen statt ca. 900 laut E4): sechsfach kopierte
Logik für „Kraft erledigt“ jetzt beheben, die Auslagerung bewusst später.**
Bewertung:
- Die Größe allein ist **tragbare Schuld bis nach M2**. Die View-Module sind sauber
  ausgelagert. Gewachsen ist der Datenkleber für das Dashboard (`app.js:137-770`, rund 630
  Zeilen), und den hat der Plan in `app.js` vorgesehen.
- Ein neues Modul ist eine Änderung an der Datei-Organisation. Das soll nicht nebenbei in
  der Korrekturschleife passieren.
- Die Frist am 26.10. hängt seit E6 nicht mehr an M2.

Wirklich riskant ist die **Duplikation**. Die Regel „alle Übungen der effektiven Liste
geloggt“ steht sechsmal fast gleich da: in `computeRealAmpeln`, `adherence4wData`,
`fillCoach`, `weeklyKraftData`, `buildWeekDayRow` und `renderWeek`. Ändert sich die Regel
(z. B. für eigene Übungen oder in 1b), laufen Ampel, Adhärenz, Wochen-Tab und Coach
auseinander.

Fix jetzt (ohne neue Datei):
1. Eine Funktion `kraftProgressOn(session, logs, dps) → { done, total, complete }` in
   `app.js`, und alle sechs Stellen rufen sie auf.
2. Die Input-Zusammensetzung aus `fillCoach`/`fillWeeklyBilanz` in reine Funktionen
   `dailyInputFrom(...)`/`weeklyInputFrom(...)` ziehen. Die brauchen keinen DOM- oder
   Modul-Zustand, nur Parameter. Das ist auch die Voraussetzung für den Vertragstest
   aus K1.

Später (nach dem M2-Merge, vor 1b, mit Louis' OK als Datei-Organisation):
`dashboard-data.js` mit `computeRealAmpeln`, `adherence4wData`, `aerobeWeeklyData`,
`nextUpLines`, `weeklyRunData`, `weeklyKraftData`, `kraftHistoryByExercise` und
`lastAssignedEasyRuns`. `runAssignment` wird als Parameter übergeben. Damit sinkt `app.js`
um rund 350 Zeilen. Bis dahin bitte in HANDOFF unter „Bekannte Schuld“ festhalten.

**I5 Grenzwerte stehen fest im Code statt aus `THRESHOLDS`, und es fehlen Tests (Abnahme
M2-3: „eine Änderung in THRESHOLDS kippt den Status“).**
- `metrics.js:68`: `r.over > 8` ist fest eingetragen. Das Info-Sheet zeigt dagegen
  `THRESHOLDS.easy.gelbMaxOver`. Ändert man die Schwelle, widersprechen sich Sheet und
  Ampel. Fix: `r.over > THRESHOLDS.easy.gelbMaxOver`.
- `metrics.js:86`: `addDays(todayISO, -27)` ist fest eingetragen, und
  `THRESHOLDS.belastung.minHistoryDays` (28) wird nirgends genutzt. Fix:
  `addDays(todayISO, -(THRESHOLDS.belastung.minHistoryDays - 1))`. Das Info-Sheet leitet
  „4 Wochen“ daraus ab.
- Tests, die nachzuziehen sind (S1):
  - Easy und Belastung kippen bei geänderter Schwelle.
  - Belastung mit Läufen genau auf den Fenstergrenzen (heute −6 zählt zu den 7 Tagen,
    −7 zu den 28 Tagen, −34 zählt, −35 nicht), einmal über den 25.10.2026 und einmal über
    den 28.03.2027.
  - Strava-Paginierung 200 + 13 → 2 Seiten, im Node-Test mit `fetch`-Stub oder im
    Browser.
  - Ein Test für `kraftHistoryByExercise` mit einer echten Deload-Einheit, z. B. Soll
    „2x8 (Deload)“: Sie wird übersprungen, und die Stagnation wird nicht unterbrochen.
  - Ein Konsistenztest: Für jede Einheit, die `suggestProgression` mit `level: "down"`
    bewertet, liefert die Ampel `unterSoll` und umgekehrt. Achtung: Sätze mit `reps: 0`
    behandeln beide unterschiedlich, siehe M3.

### Minor

- **M1 Wochenbilanz: Der Hash ändert sich täglich.** `nextWeek.keySession =
  nextSessionLabel(plan, iso)` (`app.js:730`), dazu Belastung, Adhärenz und Kraftfenster
  jeweils ab *heute*. Dadurch verbraucht schon der Dienstag die 2. Generation, ohne dass
  sich die bilanzierte Woche geändert hat. Außerdem ist `keySession` die nächste Einheit ab
  heute statt der Schlüsseleinheit der neuen Woche (F6-Beispiel: „Sa: Long Run 13 km“).
  Fix: Alles auf den Sonntag der bilanzierten Woche beziehen, und `keySession` ist der Long
  Run der neuen Woche (sonst die erste Laufeinheit).
- **M2 `fallbackWeekly` bei grauer Belastung** (`coach.js:138-139`): Da steht „Die
  Belastung steht auf Gelb (Verhältnis 0)“. Außerdem kommt die Zahl im JS-Format
  („0.72“). Fix: Nur bei `gelb`/`rot` ausgeben und das Komma-Format nutzen.
- **M3 `reps: 0` wird unterschiedlich behandelt.** `metrics.js:110/117` zählen einen
  0-Wdh-Satz als „unter Soll“, `suggestProgression` filtert `reps > 0`. Fix: In
  `classifyExercise` dieselbe Filterung wie in `progression.js:49`.
- **M4 Kraft „ok“ wird zu „steigt“** (`app.js:695`). Tragbar: Laut F5 ist „ok“ ausdrücklich
  „steigt oder baut Wdh aus“, und bei Double Progression ist der Wdh-Aufbau Fortschritt.
  Falsch wird es nur nach einer Gewichtsreduktion, dann meldet die Bilanz „steigt“. Ein
  günstiger Fix für M2-11: `classifyExercise` liefert zusätzlich
  `trend: last.topKg > prev.topKg ? "steigt" : "haelt"`, und `weeklyKraftData` mappt „ok“
  auf diesen Trend.
- **M5 Statische Inline-Styles in den neuen View-Modulen** gegen die Regel in
  ui-markup Z. 19 („nie für statisches Layout“):
  - `view-dashboard.js:64` (`margin-top:8px`)
  - `view-dashboard.js:72-76` (`margin-top`, viermal `font-size:18px`, aus dem Altcode
    kopiert)
  - `view-dashboard.js:135` (`margin-top:6px`)
  - `view-dashboard.js:210` (`height:90px`/`60%`)
  - `view-week.js:20` (`display:block;margin:8px auto 0`)

  Die übrigen Inline-Styles (Balkenhöhen, Prozentbreiten, `kindColorVar`,
  Status-Icon-Farben, Skelett-Breiten) gibt ui-markup selbst vor, sie sind in Ordnung. Fix:
  Der frontend-designer legt in M2-11 die Klassen an (`.metric-value.sm`,
  `.week-today-btn`, `.mt-8` o. ä.), danach ersetzt der coder die Styles.
- **M6 `COACH_MODEL`/`COACH_PROMPT_VERSION` stehen doppelt im Client** (`app.js:30-31`).
  Der Worker liefert `model` und `promptVersion` in der Antwort mit. Fix: Bei Erfolg diese
  Werte ins Dokument schreiben, dann gibt es die Konstante wirklich nur einmal (A10-Geist).
- **M7 `toggle-today-exercises` rendert das ganze Dashboard neu** (`app.js:1825`). Jeder Tap
  auf „Starten“ startet alle `fill*` erneut (Coach-Dokument lesen, Hash, Skelett-Flackern,
  `bilanzExpanded` wird zurückgesetzt). Fix: Nur `#today-slot` neu zeichnen
  (`refreshTodaySlot`).
- **M8 Toter Ternär** `app.js:393` (`"kein aktiver Plan" : "kein aktiver Plan"`).
- **M9 Platzhalterwoche: Alle drei Plan-Ampeln werden grau** (`app.js:398-399`). F5 verlangt
  das nur für das Wochensoll. Easy und Kraft könnten aus den Vorwochen rechnen. Praktisch
  irrelevant, sobald die Wochen 9–31 ab 26.10. ausformuliert sind. Bewusst stehen lassen
  oder beim Ausformulieren mitziehen.
- **M10 Worker: Zahlen im weekly-Schema ohne Bereichsprüfung** (`worker.js:103-127`). F6
  verlangt „Zahlenbereiche“. Es kann kein Text eingeschleust werden, das Risiko ist also
  gering. Fix: Grobe Grenzen setzen (km 0–500, HF 30–250, Sessions 0–14, ratio 0–20).
- **M11 Eigene Übungsnamen mit Zeichen außerhalb der Whitelist** (z. B. `#`, `&`, `"`) oder
  über 40 Zeichen führen zu 400 und damit zum Fallback, und sie verbrauchen Versuche.
  Fix: Clientseitig vor dem Senden bereinigen (Zeichen raus, kürzen).

## Positiv

- Der Worker setzt A3 sauber um:
  - Der Body wird als Text gelesen und die Byte-Länge vor dem Parsen geprüft.
  - Feld-Whitelist pro Schema, Zeichen-Whitelist und Zeilenumbruch-Verbot.
  - Der Zielsatz kommt nur aus Enum-, Regex- und Zahlenwerten, die Eingabe steht als
    markierter JSON-Block.
  - `stop_reason` (`refusal`/`max_tokens`) wird geprüft, gelesen werden nur `text`-Blöcke.
  - Modell, Version und `max_tokens` sind Konstanten, Upstream-401 wird getrennt geloggt.
- `·` ist in der Whitelist sinnvoll ergänzt: Der Client erzeugt das Zeichen selbst, es
  schafft keine neue Struktur im Prompt und keinen Ausbruch aus dem JSON-Block. Ich
  akzeptiere das als begründete Abweichung von A3. Die Liste in A3 bitte in der Plan-Doku
  nachtragen.
- Der Systemprompt entspricht HANDOFF-v2 C7. Abweichungen sind nur der zusammengesetzte
  Zielsatz (gewollt) und „Krafteinheiten“ statt „zwei Ganzkörper-Krafteinheiten“ (für
  Schritt 2 sinnvoll generisch).
- A4 ist im Kern richtig:
  - Gezählt wird vor dem Aufruf.
  - Ist das Dokument nicht les- oder schreibbar, gibt es keinen Aufruf.
  - Die Limits 3/2 kommen aus `THRESHOLDS`.
  - Coach-Fehler erscheinen nie als Fehlerkarte.
  - Im Zustand „Bis zum Rennen“ und ohne Plan gibt es keinen Aufruf.
- A5: Alle Coach-Texte, Bilanzen und Info-Sheets laufen über `esc()`. Der `<img onerror>`-Test
  ist echt.
- `metrics.js` ist rein und gut kommentiert. Die Kraft-Logik bildet F5 treu ab (Schema-Wechsel
  startet die Zählung neu, `stallSessions` und `minExercisesWithData` kommen aus
  `THRESHOLDS`, Soll des Log-Tages).
- `hfMax` kommt aus der Plan-Einheit.
- Kein bestehender Browser-Check wurde gestrichen (151 → 249).

## Fix-Liste für den coder (Runde 1 → 2)

Pflicht vor erneutem Review: K1, K2, I1, I2, I3, I5 sowie I4 Teil „jetzt“ (Hilfsfunktion für
„Kraft erledigt“ und reine Input-Builder). Jeder Punkt bekommt mindestens einen Test, der vor
dem Fix rot gewesen wäre. Die Minor-Punkte sind freiwillig, sinnvoll gebündelt mit M2-11.
