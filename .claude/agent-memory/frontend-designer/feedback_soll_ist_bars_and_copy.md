---
name: feedback-soll-ist-bars-and-copy
description: target-vs-actual bar convention (both bars filled, dedicated --soll-fill token, own si-* class namespace) and a hard no-em-dash rule for all visible copy in trainingsplanung
metadata:
  type: feedback
---

**Soll/Ist (target vs. actual) bar convention — superseded 2026-09-27, then confirmed
in the final abgenommene mockup:** the final, Louis-approved version in
`docs/mockup-dashboard-v2.html` (and ported into real `style.css` in D0, 2026-09-28)
uses **two solid-filled bars**, not outline-vs-solid as an earlier draft of this memory
said. Soll = `--soll-fill` (a new, dedicated dampened neutral gray token, `#7f7e76`
light / `#8b8b86` dark — deliberately NOT a tinted version of the category color, since
`--teal-bg` reads as near-invisible against `--surface-1`, ~1.02:1 light / ~1.3:1 dark).
Ist = `--teal-fg` (full-strength). Both fully opaque/filled, same shape, distinguished
by hue+lightness, not outline-vs-fill. Contrast against `--surface-1`: Ist (`--teal-fg`)
5.4:1 light / 8.5:1 dark; Soll (`--soll-fill`) measured ≥3:1 in both themes (the actual
D2 requirement). An Ist of 0 draws no bar at all (no fake zero-stub). Always add a small
swatch legend ("Soll"/"Ist") next to any chart using this pattern — a paired soll/ist
bar chart is not self-explanatory without one, unlike a single Ist-of-Soll progress bar
(e.g. the Woche-tab's laufvolumen track), which reads fine from its accompanying
"14 / 24 km" label alone and doesn't need a legend.

**Namespace warning for implementation:** trainingsplanung's real `style.css` already
has unrelated `.bars`/`.bar-col`/`.bar-label`/`.bar` classes for the Verlauf-tab's
single-value bar chart (different height/meaning). The Dashboard's soll/ist bar-pair
component must use its own prefix (`si-bars`/`si-bar-col`/`si-bar-pair`/`si-bar-soll`/
`si-bar-ist`/`si-bar-label`/`si-bar-legend`) — reusing the old names would silently
inherit the wrong height/font-size from the older, unrelated component. See
[[project_trainingsplanung_tokens]] for the general rule of checking for class-name
collisions against the real `style.css` before porting mockup classes into it.

**No em dashes ("—") in any visible/UI copy for this app**, including coach text,
notice/empty-state text, and any annotation text that renders into the page (not just
literal product copy — Louis corrected this across coach text, dashboard notes, and
scenario descriptions in one pass). Use periods, commas, or colons instead. This is a
hard style rule for trainingsplanung specifically going forward, not just a one-off
edit — check new visible strings against it before treating copy as done. En dashes in
numeric ranges ("6:10–6:35", "14.–20. September") are fine and not part of this rule;
only the em-dash-as-sentence-connector usage is banned.

**Inline SVG icons need an explicit size wrapper, always.** Raw `<svg viewBox="0 0 24
24">` strings from an ICONS map (the `app.js` pattern) have no intrinsic width/height,
so in a flex row with any sibling that has `flex:1`, the icon can get flex-shrunk to
near-zero and effectively disappear — this shipped in the Woche-tab status icons and
was only caught by Louis's real-browser Playwright check, not by my own CSS reasoning.
Always wrap injected icon markup in a sized container (`width/height` + `flex-shrink:0`
on the wrapper, `width/height:100%` on the inner svg) rather than assuming a CSS
selector targeting `svg.some-class` will match — it won't if the class was put on the
wrapper, not the `<svg>` tag itself. Double-check the selector actually matches the
generated markup, not just the intended one.

**Short vs. long label for the same feature:** the Wochenbilanz's *collapsed* accordion
label is the short form "Wochenbilanz W3" (not "Wochenbilanz Woche 3") — Louis
corrected this explicitly. The *expanded* auto-shown heading on Mondays keeps the
fuller "Wochenbilanz · Woche 4" form; only the collapsed toggle uses the short form.
Keep this distinction if the Wochenbilanz UI is touched again.
