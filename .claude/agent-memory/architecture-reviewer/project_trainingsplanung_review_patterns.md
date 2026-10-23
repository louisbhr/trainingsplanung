---
name: trainingsplanung-review-patterns
description: Recurring architecture risks in apps/trainingsplanung (key-bearing slugs/dates, no SW, public worker URL, alias misconception, same-origin Pages storage, worker passes Strava status through, AUTH_MODE rollout) from Dashboard v2 (2026-09-27) and Login 1b (2026-10-03) reviews
metadata:
  type: project
---

Findings from reviewing Dashboard v2 (docs/review-architecture-dashboard-v2.md, 2026-09-27):

- Firestore doc IDs are key-bearing: `logs/{date}_{slug(exerciseName)}`, `dayplans/{date}`, `runlinks/{date}`.
  **Why:** renaming an exercise or changing slug() silently orphans real logs. **How to apply:** any
  plan-data refactor needs a day-by-day golden test incl. slug identity, kept until the refactor is done.
- No service worker; offline cold start never worked. Flaky-network partial loads are the real risk
  once plan data moves to a fetched JSON. **How to apply:** demand a last-good local copy.
- Worker URL is public (public repo); Origin checks are spoofable; until step 1b (real login) the
  Console spend limit is the only hard cap. Recommend a dedicated workspace/key per app.
- Planners tend to claim the model alias "survives snapshot retirement" — wrong: alias and snapshot
  are the same model and retire together. Verify via claude-api skill each time.
- Two DST switches fall inside the HM plan (2026-10-25, 2027-03-28); window math must be ISO/addDays.
- Visual plan was skipped for this review (text + approved mockup sufficed). See [[visual-plan-fidelity]].

Findings from Login 1b (docs/review-architecture-login-1b.md, 2026-10-03):

- Everything under louisbhr.github.io shares ONE origin: any extra page (spike/, test pages) using the
  default Firebase app shares the live app's auth session + Firestore cache. **How to apply:** demand
  `initializeApp(cfg, "<name>")` for side pages; never let them read credential docs.
- worker.js /exchange and /refresh pass Strava's HTTP status through, so a bare 401 is ambiguous.
  **How to apply:** worker auth errors need a distinct `error` field; client retries only on that.
- Header/CORS contract changes between Worker and Pages: planners accept a "few minutes" outage.
  Preferred pattern: AUTH_MODE var in wrangler.toml [vars] (report → required, missing = required).
- Firestore pending writes are per-user; switching users strands them. Use waitForPendingWrites
  with a timeout before any sign-out, never only a manual "open once with network" step.
- Planner referenced a non-existent `checkAccess` hook in worker.js — verify named hooks exist.
- Plan/MCP visual-plan tools were not available in the subagent for either review.

Findings from Stride redesign (docs/review-architecture-stride.md, 2026-10-21):

- Anything copied under docs/ is served by Pages on the app origin. Handoff prototypes
  (*.dc.html + support.js) pull React/Babel from unpkg + Google Fonts. **How to apply:** for
  third-party-loading reference files, recommend storing them inert (.txt) and check every new docs/ asset for external scripts.
- Kraft data facts: time exercises store seconds in `reps` (progression.js timeBased); legacy logs can
  have `kg: 0` (numOrNull("0")); 0 and null are read the same everywhere (`> 0` checks). Stepper UIs
  prefill values, so partial saves must write only the sets that were actually done.
- "Clean up other-date keys on open" patterns delete live drafts when Louis backfills past days
  from the week tab. Prune by age instead.
- bump-version.mjs stamps only index.html assets + JS imports, never CSS url(). Versioned filenames are the
  fix; also demand a test that every url() in style.css exists.
- config.js stub in app.test.mjs is a literal; stubs.test checks names only, not shape → derive THRESHOLDS from real config.
Findings from Delete-day (docs/review-architecture-delete-day.md, 2026-10-23):

- `allLogs ? Promise.resolve(allLogs) : load()` inside Promise.all then `allLogs = logs` re-assigns a
  captured stale array (ensureAllLogsAndDayPlans, renderKraftDay). **How to apply:** any feature that
  replaces allLogs in memory needs `allLogs = allLogs ?? logs`.
- Test firebase stub runs delayed writes out of order (Firestore queue is ordered) — demand a serialized
  write chain in the stub for save/delete interplay tests.
- Optimistic ops (SAVE_OPTIMISTIC_MS): data-side effects must apply regardless of gen; only view parts gate
  on kraftGen. Late rollbacks need a reference-identity guard. render() only closes assignSheet.
- Main keeps moving with plan re-calibrations (28.10, 22.11). Those also touch plan-golden/app tests, not just
  JSON. Demand merging main into the branch right away + plan-independent fixtures for placeholder-week tests.
