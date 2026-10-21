---
name: stride-e5-kraft-tag
description: Stride E5 Kraft-Tag design pass (2026-10-21): what was added vs. already in E0/E1 CSS, hit-area and overflow fixes, deleted E4 classes
metadata:
  type: project
---

E5 design pass found nearly all Kraft-Tag blocks already ported into style.css in E0/E1 (sd-nav, sd-dots, sd-now__*, sd-set*, sd-stepper*, sd-order__*, sd-edit__*, sd-tip). The E5 section only adds states and edge cases; markup lives in docs/ui-markup-stride.md section 11.

**Decisions:** dots hit area made asymmetric (inset -10/-28) because a symmetric 44px strip overlapped the back button above; `.sd-order` needs overflow:hidden (tinted first/last row poked out of the 22px card radius); `sd-card--done` is a tinted (teal-bg) all-done card so the primary button stays the only filled teal surface; `sd-tip--down` maps to amber (red is errors only); Fertig (commit-value) replaces "+ Gewicht" in the set head while a field is open.

**Why:** keep approved E0 mockup geometry, fix only real interaction bugs.

**How to apply:** for E6 (Lauf-Tag) reuse sd-card--done / skeleton modifiers (sd-skel--name/set/btn); E4-obsolete classes (.week-summary, .day-row, ...) and --soll-fill are already deleted from style.css, `.danger-btn` and `.primary-btn` must stay (view-account, Lauf-Tag/Verlauf).
