---
name: project-stride-e9-abschluss
description: Stride E9 cleanup decisions: what legacy CSS was kept and why, safe-area formula, single reduced-motion block, open day-without-session migration
metadata:
  type: project
---

E9 (2026-10-22) deleted ~43 dead rules from style.css (1340 -> 1250 lines) and documented it in docs/ui-markup-stride.md section 16.

**Kept on purpose:** `.card`, `.card.notice`, `.card.error-card`, `.center-note`, `.mt-8`, `.link-btn`, `.badge`, `.sd-pagehead .eyebrow|.title-row|h1`, `--surface-1`, `.tone-*`. **Why:** app.js `renderDay()` (Ruhetag, Platzhalter, Bis zum Rennen, Kein Plan, reachable via Heute "Morgen" row), ui.js `errorCard/loadingCard/badge` still write them; `.tone-*` is used by view-plan.js. **How to apply:** before deleting any of these, check that the coder migrated those JS callers (target markup is in doc 16.6).

**Rules to keep following:**
- Header blocks outside `.sd-main` use `max(20px, env(safe-area-inset-left|right))` (nav: 8px). Inline max(), no custom property, to avoid env()-in-var risk.
- All transitions/animations go into the ONE reduced-motion block at the end of style.css; add new ones there.
- Direct children of `#main` are only `.sd-pagehead` and `.sd-main`/`.sd-auth`; the `#main:has(...)` zeroing rule lists only those two.
- Full-width pressable cards/rows must reset `transform` on `:active` (global `button:active` scales 3 %).
- Missed state in the week strip uses ring + strikethrough number, not colour alone.
