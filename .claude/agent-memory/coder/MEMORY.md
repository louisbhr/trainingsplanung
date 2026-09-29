# Memory Index

- [Dashboard v2 M1 architecture](project_dashboard_v2_m1.md) — plan.js pure-logic API, plan-store.js loading/caching, JSON schema, weekType rule, formatGoal deviation; read before any M2 work touching plan data.
- [Dashboard v2 M2 architecture](project_dashboard_v2_m2.md) — metrics.js/coach.js/worker.js `/coach` API surface, render-slot pattern for daily+weekly coach text, deliberate deviations (Wochen-Tab tap behavior, kraft-status simplification, "·" in the worker whitelist); read before touching Ampeln/Coach/Wochen-Tab code.
