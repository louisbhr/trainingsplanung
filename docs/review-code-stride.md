# Code-Review Stride-Redesign (Schritt 10)

Stand: 22.10.2026 · Branch `stride-redesign` · Diff `a6e6c4b...9289c5f` (33 Commits E0 bis E9,
dazu der Security-Review-Commit 099a756, der nur `docs/review-security-stride.md` anlegt)
Maßstab: docs/requirements-stride.md (F1–F12, V1/V2 freigegeben), docs/plan-stride.md,
docs/review-architecture-stride.md (Auflagen C1–C11 verbindlich), docs/ui-markup-stride.md,
docs/design-stride/README.md, CLAUDE.md.

**Endurteil nach Korrekturrunde 1: FREIGEGEBEN** (siehe letzter Abschnitt). Erstes Urteil:
**freigegeben mit Auflagen.** Kein Critical-Befund. Drei Important-Befunde sind klein
und lokal (eine Rundungsregel, ein fehlender Wächter-Test, toter Code). Sie blockieren Schritt
11/12 nicht, müssen aber vor dem Merge behoben sein, denn „Done“ verlangt null Important. Dazu
kommen zwei Spec-Abweichungen ohne Fix-Bedarf (Größenziel aus dem Plan verfehlt, `startTime` in
`strava.js`) und acht Minor-Punkte.

## Selbst geprüft (nicht aus Selbstberichten übernommen)

- `npm test` gegen den laufenden Server (:8099) selbst auf 9289c5f: Exit 0, **1125/1125
  Browser-Checks**, alle Node-Suiten grün (zusammen 305 Node-Tests: kraftflow 33, runcompare 18,
  history-data 15, view-run 10, view-history 24, naming 7, static 5 und die alten Suiten).
- **C10 per `git diff a6e6c4b...HEAD`:** `firestore.rules`, `worker.js`, `wrangler.toml`,
  `access.js`, `plan.js`, `runmatch.js` unverändert; `plan-store.js`, `metrics.js`, `coach.js`,
  `export.js`, `firebase-init.js` nur Versionsstempel (keine neuen Exporte). `progression.js` nur
  `progressionChip()` angehängt. `strava.js`: `lastFetchedAt()` und zusätzlich `startTime` in
  `mapActivity` (siehe S2). `main` steht noch auf dem Merge-Base, C9 hat also nichts zu mergen.
- **C4 mit den echten Modulen** (`runcompare.js`, `metrics.js`, `config.js` in Node importiert):
  `formatKm1(8.95)` zeigt „8,9“, `distanceStatus(8.95, 10)` liefert trotzdem `imPlan` (siehe I1).
  Ein Durchlauf über Soll 1 bis 30 km in 0,5er-Schritten und jede Ist-Distanz in Metern findet
  genau die Fälle mit Meterzahl auf …50 an der Schwelle.
- **Tote Exporte/Importe** per Wegwerf-Skript (außerhalb des Repos) über alle Module: jede
  importierte Bezeichnung muss im Modul noch einmal vorkommen, jede Top-Level-Funktion einen
  Aufrufer haben (Ergebnis in I3).
- **Fonts (C3):** SHA-256 beider woff2 selbst gerechnet, stimmt mit `HANDOFF.md` überein;
  Preload-URL und `@font-face`-URL lösen auf dieselbe Adresse auf, `crossorigin` gesetzt,
  `font-weight: 100 900`, `font-display: swap`.
- **XSS:** Alle `${…}` in `view-*.js` ohne `esc()` einzeln angesehen. Freie Texte (Strava-Namen,
  Coach- und Bilanz-Text, E-Mail, UID, Übungsnamen inkl. eigener, Hinweise, Fehlermeldungen,
  Plan-Notizen) laufen durch `esc()`; ohne `esc()` stehen nur Zahlen, feste Texte und
  `dayNameDE/shortDate` (das ist Security-L1, nicht doppelt gezählt). Toasts setzen `textContent`.
- **Ledger (C8):** Szenario-Liste aus `a6e6c4b:tests/app.test.mjs` gegen die neuen
  `scenario("…")`-Aufrufe: kein Szenario fehlt. 26b existiert weiter, zählt aber unter „26“ (M5).
  Einzige dokumentierte Ausnahme ist „Im Detail“ in 2c, einzeln aufgezählt; die
  Re-Kalibrierung ist nach 3c umgezogen.

## Spec-Abweichungen (Stufe 1)

Die Auflagen der Architektur-Prüfung im Einzelnen:

| Auflage | Befund |
| --- | --- |
| C1 Payload | **ok.** `buildLogPayload` (kraftflow.js:190) hält Feldfolge, `topKg`/`totalReps`-Rechnung, `week` nur wenn bekannt; `kg: null` ohne Gewicht, Zeit in `reps`; beim vorzeitigen Abschluss gehen nur `done`-Sätze raus (app.js:1427). 36h vergleicht gegen die E2-Fixture inkl. Altbestand `kg: 0`. |
| C2 Entwurf | **ok.** Schlüssel je Kraft-Tag, Räumen nach > 7 Tagen nur beim Start, kein Räumen beim Öffnen eines anderen Tags (37c), strenge Formprüfung in `parseDraft` (v, focus, Slugs, ≤ 8 Sätze, 0–1000, doneSets), jeder Zugriff in `try/catch`, Firestore gewinnt (37b). Präfix ist in `kraftflow.test.mjs` festgenagelt statt in `naming-guard.test.mjs` (gleichwertig). |
| C3 Schriften | **teilweise.** Dateien, SHA, Preload ok. **Der verlangte Check „jede `url(...)` in style.css verweist auf eine vorhandene Datei“ fehlt** (I2). |
| C4 „zu kurz“ | **teilweise.** Stub-`THRESHOLDS` kommen aus der echten `config.js`, 89/90 % und die 7,14/7,16-Fälle sind getestet. Die Rundung weicht aber von der Anzeige ab (I1). |
| C5 reine Module | **ok.** `view-*.js` importieren nur `ui.js`, `plan.js`, `metrics.js`, `runcompare.js`, `history-data.js`, `runmatch.js` (`view-run.js`, rein) und `view-run.js` (aus `view-history.js`); kein Firebase/Strava/app.js, kein DOM, kein `localStorage`. Kein `style=` (statischer Grep + 40c + Matrix 34). `runmatch.js` steht nicht in der Liste aus C5, ist aber rein und unverändert: akzeptieren. |
| C6 Sheets | **ok.** `createSheet` (ui.js:136) mit eigenem Timer und Rücksprung je Sheet, Wechsel ohne Animation und ohne Fokus-Rückgabe, ein Escape-Handler über `.open`; 2c-2 und 38h decken A→B, B→A und Escape ab. |
| C7 Handoff-Kopie | **fast ok.** `*.dc.html.txt`, `support.js.txt`, kein `.DS_Store`, Hinweis in `HANDOFF.md`. Die verlangte Zeile in `docs/design-stride/README.md`, wie man die Dateien lokal ansieht, fehlt; Z. 11 nennt noch `design/Stride Prototyp.dc.html` und `support.js` (M8). |
| C8 Ledger | **ok** (siehe oben), M5 als Schönheitsfehler. |
| C9 Branch | **ok.** `main` hat sich seit `a6e6c4b` nicht bewegt; vor dem Merge nach der Re-Kalibrierung am 28.10. erneut prüfen. |
| C10 Unverändert | **ok** bis auf S2. Login-Logik (Zugriffsstatus, `waitForPendingWrites`, `LOGOUT_NOTICE_KEY`) unverändert, 30a–30e und 32 behalten ihre Absichten. |
| C11 Zwischenprüfungen | **ok.** run-verifier nach E1, E5, E6 und final; Louis' Probetraining nach E5 („passt“). |

Weitere Abweichungen:

- **S1 Größenziel aus dem Plan verfehlt.** docs/plan-stride.md Z. 22 f.: „`app.js` deutlich unter
  2000 Zeilen, kein Render-Modul über ca. 300 Zeilen“. Ist: `app.js` 2511 Zeilen (vorher 2287),
  `view-kraft.js` 389, `view-history.js` 363, `view-run.js` 356, `view-dashboard.js` 309. Der
  Render-Code ist wirklich draußen; gewachsen ist der Zustand (Satz-Ablauf, Entwurf, Lauf-Tag,
  Sheet). **Akzeptieren für diesen Merge**, kein Fix jetzt. Vorschlag für später: den
  Kraft-Tag-Controller (app.js:949–1557, Zustand + Entwurf + Speichern) in ein eigenes
  `kraft-day.js` ziehen. Das wäre ein Refactor mit Freigabe, gehört nicht in diese Runde.
- **S2 `startTime` in `strava.js`** (strava.js:270). C10 erlaubt dort „nur das lesende
  `lastFetchedAt()`“. Die Zeile ist rein additiv (neues Feld im Laufmodell, nichts bestehendes
  ändert sich, 38a prüft „Name · 07:10“) und im Pipeline-Status zu E6 vermerkt. **Akzeptieren**,
  Louis sollte es aber als bewusste Ausnahme von C10 kennen.
- Plan Z. 87 nennt `aerobeWeeklyData` und `adherence4wData` als „entfällt“. Beide bleiben, weil
  der Coach-Request sie braucht (app.js:723, 816–817). Im Ledger begründet. Akzeptieren.

## Befunde (Stufe 2)

### Critical

Keine.

### Important

**I1 · „zu kurz“ rundet anders als die Anzeige (Auflage C4)** – `runcompare.js:95`
`distanceStatus` rundet mit `Math.round(actualKm * 10)`, angezeigt wird mit `formatKm1` =
`toFixed(1)` (metrics.js:21). Bei Distanzen genau auf …50 m an der Schwelle laufen beide
auseinander: 8950 m bei 10 km Soll zeigen „8,9 km“ und „im Plan“ (8,9 < 9,0), ebenso 5350 m bei
6 km und 9850 m bei 11 km. C4 verlangt ausdrücklich die Bewertung auf der angezeigten Zahl.
Betrifft Heute, Woche (Pille und „Kürzer als geplant“) und Lauf-Tag gleichermaßen.
*Fix:* in `distanceStatus` dieselbe Rundung wie die Anzeige nehmen:
`const shownTenths = Math.round(Number(actualKm.toFixed(1)) * 10);` und in
`tests/runcompare.test.mjs` den Fall `distanceStatus(8.95, 10, …) === "zuKurz"` (und
`formatKm1(8.95) === "8,9"`) ergänzen.

**I2 · Wächter für `url(...)` in style.css fehlt (Auflage C3)** – `tests/naming-guard.test.mjs`
C3 verlangt einen Check, dass jede `url(...)` in `style.css` auf eine vorhandene Datei zeigt,
weil eine falsch benannte Schrift still auf die Systemschrift zurückfällt und sonst kein Test
anschlägt. Es gibt ihn nicht (weder dort noch in einem anderen Test).
*Fix:* in `naming-guard.test.mjs` einen Test ergänzen, der alle `url\(["']?([^"')]+)["']?\)` aus
`style.css` sammelt, `data:`/`http(s):` auslässt und für jeden Pfad `existsSync(join(root, p))`
prüft (mindestens die beiden woff2 müssen dabei gefunden werden, damit der Test nicht leer
grün ist). Nur Testcode, `style.css` bleibt unberührt.

**I3 · Toter Code nach dem Umbau** – `ui.js:11–23`, `app.js:3–5`, `app.js:26`
- Die ganze `ICONS`-Map in `ui.js` hat keinen Nutzer mehr (alle neun Einträge, auch in den
  Tests nicht). `app.js` importiert sie trotzdem.
- `app.js` importiert `phaseRange` und `formatGoal` aus `plan.js`, nutzt sie aber nicht mehr
  (wanderten nach `view-plan.js`). `fromISO` war schon vorher ungenutzt.
*Fix:* `ICONS` aus `ui.js` löschen (Kommentar Z. 11 f. mit), die Importe `ICONS`, `phaseRange`,
`formatGoal`, `fromISO` aus `app.js` entfernen. Danach `npm test`.

### Minor

**M1 · Späte Rücknahme fasst den Speicher-Stand eines neueren Kraft-Tags an** – `app.js:1443`,
`app.js:1456–1457`
`rollbackSave` schreibt in die globale `kraftSaved`. Kommt der späte Fehler, nachdem schon ein
anderer Kraft-Tag offen ist (`kraftSaved` wurde neu zugewiesen), löscht er dort den Eintrag mit
demselben Slug (z. B. „squats“ an beiden Tagen). Folgen sind klein (nur „Zurückholen“/
`refreshExercises` sehen ihn), aber falsch. *Fix:* in `saveKraftExercise` `const savedMap =
kraftSaved;` merken und `rollbackSave` dieses Objekt übergeben statt die globale Variable zu
benutzen.

**M2 · „+ Gewicht“ mit 0 kg überlebt das Neuladen nicht** – `app.js:1201`
`kraftAddWeight` setzt `kg: 0`, der Entwurf wird geschrieben, beim Wiederherstellen schaltet aber
nur `kg > 0` zurück in den Gewichts-Modus. Wer „+ Gewicht“ getippt und noch kein Gewicht
eingestellt hat, landet nach einem Reload wieder im Wdh-Modus. Folgenlos fürs Dokument
(0 → `null`), nur unerwartet. *Fix:* im Entwurf den Modus mitführen (`serializeDraft` um ein
geprüftes `mode`-Feld erweitern) oder bewusst so lassen und im Ledger zu 37a notieren.

**M3 · Icon-Konstanten fünfmal kopiert** – `app.js:90`, `view-kraft.js:16`, `view-run.js:16–18`,
`view-week.js:14–16`, `view-dashboard.js:15–17`, `view-history.js:13`
`I_CHEV_L` steht dreimal identisch, `I_CHEV_R` dreimal, `I_INFO` zweimal; dazu die
Zurück-Zeile (`sd-nav` + `sd-btn--back`) dreimal. *Fix:* die `sd-icon`-SVGs als kleine
`ICONS`-Map neu in `ui.js` (passt zu I3) und einen Helfer `backNavHTML(label)` dort; Klassen
bleiben die des Designers.

**M4 · Lade-Schritte nach dem `try` in `renderKraftDay`** – `app.js:1006–1012`
`buildLogState`/`progressionChip`/`restoreKraftDraft` laufen nach dem `catch`. Wirft dort etwas
(nur bei einem kaputten Log-Dokument denkbar, z. B. `sets: [null]`), bleibt das Lade-Skelett
stehen, und es gibt nur eine unbehandelte Rejection. Das war vor dem Umbau genauso und ist mit
App-geschriebenen Daten nicht erreichbar, daher nur Minor. *Fix:* die Schritte ab
`currentKraftDay = …` in ein eigenes `try` legen und im `catch`
`renderMain(errorCard("Kraft-Tag nicht geladen: " + err.message))` zeigen.

**M5 · 26b zählt unter Szenario 26** – `tests/app.test.mjs:2329`
Der Block 26b ruft kein `scenario("26b")` auf, seine zwei Checks landen unter „26=3“. Das
Ledger führt „26, 26b“ zusammen, die Zählung je Szenario ist damit aber ungenau. *Fix:*
`scenario("26b");` als erste Zeile des Blocks.

**M6 · Exporte ohne Aufrufer in `strava.js`** – `strava.js` `formatPace`, `matchRunForDate`,
`strengthSessions`, `disconnect`, `StravaSetupError`
`formatPace` hatte vor dem Umbau einen Aufrufer (alter Verlauf). C10 lässt in `strava.js` jetzt
nur Ergänzungen zu, also **nicht in diesem Branch** löschen. Nach dem Merge als eigenes
Aufräumen vormerken (Backlog).

**M7 · Doppelte Ansage am Stepper** – `view-kraft.js:119`
Die Zahl im Stepper trägt `aria-live="polite"`, zusätzlich sagt `#kraftLive` „Gewicht 82,5 kg“
an. Weil der Knoten bei jedem Zeichnen ersetzt wird, liest VoiceOver das `aria-live` am neuen
Knoten meist gar nicht vor; es ist also überflüssig und im ungünstigen Fall doppelt. *Fix:*
`aria-live` am `sd-stepper__num` entfernen; `#kraftLive` bleibt die eine Ansage (36j).

**M8 · Ansehen-Hinweis im Handoff-README veraltet (C7)** – `docs/design-stride/README.md:11`
Dort steht noch „`design/Stride Prototyp.dc.html` im Browser öffnen; `support.js` muss daneben
liegen“. Nach C7 heißen die Dateien `….dc.html.txt` und `support.js.txt`, und genau eine Zeile
sollte sagen, wie man sie lokal ansieht. *Fix:* unter Z. 11 ergänzen: „Im Repo tragen die
Prototypen die Endung `.txt` (C7). Zum Ansehen beide Dateien in einen Ordner außerhalb des
Repos kopieren, `.txt` entfernen und die `.dc.html` lokal öffnen, nicht über GitHub Pages.“

## Geprüft, ohne Befund

- **Fehlerwege erreichen den Nutzer:** Strava-Abruffehler (Banner „Strava nicht geladen“, Lauf-Tag
  mit „Nochmal versuchen“/„Neu verbinden“, Konto-Zeile rot), Firestore-Ausfall (Banner „Daten
  nicht geladen“, Kraft-Ladekarte `role=alert`, Lauf-Tag-Firebase-Karte), Speicherfehler
  (Meldung in der Karte + Toast, sofort und spät), Dayplan- und Runlink-Schreibfehler (Toast),
  Coach-Fallback (2e/2f), Plan-404/kaputt (Fehlerkarte mit „Neu laden“).
- **Keine Konsolen-Ausgaben** außer `console.error` in `catch`-Zweigen und dem bestehenden
  Wochen-Wächter in `weekForLog`. Kein `console.log`.
- **Barrierefreiheit:** genau ein h1 je Screen (Matrix 34, 34b/34c), Labels an allen Feldern
  (`label[for]` bzw. umschließendes `label`), `aria-pressed` an Segment und Chips, `aria-expanded`
  an Wochenzeilen und Bilanz im Gleichlauf mit `hidden`, Fokus kehrt nach Sheet, Blättern,
  Kraft-Ablauf und Lauf-Zuordnung an den richtigen Ort zurück, nie auf `body`.
- **Benennung:** `package.json` heißt weiter `hm-tracker`, alle Schlüssel mit `hm-tracker.`;
  sichtbarer Name überall „Stride“ (naming-guard + static-greps).
- Commit-Autor in allen 34 Commits die noreply-Adresse.

## Für den coder (eine Runde)

1. I1: `runcompare.js:95` auf `toFixed(1)`-Rundung umstellen, Testfall 8,95/10 in
   `tests/runcompare.test.mjs`.
2. I2: `url(...)`-Existenz-Test in `tests/naming-guard.test.mjs`.
3. I3: `ICONS` aus `ui.js`, ungenutzte Importe aus `app.js` entfernen.
4. Optional in derselben Runde: M1, M4, M5, M7, M8 (je ein bis drei Zeilen). M3 nur zusammen mit I3,
   M2 und M6 nicht jetzt.

Grenzen: `style.css` nicht anfassen (Designer), C10-Dateien nicht anfassen, danach
`npm run version` und `npm test` komplett. Danach kurze Nachprüfung durch den reviewer.

## Korrekturrunde 1

Behoben (coder, Schritt 10 → 7, Runde 1 von 2):

- **I1 (C4):** `distanceStatus` in `runcompare.js` rundet jetzt mit `Number(actualKm.toFixed(1))`,
  also exakt wie `formatKm1` anzeigt. 8,95 km von 10 km zeigt „8,9“ und ist „zu kurz“; 8,96 zeigt
  „9,0“ und ist „im Plan“. Neue Testfälle in `tests/runcompare.test.mjs` (inkl. 89 %/90 %, die alten
  Fälle bleiben grün).
- **I2 (C3):** `tests/naming-guard.test.mjs` prüft, dass jede `url(...)` in `style.css` auf eine
  vorhandene Datei zeigt.
- **I3:** altes, ungenutztes `ICONS` in `ui.js` ersetzt (siehe M3); ungenutzte Importe `ICONS`,
  `phaseRange`, `formatGoal`, `fromISO` aus `app.js` entfernt (per grep geprüft).
- **Security L1:** `strava.js` lässt als `date` nur `YYYY-MM-DD` durch (`activityDate`), Läufe und
  Krafteinheiten ohne gültiges Datum fallen weg; `startTime` nur als `HH:MM`. Damit ist
  `shortDate(run.date)` an allen Aufrufstellen sicher, ohne die Views anzufassen.
- **M1:** `saveKraftExercise` merkt sich die `kraftSaved`-Map des Tages und reicht sie an
  `rollbackSave` weiter; eine späte Rücknahme berührt die Map eines neueren Kraft-Tags nicht mehr.
- **M2:** Der Entwurf trägt `weightAdded` (nur bei `true`, `serializeDraft`/`parseDraft` in
  `kraftflow.js`, Test dazu); „+ Gewicht“ mit 0 kg überlebt den Reload, `kg: null` im Dokument
  (C1) bleibt unberührt.
- **M3:** Die `sd-icon`-SVGs stehen einmal in `ui.js` (`ICONS`: chat, checkW, chevD, chevL, chevR,
  chevR20, info, refresh) und die Zurück-Zeile als `backNavHTML(label)`; `app.js`, `view-run.js`,
  `view-kraft.js`, `view-week.js`, `view-dashboard.js`, `view-history.js` nutzen sie.
- **M4:** Die Lade-Schritte in `renderKraftDay` laufen in einem eigenen `try`; Fehler zeigen
  „Kraft-Tag nicht geladen: …“ als Fehlerkarte.
- **M5:** `scenario("26b")` gesetzt; Zählung jetzt 26 = 1, 26b = 2. Ledger-Zeile in
  `tests/README.md` angepasst.
- **M7:** `aria-live` am `sd-stepper__num` entfernt; `#kraftLive` bleibt die eine Ansage.
- **M8:** `docs/design-stride/README.md` nennt die `.txt`-Endung und wie man lokal ansieht.

Nicht angefasst: M6 (nach dem Merge), `style.css`, C10-Dateien.

## Nachprüfung Korrekturrunde 1 (reviewer)

Geprüft: `git diff 6bf9d0d..c736c97`, `npm test` selbst auf c736c97 (Exit 0, **1125/1125
Browser-Checks**, 308/308 Node-Tests, vorher 305: je +1 in runcompare, kraftflow und naming),
Tote-Code-Skript erneut über alle Module.

- **I1 behoben.** `distanceStatus` rundet wie `formatKm1`; 8,95/10 → „zu kurz“, 8,96 → „im Plan“,
  alte 89/90-%- und 7,14/7,16-Fälle bleiben grün.
- **I2 behoben.** Der `url(...)`-Test sammelt alle Verweise, ist nicht leer grün (`urls.length > 0`)
  und lässt nur `data:`/`http(s):`/`#` aus.
- **I3 behoben.** Das Skript findet keine ungenutzten Importe oder Funktionen mehr. Die neue
  `ICONS`-Map wird vollständig genutzt (jeder Eintrag hat mindestens einen Aufrufer); das Markup
  der Icons ist Zeichen für Zeichen das bisherige (`chevL` = vorher `I_CHEV_L`/`I_CHEV_L20`).
- **M1, M2, M3, M4, M5, M7, M8 behoben**, wie beschrieben. M2: `weightAdded` nur als echtes `true`,
  `parseDraft` bleibt streng, der Payload (C1) ist unberührt. M4: Fehlerkarte statt Skelett.
- **Security L1** über `activityDate()` in `strava.js`: nur `YYYY-MM-DD`, sonst fällt die
  Aktivität weg; `startTime` nur `HH:MM`. Der Export nutzt die Rohseiten
  (`fetchActivityPages`) und ist nicht betroffen.
- **S3 (neue Spec-Abweichung, akzeptiert):** Damit ändert sich bestehender Code in `strava.js`
  (`mapActivity`, `mapSession`, zwei `filter`), nicht nur Ergänzungen, wie C10 sie zulässt. Die
  Notiz der Korrekturrunde „C10-Dateien nicht angefasst“ stimmt deshalb für `strava.js` nicht
  ganz. Die Änderung ist eng, sicherheitsbegründet und verhaltensgleich für alle echten
  Strava-Daten (die liefern immer ISO-Zeitstempel). Louis sollte sie zusammen mit S2 als
  bewusste Ausnahme von C10 kennen.
- M6 bleibt für nach dem Merge vorgemerkt.

**Endurteil: FREIGEGEBEN.** 0 Critical, 0 Important offen. Offen bleiben nur M6 (nach dem Merge)
und die akzeptierten Spec-Abweichungen S1–S3.
