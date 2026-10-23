# Architektur-Review: Kraft-Einträge löschen (Stride)

Stand 23.10.2026 · Branch `day-entry-delete` · geprüft: `docs/plan-delete-day.md` gegen
`docs/requirements-delete-day.md` (FREIGEGEBEN) und den Code (`firebase-init.js`, `app.js`
Speicher-/Rollback-Pfad, Entwurf, `ui.js` `createSheet`, `index.html`, `tests/app.test.mjs`,
`tests/stubs.test.mjs`, `firestore.rules`).

## Urteil

**Freigegeben mit Auflagen.** Kein Approval-Gate betroffen: kein Schema, keine Regeländerung
(`allow read, write` umfasst `delete`), keine neue Abhängigkeit (`writeBatch` kommt aus dem
vorhandenen Import `firebase-firestore.js` 10.13.0), kein Endpunkt, kein Worker.
Visual Plan nicht nötig.

**P1 (Slugs statt Abfrage): angenommen.** `kraftSaved` stammt aus genau derselben
`where("date","==",…)`-Abfrage (`loadLogsForDate`, Schlüssel `data.exercise`) plus den
Speicherungen der Sitzung. Es enthält also verwaiste Einträge und auch Dokumente mit
`completed: false`. Gelöscht wird damit genau das, was das Sheet nennt, und nichts, was ein
anderes Gerät inzwischen geschrieben hat. Eine zweite Abfrage brächte offline nichts Neues,
denn sie liest aus demselben Cache. Restrisiko: Ein Dokument, dessen ID nicht
`<datum>_<exercise>` lautet, bliebe stehen. Im Code schreibt aber nur `saveLog`, und zwar ID und
`exercise` aus derselben Variable. Die manuelle Prüfung in der Firebase-Konsole bleibt deshalb
im Testplan.

**writeBatch/Offline:** Der Batch ist atomar (Limit 500, ein Tag hat unter 20 Dokumente).
Offline löst `commit()` erst beim Sync auf. Die Mutation liegt in der IndexedDB-Queue und
übersteht ein Neuladen, der Cache zeigt die Löschung sofort. Firestore wendet die Queue in
Reihenfolge an: Ein `setDoc` vor dem Löschen verliert, ein `setDoc` danach legt neu an. Beides
ist richtig.

**Neue Referenzen statt Mutation:** Das ist richtig und nötig. `rollbackSave` schreibt per
`Object.assign(st, …)` und `savedMap[...]` in die alten Objekte. Diese sind nach dem Ersetzen
abgehängt. Das Bestätigungs-Sheet als drittes statisches Sheet ist richtig. `createSheet`
funktioniert für beliebig viele Sheets (Registry, ein globaler Escape-Handler).

## Auflagen (bindend)

- **D1 – Gemeinsame Doc-ID.** `saveLog`, `loadLog`, `deleteLog` und `deleteLogsForDate` bilden
  die Referenz über einen gemeinsamen privaten Helfer (`logRef(dateISO, slug)`).
  `deleteLogsForDate` committet bei leerer Liste nicht. Die Slugs kommen aus
  `Object.keys(kraftSaved)` und nie aus `logState` oder der sichtbaren Liste.
- **D2 – Eingefrorene Operation.** Beim Bestätigen wird `pendingDelete` in eine lokale
  Konstante kopiert und dann auf `null` gesetzt, „Löschen“ wird sofort deaktiviert
  (Doppeltipp). Nach dem `await` liest nichts mehr `pendingDelete` neu. Schließen per Escape,
  Backdrop oder × während „Löscht …“ bricht nichts ab. Das Ergebnis wird trotzdem übernommen.
- **D3 – Daten- und Ansichtsteil trennen.** `allLogs` als neues gefiltertes Array und bei A
  `draftRemove(iso)` gelten immer, auch wenn der Nutzer inzwischen woanders ist. Sonst bleiben
  Ampeln und „Letztes Mal“ falsch. Nur `kraftSaved`, `logState`, das Neuzeichnen, der Fokus und
  die Ansage hängen an `gen === kraftGen && kraftOpen && currentKraftDay.iso === op.iso`.
- **D4 – Späte Rücknahme nur bei unverändertem Stand.** Der Speicher wird nur
  zurückgesetzt, wenn `kraftSaved` und `allLogs` noch genau die Referenzen sind, die das
  Löschen gesetzt hat. Sonst (z. B. nach einer neuen Speicherung) wird nichts Veraltetes
  zurückgeschrieben. Stattdessen `allLogs = null` (Firestore setzt den Cache bei Ablehnung selbst
  zurück) und, falls der Tag offen ist, neu laden über `renderKraftDay`. Den Entwurf von A vor
  `draftRemove` als Rohtext sichern und nur zurückschreiben, wenn der Schlüssel noch fehlt. Der
  Fehler-Toast erscheint immer.
- **D5 – Kein Überschreiben mit alter Referenz.** `ensureAllLogsAndDayPlans` und
  `renderKraftDay` übernehmen `allLogs` heute aus `Promise.all([allLogs ? Promise.resolve(allLogs) : …])`.
  Steht `loadAllDayPlans`/`loadLogsForDate` noch aus, schreibt das nach dem Löschen das alte
  Array zurück. Deshalb nur zuweisen, wenn wirklich geladen wurde (`allLogs = allLogs ?? logs`).
  Ein Test deckt das ab.
- **D6 – Sheet-Reihenfolge und Navigation.** Bei Erfolg zuerst `confirmSheet.close()`, danach
  `paintKraft(focus)`, damit der App-Fokus gewinnt. Der Auslöser verschwindet ohnehin, und
  `liveTrigger` liefert dann `null`. `render()` schließt das Bestätigungs-Sheet sofort, wie
  heute `assignSheet` (Z. 886), und setzt `pendingDelete` zurück. Das ×-Label lautet
  „Schließen“, `aria-labelledby` zeigt auf `#confirmSheetTitle`. Der Body wird nur aus
  `esc()`-geschützten View-Strings gebaut.
- **D7 – Deaktivierung.** A ist deaktiviert, sobald irgendein `logState`-Wert `saving` ist. B
  ist deaktiviert, solange die fokussierte Übung `saving` ist. Beide bleiben während der
  frühen Phase eines laufenden Löschens deaktiviert. Nach dem optimistischen Fenster dürfen sie
  wieder aktiv sein, denn die Queue ist geordnet.
- **D8 – Stub wie Firestore.** Alle vier firebase-init-Stub-Literale (Standard Z. 77–87, Z.
  806–815, Fehler-Stub Z. 1454–1470 mit `boom()`, Z. 2465–2472; die Zeilenangaben im Plan
  weichen leicht ab) bekommen `deleteLog` und `deleteLogsForDate`. Im Standard-Stub laufen
  `saveLog` und beide Löschfunktionen über eine gemeinsame Promise-Kette. Sonst schreibt ein
  `__SAVE_DELAY__`-Save nach dem Löschen und erweckt den Eintrag wieder, was Firestore nie tut.
  `__DELETE_FAIL__` ändert den Speicher nicht.
- **D9 – Pflicht-Tests zum Zusammenspiel.** (a) `__SAVE_DELAY__` 1400 + `__SAVE_FAIL__`, nach
  dem optimistischen Fenster B löschen, danach die späte Rücknahme: Die Übung bleibt offen,
  `kraftSaved` hat keinen Schlüssel, im Stub liegt nichts. (b) Spät scheiterndes Löschen nach
  einer neuen Speicherung derselben Übung: Kein veralteter Zustand kommt zurück (D4). (c)
  Navigation während „Löscht …“: `allLogs` ist trotzdem gefiltert (D3).

## Entscheidungen für Louis

Keine Entscheidungen nötig. P1 ist technisch entschieden (angenommen), alle Auflagen sind
Umsetzungsdetails innerhalb des freigegebenen Umfangs.
