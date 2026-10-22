---
name: stride-e3-heute-decisions
description: Stride E3 (Heute) design pass 2026-10-21 - progress element instead of style=--pct for C5, slot/empty rules, 7-circle container-query sizes
metadata:
  type: project
---

E3 delivered in style.css (section "Heute (E3)") plus docs/ui-markup-stride.md section 9.

- **C5 without any style attr:** value bars on Heute are native `<progress class="sd-prog" value max>` (browser clamps); skeleton widths are fixed classes (`sd-skel--w92/w60/w40/chip`). **Why:** orchestrator ruled out even `style="--pct:"`. **How to apply:** prefer `<progress>` for E4 summary bars too; `sd-range` (E6, three values) has no such option, flag it then.
- **Empty slots:** `.sd-main > [id$="-slot"]:empty {display:none}`, so slot markup must be truly empty (no whitespace), otherwise the 12px gap leaves a hole.
- **Week strip circles:** 36px, 32px under 360px container, 28px under 320px (scrollbar case); today ring is 4px outside so it needs the shrink.
- `is-missed` on week strip is my optional addition (handoff only has open/done/today); `go-tab` is a new data-action.
- Not browser-verified (no browser in the agent).

See [[project_stride_e0_decisions]].
