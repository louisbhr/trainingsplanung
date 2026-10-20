---
name: review-standards-trainingsplanung
description: Review standards for trainingsplanung — verify by independent deep-compare/probes, what counts as critical, recurring gaps in coder output
metadata:
  type: feedback
---

Verify, don't trust self-reports: run `npm run serve` (:8099) + `npm test` myself, and for data/logic moves write a throwaway deep-compare script (old fixture vs new) plus throwaway Playwright probes for edge dates — delete them afterwards, never commit.

**Why:** Louis's orchestrator explicitly asks "Traue Selbstberichten nicht"; prior subagents in his projects misreported state. In M1 (Dashboard v2, 27.09.2026) green tests hid a real hang (invalid localStorage plan copy → stuck "Plan wird geladen …") found only by probing.

**How to apply:**
- Fallback/offline paths (localStorage copies, caches) must validate before use and every post-load step in init() must sit inside the error-card try — a hang without error card counts as Critical.
- Firestore-key-bearing values (logs/{datum}_{slug}, dayplans/{datum}, runlinks/{datum}, `week` field) get explicit parity checks; `saveLog` uses merge:true.
- Recurring coder gap: new pure logic tested only via browser; old unit checks (DST, bounds) dropped silently; docs (README/tests/README/HANDOFF) not updated despite plan saying so → report docs as spec deviation, not code defect.
- Pre-plan-start / post-race dates: check all tabs, not just "Heute".
- Reviewer has no Agent tool: correction loop = hand back to caller with concrete coder fix list; don't check off step 10 while critical is open.
- Review doc goes to docs/review-code-<milestone>.md (German, like the rest of the app docs); later rounds are appended as "Runde N" sections, and the reviewer commits the doc + own memory (never pushes; .pipeline-state.md is gitignored).
- Deferred-by-decision items (e.g. M1 validatePlan session shape "vor 26.10.") stay Minor; re-raise when weeks 9–31 are actually written into plans/hm-2027.json.
- Client↔Worker contract: browser tests stub /coach (accepts anything) and worker tests use hand-built bodies — so ALWAYS capture real client bodies (Playwright route) and replay them through `worker.fetch` in node. M2 found weekly always 400 (`adherence4w.pct` extra key) this way.
- Cache/limit logic: probe "fail once → reload" with persistent stub state; a pre-call write that sets inputHash with text null poisoned the cache (M2 K2). Also count parallel Strava fetches per boot (concurrent fill* calls).
- Degraded-dependency probes on the dashboard: Firestore "boom" stub and Strava 500 while connected — skeletons must resolve, run-based ampeln must not show false red.
- Useful probe for round 2: a copy that passes validatePlan but has a kraft session without `exercises` — must show error card, not hang.
- Auth/Login (1b, 20.10.2026): stubs can't prove the real Firebase module or CORS. Probes that paid off: fetch Google's real JWK set and import it with the worker's exact importKey call; load the app with the REAL firebase-init.js in a fresh Playwright profile (expect login, no firebaseapp iframe, no Firestore traffic before login); wrap worker.fetch in a node http server and call it cross-origin from :8099 with Authorization to see the real preflight. Temp probe files under tests/ must be deleted right after (playwright resolves from there).
- Parallel agents (security-checker → coder) may commit DURING the review: re-check `git log`/`git status` before writing the verdict and rerun `npm test` on the final HEAD.
- Public repo: check commit author emails (`git log --format=%ae`) — no user.email set in the app repo leaks the hostname; commit own review with `-c user.email=80367378+louisbhr@users.noreply.github.com`.
