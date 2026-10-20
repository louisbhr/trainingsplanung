---
name: approved-worker-token-auth
description: worker.js Firebase-ID-token verification (Schritt 1b) reviewed 2026-10-20 and accepted as baseline; diff future changes against it. Includes the open ?worker= override finding.
metadata:
  type: project
---

Accepted baseline (worker.js `verifyIdToken`/`enforceAuth`, reviewed 2026-10-20, 94 worker/access/consistency tests green):
RS256-only whitelist, kid must be a non-empty string and looked up in a Map of imported CryptoKeys (no injection),
Web Crypto verify before claims, claims iss/aud/sub==ALLOWED_UID/exp(+30s)/iat+auth_time(+60s), anonymous rejected,
missing config in required mode -> 500 not_configured (fail closed), AUTH_MODE only "report" is non-blocking (default required),
JWK cache TTL clamp 60s..24h, reload max 1/min, stale-if-error 1h, unavailable -> 503 (distinct), all other failures one uniform 401,
logs only reason codes, auth runs after origin/method check and before body read. CORS: Authorization added to Allow-Headers only;
/coach still 403 on empty ALLOWED_ORIGINS. Client: token only via authHeaders() -> fetchWithAuthRetry, never in URL/log/storage;
wipe-on-logout removes Firestore cache + all `hm-tracker.*` localStorage keys. Rules: single recursive `isLouis()` match, UID identical in config.js/rules/wrangler.toml.

**Open finding (HIGH, found 2026-10-20):** config.js `readOverride()` persists `?worker=<url>` from the query string into
localStorage (`hm-tracker.workerUrl`) and uses it as WORKER_URL. Since 1b every worker call carries the Firebase ID token
(valid ~1h, also accepted by Firestore REST) plus Strava code/refresh_token in bodies -> a crafted link exfiltrates them.
**How to apply:** on any later check, verify the override is removed or restricted (default-origin only / localhost) and that
authHeaders is never attached to a non-default origin.

**Process note:** wrangler.toml commits `AUTH_MODE = "report"` as designed rollout phase; step 11 sign-off must not be read as
"enforcing" until the required-flip commit + deploy + curl-401 smoke test happened.
