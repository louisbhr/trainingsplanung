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
- **Übungen anpassen** — pro Trainingstag Übungen entfernen, zurückholen
  oder eigene mit Name und Sollvorgabe hinzufügen. Eigene Übungen nutzen
  denselben Schlüssel wie Plan-Übungen und tauchen im Verlauf auf.
- **Läufe automatisch zuordnen** — exakter Treffer am Plantag; sonst ein
  Lauf von einem Tag davor bis drei Tage danach, ausgewiesen als
  „nachgeholt". Kein Lauf wird doppelt vergeben. Manuell korrigierbar
  („Anderen Lauf", „Passt nicht", „Zuordnung aufheben").
- **Offline-tauglich** — Firestore mit persistentem Cache; Eingaben im
  Funkloch werden später synchronisiert.
- **Dark Mode**, Zum-Home-Bildschirm-Manifest, fixierte Tableiste.

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
| `config/strava` | Strava-Tokens |

### Fremdsysteme

- **Firebase** `trainingsplanung-2c6c0` — anonyme Anmeldung aktiv, Regeln
  aus `firestore.rules` veröffentlicht.
- **Cloudflare Worker** `trainingsplanung-auth` — hält
  `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ALLOWED_ORIGINS`. Nötig,
  weil Strava den Token-Austausch nicht per CORS aus dem Browser erlaubt.
- **GitHub Pages** von `main`, Ordner `/`.

### Qualitätssicherung

`npm test` — 81 Prüfungen der Plandaten, 29 der Lauf-Zuordnung (beide
ohne Browser), 101 Browser-Checks in Chromium gegen gestubbtes
Firebase/Strava. Abgedeckt unter anderem: Zeitzonen um Mitternacht,
Speichern und Wiederherstellen, verschobene Läufe, Übungen anpassen,
Fehlerzustände, klebende Tableiste, kein horizontales Scrollen.

## 4. Bekannte Grenzen

- **Wochen 9–31** haben noch keine Tagesdetails.
- **Anonyme Anmeldung** — die Regeln erlauben jedem angemeldeten Nutzer
  Zugriff, und jeder Seitenbesucher meldet sich anonym an. Für ein
  privates Tool vertretbar, aber kein echter Schutz.
- **Kein Service Worker** — ohne Netz startet die App nicht, nur bereits
  geladene Daten und Eingaben überleben.
- **Browser-Cache** — nach einem Deploy braucht es mitunter einen harten
  Reload, weil GitHub Pages CSS und JS für zehn Minuten cacht.
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
| 3 | **Versionsstempel an CSS und JS**, damit ein Deploy das Nachladen erzwingt. Bei ES-Modulen sorgfältig, sonst mischt sich Alt und Neu. | S |

### Danach

| # | Vorhaben | Aufwand |
| --- | --- | --- |
| 4 | **Dauerhafte Planänderungen** — Übungstausch nicht nur für einen Tag, sondern für alle künftigen Einheiten übernehmen. | M |
| 5 | **RPE erfassen** — Anstrengungsgrad je Übung. Der Plan steuert die Progression darüber („+2.5 kg falls RPE ≤7"), erfasst wird er bisher nicht. Wäre auch die beste Eingangsgröße für die Trainer-Auswertung. | S |
| 6 | **Soll/Ist im Wochenumfang** — geplante gegen gelaufene Kilometer je Woche, als Balken im Verlauf. | S |
| 7 | **Pace über die Zeit** — echtes Zeitachsen-Diagramm statt Balken, getrennt nach Easy/Long/Tempo, um die Entwicklung Richtung 4:16 zu sehen. | M |
| 8 | **Service Worker** — App startet auch ohne Netz. | M |
| 9 | **Echtes Login** statt anonymer Anmeldung, Firestore-Regeln an die eigene UID binden. | M |
| 10 | **Wettkampf-Countdown** und Formkurve auf dem Heute-Tab. | S |
| 11 | **Export** der Trainingsdaten als CSV oder JSON. | S |
| 12 | **Verletzungs-/Belastungsnotiz** je Tag — freies Feld, das auch in die Trainer-Auswertung einfließt. | S |

### Bewusst nicht geplant

- Mehrbenutzerbetrieb, Vereins- oder Freundesfunktionen.
- Eigene Trainingsplan-Erstellung in der App — der Plan entsteht außerhalb.
- Ein Build-Schritt oder ein Framework, solange es ohne geht.
