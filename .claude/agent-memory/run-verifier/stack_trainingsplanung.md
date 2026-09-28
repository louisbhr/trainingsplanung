---
name: stack-trainingsplanung
description: trainingsplanung is a static vanilla-JS site (no build step) — how to boot-verify it
metadata:
  type: project
---

`apps/trainingsplanung` is a static Vanilla-JS PWA, no bundler/build step. Own repo,
branch conventions matter (e.g. `dashboard-v2-m1` — never switch/push without being told).

**Boot-verify sequence:**
- No `npm run build` — skip straight to boot.
- `npm run serve` starts `http-server -p 8099 -s .` (serves repo root as-is).
- `npm test` runs the whole Node+Playwright suite in one go (`plan`, `plan-golden`,
  `runmatch`, `progression`, `version`, `stubs`, then `app.test.mjs` which drives real
  Chromium via Playwright, already installed in `node_modules`).
- `tests/app.test.mjs` already stubs `firebase-init.js` (via `ctx.route` intercepting the
  import) and Strava's REST API with fixed fixtures — no real accounts are ever hit. Reuse
  this pattern (stub `firebase-init.js` import via route interception, stub
  `strava.com/api/v3/athlete/activities`) for any extra one-off Playwright script.
- Plan data lives in `plans/hm-2027.json`, loaded by `plan-store.js` via
  `fetch(new URL("./plans/hm-2027.json?v=<stempel>", import.meta.url), {cache:"no-cache"})`
  with a `localStorage` copy as fallback (key `hm-tracker.plan.<id>`). `tools/bump-version.mjs`
  + `tests/version.test.mjs` keep the `?v=` stamp consistent across all module imports and
  the JSON URL.

**Gotcha:** Playwright/Node ESM `import "playwright"` only resolves relative to the
importing file's own directory (NODE_PATH does not help with ESM resolution) — a
one-off verification script needs to be run from inside the app directory (e.g. copy it
in temporarily, run, then delete) or from a path where `node_modules/playwright` is
resolvable, rather than from an arbitrary tmp job directory.

**Coverage note:** `tests/app.test.mjs` (151 checks as of 2026-09-27) is thorough but
didn't (as of M1) explicitly exercise: week-nav across weeks 4/8/9/31, a Ruhetag or
Platzhaltertag (week 9+) day view, or the 1280px desktop width. Worth checking if a
future coder pass added these before writing a redundant one-off script.
