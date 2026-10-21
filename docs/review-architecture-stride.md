# Architektur-Review: Stride (Umbenennung, Logo, Mobile-Redesign)

**Freigabe Louis 21.10.2026: "alles ja" zu E1–E4** (Gates G1–G6 mit Auflagen C1–C11; Prototyp-Dateien als `.txt`; Text-Button "+ Gewicht"; Freeze auf `main` bis zum Merge, nur Plan-Daten und Hotfixes). Die Auflagen C1–C11 sind verbindlich und gehen dem Plan vor.

Stand: 21.10.2026 · architecture-reviewer · Grundlage: `docs/plan-stride.md` (Entwurf
20.10.2026), `docs/requirements-stride.md` (FREIGEGEBEN, F1–F12 wie empfohlen, V1+V2),
Handoff `design_handoff_stride/README.md`, Code-Stand Branch `stride-redesign` (Basis a6e6c4b):
`app.js`, `ui.js`, `view-*.js`, `config.js`, `progression.js`, `metrics.js`, `strava.js`,
`firebase-init.js`, `plan-store.js`, `tools/bump-version.mjs`, `tests/version.test.mjs`,
`tests/stubs.test.mjs`, `tests/app.test.mjs`, `package.json`, `index.html`, dazu die Dateien
unter `design_handoff_stride/design/`.

## Gesamturteil

**Freigabefähig mit Auflagen (C1–C11).** Der Schnitt stimmt: erst Marke und Fundament, dann
die reine Logik mit Node-Tests, dann Screen für Screen. Nach jeder Etappe bleibt die App
lauffähig, weil alte Klassen erst mit ihrem Screen verschwinden. Kein Schema, keine Regel,
kein Worker, keine Auth-Logik, keine neue npm-Dependency. Das habe ich am Code geprüft
(Abschnitt „Was sich nicht ändern darf“).

Vier Punkte muss der Plan vor dem Start schärfen:

1. **G5 ist nicht ganz zu Ende gedacht.** Beim vorzeitigen Abschließen (F6) stehen in nicht
   gemachten Sätzen schon Startwerte im Stepper. Die dürfen nie geschrieben werden (C1).
   Zeit-Übungen schreiben heute die Sekunden nach `reps`. Das ist belegt und wird jetzt
   festgelegt, nicht erst „vor E5 geprüft“.
2. **G6 löscht in der geplanten Form echte Daten.** „Fremde Datumsschlüssel beim Öffnen eines
   Kraft-Tags räumen“ wirft den halbfertigen Entwurf von heute weg, sobald Louis einen
   vergangenen Tag aus der Woche nachträgt. Geräumt wird stattdessen nach Alter (C2).
3. **Die Handoff-Kopie läuft auf dem Origin der App.** Der Prototyp lädt React und Babel von
   `unpkg.com` und Schriften von Google. Unter `docs/design-stride/` liefert Pages das auf
   `louisbhr.github.io` aus, also auf demselben Origin wie die angemeldete App (E2).
4. **F5 hat eine Einbahnstraße.** Wird eine Übung einmal ohne Gewicht gespeichert (0 kg),
   zeigt der Kraft-Tag danach nur noch den Wdh-Stepper. Für diese Übung lässt sich dann kein
   Gewicht mehr eintragen (E3).

Visual Plan: veröffentlicht der Orchestrator. Der Link wird in `.pipeline-state.md` eingetragen.

---

## Gates G1–G6

| Gate | Urteil | Kurz |
| --- | --- | --- |
| G1 Schriften selbst gehostet | **ok mit Auflage** | Richtig so. Es gibt keinen Service Worker (geprüft), also auch keinen SW-Cache. Pages cacht etwa 10 min. `bump-version.mjs` stempelt nur `style.css`, `app.js`, das Manifest und die JS-Importe, nicht die `url()` in der CSS. Deshalb ist die Version im Dateinamen genau der richtige Weg. Ergänzungen in C3. |
| G2 `THRESHOLDS.lauf.zuKurz = 0.9` | **ok mit Auflage** | Eigener Schlüssel, bestehende Werte bleiben. Bewertet wird auf der angezeigten Genauigkeit, und der Config-Stub wird aus der echten Config erzeugt (C4). |
| G3 Datei-Organisation | **ok mit Auflage** | Flache Module passen zum Repo. `version.test.mjs` und `stubs.test.mjs` lesen das Wurzelverzeichnis nicht rekursiv, `docs/design-stride/support.js` bleibt also außen vor. Wie die Handoff-Kopie abgelegt wird, entscheidet E2. |
| G4 Render-Code aus `app.js` | **ok mit Auflage** | Richtiger Schritt (app.js hat 2287 Zeilen). Render-Module bleiben rein: Daten rein, String raus, kein Zugriff auf Firebase oder Strava (C5). Die Sheet-Fabrik braucht klare Regeln für den Wechsel zwischen zwei Sheets (C6). |
| G5 gleiche Firestore-Dokumente | **ok mit Präzisierung** | Schreibweg geprüft: `saveExercise` → `saveLog` → `setDoc(logs/{datum}_{slug}, …, { merge: true })`. Das Feld-Set bleibt. Ergänzt werden die Regeln für Zeit, Teil-Speichern und den Bestand mit `kg: 0` (C1). |
| G6 Satz-Entwurf in `localStorage` | **ok mit Änderung** | Der Präfix `hm-tracker.` wird beim Abmelden wirklich geräumt (`signOutAndWipeDevice`, `firebase-init.js` Z. 180). Das Aufräumen beim Öffnen wird ersetzt, und die Formprüfung wird konkret (C2). |

---

## Auflagen

### C1 Payload-Regeln für Kraft-Tag B (G5)

Heute gilt (`app.js` Z. 1291–1300): `{ week, name, soll, custom, sets[{kg, reps}], topKg,
totalReps, completed: true }` plus `date`, `exercise`, `updatedAt` aus `saveLog`. Das bleibt
Feld für Feld so, ebenso Doc-ID, `merge: true` und die Berechnung von `topKg`
(`max(kg ?? 0)`) und `totalReps` (`sum(reps ?? 0)`).

- **Ohne Gewicht:** Gewichts-Stepper ausgeblendet oder Wert 0 → `kg: null`. Alle Leser
  (`metrics.js` `topKg > 0`, `progression.js` `k > 0`, Verlauf `topKg > 0`) behandeln 0 und
  `null` gleich. `null` ist also verhaltensgleich und passt zum heutigen leeren Feld.
- **Zeit-Übungen:** Sekunden stehen in `reps`, `kg: null`. Belegt ist das durch
  `progression.js`: `suggestProgression` wertet bei `timeBased` die `reps` als Zeit aus. Das
  gilt ab sofort als festgelegt; die Formulierung „coder prüft vor E4 am Bestand vor E5“ in G5
  entfällt.
- **Vorzeitig abschließen (F6):** `sets` enthält **nur die fertigen Sätze**, die Länge ist
  also n. Startwerte nicht gemachter Sätze werden **nie** geschrieben, weil sie sonst
  `totalReps` und den Verlauf verfälschen. Wird die Übung wieder geöffnet, kommen die
  gespeicherten n Sätze plus die restlichen Sätze laut Soll als offene Sätze.
- **F5-Erkennung (`exerciseMode`):** „letzte Einheit ohne Gewicht“ heißt: alle Sätze mit
  `kg == null || kg <= 0`. Der Bestand kann `kg: 0` enthalten, weil `numOrNull("0")` heute
  0 liefert.
- **Vorher-Payload festhalten:** In **E2** (vor jeder Änderung an der Kraft-UI) wird aus dem
  heutigen Code je ein Payload für drei Fälle gespeichert: alle Sätze gleich, Sätze
  unterschiedlich, Zeit-Übung. Dazu kommt ein Teil-Speichern-Fall aus den neuen Regeln. Der
  E5-Test vergleicht Doc-ID, Feldnamen und Typen gegen diese Fixture. `updatedAt` und `week`
  werden dabei normalisiert.

### C2 Satz-Entwurf (G6, V2)

- **Schlüssel:** `hm-tracker.kraftDraft.<ISO-Datum des Kraft-Tags>` (nicht das Datum von
  heute). Der Präfix kommt in `naming-guard.test.mjs`.
- **Aufräumen nach Alter, nicht nach „fremdem Datum“:** Beim App-Start werden Entwürfe
  gelöscht, deren Datum mehr als 7 Tage vor heute liegt. Außerdem wird der eigene Entwurf
  gelöscht, sobald alle Übungen gespeichert sind oder „Training abschließen“ getippt wird.
  Das Öffnen eines anderen Tags löscht **nichts**. Testfall: ein Entwurf für heute überlebt
  das Nachtragen eines vergangenen Tags.
- **Formprüfung beim Lesen:** `v === 1`; `focus` ist ein String. Übungen aus `ex` werden nur
  übernommen, wenn ihr Slug in der aktuellen Übungsliste steht. `sets` ist ein Array mit
  höchstens 8 Einträgen (wie `setsCountFromSoll`). `kg` und `reps` sind `null` oder endliche
  Zahlen von 0 bis 1000. `doneSets` sind ganze Zahlen innerhalb der Satzzahl. Bei jedem
  Fehler wird der ganze Entwurf verworfen, und das in `try/catch`, weil `localStorage` werfen
  kann. Werte aus dem Entwurf erscheinen im Markup nur als geprüfte Zahlen.
- **R9 bestätigt:** Ein gespeichertes Firestore-Dokument (`completed`) hat Vorrang. Der
  Entwurfseintrag dieser Übung wird dann ignoriert und entfernt.
- Kein Firestore-Feld, keine Synchronisation zwischen Geräten (bewusst).

### C3 Schriften (G1)

- Quelle ist das offizielle Release `vercel/geist-font`, die variablen woff2-Dateien
  **unverändert**: kein Subsetting, keine Umwandlung. So bleibt die OFL ohne
  Umbenennungsfragen erfüllt. `fonts/OFL.txt` kommt aus demselben Release.
- Release-Tag, Download-URL und SHA-256 beider Dateien stehen in `HANDOFF.md` und in der
  Commit-Nachricht.
- `@font-face` mit Gewichtsspanne (`font-weight: 100 900`), `font-display: swap`, Fallbacks
  laut Handoff. Ein `preload` nur mit `crossorigin` und mit **exakt derselben URL** wie in
  `@font-face`, sonst lädt der Browser die Schrift doppelt.
- **Neuer Check** (in `naming-guard.test.mjs`): Jede `url(...)` in `style.css` verweist auf
  eine vorhandene Datei. Eine falsch benannte Schrift fällt sonst still auf die Systemschrift
  zurück, und kein Test merkt es.
- Regel für später: Bei einer neuen Schriftversion bekommt die Datei einen neuen Namen. Eine
  Datei wird nie unter altem Namen überschrieben.
- Größe vor dem Commit messen. Bis etwa 150 KB je Datei ist das unkritisch.

### C4 „zu kurz“ (G2)

- `distanceStatus` bewertet auf der **angezeigten** Genauigkeit (km mit einer
  Nachkommastelle). Sonst steht „7,2 km“ von 8 km auf dem Screen, und trotzdem erscheint
  „zu kurz“. Testfälle: genau 90 % → „im Plan“, 89 % → „zu kurz“, dazu ein Rundungsfall
  knapp unter 7,2 km.
- Der `config.js`-Stub in `tests/app.test.mjs` (Z. 812 ff.) übernimmt `THRESHOLDS` aus der
  echten `config.js` (`JSON.stringify` beim Testaufbau) statt aus einem Literal. Der
  Stub-Wächter prüft nur Namen, nicht die Form. Ein fehlendes `lauf` würde erst im Browser
  als `TypeError` auffallen.

### C5 Modulschnitt und Zuständigkeit (G3/G4)

- `view-*.js` bekommen alles als Parameter und liefern Strings. Sie importieren nur aus
  `ui.js`, `progression.js`, `kraftflow.js`, `runcompare.js`, `history-data.js`, `plan.js`
  und `metrics.js`, **nie** aus `firebase-init.js`, `strava.js` oder `app.js`. Zustand,
  Laden, Speichern und Events bleiben in `app.js`.
- `kraftflow.js`, `runcompare.js` und `history-data.js` haben keinen DOM-Zugriff und kein
  `localStorage`. Das Lesen und Schreiben des Entwurfs macht `app.js` mit
  `serializeDraft`/`parseDraft`.
- Jedes neue Modul kommt **im selben Commit** in `MODULES`. Das erzwingt `version.test.mjs`
  bereits.
- **Kein `style="…"` vom coder.** Nötige dynamische Werte (Range-Balken, Wochenbalken)
  werden nur als CSS-Custom-Property mit geklemmter Zahl gesetzt, z. B.
  `style="--from:12.5%;--to:40%"`. Nie mit Text aus Daten. Die Regeln dazu schreibt der
  Designer. Die Greps aus E9 erlauben genau dieses Muster.
- Aufteilung wie im Plan: Der Designer liefert vor jeder Screen-Etappe CSS und
  `docs/ui-markup-stride.md`, der coder baut genau dieses Markup. Die `ui.js`-Helfer aus E1
  (`checkCircle`, `pill`, …) erzeugen nur Markup mit Designer-Klassen.

### C6 Gemeinsame Sheet-Komponente

- Jedes Sheet hat seinen eigenen Ausblende-Timer und seine eigene Rücksprung-Referenz.
- **Wechsel:** Wird Sheet B geöffnet, solange A offen ist oder gerade schließt, wird A
  **sofort** geschlossen: Timer löschen, `hidden = true` ohne Animation, **kein** Fokus
  zurück an A's Auslöser. Danach öffnet B mit Fokus auf seinem Titel.
- Es gibt einen globalen Escape-Handler, der das gerade offene Sheet schließt. Die Prüfung
  läuft über die `.open`-Klasse, nicht über `hidden` (Lehre aus dem M2-Bug).
- Tests: A→B und B→A ohne Wartezeit, Escape danach, Fokus jeweils auf dem neuen Titel und
  nach dem Schließen auf dem richtigen Auslöser.

### C7 Handoff-Kopie (F11), Umsetzung nach E2

Die Prototyp-Dateien enthalten nur Beispieldaten (geprüft). Sie laden aber beim Öffnen
`react`, `react-dom` und `@babel/standalone` von `unpkg.com` (ohne Integritätsprüfung) und
Geist von `fonts.googleapis.com`. Auf Pages liefe das auf dem Origin der App. Fremder Code
hätte dort Zugriff auf `localStorage` und auf die IndexedDB mit der Firebase-Sitzung. Das
Risiko ist klein, denn es braucht einen kompromittierten CDN-Inhalt und dass Louis die Seite
auf Pages öffnet. Es lässt sich aber ohne Aufwand ganz vermeiden (Empfehlung siehe E2). Wenn
E2 so entschieden wird: `README.md` und `assets/` bleiben normal, die Dateien `*.dc.html` und
`support.js` werden mit der Endung `.txt` abgelegt (Pages liefert sie dann als Text aus).
Eine Zeile in `docs/design-stride/README.md` sagt, wie man sie lokal ansieht. Kein
`.DS_Store`.

### C8 Tests und Ledger

- **Das Ledger führt Prüfabsichten, nicht nur Zahlen.** Je Szenario stehen dort die
  geprüften Verhaltensweisen (z. B. „Mitternacht: Kraft-Log landet auf dem lokalen Datum“)
  mit alter und neuer Fundstelle. Die Zahl der Checks ist nur ein zweites Signal. Checks
  aufzufüllen, damit die Zahl nicht sinkt, ist nicht gewollt. Der reviewer prüft das Ledger
  gegen die Liste der Prüfabsichten.
- Die Ausnahme „Im Detail“ wird im Ledger einzeln aufgezählt. Der Check auf die nächste
  Re-Kalibrierung aus dem Plan-Objekt (heute Z. 335) **zieht um** nach Woche („Tagesdetails
  folgen …“). Er fällt nicht weg.
- **Planunabhängige Fixtures:** Neue Checks zu Platzhalterwochen, `recalibrationDates` und
  „Tagesdetails folgen“ laufen auf einem gerouteten Plan, der aus `REAL_PLAN_JSON` abgeleitet
  ist und eine Platzhalterwoche ausdrücklich setzt. Sonst brechen sie mit der
  Re-Kalibrierung am 28.10. auf `main` (siehe C9).
- **Prüfmatrix (Szenario 34):** Bewusst scrollbare Bereiche (`overflow-y: auto`, z. B. der
  Inhalt eines Sheets) sind von der Prüfung `clientHeight < scrollHeight` ausgenommen. Dafür
  wird geprüft, dass sie wirklich scrollen. Neu dazu: Ganz nach unten gescrollt liegt das
  letzte Bedienelement von `#main` oberhalb der schwebenden Tab-Leiste (nichts verdeckt).
- Der Testlauf darf nicht ausufern: ein Kontext, Screens über den App-Zustand ansteuern statt
  jede Kombination neu zu booten.

### C9 Branch-Hygiene (R7)

- `main` bewegt sich sicher: Re-Kalibrierung am 28.10., Wochen 17–35 bis 22.11. Konflikte
  kommen nicht nur in `plans/hm-2027.json` und beim Stempel. Wahrscheinlich auch in
  `tests/plan-golden.test.mjs` (Fenster bis 31.10., Woche 9 beginnt am 26.10.) und in
  `tests/app.test.mjs`, also genau der Datei, die Stride umbaut.
- Deshalb wird `main` **direkt nach jeder Änderung** in `stride-redesign` gemergt (Merge,
  kein Rebase der Etappen-Commits), nicht erst am Ende. Den Stempel-Konflikt löst
  `npm run version`, danach läuft `npm test` komplett.
- Bis zum Stride-Merge kommen auf `main` nur Plan-Daten und echte Hotfixes, keine UI- oder
  Feature-Arbeit (siehe E4). 1b Meilenstein B folgt danach (F1).

### C10 Was sich nicht ändern darf (prüfbar)

Geprüft: Der Plan berührt `firestore.rules`, `worker.js`, `wrangler.toml`, `access.js`,
`plan.js`, `plan-store.js`, `metrics.js`, `runmatch.js` und `coach.js` nicht.
`firebase-init.js` bekommt keine neuen Exporte. In `strava.js` kommt nur das lesende
`lastFetchedAt()` dazu, in `progression.js` nur `progressionChip()`.

- Vor Schritt 10 prüft der reviewer per `git diff --stat main...stride-redesign`, dass diese
  Dateien unverändert sind. In `strava.js`/`progression.js` darf es nur Ergänzungen geben.
- E8 ändert am Login **nur Markup**. Die Logik für Zugriffsstatus, Anmelden, Abmelden mit
  `waitForPendingWrites`, „Noch nicht übertragene Einträge“ und den Hinweis für den zweiten
  Tab (`LOGOUT_NOTICE_KEY`) bleibt, ebenso ihre Testabsichten (30a–30e, 32).
- Die neue Anzeige der E-Mail in der Konto-Karte läuft durch `esc()`.

### C11 Zwischenprüfungen

- run-verifier-Zwischenläufe wie geplant nach E1 und E5, **zusätzlich nach E6** (neues
  Sheet, Timer-Race).
- R3: Nach E5 testet Louis den Kraft-Tag lokal (Safari, 390 px und 320 px) mit einem
  kompletten Training, bevor E6 beginnt. Das ist ein Prüfpunkt, kein Merge.
- E0: Im Mockup-Nachtrag steht auch der Rückweg aus dem Nur-Wdh-Modus, falls E3 so
  entschieden wird.

---

## Zum Ablauf (skeleton-first)

- Die Reihenfolge E0 → E9 hält die App in jeder Etappe lauffähig. E1 färbt nur um, E2 ändert
  die UI nicht, und jede Screen-Etappe tauscht genau einen Screen. Alte Klassen
  verschwinden mit ihrem Screen.
- Kritischster Übergang ist E3: Die neue Heute-Karte führt noch in den **alten** Kraft-Tag
  (bis E5). Das ist in Ordnung, denn der Einstieg bleibt dieselbe Funktion. Die Abnahme von
  E3 muss trotzdem einmal „Heute → Kraft-Tag (alt) → speichern“ durchklicken.
- `openInfo(title, blocks, trigger)` ändert seine Signatur in E3. Alle Aufrufer werden im
  selben Commit umgestellt (`view-dashboard.js` `infoContent()`).
- Aufwand 10–12 Sitzungen ist realistisch.

---

## Entscheidungen für Louis (Schritt 5)

| Nr. | Frage | Empfehlung |
| --- | --- | --- |
| **E1 (G1–G6)** | Gates G1–G6 wie geplant freigeben, mit den Auflagen C1–C11? Darin enthalten: Geist selbst gehostet mit Version im Dateinamen, `THRESHOLDS.lauf.zuKurz = 0.9`, sieben neue flache Module, `fonts/` und `docs/design-stride/`, Render-Code in `view-*.js`, `kg: null` ohne Gewicht, beim vorzeitigen Abschließen nur die fertigen Sätze, Entwurf in `localStorage` mit Aufräumen nach 7 Tagen. | **Ja.** Kein Schema, keine Regel, kein Worker, keine Dependency. Die Firestore-Dokumente bleiben gleich aufgebaut. |
| **E2 (F11, Sicherheit)** | Die Prototyp-Dateien (`*.dc.html`, `support.js`) laden React/Babel von unpkg und Schriften von Google. Auf Pages liefen sie auf dem Origin der angemeldeten App. Sollen sie als `.txt` abgelegt werden (Pages zeigt sie nur als Text), während README und Assets normal bleiben? | **Ja, als `.txt`.** Die Agenten lesen sie ohnehin als Text, die Originale liegen auf dem Desktop. So läuft auf dem Origin der App nie fremder CDN-Code. Kostet nichts. |
| **E3 (F5)** | Rückweg aus dem Nur-Wdh-Modus: Wurde eine Übung einmal ohne Gewicht gespeichert, zeigt der Kraft-Tag nur noch den Wdh-Stepper. Soll es dort einen kleinen Text-Button „+ Gewicht“ geben, der den Gewichts-Stepper für diese Einheit einblendet? | **Ja.** Sonst sperrt ein einziges vergessenes Gewicht (z. B. bei einer neuen eigenen Übung, die ohne Historie mit 0 kg startet) die Übung dauerhaft auf „ohne Gewicht“. Kommt mit in den Mockup-Nachtrag E0. |
| **E4 (R7)** | Bis zum Stride-Merge auf `main` nur Plan-Daten (28.10., Wochen 17–35) und echte Hotfixes, keine andere UI- oder Feature-Arbeit, und `main` jeweils sofort in den Branch mergen? | **Ja.** `tests/app.test.mjs` wird komplett umgebaut. Jede parallele Änderung daran kostet doppelt. |
