# Requirements: Stride (Umbenennung, Logo, Mobile-Redesign)

**Status: FREIGEGEBEN 20.10.2026** (Louis: "alles ja"). Alle offenen Fragen F1–F12
in Abschnitt 9 gelten wie empfohlen entschieden, ebenso V1 und V2 (V3 → Backlog).
Nachtrag 21.10.2026: Mockup-Nachtrag E0 abgenommen; `--text-muted` hell = `#767570`
statt `#8a897f` (Kontrast 4,5:1, bewusste Abweichung vom Handoff).

Stand: 20.10.2026 · Branch `stride-redesign` (Basis `origin/main` a6e6c4b)

**Verbindliche Optik-Spezifikation:** das Design-Handoff
`/Users/louisbehre/Desktop/design_handoff_stride/README.md` (nach Übernahme ins
Repo: `docs/design-stride/README.md`, siehe F11). Farben, Typografie, Abstände,
Radien, Bausteine, Screens und Interaktionen gelten so, wie sie dort stehen.
Dieses Dokument wiederholt die Spezifikation nicht. Es hält fest, **wie das
Handoff auf den bestehenden Code trifft**: Entscheidungen, Lücken und
Abweichungen. Wo dieses Dokument vom Handoff abweicht, gilt dieses Dokument;
jede Abweichung ist mit **[Abweichung]** markiert.

Referenzen im Handoff: `design/Stride Prototyp.dc.html` (gültig sind **Kraft-Tag
B** und **Lauf-Tag B**, A ist verworfen), `design/Stride Regelbogen.dc.html`,
`assets/`.

---

## 1. Feature Vision

Die App heißt ab jetzt **Stride**, bekommt das Logo „Kadenz“ und ein
überarbeitetes mobiles UI für alle Screens (Heute, Woche, Kraft-Tag „Fokus“,
Lauf-Tag „Vergleich“, Verlauf, Plan, Login). Im Studio bedient man eine Übung
groß, Satz für Satz, und sieht trotzdem den ganzen Plan. Fachlogik,
Datenmodell, Firebase, Strava-Worker, Ampel-Berechnung und Plan-Format bleiben
unverändert.

## 2. User Stories

- Louis will die App auf dem Home-Bildschirm unter dem Namen „Stride“ mit dem
  neuen Icon sehen, ohne dass gespeicherte Pläne, Overrides oder die Anmeldung
  verloren gehen.
- Louis will im Studio zwischen zwei Sätzen mit einer Hand Gewicht und
  Wiederholungen per Stepper einstellen, „Satz fertig“ tippen und automatisch
  zum nächsten Satz bzw. zur nächsten offenen Übung kommen.
- Louis will die Übungen in beliebiger Reihenfolge machen können (Gerät
  besetzt), indem er einfach die Übung antippt, die er gerade macht.
- Louis will auf einem Lauftag auf einen Blick sehen, ob Distanz, Pace und
  Herzfrequenz zum Plan passen, und die Strava-Zuordnung in einem Sheet
  korrigieren können.
- Louis will auf „Heute“ in Sekunden sehen: was ist dran, was sagt der Coach,
  wie stehen die vier Ampeln, wie weit ist die Woche.

## 3. Umfang

**Im Umfang:** Umbenennung (Handoff §1), Logo und Icons (§2), Design-Tokens und
Schriften (§3), Bausteine (§4), die sieben Screens (§5), Interaktionen (§6),
neuer reiner UI-Zustand (§7). Dazu die Lücken aus Abschnitt 5 dieses Dokuments.

**Nicht im Umfang:** Desktop-Analyseansicht; Änderungen an Fachlogik,
Datenmodell, Firestore-Regeln, Worker, `metrics.js`-Berechnungen,
`THRESHOLDS`-Werten und Plan-Format; Umbenennen von Repo, Pages-URL, Worker,
Firebase-Projekt; Login 1b Meilenstein B (siehe F1); Schritt 2
(Marathon-Coaching).

---

## 4. Entscheidungen (aus Handoff und Code-Abgleich)

Diese Punkte sind aus dem Handoff oder dem Code eindeutig ableitbar. Louis
kann jeden davon überstimmen.

### 4.1 Umbenennung
- Umbenennen nur laut Tabelle im Handoff §1, dazu die sichtbaren Texte
  `REQUIREMENTS.md`/`HANDOFF.md`-Titel („Halbmarathon-Tracker“) und die
  `backlog.md`-Überschrift.
- **Bleibt:** alle Schlüssel mit `hm-tracker.` bzw. `hm-tracker-notice`
  (`plan-store.js`, `config.js` `OVERRIDE_KEY`, `app.js`
  `LOGOUT_NOTICE_KEY`, Filter in `firebase-init.js`), `package.json` `name`,
  Worker-Namen und -URLs, Firebase-Projekt, Testdateinamen und Test-IDs.
- „Tests nicht umbenennen“ heißt: Dateinamen, IDs und gestubbte Schlüssel
  bleiben. **Sichtbare UI-Texte in Browser-Tests** („Dashboard“, „Speichern“,
  `#ex-picker` …) werden selbstverständlich an das neue UI angepasst (siehe
  4.9).
- Der interne Tab-Schlüssel `data-tab="dashboard"` und `state.tab ===
  "dashboard"` bleiben; nur das Label wird „Heute“.
- Das Ziel als Untertitel („Halbmarathon · 02.05.2027“) kommt aus dem aktiven
  Plan (`plan.goal.distance`, `plan.goal.raceDate`), nie als fester Text.

### 4.2 Logo und Icons
- `icon.png` (1024²), `icon-512.png`, `icon-192.png`, `apple-touch-icon.png`,
  `stride-mark.svg`, `stride-mark-dark.svg`, `check.svg` aus
  `design_handoff_stride/assets/` ins Repo-Wurzelverzeichnis (dort liegt heute
  schon `icon.png`). Manifest-`icons` wie im Handoff.
- In der App immer das flache Zeichen, auch auf dem Login (ersetzt das heutige
  `<img src="icon.png">` in `view-account.js`).
- Hell/Dunkel-Wechsel des Zeichens über `prefers-color-scheme`. Ein manueller
  Hell/Dunkel-Schalter existiert im Code **nicht** (nur im alten Mockup), es
  wird auch keiner eingeführt.
- Manifest `theme_color` (heute `#0f6e56`, im Handoff nicht genannt) wird an
  `theme-color` hell angeglichen: `#f4f3ef`.

### 4.3 Tokens und Farbregeln
- Tokens wie im Handoff §3. Die heutigen Namen `--surface-0/1/2` werden durch
  `--bg`/`--sunk`/`--card` ersetzt (keine Doppelpflege). Ergänzt wird der im
  Handoff nur beim Segment-Schalter genannte Token `--seg` (#e6e5df /
  #2c2c31) und ein Token für die hellen Deload-Balken (#a8d5c4 / #2a5e4d)
  statt fester Werte im Render-Code.
- **„Koralle bedeutet Laufen, nie Fehler“ trifft heute drei Stellen:**
  `.card.error-card` (Koralle-Fläche), `#toast.error` (Koralle-Hintergrund)
  und `.danger-btn` (Koralle-Text). Alle drei werden auf Danger-Tokens
  umgestellt. Ebenso der Progressionshinweis `tip-down` (heute Koralle, siehe
  4.6).
- Höchstens eine teal gefüllte Fläche pro Screen (Handoff-Regel).

### 4.4 Layout und Fluid-Responsive
- Basis ist 390 px. Die App bleibt eine telefonbreite Spalte, zentriert auf
  `--bg`; maximale Breite wie heute 480 px. Die schwebende Tab-Leiste
  orientiert sich an dieser Spalte, nicht am Fenster.
- CLAUDE.md-Pflicht: **kein Feld, keine Spalte, kein Bedienelement darf bei
  irgendeiner Fensterbreite verschwinden oder abgeschnitten werden.**
  Konkret kritisch bei 320 px: die zwei Stepper nebeneinander im aktiven Satz
  (bei zu wenig Platz untereinander), die 7 Tageskreise à 36 px in „Diese
  Woche“, die 2×2-Kacheln im Verlauf, die Range-Achsen im Lauf-Tag.
- Prüfmatrix: 320, 375, 390, 430, 768 und 1280 px Breite, jeweils hell und
  dunkel, zusätzlich eine niedrige Höhe (z. B. 1280×720). Kein horizontales
  Scrollen, kein abgeschnittener Inhalt (bestehender `noHScroll`-Check plus
  `clientHeight < scrollHeight`-Prüfung wie in M2).
- Kopfbereich: Statusleisten-Abstand über `env(safe-area-inset-top)`, die
  Tab-Leiste über `env(safe-area-inset-bottom)`. Ob der Kopf weiter im festen
  `#header` steht oder mitscrollt, entscheidet der Planner; optisch gilt der
  Prototyp.

### 4.5 Navigation und Info-Sheet
- Kraft- und Lauf-Tag blenden die Tab-Leiste aus; Zurück-Button heißt
  „‹ Heute“ bzw. „‹ Woche“ (heute: „Dashboard“ bzw. „Woche N“).
- **Info-Sheet-Fokus:** Das Handoff verlangt zugleich „Fokus auf den Titel“
  und „Verhalten von `#infoSheet` beibehalten“ (heute: Fokus auf den
  Schließen-Knopf). Entscheidung: **Fokus auf den Titel** (`tabindex="-1"`),
  Rückgabe an den Auslöser wie bisher, Escape wie bisher. Der zugehörige
  Browser-Test wird angepasst.
- Info-Inhalte werden als Blöcke „Berechnung → Bedeutung → Grau“ bzw.
  „Ehrlicher Hinweis“ strukturiert (heute Absätze mit Präfix „Berechnung: …“).
  Zahlen kommen weiter aus `THRESHOLDS`.
- Das Zuordnungs-Sheet (Lauf-Tag) ist **neu**: Heute ist die Laufauswahl eine
  Karte im Seitenfluss (`runPickerHTML`). Es nutzt dasselbe Sheet-Verhalten
  (Backdrop, ×, Escape, Fokus, ca. 250 ms), am besten dieselbe Komponente wie
  das Info-Sheet. Bekannter Fallstrick: der Timer-Race-Bugfix in `ui.js`
  (`infoHideTimer`) muss für beide Sheets gelten.

### 4.6 Kraft-Tag B „Fokus“, Anschluss an die bestehende Logik
- Speicherlogik unverändert: ein Firestore-Dokument pro Übung
  (`logs/{datum}_{übung}`, `completed: true`), optimistisch quittiert, Sync im
  Hintergrund. Gespeichert wird, sobald alle Sätze einer Übung fertig sind
  (oder vorzeitig, siehe F6).
- Der Schalter „Sätze einzeln / Alle gleich“ entfällt. Ersatz laut Handoff:
  Gewicht im aktiven Satz gilt für alle folgenden Sätze, Wiederholungen nur für
  diesen Satz.
- Freie Zahlenfelder werden durch Stepper ersetzt (±2,5 kg, ±1 Wdh, ±5 s).
  Eingaben bleiben ≥16 px (iOS-Zoom-Falle).
- „+ Übung hinzufügen“ (Schnell-Hinzufügen) wandert in den Anpassen-Modus;
  „Anpassen“ ist ein Text-Button unter der Reihenfolge-Liste und öffnet den
  bestehenden Bearbeiten-Modus (Entfernen, Ersetzen, Zurückholen, eigene
  Übung). Funktion unverändert, die Optik dieses Modus ist im Prototyp nicht
  gezeigt (siehe F10).
- Progressionshinweis: `progression.js` liefert heute die Stufen `up`, `hold`,
  `down`, `info` mit langen Sätzen (Gedankenstrich, Dezimalpunkt). Das Handoff
  zeigt kurze Chips. Entscheidung: `progression.js` bekommt eine **zusätzliche,
  getestete** Kurzform für den Chip (z. B. „+2,5 kg: zuletzt alle 15 Wdh
  sauber“, deutsche Kommazahl); die bestehende Rückgabe und ihre Tests bleiben.
  Farbzuordnung: `up` = teal, `hold` und Deload-Hinweis = sky, `down` = amber,
  übriges `info` = `--sunk`/secondary.
- „Letztes Mal …“ kommt aus `previousEntry()`: gleiche Sätze als
  „4×5 · 75 kg“, ungleiche als „75 kg × 5/5/4“, ohne Gewicht „3×40 s“ bzw.
  „4×6“.
- „Training abschließen“ führt **zur Herkunft** zurück (Heute oder Woche),
  wie der Zurück-Button. **[Abweichung]** Das Handoff sagt „zurück zu Heute“;
  beim Nachtragen eines vergangenen Tags aus der Woche wäre der Sprung nach
  Heute unerwartet.
- Ladefehler („Gespeicherte Sätze nicht geladen“) erscheint als Danger-Banner
  im Stil des Heute-Fehlerbanners; Eintragen bleibt möglich wie heute.

### 4.7 Lauf-Tag B „Vergleich“, Anschluss an die bestehende Logik
- Zuordnungslogik (`runmatch.js`) unverändert. Die heutigen Knöpfe werden so
  abgebildet:
  - „Anderen Lauf“ → Tipp auf die Strava-Zeile öffnet das Sheet.
  - „Passt nicht“ → Danger-Button „Kein Lauf an diesem Tag“ im Sheet.
  - „Zuordnung aufheben“ (manuell → Automatik) → im Sheet ein Text-Button
    „Automatik zurück“, sichtbar nur bei manueller Zuordnung (im Handoff nur
    für den Zustand „Ignoriert“ vorgesehen).
  - „Neu laden“ (Strava) → Text-Button im Sheet und in den Karten „Noch kein
    Lauf“; ohne ihn sieht man einen heute nach dem Öffnen gelaufenen Lauf nicht.
- Nachgeholte Läufe (Abstand ≠ 0): Pill bleibt „automatisch“/„von Hand“, darunter
  eine amber Zeile „nachgeholt · Di, 20.10.“ (heute `shift-note`).
- `info.note` (Plan-Hinweis zum Lauf) bleibt sichtbar, als Hinweistext unter
  der Vergleichskarte. Der alte Satz „Wird nicht hier eingetragen …“ mit
  Läufer-Icon entfällt (Handoff: kein Läufer-Icon).
- Fehlerzustände (Firestore-Fehler, Strava-Fehler, Worker nicht eingerichtet)
  sind im Prototyp nicht gezeigt: Danger-Karte im Stil des Heute-Fehlerbanners,
  Inhalt wie heute `problemCard()` (Firebase-Fehler zeigt auf Anmeldung und
  Regeln, nicht auf Strava).
- Zusätzlicher Zustand **vergangener Tag ohne Lauf, nicht ignoriert**
  („verpasst“): fehlt im Handoff. Karte „Kein Lauf gefunden“ + „Strava-Läufe
  von einem Tag davor bis drei Tage danach.“ + Sekundärbutton „Lauf von Hand
  zuordnen“, Pill „verpasst“ (Danger).
- „im Plan“/„zu kurz“ und die Grün/Amber-Färbung brauchen eine Regel, siehe
  F8 und F9. Die HF-Bewertung folgt der bestehenden Regel aus Woche und
  Easy-Ampel (`avgHr > hfMax` = auffällig), damit nicht zwei Wahrheiten
  entstehen.

### 4.8 Heute, Woche, Verlauf, Plan, Login
- **Heute, Kopf:** „W8 / 35“ und „194 Tage bis 02.05.“ ersetzen Phasen-Badge
  und Wochen-Countdown. Ohne bestätigtes Renndatum bleibt der heutige
  Fallback („Rennen ca. Mai · Datum offen“).
- **Heute-Karte:** Die Kraft-Karte ersetzt die heutige aufklappbare
  Übungsliste (`state.todayExpanded` entfällt) durch die Vorschau der ersten
  3 Übungen + Primärbutton. Pill „Deload“, wenn die Woche eine
  Entlastungswoche ist (`weekType`).
- **Heute-Karte Lauftag, Platzhalterwoche, „Bis zum Rennen“:** im Handoff
  nicht beschrieben, im Prototyp nicht vorhanden. Vorgabe: gleicher Aufbau wie
  die Kraft-Karte. Lauf: Überzeile „● HEUTE · LAUF“ (Koralle) bzw. „HEUTE ·
  LONG RUN“ (lila), Titel „Easy run · 8 km“, Zielzeile Pace · HF; ist ein Lauf
  zugeordnet, Distanz in Mono + Pill „im Plan“/„zu kurz“ + Strava-Name;
  Primärbutton „Lauf ansehen“ → Lauf-Tag. Platzhalter: „HEUTE · OFFEN“,
  „Details nach der Re-Kalibrierung“. „Bis zum Rennen“: wie Ruhetag-Karte.
  Optik per Mockup-Nachtrag (F10).
- **Coach-Karte:** Montags-Wochenbilanz siehe F3.
- **Status:** die vier Ampeln als Liste; ganze Zeile öffnet das Info-Sheet.
- **Diese Woche:** Tipp auf die Karte öffnet den Tab Woche.
- **Woche, Status-Rangfolge** (heute in `buildWeekDayRow`): Zukunft =
  gestrichelter Ring; erledigt = Haken-Kreis in Kategoriefarbe; erledigt, aber
  HF über Grenze = amber Pill „HF zu hoch“ (heute ein Warn-Dreieck, Handoff
  nennt diesen Fall nicht); teilweise = amber „7/8“; heute offen = Pill
  „Heute“ (primär); verpasst = Danger-Pill; optional nicht gemacht =
  gestrichelte Pill „optional“. Die Heute-Zeile wird zusätzlich zur
  Teal-Tönung für Screenreader als „heute“ ausgezeichnet (Status nie nur über
  Farbe).
- **Woche ohne Details:** Datum der Re-Kalibrierung aus
  `plan.recalibrationDates` (nächstes Datum ab heute), geplante km aus der
  Woche; liegt kein künftiges Datum vor, entfällt der Datumsteil.
- **Verlauf:** Standard wird **Lauf** (heute `historyMode: "kraft"`). Die
  Übungsauswahl wird von `<select id="ex-picker">` auf Chips umgestellt. Kraft
  zeigt neu **Wochenbalken** (bestes Satzgewicht je Planwoche; Übungen ohne
  Gewicht: Wiederholungen gesamt wie heute) statt der letzten 10 Einträge.
  Trend-Text: Differenz zwischen erster und letzter Nicht-Deload-Woche mit
  Daten, formuliert als „+25 kg seit W1“. **[Abweichung]** Der Prototyp
  schreibt „bis W7“, das ist ohne Kontext missverständlich. Lauf: Kachel
  „Läufe seit 31.08.“ (Planstart) statt „Läufe gesamt“.
- **Plan, Daten und Konto:** „Angemeldet als“ zeigt die E-Mail. Die UID
  erscheint nur noch auf dem Screen „Kein Zugriff“, wo sie bei der Fehlersuche
  hilft. Strava-Status „verbunden · Sync heute 07:12“ = Zeitpunkt des letzten
  Abrufs in dieser Sitzung (`fetchedAt` existiert in `strava.js`), sonst
  „nicht verbunden“ + Button „Verbinden“. Der Abmelde-Hinweis (lokale Kopien
  werden geräumt) bleibt als kurzer Hinweistext. Export-Statuszeile bleibt.
- **Login:** wie Handoff §5.7. Die Screens „Kein Zugriff“ und „Noch nicht
  übertragene Einträge“ und der Hinweis nach dem Abmelden mit zweitem Tab
  bekommen denselben Aufbau (Zeichen, Karte, ein Button).

### 4.9 Qualität, Tests, Auslieferung
- Neue Module (z. B. ein eigenes Render-Modul für den Kraft-Tag) gehören in
  die Liste in `tools/bump-version.mjs`; `npm run version` vor jedem Commit.
- Browser-Tests (`tests/app.test.mjs`, heute 336 Checks) hängen stark an
  altem DOM und Texten (`#today-slot`, `.ampel-tile`, `[data-ex]`,
  „Gespeichert.“, Farbe des Speichern-Knopfs, `#ex-picker`, „Dashboard“). Sie
  werden **Szenario für Szenario** auf das neue UI umgeschrieben. Kein
  Szenario fällt ersatzlos weg; die Abdeckung bleibt mindestens gleich (Zeitzone
  um Mitternacht, Speichern/Wiederherstellen, verschobene Läufe, Anpassen,
  Login-Zustände, Coach-Fallbacks, Export, kein Seitwärts-Scrollen, kein
  Zoom). Neue Szenarien: Satz-für-Satz-Ablauf, Fokus-Wechsel per
  Reihenfolge-Liste, Gewicht wirkt auf folgende Sätze, Zuordnungs-Sheet
  (öffnen, wählen, belegte Läufe nicht wählbar, Escape), Verlauf-Standard Lauf.
- Node-Tests bleiben unverändert grün; dazu kommen Tests für neue reine
  Funktionen (Chip-Kurzform, „Letztes Mal“-Format, Range-Balken-Berechnung,
  „zu kurz“-Regel, Wochenbalken-Aggregation).
- Ein Wächter-Test stellt sicher, dass die `hm-tracker.`-Schlüssel unverändert
  sind und in `index.html`/`manifest.webmanifest`/`view-account.js` kein
  „Halbmarathon Tracker“/„HM Tracker“ mehr steht.
- Styling liegt beim frontend-designer, Logik/Verdrahtung beim coder
  (CLAUDE.md). Keine statischen `style="…"` im Render-Code (HANDOFF-Konvention).

---

## 5. Lückenanalyse (Handoff vs. heutiger Code)

| # | Heute vorhanden | Im Handoff | Behandlung |
| --- | --- | --- | --- |
| L1 | Dashboard „Im Detail“: Wochenvolumen Soll/Ist, Aerobe Effizienz (mit Info-Sheet), Adhärenz 4 Wo., „Als Nächstes“ | fehlt („am Handy knapp“) | **F3** |
| L2 | Coach-Wochenbilanz montags (aufklappbar) | fehlt | **F3** |
| L3 | Heute-Karte für Lauftag, Platzhalterwoche, „Bis zum Rennen“ | nur Kraft/Ruhe/Kein Plan | 4.8 + **F10** |
| L4 | Kraft: freie Zahlenfelder, „Sätze einzeln/Alle gleich“ | Stepper, Satz für Satz | 4.6, **F4, F5** |
| L5 | Kraft: gespeicherte Übung korrigieren | erledigte Zeilen nicht antippbar | **F6** |
| L6 | Kraft: weniger Sätze speichern als geplant | nicht vorgesehen | **F6** |
| L7 | Kraft: Strava-Einheitskarte (Dauer, Ø/Max HF, Relative Effort) | fehlt | **F7** |
| L8 | Kraft: Anpassen-Modus (Entfernen, Ersetzen, Zurückholen, eigene) | nur „öffnet den bestehenden Modus“ | 4.6 + **F10** |
| L9 | Lauf: Zuordnung als Karte im Seitenfluss | Bottom-Sheet | 4.5, 4.7 |
| L10 | Lauf: „Zuordnung aufheben“, „Neu laden“, Nachgeholt-Hinweis, Plan-Hinweis, Fehlerkarten | fehlt | 4.7 |
| L11 | Lauf: vergangener Tag ohne Lauf | fehlt | 4.7 + **F10** |
| L12 | Lauf: Zielwerte teils offen („> 6:40 /km“, „< 148 bpm“), frei („Kalibrierungstest“), zusammengesetzt („Schluss 5:00–5:10“), Intervalle (Schwelle) | Range-Balken nur für geschlossene Spannen gezeigt | **F9** |
| L13 | keine „zu kurz“-Regel | Pill „zu kurz“ | **F8** |
| L14 | Woche: Warn-Dreieck „HF zu hoch“, kombinierte Pill „Heute · 2/8“ | nicht genannt | 4.8 |
| L15 | Fehler in Koralle (Fehlerkarte, Toast, Danger-Button, `tip-down`) | Koralle nie Fehler | 4.3 |
| L16 | Info-Sheet-Fokus auf Schließen-Knopf | Fokus auf Titel | 4.5 |
| L17 | kein manueller Dunkelmodus-Schalter | „vorhandenen Override, falls es einen gibt“ | 4.2: keiner, bleibt so |
| L18 | Konto-Karte mit UID | „Angemeldet als“ + Strava-Status | 4.8 |
| L19 | Login 1b Meilenstein B (Plan nach Firestore, Knopf „Plan aus Datei übernehmen“ in der Konto-Karte) offen | nicht berücksichtigt | **F1** |
| L20 | Systemschrift | Geist / Geist Mono | **F2** (Approval-Gate) |
| L21 | Browser-Tests prüfen alte Texte/DOM | – | 4.9 |
| L22 | Handoff liegt nur auf dem Desktop | – | **F11** |
| L23 | Home-Bildschirm-App mit altem Namen/Icon | – | Risiko R1 |

---

## 6. Design & UX

- **Visueller Stil:** Handoff §3–§5, verbindlich. Karten ohne Rahmen und
  Schatten auf `--bg`, Schatten nur für Tab-Leiste und Sheet.
- **Ablauf:** Tabs Heute · Woche · Verlauf · Plan; Kraft- und Lauf-Tag als
  Unterseiten mit Zurück zur Herkunft; Chevron-Regel (Chevron = neuer Screen,
  ohne = klappt auf).
- **Schlüssel-Interaktionen:** Satz fertig → nächster Satz → „Weiter: ‹nächste
  offene Übung›“ → „Training abschließen“; Fokus-Wechsel per Tipp in der
  Reihenfolge-Liste oder auf die Fortschrittspunkte; Zuordnungs-Sheet;
  Wochenzeilen-Akkordeon mit genau einer offenen Zeile.
- **Barrierefreiheit:** Tippflächen ≥44×44 px; Status immer Form/Text plus
  Farbe; Sheets mit `role="dialog"`, `aria-modal`, Fokusführung, Escape;
  Stepper-Knöpfe mit `aria-label` („Gewicht verringern“ …) und der Wert als
  Live-Region; `prefers-reduced-motion` schaltet Sheet-Animation und
  Skeleton-Schimmer ab (wie heute).
- **Laden:** Seite sofort zeigen, Coach/Strava/Ampeln einzeln mit
  Platzhalter-Balken, nie ein Spinner über allem (entspricht dem heutigen
  Slot-Prinzip).

## 7. Technische Vorgaben

- Vanilla-JS wie bisher (`index.html`, `style.css` mit CSS-Variablen,
  Template-Strings in `app.js`/`view-*.js`, `ui.js`). Kein Framework, kein
  Build-Schritt, kein Code aus `design/` übernehmen.
- Neue npm-Pakete: keine.
- Schriften: siehe F2 (Approval-Gate).
- Neuer UI-Zustand nur wie Handoff §7: `focusExerciseId`, `doneSets` je Übung,
  `openDayIndex`, `historyMode` (Standard `"lauf"`). Optional der lokale
  Satz-Entwurf aus Vorschlag V2.
- Kein Schema-, Regel-, Worker- oder Endpunkt-Wechsel. Einzige mögliche
  Ergänzung in `config.js`: ein neuer Schlüssel für die „zu kurz“-Schwelle
  (F8), bestehende Werte bleiben.

## 8. Vorschläge (Opportunities & Alternatives)

Bewusst kurz; nur, was im Studio-Alltag spürbar hilft.

- **V1 · Stepper-Wert antippen = direkte Eingabe** (Zahlentastatur). Warum:
  Bei einer neuen Übung oder einem Gewichtssprung von 0 auf 60 kg wären das 24
  Taps. Kleiner Aufwand, keine neue Daten. **Empfehlung: jetzt mitnehmen.**
- **V2 · Satz-Entwurf lokal sichern** (`hm-tracker.kraftDraft.<datum>`,
  `localStorage`). Warum: `doneSets` existiert nur im Speicher; iOS beendet
  Home-Bildschirm-Apps im Hintergrund gern (Musik-App, Kamera), dann sind die
  ersten Sätze einer Übung weg. Der Präfix sorgt dafür, dass Abmelden den
  Entwurf mit räumt. Das ist neuer lokaler Zustand, aber kein neues Datenfeld
  in Firestore. **Empfehlung: jetzt mitnehmen.**
- **V3 · Pausen-Timer nach „Satz fertig“.** Naheliegend fürs Studio, aber
  neue Funktion mit eigenen Fragen (Ton, Hintergrund, Sperrbildschirm unter
  iOS). **Empfehlung: Backlog**, nicht in dieses Redesign.

Abgewogen und verworfen: manueller Hell/Dunkel-Schalter (kein Bedarf
erkennbar), Board-/Kalenderansicht für Woche (Handoff ist eindeutig).

---

## 9. OFFENE FRAGEN an Louis (je mit Empfehlung)

**F1 · Reihenfolge gegenüber Login 1b Meilenstein B (Plan nach Firestore).**
B ändert die Konto-Karte (Plan-Quelle, Version, Knopf „Plan aus Datei
übernehmen“), die das Redesign ebenfalls neu baut. B steht in
`REQUIREMENTS.md` nicht mehr unter „Als Nächstes“. Ist B noch gewollt, und was
kommt zuerst?
*Empfehlung:* **Stride zuerst**, B bleibt offen und kommt danach direkt im
Stride-Stil. Im Abschnitt „Daten und Konto“ wird Platz für eine Zeile
„Plan: Datei · Version …“ samt Knopf vorgesehen, damit B ohne Umbau
hineinpasst. Die Re-Kalibrierung am 28.10. läuft unabhängig über die
JSON-Datei.

**F2 · Schriften Geist / Geist Mono: selbst hosten oder Google Fonts?**
(Approval-Gate „externe Abhängigkeit“.)
*Empfehlung:* **Selbst hosten** in `fonts/` als woff2 (je eine variable Datei,
aus dem offiziellen Geist-Release von Vercel) plus `OFL.txt`. Kein
Drittanbieter-Aufruf (Datenschutz, IP geht nicht an Google), funktioniert bei
schlechtem Netz aus dem Browser-Cache, keine neue Laufzeit-Abhängigkeit. Mit
`font-display: swap` und den Fallbacks aus dem Handoff.

**F3 · „Im Detail“ und Wochenbilanz haben im neuen Heute keinen Platz.**
Wochenvolumen Soll/Ist, Aerobe Effizienz, Adhärenz 4 Wochen und „Als Nächstes“
wurden mit Dashboard v2 im September abgenommen.
*Empfehlung:* **„Im Detail“ fällt am Handy weg**, wie das Handoff es will
(gehört in die spätere Desktop-Analyse). Die reinen Rechenfunktionen in
`metrics.js` und ihre Tests bleiben, damit die Desktop-Ansicht sie
wiederverwenden kann; nur der Render-Code geht. „Als Nächstes“ steckt
teilweise in der Ruhetag-Zeile „Morgen“. Die **Montags-Wochenbilanz bleibt**
als aufklappbarer Teil der Coach-Karte (Trennlinie + „Wochenbilanz W8 ›“), weil
sie Coach-Inhalt ist und sonst Coach-Kontingent ins Leere liefe.

**F4 · Startwerte der Stepper im Kraft-Tag.**
*Empfehlung:* gespeicherte Werte, falls die Übung heute schon erfasst ist.
Sonst: Gewicht = Top-Gewicht der letzten Einheit, bei Progressions-Stufe „up“
gleich das vorgeschlagene Gewicht; Wiederholungen/Zeit = Werte der letzten
Einheit je Satz, ohne Historie die untere Grenze der Soll-Spanne. Ohne
Historie Gewicht 0, mit direkter Eingabe nach V1.

**F5 · Übungen ohne Gewicht erkennen.** Der Plan kennt keine Art „Gewicht /
Körpergewicht / Zeit“; der Prototyp hat sie fest verdrahtet.
*Empfehlung:* zeitbasiert über `parseSoll()` (`…s` im Soll, gibt es schon).
Körpergewicht: letzte Einheit ohne Gewicht → nur Wdh-Stepper. Ohne Historie
den Gewichts-Stepper zeigen, 0 kg bedeutet „ohne Zusatzgewicht“. Ein neues
Feld in der Plan-JSON wäre sauberer, ist aber eine Formatänderung und gehört
nicht in dieses Redesign.

**F6 · Korrigieren und vorzeitig beenden.** Laut Handoff sind erledigte
Übungen in der Reihenfolge-Liste nicht antippbar, und gespeichert wird erst
nach dem letzten Satz. Heute kann man gespeicherte Werte ändern und mit
weniger Sätzen speichern.
*Empfehlung:* (a) Tipp auf eine **erledigte** Übung macht sie wieder zur
Jetzt-Übung; ein Tipp auf einen erledigten Satz macht ihn wieder aktiv;
erneutes Abschließen überschreibt wie heute. (b) Sobald mindestens ein Satz
fertig ist, gibt es den Text-Button „Mit n Sätzen abschließen“.

**F7 · Strava-Einheitskarte auf dem Kraft-Tag** (Dauer, Ø/Max HF, Relative
Effort aus Strava) hat im Handoff keinen Platz.
*Empfehlung:* als **eine unauffällige Zeile** unter der Reihenfolge-Liste
behalten („Einheit laut Strava: 58 min · Ø 121 bpm“), nur wenn vorhanden. Die
Daten kommen ohne Eingabe und zeigen über die Wochen die Belastung.

**F8 · Regel für „zu kurz“.** Bisher gibt es keine. Gemeint ist eine reine
Anzeige ohne Einfluss auf Ampeln, Wochensoll oder „verpasst“.
*Empfehlung:* „zu kurz“, wenn die gelaufene Distanz **unter 90 %** der
Soll-km liegt (gleiche Schwelle wie Wochensoll grün). Als neuer Schlüssel in
`THRESHOLDS` (`config.js`), bestehende Werte bleiben unverändert.

**F9 · Range-Balken bei offenen, freien und Intervall-Zielen.**
*Empfehlung:* offene Grenze („> 6:40 /km“, „< 148 bpm“) → Zielband bis zum
Skalenrand. Nicht lesbares oder zusammengesetztes Ziel („Kalibrierungstest“,
„… Schluss 5:00–5:10 /km“) → kein Balken, nur der Wert, neutral eingefärbt.
Schwelle/Intervalle → Pace neutral, weil der Durchschnitt mit Ein- und
Auslaufen nichts über die Intervalle sagt. HF grün genau dann, wenn
`avgHr ≤ hfMax` (dieselbe Regel wie Woche und Easy-Ampel). Pace grün innerhalb
des Bands, sonst amber.

**F10 · Mockup-Nachtrag für die Lücken.** Der Prototyp deckt die Zustände aus
L3, L8, L11, die Fehlerkarten im Lauf-Tag und die Login-Nebenscreens nicht ab.
Bisher wollte Louis UI-Entscheidungen erst am HTML-Mockup sehen.
*Empfehlung:* **Ja, ein kompakter HTML-Nachtrag** vom frontend-designer im
Stride-Stil, nur für diese Zustände, abgenommen vor dem Coder. Alles, was der
Prototyp zeigt, gilt als abgenommen.

**F11 · Handoff-Dateien ins Repo übernehmen?** Sie liegen nur auf dem
Desktop.
*Empfehlung:* **Ja**, nach `docs/design-stride/` (README, Regelbogen,
Prototyp, `support.js`; die Assets liegen ohnehin im Wurzelverzeichnis). Das
Repo ist öffentlich: vorher prüfen, dass die Prototyp-Dateien keine
persönlichen Daten außer Beispielwerten enthalten. So überlebt die
verbindliche Spezifikation jeden späteren Agenten-Lauf.

**F12 · Auslieferung am Stück oder in Etappen?**
*Empfehlung:* **Am Stück.** Ein Branch, intern in Etappen committet (Tokens +
Schriften + Name + Logo zuerst, dann Screen für Screen), ein Merge nach
Louis' Test am MacBook (Safari, 390 px und schmaler). Ein halb alter, halb
neuer Stand auf `main` sähe kaputt aus. Ein Test auf dem iPhone ist vor dem
Merge kaum möglich (Pages deployt nur `main`, Firebase-Login nur auf
zugelassenen Domains). Deshalb direkt nach dem Deploy eine kurze iPhone-Prüfung;
Rollback per Revert des Merges.

---

## 10. Erfolgskriterien

- Alle sieben Screens entsprechen in hell und dunkel dem Prototyp (Kraft B,
  Lauf B), die Lücken-Zustände dem abgenommenen Mockup-Nachtrag.
- Nach dem Update: gespeicherte Pläne, Overrides und Anmeldung sind noch da,
  Abmelden räumt weiter alle `hm-tracker.`-Schlüssel.
- Ein komplettes Krafttraining lässt sich im Studio einhändig Satz für Satz
  erfassen; die Firestore-Dokumente sind identisch aufgebaut wie vorher
  (gleiche ID, gleiche Felder).
- Keine Koralle für Fehler; Status überall Form/Text plus Farbe.
- `npm test` komplett grün; Browser-Abdeckung mindestens so breit wie vorher;
  Prüfmatrix aus 4.4 ohne Abschneiden oder Seitwärts-Scrollen.
- run-verifier grün, Louis' manueller Test auf MacBook und iPhone (Tab und
  Home-Bildschirm).

## 11. Risiken

- **R1 · Home-Bildschirm-App.** iOS übernimmt neuen Namen und neues Icon nicht
  in eine bereits angelegte Home-Bildschirm-App; sie muss gelöscht und neu
  hinzugefügt werden. Dabei verliert sie ihren eigenen Speicher (Anmeldung,
  Firestore-Offline-Cache, `hm-tracker.`-Kopien). **Vorher die App einmal mit
  Netz öffnen**, damit offline erfasste Sätze synchronisiert sind; danach neu
  anmelden (Schlüsselbund).
- **R2 · Größe des Umbaus.** Praktisch jede Render-Funktion und der Großteil
  der Browser-Tests ändern sich; `app.js` hat rund 2300 Zeilen. Gefahr, dass
  dabei Verhalten verloren geht. Gegenmittel: Szenario-für-Szenario-Umbau der
  Tests (4.9), skelettartige Etappen, Kraft-Tag mit eigenem Render-Modul.
- **R3 · Kraft-Tag B ist eine Verhaltensänderung im Studio**, nicht nur Optik
  (Satz für Satz statt Formular). Mit F4–F6 und V1/V2 abgefedert; ein Fehler
  hier trifft das Training direkt.
- **R4 · Prüfbarkeit auf dem iPhone vor dem Merge** ist eingeschränkt (F12).
- **R5 · Parallelarbeit.** Läuft vor dem Merge noch eine Plan-Änderung
  (Re-Kalibrierung 28.10., Wochen 17–35 bis 22.11.) über `main`, muss der
  Branch nachgezogen werden; Konflikte sind nur in `plans/hm-2027.json` und dem
  Versionsstempel zu erwarten.
