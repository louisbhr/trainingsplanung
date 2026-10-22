---
name: stride-e6-lauf-tag
description: Stride E6 Lauf-Tag design decisions - range bars as inline SVG with number attributes (no style), h1 specificity trap, deliberate mockup deviations
metadata:
  type: project
---

E6 (Lauf-Tag B "Vergleich"), design pass 2026-10-22, style.css section "Lauf-Tag (E6)" + docs/ui-markup-stride.md section 12.

- C5 mechanism for sd-range: inline SVG, position only in numeric attributes (rect x/width, line x1/x2), viewBox 0..100 + preserveAspectRatio="none", marker stroke via vector-effect: non-scaling-stroke. No style attr, no custom props. Distance bar = `<progress class="sd-prog sd-prog--lg">`. Removed dead `.sd-bar` + `--pct`.
- Trap: `.sd-pagehead h1` (0,1,1) beats `.sd-display` (0,1,0) -> fixed with `.sd-daytitle .sd-display` (also fixes Anpassen title of E5).
- Deliberate deviations from the approved mockup (flag if Louis objects): ampel shape + sd-vh word on range values, taken sheet options only fade name/sub to 50% (reason text stays readable), axis as 3-col grid so the middle is truly centered, generic free-target note.
- Open for coder: run model has no start time (mockup "Morgenlauf · 07:05"), pickableRuns filters taken runs instead of listing them with takenBy.

**Why:** C5 forbids style=; E3 had left sd-range as the only exception.
**How to apply:** reuse the SVG-attribute pattern for any future value-positioned mark; check heading specificity against `.sd-pagehead h1` before using `.sd-display`.
