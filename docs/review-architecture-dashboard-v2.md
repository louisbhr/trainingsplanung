# Architektur-Review: Dashboard v2 (Schritt 1)

Stand: 27.09.2026 · architecture-reviewer (Pipeline-Schritt 4)
Geprüft: `docs/plan-dashboard-v2.md` gegen `docs/requirements-dashboard-v2.md`
(freigegeben), `docs/requirements-login.md` (1b), `docs/requirements-marathon-coaching.md`
(2) und den Ist-Code (`plan.js`, `app.js`, `config.js`, `strava.js`, `firebase-init.js`,
`worker.js`, `wrangler.toml`, `firestore.rules`, `tools/bump-version.mjs`,
`tests/version.test.mjs`, `tests/app.test.mjs`, `package.json`).
Modell-Angaben geprüft mit der claude-api-Referenz (Stand 2026-06-24).

Visual Plan: **nicht publiziert.** Der Text-Plan ist vollständig, die UI ist über das
abgenommene Mockup abgedeckt, die offenen Punkte sind Schema-/API-Details, die in Text
besser prüfbar sind. Kein Bedarf, der die Einbindung eines weiteren Werkzeugs rechtfertigt.

## Gesamturteil

**Freigabefähig mit Auflagen.** Die Architektur ist tragfähig und passt ohne Umbau zu 1b
und Schritt 2. Keine neuen Dependencies. Die Auflagen (A1–A10) sind Präzisierungen und
Sicherheitsnetze, keine Richtungswechsel. Sieben Entscheidungen (E1–E7) muss Louis
bestätigen.

## Urteil je Gate

| Gate | Urteil |
| --- | --- |
| Firestore `coach/` + `coachweek/` | OK mit Auflage A4 (Zähler zählt Versuche, Felder `model`/`promptVersion`). Passt zu 1b (UID-Regel auf `/{document=**}` deckt beide ab) und Schritt 2 (`planId` vorhanden; ein aktiver Plan pro Datum, da Blöcke nicht überlappen). |
| Worker `POST /coach` | OK mit Auflage A3 (Body als Text begrenzen, Zeichen-Whitelist für String-Felder, Eingabe als Daten-Block). Origin-Regel „leer → 403“ richtig. Kostenrisiko bis 1b durch Ausgabenlimit begrenzt (E2). |
| Modell / Header | OK: Alias `claude-haiku-4-5`, `anthropic-version: 2023-06-01`, raw `fetch`. Begründung im Plan korrigieren (A10). |
| Datei-Organisation | OK: `plans/`, flache Module, `plan-store.js` als einzige Andockstelle für 1b. JSON-Form Firestore-tauglich. Plan-Laden braucht Auflage A1. |
| Refactor-Umfang | OK: `app.js` nur teilweise zerlegen ist richtig für den Termin. Sicherheitsnetz Schritt 1–2 reicht so **nicht** ganz → Auflage A2. |
| Dependencies | Keine neuen. `localStorage`-Kopie (A1) ist keine Dependency. |
| Security | OK für eine Zwischenstufe bis 1b, mit A5 (XSS über Coach-Text/Firestore-Cache). |

## Befunde im Einzelnen

### 1. Firestore-Schema

- `coach/{YYYY-MM-DD}` nach lokalem Datum, `planId` als Feld: passt, weil es nie zwei
  aktive Pläne am selben Tag gibt (Schritt 2 validiert Überlappung).
- `coachweek/{planId}_W{n}`: passt; Wochennummer ist planrelativ, deshalb richtig mit
  `planId` im Schlüssel.
- `generations`: nötig und richtig. Aber: Der Plan sagt nicht, **wann** gezählt wird.
  Wird erst nach Erfolg gezählt, kann eine Fehlerschleife (Refusal, `max_tokens`,
  Upstream 5xx nach bezahltem Output) unbegrenzt Aufrufe auslösen → A4.
- Limits nur clientseitig: bekannt und akzeptiert; zwei Geräte gleichzeitig können
  das Limit um 1–2 überschreiten (Offline-Cache synchronisiert verzögert). Unkritisch.
- 1b: `allow read, write: if request.auth.uid == "<UID>"` auf `/{document=**}` deckt
  beide Sammlungen ohne Regeländerung ab. Kein Konflikt mit `plans/` + `versions/`.
- Schritt 2 (M8, versionierte Coach-Schemas): Ein Feld `promptVersion` (und `model`)
  im Dokument kostet nichts und macht spätere Auswertung/Migration möglich → A4.

### 2. Worker-API `/coach`

- Routing vor der Strava-Secret-Prüfung: nötig, weil der Ist-Code sonst ohne
  Strava-Secrets mit 500 antwortet. Richtig erkannt.
- `ALLOWED_ORIGINS` leer → `/coach` 403, `/exchange`/`/refresh` unverändert `*`:
  richtig.
- **Größenlimit:** `request.json()` liest den ganzen Body; `Content-Length` kann fehlen
  (chunked). Body als Text lesen, Länge prüfen, dann `JSON.parse` → A3.
- **„Keine freien Texte in den Prompt“ stimmt so nicht:** `detail` (≤ 80), `name`,
  `next`, `aerobeEffizienzTrend`, `progression[].exercise/detail` sind freie Strings.
  Bis 1b kann jeder mit gefälschtem Origin darüber den Worker als allgemeinen
  Haiku-Proxy nutzen (Output durch `max_tokens` gedeckelt, Nutzen gering, aber
  vermeidbar) → Zeichen-Whitelist + Eingabe als klar markierter JSON-Datenblock in
  der User-Nachricht, Systemprompt fest (A3).
- Fehlercodes vollständig und sinnvoll. Ergänzung: Upstream-401 (falscher Key) im
  Worker per `console.log` unterscheidbar loggen (`wrangler tail`), nach außen weiter
  `upstream_error`.
- **Modell (geprüft):** Haiku 4.5 aktiv, Alias `claude-haiku-4-5`, Snapshot
  `claude-haiku-4-5-20251001`, `anthropic-version: 2023-06-01`, $1/$5 pro MTok.
  **Die Begründung im Plan („Alias überlebt eine Snapshot-Stilllegung“) ist falsch:**
  Alias und Snapshot bezeichnen dasselbe Modell und werden gemeinsam stillgelegt. Der
  Alias springt auch nicht auf eine neue Generation (Haiku 5 bekäme einen eigenen
  Alias). Praktisch sind beide heute gleichwertig. **Empfehlung: Alias**, weil die
  Referenz Aliase empfiehlt und es keinen messbaren Stabilitätsnachteil gibt. Echter
  Schutz gegen Stilllegung: Modell als **eine** Konstante im Worker (Wechsel = eine
  Zeile + Deploy), Stilllegung degradiert ohnehin sauber auf den Regel-Fallback (502),
  Deprecation-Mails der Console beachten (A10).
- `max_tokens` 200/450: passend. Kosten grob: täglich ~1k Input + ≤200 Output ≈ 0,2 Cent,
  Wochenbilanz ≈ 0,3–0,4 Cent; bei Ausschöpfen aller Limits < 0,30 USD/Monat.
- **Kostenmissbrauch bis 1b:** Worker-URL steht im öffentlichen Repo, Origin ist
  fälschbar. Pro Missbrauchsaufruf (8 KB Input, 450 Output) ≈ 0,5 Cent. Die einzige
  harte Grenze ist das Console-Ausgabenlimit. Empfehlung (E2): eigener Workspace/Key
  nur für diese App mit niedrigem Monatslimit (z. B. 5 USD), damit Missbrauch nicht das
  Budget anderer Projekte (z. B. ResearchLab) trifft; Worker-`/coach` erst kurz vor dem
  Merge deployen; 1b direkt danach. Ein Worker-eigenes Tageslimit (KV-Binding) wäre
  möglich, ist aber Infrastruktur-Änderung und lohnt für die kurze Zwischenzeit nicht.

### 3. Datei-Organisation und JSON

- Flache Module: zwingend, weil `tests/version.test.mjs` alle `*.js` im Wurzelverzeichnis
  außer `worker.js` einsammelt und `bump-version` nur `./name.js`-Importe stempelt.
  `tools/generate-plan-json.mjs` liegt in `tools/` und stört den Test nicht.
- JSON-Form: Firestore-tauglich (keine Array-in-Array, `phases[].weeks` als
  `{from,to}`, ISO-Strings statt Timestamps, `null` erlaubt). Tiefe ~5 (Limit 20),
  Größe weit unter 1 MiB auch mit 31 ausgeschriebenen Wochen. `id: "hm-2027"` passt
  1:1 zu `plans/hm-2027` in 1b. `week.sessions[]` + `placeholder` ≙ Grobgerüst aus
  Schritt 2. Passt ohne Umbau.
- Kleinigkeiten: `detailedUntilWeek` ist redundant zu `placeholder` → in `validatePlan`
  auf Konsistenz prüfen. `fileVersion` per Regex auf festes Format prüfen
  (lexikografischer Vergleich in 1b). Bekannte Grenze für Schritt 2: `runlinks/{datum}`
  setzt einen Lauf pro Tag voraus (Doppeltage im Marathonblock) — heute kein Thema,
  nur notiert.
- **Versionsstempel für die JSON-URL:** Mit einer eigenen Regel in `bump-version` und
  einer Prüfung in `version.test` funktioniert das. Es schützt aber nur, wenn
  `npm run version` nach **jeder** JSON-Änderung läuft; Wochen 9–31 und das Renndatum
  werden von Claude Code in der JSON gepflegt, da ist das Vergessen wahrscheinlich.
  Zusätzlich `fetch(..., { cache: "no-cache" })` (Revalidierung per ETag, ein 304 pro
  Start) → A1.
- **URL-Auflösung:** `fetch("./plans/…")` löst relativ zur **Seite** auf, nicht zum
  Modul. Robuster: `new URL("./plans/hm-2027.json?v=…", import.meta.url)` → A1.

### 4. Refactor-Risiko Schritt 1–2

- Reihenfolge (erst JSON + Parität, dann Umschalten) ist richtig.
- **Lücke 1:** `app.js` greift schon beim Modul-Import synchron auf Plandaten zu
  (`state.weekNo = weekNumberFor(todayISO())`, `defaultHistoryExercise()` →
  `weeks[...]`, `exerciseCatalog`). Mit asynchronem Laden muss das in `init()` nach
  `loadPlans()` wandern — im Plan nicht erwähnt → A1.
- **Lücke 2:** Schlüssel-tragende Werte. Log-IDs sind `logs/{datum}_{slug(name)}`,
  dazu `dayplans/{datum}`, `runlinks/{datum}`. Ändert sich ein Übungsname oder
  `slug()` beim Umzug nach `plan.js` auch nur um ein Zeichen, „verschwinden“ echte
  Logs still. Die Feld-Parität in Schritt 1 deckt die Daten ab, aber der Paritätstest
  wird in Schritt 2 **gelöscht** — genau in dem Schritt, in dem die Logik umgebaut
  wird. Das Sicherheitsnetz fehlt also dort, wo es gebraucht wird → A2.
- **Lücke 3:** Die 141 Browser-Checks laufen fast alle mit festem Datum in Woche 2
  (`2026-09-07`). Sie decken Deload-Wochen, Recovery-Sonntage, Woche 1 (alter Split),
  Woche 8 (Re-Kalibrierungs-Hinweis) und die Grenze Woche 8/9 nicht ab → A2
  (Golden-Test über alle Tage).
- `weekNumberFor → null`: Vor Planstart lieferte es bisher 1, künftig `null`. Heute
  irrelevant (wir sind in Woche 4), aber jeder Aufrufer (`app.js` Zeilen 44, 53, 93,
  147, 537, 764, 959, 1021, 1059) muss es behandeln; Zeile 537 schreibt `week` in
  Logs — dort nie `null` schreiben (Logs gibt es nur an Plan-Krafttagen, also sicher,
  aber explizit absichern).
- „App sieht exakt aus wie vorher“ ist im Plan-Tab nicht ganz haltbar: `goal.time`
  („1:29:59 h“) und `goal.race` („Halbmarathon, Anfang/Mitte April 2027“) gibt es im
  neuen `goal` nicht. Formatierung aus `goal` ableiten und die kleine Textänderung
  im Test bewusst anpassen, nicht als Regression werten.
- Stub-Risiko `app.test.mjs`: berechtigt und im Plan benannt. Zusätzlich: der
  `config.js`-Stub (Zeile ~295) ersetzt die **ganze** Datei → `THRESHOLDS`,
  `WORKER_URL`, `COACH_URL` müssen dort vollständig stehen, sonst bricht der Import.
  Empfehlung: in Schritt 1 einen kleinen Test, der die Exportnamen von Stub und
  echter Datei vergleicht (ohne Browser, per Regex) — macht das „stille Brechen“ laut.

### 5. Offene Punkte des Planners

- **Lücke 05.–11.04.2027:** Behandlung als Platzhalter ist in Ordnung, aber generisch
  formulieren: Zustand „aktiver Plan, Datum in keiner Planwoche“ (Kopfzeile
  „Rennwoche“ bzw. „Bis zum Rennen“, drei Ampeln grau, Belastung rechnet, Coach ohne
  API-Aufruf). Zusätzlich `validatePlan`: Ist `raceDateConfirmed: true`, müssen die
  Wochen das Renndatum abdecken — so erzwingt der Test, dass die Lücke beim Eintragen
  des echten Datums geschlossen wird (A8).
- **Kritischer Pfad bis 26.10.:** Heute ist der 27.09. — vier Wochen für 12
  Arbeitspakete plus Pipeline-Schritte 8–13. Die eigentliche harte Frist betrifft nur
  das **Datenformat**: Ab 26.10. werden Wochen 9–31 geschrieben, und zwar in die JSON.
  Empfehlung (E6): Schritte 1–2 (+ Versionsstempel) als eigenen, verhaltenserhaltenden
  Meilenstein A früh nach `main` mergen (Ziel ~19.10.), Dashboard/Coach folgen. Dann
  hängt der 26.10. nicht mehr am Coach oder den Ampeln.
- **Test-Stub-Risiko:** siehe 4.

### 6. Vom Planner übersehen

- **Offline/Funkloch beim JSON-fetch:** Es gibt keinen Service Worker; ein Kaltstart
  ganz ohne Netz geht schon heute nicht. Neu ist aber der Teilausfall im Gym: Module
  kommen aus dem HTTP-Cache, der JSON-Abruf scheitert → heute wäre die Tagesansicht
  da, künftig nur „Plan konnte nicht geladen werden“ und **kein Satz-Logging**.
  Das ist eine Regression → A1 (letzte gültige Kopie in `localStorage`).
- **Safari/Home-Bildschirm-Caching:** siehe 3 (Stempel + `no-cache`).
- **Zeitzonen/Sommerzeit:** Datumslogik ist lokal und rundet korrekt. Risiko liegt in
  den neuen Fenstern von `metrics.js` (7/28/42 Tage): **zwei Zeitumstellungen liegen
  im Plan (25.10.2026, 28.03.2027).** Alle Fenster über ISO-Daten mit
  `addDays`/`daysBetween`, nie über `Date.now() - n*86400000` → A7 mit Test über die
  Umstellung. Coach-Dokument nach lokalem Datum, Wochenbilanz „ab Montag lokal“: ok.
- **Fehlertrennung:** Plan (`source: "plan"`), Firebase, Strava sind getrennt; ergänzen:
  Coach-Fehler erscheinen nie als Fehlerkarte (stiller Fallback); **ohne lesbares
  Coach-Dokument kein API-Aufruf** (sonst greift kein Limit); Firebase-Ausfall darf
  das Dashboard nicht leeren (Ampeln mit Kraftdaten grau, Rest rendert).
- **XSS:** Coach-Text aus der API und aus dem Firestore-Cache wird ins HTML gerendert.
  Cache-Inhalte gelten bis 1b nicht als vertrauenswürdig, deshalb immer escapen → A5.
- **Strava-Paginierung:** Ist-Code bricht bei `batch.length < 50` ab und holt max. 4
  Seiten. Bei `per_page=200` muss die Abbruchbedingung mit, sonst endet der Abruf
  nach der ersten Seite nicht korrekt bzw. zu früh → A6.

## Auflagen (Änderungen am Plan, verbindlich für den Coder)

- **A1 Plan-Laden (`plan-store.js`, `app.js`):** URL per
  `new URL("./plans/hm-2027.json?v=<stempel>", import.meta.url)`, `fetch` mit
  `cache: "no-cache"`; nach erfolgreicher Validierung Kopie in `localStorage`
  (Schlüssel mit `id`, nur bei gleichem `schemaVersion` nutzen). Scheitert der Abruf:
  letzte gültige Kopie + dezenter Hinweis „Plan aus letzter Kopie“; nur wenn keine
  Kopie existiert → Fehlerkarte „Plan konnte nicht geladen werden“. Alle
  Modul-Top-Level-Zugriffe auf Plandaten (`state.weekNo`, `defaultHistoryExercise`)
  nach `loadPlans()` in `init()` verschieben. Browser-Tests: JSON 404 mit und ohne
  vorhandene Kopie.
- **A2 Sicherheitsnetz Schritt 2:** Die alte `plan.js` nicht löschen, sondern nach
  `tests/fixtures/plan-legacy.mjs` verschieben (nicht im Wurzelverzeichnis, also
  unberührt vom Versionstest) und bis zum Ende von Schritt 1 behalten. Golden-Test:
  für **jeden Tag** von 2026-08-24 bis 2026-10-31 liefert der neue Zugriff
  (`sessionOn`) dieselbe Einheit wie das alte `dayInfo` (Art, Datum, Titel, Distanz,
  Übungsnamen, Soll, Hinweise) und `slug(name)` bleibt für jede Übung identisch.
  Paritätsvergleich nur für Wochen 1–8 (ab 26.10. ändern sich 9–31 absichtlich). In
  Schritt 2 wird kein Browser-Check gestrichen; umgezogene Checks im Diff einzeln
  nachvollziehbar.
- **A3 Worker:** Body als Text lesen, > 8192 Byte → 413, dann `JSON.parse`. Alle
  freien String-Felder: keine Zeilenumbrüche, Zeichen-Whitelist (Buchstaben inkl.
  Umlaute, Ziffern, Leerzeichen, `.,:;/()+-–×%°'`), sonst 400. Validierte Eingabe als
  JSON in einem klar markierten Datenblock der User-Nachricht; Systemprompt fest im
  Worker, nur der Ziel-Satz aus Enum-/Regex-validierten Werten. `stop_reason` prüfen,
  nur `text`-Blöcke lesen. Modell als eine Konstante. Upstream-Fehler intern loggen.
- **A4 Coach-Limit und Dokument:** `generations` zählt **Versuche** und wird vor dem
  API-Aufruf hochgezählt geschrieben. Kann das Coach-Dokument nicht gelesen oder
  geschrieben werden → kein API-Aufruf, Fallback. Limit erreicht → letzten
  gespeicherten KI-Text des Tages zeigen, sonst Fallback. Zusätzliche Felder
  `model` und `promptVersion` in `coach/` und `coachweek/`.
- **A5 Escaping:** Coach-Texte (API und Firestore) ausschließlich über `esc()` bzw.
  `textContent` rendern; Browser-Test mit `<img onerror>`-Text im Stub.
- **A6 Strava:** Abbruchbedingung auf die neue Seitengröße umstellen
  (`batch.length < 200`), Seitenlimit bewusst festlegen (z. B. 5) und kommentieren.
- **A7 Datumsfenster:** Alle Fenster in `metrics.js` über ISO-Daten; Tests mit Fenstern
  über den 25.10.2026 und den 28.03.2027 (Browser-Tests laufen bereits in Berliner
  Zeit).
- **A8 Plan-Lücke:** generischer Zustand „aktiver Plan, keine Planwoche“ (wie oben);
  `validatePlan`: bei `raceDateConfirmed: true` müssen die Wochen das Renndatum
  abdecken; `detailedUntilWeek` konsistent zu `placeholder`; `fileVersion`-Format per
  Regex.
- **A9 Stub-Wächter:** Node-Test vergleicht die Exportnamen von `config.js`/
  `firebase-init.js` mit den Stubs in `app.test.mjs`.
- **A10 Plantext:** Modell-Begründung korrigieren (Alias = gleiches Modell, gleiche
  Stilllegung; Schutz = eine Konstante + Fallback).

## Entscheidungen für Louis

- **E1 Firestore-Schema:** neue Sammlungen `coach/{datum}` und `coachweek/{planId}_W{n}`
  mit `planId`, `text`, `generatedAt`, `inputHash`, `generations`, `model`,
  `promptVersion` (+ `week` bei `coachweek`). Empfehlung: **ja.**
- **E2 Worker `/coach` und Kostenrisiko bis 1b:** Endpunkt wie geplant plus A3. Bis 1b
  schützt nur das Ausgabenlimit. Empfehlung: **ja**, mit eigenem Workspace/API-Key nur
  für diese App und niedrigem Monatslimit (Vorschlag 5 USD); `/coach` erst kurz vor dem
  Merge deployen; 1b direkt danach.
- **E3 Modell:** Alias `claude-haiku-4-5` (statt Snapshot `…-20251001`),
  `max_tokens` 200 täglich / 450 Wochenbilanz. Empfehlung: **Alias**, gleichwertig
  zum Snapshot, springt nicht automatisch auf eine neue Generation.
- **E4 Datei-Organisation:** Ordner `plans/`, flache Module, `app.js` nur teilweise
  zerlegt (bleibt ~900 Zeilen, bewusst akzeptierte Schuld). Empfehlung: **ja.**
- **E5 Plan-Kopie im Browser:** letzte gültige Plandatei in `localStorage`, damit
  Satz-Logging bei Funkloch nicht ausfällt (A1). Empfehlung: **ja** (keine
  Dependency; wird mit 1b durch den Firestore-Offline-Cache ergänzt).
- **E6 Meilenstein A:** Schritte 1–2 (JSON + Umschalten, verhaltenserhaltend) als
  eigenen Zwischenstand früh nach `main` bringen (Ziel ~19.10.), mit
  Run-Verify/Tests/Review für diesen Ausschnitt; Dashboard und Coach folgen.
  Empfehlung: **ja** — so hängt die Frist 26.10. nur noch am Datenformat.
- **E7 Lücke 05.–11.04.2027:** generischer Zustand „Bis zum Rennen“ statt Sonderfall;
  Plan-Validierung erzwingt, dass das bestätigte Renndatum in den Planwochen liegt.
  Empfehlung: **ja.**
