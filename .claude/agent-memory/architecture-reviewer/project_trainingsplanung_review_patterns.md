---
name: trainingsplanung-review-patterns
description: Recurring architecture risks in apps/trainingsplanung (key-bearing slugs/dates, no service worker, public worker URL, alias-vs-snapshot misconception) found in Dashboard v2 review 2026-09-27
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
