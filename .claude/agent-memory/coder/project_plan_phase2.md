---
name: project-plan-phase2
description: Plan-Phase-2-Umbau (20.10.2026) - 35 Wochen, optionale Kraft, Test/Schwelle-shortTypes; wo die Regeln leben
metadata:
  type: project
---

Branch `plan-phase2` (Worktree /Users/louisbehre/.claude/jobs/f675683c/tmp/wt-plan, nicht gepusht): Renntag 02.05.2027 bestätigt, 35 Wochen, W9-12 ausformuliert, W13-35 Platzhalter.

- `session.optional` (nur kraft): `metrics.countsTowardPlan(session, done)` ist DIE Regel (Wochensoll, Adhärenz, Wochenbilanz, Wochen-Tab-Summary). Wochen-Tab: `statusOptionalHTML` (.optional-pill in style.css, ein Einzeiler, vom frontend-designer ggf. zu prüfen).
- `metrics.isZoneRun(session)`: nur Easy/Long/Recovery mit numerischem hfMax zählen für Easy-Disziplin, aerobe Effizienz, easyOverLimit. Test/Schwelle-Sessions haben bewusst KEIN hfMax.
- `plan.js` exportiert ZONE_RUN_TYPES/RUN_SHORT_TYPES; validatePlan prüft jetzt Session-Form.
- Golden-Test endet bei 25.10.2026 (W1-8), weil W9 nicht mehr Platzhalter ist.
- Browser-Tests: BASE hartkodiert 8099; bei belegtem Port temporäre Kopie mit anderem Port nutzen (nicht committen).
- "bisZumRennen" gibt es im echten Plan nicht mehr (Renntag = Ende W35), Test nutzt Plan-Kopie mit Renndatum 2027-05-09.
