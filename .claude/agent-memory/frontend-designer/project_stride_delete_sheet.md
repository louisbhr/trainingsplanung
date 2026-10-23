---
name: stride-delete-sheet-decisions
description: Stride delete-entry feature (Oct 2026) - third static confirm sheet, static action buttons, text-danger variant, section 11.15
metadata:
  type: project
---

Third static sheet #confirmSheet with FIXED action buttons in index.html (#confirmSheetCancel, #confirmSheetDelete); coder only fills title/body and toggles disabled/aria-busy/label ("Löscht …"). aria-describedby points to #confirmSheetBody.

**Why:** busy state then needs no re-render, and one button pair serves both kinds (entry/day).

**How to apply:** new CSS block at end of style.css ("Löschen von Kraft-Einträgen"), classes sd-btn--textdanger, sd-dangerzone, sd-confirm*, sd-sheet__actions. Disabled busy = opacity .6 via [aria-busy]. Focus must move to the sheet title before disabling the focused button. Orphan tag "(entfernt)" uses --text-secondary because --text-muted fails on --sunk. Docs: ui-markup-stride.md §11.15. Did not touch .pipeline-state.md (task forbade apps/trainingsplanung).
