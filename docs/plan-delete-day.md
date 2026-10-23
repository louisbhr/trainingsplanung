# Plan: Kraft-Einträge löschen (Stride)

Stand 23.10.2026 · Branch `day-entry-delete` (Basis main 845dde3) · Grundlage
`docs/requirements-delete-day.md` (FREIGEGEBEN 23.10.2026, F1–F5 wie empfohlen, ohne Mockup).
Konventionen aus `docs/review-architecture-stride.md` gelten weiter: C2 (Entwurf), C5 (reine
View-Module, kein `style=` vom coder), C6 (Sheet-Wechsel), `renderMain`/`setPageHead`.

**Visual Plan: nicht nötig.** Kleines Feature, ein Screen, kein Approval-Gate. Text reicht.

## 1. Ansatz

- **B (eine Übung):** Textknopf „Eintrag löschen“ auf der Jetzt-Karte, sobald `vm.saved`.
  Er erscheint also auch beim Korrigieren und bei vorzeitig abgeschlossenen Übungen.
- **A (ganzer Tag):** Danger-Knopf „Einträge dieses Tages löschen“ unter „+ Übung
  hinzufügen“ im Anpassen-Modus. Sichtbar nur bei `!kraftLoadError` und mindestens einem
  Schlüssel in `kraftSaved`. `kraftSaved` stammt aus derselben Datumsabfrage
  (`loadLogsForDate`) plus den Speicherungen dieser Sitzung. Damit enthält es auch verwaiste
  Einträge.
- Beide Knöpfe sind deaktiviert, solange eine Übung speichert oder gerade gelöscht wird.
- **Bestätigung:** ein drittes, statisches Sheet `#confirmSheet`/`#confirmBackdrop` in
  `index.html` über `createSheet()`. Das Info-Sheet wird nicht mitbenutzt, denn dessen
  ×-Label lautet „Erklärung schließen“ und `openInfo` überschreibt Titel und Inhalt. Die
  C6-Wechselregeln greifen automatisch über die Registry.
- **Was gelöscht wird, ist genau das, was das Sheet zeigt:** `app.js` merkt sich
  `pendingDelete = { kind, iso, slugs, gen }`. Beim Bestätigen wird geprüft:
  `gen === kraftGen` und `iso` ist unverändert.
- **Optimistisch wie beim Speichern:** Rennen gegen `SAVE_OPTIMISTIC_MS`. Solange es läuft,
  zeigt der Danger-Knopf „Löscht …“ und ist deaktiviert. Ein früher Fehler schließt das
  Sheet mit einem Fehler-Toast, lokal hat sich dann noch nichts geändert. Danach wird der
  Zustand übernommen, das Sheet geschlossen und der Erfolgs-Toast samt Ansage gezeigt. Ein
  später Fehler setzt alles zurück.
- **Neue Referenzen statt Mutation:** `kraftSaved` wird ein neues Objekt, die betroffenen
  `logState`-Einträge werden neue Objekte (`buildExerciseState(ex, null, iso)`) und
  `allLogs` wird ein neues Array. Ein später `rollbackSave` einer vorherigen Speicherung
  schreibt so nur in abgehängte Objekte und holt nichts zurück (Requirements §7).
- **Entwurf:** Bei A wird `draftRemove(iso)` aufgerufen, damit auch offene Übungen
  zurückgesetzt werden. Bei B ist keine eigene Bereinigung nötig: Gespeicherte Übungen
  stehen nie im Entwurf (`persistKraftDraft` überspringt `st.saved`), und der neu
  aufgebaute Zustand ist nicht „dirty“. Ein Test sichert das ab.

## 2. Dateien

| Datei | Änderung | Eigentümer |
|---|---|---|
| `index.html` | `#confirmBackdrop` + `#confirmSheet` (Titel `#confirmSheetTitle`, Body `#confirmSheetBody`), Aufbau wie `#assignSheet` | Designer |
| `style.css` | kleine Ergänzungen: Aktionszeile im Sheet (Danger + Abbrechen), Text-Danger-Variante für „Eintrag löschen“, Block-Danger am Ende des Anpassen-Modus. Fluid, kein Abschneiden bei 320 px | Designer |
| `docs/ui-markup-stride.md` | neu **§11.15 Löschen**: Markup beider Knöpfe (normal/deaktiviert/„Löscht …“), Sheet-Body A/B, `data-action`-Namen (`delete-entry`, `delete-day`, `confirm-delete`, `close-sheet`), `esc()`-Liste, Fokusregeln | Designer |
| `kraftflow.js` | reine Helfer: `withoutLogs(logs, date, slugs)`, `deleteDayTargets(savedMap, visibleSlugs, nameOf)` → `{ slugs, names, orphanCount }`, `deleteCountText(n, orphans)` („1 Eintrag“/„3 Einträge“, „davon n einer entfernten Übung“) | coder |
| `firebase-init.js` | `deleteLog(dateISO, slug)` (`deleteDoc`), `deleteLogsForDate(dateISO, slugs)` (`writeBatch`, atomar). `writeBatch` kommt aus demselben SDK-Import 10.13.0, also keine neue Abhängigkeit | coder |
| `view-kraft.js` | Knopf B in `nowCardHTML` (Flag `deleteDisabled`), Knopf A in `editMainHTML` (Modell `deleteDay: { disabled } \| null`), `confirmBodyHTML({ kind, names, countText, summary })`, `confirmTitle(...)`. Alles durch `esc()` | coder |
| `app.js` | `openDeleteSheet(kind, trigger)`, `confirmDelete()`, `applyDelete()`/`rollbackDelete()`, Verdrahtung in der Event-Weiche, `createSheet("confirmSheet","confirmBackdrop")` | coder |
| `tests/app.test.mjs` | Stub-Exporte in **allen** firebase-init-Stub-Literalen (Standard ~Z. 77, Z. 814, Fehler-Stub Z. 1454, Z. 2471) + Haken `__DELETE_FAIL__`, `__DELETE_DELAY__`; neue Szenarien | coder |
| `tests/kraftflow.test.mjs` | Unit-Tests der Helfer | coder |
| `tests/static-greps.test.mjs` | Grep „kein `confirm(`“ im Render- und App-Code | coder |
| `tests/README.md` | Ledger-Zeilen | coder |

**Bestehender Helfer:** `loadLogsForDate` macht die Datumsabfrage bereits. Eine zweite
Abfrage beim Löschen ist deshalb unnötig.

**Bewusste Abweichung von Requirements §8 (P1, Architektur-Review entscheidet):**
`deleteLogsForDate` bekommt die Slugs übergeben und fragt nicht selbst per `where` ab.
Gründe: Gelöscht wird nur, was bestätigt wurde, und kein Eintrag, den ein anderes Gerät
inzwischen gespeichert hat. Offline kann ein `getDocs` bis zum Timeout hängen, und es
übersieht Dokumente, die nicht im Cache liegen. Sowohl die abgegrenzte Löschmenge als auch
die Erfassung verwaister Einträge bleiben erhalten, denn `kraftSaved` stammt aus derselben
Abfrage.

## 3. Schritte (nach jedem Schritt grün und lauffähig)

0. **Designer: D1.** Sheet-Markup in `index.html` (versteckt, noch ohne Auslöser), CSS und
   §11.15. Die App ist unverändert bedienbar, und `static-greps` bleibt grün.
1. **Coder: Fundament ohne UI.** Die `kraftflow.js`-Helfer mit Node-Tests, die zwei
   `firebase-init.js`-Exporte und alle Stub-Literale. Danach muss `stubs.test.mjs` grün
   sein. Sichtbar ändert sich nichts.
2. **Coder: B Ende-zu-Ende.** Knopf auf der Jetzt-Karte, Sheet, optimistisches Löschen,
   Rückgängigmachen, Toast und Ansage „Eintrag <Name> gelöscht“, Fokus auf
   `{ kind: "primary" }` der wieder offenen Übung. Dazu die App-Tests B.
3. **Coder: A Ende-zu-Ende.** Knopf im Anpassen-Modus mit verwaisten Einträgen,
   `draftRemove`, alle Übungen offen, Modus bleibt Anpassen, Fokus auf den ersten Knopf in
   `.sd-edit__row`. Dazu die App-Tests A.
4. **Coder: Abschluss.** Querprüfungen (Woche/Verlauf/„Letztes Mal“), `confirm(`-Grep,
   `npm run version`, Ledger und Doku.

## 4. Teststrategie

- **Unit:** `withoutLogs` entfernt nur Tag bzw. Tag+Slug, gleichnamige Übungen an anderen
  Tagen bleiben. Zählung und Zusatztext für verwaiste Einträge. Ein Name fehlt bei
  Speicherungen derselben Sitzung (`{completed, sets}` ohne `name`), dann wird er über den
  Plan bzw. den Slug ermittelt. `previousEntry` liefert nach dem Filtern die echte letzte
  Einheit.
- **App:** Der Stub zeichnet die gelöschten IDs auf und entfernt sie aus `read()`. Geprüft
  wird jeweils:
  - Sheet-Titel und Namen inklusive verwaistem Eintrag aus `dayplans.removed`.
  - „Abbrechen“, Escape und Backdrop ändern nichts, der Fokus kehrt zum Auslöser zurück.
  - Bestätigen ruft genau `deleteLog`/`deleteLogsForDate` mit den erwarteten IDs auf.
  - Bei A ist der Entwurfsschlüssel weg, ein Entwurf eines anderen Tags bleibt.
  - Bei B bleibt der Entwurf der übrigen Übungen erhalten.
  - „x von y erledigt“ und die Punkte zählen neu.
  - Die Knöpfe sind deaktiviert bei `__SAVE_DELAY__` und unsichtbar bei Ladefehler oder
    einem Tag ohne Einträge.
- **Fehler:** `__DELETE_FAIL__` sofort führt zum Fehler-Toast, nichts ändert sich.
  `__DELETE_DELAY__` > 800 ms plus Fehler führt zuerst zu „gelöscht“, danach wird
  vollständig zurückgesetzt (`kraftSaved`, `logState`, `allLogs`, Entwurf).
- **Ohne Neuladen:** Nach A ist der Tag in der Woche nicht mehr erledigt. Im Verlauf fehlen
  die Punkte, ein Chip, der nur hier vorkam, verschwindet. Am nächsten Kraft-Tag zeigt
  „Letztes Mal“ die vorherige echte Einheit.
- **C6:** Wechsel Info-Sheet → Bestätigungs-Sheet ohne Wartezeit, Escape danach.
- **Manuell (Louis):** iPhone-Home-Bildschirm im Flugmodus löschen, neu laden (bleibt
  gelöscht), online gehen, Firebase-Konsole prüfen. Sheet bei 320 px und am Desktop.

## 5. Risiken

- **Offline-Persistenz:** `deleteDoc`/`batch.commit` lösen offline erst beim Sync auf. Der
  Cache zeigt die Löschung aber sofort (Latency Compensation), und die Mutation-Queue liegt
  in IndexedDB, übersteht also auch ein Neuladen. Abgedeckt durch das optimistische
  Rennen. `signOutAndWipeDevice` wartet bereits auf offene Schreibvorgänge.
- **Späte Speicherung derselben Übung:** Firestore wendet Schreibvorgänge in Reihenfolge an,
  das Löschen nach dem `setDoc` gewinnt also. Ein später `rollbackSave` trifft nur
  abgehängte Objekte (siehe Ansatz) und zeigt höchstens einen Fehler-Toast. Ein Test mit
  `__SAVE_DELAY__` plus `__SAVE_FAIL__` vor dem Löschen sichert das ab.
- **Zweiter Tab oder zweites Gerät:** Dort bleibt `allLogs` bis zum Neuladen veraltet. Das
  Problem ist nicht neu (Requirements §7).
- **Regeln:** `allow read, write: if isLouis()` in `firestore.rules` umfasst `delete`
  (geprüft). Eine Regeländerung ist nicht nötig.

## 6. Approval-Gate-Check

Kein Gate betroffen: kein Schema, keine Regeln, keine neue Abhängigkeit (`writeBatch` aus
dem bestehenden SDK-Import), kein Endpunkt, kein Worker, keine Ordneränderung, kein
Sicherheitscode. Es gibt nur zwei neue `firebase-init.js`-Exporte (Stub-Pflicht) und ein
neues statisches Sheet-Element. Offen für den architecture-reviewer ist nur **P1**
(Slug-Liste statt Abfrage).

**Aufwand:** klein bis mittel, etwa ein Designer-Pass und drei Coder-Commits.
