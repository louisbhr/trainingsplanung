---
name: project-dashboard-v2-m2
description: M2 (Dashboard, Ampeln, Im Detail, Wochen-Tab, Coach) architecture and API surface for trainingsplanung's Dashboard v2 — read before touching metrics.js, coach.js, worker.js /coach, view-dashboard.js, view-week.js, or app.js's Dashboard rendering.
metadata:
  type: project
---

M2 of "Dashboard v2" (docs/plan-dashboard-v2.md, M2-3 through M2-10) is
implemented and committed on branch `dashboard-v2-m2` (d6fe916..a832cc7),
one commit per package (M2-3..M2-10), each with `npm test` green before
committing. Builds on M1 (see [[project-dashboard-v2-m1]]). Still pending
at hand-off: M2-11 (frontend-designer polish pass, then coder), then
run-verifier/test-runner/reviewer/security-checker/Louis' manual
test/deploy of `/coach` (E2, not yet deployed — no secrets set).

**Why:** turns the Dashboard skeleton from M2-4 into the full feature set
(real ampeln, detail cards, rewritten Wochen-Tab, AI coach with rule-based
fallback) while keeping every M1 test green and never regressing the
existing Tagesansicht/Verlauf/Plan tabs.

**How to apply — new modules and their API surface:**
- `metrics.js` (pure, no Firebase): `wochensoll`, `easyDisziplin`,
  `belastung`, `kraftProgression`, `adherence4w`, `aerobeEffizienz`,
  `weeklyVolume`, `worstStatus`. All take `THRESHOLDS` (from `config.js`)
  as an explicit parameter. `belastung`/`wochensoll`/`easyDisziplin` take
  the full `THRESHOLDS` object (read `THRESHOLDS.belastung.*` etc.
  internally); `kraftProgression` also takes the full `THRESHOLDS` object
  now (reads `THRESHOLDS.kraft.*` internally) — don't pass the `.kraft`
  slice directly, that was a bug caught by the unit tests during M2-3.
  Time windows go through `plan.js`'s `addDays` (never
  `Date.now() - n*86400000`) — verified against the two DST transitions
  in the plan (25.10.2026, 28.03.2027).
- `coach.js` (pure, no Firebase/browser): `buildDailyInput`,
  `buildWeeklyInput`, `hashInput` (canonical-JSON + SHA-256 via
  `crypto.subtle`, key-order-independent), `decideGeneration` (reuse/call/
  limited), `fallbackDaily`/`fallbackWeekly`, `weeklyDue`, `requestCoach`
  (orchestrates Firestore cache + worker call via **injected**
  `loadDoc`/`saveDoc`/`fetchWorker` functions — this is what keeps it
  testable without Firebase/DOM). `generations` is counted and written
  **before** the API call (A4) — `requestCoach` handles this, callers
  never touch `generations` directly.
- `worker.js` `/coach`: routed **before** the Strava-secret check (else a
  worker without Strava secrets always 500s). Model is one constant
  (`claude-haiku-4-5`), full schema validation for `kind: "daily"|"weekly"`
  with a character whitelist for free-text fields — **the whitelist
  includes `·` (middle dot, U+00B7)** because the client uses it
  everywhere as a visual separator (`"14 / 29 km · Kraft 0/2"`); forgetting
  it makes the worker reject the app's own normal values, not just
  attacker input. `/coach` rejects **every** origin when `ALLOWED_ORIGINS`
  is empty — this is the opposite of `/exchange`/`/refresh`, which stay
  open when it's empty (unchanged M1 behavior). Not deployed yet (E2).
- `view-dashboard.js` / `view-week.js`: pure render-to-HTML-string
  functions only, no state, no DOM reads — app.js owns all state and
  wires clicks. `view-dashboard.js` imports `formatDuration` from
  `strava.js` (only cross-import among the view modules).
- **Coach render-slot gotcha:** the daily coach text and the weekly
  Wochenbilanz are two independent async chains (`fillCoach` /
  `fillWeeklyBilanz` in app.js) that both need to write into the same
  `#coach-slot`. Neither writes the DOM directly — both go through
  `renderCoachSlot()`, which reads two module-level caches
  (`coachDailyText`, `coachBilanzInfo`) and renders the combined result.
  Writing either slot directly from one of the two async functions would
  let whichever settles second silently wipe out the other's content —
  this is the coach-specific version of the M1 async-init footgun (see
  [[project-dashboard-v2-m1]]).
- **Ampel/detail/coach data reuse:** `fillAmpeln`, `fillDetail`, and
  `fillCoach`/`fillWeeklyBilanz` each independently call
  `ensureAllLogsAndDayPlans()` and `computeRealAmpeln(...)` — these are
  cheap/idempotent (module-level caches for `allLogs`/`allDayPlans`,
  `loadStrava()` has its own 5-min cache), so the duplication is a
  deliberate simplicity-over-micro-optimization trade, not an oversight.

**Deliberate deviations from the plan/markup docs (do not re-flag as
gaps):**
- Wochen-Tab day rows (`view-week.js`) are a **single tap directly into
  the Tagesansicht**, not the markup doc's proposed toggle-to-expand-then-
  tap-again pattern. The toggle version would have required rewiring
  nearly every existing `[data-date="…"]` click across the whole test
  suite for a pure interaction nuance; direct-tap keeps 100% of the old
  Wochen-Tab test coverage valid. All the required visual content (status
  icons, Ist/Ziel line, "nachgeholt" hint) is inline in the row itself, no
  accordion needed.
- Wochenbilanz kraft-progression status is simplified to
  `steigt|stagniert|unterSoll` — `metrics.kraftProgression`'s per-exercise
  classification only distinguishes `ok`/`stagniert`/`unterSoll` (that's
  all the ampel needs); `ok` is reported to the worker as `"steigt"`
  rather than adding a real `haelt` vs `steigt` distinction. Documented at
  the `weeklyKraftData()` call site in app.js.
- Dashboard's lauf "Heute dran" card, once Strava resolves as
  **not connected**, keeps showing the "wird geladen" loading hint forever
  rather than a dedicated "nicht verbunden" message — minor known gap, not
  fixed in M2 (worth a look in M2-11 polish).
- `adherence4w`/aerobe-effizienz/wochenvolumen all read `runAssignment`,
  which is only populated once `loadStrava()` has resolved with a
  connected account — before that (or if never connected) these read as
  empty/zero, which is correct grau-adjacent behavior, not a bug.

See also `docs/plan-dashboard-v2.md` (M2-3..M2-10 acceptance criteria) and
`docs/review-architecture-dashboard-v2.md` (A1–A10) — this memory maps to
the code, it doesn't replace those docs.

**Update after Code-Review M2 Runde 1 → Korrekturrunde 2 (docs/review-code-m2.md),
02.10.2026 — fixed K1/K2/I1/I2/I3/I5 + I4 "jetzt":**
- `metrics.kraftHistoryByExercise` moved here from app.js (was unexported,
  untestable without a browser) — same signature `(logs, iso, windowDays)`,
  same Deload-/Zeitbasiert-/topKg-Filterung. Callers in app.js now say
  `metrics.kraftHistoryByExercise(...)`, not a bare local call.
- `metrics.easyDisziplin`/`metrics.belastung` now genuinely read
  `THRESHOLDS.easy.gelbMaxOver` / `THRESHOLDS.belastung.minHistoryDays`
  (used to be hardcoded `8` / `-27`) — any test THRESHOLDS fixture must
  include both or these two functions throw/misbehave.
- `metrics.belastung()` never returns `ratio: Infinity` or a detail
  containing "∞" anymore — an unendliches Verhältnis is `ratio: null` +
  `"Verhältnis über 9,99"` (JSON-safe, worker-whitelist-safe). Callers that
  need a finite number for the worker body (weekly `belastung.ratio`) do
  `ratio ?? 9.99`, not `?? 0` — 0 would misrepresent a genuinely very high
  load as low.
- `app.js` has one `kraftProgressOn(session, dp, logs) → {exercises,
  withLogs, done, total, complete}` helper now — this is THE "ist die
  Krafteinheit komplett geloggt" check, used by `computeRealAmpeln`,
  `adherence4wData`, `fillCoach`, `weeklyKraftData`, `buildWeekDayRow`,
  `renderWeek`. Don't reintroduce a seventh inline copy; extend this
  function instead (e.g. for 1b's "eigene Übungen" edge cases).
- `ensureAllLogsAndDayPlans()` **never throws** anymore — it returns
  `{ logs, dps, ok }`, where `ok:false` means Firestore failed and
  `logs:[]`/`dps:{}` are safe empty fallbacks, not real data. Every caller
  must branch on `ok` if it cares about showing a "nicht geladen" state
  instead of silently treating empty data as "nothing done" — see
  `computeRealAmpeln`'s `logsOk` param and `fillCoach`'s early return.
- New `stravaReady()` (`connected === true && Array.isArray(runs) &&
  !error`) and `stravaUnavailableDetail()` — `stravaState.connected` alone
  is NOT enough to know Strava data is usable (a failed `fetchRecentRuns`
  leaves `connected: true` but `runs: null`). Any new code reading
  `stravaState.runs` for ampel/coach/bilanz purposes should gate on
  `stravaReady()`, not `stravaState.connected`.
- `loadStrava()` now dedupes concurrent non-`force` calls via a
  module-level `stravaLoading` promise — `paintDashboardMain`'s five
  parallel `fill*` calls share one real fetch. `{force:true}` (manual
  refresh) always bypasses this.
- `coach.decideGeneration(doc, hash, limit)` now requires `doc.text` to be
  truthy for `"reuse"`, not just a matching `inputHash` — `requestCoach()`
  writes **only** `{generations, attemptAt, model, promptVersion}` before
  the worker call (no `inputHash`/`text`), so a failed attempt can't be
  mistaken for a valid cache hit with an empty text on the next load. If
  you touch `requestCoach`/`decideGeneration` again, preserve this
  invariant — it's the fix for a critical bug (K2) where the coach card
  hung in the placeholder forever after one worker failure.
