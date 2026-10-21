# Tests

Die App selbst braucht keinen Build-Step — diese Tests sind nur für die
Entwicklung.

```bash
npm install            # http-server + playwright
npx playwright install chromium

npm run serve          # in einem zweiten Terminal: Server auf :8099
npm test               # 13 Läufe: Logik-/Worker-Tests ohne Browser, dann Browser-Tests
```

- `plan.test.mjs` — prüft `plans/hm-2027.json` direkt (Struktur, lückenlose
  Wochen, Wochentage der Kraft-/Lauftage, Platzhalterwochen, `validatePlan`
  inkl. Negativ-Fixturen) sowie die reine Logik aus `plan.js`:
  `weekNumberFor`/`weekDates` (inkl. beider Zeitumstellungen im Plan),
  `planDayState`/`activePlanFor` an den Grenzen, `formatGoal`, `phaseRange`.
- `plan-golden.test.mjs` — Sicherheitsnetz für den M1-Umbau (A2): vergleicht
  für jeden Tag vom 24.08. bis 25.10.2026 (Wochen 1–8) die neue Logik
  (`sessionOn`/`plans/hm-2027.json`) mit der eingefrorenen alten Logik
  (`fixtures/plan-legacy.mjs`, unverändert seit vor dem Umzug) — Kraft/Lauf-
  Details, Notizen und `slug()` müssen übereinstimmen. Bleibt bis zum Ende
  von M2 liegen.
- `stubs.test.mjs` — Stub-Wächter (A9): vergleicht, welche Namen die
  Browser-Module tatsächlich aus `config.js`/`firebase-init.js` importieren,
  gegen die Stub-Literale in `app.test.mjs` — macht einen vergessenen
  Stub-Nachzug laut, bevor die (langsameren) Browser-Tests mittendrin
  abbrechen.
- `runmatch.test.mjs` — prüft die Zuordnung von Strava-Läufen zu
  Plan-Lauftagen ohne Browser: exakte Treffer, nachgeholte Läufe,
  manuelle Zuordnung, und dass kein Lauf doppelt vergeben wird.
- `progression.test.mjs` — prüft den Gewichtsvorschlag aus den
  Wiederholungen der Vorwoche: Spanne ausgeschöpft, unter dem Soll,
  Körpergewichts- und Zeitübungen, Deload.
- `version.test.mjs` — prüft, dass der Versionsstempel in `index.html`
  und in allen Modul-Importen gesetzt und überall derselbe ist. Fängt
  den Fall ab, dass ein neues Modul angelegt, aber im Stempel-Skript
  vergessen wurde.
- `access.test.mjs` — Zugangslogik ohne Browser: Sitzungszustand gegen die
  erlaubte UID, deutsche Anmeldefehler, Timeout-Helfer und der Worker-Aufruf
  mit Token (Retry nur bei 401 mit `error: "unauthorized"`).
- `config-consistency.test.mjs` — UID in `config.js`, `firestore.rules` und
  `wrangler.toml` gleich und kein Platzhalter; Projekt-ID in Worker und
  Client gleich.
- `worker.test.mjs` — `/coach`, `/exchange`, `/refresh` und die Token-
  Prüfung: Testschlüssel und Token werden im Test selbst erzeugt, Googles
  Schlüssel-Endpunkt ist gemockt (401-Matrix, 503, Cache, Rotation,
  stale-if-error, fehlende Konfiguration; die Token-Pflicht ist immer an).
- `export.test.mjs` — reiner Teil des Exports (`export.js`) ohne Browser:
  Feldauswahl, Datenschutz (keine Zugangs- und Standortdaten), Dateiname und
  lokale Zeit. Teilausfälle mit Warnung prüft `app.test.mjs`.
- `metrics.test.mjs`, `coach.test.mjs` — Ampeln und Kennzahlen; Coach-
  Eingabe, Hash, Cache-Entscheidung, Tageslimit (Anmeldefehler des Workers
  verbrauchen es nicht) und Fallback-Texte.
- `app.test.mjs` — startet Chromium gegen `http://127.0.0.1:8099`.
  Firebase wird durch einen localStorage-Stub ersetzt, die Strava-API
  durch feste Beispieldaten — es werden also keine echten Konten
  benötigt. Geprüft werden u. a.: Tagesansicht, Strava-Matching,
  Wochennavigation, Speichern und Wiederherstellen der Sätze,
  Verlaufs-Diagramme, Zeitzonenverhalten um Mitternacht, dass nichts
  horizontal aus dem Bild läuft, sowie das Plan-Laden (A1): JSON 404 mit
  und ohne gültige Kopie, eine ungültige oder fremd-versionierte Kopie,
  dass die Kopie beim normalen Laden wirklich geschrieben wird, und die
  Zustände außerhalb der Planwochen (vor Planstart, Rennlücke, nach dem
  Rennen).

Mit `SHOTS=./shots npm run test:app` werden zusätzlich Screenshots
abgelegt.

**Port 8099:** `app.test.mjs` verbindet fest mit `127.0.0.1:8099`. Vorher
`lsof -ti :8099` prüfen; ein Server aus einem anderen Worktree würde fremden
Code testen. Der Server muss aus dem Verzeichnis laufen, das getestet wird.

## Abdeckungs-Ledger (Stride, Auflage C8)

Das Ledger führt **Prüfabsichten**, die Zahl der Checks ist nur ein zweites Signal. `app.test.mjs`
druckt am Ende „Checks je Szenario“ (`scenario("…")` steht in der ersten Zeile jedes Blocks). Regel:
kein Szenario verschwindet, keine Absicht fällt weg. Aufgefüllt wird nicht, um eine Zahl zu halten.

Baseline: der Plan nennt 336 Checks; gemessen am Merge-Base `a6e6c4b` waren es **390** (Login und
Export kamen auf main nach dem Planstand dazu). Nach E1/E2 399, nach E3 441, nach dem Kopf-Umbau (Seitenkopf scrollt mit, +6 in Szenario 12) 447, nach E4 (Woche) 491, nach E5a (Kraft-Tag B „Fokus“) **614**.

| Szenario | Prüfabsichten | a6e6c4b | E2 | E3 | Etappe |
| --- | --- | --- | --- | --- | --- |
| 1 | Kopf (Woche, Typ, Phase, Countdown 237 Tage, Planbalken); Lauf-Karte sofort bedienbar; Banner „nicht verbunden“ statt Dauer-Laden, Lauf-Karte ohne Ist-Block; Coach-Karte und vier Status-Zeilen sofort; Im Detail weg; kein `style=`; kein H-Scroll; keine Konsolenfehler; Wochen-Tab zeigt „Mit Strava verbinden“ | 12 | 12 | 16 | E3 |
| 2 | Längster Lauf des Tages (8,0 km); „im Plan“; Banner-Slot leer bei Verbindung; keine doppelten Einheiten; Pace, Ø HF, Dauer (zogen vom Heute-Kachelblock in den Lauf-Tag um, Karte zeigt nur km, Urteil, Name) | 6 | 6 | 9 | E3 |
| 2b | Krafttag-Karte mit Titel und Anzahl; „Training starten“; Vorschau 3 Zeilen + „+ 5 weitere“; Zeilen nicht antippbar; Einstieg öffnet Kraft-Tag; Zurück „Heute“; Fortschritt nach Speichern „1 von 8“ (Rest des Blocks: Kraft-Tag, E5) | 9 | 9 | 10 | E3 (bis Kraft-Tag) |
| 2c | Ampel Wochensoll/Detail, Belastung, Kraft rot + Detail, Easy; Info-Sheet über Tab-Leiste, Titel, Grenzwerte (42 Tage, 2 oder mehr), Fokus auf Titel, Escape + Fokus zurück; neu: Dialog-Rolle, Blockreihenfolge, Backdrop schließt | 22 | 22 | 20 | E3 |
| 2c-2 | Timer-Race: Schließen und sofort neu öffnen bleibt offen, Escape wirkt, hidden folgt; neu: Fokus zum letzten Auslöser. A→B / B→A mit zweitem Sheet folgt in E6 | 5 | 5 | 6 | E3 |
| 2c-4 | Tab-Leiste folgt dem Tab (Start, Woche, Tag aus Woche, Tag aus Heute, Zurück) | 6 | 6 | 6 | E3 |
| 2d | Coach: KI-Text als Text, kein XSS (Tag und Bilanz), ein daily/weekly-Request, gleicher Hash kein zweiter; neu: Montag offen ohne Auslöser | 9 | 9 | 10 | E3 |
| 2d-2 | Bilanz Di–So eingeklappt, Kurzform W1, per Tap auf, kein H-Scroll; neu: aria-expanded, Fokus | 5 | 5 | 6 | E3 |
| 2e, 2f | Coach-Fallback bei abgeschaltetem Worker; kein API-Aufruf bei unlesbarem Dokument, keine Fehlerkarte | 1, 3 | 1, 3 | 1, 3 | E3 |
| 20 | Rennlücke: kein „Woche 35“, neutrale Karte; neu: Kopf ohne Chip/Balken, „Diese Woche“ leer | 3 | 3 | 5 | E3 |
| 20b | Renntag in Woche 35, „Rennen heute“ | 3 | 3 | 3 | E3 |
| 21 | Nach Rennen: Kein Plan, kein Coach-Aufruf, Renndatum, neutrale Karte, fester Coach-Text; neu: Slot leer, Status mit Grund, „Zum Plan“ (go-tab) | 6 | 6 | 8 | E3 |
| 22 | Vor Planstart: Kein Plan, Woche 1 im Wochen- und Plan-Tab, 0 % | 4 | 4 | 4 | E3 |
| 25 | Plan-Hinweis und Strava-Redirect beide sichtbar (Toast, unverändert) | 2 | 2 | 2 | E3 |
| 28 | Strava-Fehler: Wochensoll nicht rot, nennt Quelle, Easy/Belastung grau, keine Wochenbilanz; neu: Fehlerbanner mit „Neu laden“ | 5 | 5 | 6 | E3 |
| 29 | Firestore-Ausfall: Kraft grau + Text, Easy rechnet, Coach ohne Dauer-Skelett, Adhärenz-Kachel „nicht geladen“ wird durch Fehlerbanner „Daten nicht geladen“ ersetzt | 7 | 7 | 7 | E3 |
| 35a–35g (neu) | Ruhetag mit/ohne „Morgen“; Long Run; „zu kurz“ 89 % / „im Plan“ 90 %; nachgeholt; Platzhalterwoche (mit/ohne Datum, Plan aus REAL_PLAN_JSON abgeleitet); Diese Woche (7 Tage, Zustände, Volumen, Tipp öffnet Woche); Escaping Laufname | – | – | 28 | E3 |
| 12 | Tab-Leiste klebt, Detailseiten ohne Leiste (E1 +9: Glas, Kapsel, Marke); neu +6: Seitenkopf scrollt auf Heute, Woche und Kraft-Tag mit weg, `#header` leer, nach Tabwechseln/Nachladern genau ein Seitenkopf, `#main` nur über `renderMain()` beschrieben (statische Sperre); Sicherheitsabstand oben jetzt am Seitenkopf, seitlich an #main gemessen | 4 | 13 | 13 → 19 | E1 (+Kopf) |
| alle mit Kopf-Selektoren | `#header …` heißt jetzt `#main > header.sd-pagehead …` (Kopf steht im #main); Anzahl unverändert. 30a: „Karte zentriert“ misst ab Unterkante des Seitenkopfs | – | – | – | – |
| 2c-3 | Woche, heutiger Krafttag mit Teilfortschritt: **eine** kombinierte Pille „Heute · 2/8“, Heute-Tönung, Details zeigen geloggte Werte je Übung und „–“ für offene (jetzt auf `.sd-day`, `.sd-pill`, `is-today`) | 5 | 5 | 5 | E4 (5 → 5, Pillen-Zahl jetzt mitgeprüft) |
| 3 | Woche: 7 Tage, aktuelle Woche, Heute-Zeile, Blättern vor/zurück, Grenze Woche 1, „Zu heute“ (nur außerhalb der aktuellen Woche), Titel mit Distanz, Ist statt Ziel, Aufklappen, `aria-expanded`, Ruhetage nicht antippbar, Tag öffnen → Krafttag, Zurück. **Neu:** Fokus bleibt nach dem Blättern auf dem Pfeil, Weiter bei Woche 1 aktiv, genau eine Zeile offen (zweite öffnet, erste schließt), `aria-expanded`/`hidden` im Gleichlauf, Rücksprung heißt „‹ Woche“, zuletzt offene Zeile nach dem Rücksprung wieder offen, Wochenwechsel schließt alle, kein `style=` | 23 | 23 | 23 → 31 | E4 |
| 3b (neu) | Status-Pillen auf einem Entlastungswochen-Fixture: „HF zu hoch“ (Rangfolge: zweiter Grund „kürzer als geplant“ nur in den Details, nie zweite Pille), „zu kurz“ bei 89 %, „verpasst“, „2/8“ vergangen, „nachgeholt“, „Heute“; Deload-Suffix nur an Kraftzeilen; Ruhetag ohne Knopf/`data-action`/`aria-expanded`, Tippen öffnet nichts; „Sonntag, heute“ für Screenreader; Summen als `<progress>` (Punkt im Attribut, Komma im Text), Kraft 0 / 2; kein `style=`, kein H-Scroll, keine Konsolenfehler | – | – | – → 18 | E4 |
| 3c (neu) | „Tagesdetails folgen“ auf planunabhängigem Fixture (abgeleitet aus `REAL_PLAN_JSON`, Auflage C8): mit künftigem Datum, **Re-Kalibrierung 28.10. (aus 2c umgezogen; nächstes statt späteres Datum)**, ohne Datum, nur vergangenes Datum; keine Summen-Karte/Tagesliste, Kopf mit Pfeilen bleibt, Fokus auf dem Pfeil, „Zu heute“ erscheint, kein `style=`, kein H-Scroll | – | – | – → 16 (4 Durchläufe) | E4 |
| 11 | Verschobener Lauf: Woche-Anteil ist nur der Weg über `openDay()` (jetzt `.sd-day`, bei schon offener Zeile nicht zuklappen) | 14 | 14 | 14 → 14 | E4 |
| 24p | W9: Kalibrierungstest in der Liste und mit Haken statt „HF zu hoch“, optionale Kraft („Optional“ in der Sub-Zeile, Pille „optional“, nicht „verpasst“), Pflicht-Kraft „verpasst“, Kraft 0 / 1, Hinweise in den Details, Woche 35 (Pfeil gesperrt, Platzhalterkarte, 26. April–2. Mai), Plan-Tab. **Neu:** nach zweitem Aufklappen genau eine offene Zeile, Fokus wechselt am gesperrten Pfeil zum anderen | 22 | 22 | 22 → 24 | E4 |
| 12 (Kopf) | Der Wochenkopf hat laut Markup 10.0/10.1 keine Markenzeile: die Prüfung „Stride-Zeichen 28 px“ gilt für Heute, Verlauf, Plan; für Woche steht an derselben Stelle „Titelzeile mit zwei Rundtasten, ohne Markenzeile“ (eins zu eins). Der Scroll-Test der Woche öffnet vorher eine Zeile (die kompakte Woche passt fast auf den Bildschirm) | 19 | 19 | 19 → 19 | E4 |
| 2b (Rest) | Kraft-Tag aus Heute geöffnet: Titel der Einheit im Kopf, Zurück „Heute“, Zähler „0 von 8 erledigt“; erste Übung per V1 + „Satz fertig“ gespeichert, Zähler „1 von 8“; zurück: Heute-Fortschritt und „Weiter trainieren“ (Rest des Blocks aus E3 unverändert) | 9 | 9 | 10 → 10 | E5a (10 → 11) |
| 4 | Kraft eintragen, speichern, nach Reload noch da, jetzt Satz für Satz: drei Satzzeilen (einer aktiv), Gewicht wirkt weiter, Wdh starten neu, Einzelsätze 80/80/85 im Dokument; „leere Eingabe wird abgefangen“ wird zu „ohne fertigen Satz kein ‚Mit n Sätzen abschließen‘ und kein Speichern-Knopf“; „Einzelsätze umschalten/Werte bleiben“ (toggle-sets entfällt) wird zu „Werte nach Reload sind fertige Sätze“ | 11 | 11 | 11 → 11 | E5a (11 → 12) |
| 9 (Kraft-Teil) | Firestore verweigert: Ladefehler als dauerhafte Karte `[data-card="load-error"]` (role=alert, „Neu laden“, Originalmeldung), Eingabe bleibt möglich (8 Übungen, Satz 1 bedienbar), Meldung bleibt über die Toast-Dauer | 7 | 7 | 7 → 7 | E5a (7 → 8) |
| 10 | Anpassen in der neuen Ansicht (`toggle-edit`): Primärbutton eingefärbt/beschriftet/volle Breite statt Speichern-Knopf; Entfernen, Zurückholen, Hinzufügen (jetzt im Formular `data-form`), eigene Übung als Pille, doppelter Name mit Meldung im Formular, eigene Übung satzweise speichern, Reload, Entfernung/Werte überleben, andere Tage unberührt | 18 | 18 | 18 → 18 | E5a |
| 13 | Progression: Chip statt langem Text („Heute 85 kg“ up/down, Wdh-Übung ohne kg, ohne Vorgeschichte keiner), Startwerte (F4), „Letztes Mal“, Strava-Zeile (Dauer, HF, Relative Effort, nicht antippbar), keine RPE-Eingabe (zwei Stepper, kein Textfeld) | 12 | 12 | 12 → 12 | E5a |
| 14 | Ersetzen/Ergänzen: „+ Übung hinzufügen“ nur noch im Anpassen-Modus (Normalansicht ohne Knopf), hinten angehängt, Ersetzen übernimmt Soll, alte Übung weg, gleiche Stelle, Herkunft „Ersetzt Brustpresse“ in der Jetzt-Karte, Reload, Tausch rückgängig | 11 | 11 | 11 → 11 | E5a (11 → 12) |
| 16 | Felder >= 16 px: Kraft-Tag, **neu** direkte Eingabe (V1, 24 px), Übung hinzufügen (über Anpassen), Verlauf | 9 | 9 | 9 → 9 | E5a (9 → 10) |
| 2c-4, 3, 12, 17 | nur Selektoren (`waitKraft`, Titel „Full Body A“, 8 Reihenfolge-Zeilen, Satz-Logging über V1/`finishExercise` mit Dokument-Prüfung in 17); Anzahl unverändert | – | – | – | E5a |
| 36a (neu) | ganzer Tag Satz für Satz, je einmal von Heute und von Woche: Tab-Leiste weg, Zurück heißt Herkunft, Satz 1 fertig → Satz 2 aktiv (Fokus auf Primärbutton), nach letztem Satz gespeichert („Erledigt“, „Weiter: Deadlift“, ein Dokument), „Weiter“ führt durch alle 8 in Plan-Reihenfolge, „Training abschließen“, Karte „Alle 8 Übungen erfasst“, 8 Dokumente, Live-Region „Alle Übungen erfasst.“, Rückweg zu Heute bzw. Woche | – | – | – → 24 | E5a |
| 36b (neu) | Fokus per Liste und per Punkt: genau eine aktuelle Zeile/ein aktueller Punkt, `aria-current`/aria-label, Seite springt nicht (scrollTop gleich), Fokus bleibt auf Zeile bzw. Punkt, Plan-Reihenfolge unverändert, fertiger Satz geht beim Wechsel nicht verloren | – | – | – → 9 | E5a |
| 36c (neu) | Stepper: Gewicht ±2,5 wirkt auf folgende Sätze (nicht auf fertige), Wdh ±1 nur für den Satz, Untergrenze 0 mit gesperrtem „−“, aria-labels, Zeit ±5 s (Start 30, „Dauer in Sekunden“, kein „+ Gewicht“) | – | – | – → 11 | E5a |
| 36d (neu) | V1: Fokus + markiert + `inputmode` + 16 px, „Fertig“ im Satzkopf, Enter/„Fertig“/Tipp auf ±/direkt „Satz fertig“ (Blur-Race) übernehmen, Komma, ungültig = alter Wert, Escape, Fokus zurück auf den Wert | – | – | – → 10 | E5a |
| 36e (neu) | „+ Gewicht“ in Wdh-Übung (null und Altbestand 0): Solo-Stepper → zwei Stepper „Zusatzgewicht in kg“, Fokus auf den Wert, Zusatzgewicht im Dokument, nach Reload Gewichts-Modus | – | – | – → 5 | E5a |
| 36f (neu) | „Mit n Sätzen abschließen“: nur bei ≥ 1 fertigem Satz (Einzahl/Mehrzahl), Dokument hat genau n Sätze und nie den vorbelegten, Satz bleibt offen, nach Reload 2 gespeicherte + restlicher Satz, Öffnen ändert das Dokument nicht | – | – | – → 7 | E5a |
| 36g (neu) | Korrektur (F6): fertigen Satz wieder öffnen (Werte, Fokus im Stepper), erneutes Speichern überschreibt dasselbe Dokument, erledigte Übung per Liste und per Punkt wieder aktuell (aria-label „…, aktuelle Übung, erledigt“) | – | – | – → 8 | E5a |
| 36h (neu) | Stub-Write gleich dem Vorher-Payload (Fixture `kraft-payload-before.json`, Auflage C1): gewichtet gleich/unterschiedlich, Körpergewicht (`kg: null`), Zeit (Sekunden in `reps`), Altbestand `kg: 0` → `null`, Komma-Gewicht 12,5, eigene Übung; je Fall gleiche Doc-ID, gleiche Feldnamen in gleicher Reihenfolge, gleiche Werte | – | – | – → 15 | E5a |
| 36i (neu) | Speichern: sofortiger Fehler → Rücknahme (Meldung `save-error`, Satz wieder aktiv, nichts gezählt, Toast, Wiederholung klappt); „Speichert …“ (disabled, aria-busy); Offline-Fenster: nach 800 ms optimistisch gespeichert, später Fehler nimmt zurück | – | – | – → 9 | E5a |
| 36j (neu) | Live-Region `#kraftLive` außerhalb von `#main`, startet leer, „Satz 1 fertig. Als Nächstes Satz 2.“, „Squats gespeichert. Als Nächstes Deadlift.“, „Jetzt: Klimmzüge.“, ein einziger stabiler Knoten | – | – | – → 5 | E5a |
| 36k (neu) | Strava-Zeile (F7): Dauer, Ø/max HF, Relative Effort; ohne Effort/ohne HF entfallen Teile; nicht verbunden und keine Einheit → Slot wirklich leer; bleibt nach Fokus-Wechsel | – | – | – → 6 | E5a |
| 36l (neu) | Kraft-Tag allgemein: öffnet oben, kein `style=` (Normal- und Anpassen-Ansicht), Tab-Leiste weg, 320 px ohne H-Scroll mit untereinander stehenden Steppern, leerer Tag „Keine Übungen für heute“ (kein Punkte/Liste, ein „Anpassen“), Zurückholen | – | – | – → 9 | E5a |
| 37a (neu) | V2-Entwurf: Öffnen schreibt nichts; Eingabe schreibt `hm-tracker.kraftDraft.<Datum>` (Fokus, Sätze, fertige Sätze); nach Neuladen Sätze, Gewicht, Fokus zurück, Toast „Eingaben von vorhin wiederhergestellt“ genau einmal, kein Dokument geschrieben | – | – | – → 9 | E5b |
| 37b (neu) | Gespeichertes Dokument vom „anderen Gerät“ gewinnt (R9): Übung zählt als gespeichert, zeigt Dokumentwerte, Entwurf behält nur die übrigen Übungen | – | – | – → 5 | E5b |
| 37c (neu) | Vergangener Tag aus der Woche lässt den Entwurf von heute unverändert, schreibt ohne Eingabe nichts und bekommt bei Eingabe einen eigenen Schlüssel | – | – | – → 4 | E5b |
| 37d (neu) | Start räumt Entwürfe > 7 Tage (8 Tage weg; 7 und 6 Tage, künftig bleiben; unlesbares Datum weg; fremder Schlüssel unberührt) | – | – | – → 3 | E5b |
| 37e (neu) | Kaputte/fremde Entwürfe (kein JSON, v2, `__proto__`, > 8 Sätze, Wert > 1000, negativ, Text statt Zahl, doneSets zu groß, nur unbekannte Übung, Array) werden ohne Fehler verworfen und gelöscht; unbekannte Übung neben gültiger fällt allein weg | – | – | – → 12 | E5b |
| 37f (neu) | Entwurf weg nach Speichern der Übung und aller 8 Übungen; „Training abschließen“ räumt einen Rest-Entwurf | – | – | – → 6 | E5b |
| 37g (neu) | Abmelden: Entwurfs-Präfix liegt unter `hm-tracker.`, `signOutAndWipeDevice` räumt diesen Präfix (Quelltext-Prüfung, die echte Funktion braucht Firebase) | – | – | – → 2 | E5b |
| 37h (neu) | `localStorage` wirft für Entwurfsschlüssel: Kraft-Tag voll nutzbar (Sätze, Speichern, Neuladen), kein Konsolenfehler | – | – | – → 4 | E5b |
| übrige (5–8, 15, 17–19b, 23, 24, 26, 27, 29–33) | unverändert; nur Selektoren auf Heute angepasst (27, 23, 30b); 29 hat keinen Kraft-Tag-Teil mehr (seit E3 nur Ampel und Banner) | – | – | – | – |

**Bewusste Ausnahmen in 2c („Im Detail“, einzeln):** Wochenvolumen (8 Wochen, aktuelle Woche, kein Ist
in der Zukunft), Aerobe Effizienz (−15 s/km), Adhärenz (50 %, 3 von 6), „Nächster Long Run“,
„Nächste Woche: Aufbau“ ersetzt durch drei Checks „Im Detail ist weg, Coach/Ampeln unverändert“;
die Rechnungen bleiben über `metrics.test.mjs` abgedeckt. **Zieht um:** „Re-Kalibrierung: 28.10.“
aus dem Plan-Objekt wandert nach Woche („Tagesdetails folgen …“) und fällt nicht weg: seit E4 geprüft
in Szenario 3c (Fixture mit `recalibrationDates` 28.10. und 22.11., zeigt das nächste Datum). Die Aerobe/Adhärenz-Rechnung für den Coach-Request bleibt in `app.js`.
