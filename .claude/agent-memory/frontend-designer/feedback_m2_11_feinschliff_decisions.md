---
name: feedback-m2-11-feinschliff-decisions
description: Decisions from the M2-11 polish pass (2026-10-02) — 44px touch-target floor retrofit, day-row interaction-affordance fix after the accordion refactor, and the em-dash rule's actual scope
metadata:
  type: feedback
---

**The ≥44px touch-target floor applies retroactively, not just to new markup.** Two
buttons shipped in the original D0 pass (28.09.2026) — `.start-btn` ("Starten" on the
Dashboard's Heute-dran card) and `.bilanz-toggle` (Wochenbilanz collapse toggle) — had
`min-height: 36px`, under the floor. Nobody flagged it in run-verifier/reviewer because
those checks were functional (keyboard reachability, aria-expanded), not geometric. Found
only during the explicit "Prüf ... Touch-Ziele ≥44px" instruction in M2-11. Bumped both to
44px. Lesson: a component passing keyboard/functional checks does not mean it passes the
tap-target-size floor — check both separately, and re-check the whole component surface
(not just newly-added elements) whenever a task explicitly asks for a touch-target pass.

**When a row/card stops being a single `<button>` and becomes a container with nested
interactive sub-elements (the Wochen-tab's day-row accordion refactor: row → `.day-toggle`
+ `.day-open` as two separate buttons), audit the row's own CSS for now-dead
button-era rules.** Found `.day-row:focus-visible` still present after the refactor —
`.day-row` is a plain `<div>` now and never receives focus, so the rule was inert. Also
confirmed `.day-row.solid { cursor: default }` already correctly overrode the base
`.day-row { cursor: pointer }`, so the "whole row looks clickable" trap was already
avoided by whoever did the refactor — don't assume it wasn't, grep the actual rule
cascade before re-fixing something already fixed. Added real affordance to the part that
actually is interactive now: `.day-toggle:hover` background tint, and a chevron icon on
`.day-open` matching the existing `.ex-row` "navigate to a day view" icon convention
elsewhere in the same app (reuse an existing interaction pattern instead of inventing a
new one when the destination/action is the same — "navigate to day view").

**The "no em dash in visible copy" rule ([[feedback_soll_ist_bars_and_copy]]) is a
standing rule for this app, but when asked to do a scoped M2-11-style pass, only fixed
instances inside the Dashboard v2 feature surface being touched** (coach.js fallback
text, view-dashboard.js, view-week.js, and the one app.js duplicate of a Dashboard-v2
string) and explicitly flagged — rather than silently fixing — four older pre-existing
M1-era instances found by the same grep sweep (`app.js`: "Details folgen" placeholder
card, Kraft-day save-blocked hint, Lauf-day strava-note, Plan-tab phase label). Rationale:
those predate the dashboard-v2 initiative, were never flagged by any prior review, and a
silent app-wide copy sweep during a styling-focused milestone risks surprising Louis with
unrelated diffs. If a full app-wide em-dash sweep is ever wanted, it should be its own
explicit ask, not a side effect of a Dashboard-v2 finishing pass. Before changing any
copy that repeats an em-dash-adjacent string, grep `tests/*.test.mjs` for exact-match or
`.includes()` dependencies on the old wording first — found zero in this pass, all
assertions used keyword regexes or unrelated substrings, confirming text-only edits were
safe here.

**New small utility classes are fine in this codebase when reused ≥2× and the
reviewer explicitly suggested the pattern** (`docs/review-code-m2.md` Minor M5 suggested
".mt-8 o. ä."). Added exactly two, `.mt-6`/`.mt-8`, nothing broader — this app's `style.css`
otherwise strongly prefers semantic/component classes over a utility-class layer, so keep
any future utility additions to the same narrow, reviewer-sanctioned scope rather than
starting a parallel utility system.
