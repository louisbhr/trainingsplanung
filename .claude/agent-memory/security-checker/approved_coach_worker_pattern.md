---
name: approved-coach-worker-pattern
description: worker.js POST /coach prompt-injection/cost-abuse defenses accepted as sufficient for the pre-1b interim period — the accepted baseline to diff future worker.js changes against
metadata:
  type: project
---

`worker.js` `/coach` (M2-8, reviewed 2026-10-02) defends against prompt injection and
upstream-detail leakage with a pattern worth treating as the accepted baseline:

- **Body limit before parsing:** `request.text()` + `TextEncoder` byte-length check
  (`MAX_BODY_BYTES = 8192`) happens before `JSON.parse`, not after — avoids parsing
  attacker-controlled huge payloads.
- **Whitelist, not blacklist, for every free string field:** `STR_CHAR_RE =
  /^[\p{L}0-9 .,:;/()+\-–×%°'·]*$/u` plus an explicit `!v.includes("\n")` check. No
  backtick, no double quote, no backslash allowed — this matters because the whitelist's
  real job isn't JSON-escaping (JSON.stringify handles that regardless) but blocking
  characters that could break out of the ```json fenced data block in the prompt
  (backtick) or fake a new instruction paragraph (newline).
- **System prompt is a server-side constant; user data only ever enters as a labelled
  JSON data block** in the user message, built from already-validated fields. The
  goal/race sentence (`goalSentence()`) is built purely from enum/regex-validated values
  (`DISTANCES`, `TIME_RE`, `raceMonth` 1–12), never from a free string — this is the key
  property that keeps arbitrary text out of prose directly adjacent to instructions.
- **Model, max_tokens, and prompt are all fixed server-side constants** (`MODEL`,
  `MAX_TOKENS_DAILY=200`, `MAX_TOKENS_WEEKLY=450`) — nothing in the request body can
  select or override them.
- **Error responses never leak upstream detail or the key:** a `401` from Anthropic
  (bad key) is logged server-side only (`console.log`, visible via `wrangler tail`) and
  surfaced to the client as the same generic `upstream_error` as any other failure.
- **Origin allowlist policy differs by endpoint:** `/exchange` and `/refresh` (legacy,
  Strava) keep "empty `ALLOWED_ORIGINS` → allow `*`" for convenience; `/coach` inverts
  this — empty `ALLOWED_ORIGINS` → reject everything (403). This asymmetry is
  intentional (architecture-review-approved), not an inconsistency to flag.

**Known, accepted residual risk (not a finding, already priced in by the
architecture-reviewer, see E2 in `docs/review-architecture-dashboard-v2.md`):** the
`Origin` header is attacker-controllable outside a real browser (e.g. `curl -H
"Origin: https://<allowed-domain>"`), so `ALLOWED_ORIGINS` is a convenience filter, not
an access control boundary. Until Schritt 1b ships, the only real backstop against cost
abuse of the public worker URL is the Anthropic console's own monthly spend cap on a
dedicated low-limit workspace/key (~5 USD, see [[project_public_repo_firestore_vuln]] for
the related Firestore-exposure angle). Cheap, no-new-dependency additions worth
suggesting (but not required, and not done automatically — infra config, not code) if
Louis wants another layer before 1b: a Cloudflare free-plan rate-limiting rule on the
`/coach` path (dashboard-configured, zero code/deploy), or a minimal in-worker counter
using the Workers Cache API keyed by `CF-Connecting-IP` (no KV binding needed, free-tier
compatible, but adds worker code/complexity for a ~3-week interim — architecture-reviewer
already judged this not worth it for the short interim; re-raise only if 1b slips
significantly).

**How to apply:** when `worker.js` changes again, diff against this list — a change that
removes the body-limit-before-parse ordering, widens the whitelist to include backtick/
quote/backslash, moves a free string into the system prompt or goal sentence, lets the
client influence `model`/`max_tokens`, or echoes upstream error bodies/status detail
verbatim is a regression against an already-reviewed design, not just a style nit.
