---
name: project-stride-redesign
description: Stride rename/logo/mobile redesign of trainingsplanung (started 2026-10-20) — handoff is binding spec, key gaps vs. existing features
metadata:
  type: project
---

Started 2026-10-20: the app is renamed "Stride" (from "Halbmarathon Tracker"), with a new logo and a high-fidelity mobile redesign from an external design handoff (Desktop/design_handoff_stride/README.md; prototype variants Kraft-Tag B and Lauf-Tag B are the valid ones). Requirements: docs/requirements-stride.md.

**Why:** Louis got a finished design handoff. Fidelity is final, and business logic, data model, Firebase and the worker stay unchanged. The desktop analysis view is planned for later.

**How to apply:** Treat the handoff README as the visual spec. Don't re-ask anything it already covers. Recurring gaps between the handoff and the existing app:
- "Im Detail" and Wochenbilanz have no place in the new Heute screen.
- Kraft-Tag has no correction or partial-save path.
- Lauf-Tag lacks reset, reload, past-missed and error states.
- Open, free-text or interval pace/HF targets in the plan JSON.
- Koralle used for errors in old CSS.

localStorage keys `hm-tracker.` must never be renamed. A mockup addendum for gap states was proposed, consistent with [[feedback-mockup-before-final]]. Related: [[project-season-goals]].
