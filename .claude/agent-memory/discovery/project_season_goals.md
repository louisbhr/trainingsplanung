---
name: project-season-goals
description: Trainingsplanung long-term goals — HM 1:29:59 ~April 2027 is an intermediate goal of a marathon project (~April 2028); Louis wants continuous coaching and in-app goal entry with Claude-generated plans
metadata:
  type: project
---

Louis trains for a half marathon (target 1:29:59, ~April 2027; real race date still unknown on 2026-09-24, placeholder 2027-04-11). He sees the HM as preparation for a marathon (~April 2028), not an endpoint: "Ich will eigentlich weiter gecoacht werden. So wie jetzt, nur größer angelegt."

Decided 2026-09-24: work is split into Step 1 (Dashboard v2, with a slim plan object, race date in code with raceDateConfirmed flag) and Step 2 (multi-goal/marathon coaching). For Step 2 he wants to enter a new goal in the app (Plan tab card: date, distance, target time) and have Claude plan the rest — this reverses REQUIREMENTS.md's exclusion "Eigene Trainingsplan-Erstellung in der App".

Also decided 2026-09-27: Louis trains only by plan — no free strength logging, so every block (incl. the post-HM transition, which the app proposes automatically) must contain planned strength. Step 2 target: live by end of Feb 2027; Garmin wellness via Intervals.icu is in Step 2 scope. Login wish: passkey (Firebase support unverified). On 2026-09-27 login was split out as its own Step 1b (right after Dashboard v2, prerequisite for Step 2) because Firestore rules + auto-anonymous sign-in made all data incl. Strava tokens readable by any visitor.

Plan storage decided 2026-09-27 (replaces "HM plan stays in code"): three stages — Step 1 splits plan data into plans/hm-2027.json (logic stays code), Step 1b copies it into Firestore after login (file = emergency fallback), Step 2 creates/versions all plans in Firestore.

**Why:** Drives whether the app gets goal/plan abstractions instead of hard-coded plan.js constants, and whether plans live in code or Firestore.

**How to apply:** In any discovery for this app, check features degrade gracefully without an active plan and don't hard-code HM values (race date, zones, 31 weeks, coach prompt). Flag the REQUIREMENTS.md exclusion change explicitly whenever in-app plan generation comes up. See [[feedback-mockup-before-final]].
