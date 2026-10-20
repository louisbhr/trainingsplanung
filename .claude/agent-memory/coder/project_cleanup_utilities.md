---
name: project-cleanup-utilities
description: Aufraeumrunde 20.10.2026 - Utility-Klassen statt Inline-Styles, AUTH_MODE entfernt, Muster fuer Gate-Hinweise
metadata:
  type: project
---

Branch `aufraeumen` (Worktree /Users/louisbehre/.claude/jobs/f675683c/tmp/wt-cleanup, nicht gepusht).

- Statische `style="..."` im Render-Code sind durch Utilities in style.css ersetzt (mt-*, jc-between, fg-*, metric-value.xs ...), mit `!important` bei Margin/Farbe, weil `.card p.hint` sonst gewinnt. Neue Utilities dort ergaenzen, nicht inline schreiben; nur datenabhaengige Werte bleiben inline.
- Worker hat keinen AUTH_MODE mehr (Token-Pflicht immer); config-consistency-Test prueft, dass der Name nirgends mehr steht.
- Einmal-Hinweis ueber Reload hinweg: sessionStorage "hm-tracker-notice" (nicht localStorage, den raeumt Abmelden).
- Test-Stub: `__TOKEN_FAIL__` kann String (Firebase-Fehlercode) sein, `__CACHE_KEPT__` laesst signOutAndWipeDevice cacheCleared:false liefern.
- Offen gelassen: N3 (Abmelden in anderem Tab) - braucht neuen firebase-init-Export plus alle Stub-Literale.
