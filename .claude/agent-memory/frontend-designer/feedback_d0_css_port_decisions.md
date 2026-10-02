---
name: feedback-d0-css-port-decisions
description: Decisions made while porting the approved dashboard-v2 mockup into real style.css (D0, 2026-09-28) — class-collision checks, additive-only edits, SVG-icon sizing patterns
metadata:
  type: feedback
---

When porting an approved mockup's CSS into trainingsplanung's real `style.css`, do not
copy mockup class names 1:1 without first checking the real file for existing classes
with the same name but different meaning/geometry. Found and avoided in D0: mockup's
`.bars`/`.bar-col`/`.bar-label` would have collided with the real Verlauf-tab bar chart
(different height/font-size) — used a `si-*` prefix instead for the Dashboard's soll/ist
bar-pairs (see [[feedback_soll_ist_bars_and_copy]]). Also checked `.metric-grid`/
`.metric-label`/`.metric-value` (already used elsewhere at different sizes) and scoped
the Dashboard's bigger numbers under a new `.metric-tile` wrapper via descendant
selectors (`.metric-tile .metric-value { font-size: 22px }`) rather than editing the
global rule, which would have changed Verlauf/Kraft-day tiles too.

**Prefer additive CSS changes over rewriting existing rules** when a rule is reused by
both old (inline-style-driven) and new (class-driven) call sites. Example: `.badge` had
no background/color at all in real `style.css` (the existing `badge()` JS helper in
`app.js` always supplied it via inline `style="background:…;color:…"`). Added
`background: var(--tone-bg, var(--surface-1)); color: var(--tone, var(--text-secondary))`
directly to `.badge` — inline styles still win via specificity for old call sites, so
nothing regressed, but new call sites (the Dashboard's phase badge) can now use plain
`.tone-*` classes with no inline style, per the "keine Inline-Styles nötig machen"
requirement (Review-Minor M5, `docs/review-code-m1.md`).

**Two valid SVG-icon-sizing patterns, don't mix them per element:**
1. Descendant selector directly on `svg` (`.info-btn svg`, `.ex-row svg`,
   `.bilanz-toggle svg`, `.week-nav button svg`) — icon markup drops in with no wrapper,
   selector matches the injected `<svg>` regardless of any class on it.
2. Framed wrapper with its own box (`.status-icon` in the Wochen-tab day list) — a
   `<span class="status-icon">` sized 18×18, `.status-icon svg { width:100%;
   height:100% }` scales the icon into it. Only needed where the icon sits in a flex row
   next to a `flex:1` sibling and would otherwise get flex-shrunk to invisible (the
   original D5-adjacent bug, see [[project_trainingsplanung_tokens]]).
   Mistake caught mid-task and fixed: wrapping the Coach-card's chat icon in an
   unnecessary second `<span class="icon">` (the `ICONS.chat` markup already carries
   `class="icon"` on the `<svg>` tag itself) doesn't break anything but is confusing
   duplication — and doing the same to `ex-row`'s chevron icon actively causes a
   size conflict, because `.ex-row svg` (15px) and `.status-icon svg` (100%, i.e. 18px
   via the wrapper) would both match the same `<svg>` and the later-declared rule in the
   stylesheet wins regardless of which pattern was "intended". Always check which
   pattern a given call site already uses before adding a wrapper "for safety".

**`--text-muted` dark value is `#918f87`** (4.65:1 against `--surface-2`), not the
original `#85847c` — already corrected in real `style.css` as of D0. Don't reintroduce
the old value if touching dark-mode text tokens again.
