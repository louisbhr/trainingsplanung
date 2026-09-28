# Memory Index

- [Rendering & escaping conventions](approved_escaping_pattern.md) — app.js's `esc()` helper covers `&<>"'`; all plan/session/exercise text must go through it before `innerHTML`
- [Plan loading trust boundary](approved_plan_loading.md) — plan-store.js fetch path/id are fixed constants, never user input; localStorage copy is re-validated with validatePlan(), not just schemaVersion
- project_public_repo_firestore_vuln.md — nur lokal (gitignored), Details zur offenen Regel-Lücke bis 1b
