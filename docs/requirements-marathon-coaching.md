# Requirements: Marathon-Coaching (Schritt 2 — Mehrziel, Blöcke, Plan-Erzeugung durch Claude)

**Status: ENTWURF — Discovery läuft noch.** Offene Fragen am Ende. Nicht
zur Planung freigegeben. Enthält mehrere Approval-Gates (Abschnitt
„Approval-Gates“), die vor dem Code einzeln von Louis bestätigt werden.

Stand: 27.09.2026 · Grundlage: Discovery-Runden 1 bis 3 (Antworten 1a, 2c,
3a, 5a, 6a; 4a ersetzt durch „Plan in drei Stufen in die Datenbank“; Runde 3: Passkey, Übergangsblock automatisch, kein freies
Kraft-Loggen, live bis Ende Februar 2027, Garmin gehört dazu) ·
**Zieltermin: live bis Ende Februar 2027**, danach Puffer zum Ausprobieren
vor dem HM · baut auf `docs/requirements-dashboard-v2.md` (Schritt 1)
auf, insbesondere auf dessen Weichen F0a.

---

## Änderung gegenüber REQUIREMENTS.md (ausdrücklich)

REQUIREMENTS.md, Abschnitt 5, „Bewusst nicht geplant“ schließt aus:

> Eigene Trainingsplan-Erstellung in der App — der Plan entsteht außerhalb.

**Dieser Ausschluss wird mit Schritt 2 aufgehoben.** Neu gilt: Louis legt
Ziele in der App an; Claude erzeugt daraus über den Worker ein Grobgerüst
und blockweise Tagesdetails; Louis prüft und aktiviert. Alle Pläne,
auch der HM-Plan 2027, liegen dann versioniert in Firestore (Stufe 3,
siehe M5).

Weitere Folgen für REQUIREMENTS.md, die beim Abschluss von Schritt 2
nachgezogen werden:
- Punkt 5 #7 **„Echtes Login“** wird schon vorher in **Schritt 1b**
  umgesetzt (`docs/requirements-login.md`) und ist Voraussetzung für
  Schritt 2.
- „Mehrbenutzerbetrieb“ bleibt ausgeschlossen. Die App bleibt ein Tool für
  genau einen Nutzer.
- „Ein Build-Schritt oder ein Framework“ bleibt ausgeschlossen.
- Der Tracker heißt nicht mehr nur „Halbmarathon-Tracker“ (Umbenennung ist
  kosmetisch, keine Anforderung).

## Feature Vision

Die App begleitet Louis durchgehend auf dem Weg zum Marathon 2028: ein
Projekt mit Meilensteinen (HM April 2027, Marathon ca. April 2028), dessen
Trainingsblöcke Claude aus Louis' echten Daten plant und an jedem
Blockende neu kalibriert — mit Louis als letzter Instanz vor jeder
Aktivierung.

## User Stories / Use Cases

- Louis will in der Plan-Karte ein neues Ziel anlegen (Datum, Distanz,
  Zielzeit) und bekommt ein Grobgerüst bis zum Renntag, ohne eine
  Claude-Code-Session zu brauchen.
- Louis will den Plan vor dem Aktivieren sehen und ihn 2–3-mal per kurzer
  Anweisung nachschärfen („Long Run sonntags“, „nur 1× Kraft im Taper“).
- Louis will nach dem HM nahtlos weiter gecoacht werden: Die App schlägt
  den Übergangsblock von sich aus als Entwurf vor, statt „kein Plan aktiv“
  zu zeigen.
- Louis will nur nach Plan trainieren — auch im Übergang gibt es geplante
  Kraft- und Laufeinheiten, kein freies Loggen.
- Louis will seine Erholungsdaten von der Garmin-Uhr (HRV, Ruhepuls,
  Schlaf) im Dashboard sehen und in Coach und Re-Kalibrierung einfließen
  lassen.
- Louis will am Ende jedes Blocks einen Vorschlag für den nächsten Block
  auf Basis seiner echten Läufe und Kraftwerte — und jederzeit „Jetzt neu
  kalibrieren“ drücken können.
- Louis will, dass niemand außer ihm Pläne erzeugen oder seine Daten lesen
  kann, weil jetzt teurere Modelle und Freitext im Spiel sind.

## Functional Requirements

### M1. Projekt, Meilensteine, Blöcke (Antwort 1a)

- **Projekt** `marathon-2028`: Hauptziel (Marathon, Datum, Zielzeit) und
  geordnete **Meilensteine** (Rennen): HM 2027 → Marathon 2028. Weitere
  Meilensteine (z. B. ein 10-km-Test im Herbst 2027) sind möglich.
- **Blöcke** = Pläne im Format aus Schritt 1 (F0/F0a), lückenlos
  hintereinander: HM-Block (`hm-2027`, seit Schritt 1b in Firestore) →
  Übergangsblock → Marathon-Block, alle in Firestore. Jeder Block zeigt
  auf seinen Meilenstein bzw. hat als Übergang keinen eigenen.
- `activePlanFor(iso, plans)` aus Schritt 1 findet den Block des Tages
  aus der Liste aller Firestore-Pläne.
- Dashboard-Kopfzeile zeigt Block + nächsten Meilenstein; der Coach kennt
  Hauptziel und nächsten Meilenstein.

### M2. Ziel anlegen in der App

- Ort: **Plan-Karte im Plan-Tab**, Aktion „Neues Ziel“.
- Eingaben: Renndatum, Distanz (Auswahl: 5 km, 10 km, Halbmarathon,
  Marathon), Zielzeit (h:mm:ss). Nichts weiter.
- Ein bestehendes Ziel (auch das HM-Datum) kann hier später bearbeitet
  werden; das deckt „Renndatum am Handy ändern“ ab (in Schritt 1 bewusst
  nur in der Plandatei). Eine Datumsänderung erzeugt eine neue Version des
  Plans; wirkt sie auf die Wochenstruktur (z. B. Taper verschiebt sich),
  schlägt die App eine Neu-Kalibrierung vor (M6).
- Anlegen startet die Erzeugung des Grobgerüsts (M3).

### M3. Plan-Erzeugung hybrid (Antwort 2c)

- **Grobgerüst sofort:** Phasen, alle Wochen bis zum Renntag mit
  `weekType`, `deload`, `focus`, `plannedKm`, Anzahl Lauf- und
  Krafteinheiten. Keine Tagesdetails. (≙ Platzhalterwoche aus F0a.)
- **Tagesdetails blockweise:** für die nächsten 4–8 Wochen, konkrete
  Einheiten (Läufe mit `km`, Pace, `hfMax`, Typ; Kraft mit Übungen,
  Sätzen, Wdh, Hinweisen) auf Basis echter Daten.
- **Eingabe an Claude (vom Client aggregiert, kein Rohdaten-Dump):**
  Ziel, Grobgerüst, Wochen-km Soll/Ist der letzten 8 Wochen, Easy-HF-
  Disziplin, aerobe-Effizienz-Trend, Belastungsverhältnis, Kraft-Progression
  je Übung (aus `metrics.js`), Adhärenz, Übungskatalog, aktuelle Zonen.
- **Ausgabe:** strukturiertes JSON im Plan-Format; Worker **und** Client
  validieren gegen das Schema (Typen, Datumsbereich, Wochen lückenlos,
  plausible km-Grenzen). Ungültig → einmal automatisch neu anfordern,
  dann Fehlermeldung, kein halber Plan.
- **Worker-Endpunkte (neu):** `POST /plan/skeleton`, `POST /plan/block`
  (Namen in der Planung festlegen). Eigene Schemas, eigene Prompts; kein
  Prompt vom Client.
- **Modell:** ein stärkeres Modell als der Haiku-Coach. **Modellname,
  API-Version und Preise gegen die aktuelle Doku prüfen — nicht raten.**
  Kosten pro Erzeugung werden in der Planung auf Basis der geprüften
  Preise und gemessener Token-Mengen beziffert und Louis vorgelegt.

### M4. Vorschau, Nachschärfen, Aktivieren (Antwort 3a)

- Neuer Plan/Block entsteht mit Status `draft` und wird als Vorschau
  gezeigt (Wochenübersicht, Tagesdetails aufklappbar, beim Neu-Kalibrieren
  Unterschied zum bisherigen Stand hervorgehoben).
- **Nachschärfen:** bis zu 3 Freitext-Anweisungen pro Entwurf, je max.
  ca. 300 Zeichen (Wert in der Planung festlegen). Freitext geht nur an
  `/plan/*`, nie an `/coach`.
- Knopf **„Aktivieren“** setzt `active`; der vorige Stand wird
  `superseded`, nicht gelöscht. Verwerfen ist jederzeit möglich.
- Kein Plan wird ohne Louis' Klick aktiv.

### M5. Speicherort und Versionshistorie (Stufe 3 von 3 — ersetzt Antwort 4a)

**Entscheidung Louis (27.09.2026), ersetzt 4a („HM-Plan bleibt im
Code“):** Der Plan kommt in drei Stufen in die Datenbank.
- Stufe 1 (Schritt 1): Plandaten getrennt in `plans/hm-2027.json`.
- Stufe 2 (Schritt 1b): einmalige Übertragung nach Firestore
  (`plans/hm-2027`), die Datei bleibt Notfall-Kopie.
- **Stufe 3 (hier):** Neue Pläne entstehen **direkt in Firestore**, im
  selben Format, mit Versionshistorie. **Der HM-Plan ist dann ebenfalls
  dort versioniert** und wird wie jeder andere Block behandelt.

Anforderungen:
- Struktur z. B. `plans/{planId}` (Metadaten, Zeiger auf aktive Version) +
  `plans/{planId}/versions/{n}` (vollständiger Plan, Status,
  Erzeugungsanlass, Freitext-Anweisungen). Genaue Struktur =
  Approval-Gate. Schritt 1b legt diese Grundstruktur bereits an
  (`docs/requirements-login.md`, L6); die dort importierten Stände sind
  die ersten Versionen von `hm-2027` (Anlass „Import aus Datei“). Schritt 2
  ergänzt nur Felder, keine Umstellung.
- Die Datei `plans/hm-2027.json` bleibt Notfall-Kopie des HM-Plans;
  erzeugte Pläne haben keine Datei-Kopie (optional: Export, Backlog).
- Projekt/Meilensteine in Firestore, z. B. `projects/{projectId}`.
- Louis akzeptiert, dass Planänderungen nicht in Git nachvollziehbar sind;
  die Versionshistorie ersetzt das.
- Offline: aktive Pläne liegen im Firestore-Offline-Cache; ein Plan, der
  noch nie geladen wurde, ist offline nicht verfügbar.

### M6. Re-Kalibrierung (Antwort 5a)

- **Am Blockende** (letzte Woche mit Tagesdetails) bietet die App an:
  „Nächste Wochen planen“ → `/plan/block` → Vorschau → Aktivieren.
- **Übergangsblock nach dem HM (Runde 3):** Die App schlägt ihn
  **automatisch als Entwurf** vor, ohne dass Louis ihn anstoßen muss
  (Vorschlagszeitpunkt: in der Taper-Phase, spätestens 7 Tage vor dem
  Renntag — genauer Zeitpunkt ist Planungsentscheidung). **Claude legt die
  Länge der Erholung und der Pause selbst fest** und begründet sie in der
  Vorschau. Aktiv wird er wie jeder Block erst per „Aktivieren“. Nicht
  aktiviert → am Tag nach dem Rennen zeigt das Dashboard den Entwurf zur
  Prüfung statt „Plan beendet“.
- **„Jetzt neu kalibrieren“** jederzeit: ersetzt die verbleibenden Wochen
  des aktuellen Detailblocks ab der nächsten Woche (laufende Woche bleibt
  unangetastet), gleicher Ablauf mit Vorschau.
- Die **Wochenbilanz** (Schritt 1) empfiehlt nur („Kalibrierung
  empfohlen“), ändert nie selbst einen Plan.
- HM-Wochen 9–31 (ab 26.10.2026) werden **mit Claude Code in
  `plans/hm-2027.json`** geschrieben, nicht über diesen Mechanismus (der
  ist dann noch nicht live). Ab Schritt 2 gilt Neu-Kalibrieren auch für
  den HM-Block, praktisch also nur noch für den Taper.

### M7. Kraft (Antwort 6a)

- Kraft wie heute: 2× Ganzkörper pro Woche, periodisiert (z. B. 1×
  Erhalt in spezifischer Phase/Taper), Übungen **bevorzugt aus dem
  bestehenden Katalog** (Plan-Übungen + eigene), damit der Verlauf über
  Jahre durchgängig bleibt. Neue Übungen nur mit Begründung im Hinweis.
- Progressionslogik (`progression.js`) und Kraft-Ampel bleiben unverändert
  und gelten für erzeugte Pläne genauso.
- **Kein freies Kraft-Loggen** (Runde 3, ersetzt „freies Loggen: ja“ aus
  Antwort 6a). Louis trainiert nur nach Plan. Konsequenz: **Jeder Block,
  auch der Übergangsblock, muss geplante Krafteinheiten enthalten**
  (Erholungswochen ggf. mit reduziertem Umfang, aber nicht ohne Kraft,
  außer Claude begründet eine kurze Pause direkt nach dem Rennen). Die
  Plan-Validierung prüft das. Die bestehende Tages-Anpassung („Anpassen“,
  eigene Übung an einem Plan-Krafttag) bleibt unverändert.

### M8. Durchgehendes Coaching

- Coach (täglich + Wochenbilanz) läuft in jedem Block, auch im Übergang.
- Coach-Schemas bekommen `project`/`nextMilestone`; Erweiterung der zwei
  Schemas aus Schritt 1 (versioniert, kein drittes Freitext-Schema).

### M9. Sicherheit (entschieden: Login ist nötig)

- **Voraussetzung: Schritt 1b** (`docs/requirements-login.md`). Echtes
  Login, Firestore-Regeln an Louis' UID und die Prüfung des
  Firebase-ID-Tokens im Worker sind dort geregelt und vor Schritt 2 live.
  Louis hat am 27.09.2026 bestätigt, dass ein Login nötig ist.
- Schritt 2 übernimmt den Mechanismus aus 1b unverändert: **alle neuen
  Worker-Endpunkte** (`/plan/*`, Wellness-Abruf) verlangen ein gültiges
  ID-Token von Louis' UID; neue Firestore-Sammlungen fallen unter die
  bestehende UID-Regel.
- **Zusätzlich in Schritt 2:** Limits im Worker — max. Erzeugungen pro Tag
  für `/plan/*` (Wert in der Planung), max. 3 Nachschärfungen pro Entwurf,
  Längenlimit Freitext. Monatliches Ausgabenlimit in der Claude Console
  bleibt die harte Grenze.

### M10. Garmin-Erholungsdaten über Intervals.icu (Runde 3: gehört zu Schritt 2)

- **Voraussetzung (Louis, vor der Planung):** Konto auf intervals.icu
  anlegen, Garmin Connect verbinden, Scopes „Wellness“ und „Sleep“
  aktivieren und prüfen, **welche Werte bei seiner Uhr tatsächlich
  ankommen** (HRV, Ruhepuls, Schlaf, ggf. Body Battery/Readiness). Der
  Umfang von M10 richtet sich nach diesem Ergebnis.
- Abruf über den bestehenden Cloudflare Worker (Intervals.icu-API mit
  persönlichem API-Key als **Worker-Secret**); der Browser sieht den Key
  nie. Endpunkt nur mit gültigem ID-Token (Mechanismus aus Schritt 1b).
- Speicherung als **Wellness-Tage** in Firestore (z. B.
  `wellness/{datum}` mit den tatsächlich verfügbaren Werten), einmal pro
  Sitzung nachgeladen, offline aus dem Cache.
- Nutzung: Dashboard-Karte oder -Ampel „Erholung“ (Trend von HRV/Ruhepuls
  gegen den eigenen 4-Wochen-Schnitt; Darstellung per Mockup), Eingabe für
  Coach, Wochenbilanz und Re-Kalibrierung. Auch hier: Warnsignal, keine
  Diagnose.
- Inoffizielle Garmin-Login-Bibliotheken bleiben ausgeschlossen (siehe
  `backlog.md`).
- Fehlen Werte (Uhr lückenhaft, Sync verzögert), bleibt die Karte grau;
  nichts anderes darf davon abhängen.

## Approval-Gates (einzeln von Louis zu bestätigen, vor dem Code)

| Gate | Was genau |
| --- | --- |
| **Firestore-Schema** | Erweiterung von `plans/{planId}` + `versions/` (Grundstruktur existiert seit 1b) um Status, Erzeugungsanlass, Freitext-Anweisungen; neue Sammlungen `projects/`, `wellness/`; Datenmodell der Wellness-Tage |
| **Neue Worker-Endpunkte** | `/plan/skeleton`, `/plan/block`, Wellness-Abruf (Request/Response-Schemas, Fehlerfälle, Limits); Erweiterung der `/coach`-Schemas |
| **Neues Secret** | Intervals.icu-API-Key als Worker-Secret |
| **Security** | Limits und Freitext-Behandlung für `/plan/*`; neue Endpunkte an die ID-Token-Prüfung aus Schritt 1b anschließen (Login selbst: Schritt 1b, `docs/requirements-login.md`) |
| **Modellwahl und Kosten** | Modell für Plan-Erzeugung, `max_tokens`, geschätzte Kosten pro Grobgerüst/Block/Nachschärfung — **Modell und Preise gegen aktuelle Doku prüfen** |
| **Abhängigkeiten** | nur falls Plan-Validierung oder Wellness-Abruf eine Bibliothek bräuchten (Ziel: keine) |
| **REQUIREMENTS.md** | Aufhebung des Ausschlusses „Plan entsteht außerhalb“ |

## Design & UX Requirements

- Wie bei Schritt 1: **Mockup-HTML vor der Freigabe** (Ziel anlegen in der
  Plan-Karte, Vorschau mit Nachschärfen/Aktivieren, Blockende-Hinweis,
  automatischer Übergangsblock-Vorschlag, Erholungs-Karte).
- Stil wie `mockup-v3.html` / Mockup Schritt 1; Handy zuerst,
  fluid-responsive, Eingabefelder ≥ 16 px.
- Erzeugung dauert spürbar: Fortschrittszustand, abbrechbar, App bleibt
  bedienbar; nie ein halb geschriebener Plan.

## Technical Preferences

- Weiterhin Vanilla JS ohne Build-Step, GitHub Pages, Firestore, ein
  Cloudflare Worker.
- Plan-Validierung als eigenes, ohne Browser testbares Modul (gleiches
  Schema für Worker und Client, soweit ohne Build teilbar).
- Keine Secrets im Repo.

## Suggested Additions / Backlog

- Garmin/Intervals.icu ist aus dem Backlog in Schritt 2 übernommen (M10);
  der Eintrag in `backlog.md` sollte als „übernommen“ markiert werden.
- Zielzeit-Prognose, Tagesnotiz, Export, robustere aerobe Effizienz —
  weiter Backlog aus Schritt 1; die Tagesnotiz wird für die
  Re-Kalibrierung besonders nützlich.

## Success Metrics

- Louis legt in der App ein Ziel an und hat innerhalb einer Sitzung ein
  aktivierbares Grobgerüst.
- Ein Detailblock lässt sich erzeugen, 1–3× nachschärfen, aktivieren; der
  vorige Stand bleibt als Version abrufbar.
- Vor dem HM-Renntag liegt automatisch ein Übergangsblock-Entwurf vor, mit
  geplanten Krafteinheiten und von Claude begründeter Erholungsdauer;
  nach Aktivierung laufen Coach und Ampeln nahtlos weiter.
- Wellness-Werte, die bei Louis' Uhr ankommen, erscheinen im Dashboard und
  im Coach-Eingabeschema; fehlende Werte führen nur zu einer grauen Karte.
- Schritt 2 ist bis Ende Februar 2027 live.
- Ohne gültiges Login antworten auch die neuen Endpunkte (`/plan/*`,
  Wellness) mit 401 (Mechanismus aus Schritt 1b).
- Erzeugte Pläne laufen ohne Codeänderung durch Dashboard, Wochen-Tab,
  Ampeln und Coach aus Schritt 1.
- Tests für Plan-Validierung, Blockwechsel, Versionierung, Auth-Fehlerfälle.

## Open Questions / Risks

Beantwortet in Runde 3 (27.09.2026): Übergangsblock (automatischer
Entwurf, Claude bestimmt Erholung), Kraft (kein freies Loggen, Übergang
mit geplanter Kraft), Zeitplan (live bis Ende Februar 2027), Garmin
(gehört zu Schritt 2). Login: entschieden, nötig — ausgelagert in
Schritt 1b.

Noch offen:

1. **Welche Garmin-Werte kommen an?** Hängt an Louis' Vorarbeit
   (Intervals.icu-Konto, Scopes, Prüfung). Bestimmt den Umfang von M10 und
   ob „Erholung“ eine Ampel, eine Karte oder nur Coach-Eingabe wird.

Risiken:
- **Umfang vs. Termin:** Schritt 2 ist insgesamt groß (Plan-Erzeugung,
  Versionierung, Wellness). Für „live bis Ende Februar 2027“ sollte die
  Planung in Etappen schneiden (z. B. Plan-Format in Firestore →
  Erzeugung/Vorschau → Übergangsblock-Automatik → Wellness) und früh
  sagen, was wackelt.
- **Abhängigkeit von Schritt 1b:** Ohne live geschaltetes Login startet
  Schritt 2 nicht.
- **Übergangsblock hängt am Renndatum:** Der automatische Vorschlag
  braucht das bestätigte HM-Datum (`raceDateConfirmed`).
- **Qualität erzeugter Pläne:** Ein LLM kann plausible, aber unsinnige
  Pläne liefern (Umfangssprünge, Deload vergessen). Gegenmittel:
  Schema- und Plausibilitätsprüfung (max. Wochen-km-Anstieg, Deload-Rhythmus),
  Vorschau mit Louis als letzter Instanz.
- **Kosten** sind erst nach Modellprüfung bezifferbar; das Ausgabenlimit
  begrenzt das Risiko.
- **Überschneidende Blöcke** in Firestore müssen ausgeschlossen werden
  (Validierung beim Aktivieren).
- **Notfall-Kopie veraltet:** Nach Neu-Kalibrierungen in Firestore weicht
  `plans/hm-2027.json` vom aktiven Stand ab. Der Fallback zeigt dann einen
  älteren Plan; der Hinweis „Plan aus Notfall-Kopie“ macht das sichtbar.
- **Schritt-1-Weichen (F0a) sind Voraussetzung.** Werden sie in Schritt 1
  nicht umgesetzt, braucht Schritt 2 einen Umbau von Dashboard und
  `metrics.js`.
