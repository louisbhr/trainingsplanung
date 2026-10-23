# Requirements: Löschen von Kraft-Einträgen (Stride)

**Status: FREIGEGEBEN 23.10.2026** (Louis: "alles wie empfohlen, ohne Mockup").
F1–F5 in Abschnitt 10 gelten wie empfohlen entschieden; auf das Mockup des
Bestätigungs-Sheets hat Louis ausdrücklich verzichtet.

Stand: 23.10.2026 · Basis `main` b647190 · App `trainingsplanung` (Stride)

---

## 1. Ziel

Louis soll versehentlich oder testweise gespeicherte Kraft-Einträge in der App
selbst löschen können, ohne die Firebase-Konsole. Anlass war ein lokaler
Testlauf: Für einen Tag lagen danach Kraft-Einträge vor, die nie trainiert
wurden. Die App bietet nur „Korrigieren“, also Überschreiben.

Solche Einträge stören nicht nur die Anzeige. `previousEntry()` liest sie aus
`allLogs` als „letzte Einheit“. Damit verfälschen sie „Letztes Mal“, die
Startwerte der Stepper und den Progressions-Chip im nächsten echten Training.
Außerdem fließen sie in die Kraft-Ampel, die Woche und den Verlauf ein.

## 2. User Stories

- Louis hat für einen Tag Übungen gespeichert, die er nicht gemacht hat. Er will
  alle Einträge dieses Kraft-Tags auf einmal löschen. Danach soll der Tag wieder
  „offen“ wirken, als wäre nie etwas gespeichert worden.
- Louis hat eine einzelne Übung falsch gespeichert, zum Beispiel am falschen
  Tag oder obwohl er sie ausgelassen hat. Er will nur diesen einen Eintrag
  löschen. Die übrigen Übungen des Tages bleiben.
- Louis will vor dem Löschen klar sehen, was gelöscht wird. Ein Fehltipp im
  Studio darf nichts zerstören.

## 3. Umfang (Vorschlag)

**Im Umfang**
- **A. Ganzer Kraft-Tag:** Alle `logs`-Dokumente mit `date == <Tag>` werden
  gelöscht. Dazu gehören auch Einträge von Übungen, die über Anpassen
  „entfernt“ wurden und deshalb in der Liste gar nicht mehr erscheinen (siehe
  Abschnitt 7, „Verwaiste Einträge“).
- **B. Eine Übung:** Ein `logs/<Tag>_<slug>` wird gelöscht.
- In beiden Fällen wird der lokale Entwurf `hm-tracker.kraftDraft.<Tag>`
  bereinigt (Details in Abschnitt 4).
- Die Caches im Speicher werden sofort angepasst (`allLogs`, `kraftSaved`,
  `logState`), sodass Ampeln, Woche und Kraft-Tag ohne Neuladen stimmen.

**Nicht im Umfang**
- Läufe: Sie kommen aus Strava und sind nur lesbar. Für die Zuordnung
  (`runlinks`) gibt es schon „Automatik zurück“ und „Kein Lauf an diesem Tag“.
- Löschen aus dem Verlauf: Der Verlauf bleibt eine reine Analyseansicht
  (Backlog-Idee, siehe Abschnitt 9).
- Ein Undo per Toast.
- Löschen mehrerer Tage auf einmal und eine Papierkorb- oder
  Wiederherstellen-Funktion.
- Änderungen an `firestore.rules`, am Worker, an `metrics.js` und am Plan-Format.

## 4. Datenwirkung je Sammlung

| Sammlung / Speicher | A. ganzer Tag | B. eine Übung | Begründung |
|---|---|---|---|
| `logs/<Tag>_<slug>` | alle Dokumente mit `date == Tag` werden gelöscht (`deleteDoc`) | genau ein Dokument wird gelöscht | Das ist der eigentliche Zweck. |
| `dayplans/<Tag>` | **unverändert** (Empfehlung, F4) | unverändert | Anpassungen beschreiben den Plan des Tages, nicht erfasste Sätze. Sie lassen sich schon heute einzeln über Zurückholen und Entfernen umkehren. |
| `runlinks/<Tag>` | unverändert | unverändert | Gehört zum Lauf, eigene Rücksetzfunktion existiert. |
| `coach/<Tag>` | unverändert, wird **automatisch neu bewertet** | wie A | Siehe Abschnitt 6. |
| `coachweek/<key>` | unverändert | unverändert | Die Wochenbilanz einer abgeschlossenen Woche wird nicht nachträglich umgeschrieben. Die laufende Woche fließt in die nächste fällige Bilanz ohnehin aktuell ein. |
| `localStorage hm-tracker.kraftDraft.<Tag>` | Der Schlüssel wird entfernt. | Der Eintrag der Übung fällt weg, der Rest des Entwurfs bleibt. | Sonst stellt ein späterer Reload halb fertige Sätze wieder her („Eingaben von vorhin wiederhergestellt“). |
| `allLogs` (Speicher) | Einträge des Tages werden herausgefiltert. | Ein Eintrag wird herausgefiltert. | `allLogs` wird nur einmal geladen und nie verworfen. Ohne Anpassung blieben Ampeln und Progression bis zum Neuladen falsch. |

**Technisch:** Firestore löscht offline mit Latency Compensation. Der lokale
Cache zeigt die Dokumente sofort als gelöscht an. `loadLogsForDate` und
`loadLogsForExercise` (Verlauf) liefern also sofort das neue Ergebnis.
Synchronisiert wird später.

## 5. UX-Vorschlag

### 5.1 Wo die Aktionen liegen
- **A. Ganzer Tag:** im **Anpassen-Modus** des Kraft-Tags, unten unter
  „+ Übung hinzufügen“, als Danger-Button „Einträge dieses Tages löschen“. Er
  erscheint nur, wenn für den Tag mindestens ein Eintrag existiert, verwaiste
  eingeschlossen. Der Anpassen-Modus passt dazu: Er ist der Ort für bewusste
  Eingriffe in den Tag, und im Studio drückt man diesen Knopf nicht aus
  Versehen.
- **B. Eine Übung:** auf der **Jetzt-Karte einer gespeicherten Übung**
  (Eyebrow „Erledigt“) als Textknopf „Eintrag löschen“ unter dem
  Primärbutton. In den Zeilen des Anpassen-Modus ist kein Platz mehr, dort
  stehen schon „Ersetzen“ und „Entfernen“. Ein dritter Knopf würde bei
  schmalen Fenstern umbrechen oder abgeschnitten (Fluid-responsive-Pflicht).

### 5.2 Bestätigung
- Ein neues **Bestätigungs-Sheet** aus der vorhandenen Fabrik
  `createSheet()` in `ui.js`. Es übernimmt Escape, Backdrop, ×, Fokus auf den
  Titel und den Rücksprung zum Auslöser.
- **Kein natives `confirm()`.** Es sieht in der Home-Bildschirm-App fremd aus,
  ist nicht gestaltbar und passt nicht zum Design-System.
- **Inhalt bei A:** Titel „Einträge vom Mo, 19.10. löschen?“. Der Text nennt
  die Übungen, zum Beispiel „Kniebeuge, Bankdrücken, Rudern (3 Einträge)“.
  Gibt es verwaiste Einträge, steht dahinter der Zusatz „davon 1 einer
  entfernten Übung“. Darunter: „Das lässt sich nicht rückgängig machen.
  Anpassungen der Übungsliste bleiben.“ Knöpfe: Danger-Button „Löschen“
  (`sd-btn--danger`) und Textknopf „Abbrechen“.
- **Inhalt bei B:** Titel „Eintrag Kniebeuge löschen?“, dazu die
  Zusammenfassung (`summaryText`, zum Beispiel „3× 6 · 60 kg“). Die Knöpfe
  sind dieselben wie bei A.
- **Kein Undo.** Die Bestätigung reicht. Ein Undo-Toast bräuchte einen
  Toast mit Aktionsknopf, den es noch nicht gibt, dazu einen Timer und
  Zwischenzustände. Für einen seltenen Vorgang lohnt sich das nicht.
- Design-Regeln: keine `style=`-Attribute, Danger-Rot statt Koralle, eine
  einzige Teal-Fläche pro Screen. Das Sheet bringt keine zusätzliche Teal-Fläche.

### 5.3 Nach dem Löschen
- **Kraft-Tag (A):** Der Modus bleibt Anpassen, die Liste zeigt alle Übungen
  wieder als offen. Toast: „Einträge gelöscht“. Nach „Fertig“ startet die
  Normalansicht bei der ersten offenen Übung.
- **Kraft-Tag (B):** Die Übung wird wieder offen. Ihre Sätze werden über
  `buildExerciseState(ex, null, iso)` neu aufgebaut, also aus der letzten
  echten Einheit. Der Fokus bleibt auf der Übung, Toast: „Eintrag gelöscht“.
  Die Fortschrittspunkte und „x von y erledigt“ zählen neu.
- **Heute, Ampeln:** Beim nächsten Rendern rechnen sie mit dem angepassten
  `allLogs`. Kraft-Progression und Wochensoll ändern sich sofort.
- **Woche:** Der Kraft-Tag erscheint nicht mehr als erledigt (A), bzw. mit
  weniger erledigten Übungen (B).
- **Verlauf:** Er lädt je Übung frisch aus Firestore und damit aus dem lokalen
  Cache. Die gelöschten Punkte fehlen sofort. Eine eigene Übung, die nur in
  den gelöschten Einträgen vorkam, verschwindet aus den Filter-Chips.
- **Screenreader:** Die Live-Region `kraftLive` sagt „Einträge gelöscht“ bzw.
  „Eintrag Kniebeuge gelöscht“ an. Danach liegt der Fokus auf der ersten
  Übungszeile, nicht auf `body`.

### 5.4 Offline-Verhalten
- Gelöscht wird wie gespeichert: **optimistisch**. Die Oberfläche wird sofort
  aktualisiert, obwohl die Firestore-Promise offline erst bei der
  Synchronisation auflöst. Es gilt dasselbe Muster wie `SAVE_OPTIMISTIC_MS`
  in `saveKraftExercise`.
- Lehnt der Server das Löschen ab (sofort oder später), wird der lokale Zustand
  zurückgesetzt und ein Fehler-Toast „Löschen fehlgeschlagen: …“ erscheint.
  Der eigentliche Schutz ist die Bestätigung, mehr ist nicht nötig.
- „Abmelden“ wartet schon heute auf offene Schreibvorgänge
  (`signOutAndWipeDevice`). Ein ausstehendes Löschen geht beim Abmelden also
  nicht verloren.

## 6. Coach

`coach/<Tag>` wird nicht angefasst. `requestCoach` vergleicht den `inputHash`.
Nach dem Löschen ändern sich die Ampeln und damit der Hash. Beim nächsten
Öffnen von Heute wird der Tagessatz deshalb automatisch neu erzeugt, bis zum
bestehenden Tageslimit (`THRESHOLDS.coach.dailyLimit`). Ist das Limit
erreicht, bleibt der alte Text stehen (`limited`). Das ist bestehendes,
akzeptiertes Verhalten. Löschen oder Zurücksetzen von Coach-Dokumenten ist
nicht nötig und würde nur das Limit umgehen.

## 7. Randfälle

- **Während eine Übung speichert** (`st.saving`): Beide Löschknöpfe sind
  deaktiviert. Wenn eine optimistisch gespeicherte Übung später zurückgerollt
  wird, darf sie den gelöschten Zustand nicht wiederherstellen. Dafür sorgt
  dieselbe Generation- und Map-Referenz-Logik wie bei `rollbackSave`.
- **Halb gespeicherter Tag:** A löscht nur, was existiert. Offene Übungen und
  ihr Entwurf werden ebenfalls verworfen, der ganze Tag wird zurückgesetzt.
  B betrifft nur die gewählte Übung.
- **Vorzeitig abgeschlossene Übung** („Mit n Sätzen abschließen“): Sie ist ein
  normaler Eintrag und wird ganz gelöscht. Einzelne Sätze werden nicht
  gelöscht, dafür gibt es weiter Korrigieren.
- **Eigene Übungen** (`custom`, aus `dayplans.added`): Der Eintrag wird
  gelöscht, die Übung bleibt auf der Tagesliste, weil `dayplans` unverändert
  bleibt. Wer sie auch aus der Liste haben will, nutzt „Entfernen“.
- **Verwaiste Einträge:** Wird eine gespeicherte Übung im Anpassen-Modus
  „entfernt“, bleibt ihr `logs`-Dokument in Firestore. Sie erscheint nicht mehr
  auf dem Tag, zählt aber weiter im Verlauf, in der Progression und in den
  Ampeln. A erwischt solche Einträge über die Abfrage nach `date` und nennt sie
  im Sheet. Für B sind sie unsichtbar und damit auch nicht einzeln löschbar.
  Siehe F5.
- **Heute oder vergangener Tag:** Beides ist erlaubt. Vergangene Kraft-Tage
  erreicht man über die Woche, dort gilt dasselbe Verhalten. Künftige Tage
  haben normalerweise keine Einträge, dann ist A nicht sichtbar.
- **Ladefehler** (`kraftLoadError`): Die Löschknöpfe sind nicht sichtbar. Ohne
  geladene Einträge weiß die App nicht, was sie löschen würde.
- **Entwurf eines anderen Tags:** Er bleibt unberührt. Gelöscht wird nur der
  Schlüssel des betroffenen Tags.
- **Zweiter Tab oder zweites Gerät:** Der andere Tab hält ein veraltetes
  `allLogs`, bis er neu lädt. Das gilt für Speichern heute genauso, es ist kein
  neues Problem.

## 8. Approval-Gate-Check

- **Firestore-Schema:** keine Änderung. Es werden nur vorhandene Dokumente
  gelöscht, keine neuen Felder oder Sammlungen angelegt.
- **Firestore-Regeln:** keine Änderung. `allow read, write: if isLouis()`
  umfasst `delete`.
- **Neue Abhängigkeiten:** keine. `deleteDoc` wird in `firebase-init.js`
  bereits importiert. Ein atomares Löschen per `writeBatch` käme aus
  demselben SDK und derselben Version.
- **Neue Exporte in `firebase-init.js`** (nur Lesen und Schreiben, wie die
  übrigen): `deleteLog(dateISO, exerciseSlug)` und
  `deleteLogsForDate(dateISO)`. Letztere fragt per `where("date","==",…)` ab
  und löscht per Batch, gibt die gelöschten Slugs zurück. Achtung: Der
  Stub-Wächter `tests/stubs.test.mjs` vergleicht die importierten Namen. Der
  Test-Stub von `firebase-init` braucht also dieselben neuen Exporte.
- **API und Worker:** keine Änderung.
- **Neuer UI-Baustein:** Bestätigungs-Sheet. Das ist kein Approval-Gate, fällt
  aber unter die Mockup-Pflicht. Markup und Styling gehören dem
  frontend-designer, `docs/ui-markup-stride.md` bekommt einen eigenen
  Abschnitt.

## 9. Testideen

**Unit** (`node --test`, reine Funktionen in `kraftflow.js` oder einem kleinen
neuen Helfer, ohne Firebase)
- Ein Filter auf `allLogs` (`withoutLogs(allLogs, date, slugs?)`) entfernt
  genau die Einträge dieses Tages bzw. der Übung. Andere Tage und gleichnamige
  Übungen an anderen Tagen bleiben.
- Die Entwurfs-Bereinigung entfernt bei B nur den Eintrag der Übung. Bleibt
  nichts übrig, liefert sie `null` (dann wird der Schlüssel entfernt). Der
  Fokus fällt korrekt zurück.
- Der Sheet-Text zählt richtig: „1 Eintrag“ gegenüber „3 Einträge“, Zusatz
  „davon n einer entfernten Übung“, Namen werden durch `esc()` geschützt.
- Nach dem Löschen liefert `previousEntry` wieder die echte letzte Einheit, und
  „Letztes Mal“ und der Chip folgen daraus.

**App und E2E** (`tests/app.test.mjs` mit Firebase-Stub, ggf. Playwright)
- A: Anpassen öffnen, „Einträge dieses Tages löschen“, Sheet erscheint mit den
  richtigen Namen. „Abbrechen“ und Escape ändern nichts, der Fokus kehrt zum
  Auslöser zurück. „Löschen“ ruft `deleteLogsForDate`, alle Übungen sind
  danach offen, der Entwurfsschlüssel ist weg.
- B: Gespeicherte Übung fokussieren, „Eintrag löschen“, bestätigen. Nur
  diese Übung ist offen, „x von y erledigt“ stimmt.
- Löschknöpfe sind deaktiviert, solange eine Übung speichert. Sie sind
  unsichtbar bei Ladefehler und an Tagen ohne Eintrag.
- Fehlerfall: Der Stub wirft beim Löschen. Der Zustand wird zurückgesetzt, ein
  Fehler-Toast erscheint.
- Verwaister Eintrag: `logs` enthält einen Slug aus `dayplans.removed`. A
  nennt und löscht ihn mit.
- Statische Greps (bestehend): kein `style=`, kein `confirm(` im neuen Code.
- Manuell: auf dem iPhone in der Home-Bildschirm-App im Flugmodus löschen,
  dann online gehen und in der Firebase-Konsole prüfen, dass die Dokumente
  weg sind. Sheet bei 320 px und am Desktop ansehen.

## 10. Offene Fragen (mit Empfehlung)

**F1 – Wie fein soll gelöscht werden: eine Übung, der ganze Kraft-Tag, oder der
ganze Tag inklusive Lauf-Zuordnung und Tagesanpassungen?**
Empfehlung: einzelne Übung **und** ganzer Kraft-Tag, beides nur für
`logs`. Lauf-Zuordnung und Tagesanpassungen bleiben außen vor, beide lassen
sich schon heute zurücksetzen.

**F2 – Wo liegen die Knöpfe?**
Empfehlung: Den ganzen Tag löscht man unten im Anpassen-Modus („Einträge
dieses Tages löschen“, Danger-Button, nur bei vorhandenen Einträgen). Eine
einzelne Übung löscht man mit dem Textknopf „Eintrag löschen“ auf der
Jetzt-Karte einer gespeicherten Übung. Im Verlauf gibt es vorerst nichts
(Backlog).

**F3 – Wie wird bestätigt, gibt es ein Rückgängig?**
Empfehlung: ein Bestätigungs-Sheet mit Danger-Button „Löschen“ und
„Abbrechen“. Es nennt die betroffenen Übungen. Kein natives `confirm()`,
kein Undo-Toast.

**F4 – Werden die Tagesanpassungen (`dayplans/<Tag>`: entfernte, ersetzte und
hinzugefügte Übungen) beim Löschen des ganzen Tages mit zurückgesetzt?**
Empfehlung: nein. Löschen betrifft nur erfasste Sätze. Die Übungsliste bleibt
so, wie sie angepasst wurde, und jede Anpassung lässt sich einzeln umkehren.
Coach-Texte werden ebenfalls nicht angefasst, sie erneuern sich über den
`inputHash` automatisch.

**F5 – Soll „Entfernen“ einer bereits gespeicherten Übung im Anpassen-Modus
deren Eintrag künftig mitlöschen?** Heute bleibt der Eintrag unsichtbar
stehen und zählt weiter in Verlauf, Progression und Ampeln.
Empfehlung: in diesem Feature nicht ändern. Das Löschen des ganzen Tags
erfasst solche Einträge und nennt sie im Sheet. Ob „Entfernen“ selbst fragen
soll, kommt als eigener Punkt ins Backlog.

## 11. Erfolgskriterien

- Louis kann den Test-Tag aus dem Anlass vollständig in der App löschen, ohne
  die Firebase-Konsole.
- Danach zeigen Kraft-Tag, Woche, Ampeln und Verlauf ohne Neuladen keinen
  Rest der gelöschten Einträge. „Letztes Mal“ zeigt im nächsten Training die
  echte letzte Einheit.
- Ein einzelner Fehltipp löscht nie etwas, es braucht immer die Bestätigung
  im Sheet.
- Offline gelöscht bleibt gelöscht und kommt nach dem Sync nicht wieder.

## 12. Backlog-Kandidaten (geparkt)

- Einträge aus dem Verlauf heraus löschen (Langdruck oder Detailansicht eines
  Punkts).
- „Entfernen“ einer gespeicherten Übung fragt, ob ihr Eintrag mitgelöscht
  werden soll (siehe F5).
- `allLogs` auch nach dem Speichern im Speicher nachführen. Heute bleiben
  Ampeln und Progression nach einem Speichern bis zum Neuladen auf dem alten
  Stand. Das ist eine bestehende Lücke, die dieses Feature beim Löschen
  vermeidet.
