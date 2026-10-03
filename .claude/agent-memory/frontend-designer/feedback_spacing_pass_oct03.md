---
name: feedback-spacing-pass-oct03
description: Three new CSS bug patterns found during the 03.10.2026 full spacing/padding pass (button padding inheritance collapsing a small icon, wrapper-div gap collapse for progressive-load slots, 3-child space-between anti-pattern) — check for these first on any future spacing/icon-visibility bug in this app.
metadata:
  type: feedback
---

Found and fixed during a Louis-requested "complete pass over paddings and spacings"
across Dashboard/Wochen-Tab/Kraft-Lauf-Tagesansicht (branch `coach-prompt-spacing`,
no browser available to me, Louis verified via screenshots afterward). Three concrete
CSS bug *patterns*, not just one-off fixes — check for these first if a similar symptom
shows up again anywhere else in this app:

**1. Small icon `<button>`s can silently zero out their own content box.** The generic
`button { padding: 6px 12px; }` base rule applies to every `<button>`, including small
icon buttons that only declare `width`/`height` and forget to reset `padding`. With
`box-sizing: border-box`, a 21px-wide button minus 24px of inherited horizontal padding
gives a *negative* content width (clamped to 0) — any child SVG inside (a flex item,
default `flex-shrink:1`) then shrinks to invisible in that 0px space. Symptom looks
identical to the already-known "[[feedback_soll_ist_bars_and_copy]] SVG sizing trap"
(icon invisible, only a focus ring visible on `:focus-visible`) but the *cause* is
different — not missing width/height on the svg, but inherited padding on the button
wrapper. `.info-btn` (21×21) hit this; `.icon-btn`/`.info-sheet-close` (38px/44px) don't,
because they're big enough that 24px of padding doesn't go negative, which is exactly
why nobody noticed until a button this small existed. Rule of thumb: any new small
(`<30px`) icon `<button>` must explicitly set `padding: 0`, don't assume the generic
`button` rule is harmless just because bigger icon buttons never showed a problem.

**2. A wrapper `<div>` added for independent async re-rendering silently eats the
parent's flex `gap`.** `#main` is `display:flex; flex-direction:column; gap` and the
*mockup* rendered Dashboard content as flat, direct `#main` children (today-card,
coach-card, ampel-grid, "Im Detail" label + its cards), so the gap applied between
every one of them automatically. The real `app.js` wraps each section in its own
`#today-slot`/`#coach-slot`/`#ampel-slot`/`#detail-slot` div so Strava/Coach/Ampeln can
load and patch independently (M2-4) — a legitimate reason, but it moves multiple
`#detail-slot` children (label, two cards, a metric-grid) one level deeper, outside
`#main`'s gap, with literally zero margin between them. Fix applied: give the slot divs
themselves `display:flex; flex-direction:column; gap` matching `#main`'s own gap value,
which is a no-op for the single-child slots and the actual fix for `#detail-slot`.
**Lesson: whenever a coder wraps multiple previously-flat-sibling elements in a new
container div for JS/state reasons (patching, lazy-loading, conditional slots), check
whether that container needs to re-declare the parent's gap/spacing — it won't inherit
it.** This is a good thing to proactively check on any future "why do these two cards
touch with zero gap even though the design system has a spacing scale" report.

**3. `justify-content: space-between` on 3+ flex children makes the middle item(s)
float and jump with content length — not a stable column.** `.ex-row` (exercise name +
soll text + chevron) used `space-between` across all three children; the free space
splits into two *equal* gaps (name↔soll, soll↔chevron), so the soll text's horizontal
position depends on how much space is left after the name renders, meaning it visibly
shifts per exercise. This is a general anti-pattern, not specific to this component:
**if you want item N of 3+ flex children to look like a fixed-position "column"
(constant horizontal position regardless of a sibling's length), don't use
`space-between`** — give the growing sibling `flex:1` (+ truncation/ellipsis if it must
stay one line) and give the "column" item a fixed/min-width with `text-align:right`,
`flex-shrink:0`, placed immediately before the trailing fixed element (icon, chevron,
etc.). Applies to `.ex-row` here; worth checking any other 3-child flex row in this app
for the same `space-between`-on-3-items pattern if a similar "floats/jumps" report comes
in.

**Why these three matter together:** none of them were visible from reading the mockup
or the "intended" component CSS in isolation — all three only showed up once real data
(longer names, the async-slot wrapper, a truly small button) hit the approved design.
See [[project_trainingsplanung_tokens]] for the general mockup-to-real-CSS porting
context, and [[feedback_soll_ist_bars_and_copy]] for the earlier, related SVG-sizing
trap this pass's bug 1 initially looked like but wasn't.
