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

**Coverage note:** `tests/app.test.mjs` (225 checks as of 2026-09-29, M2) is thorough but
still doesn't explicitly exercise: the full Wochen-Tab placeholder-week text (9/31), the
5-viewport x light/dark layout matrix, or opening all 4 info-sheets + Aerobe Effizienz in
sequence (only "kraft" is covered). Check before writing a redundant one-off script.

**Known real bug found 2026-09-29 (M2 run-verifier pass, still open at handoff):**
`ui.js` `openInfo()`/`closeInfo()` (info-sheet, D1) has a stale-`setTimeout` race: closing
a sheet schedules `sheet.hidden = true` after 200ms; if a *different* info-sheet is opened
within that window, `closeInfo()`'s `if (sheet.hidden) return;` guard later reads a stale
`hidden` flag and silently no-ops, leaving the sheet permanently un-closeable (Escape and
the × button stop working until full reload) even though visually it may look closed.
Reproducible by opening/closing two different `[data-info]` buttons back-to-back with no
delay (real users tapping through the 4 ampel info buttons quickly will hit this). Minimal
fix direction: track the pending timeout id in a module variable and `clearTimeout` it at
the top of both `openInfo()` and `closeInfo()` before scheduling a new one, instead of
trusting `sheet.hidden` as the sole guard. Did not fix this myself (out of scope for
run-verifier) — routed to debugger via the correction loop instead of checking off M2 step 8.

**Test-data gotcha:** kraft log fixtures must use the exercise's *own* slug for that
specific session (`slug(name)` from `plan.js`, e.g. "squats"/"deadlift" only exist in
"Full Body A", not "Full Body B" — check `plans/hm-2027.json` per date before seeding
`test.logs`, otherwise `done` silently stays 0 and status logic looks broken when it isn't.

**Desktop-width layout is intentionally phone-width-capped**, not a bug or a fluid-
responsive violation: at 1280px the app renders a centered ~390-430px column with empty
margin on both sides (matches `docs/mockup-dashboard-v2.html`'s own "Handy-Schale" framing
comment). No horizontal scroll, no clipping — confirmed via `clientHeight>=scrollHeight`
checks on `#main` children and `.day-row` across 390x844/390x640/768x1000/1280x720/1280x900
x light/dark (10 combos, all green). Don't flag the narrow desktop column as a deviation.
