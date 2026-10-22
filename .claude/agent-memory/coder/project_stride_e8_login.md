---
name: stride-e8-login-gate
description: Stride E8 Login/Gate-Screens: view-account.js-API, showGate/showLogin-Fokusregel, Test-Haken im Firebase-Stub, Abweichungen; lesen vor E9
metadata:
  type: project
---

E8 (auf stride-redesign): `view-account.js` exportiert `authBrandHTML(tagline)`, `renderGateWait(text)`, `renderGateError(msg)`, `renderLogin({email,error,notice,invalid})`, `renderNoAccess`, `renderPendingWrites`. `app.js`: `showGate(html)` ohne Titel, ruft `setPageHead("")`; `showLogin(email,error,notice,invalid)` fokussiert nach einem Fehler das erste `[aria-invalid="true"]`, sonst `#login-password`; kein Fokus ohne Fehler. Submit setzt `disabled` + `aria-busy` am Formular.

**Why:** Gate-Screens haben leeren Seitenkopf (`.sd-pagehead:empty`), den einen h1 trägt die Karte.

**How to apply:**
- Entscheidung Orchestrator: EIN allgemeiner Leer-Fehler "Bitte E-Mail und Passwort eingeben"; `invalid` (["email","password"]) markiert nur Ring + `aria-invalid` + `aria-describedby="login-error"`. `.sd-field__error` bleibt daher ungenutzt. Firebase-Fehler: kein aria-invalid, nur `aria-describedby` am Passwort.
- Warte-Zustand hat laut Markup keinen h1 (0 h1, Test 30h so); ggf. Designer-Hinweis.
- Stub-Haken in tests/app.test.mjs: `__AUTH_HANG__`, `__AUTH_FAIL__`, `__SIGNIN_HANG__`, `__SIGNOUT_FAIL__`, `__UID__`, `__EMAIL__` (auch für forbidden). Abmelde-Hinweis im Test über `seedNotice` (einmal in sessionStorage, überlebt Reload).
- `<picture>` wählt bei `emulateMedia` die Quelle asynchron neu: erst `waitForFunction(currentSrc)`.
- Unbenutzt nach E8 (für E9-Löschung in style.css): alle Klassen aus Markup 15.9 (`.auth-card`, `.auth-brand*`, `.field*`, `.text-input`, `.auth-error`, `.auth-submit`, `.account-*`, `.primary-btn`) plus `.sd-field__error`.
