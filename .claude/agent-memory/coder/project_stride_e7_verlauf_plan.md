---
name: stride-e7-verlauf-plan-architecture
description: Stride E7 Verlauf + Plan: view-history.js/view-plan.js/view-account-API, histGen/focusHistoryControl in app.js, Abweichungen; lesen vor E8/E9
metadata:
  type: project
---

E7 (Commit cf92f5c auf stride-redesign): `view-history.js` (headHTML, pageHTML, runSlotHTML, strengthSlotHTML, strengthErrorHTML, barRects, axisHTML, runStats, infoContent), `view-plan.js` (headHTML, pageHTML mit `status` "before"|"in"|"after", phaseBarGeometry), `view-account.js` (`renderAccountSection`, `stravaStatus`, `syncText`; Export-/Konto-Karte entfallen). `app.js`: `histGen` verwirft späte Antworten, nur `#hist-slot` lädt nach; `focusHistoryControl` setzt Fokus nach `hist-mode`/`pick-exercise`; `paintPlanAccount` patcht nur `[data-card="account"]`, wenn der Strava-Status nachlädt. `strava.lastFetchedAt()` liest `runCache.fetchedAt`.

**Why:** Verlauf und Plan sollen wie E6 ohne Voll-Neuzeichnen und ohne Fokusverlust arbeiten; Diagramme sind SVG-Zahlen (C5), kein `style=`.

**How to apply:**
- `barRects` berechnet `height` aus dem gerundeten `y` (sonst Rundungsfehler 135,1 > 135 im viewBox-Test).
- Ausdünnen: `step = ceil(n/10)`, vom neuesten Platz gezählt; Spans bleiben leer, nie weglassen.
- `noHScroll` im Test nimmt Chips in `.sd-filter` aus (die Zeile scrollt in sich).
- Abweichungen: Prozentzeichen nach ` ` (Designer-Markup `&nbsp;`, nicht U+202F); Kraft-Wdh-Hinweis „Höchste Summe je Woche“ steht im Markup, `kraftWeeklyBars` summiert aber mehrere Einträge einer Woche; Pläne ohne `weekType`-Deload nutzen `deload`-Flag; Plan-Zeile immer „Plandatei“ ohne Version (F1); Strava-Fehler mit `errorSource` firebase wird im Konto auch als „Abruf fehlgeschlagen“ gezeigt; Kopf von Verlauf/Plan hat keine Markenzeile mehr (Test 12 angepasst); „Sicherheitsabstand“-Messpunkte auf `.sd-pagehead` ≥ 8 und `.sd-main` ≥ 12.
- Test-Hook: `window.__EMAIL__` im FIREBASE_STUB überschreibt die E-Mail (Escape-Test); `exportPage({ breakFile: true })` lässt `File` werfen (Fehlerton).
- brandHeadHTML() und der Kraft-Hinweis wurden in E8 erledigt.
