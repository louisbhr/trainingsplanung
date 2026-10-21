---
name: stride-e0-decisions
description: Stride redesign E0 mockup (docs/mockup-stride-luecken.html + docs/ui-markup-stride.md) - class prefix sd-, stepper unit below value, other design calls for E1-E9
metadata:
  type: project
---

Stride (trainingsplanung redesign, branch stride-redesign) E0 delivered 2026-10-21: gap-state
mockup plus markup base doc. Handoff `design_handoff_stride/README.md` is binding.

- **Class prefix `sd-`** (BEM-ish `sd-card__top`, `sd-card--danger`, states `is-*`). **Why:** old
  screens keep running on the same style.css until each is replaced (plan E1-E8), so reused names
  like `.card`/`.badge` would collide. Dynamic geometry only via unitless custom properties
  (`--pct`, `--from`, `--to`, `--at`), per review condition C5.
- **Stepper unit sits below the value** (11px), steppers in a flex-wrap row so they stack on their
  own at 320px. **Why:** prototype's inline unit overflows at 390px for "62,5 kg" / "15 Wdh".
- **Open sets use --text-secondary**, not --ink-faint (about 1.8:1 in the prototype).
- **Mockup is built from `<div class="spec">` templates cloned by a tiny inline script** into
  light/dark x 390/320 frames; tab bar and mark are script-filled. Needs JS, renders via file://.
- `container-type: inline-size` only on #main/#header (never #app): it breaks position:fixed tab bar.
- Open spec ambiguities I resolved: "+ Gewicht" lives in the active-set head; edit-mode is its own
  view with "Fertig" top right; Platzhalter-Heute card has no button; Kein-Zugriff uses a teal
  primary "Abmelden". Muted text (#8a897f) is ~3.5:1 on white, spec-bound, flagged not changed.
- Not browser-verified (no browser in the agent); orchestrator screenshots with Playwright.

See [[project_trainingsplanung_tokens]] and [[feedback_soll_ist_bars_and_copy]] (no em dashes).
