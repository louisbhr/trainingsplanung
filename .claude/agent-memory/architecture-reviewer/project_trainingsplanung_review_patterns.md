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
