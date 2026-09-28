---
name: approved-plan-loading
description: plan-store.js fetch/localStorage design accepted as safe — fixed path, re-validated cache
metadata:
  type: project
---

`plan-store.js` (M1) fetches `plans/hm-2027.json` via a URL built from
`new URL("./plans/hm-2027.json?v=...", import.meta.url)` — `PLAN_ID` is a hardcoded
constant, never derived from query string, hash, or any user input. `fetch()` is
therefore always same-origin and the path can't be redirected by an attacker.

On success the plan is copied into `localStorage` as an offline fallback (gym without
signal). On load, `readCache()` doesn't just check `schemaVersion` — it re-runs
`validatePlan()` on the cached object before trusting it, closing the gap where a
same-schema-version cache could still have a malformed shape (K1 finding from the
reviewer's Runde 1, fixed before this security pass).

**Why:** this is the accepted security posture for "data promoted from hardcoded JS to
fetched/cached JSON" — the important properties are (1) fixed, non-attacker-controlled
fetch path, and (2) cache re-validated with the same schema check as a fresh fetch, not
a weaker check.

**How to apply:** when Schritt 1b (Firestore-backed plan, real login) replaces this
loader, re-check both properties still hold: the Firestore document path must still be
derived from the authenticated user's own UID (not client-suppliable), and any local
cache of that document must still be re-validated before use, not just schema-versioned.
