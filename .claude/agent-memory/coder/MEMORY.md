# Memory Index

- [Dashboard v2 M1 architecture](project_dashboard_v2_m1.md) — plan.js pure-logic API, plan-store.js loading/caching, JSON schema, weekType rule, formatGoal deviation; read before any M2 work touching plan data.
- [Dashboard v2 M2 architecture](project_dashboard_v2_m2.md) — metrics.js/coach.js/worker.js `/coach` API surface, render-slot pattern for daily+weekly coach text, deliberate deviations (Wochen-Tab tap behavior, kraft-status simplification, "·" in the worker whitelist); read before touching Ampeln/Coach/Wochen-Tab code.
- [Plan Phase 2](project_plan_phase2.md) — 35 Wochen, optional-Kraft (countsTowardPlan), isZoneRun für Test/Schwelle; Golden-Test bis W8
- [Aufräumrunde 20.10.](project_cleanup_utilities.md) — Utility-Klassen statt Inline-Styles, AUTH_MODE weg, Stub-Flags, N3 offen
- [Stride E5a Kraft-Tag](project_stride_e5a_kraft.md) — logState/paintKraft-Modell, Speicher-Rollback, Blur-Regel, Abweichungen; vor E5b lesen
- [Stride E6 Lauf-Tag](project_stride_e6_lauftag.md) — view-run.js-API, runOpen/paintRunSlot, Sheet-/Fokusregeln, Abweichungen; vor E7/E9 lesen
