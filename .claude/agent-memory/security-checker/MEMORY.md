# Memory Index

- [Rendering & escaping conventions](approved_escaping_pattern.md) — app.js's `esc()` helper covers `&<>"'`; all plan/session/exercise text must go through it before `innerHTML`
- [Plan loading trust boundary](approved_plan_loading.md) — plan-store.js fetch path/id are fixed constants, never user input; localStorage copy is re-validated with validatePlan(), not just schemaVersion
- [Coach worker security pattern](approved_coach_worker_pattern.md) — worker.js /coach's accepted prompt-injection/cost-abuse baseline (whitelist, fixed prompt/model, body limit, no upstream-detail leaks) — diff future worker.js changes against this
- project_public_repo_firestore_vuln.md — nur lokal (gitignored); Status 02.10.2026: Exploit-Docs bereits auf öffentlichem origin/main (seit M1-Merge), Push-Timing-Frage damit erledigt, offen bleibt nur Schritt 1b selbst
