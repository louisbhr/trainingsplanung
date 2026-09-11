# Halbmarathon-Tracker — Anforderungen und Ausbaustufen

Stand: 11.09.2026 · Trainingswoche 2 von 31 · Wettkampf Anfang/Mitte April 2027

Dieses Dokument hält fest, was die App heute kann, worauf sie aufbaut und
was noch kommen soll. Es ist die gemeinsame Grundlage für spätere
Sessions — bei Änderungen bitte mitpflegen.

## 1. Zweck und Rahmenbedingungen

Persönlicher Trainingstracker für einen 31-Wochen-Plan Richtung
**1:29:59 h** (Renntempo 4:16 /km). Krafteinheiten werden von Hand
eingetragen, Läufe kommen automatisch aus Strava.

Feste Randbedingungen, an denen sich jede Erweiterung messen lassen muss:

- **Ein Nutzer**, mehrere Geräte (Handy im Gym, Laptop zu Hause).
- **Rein statische Seite**, kein Build-Schritt, Hosting auf GitHub Pages.
  Kein eigener Server — alles, was Geheimnisse braucht, läuft im
  Cloudflare Worker.
- **Handy zuerst.** Bedienbar mit einer Hand, Eingabe zwischen zwei
  Sätzen, oft bei schlechtem Netz.
- **Daten gehören dem Nutzer**, liegen in seinem Firebase-Projekt.

## 2. Ist-Stand

### Tabs

| Tab | Inhalt |
| --- | --- |
| **Heute** | Die heutige Einheit: Krafttag mit Eingabefeldern, Lauftag mit Soll-Werten und Strava-Ergebnis, sonst Ruhetag |
| **Woche** | Sieben Tagespillen, vor/zurück über alle 31 Wochen, heute markiert, Wochenumfang; Tag antippen öffnet die Detailansicht |
| **Verlauf** | Kraft: bestes Satzgewicht je Übung über die Zeit, Übung wählbar. Lauf: Distanz je Lauf, Pace als Label, 7- und 28-Tage-Summe |
| **Plan** | Zielkarte mit Zeitleiste über alle 31 Wochen, vier farbige Phasen, HF- und Pace-Zonen |

### Funktionen

- **Krafttraining erfassen** — kg × Wdh für alle Sätze gleich oder je Satz
  einzeln. Speichern quittiert sofort und synchronisiert im Hintergrund,
  damit es im Gym ohne Netz nicht hängt. Erledigte Übungen sind farblich
  markiert, mit Fortschrittszähler.
- **Übungen anpassen** — pro Trainingstag Übungen entfernen, ersetzen,
  zurückholen oder eigene hinzufügen. „+ Übung hinzufügen" steht immer
  unter der Liste, für den Fall im Gym; Ersetzen und Entfernen stecken
  hinter „Anpassen". Eine Ersetzung rückt an die Stelle der getauschten
  Übung; wird sie entfernt, kommt das Original zurück. Eigene Übungen
  nutzen denselben Schlüssel wie Plan-Übungen und tauchen im Verlauf auf.
- **Läufe automatisch zuordnen** — exakter Treffer am Plantag; sonst ein
  Lauf von einem Tag davor bis drei Tage danach, ausgewiesen als
  „nachgeholt". Kein Lauf wird doppelt vergeben. Manuell korrigierbar
  („Anderen Lauf", „Passt nicht", „Zuordnung aufheben").
- **Progressionsvorschlag statt RPE** — aus den Wiederholungen der
  letzten Einheit leitet die App ab, ob heute mehr Gewicht dran ist
  (Double Progression). Keine zusätzliche Eingabe im Gym.
- **Belastung der Krafteinheit** — Ø und max. Herzfrequenz, Dauer und
  Relative Effort kommen automatisch aus der Strava-Krafteinheit.
- **Offline-tauglich** — Firestore mit persistentem Cache; Eingaben im
  Funkloch werden später synchronisiert.
- **Dark Mode**, Zum-Home-Bildschirm-Manifest. Die Tableiste liegt als
  durchscheinende Glasfläche über dem Inhalt, der darunter durchscrollt.

### Plandaten (`plan.js`)

Wochen 1–8 vollständig: Läufe (Mo/Mi/Sa, ab Woche 5 zusätzlich So) und
zwei Krafteinheiten (Di/Do) mit Sätzen, Wiederholungen und Hinweisen je
Woche. Wochen 9–31 nur als Phase mit Zeitraum und Schwerpunkt. Alle Daten
werden aus `PLAN_START` berechnet, es gibt keine handgepflegten
Datumstabellen.

## 3. Technischer Aufbau

| Datei | Aufgabe |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Oberfläche und Ablaufsteuerung |
| `plan.js` | Trainingsplan, Datums- und Wochenlogik |
| `runmatch.js` | Zuordnung Strava-Läufe → Plan-Lauftage (ohne Browser testbar) |
| `progression.js` | Gewichtsvorschlag aus den letzten Wiederholungen (ohne Browser testbar) |
| `tools/bump-version.mjs` | Versionsstempel gegen den Browser-Cache |
| `firebase-init.js` | Firestore, anonyme Anmeldung, Offline-Cache |
| `strava.js` | OAuth-Ablauf und Aktivitäten-Abruf |
| `config.js` | Worker-URL und Strava-Client-ID |
| `worker.js`, `wrangler.toml` | Cloudflare Worker für den Token-Austausch |
| `firestore.rules` | Zugriffsregeln |

### Datenmodell (Firestore)

| Pfad | Inhalt |
| --- | --- |
| `logs/{datum}_{übung}` | Sätze einer Übung: `sets[{kg,reps}]`, `topKg`, `totalReps`, `week`, `completed` |
| `dayplans/{datum}` | Angepasste Übungsliste: `removed[]`, `added[{name,soll,hint}]` |
| `runlinks/{plandatum}` | Manuelle Lauf-Zuordnung: `activityId` (`null` = bewusst kein Lauf) |

`dayplans.added[]` trägt optional `replaces` — den Schlüssel der Übung,
die getauscht wurde. Daran hängt die Position in der Liste und die
Rückkehr des Originals.
| `config/strava` | Strava-Tokens |

### Fremdsysteme

- **Firebase** `trainingsplanung-2c6c0` — anonyme Anmeldung aktiv, Regeln
  aus `firestore.rules` veröffentlicht.
- **Cloudflare Worker** `trainingsplanung-auth` — hält
  `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ALLOWED_ORIGINS`. Nötig,
  weil Strava den Token-Austausch nicht per CORS aus dem Browser erlaubt.
- **GitHub Pages** von `main`, Ordner `/`.

### Qualitätssicherung

`npm test` — 81 Prüfungen der Plandaten, 29 der Lauf-Zuordnung, 27 der
Progressionslogik und die Versionsstempel (alle ohne Browser), dazu 132
Browser-Checks in
Chromium gegen gestubbtes Firebase/Strava. Abgedeckt unter anderem:
Zeitzonen um Mitternacht, Speichern und Wiederherstellen, verschobene
Läufe, Übungen anpassen und ersetzen, Progressionsvorschläge,
Fehlerzustände, Glasleiste, kein horizontales Scrollen.

## 4. Bekannte Grenzen

- **Wochen 9–31** haben noch keine Tagesdetails.
- **Anonyme Anmeldung** — die Regeln erlauben jedem angemeldeten Nutzer
  Zugriff, und jeder Seitenbesucher meldet sich anonym an. Für ein
  privates Tool vertretbar, aber kein echter Schutz.
- **Kein Service Worker** — ohne Netz startet die App nicht, nur bereits
  geladene Daten und Eingaben überleben.
- **Browser-Cache** — gelöst über einen Versionsstempel
  (`npm run version` vor jedem Commit). Wird er vergessen, greift wieder
  der alte Cache; `npm test` warnt, wenn er inkonsistent ist.
- **Client-Geheimnisse** — das Strava-Client-Secret der ersten Fassung
  liegt weiterhin in der Git-Historie (Commit `5160b7d`) und wurde
  deshalb rotiert.

## 5. Geplante Erweiterungen

Aufwand grob: **S** = ein Handgriff · **M** = eine Session · **L** = mehr.

### Als Nächstes

| # | Vorhaben | Aufwand |
| --- | --- | --- |
| 1 | **Trainer-Auswertung.** Worker-Endpunkt `/coach` ruft die Claude API auf und liefert eine kurze Einschätzung zum Trainingsfortschritt: Verlauf der Kraftwerte gegen den Plan, Laufumfang und Pace-Entwicklung, Empfehlung fürs Weitermachen. Einmal pro Woche automatisch, Ergebnis in Firestore, plus Knopf „Neu einschätzen". Endpunkt an die Firebase-Anmeldung binden und Tageslimit setzen, sonst zahlt jeder Fremdaufruf auf die Rechnung ein. Grob 8 Cent je Auswertung. **Verabredet für Ende September, wenn genug echte Daten da sind.** | M |
| 2 | **Wochen 9–31 ausformulieren** — nach der Re-Kalibrierung am Ende von Phase 1 (Woche 8, ab 19.10.2026). Gleiches Muster wie Woche 1–8 in `plan.js`. | M |

### Danach

| # | Vorhaben | Aufwand |
| --- | --- | --- |
| 3 | **Dauerhafte Planänderungen** — Übungstausch nicht nur für einen Tag, sondern für alle künftigen Einheiten übernehmen. | M |
| 4 | **Soll/Ist im Wochenumfang** — geplante gegen gelaufene Kilometer je Woche, als Balken im Verlauf. | S |
| 5 | **Pace über die Zeit** — echtes Zeitachsen-Diagramm statt Balken, getrennt nach Easy/Long/Tempo, um die Entwicklung Richtung 4:16 zu sehen. | M |
| 6 | **Service Worker** — App startet auch ohne Netz. | M |
| 7 | **Echtes Login** statt anonymer Anmeldung, Firestore-Regeln an die eigene UID binden. | M |
| 8 | **Wettkampf-Countdown** und Formkurve auf dem Heute-Tab. | S |
| 9 | **Echte Lichtbrechung in der Glasleiste**, sobald WebKit `backdrop-filter: url()` mit SVG-Verzerrungsfiltern unterstützt. Heute nur in Chromium möglich, auf dem iPhone wirkungslos; standardisiert wird es gerade unter [w3c/svgwg#1142](https://github.com/w3c/svgwg/issues/1142). Bis dahin bleibt es bei Unschärfe, Sättigung und Lichtkante. | S |
| 10 | **Export** der Trainingsdaten als CSV oder JSON. | S |
| 11 | **Verletzungs-/Belastungsnotiz** je Tag — freies Feld, das auch in die Trainer-Auswertung einfließt. | S |

### Bewusst nicht geplant

- **RPE von Hand erfassen.** Im Gym soll niemand über sein Empfinden
  nachdenken müssen. Die Progression kommt stattdessen aus den
  Wiederholungen, die Belastung der Einheit aus der Herzfrequenz.
  Herzfrequenz kann RPE auf Übungsebene nicht ersetzen — Strava liefert
  zu Krafteinheiten keine einzelnen Übungen, und der Puls spiegelt beim
  Krafttraining vor allem die Pausenlängen.
- Mehrbenutzerbetrieb, Vereins- oder Freundesfunktionen.
- Eigene Trainingsplan-Erstellung in der App — der Plan entsteht außerhalb.
- Ein Build-Schritt oder ein Framework, solange es ohne geht.
