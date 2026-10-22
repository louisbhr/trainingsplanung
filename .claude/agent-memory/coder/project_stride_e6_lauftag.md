---
name: stride-e6-lauftag-architecture
description: Stride E6 Lauf-Tag: view-run.js-API, app.js-Zustand (runOpen/runGen/paintRunSlot), Sheet- und Fokusregeln, Abweichungen; lesen vor E7/E9
metadata:
  type: project
---

Lauf-Tag B (Commit 035dbdf auf stride-redesign): `view-run.js` rein (headHTML, pageHTML, loadingHTML, compareHTML, stravaRowHTML, slotState(vm) -> {html, showTarget}, errorHTML, sheetBodyHTML, pickerOptions, sheetTitle). `app.js`: `runOpen` (wie `kraftOpen`, in `render()` auf false), `runGen` (späte Antworten verwerfen), `runDay`, `paintRunSlot()` (schreibt nur #strava-slot und den Kopf, wenn sich die Ziel-Zeile ändert), `assignSheet = createSheet("assignSheet","assignBackdrop")`.

**Why:** Zuordnen/Zurücksetzen/Ignorieren dürfen die Seite nicht komplett neu rendern (Platzhalter-Flackern, Fokusverlust); der Fokus kommt über `liveTrigger` des Sheets zurück.

**How to apply:**
- Reihenfolge nach Zuordnung: `recomputeAssignment` -> `paintRunSlot` -> `assignSheet.close()` -> Fokus (ignorieren: `reset-run` der Karte, sonst `keepRunFocus`).
- `render()` ruft `assignSheet.closeImmediately()`; `reload-strava` auf dem Lauf-Tag geht über `reloadRunDay` (im Sheet: Knopf gesperrt, Sheet bleibt; im Slot: Platzhalter + Fokus auf h1).
- `view-run.js` bekommt `formatDuration` und `THRESHOLDS` im vm (keine strava.js/Firebase-Imports, C5).
- Abweichungen: Sheet-Lead lautet „Strava-Läufe im Umkreis von sieben Tagen.“ (PICKER_WINDOW = 7, die Designer-Zeile „Tag davor bis drei danach“ stimmt nur für die Automatik und steht in der Verpasst-Karte); HF-Zeile ohne `hfMax` (Schwelle) hat Band und Marker, aber keine Ampel; Tipp auf den schon zugeordneten Lauf schließt ohne Schreiben; „Automatik zurück“ bei `ignored` im Sheet nur im Code, per UI nicht erreichbar (Ignoriert-Karte hat kein pick-run).
- Tests: Haken aus Markup 12.10; `run(...)`-Helfer baut Strava-Fixtures; 38h nutzt einen injizierten `data-action="open-info"`-Prüfknopf für die Sheet-Rennen.
