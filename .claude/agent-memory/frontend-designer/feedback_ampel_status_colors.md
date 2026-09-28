---
name: feedback-ampel-status-colors
description: trainingsplanung's palette has no true semantic red/green for traffic-light (Ampel) status — added --ok-fg/--danger-fg tokens and shape+color redundancy for the dashboard-v2 mockup
metadata:
  type: feedback
---

When building status "Ampel" (traffic-light) UI for trainingsplanung — grün/gelb/
rot/grau — do not reuse the category colors (`--teal`, `--coral`, `--purple`) as status
colors: those already mean Kraft/Lauf/Long Run and reusing them for status would
collide visually and semantically (e.g. a red Ampel next to a coral "Lauf" card reads
as related when it isn't).

**What I did in `docs/mockup-dashboard-v2.html`:**
- Reused the existing `--amber-fg`/`--amber-bg` tokens for gelb (already theme-aware,
  already used for phase/zone tone elsewhere in the app).
- Added new tokens `--ok-fg`/`--ok-bg` (green) and `--danger-fg`/`--danger-bg` (red),
  light + dark variants, since neither existed in `style.css` yet.
- Gave each Ampel-dot a distinct *shape* as well as color (circle = grün, diamond =
  gelb, square = rot, outlined ring = grau) so status isn't conveyed by color alone —
  a colorblind-safe touch beyond what the requirements doc asked for.

**Why:** see [[project_trainingsplanung_tokens]] — the app's palette predates any
status/traffic-light UI; the four-Ampel dashboard (`requirements-dashboard-v2.md`,
F5) is the first feature that needs true semantic status colors.

**How to apply:** if `--ok-fg`/`--danger-fg` get promoted into the real `style.css`
during implementation (coder/planner step), keep using them for any future
status/severity UI in this app instead of inventing another pair.

**Confirmed by Louis (2026-09-27):** explicitly signed off on both the new red/green
palette and the dot-shape redundancy ("Entschieden, so lassen") after reviewing the
mockup — keep both as-is in later iterations, no need to re-litigate or offer
alternatives unless he raises it again.
