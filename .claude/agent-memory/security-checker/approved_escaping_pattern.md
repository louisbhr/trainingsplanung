---
name: approved-escaping-pattern
description: app.js esc() helper and its coverage — the accepted pattern for rendering plan/session/exercise text safely
metadata:
  type: project
---

`app.js` defines `const esc = (s) => String(s ?? "").replace(/[&<>"']/g, ...)` mapping to
`&amp; &lt; &gt; &quot; &#39;`. This covers both text-node and quoted-attribute contexts
(e.g. `value="${esc(st.soll)}"`), so it is safe to accept as sufficient escaping wherever
it's used consistently.

**Why:** M1 (Dashboard v2, plans/hm-2027.json + plan-store.js localStorage fallback)
moved plan data from hardcoded JS objects to fetched/cached JSON, i.e. from a trusted
source to one that includes a same-origin localStorage copy an attacker with same-origin
script execution could tamper with. Verified in the M1 security review
(2026-09-27, [[project_public_repo_firestore_vuln]] is the separate, more concrete risk)
that every plan-derived field reaching `innerHTML` (exercise name, hint, focus, phase
name, goal, zone labels) is wrapped in `esc()`. `slug()` (in plan.js, exported, used for
`data-slug` attributes without esc) is separately safe because it strips everything
outside `[a-z0-9-]` — verify that invariant still holds if `slug()` ever changes.

**How to apply:** In future reviews of this app, grep for `${...}` interpolations into
`innerHTML`/`outerHTML` that pull from plan JSON, Firestore, or any other JS-writable
cache, and confirm each one is wrapped in `esc()` (or provably restricted to a safe
character set like `slug()`). A raw interpolation of untrusted string data into
`innerHTML` is a finding regardless of how the data got there (JSON, localStorage,
Firestore, Strava API).
