# Stride — Anforderungen und Ausbaustufen

Stand: 22.10.2026 (Branch `stride-redesign`, Merge-Base `a6e6c4b`) · Trainingswoche 8 von 35 · Renntag So 02.05.2027

Dieses Dokument hält fest, was die App heute kann, worauf sie aufbaut und
was noch kommen soll. Es ist die gemeinsame Grundlage für spätere
Sessions — bei Änderungen bitte mitpflegen. Das Operative (Loslegen,
Ausliefern, Fallen) steht in [`HANDOFF.md`](HANDOFF.md).

## 1. Zweck und Rahmenbedingungen

Persönlicher Trainingstracker für einen 35-Wochen-Plan Richtung
**1:29:59 h** im Halbmarathon (Renntempo 4:16 /km, Start 31.08.2026,
Renntag 02.05.2027). Krafteinheiten werden von Hand eingetragen, Läufe
kommen automatisch aus Strava, ein KI-Coach ordnet die Woche ein.

Feste Randbedingungen, an denen sich jede Erweiterung messen lassen muss:

- **Ein Nutzer**, mehrere Geräte (Handy im Gym, Laptop zu Hause). Der
  Zugang ist an eine feste Firebase-UID gebunden.
- **Rein statische Seite**, kein Build-Schritt, Hosting auf GitHub Pages.
  Kein eigener Server — alles, was Geheimnisse braucht, läuft im
  Cloudflare Worker.
- **Handy zuerst.** Bedienbar mit einer Hand, Eingabe zwischen zwei
  Sätzen, oft bei schlechtem Netz.
- **Daten gehören dem Nutzer**, liegen in seinem Firebase-Projekt und
  lassen sich als JSON-Datei exportieren.

## 2. Ist-Stand

### Anmeldung

Die App verlangt eine Anmeldung mit E-Mail und Passwort (ein Konto, in der
Firebase-Console angelegt, keine Registrierung in der App). Firestore-Regeln
und Worker lassen nur diese eine UID durch. Ohne Anmeldung zeigt die App
nur den Anmeldebildschirm, ein fremdes Konto sieht „Kein Zugriff“. Im
Plan-Tab gibt es eine Konto-Karte; „Abmelden“ sendet erst offene Einträge
und räumt dann Offline-Speicher und lokale Kopien des Geräts.

### Screens (Stride)

Die App heißt Stride (vorher Halbmarathon-Tracker) und hat ein neues Design: Geist und Geist
Mono (selbst gehostet, v1.8.1, Prüfsummen in `HANDOFF.md`), Teal als Primärfarbe, Koralle nur
für Läufe und Strava, Fehler immer in Danger-Rot, schwebende Tab-Leiste, Seitenkopf scrollt mit,
helles und dunkles Schema, bedienbar von 320 px Breite bis Desktop (Spalte 480 px).

| Screen | Inhalt |
| --- | --- |
| **Heute** (Tab) | Kopfzeile mit Datum, Woche, Phase, Countdown; Heute-Karte (Training starten bzw. Lauf mit Soll, sonst Ruhetag), „Morgen“, KI-Coach (täglich zwei Sätze, montags Wochenbilanz), vier Ampeln mit Erklärung je Ampel, „Diese Woche“ mit sieben Tageskreisen. „Im Detail“ ist entfallen (siehe `backlog.md`, Desktop-Analyse) |
| **Woche** (Tab) | Tagesliste mit Status-Pillen über alle 35 Wochen, vor/zurück, eine Zeile offen, „Tag öffnen“; optionale Kraft zählt nicht zum Wochensoll |
| **Kraft-Tag** (`view-kraft.js`, `kraftflow.js`) | Satz für Satz: Jetzt-Karte mit zwei Steppern (Gewicht, Wdh; Tippen auf den Wert für direkte Eingabe), Fortschrittspunkte, Reihenfolge-Liste, Strava-Zeile der Einheit, Anpassen-Ansicht (entfernen, zurückholen, hinzufügen, ersetzen), Entwurf in `localStorage` (7 Tage) |
| **Lauf-Tag** (`view-run.js`, `runcompare.js`) | Vergleich Soll gegen Ist (Distanz mit Urteil „im Plan“/„zu kurz“, Pace- und HF-Band), Strava-Zeile, Zuordnungs-Sheet (Auswahl, „Kein Lauf an diesem Tag“, „Automatik zurück“, „Neu laden“) |
| **Verlauf** (Tab; `view-history.js`, `history-data.js`) | Lauf: vier Kennzahlen, Distanzbalken, Liste. Kraft: Übungs-Chips, Wochenbalken (Entlastungswochen markiert), Liste |
| **Plan** (Tab; `view-plan.js`) | Ziel-Karte, Phasenbalken, vier Phasen, HF- und Pace-Zonen, Karten „Daten“ (Export) und „Konto“ |
| **Tag ohne Einheit** | Ruhetag, Platzhalterwoche, „Bis zum Rennen“, „Kein aktiver Plan“; erreichbar über „Morgen“ auf Heute |
| **Login und Nebenscreens** (`view-account.js`) | Anmeldung, „Kein Zugriff“, Warten, Gate-Fehler |

### Funktionen

- **Krafttraining erfassen** — kg × Wdh für alle Sätze gleich oder je Satz
  einzeln. Speichern quittiert sofort und synchronisiert im Hintergrund,
  damit es im Gym ohne Netz nicht hängt.
- **Übungen anpassen** — pro Trainingstag Übungen entfernen, ersetzen,
  zurückholen oder eigene hinzufügen („Anpassen“).
- **Läufe automatisch zuordnen** — exakter Treffer am Plantag; sonst ein
  Lauf von einem Tag davor bis drei Tage danach, ausgewiesen als
  „nachgeholt“. Manuell korrigierbar („Anderen Lauf“, „Passt nicht“,
  „Zuordnung aufheben“).
- **Progressionsvorschlag statt RPE** — aus den Wiederholungen der
  letzten Einheit leitet die App ab, ob mehr Gewicht dran ist.
- **Ampeln** (`metrics.js`) — Kennzahlen aus Strava und Kraft-Logs mit
  Grenzwerten aus `THRESHOLDS` in `config.js`. Test- und Schwelleneinheiten
  zählen nicht in die Easy-Disziplin.
- **KI-Coach** — Worker-Endpunkt `/coach` ruft die Claude API auf. Ergebnis
  und Tageszähler liegen in Firestore (`coach/`, `coachweek/`); bei
  erreichtem Tageslimit oder Ausfall greift ein Regeltext. Anmeldefehler des
  Workers verbrauchen kein Kontingent.
- **Daten exportieren** — Plan-Tab, Karte „Daten“: alle Trainingsdaten
  (Strava, Kraft-Logs, Übungslisten, Lauf-Zuordnungen, Plan) als eine
  JSON-Datei, ohne Zugangsdaten. Fällt ein Teil aus, kommt der Rest mit
  einer Warnung in `meta.warnings`.
- **Offline-tauglich** — Firestore mit persistentem Cache; Eingaben im
  Funkloch werden später synchronisiert.
- **Dark Mode**, Zum-Home-Bildschirm-Manifest, Tableiste als Glasfläche.

### Plandaten

Der Plan liegt als Daten in `plans/hm-2027.json`, die Logik in `plan.js`.
**35 Wochen**, Renntag So 02.05.2027 (bestätigt). Wochen 1–16 sind mit
Tagesdetails ausformuliert (Läufe Mo/Mi/Sa, ab Woche 5 zusätzlich So;
Kraft Di/Do, teils optional), Wochen 17–35 nur als Phase mit Zeitraum und
Wochenkilometern. Re-Kalibrierungen: 28.10. und 22.11.2026. Alle Daten
werden aus dem Planstart berechnet, es gibt keine Datumstabellen.

## 3. Technischer Aufbau

| Datei | Aufgabe |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Oberfläche und Ablaufsteuerung |
| `ui.js`, `view-dashboard.js`, `view-week.js`, `view-account.js` | Gemeinsame UI-Helfer und Markup von Heute, Woche, Anmeldung |
| `view-kraft.js`, `kraftflow.js` | Kraft-Tag: Markup; reine Ablauflogik (Sätze, Startwerte, Payload) |
| `view-run.js`, `runcompare.js` | Lauf-Tag: Markup; Vergleich Soll gegen Ist |
| `view-history.js`, `history-data.js`, `view-plan.js` | Verlauf und Plan: Markup; Datenaufbereitung |
| `plan.js`, `plan-store.js`, `plans/hm-2027.json` | Plan-Logik, Laden und Validieren, die Plandaten |
| `runmatch.js` | Zuordnung Strava-Läufe → Plan-Lauftage |
| `progression.js` | Gewichtsvorschlag aus den letzten Wiederholungen |
| `metrics.js`, `coach.js` | Ampeln und Kennzahlen; Coach-Eingabe, Cache, Fallback |
| `export.js` | Zusammenstellung der Export-Datei |
| `access.js` | Zugangslogik (Sitzungszustand, Fehlertexte, Token-Retry) |
| `firebase-init.js`, `firestore.rules` | Firestore, Anmeldung, Offline-Cache; Zugriffsregeln |
| `strava.js`, `config.js` | OAuth-Ablauf und Aktivitäten-Abruf; Worker-URL, Client-ID, UID, Grenzwerte |
| `worker.js`, `wrangler.toml` | Cloudflare Worker: `/exchange`, `/refresh`, `/coach`, alle mit Token-Prüfung |
| `tools/bump-version.mjs` | Versionsstempel gegen den Browser-Cache |

Alle Komponenten und ihre Fallen stehen ausführlich in `README.md` und
`HANDOFF.md`.

### Datenmodell (Firestore)

| Pfad | Inhalt |
| --- | --- |
| `logs/{datum}_{übung}` | Sätze einer Übung: `sets[{kg,reps}]`, `topKg`, `totalReps`, `week`, `completed` |
| `dayplans/{datum}` | Angepasste Übungsliste: `removed[]`, `added[{name,soll,hint,replaces?}]` |
| `runlinks/{plandatum}` | Manuelle Lauf-Zuordnung: `activityId` (`null` = bewusst kein Lauf) |
| `coach/{datum}`, `coachweek/{woche}` | Coach-Text, Eingabe-Hash, Anzahl der Versuche des Tages |
| `config/strava` | Strava-Tokens |

`dayplans.added[]` trägt optional `replaces` — den Schlüssel der Übung,
die getauscht wurde. Daran hängt die Position in der Liste und die
Rückkehr des Originals.

### Fremdsysteme

- **Firebase** `trainingsplanung-2c6c0` — Firestore und Anmeldung mit
  E-Mail und Passwort (ein Konto), Regeln aus `firestore.rules` mit fester UID.
- **Cloudflare Worker** `trainingsplanung-auth` — hält die Strava- und
  Anthropic-Geheimnisse und prüft bei jedem Aufruf das Firebase-ID-Token.
  Nötig, weil Strava den Token-Austausch nicht per CORS aus dem Browser
  erlaubt und der Coach einen API-Schlüssel braucht.
- **Strava** — Aktivitäten, Client-ID öffentlich.
- **GitHub Pages** von `main`, Ordner `/`.

### Qualitätssicherung

`npm test` führt 20 Läufe aus: Plandaten und Plan-Logik, Golden-Test, Lauf-Zuordnung,
Progression, Versionsstempel, Stub-Wächter, Export, Ampeln, Coach, Worker (inkl.
Token-Prüfung), Zugangslogik, Konfigurationskonsistenz, `kraftflow`, `runcompare`,
`history-data`, `view-run`, `view-history`, Namens-Wächter und Quelltext-Greps (`static-greps`)
— alle ohne Browser — dazu 1125 Browser-Checks in Chromium gegen gestubbtes Firebase und
Strava. Abgedeckt unter anderem: Zeitzonen um Mitternacht, Satz-Ablauf und Entwurf,
verschobene Läufe, Übungen anpassen, Login-Zustände, Coach-Fallbacks, Export und die
**Prüfmatrix** (Szenario 34): sieben Fenstergrößen von 320 bis 1280 px, hell und dunkel,
alle Screens, ohne Überlauf, abgeschnittene oder verdeckte Elemente, mit Tippflächen
≥ 44 px, Eingaben ≥ 16 px, einem h1 je Screen und ohne `style=`. Das Ledger der
Prüfabsichten steht in `tests/README.md`.

**Fallen:** Der Testserver auf Port 8099 muss laufen und aus dem getesteten Verzeichnis
stammen. `.pipeline-state.md` (Pipeline-Stand der Agenten) steht in `.gitignore` und gehört
nicht ins Repo.

## 4. Bekannte Grenzen

- **Wochen 17–35** haben noch keine Tagesdetails.
- **Einträge lassen sich nur überschreiben, nicht löschen** (Lösch-Funktion im `backlog.md`).
- **Pausen-Timer, Desktop-Analyse („Im Detail“-Kennzahlen) und Login 1b Meilenstein B**
  stehen im `backlog.md`.
- **Offener CSS-Befund:** Chip-Text im Kraft-Verlauf (`.sd-filter__chip > span`) schneidet
  Unterlängen um etwa 2 px ab (Zeilenhöhe 13 px, Inhalt 15 px).
- **Kein Service Worker** — ohne Netz startet die App nicht, nur bereits
  geladene Daten und Eingaben überleben.
- **Browser-Cache** — gelöst über einen Versionsstempel
  (`npm run version` vor jedem Commit). Wird er vergessen, greift wieder
  der alte Cache; `npm test` warnt, wenn er inkonsistent ist.
- **Token-Lebensdauer** — ein ausgestelltes Firebase-ID-Token gilt bis zu
  einer Stunde; ein Konto-Wechsel greift beim Worker erst danach. Für einen
  Ein-Nutzer-Fall bewusst akzeptiert.
- **`app.js` ist groß** (rund 2500 Zeilen); ein Auslagern der Datenaufbereitung
  nach `dashboard-data.js` ist vorgemerkt.
- **Client-Geheimnisse** — das Strava-Client-Secret der ersten Fassung
  liegt weiterhin in der Git-Historie (Commit `5160b7d`) und wurde
  deshalb rotiert.

## 5. Geplante Erweiterungen

Aufwand grob: **S** = ein Handgriff · **M** = eine Session · **L** = mehr.

### Erledigt

Trainer-Auswertung (KI-Coach, Dashboard v2), Wettkampf-Countdown, Soll/Ist
im Wochenumfang, echtes Login (Schritt 1b), Export der Trainingsdaten und
der Umbau des Plans auf 35 Wochen mit Renntag 02.05.2027.

### Als Nächstes

| # | Vorhaben | Aufwand |
| --- | --- | --- |
| 1 | **Wochen 17–35 ausformulieren**, jeweils nach den Re-Kalibrierungen. Direkt in `plans/hm-2027.json`. | M je Block |
| 2 | **Schritt 2: Marathon-Coaching** — Mehrziel, Trainingsblöcke, Plan-Erzeugung durch Claude (Entwurf in `docs/requirements-marathon-coaching.md`). | L |

### Danach

| # | Vorhaben | Aufwand |
| --- | --- | --- |
| 3 | **Dauerhafte Planänderungen** — Übungstausch nicht nur für einen Tag, sondern für alle künftigen Einheiten. | M |
| 4 | **Pace über die Zeit** — Zeitachsen-Diagramm statt Balken, getrennt nach Easy/Long/Tempo. | M |
| 5 | **Service Worker** — App startet auch ohne Netz. | M |
| 6 | **Echte Lichtbrechung in der Glasleiste**, sobald WebKit `backdrop-filter: url()` mit SVG-Verzerrungsfiltern unterstützt ([w3c/svgwg#1142](https://github.com/w3c/svgwg/issues/1142)). Bis dahin bleibt es bei Unschärfe, Sättigung und Lichtkante. | S |
| 7 | **Verletzungs-/Belastungsnotiz** je Tag — freies Feld, das auch in den Coach einfließt. | S |
| 8 | **Garmin-Erholungsdaten** über Intervals.icu (HRV, Ruhepuls, Schlaf), siehe `backlog.md`. | M |

### Bewusst nicht geplant

- **RPE von Hand erfassen.** Im Gym soll niemand über sein Empfinden
  nachdenken müssen. Die Progression kommt stattdessen aus den
  Wiederholungen, die Belastung der Einheit aus der Herzfrequenz.
- **Mehrbenutzerbetrieb**, Vereins- oder Freundesfunktionen. Die Idee „Freunde
  als eigene Nutzer“ ist mit ihren Voraussetzungen in `backlog.md`
  festgehalten; bis dahin bleibt die App auf genau einen Nutzer zugeschnitten.
- Ein Build-Schritt oder ein Framework, solange es ohne geht.

### Aufgehobener Ausschluss

- **Eigene Trainingsplan-Erstellung in der App** war früher ausgeschlossen
  („der Plan entsteht außerhalb“). Mit **Schritt 2** wird das aufgehoben:
  Louis legt Ziele in der App an, Claude erzeugt über den Worker Gerüst und
  Tagesdetails, Louis prüft und aktiviert. Bis Schritt 2 umgesetzt ist, gilt
  weiter der Ist-Stand (Plan als JSON-Datei im Repo).
