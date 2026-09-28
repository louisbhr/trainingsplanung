---
name: trainingsplanung-planning-constraints
description: Non-obvious constraints for planning work in apps/trainingsplanung (flat modules due to version stamping, test stubs, visual-plan tooling unavailable in planner subagent)
metadata:
  type: project
---

Planning constraints learned while planning Dashboard v2 (2026-09-27, docs/plan-dashboard-v2.md):

- Browser modules must stay flat in the repo root. **Why:** tools/bump-version.mjs only stamps
  `./name.js` imports and tests/version.test.mjs discovers modules via readdirSync(root).
  **How to apply:** propose `view-*.js` style flat files, not subfolders; every new module goes
  into the MODULES list; fetched JSON URLs need their own stamp rule.
- tests/app.test.mjs replaces firebase-init.js and config.js with inline stubs. **Why:** any new
  export missing from the stub breaks module import and turns ALL browser tests red.
  **How to apply:** every plan that adds exports there must include a stub-update step.
- Louis chose "plan in three stages into the DB" (JSON file → Firestore in 1b → versioned in step 2);
  plan-store.js is the intended single swap point.
- The Plan MCP tools (visual-plan publishing) were not exposed to the planner subagent on
  2026-09-27. **How to apply:** write the text plan to docs/, note in .pipeline-state.md that
  publishing is pending, and let the orchestrator/architecture-reviewer publish. See
  [[visual-plan-fidelity]].
- Claude API check via claude-api skill (cache 2026-06-24): Haiku 4.5 active, alias
  `claude-haiku-4-5`, snapshot `claude-haiku-4-5-20251001`, `anthropic-version: 2023-06-01`.
  Re-verify before relying on it later.
