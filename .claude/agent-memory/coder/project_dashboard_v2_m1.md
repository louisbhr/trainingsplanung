---
name: project-dashboard-v2-m1
description: M1 (Plan als JSON) architecture and API surface for trainingsplanung's Dashboard v2 — read before any M2 work that touches plan.js, plan-store.js, or app.js's plan access.
metadata:
  type: project
---

M1 of "Dashboard v2" (docs/plan-dashboard-v2.md) is implemented and committed
on branch `dashboard-v2-m1` (733f2f6..70621a2), and has been through code-review
round 1 (docs/review-code-m1.md, fixes in 065b55b..a74f6fa) — 1 critical (K1),
3 important (I1-I3), 1 spec deviation (S1), 6 minors fixed except M1 and M5
(see below). Still pending: re-review round 2, security-checker, Louis's
manual test. It moved plan data out of `plan.js` into `plans/hm-2027.json`,
keeping `plan.js` as pure logic. This is the foundation M2 (metrics.js,
coach.js, Dashboard, Wochen-Tab) builds on.

**Deferred to later on purpose (do not re-flag as a gap):**
- `validatePlan` doesn't yet check the *shape* of `week.sessions[]` entries
  (`kind` ∈ {kraft,lauf}, non-empty `exercises`, `km` numeric and matching
  `parseFloat(dist)`) — explicitly deferred until weeks 9–31 are written
  (starting 26.10.2026), so it validates real content instead of a guess.
- The `bisZumRennen`/`keinPlan` cards in app.js copy the rest-day card's
  inline `style` (matches the existing pattern in that file) — frontend-designer
  moves these to CSS classes as part of D0/M2, not the coder's job.
- Async-loading footgun worth remembering for any future `init()` refactor:
  everything that touches the awaited result must live *inside* the same
  `try` block, not just after it — code after `await` outside try/catch
  becomes an unhandled rejection, not a caught error. This bit M1 once
  (`state.weekNo` etc. were originally set after the try/catch) and was
  caught by review as K1, not by original testing — the browser test suite
  didn't exercise "fetch fails AND cache is invalid" until review demanded it.

**Why:** the hard deadline is 26.10.2026, when weeks 9–31 start getting
written into the plan data — that had to land as JSON, not hardcoded JS, and
the switch had to be behavior-preserving so it could ship to `main` early
and independently of the Dashboard/Coach work.

**How to apply — API surface added in M1 (all in plan.js unless noted):**
- Every accessor takes the plan object as an explicit parameter — no more
  module-level constants (`PLAN_START`, `TOTAL_WEEKS`, `weeks`, `goal`,
  `zones`, `phases` are gone from plan.js). `weekStart(plan,w)`,
  `weekDates(plan,w)`, `weekOf(plan,n)`, `weekNumberFor(plan,iso)` (→ `null`
  outside the plan, no more silent clamping to 1..31), `phaseOf(plan,weekNo)`,
  `phaseRange(plan,phase)` (derives the old hardcoded date-range strings —
  verified to match exactly), `planEnd(plan)`, `sessionsFor(plan,weekNo)`,
  `sessionOn(plan,iso)`, `exerciseCatalog(plan)`, `formatGoal(goal)`,
  `validatePlan(plan)`. `slug()` moved here from app.js character-for-character
  (log IDs `logs/{date}_{slug}` depend on it — never change it without
  re-running the golden test).
- Plan registry (F0a #4): `activePlanFor(iso, plans)` and
  `planDayState(iso, plans)` → `"woche" | "bisZumRennen" | "keinPlan"`. A
  plan is "active" for a date from `plan.start` through
  `max(planEnd(plan), goal.raceDate)` — this covers the gap between the last
  planned week and race day even when `raceDateConfirmed` is false.
- `plan-store.js` is the only place that fetches/caches the plan: URL via
  `new URL("./plans/hm-2027.json?v=STAMP", import.meta.url)`,
  `fetch(..., {cache:"no-cache"})`, `validatePlan`, then a `localStorage`
  copy (key `hm-tracker.plan.<id>`, keyed on matching `schemaVersion`).
  Throws `PlanLoadError` (source `"plan"`) only when *both* the fetch and the
  cache fail — that's the one case that should render a blocking error card;
  a fetch failure with a valid cache is just a toast ("Plan aus letzter
  Kopie").
- `app.js` loads the plan asynchronously in `init()` — nothing in the module
  top level touches plan data anymore (`state.weekNo`,
  `defaultHistoryExercise()`, `STRAVA_SINCE` are all set post-load). `render()`
  no-ops if `plans` is still empty, to survive a stray click during the
  fetch. Wochen-Tab and Plan-Tab (untouched UI in M1) deliberately still read
  `plans[0]` rather than resolving a plan per date — correct today (exactly
  one plan) but will need `activePlanFor` wiring whenever a second plan
  (Schritt 2, ~April 2028) exists.
- Week-type label rule (F2, requirements doc): `"Entlastung"` on deload weeks
  (4, 8), else `"Aufbau"` for any week in phase 1 (phase 1 is *named* "Basis"
  but its non-deload weeks display as "Aufbau"), else the phase's own name
  from phase 2 onward. Easy to get wrong by assuming weekType === phase.name.
- `plans/hm-2027.json` schema: `week.sessions[]` (not `week.runs`/`kraft.di/do`
  anymore), `phases[].weeks` is `{from,to}` (not `[from,to]`) — Firestore
  can't store arrays-of-arrays, `validatePlan` checks this generically.
  `goal.raceDateConfirmed: false` today; `formatGoal()` shows "ca. Mitte
  April 2027" instead of the old hardcoded "Anfang/Mitte April 2027" — this
  is the one approved, deliberate visible text change for M1 (everything
  else — phase ranges, timeline, zones — is pixel/text-identical to before).
- Golden test (`tests/plan-golden.test.mjs`, A2): compares every day
  2026-08-24..2026-10-31 between the new plan.js/JSON and the frozen
  `tests/fixtures/plan-legacy.mjs` (verbatim copy of the pre-M1 plan.js).
  Keep this file until M2 is done (it's the safety net for the exact period
  the refactor touches); it's explicitly scheduled for removal/keep-decision
  at M2-11.
- Stub guard (`tests/stubs.test.mjs`, A9): compares every name any browser
  module imports from `config.js`/`firebase-init.js` against every
  `export ...` name found anywhere in `tests/app.test.mjs` (the Playwright
  stub literals). Extend `config.js` in M2 (THRESHOLDS, WORKER_URL,
  COACH_URL) and this test will catch a forgotten stub update.

See also `docs/plan-dashboard-v2.md` (the M1/M2 plan) and
`docs/review-architecture-dashboard-v2.md` (A1–A10 rationale) for the full
detail — this memory is a map to the code, not a replacement for those docs.
