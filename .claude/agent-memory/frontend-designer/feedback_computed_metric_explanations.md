---
name: feedback-computed-metric-explanations
description: Louis wants a small (i) info affordance on every computed/derived metric in trainingsplanung, not just the one he happened to ask about — apply the pattern consistently
metadata:
  type: feedback
---

When a dashboard tile shows a *computed* number Louis didn't type in himself (a ratio,
a percentage, a trend delta — anything derived from a formula rather than a direct
log entry), give it a small inline explanation affordance rather than leaving it as an
unexplained value. He asked for this on the "Belastung" Ampel specifically (he didn't
understand what 0,72 meant) but then explicitly asked me to judge whether the same
pattern should extend to the *other* Ampeln and to "Aerobe Effizienz" — and confirmed
extending it was right.

**Pattern used in `docs/mockup-dashboard-v2.html`:** a small `(i)` icon button next to
the tile/card title (visually ~20px, but with a `::after{inset:-12px}` invisible hit
area so the real touch target is ≥44px without visually bloating a small 2x2 grid
tile). Tap/click/Enter opens a bottom sheet (slides up over the phone frame, backdrop
click / Escape / close button all dismiss it) with 2-4 short paragraphs: what's
calculated, what the color thresholds mean in plain language, and — where relevant —
an honest caveat (e.g. "grobe Faustregel, kein Diagnosewert") and the grau/no-data
condition. Content lives in one `INFO_CONTENT` object keyed by metric, one shared
sheet element, so adding a fifth explainer later is a one-line addition, not a new
component.

**Why:** Louis is the target user of this app (see [[project_trainingsplanung_tokens]])
and reads these numbers on his phone mid-training — an unexplained derived metric is a
UX gap, not just a nice-to-have, on a personal tracker where he wants to trust *and
understand* the coaching logic, not just obey it.

**How to apply:** default to adding this affordance for any new computed metric in
this app (ratios, trend deltas, adherence percentages, projections) rather than
asking each time whether it's warranted — but keep it to one pattern per screen (don't
invent a second explanation UI) and don't add it to raw/direct values he entered
himself (e.g. a logged weight) where there's nothing to explain.
