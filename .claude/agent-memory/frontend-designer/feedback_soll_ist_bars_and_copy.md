---
name: feedback-soll-ist-bars-and-copy
description: target-vs-actual bar convention (outline=Soll, filled=Ist) and a hard no-em-dash rule for all visible copy in trainingsplanung
metadata:
  type: feedback
---

**Soll/Ist (target vs. actual) bar convention, confirmed 2026-09-27:** don't pick two
different fill colors for a "planned vs. actual" bar pair — at trainingsplanung's
surface tones, a light tinted fill (e.g. `--teal-bg`) reads as almost invisible against
`--surface-1` in light mode (measured ~1.02:1 contrast) and barely better in dark mode
(~1.3:1). Fix used in `docs/mockup-dashboard-v2.html`: Soll = outline only (2px border
in the category's `-fg` color, transparent fill), Ist = solid fill in the same `-fg`
color. Same hue, shape carries the distinction (outline vs. solid), which also makes
it colorblind-safe and gives ≥3:1 contrast against the card in both themes (measured
`--teal-fg` vs `--surface-1`: 5.4:1 light, 8.5:1 dark). Always add a small swatch
legend ("Soll" outline swatch + "Ist" filled swatch) next to any chart using this
pattern — a paired soll/ist bar chart is not self-explanatory without one, unlike a
single Ist-of-Soll progress bar (e.g. the Woche-tab's laufvolumen track), which reads
fine from its accompanying "14 / 24 km" label alone and doesn't need a legend.

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
