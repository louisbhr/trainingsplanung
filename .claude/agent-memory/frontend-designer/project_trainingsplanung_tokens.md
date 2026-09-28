---
name: project-trainingsplanung-tokens
description: trainingsplanung app is a vanilla-JS PWA (Halbmarathon-Tracker); its real design tokens live in style.css and must be reused, not reinvented
metadata:
  type: project
---

`apps/trainingsplanung` is a German-language, vanilla-JS PWA (no build step, no
framework) — a half-marathon training tracker. It is NOT a React/Tailwind app; styling
work here means editing `style.css` directly and building markup that matches the
patterns in `app.js` (`#header`/`#main`/`#tabbar`, `.card`, inline-SVG `ICONS` map).

**Real tokens (`apps/trainingsplanung/style.css`), already dark-mode aware via
`prefers-color-scheme`:**
- Category colors: `--teal`/`--teal-bg` = Kraft, `--coral`/`--coral-bg` = Lauf,
  `--purple`/`--purple-bg` = Long Run **and** Coach. `--sky`, `--amber` are phase/zone
  tones (`.tone-*` classes set `--tone`/`--tone-bg` custom props consumed by
  `.badge`, `.phase-card`, etc.).
- Surfaces: `--surface-0/1/2`, text: `--text-primary/secondary/muted`, `--border`.
- Glass tab bar (`#tabbar`) uses `--glass`/`--glass-edge`/`--glass-tint` +
  `backdrop-filter: blur(22px) saturate(180%)`, with a `@supports` fallback.
- No pre-existing semantic "status" red/green existed before the dashboard-v2 mockup —
  see [[feedback_ampel_status_colors]] for the addition made to cover that gap.

**Design reference chain for dashboard v2 (as of 2026-09-24):**
- `apps/trainingsplanung/docs/requirements-dashboard-v2.md` — the discovery draft
  (ENTWURF) driving the new dashboard; explicitly gates on mockup approval before the
  requirements doc is finalized.
- `apps/trainingsplanung/docs/mockup-dashboard-v2.html` — the standalone mockup built
  from that draft (six scenario states + Woche-tab), delivered for Louis's approval.
- `/Users/louisbehre/Desktop/mockup-v3.html` (outside the repo, on Louis's Desktop) —
  the previously-approved v3 visual language (card style, ampel dots, week-tab list)
  that v2 explicitly builds on. Worth re-reading if asked to iterate on this dashboard
  again, since it is not checked into git.

Plan data (weeks, phases, zones, deload weeks 4 & 8) lives in `plan.js` — use it as the
source of realistic example numbers in any future mockup rather than inventing figures.
