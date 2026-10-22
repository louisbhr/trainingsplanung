---
name: stride-e8-login-decisions
description: Stride E8 login/gate screens: empty pagehead via :empty, sd-auth centring, mark on --bg, goal-card wrap rule, deletions
metadata:
  type: project
---

E8 (2026-10-22) login and gate screens, CSS section "Login (E8)" in style.css, doc ui-markup-stride.md section 15.

- Gate screens call setPageHead("") (exact empty string); `.sd-pagehead:empty` keeps only the safe-area top padding. One h1 per screen = card title (login: sd-vh). Brand name is a p.
- Mark always sits on --bg above the card: stride-mark-dark.svg tile #26262b equals dark card colour.
- Centring = `.sd-auth` flex 1 0 auto + justify-content center (no height assumptions); #main scrolls when taller. Bottom padding of #main is zeroed via `#app.no-session #main:has(> .sd-auth)` so the 16/32 padding is the only asymmetry. Keyboard: CSS cannot shrink dvh on iOS; Android needs `interactive-widget=resizes-content` in index.html viewport meta (open point, not CSS).
- Goal card wrap fix: do NOT detect wrapping; left-align race block by default, right-align only `@container (min-width: 375px)` (#main is the container). Avoid putting container-type on the card because cqi in .sd-goal__time would change meaning.
- Login fields are div.sd-field + label[for] (not wrapping label) so per-field error text stays out of the label name.
- Deleted unused legacy classes (grep of *.js/index.html/tests showed only JS variables named bar/bars/seg/row). tests/README.md prose still mentions old names.

**Why:** orchestrator-run tests/screenshots follow; designer has no Bash.
**How to apply:** E9 deletes the "alte Anmeldung" block (marker comment "Ende alte Anmeldung") after view-account.js is converted.
