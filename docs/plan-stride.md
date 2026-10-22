# Umsetzungsplan: Stride (Umbenennung, Logo, Mobile-Redesign)

Stand: 20.10.2026 · Planner · **FREIGEGEBEN 21.10.2026** (Louis "alles ja" zu E1–E4; Auflagen C1–C11 aus `docs/review-architecture-stride.md` gehen vor)
Grundlage: `docs/requirements-stride.md` (FREIGEGEBEN 20.10.2026, F1–F12 wie empfohlen, V1+V2
im Umfang, V3 Backlog). Optik verbindlich: Handoff `design_handoff_stride/README.md` (ab Etappe 1
unter `docs/design-stride/`). Format wie `docs/plan-dashboard-v2.md` / `docs/plan-login-1b.md`.

## Ziel

Die App heißt sichtbar **Stride**, trägt das Zeichen „Kadenz“ und bekommt für alle sieben Screens
das neue mobile UI (Kraft-Tag B „Fokus“, Lauf-Tag B „Vergleich“). Fachlogik, Firestore-Dokumente,
Regeln, Worker, `metrics.js`-Rechnungen, bestehende `THRESHOLDS`-Werte und Plan-Format bleiben.
Ein Branch, intern in Etappen committet, ein Merge nach Louis' Test (F12).

## Ansatz (Kurzfassung)

- **Erst Fundament, dann Screen für Screen.** Etappe 1 bringt Name, Logo, Schriften, Tokens und
  die gemeinsamen Bausteine. Alte Screens laufen darauf weiter (alte Klassen bleiben bis zu ihrer
  Ablösung). Etappe 2 liefert alle neuen **reinen Funktionen** samt Node-Tests, ohne UI-Änderung.
  Danach wird je Etappe genau ein Screen getauscht; nach jeder Etappe ist `npm test` grün.
- **Render-Code aus `app.js` heraus** in flache `view-*.js`-Module (Template-Strings, `esc()`),
  `app.js` behält Zustand, Laden und Event-Verdrahtung. Ziel: `app.js` deutlich unter 2000
  Zeilen, kein Render-Modul über ca. 300 Zeilen.
- **Kopf:** `#header` bleibt als DOM-Platz (Tests und Render-Code schreiben hinein), scrollt aber
  mit dem Inhalt mit (nicht fixiert), Abstand oben über `env(safe-area-inset-top)`. Auf Kraft-
  und Lauf-Tag setzt der coder `#app.is-detail`; der Designer blendet darüber die Tab-Leiste aus.
- **Ein Sheet-Mechanismus für beide Sheets:** `ui.js` bekommt `createSheet(sheetId, backdropId)`
  mit eigenem Ausblende-Timer je Sheet (Timer-Race-Fix aus M2 gilt damit für beide), Fokus auf
  den Titel (`tabindex="-1"`), Rückgabe an den Auslöser. Öffnen eines Sheets schließt das andere
  sofort. Escape schließt das offene Sheet. `#infoSheet` behält seine ID, neu `#assignSheet`.
- **Firestore-Dokumente bleiben gleich.** Kraft-Tag B schreibt weiter über `saveLog()` dasselbe
  Payload (`week, name, soll, custom, sets[{kg,reps}], topKg, totalReps, completed`). Regel für
  Stepper ohne Gewicht: Gewichts-Stepper ausgeblendet → `kg: null` wie bisher bei leerem Feld
  (siehe Gate G5).

---

## Approval-Gates (für architecture-reviewer, Bestätigung durch Louis in Schritt 5)

| Nr. | Gate (CLAUDE.md) | Vorschlag |
| --- | --- | --- |
| **G1** | Externe Abhängigkeit (Asset) | **Geist + Geist Mono selbst gehostet** (F2): je eine variable woff2 aus dem offiziellen Release `vercel/geist-font` (GitHub), Version beim Download festhalten, Datei mit Version im Namen (`fonts/Geist-Variable-<ver>.woff2`, `fonts/GeistMono-Variable-<ver>.woff2`), dazu `fonts/OFL.txt`. Kein npm-Paket, kein Drittanbieter-Aufruf zur Laufzeit, `font-display: swap`, Fallbacks laut Handoff. Versionsname im Dateinamen ersetzt einen Versionsstempel (`bump-version.mjs` bleibt unverändert). Größe vor Commit messen (Erwartung je Datei unter 100 KB). |
| **G2** | Konfiguration/Grenzwert | **Neuer Schlüssel `THRESHOLDS.lauf = { zuKurz: 0.9 }`** in `config.js` (F8). Reine Anzeige, wirkt nicht auf Ampeln, Wochensoll oder „verpasst“. Bestehende Werte unverändert. Der `config.js`-Stub in `tests/app.test.mjs` bekommt den Schlüssel im selben Commit. |
| **G3** | Datei-Organisation | Neue flache Module `kraftflow.js`, `runcompare.js`, `history-data.js`, `view-kraft.js`, `view-run.js`, `view-history.js`, `view-plan.js` (alle in `MODULES`). Neue Ordner `fonts/` und `docs/design-stride/` (README, Regelbogen, Prototyp, GlassIcon, `support.js`; ohne `.DS_Store`). Assets ins Wurzelverzeichnis (`icon.png` ersetzt, neu `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `stride-mark.svg`, `stride-mark-dark.svg`, `check.svg`). Neuer Test `tests/naming-guard.test.mjs`, in `npm test` aufgenommen. |
| **G4** | Major Refactor | `app.js` gibt den Render-Code für Kraft-Tag, Lauf-Tag, Verlauf und Plan an eigene Module ab; Info-Sheet wird zur gemeinsamen Sheet-Komponente. Verhalten, Speicherpfade und Ladereihenfolge bleiben. |
| **G5** | Datenidentität (kein Schema) | Gewicht 0 bzw. ausgeblendeter Gewichts-Stepper schreibt `kg: null`, nicht `0`. So bleibt die F5-Erkennung „letzte Einheit ohne Gewicht“ stabil und die Dokumente sehen aus wie heute bei leerem Feld. Zeit-Übungen schreiben die Sekunden in dasselbe Feld wie heute (coder prüft vor E4 am Bestand vor E5). |
| **G6** | Neuer lokaler Zustand | **V2 Satz-Entwurf** in `localStorage` unter `hm-tracker.kraftDraft.<datum>` (Präfix → Abmelden räumt mit). Inhalt nur `{ v:1, focus, ex: { slug: { sets, doneSets } } }`, beim Lesen form-geprüft (try/catch, unbekannte Form = verwerfen). Gelöscht, sobald alle Übungen des Tags gespeichert sind oder „Training abschließen“ getippt wird; fremde Datumsschlüssel werden beim Öffnen eines Kraft-Tags geräumt. Kein Firestore-Feld. |

**Kein Gate berührt:** kein Firestore-Schema, keine Regel, kein Worker-/Endpunkt-Wechsel, keine
Auth-Änderung, **keine neue npm-Dependency** (Playwright und http-server sind schon
devDependencies). Kleine interne Erweiterungen ohne Gate: `strava.js` exportiert
`lastFetchedAt()` (für „Sync heute 07:12“), `progression.js` bekommt eine zusätzliche Funktion.

---

## 1. Datei-Map

### Neu

| Datei | Etappe | Inhalt |
| --- | --- | --- |
| `docs/mockup-stride-luecken.html` | E0 (Designer) | F10-Nachtrag, produktionsnah im Stride-Stil, hell + dunkel, 390 und 320 px: Heute-Karte Lauf / Long Run / Platzhalterwoche / „Bis zum Rennen“; Kraft-Tag Anpassen-Modus (Entfernen, Ersetzen, Zurückholen, eigene Übung), „Mit n Sätzen abschließen“ (F6), Strava-Zeile (F7), Stepper mit direkter Eingabe (V1), Stepper untereinander bei 320 px, Ladefehler-Banner; Lauf-Tag „verpasst“, offene/neutrale Range-Balken (F9), Nachgeholt-Zeile, Plan-Hinweis, Fehlerkarten, „Automatik zurück“ + „Neu laden“ im Sheet; Woche Pill „HF zu hoch“ + kombinierte Heute-Pill; Plan „Daten und Konto“ inkl. Platzhalterzeile für 1b-B; Login-Nebenscreens („Kein Zugriff“ mit UID, „Noch nicht übertragene Einträge“, Abmelde-Hinweis zweiter Tab). |
| `docs/ui-markup-stride.md` | E0 + je Etappe (Designer) | Exaktes Markup je Baustein/Zustand, Klassen, `data-action`-Namen, welche Texte durch `esc()` müssen. Wird je Etappe um den Screen ergänzt. |
| `docs/design-stride/` | E1 (coder) | Handoff-Kopie (F11), vorher geprüft: einzige Personenspur `louis@example.com` (Beispiel) im Prototyp, unbedenklich. |
| `fonts/*.woff2`, `fonts/OFL.txt` | E1 (coder lädt, Designer bindet ein) | siehe G1 |
| Assets (Wurzel) | E1 (coder) | siehe G3 |
| `tests/naming-guard.test.mjs` | E1 (coder) | Wächter: `package.json` `name === "hm-tracker"`; `hm-tracker.`-Präfix in `plan-store.js`, `config.js` (`OVERRIDE_KEY`), `firebase-init.js`-Filter, `LOGOUT_NOTICE_KEY === "hm-tracker-notice"` in `app.js`; kein „Halbmarathon Tracker“/„HM Tracker“ in `index.html`, `manifest.webmanifest`, `view-account.js`; Manifest `name`/`short_name` „Stride“, `theme_color`/`background_color` `#f4f3ef`, alle Manifest-Icons existieren als Datei; `index.html` verweist auf `apple-touch-icon.png`. |
| `kraftflow.js` | E2 (coder) | Rein, Node-testbar: `exerciseMode(soll, lastEntry)` → `"weight" \| "reps" \| "time"` (F5); `startSets(soll, saved, lastEntry, chip)` (F4); `lastTimeText(entry)` („4×5 · 75 kg“, „75 kg × 5/5/4“, „3×40 s“, „4×6“, deutsche Kommazahl); `applyWeightForward(sets, i, kg)`; `initialFocus(exercises)`, `nextOpenExercise(order, current, savedMap)`; `setStepper(kind)` (±2,5 / ±1 / ±5 s, Grenzen ≥ 0); `toPayloadSets(sets, mode)` (G5); Entwurf: `draftKey(iso)`, `serializeDraft`, `parseDraft` (G6). |
| `runcompare.js` | E2 (coder) | Rein: `parseTarget(text, kind)` → `{ type: "closed" \| "openMin" \| "openMax" \| "free", min, max }` für Pace und HF (F9; zusammengesetzt/„Kalibrierungstest“ → `free`); `rangeScale(target, kind)` (Zone ±30 s bzw. ±18 bpm, Fallback 5:45–7:15 / 130–175); `rangeBar(scale, target, value)` → Prozentwerte Band/Marker (geklemmt 0–100); `distanceStatus(actualKm, sollKm, THRESHOLDS)` → `"imPlan" \| "zuKurz" \| null`; `paceStatus`, `hrStatus(avgHr, hfMax)` (dieselbe Regel wie Woche/Easy-Ampel); Intervall-/Schwellen-Typen → Pace `neutral`. |
| `history-data.js` | E2 (coder) | Rein: `kraftWeeklyBars(logs, exSlug, plan)` (bestes Satzgewicht je Planwoche, ohne Gewicht Summe Wdh, Deload-Flag aus `weekType`); `kraftTrendText(bars)` („+25 kg seit W1“, erste/letzte Nicht-Deload-Woche mit Daten); `runsSince(runs, planStart)`. |
| `view-kraft.js` | E5 (coder) | Markup Kraft-Tag B: Kopfzeile, Fortschrittspunkte, Jetzt-Karte, Satzliste, Stepper, Chip, Reihenfolge-Liste, Strava-Zeile (F7), Anpassen-Modus, Ladefehler-Banner. |
| `view-run.js` | E6 (coder) | Markup Lauf-Tag B: Vergleichskarte, Range-Balken, Strava-Zeile, Zustandskarten, Sheet-Inhalt. |
| `view-history.js` | E7 (coder) | Markup Verlauf (Segment, Kacheln, Balken, Chips, Listen). |
| `view-plan.js` | E7 (coder) | Markup Plan-Tab (Ziel-Karte, Phasen, Zonen). Konto/Export bleiben in `view-account.js`. |

### Geändert

| Datei | Etappe | Änderung |
| --- | --- | --- |
| `index.html` | E1, E3, E6 | Titel, Beschreibung, `theme-color` hell `#f4f3ef`, `apple-mobile-web-app-title` „Stride“, `<link rel="apple-touch-icon" href="apple-touch-icon.png">`, Tab-Label „Heute“ (`data-tab="dashboard"` bleibt), Info-Sheet-Titel `tabindex="-1"` (E3), neues `#assignSheet` + Backdrop (E6). Optional `<link rel="preload" as="font" crossorigin>` für Geist (Designer entscheidet). |
| `manifest.webmanifest` | E1 | `name`/`short_name` „Stride“, `background_color` und `theme_color` `#f4f3ef`, `icons` wie Handoff §2. |
| `style.css` | E1 Designer, dann je Etappe | E1: Tokens laut Handoff §3 (+ `--seg`, + Deload-Balken-Token), `--surface-0/1/2` durch `--bg`/`--sunk`/`--card` ersetzt (ganze Datei), `@font-face`, Typo-Rollen, Karten ohne Rahmen/Schatten, schwebende Tab-Leiste an der 480-px-Spalte, Bausteine (Buttons, Pills, Haken-Kreis/Ring/Läuft, Ampel-Formen, Stepper, Segment, Sheet), Koralle → Danger bei `.error-card`, `#toast.error`, `.danger-btn`, `.tip-down`. Je Screen-Etappe: neuer Abschnitt, abgelöste alte Klassen werden in derselben Etappe gelöscht. |
| `ui.js` | E1, E3, E6 | E1: neuer Haken-Pfad in `ICONS.check`, Helfer `markSVG()`, `checkCircle(kind, size)`, `ringOpen()`, `ringRunning()`, `pill(tone, text)` (Klassen statt `style=`; `badge()` mit Inline-Farbe wird abgelöst, sobald kein Aufrufer mehr übrig ist). E3: `createSheet()`; `openInfo(title, blocks, trigger)` nimmt Blöcke `{ heading, text }`. E6: Zuordnungs-Sheet nutzt dieselbe Fabrik. |
| `view-account.js` | E1, E8 | E1: `.auth-brand-name` „Stride“, `<img src="icon.png">` → flaches Zeichen. E8: Login, „Kein Zugriff“ (UID bleibt nur hier), „Noch nicht übertragene Einträge“, Konto-Karte „Angemeldet als“ (E-Mail) + Strava-Status + Platzhalterzeile „Plan: Datei · Version …“ (F1, ohne Knopf). |
| `view-dashboard.js` | E3 | Neu: Kopf (Zeichen, „W8 / 35“, Phasenbalken, „194 Tage bis 02.05.“ bzw. Fallback), Banner, Heute-Karten (Kraft-Vorschau 3 Übungen, Ruhe + „Morgen“, Lauf, Long Run, Platzhalter, Bis zum Rennen, Kein Plan), Coach-Karte mit aufklappbarer Montags-Wochenbilanz (F3), Status-Liste, „Diese Woche“. `infoContent()` liefert Blöcke „Berechnung → Bedeutung → Grau/Ehrlicher Hinweis“. **Entfällt:** „Im Detail“ (`detailPlaceholderHTML`, `volumeCardHTML`, `aerobeCardHTML`, `adherenceTileHTML`, `nextUpTileHTML`), Aerobe-Effizienz-Sheet. |
| `view-week.js` | E4 | Kopf mit Rundtasten + „Zu heute“, Summen-Karte 2 Spalten, Tageszeilen-Akkordeon mit genau einer offenen Zeile, Status-Rangfolge laut Requirements 4.8 (Pill „HF zu hoch“ statt Dreieck, kombinierte „Heute · 2/8“), Screenreader-Text „heute“, „Tagesdetails folgen“ mit nächstem `recalibrationDates`-Datum und geplanten km. |
| `app.js` | E1–E8 | Je Etappe nur Verdrahtung/Zustand: `state.historyMode` Standard `"lauf"`, `state.openDayIndex`, `state.todayExpanded` entfällt, Kraft-Zustand `focusExerciseId`/`doneSets` (über `kraftflow.js`), Rücksprung zur Herkunft („‹ Heute“/„‹ Woche“, auch nach „Training abschließen“), `#app.is-detail`, Scroll nach oben beim Öffnen von Unterseiten. **Entfällt:** `fillDetail`, `aerobeWeeklyData`, `adherence4wData`, `nextUpLines`, `patchDetailSlot`, `toggleSets`/`perSet`, `simpleRowHTML`/`perSetRowsHTML`, `runPickerHTML`, `barsHTML` (falls in `view-history.js` neu), `wirePicker` (`#ex-picker`). |
| `progression.js` | E2 | Zusätzlich `progressionChip(soll, last)` → `null \| { level, text, nextKg }` (kurz, Komma). `suggestProgression()` und seine Tests bleiben unverändert. |
| `config.js` | E2 | G2 |
| `strava.js` | E7 | `export function lastFetchedAt()` (liest `runCache.fetchedAt`, sonst `null`). |
| `tools/bump-version.mjs` | E2, E5–E7 | neue Module in `MODULES`, jeweils in der Etappe, in der sie entstehen. |
| `package.json` | E1 | `test:naming` + Aufnahme in `npm test`; `description` „Stride …“ (der `name` bleibt `hm-tracker`). |
| `tests/app.test.mjs` | E1–E9 | Szenario-für-Szenario-Umbau (siehe Abschnitt 4), `config.js`-Stub + `THRESHOLDS.lauf` (E2). |
| `tests/progression.test.mjs` | E2 | Fälle für `progressionChip`. Bestehende Checks unverändert. |
| Neue Node-Tests | E2 | `tests/kraftflow.test.mjs`, `tests/runcompare.test.mjs`, `tests/history-data.test.mjs` (`node --test`, in `npm test`). |
| `README.md`, `HANDOFF.md`, `REQUIREMENTS.md`, `backlog.md`, `tests/README.md` | E1 (Titel), E9 (Inhalt) | E1: sichtbare Titel „Stride“. E9: Ist-Stand, neue Module, Abdeckungs-Ledger, Backlog V3 (Pausen-Timer) und Desktop-Analyse („Im Detail“ wiederverwenden). |

### Gelöscht
Die oben unter „Entfällt“ genannten Render-Funktionen und ihre CSS-Klassen. `metrics.js` und
seine Tests bleiben vollständig (Desktop-Analyse später, F3).

---

## 2. Etappen (skeleton-first, nach jeder Etappe lauffähig und `npm test` grün)

Jede Etappe endet mit `npm run version`, `npm test` grün und einem Commit auf `stride-redesign`.
Reihenfolge innerhalb einer Screen-Etappe: **Designer zuerst** (CSS-Abschnitt + Markup-Referenz),
**dann coder** (Markup in `view-*.js` mit genau diesen Klassen, Logik, Tests). Der coder schreibt
keine Styles und keine `style="…"`. Der Designer prüft jede Etappe durch echtes Ändern der
Fensterbreite (320 bis 1280 px), hell und dunkel.

**E0 – Mockup-Nachtrag (frontend-designer) → Louis nimmt ab.**
`docs/mockup-stride-luecken.html` + Grundgerüst `docs/ui-markup-stride.md`. Kein App-Code.
*Abnahme:* Louis' ausdrückliches OK zum Nachtrag. **Vorher startet der coder nicht** (F10).

**E1 – Walking Skeleton „Marke und Fundament“ (coder → frontend-designer → coder).**
1. coder: Handoff nach `docs/design-stride/`, Assets in die Wurzel, Schriften + `OFL.txt` nach
   `fonts/`, Umbenennung laut Handoff §1 (index.html, Manifest, `view-account.js`, Tab-Label,
   Titel in README/REQUIREMENTS/HANDOFF/backlog), `naming-guard.test.mjs`.
2. Designer: Tokens, Schriften, Typo, Bausteine, Tab-Leiste, Danger-Umstellung (siehe Datei-Map).
   Alte Screens müssen darauf weiter lesbar laufen (sie werden nur „umgefärbt“).
3. coder: `ui.js`-Helfer, Zeichen im Kopf aller Tabs (28 px + „Stride“).
*Abnahme:* App bootet, alle vier Tabs und beide Unterseiten rendern ohne Konsolenfehler; Browser-
Checks nur dort angepasst, wo „Dashboard“ als Tab-Label oder Koralle-Fehlerfarbe geprüft wird;
naming-guard grün; **run-verifier-Zwischenlauf** (Boot + 390/320 px hell/dunkel).

**E2 – Reine Logik, ohne UI-Änderung (coder).**
`kraftflow.js`, `runcompare.js`, `history-data.js`, `progressionChip`, `THRESHOLDS.lauf.zuKurz`
+ `config.js`-Stub, Node-Tests (inkl. Grenzfälle: Kommazahlen, offene Grenzen, `free`,
Deload-Woche, Woche ohne Daten, Entwurf mit kaputter Form, `kg: null`-Regel).
*Abnahme:* Neue Node-Tests grün, Browser-Checks unverändert grün, App sieht aus wie nach E1.

**E3 – Heute (Designer → coder).**
Sheet-Fabrik in `ui.js` + Info-Sheet restyled (Fokus Titel, Blöcke), `view-dashboard.js` neu,
„Im Detail“ entfernt, Heute-Karten aller Arten (inkl. Lauf mit „im Plan/zu kurz“ aus
`runcompare.js`), Coach + Wochenbilanz, Status-Liste, „Diese Woche“ (Tipp → Woche).
*Abnahme:* Szenarien 1, 2, 2b (bis zum Öffnen des Kraft-Tags), 2c, 2c-2, 2c-4, 2d, 2d-2, 2e, 2f,
20, 20b, 21, 22, 25, 28, 29 auf neues DOM umgeschrieben, Zahl der Checks je Szenario nicht
kleiner (Ausnahme „Im Detail“, siehe Abschnitt 4).

**E4 – Woche (Designer → coder).**
`view-week.js`, `openDayIndex`, „Tag öffnen ›“, Rücksprung „‹ Woche“.
*Abnahme:* Szenarien 2c-3, 3, 24 (Plan-Phase 2, Woche 9), Woche-Anteil von 11 umgeschrieben;
neu: genau eine offene Zeile, „HF zu hoch“-Pill, „Tagesdetails folgen“ mit/ohne künftiges Datum.

**E5 – Kraft-Tag B „Fokus“ (Designer → coder).** Größte Etappe, intern zwei Commits:
- **E5a** Jetzt-Karte, Sätze, Stepper (±, V1 direkte Eingabe per Tipp auf den Wert, Zahlentastatur,
  ≥ 16 px), „Satz n fertig“ → nächster Satz → Speichern über bestehendes `saveExercise`-Payload →
  „Weiter: ‹nächste offene›“ → „Training abschließen“ (zur Herkunft), Gewicht wirkt auf folgende
  Sätze, Fortschrittspunkte + Reihenfolge-Liste antippbar, F6 (erledigte Übung/erledigten Satz
  wieder aktiv machen, „Mit n Sätzen abschließen“), Chip, „Letztes Mal“, F7-Zeile, Ladefehler-
  Banner, optimistisches Speichern + Rücknahme bei Fehler wie heute.
- **E5b** Anpassen-Modus im neuen Stil (Funktion unverändert, „+ Übung hinzufügen“ dort), V2
  Entwurf speichern/wiederherstellen/räumen.
*Abnahme:* Szenarien 2b (Rest), 4, 9 (Kraft-Teil), 10, 13, 14, 29 (Kraft-Teil) umgeschrieben;
neu: Satz-für-Satz-Ablauf, Fokus-Wechsel per Liste und Punkten, Gewicht wirkt vorwärts, Wdh nur
für den Satz, vorzeitig abschließen, Korrektur einer gespeicherten Übung, Entwurf überlebt Reload,
Abmelden räumt den Entwurf. Firestore-Stub-Write: **gleiche Doc-ID, gleiche Feldnamen** wie vor
dem Umbau (Vergleich gegen ein festgehaltenes Vorher-Payload im Test). **run-verifier-Zwischenlauf.**

**E6 – Lauf-Tag B „Vergleich“ (Designer → coder).**
`view-run.js`, Vergleichskarte, Range-Balken (F9), Strava-Zeile, Zuordnungs-Sheet (`#assignSheet`,
wählen, belegte Läufe gesperrt, „Kein Lauf an diesem Tag“, „Automatik zurück“ nur bei manueller
Zuordnung bzw. ignoriert, „Neu laden“), Zustände Zukunft/Strava fehlt/ignoriert/verpasst,
Nachgeholt-Zeile, Plan-Hinweis, Fehlerkarten (Firebase vs. Strava vs. Worker).
*Abnahme:* Szenarien 8, 11, 26, 26b, 27, 28 (Lauf-Teil) umgeschrieben; neu: Sheet öffnen/wählen/
Escape/Backdrop, Fokus Titel und zurück, Info-Sheet und Zuordnungs-Sheet direkt nacheinander
(Timer-Race), „zu kurz“ bei 89 %, „im Plan“ bei 90 %.

**E7 – Verlauf + Plan (Designer → coder).**
`view-history.js` (Standard Lauf, Chips statt `#ex-picker`, Wochenbalken, Trend „seit W1“,
„Läufe seit 31.08.“), `view-plan.js` (Ziel-Karte, Phasenbalken, Phasen mit „läuft“, Zonen),
Konto-Bereich (E-Mail, Strava-Status mit `lastFetchedAt()`, Export, Abmelden, Hinweis).
*Abnahme:* Szenarien 5, 6, 30f, 30g, 33 umgeschrieben; neu: Verlauf startet auf Lauf, Chip-
Wechsel, Deload-Balken markiert.

**E8 – Login und Nebenscreens (Designer → coder).**
*Abnahme:* Szenarien 30a–30e, 32 umgeschrieben; UID nur noch auf „Kein Zugriff“.

**E9 – Abschluss (Designer + coder).**
Designer: Aufräumen aller abgelösten Klassen in `style.css`, letzte Prüfmatrix von Hand.
coder: Szenario 34 Prüfmatrix (Abschnitt 4), Grep-Prüfungen (kein „Dashboard“ als sichtbarer
Text, kein `var(--coral` in Fehlerklassen, kein statisches `style="` im Render-Code, kein
Gedankenstrich in neuen UI-Texten), Doku/Ledger, Backlog-Einträge, `npm run version`.
Danach Pipeline 8–11 auf dem Gesamtstand, Louis-Test (Schritt 12), ein Merge (F12).

---

## 3. Aufteilung coder / frontend-designer

| Etappe | frontend-designer | coder |
| --- | --- | --- |
| E0 | Mockup-Nachtrag, Markup-Grundgerüst | – |
| E1 | Tokens, Fonts einbinden, Bausteine, Tab-Leiste, Danger-Umstellung | Umbenennung, Assets, Fonts holen, Handoff-Kopie, ui.js-Helfer, Guard-Test |
| E2 | – | reine Module, Config-Schlüssel, Node-Tests |
| E3–E8 | CSS-Abschnitt + Markup-Referenz je Screen, Resize-Prüfung | `view-*.js`-Markup mit Designer-Klassen, Zustand, Events, Browser-Tests |
| E9 | CSS-Aufräumen, Handprüfung | Prüfmatrix-Test, Greps, Doku |

---

## 4. Teststrategie

- **Abdeckungs-Ledger** in `tests/README.md`: Tabelle Szenario-Nr. → Checks vorher (Stand 336) →
  Checks nachher → Etappe. Regel: kein Szenario verschwindet, keine Zahl sinkt. **Einzige bewusste
  Ausnahme:** die „Im Detail“-Checks (Wochenvolumen, Aerobe Effizienz, Adhärenz, Als Nächstes)
  werden durch „Im Detail ist weg, Coach/Ampeln unverändert“ ersetzt; die Rechnungen bleiben über
  `metrics.test.mjs` abgedeckt (F3). Der reviewer prüft das Ledger.
- **Stabile Haken im DOM:** `data-action`-Namen aus `docs/ui-markup-stride.md` und Rollen/Labels
  (`aria-label` der Stepper, `role="dialog"`) statt Layout-Klassen. Sichtbare Texte nur prüfen,
  wo der Text selbst die Anforderung ist.
- **Stubs:** jede neue `config.js`-Konstante sofort in den `config.js`-Stub (`stubs.test.mjs`
  wacht). `firebase-init.js` bekommt keine neuen Exporte; falls doch, **alle** Stub-Literale.
- **Wächter:** `tests/naming-guard.test.mjs` (Datei-Map) ab E1.
- **Neue Node-Tests** (E2): `kraftflow`, `runcompare`, `history-data`, `progressionChip`.
- **Szenario 34 Prüfmatrix** (Playwright in `app.test.mjs`, ein Kontext, `setViewportSize` +
  `emulateMedia({ colorScheme })`): Breiten **320, 375, 390, 430, 768, 1280** (Höhe 844) plus
  **1280×720**, jeweils hell und dunkel, für Heute, Woche (eine Zeile offen), Kraft-Tag (aktiver
  Satz mit zwei Steppern), Lauf-Tag (mit offenem Zuordnungs-Sheet), Verlauf Lauf + Kraft, Plan,
  Login. Prüfungen: kein horizontales Scrollen (`noHScroll`), kein `#main`-Kind/keine Karte mit
  `clientHeight < scrollHeight`, jedes sichtbare Bedienelement liegt vollständig im Viewport
  (`boundingBox` x ≥ 0, rechts ≤ Breite), Tippflächen der Hauptbedienelemente ≥ 44×44,
  Eingabefelder `font-size ≥ 16px`, keine App-Konsolenfehler. Zusätzlich je Breite die 7
  Tageskreise vollständig sichtbar und bei 320 px die Stepper ohne Abschneiden (darf umbrechen).
- **reduced-motion:** ein Check, dass Sheet-Transition und Skeleton-Schimmer unter
  `prefers-reduced-motion: reduce` aus sind.

---

## 5. Risiken

- **R1 Home-Bildschirm-App** (aus Requirements): neuer Name/Icon erst nach Löschen und neu
  Hinzufügen; vorher mit Netz öffnen. Steht in der Louis-Checkliste (Schritt 12).
- **R2 Umbaugröße / Verhaltensverlust:** jede Render-Funktion und gut 300 Browser-Checks ändern
  sich. Gegenmittel: E2 zieht Logik vor die Optik, Ledger, Szenario-für-Szenario-Umbau, Payload-
  Vergleich im Kraft-Test, run-verifier-Zwischenläufe nach E1 und E5.
- **R3 Kraft-Tag ist Studio-Verhalten:** Fehler trifft das Training direkt. E5 bekommt die
  meisten neuen Szenarien; Louis testet E5 am besten früh lokal (Safari, 390 px) und nicht erst
  am Ende.
- **R4 Stepper-Schrittweite vs. Progression:** `suggestProgression` rechnet mit 1/2,5/5 kg, der
  Stepper mit 2,5 kg. Startwert = vorgeschlagenes Gewicht, danach ±2,5 ab dort (also z. B. 16 →
  18,5). Akzeptiert, V1 erlaubt jede Zahl.
- **R5 Schrift-Swap und Layout:** Geist ist breiter als die Systemschrift; Mono-Zahlen bis 48 px
  im Lauf-Tag können bei 320 px knapp werden. Prüfmatrix fängt das ab; Designer plant `clamp()`
  für Display/Mono-Groß ein.
- **R6 Cache:** `icon.png` behält den Namen, Browser/iOS können das alte Icon cachen (betrifft nur
  Favicon/Tab, Home-Bildschirm siehe R1). Fonts sind über den Dateinamen versioniert.
- **R7 Parallelarbeit auf `main`** (Re-Kalibrierung 28.10., Wochen 17–35 bis 22.11.): Branch
  nachziehen, Konflikte nur in `plans/hm-2027.json` und Versionsstempel erwartet.
- **R8 1b Meilenstein B** kommt danach (F1). Die Platzhalterzeile im Konto-Bereich darf keinen
  Knopf ohne Funktion zeigen.
- **R9 Entwurf (V2) und Firestore-Stand widersprechen sich** (z. B. auf zweitem Gerät gespeichert):
  gespeichertes Dokument gewinnt, Entwurf nur für nicht gespeicherte Übungen. Testfall in E5b.

## 6. Offene Fragen

Keine fachlichen; alle Requirements-Fragen sind entschieden. Für den architecture-reviewer zu
bestätigen: G1–G6, insbesondere G5 (`kg: null` statt 0) und der Modulschnitt aus G3/G4.

**Aufwand:** hoch. E0 ca. 1 Sitzung + Louis-Abnahme, E1 1, E2 1, E3 1–2, E4 1, E5 2, E6 1–2,
E7 1, E8 0,5, E9 1. Insgesamt etwa 10–12 Sitzungen.

**Visual Plan:** Schwelle erreicht (UI-lastig, viele Dateien, Gates G1–G6). **Nicht publiziert:**
Die Plan-MCP-Tools waren im Planner-Subagent nicht aufrufbar (kein Tool-Lader verfügbar). Der
Orchestrator oder architecture-reviewer publiziert und trägt den Link in `.pipeline-state.md` ein.
