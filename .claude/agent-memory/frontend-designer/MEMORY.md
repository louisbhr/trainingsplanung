# Memory Index

- [trainingsplanung tokens & reference chain](project_trainingsplanung_tokens.md) — vanilla-JS PWA, real tokens in style.css, D0 (2026-09-28) ported mockup into real style.css/index.html/markup-ref doc
- [Ampel status-color addition](feedback_ampel_status_colors.md) — added --ok-fg/--danger-fg tokens + dot-shape redundancy since the app had no semantic red/green before dashboard-v2; both confirmed by Louis
- [Computed-metric info affordance](feedback_computed_metric_explanations.md) — add a small (i) explainer sheet to every derived/computed metric, not just the one flagged; ≥44px hit target via invisible ::after
- [Soll/Ist bars & copy rules](feedback_soll_ist_bars_and_copy.md) — both bars filled (dedicated --soll-fill token, own si-* namespace, not outline); no em dashes anywhere visible; short "Wochenbilanz W3" label; inline-SVG icons need explicit size wrappers or they flex-shrink to invisible
- [D0 CSS-port decisions](feedback_d0_css_port_decisions.md) — class-collision checks before reusing mockup class names, additive-only .badge edit, two valid SVG-icon-sizing patterns (descendant-selector vs. framed wrapper), --text-muted dark = #918f87
- [M2-11 Feinschliff decisions](feedback_m2_11_feinschliff_decisions.md) — 44px touch-target floor applies retroactively (start-btn/bilanz-toggle were 36px), day-row accordion refactor left dead CSS, em-dash rule scoped to the touched feature surface not a silent app-wide sweep
- [Stride E0 decisions](project_stride_e0_decisions.md) — sd- class prefix, stepper unit below value + wrap at 320, template-cloned mockup, cq-unit pitfall with fixed tab bar
- [Stride E3 Heute decisions](project_stride_e3_heute.md) — <progress> instead of style=--pct (C5), empty-slot :empty rule, week-strip circle sizes by container query
- [Stride E5 Kraft-Tag decisions](project_stride_e5_kraft_tag.md) — E5 mostly CSS-already-ported; asymmetric dots hit area, .sd-order overflow, sd-card--done, deleted E4 classes
- [Oct 3 spacing-pass bug patterns](feedback_spacing_pass_oct03.md) — small icon-button padding inheritance collapses content box, async-slot wrapper divs eat parent flex gap, 3-child space-between makes a "column" float/jump
