---
name: stride-e5a-kraft-architecture
description: Stride E5a Kraft-Tag: Zustandsmodell in app.js, view-kraft.js-API, bewusste Abweichungen; lesen vor E5b (V2-Entwurf, Anpassen-Politur)
metadata:
  type: project
---

Kraft-Tag B (Commit 5a91ab7 auf stride-redesign): `view-kraft.js` rein (headHTML/headWithDotsHTML/editHeadHTML/mainHTML/editMainHTML/loadingMainHTML/stravaSessionHTML, fmtNum, summaryText). `app.js`: `logState` (slug -> {mode, sets[{kg,reps,done}], activeIndex, saved, savedSets, saving, saveError, editing, chip, lastText}), `focusExerciseId`, `kraftOpen`/`kraftGen` (späte Antworten verwerfen), `kraftSaved` (Dokumente des Tages), `kraftSessionHTML` (Strava-Zeile überlebt Neuzeichnen), `editForm`.

**Why:** Alles wird über `paintKraft(focus)` komplett neu gezeichnet (setPageHead + renderMain, scrollTop gerettet, Fokus per `applyKraftFocus`, `focus({preventScroll:true})`).

**How to apply (E5b):**
- V2-Entwurf: Zustand steckt vollständig in `logState` (sets/done/activeIndex); `serializeDraft`/`parseDraft`/`dropSavedFromDraft` aus kraftflow.js an `buildLogState`/`paintKraft` anhängen; `kraftSaved` gewinnt (R9).
- Speichern: `saveKraftExercise` = Payload nur aus `done`-Sätzen (C1), optimistisch nach 800 ms (`SAVE_OPTIMISTIC_MS`), `rollbackSave` stellt Snapshot wieder her.
- Direkte Eingabe: Blur übernimmt still (`applyEditing`), zeichnet erst nach 400 ms neu, damit der Tipp auf „Satz fertig“ nicht verloren geht.
- Anpassen-Ansicht ist schon nach Markup 11.10 gebaut (Formulare mit `editForm`-State, Fehler im Formular statt Toast).
- Abweichungen: gespeicherte Übung mit offenen Sätzen (vorzeitig abgeschlossen) wird beim Antippen wieder aktiv (erster offener Satz); nach Frühabschluss bleibt sie ohne aktiven Satz; alles gespeichert -> Start auf der letzten Übung; Test-Init-Skripte laufen bei jedem Reload erneut (Seed nur setzen, wenn Schlüssel fehlt).
