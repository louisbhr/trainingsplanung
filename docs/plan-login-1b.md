# Umsetzungsplan: Echtes Login + Plan nach Firestore (Schritt 1b)

Stand: 03.10.2026 · Planner · **ENTWURF, wartet auf Architektur-Review und Louis' Entscheidungen**
Grundlage: `docs/requirements-login.md` (verbindlich), Andockpunkte aus
`docs/requirements-marathon-coaching.md` (M5, M9). Format wie `docs/plan-dashboard-v2.md`.

## Ziel

Nur Louis kommt an App, Firestore und Worker. Er meldet sich pro Gerät/Variante einmal an
und bleibt angemeldet, auch offline. Die Firestore-Regeln hängen an seiner UID, die anonyme
Anmeldung entfällt, und alle Worker-Endpunkte prüfen das Firebase-ID-Token. Danach wird der
Plan einmalig aus `plans/hm-2027.json` nach `plans/hm-2027/versions/{n}` übernommen. Ab dann
lädt die App den Plan aus Firestore, die Datei dient als Notfall-Kopie.

Recherche-Stand vom Orchestrator (03.10.2026, Web-Doku, Stand Juli 2026):
- **Passkey:** Firebase Auth hat keinen nativen Passkey-Login. Möglich wäre er nur über
  Drittlösungen, die Cloud Functions (Blaze-Plan) und eine Dependency brauchen.
  → **zurückgestellt**.
- **Google-Redirect** ist auf `github.io` in Safari unzuverlässig, weil Safari den Speicher
  im Cross-Origin-iframe auf `authDomain` blockiert. Die Auswege (eigene Domain mit Proxy,
  Helper-Dateien an der Domain-Wurzel) gehen auf GitHub Pages nicht. Ein Popup klappt im
  Safari-Tab, ist in der Home-Bildschirm-App aber fraglich. Ein E-Mail-Link öffnet Safari
  statt der Home-Bildschirm-App.
- **Daraus folgt:** E-Mail + Passwort ist der Hauptweg (iCloud-Schlüsselbund + Face ID),
  Google-Popup ist optional, Passkey kommt in den Backlog.

---

## Entscheidungen für Louis (Approval-Gates)

| Nr. | Gate | Vorschlag |
| --- | --- | --- |
| **G1** | Security: Auth-Methode | **E-Mail + Passwort** als einzige Methode in 1b. Louis' Konto wird **in der Firebase-Console angelegt**; in der App kann man sich nicht registrieren. Sitzung bleibt dauerhaft (`initializeAuth` mit `indexedDBLocalPersistence` → `browserLocalPersistence`, **ohne** `popupRedirectResolver`, damit beim Start kein iframe zu `firebaseapp.com` geladen wird). **Google-Popup: nicht umgesetzt**, nur falls Louis es ausdrücklich will (dann im Spike mitprüfen, eigener Schritt). **Passkey: Backlog**, bis Firebase ihn nativ anbietet. |
| **G2** | Security: Zugriffsprüfung | Fremde Konten → „Kein Zugriff“ + Abmelden. Eine noch gespeicherte anonyme Sitzung → stilles Abmelden, danach Anmelde-Bildschirm. Die Prüfung im Client ist nur UX. Der eigentliche Schutz sind Regeln und Worker. |
| **G3** | Firestore-Regeln | `allow read, write: if request.auth != null && request.auth.uid == "<LOUIS_UID>";` für `/{document=**}`. Danach in der Console: anonyme Anmeldung aus und, falls die Option existiert, Selbstregistrierung aus. |
| **G4** | Firestore-Schema | `plans/hm-2027` = `{ activeVersion, latestVersion, updatedAt }`. `plans/hm-2027/versions/{n}` (Doc-ID `"1"`, `"2"`, …) = Plan-Objekt **flach und unverändert** (`schemaVersion: 1`, enthält schon `fileVersion`) plus `source: "file"` und `importedAt` (ms). Geschrieben wird in **einer Transaktion**. `latestVersion` ist neu gegenüber den Requirements: Schritt 2 kann eine ältere Version wieder aktivieren, ohne dass die nächste Nummer kollidiert. |
| **G5** | Worker-API | `/coach`, `/exchange` und `/refresh` verlangen `Authorization: Bearer <Firebase-ID-Token>`. Fehlt das Token oder ist es ungültig → **401**: `/coach` antwortet `{ error: "unauthorized", message }`, `/exchange` und `/refresh` antworten `{ message }` (bestehende Formen). CORS `Allow-Headers: Content-Type, Authorization`. Neue Worker-Variablen in `wrangler.toml [vars]`: `FIREBASE_PROJECT_ID`, `ALLOWED_UID`. Fehlt eine davon → 500 `not_configured` (**fail closed**). Reihenfolge im Worker: OPTIONS → Origin → Methode → Token → Route. Origin-Check, Schema-Prüfung und Ausgabenlimit bleiben. |
| **G6** | Dependencies | **Keine neuen.** Auth und `runTransaction` kommen aus derselben Firebase-CDN-Version 10.13.0. Der Worker prüft mit Web Crypto (RS256 über JWK). Sollte eine Bibliothek nötig werden → neues Gate (siehe Risiko R3). |
| **G7** | Datei-Organisation | Neue flache Module `access.js` und `view-account.js` (beide in `MODULES`), ein temporärer Ordner `spike/` (wird in Schritt B3 gelöscht), neuer Test `tests/config-consistency.test.mjs`. |

Die UID ist kein Geheimnis. Sie steht an drei Stellen im Repo (`config.js`,
`firestore.rules`, `wrangler.toml`), und ein Test hält die drei gleich.

---

## 1. Datei-Map

### Neu

| Datei | Schritt | Inhalt |
| --- | --- | --- |
| `spike/index.html`, `spike/spike.js` | S0 | Wegwerf-Testseite (nicht verlinkt, nicht im Stamm, damit Versions- und Stub-Test sie nicht einsammeln). Inhalt: echte `<form>` mit `autocomplete="username"`/`"current-password"`, Anmelden/Abmelden, Anzeige von UID, Persistenz-Art, `navigator.standalone`/`display-mode`, `getIdToken()`-Länge und Firestore-Lesetest (`config/strava`: nur „existiert ja/nein“, keine Werte anzeigen). Dazu `apple-mobile-web-app-capable`, damit die Seite als Home-Bildschirm-App getestet werden kann. |
| `access.js` | A1 | Reine Logik, ohne DOM, in Node testbar: `accessState(user, allowedUid)` → `"signedOut" \| "anonymous" \| "forbidden" \| "ok"`; `authErrorText(code)` (deutsche Meldungen für `auth/invalid-credential`, `too-many-requests`, `network-request-failed` und Fallback); `planSyncState(activeMeta, activePlan, filePlan)` → `"notImported" \| "upToDate" \| "fileNewer" \| "fileInvalid"` (B2). |
| `view-account.js` | A1/B2 | `renderLogin()`, `renderNoAccess(uid)`, `renderAccountCard({ email, uid, planSync })`. Nutzt die Klassen des Designers und `esc()`. |
| `tests/access.test.mjs` | A1 | Node-Tests für `access.js` |
| `tests/config-consistency.test.mjs` | A1 | `ALLOWED_UID` in `config.js` = UID in `firestore.rules` = `ALLOWED_UID` in `wrangler.toml`. Ab A1 nicht leer. |

### Geändert

| Datei | Schritt | Änderung |
| --- | --- | --- |
| `firebase-init.js` | A1 | `signInAnonymously` fliegt raus. `initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })`. Neue Exporte: `authReady()` (→ `user \| null`), `signIn(email, pw)`, `signOutUser()`, `authHeaders()` (→ `{ Authorization: "Bearer …" }`, optional mit `force`). `ensureSignedIn()` legt nichts mehr an: Ohne passenden Nutzer wirft es `FirebaseAccessError` mit `code: "auth/not-signed-in"`. |
| `firebase-init.js` | B2 | `loadActivePlanDoc(planId)` → `{ meta, plan } \| null` (getDoc mit Timeout, danach `getDocFromCache`). `importPlanVersion(planId, plan)` → `{ version }` per `runTransaction` (Meta lesen, `n = (latestVersion \|\| 0) + 1`, `versions/{n}` und Meta schreiben). |
| `config.js` | A1 | `export const ALLOWED_UID = "<LOUIS_UID>";` |
| `firestore.rules` | A1 | UID-Regel (G3). Das Committen allein ändert nichts. Scharf wird die Regel erst, wenn Louis sie in der Console veröffentlicht (A3). |
| `app.js` | A1 | `init()`: erst `authReady()`, dann `accessState`. `signedOut` → Login, `anonymous` → stilles `signOutUser()` + Login, `forbidden` → „Kein Zugriff“ + Abmelden, `ok` → wie bisher (Plan laden, Strava-Redirect, render). Die Tableiste ist ausgeblendet, solange niemand angemeldet ist. Plan-Tab: Konto-Karte unten. Der Text der Firebase-Fehlerkarte (heute: „Anonymous aktiviert“) zeigt jetzt auf Login und Regeln. |
| `app.js` | A2 | Die beiden `fetch(COACH_URL, …)` (Coach täglich, Wochenbilanz) senden `...await authHeaders()`. Schlägt `authHeaders()` fehl, gibt es keinen Aufruf und der Fallback greift. |
| `strava.js` | A2 | `callWorker` sendet `authHeaders()`. Bei 401 wird das Token einmal mit `force` erneuert und der Aufruf wiederholt, danach erscheint die Meldung „Anmeldung abgelaufen, bitte neu laden“. |
| `worker.js` | A2 | `requireAuth(request, env)`: Header `Bearer`, JWT in drei Teilen, Header `alg === "RS256"` mit `kid`. Schlüssel kommen von Googles JWK-Endpunkt für `securetoken@system.gserviceaccount.com` (**URL vor Umsetzung verifizieren**). Sie werden modulweit gecacht (`max-age` aus `Cache-Control`); bei unbekanntem `kid` wird höchstens einmal pro 60 s neu geladen. Prüfung mit `crypto.subtle.verify("RSASSA-PKCS1-v1_5", …)`. Claims: `aud === FIREBASE_PROJECT_ID`, `iss === "https://securetoken.google.com/" + FIREBASE_PROJECT_ID`, `exp > now`, `iat <= now + 60`, `auth_time <= now + 60`, `sub === ALLOWED_UID`. CORS-Header ergänzen. `checkAccess` aus M2 ist der Einhängepunkt, Schritt 2 nutzt `requireAuth` unverändert für `/plan/*`. |
| `wrangler.toml` | A2 | `[vars] FIREBASE_PROJECT_ID = "trainingsplanung-2c6c0"`, `ALLOWED_UID = "<LOUIS_UID>"` |
| `plan-store.js` | B2 | `loadPlans()` lädt in dieser Reihenfolge: Firestore aktive Version (`source`/`importedAt` vor `validatePlan` abstreifen) → Datei → `localStorage`-Kopie. Rückgabe zusätzlich `{ source: "firestore"\|"file"\|"cache", activeMeta, filePlan }`. Die Datei wird immer mitgeladen (Vergleich der `fileVersion`). Hinweise: Firestore-Meta existiert, aber die Version ist unlesbar oder ungültig → „Plan aus Notfall-Kopie“. Meta fehlt (vor der Übernahme) → Datei ohne Toast, die Konto-Karte zeigt „Plan noch nicht übernommen“. Neu: `importFromFile()` (validiert die Datei, prüft `id === "hm-2027"` und dass die Datei neuer ist oder es noch keine Version gibt, dann `importPlanVersion`). |
| `tools/bump-version.mjs` | A1 | `access.js`, `view-account.js` in `MODULES` |
| `tests/app.test.mjs` | A1/A2/B2 | Siehe „Tests“ unten |
| `tests/worker.test.mjs` | A2 | Siehe „Tests“ unten |
| `style.css` | A1 (Designer) | Anmelde-Bildschirm, „Kein Zugriff“, Konto-Karte |
| `README.md`, `HANDOFF.md`, `REQUIREMENTS.md` (Abschnitt 4 entfällt, 5 #7 erledigt), `tests/README.md`, `backlog.md` (Passkey, Strava-Tokens in Worker-KV) | B3 | Doku, **ohne** Details zur bisherigen Lücke |
| `package.json` | A1 | `test:access` und `test:consistency` in `npm test` aufnehmen |

Die Größe wird beim Import geprüft: `wc -c plans/hm-2027.json` (heute 1480 Zeilen,
geschätzt deutlich unter 100 KB) liegt weit unter dem Dokument-Limit von 1 MiB. Mit
ausformulierten Wochen 9–31 im Abnahmekriterium von B2 erneut messen.

---

## 2. Schritte (skeleton-first, nach jedem Schritt nutzbar)

Zwei Meilensteine mit je einem vollständigen Pipeline-Durchlauf (run-verifier → test-runner
→ reviewer → security-checker → Louis-Test → Commit/PR auf Ansage), wie bei M1/M2.

### S0 – Console vorbereiten + Spike auf dem echten iPhone (vor jedem App-Umbau)

1. **Louis (Console):** Authentication → Sign-in method → **E-Mail/Passwort** aktivieren.
   Anonym bleibt vorerst **an**.
2. **Louis (Console):** Authentication → Users → **Nutzer hinzufügen**. Das Passwort vorher
   in der Passwörter-App für `louisbhr.github.io` erzeugen (Schlüsselbund), damit beide
   Geräte es haben. **Die UID aus der Console notieren** und an den Orchestrator geben.
3. **Louis (Console, vor Umsetzung verifizieren, ob es die Option gibt):** Authentication →
   Settings → User actions → „Enable create (sign-up)“ ausschalten.
4. **coder:** `spike/` bauen, Mini-PR nach `main` (nur neue Dateien, die App bleibt
   unberührt).
5. **Louis testet** `https://louisbhr.github.io/trainingsplanung/spike/` in drei Varianten:
   iPhone-Safari-Tab, iPhone-Home-Bildschirm (von der Spike-Seite aus hinzufügen), MacBook
   Safari. Prüfpunkte je Variante:
   - Füllt der Schlüsselbund aus und sichert er das Passwort?
   - Klappt die Anmeldung?
   - Ist man nach dem Schließen der App noch angemeldet? Nach einem **iPhone-Neustart**?
     Nach 24 h?
   - **Flugmodus:** Startet die Seite mit gespeicherter Sitzung, und gelingt der
     Firestore-Lesetest aus dem Cache?
   - Bleibt die Konsole beim Start ohne iframe/Fehler von `firebaseapp.com`?
   - Ist die angezeigte UID dieselbe wie in der Console?

*Abnahme:* Ergebnis-Tabelle in `.pipeline-state.md`. Scheitert die Home-Bildschirm-Variante
→ Rollback R-S0 (unten), **kein** Umbau der App.

### Meilenstein A – Login + Regeln + Worker-Token

**A1 – Walking Skeleton: Login-Gate (coder, danach frontend-designer).**
- `access.js`, `view-account.js`, `firebase-init.js`-Auth, `config.js ALLOWED_UID`,
  `init()`-Gate, Konto-Karte (E-Mail, UID zum Markieren, „Abmelden“),
  `firestore.rules` mit UID (**nur committet**), Konsistenz-Test, Stubs.
- Worker und Plan-Laden bleiben **unverändert**. Coach und Strava laufen weiter wie heute.
- Danach frontend-designer: Anmelde-Bildschirm, „Kein Zugriff“ und Konto-Karte im App-Stil.
  Felder ≥ 16 px, Knopf ≥ 44 px, fluid-responsive, kein Mockup. Der coder hat vorher nur
  bestehende Klassen benutzt, ohne Inline-Styles.
- *Abnahme:*
  - `npm test` grün.
  - Abgemeldet: Anmelde-Bildschirm, **0** Firestore-Aufrufe, keine Tableiste.
  - Falsches Konto: „Kein Zugriff“, `signOutUser` aufgerufen.
  - Anonyme Sitzung: stilles Abmelden, danach Login.
  - Angemeldet: alle bisherigen Browser-Checks unverändert grün.
  - Login-Fehler landen in der Firebase-Fehlerkarte.
  - 390×844 und 1280×800 ohne seitliches Scrollen, in Hell und Dunkel.

**A2 – Worker prüft ID-Token + Client schickt es (coder).**
- `requireAuth` und CORS in `worker.js`, `[vars]`, `authHeaders()` an den drei Aufrufstellen,
  Retry bei 401 in `strava.js`.
- *Abnahme:* Siehe Tests unten. Der Client sendet bei jedem Worker-Aufruf den Header, Coach
  fällt ohne Token sauber auf den Fallback zurück.

**A-Pipeline:** run-verifier → test-runner → reviewer → security-checker → Louis lokal.
Danach folgt die **Auslieferung A** (Reihenfolge siehe „Louis-Schritte“).

**A3 – Umstellung scharf schalten (fast nur Louis, Console).** Siehe Louis-Schritte 6–11.
Ein Code-Commit gibt es nur, falls die UID korrigiert werden muss.

### Meilenstein B – Plan nach Firestore (erst nach A3, Requirements L3.7)

**B1 – Datenzugang (coder).**
- `loadActivePlanDoc`, `importPlanVersion` in `firebase-init.js` plus Stubs (Standard:
  `null` → bestehende Plan-Tests bleiben unverändert).
- *Abnahme:* `npm test` grün, die App lädt weiter aus der Datei.

**B2 – Firestore-first laden + „Plan aus Datei übernehmen“ (coder, Designer nur für den
Karten-Zustand).**
- `plan-store.js` wie in der Datei-Map beschrieben.
- Konto-Karte zeigt Quelle, aktive Version, `fileVersion` von Firestore und Datei, und je
  nach Zustand einen Knopf „Plan aus Datei übernehmen“:
  - `notImported` oder `fileNewer` → Knopf aktiv;
  - `upToDate` → kein Knopf;
  - `fileInvalid` → Fehlermeldung, kein Knopf.
- Die Übernahme braucht Netz (die Transaktion schlägt offline fehl → Meldung „Nur mit
  Netz“). Danach lädt die App den Plan neu.
- *Abnahme:*
  - Laden aus Firestore;
  - Meta vorhanden + Version ungültig → Datei + „Plan aus Notfall-Kopie“;
  - Firestore wirft → Datei;
  - alles weg → `localStorage`-Kopie;
  - ungültige Datei → Import abgelehnt, **kein** Schreibaufruf;
  - Datei neuer → Knopf sichtbar, gleich alt → kein Knopf;
  - zweite Übernahme → Version 2, Version 1 bleibt;
  - Dokumentgröße gemessen.

**B3 – Aufräumen (coder):** `spike/` löschen, Doku (siehe Datei-Map), `npm run version`,
`git grep` nach `signInAnonymously` (darf keinen Treffer geben).

**B-Pipeline** wie bei A, danach Auslieferung B und Louis-Schritte 12–13.

---

## 3. Louis-Schritte in Reihenfolge (Console-Klicks und Geräte)

| # | Wann | Wer / Wo | Was |
| --- | --- | --- | --- |
| 1 | S0 | Firebase-Console | E-Mail/Passwort aktivieren (anonym bleibt an) |
| 2 | S0 | Passwörter-App + Console | Passwort erzeugen, Nutzer anlegen, **UID notieren** |
| 3 | S0 | Console | Selbstregistrierung aus (falls die Option vorhanden ist) |
| 4 | S0 | iPhone (Tab + Home-Bildschirm), MacBook | Spike-Prüfpunkte, Ergebnis melden |
| 5 | vor Auslieferung A | iPhone + MacBook | App einmal **mit Netz** öffnen, damit alle offline geloggten Sätze synchronisiert sind. Grund: Ausstehende Schreibvorgänge der anonymen Sitzung gehen beim Abmelden sonst nicht mehr raus. |
| 6 | Auslieferung A | Terminal | `npx wrangler deploy` (Worker mit Token-Pflicht), **direkt danach** PR mergen → Pages. Ein paar Minuten lang fallen Coach bzw. Strava-Refresh aus, das ist akzeptiert. Smoke-Test: `curl` ohne Token → 401. |
| 7 | nach Pages live | iPhone-Tab, iPhone-Home-Bildschirm, MacBook | Anmelden (Schlüsselbund), prüfen, dass die Konto-Karte die erwartete UID zeigt und Coach/Strava laufen |
| 8 | danach | Firebase-Console → Firestore → Regeln | Inhalt von `firestore.rules` (mit UID) einfügen, **veröffentlichen** |
| 9 | sofort | alle drei Varianten + **privates Fenster** | Angemeldet funktioniert alles (Satz speichern, Verlauf, Coach). Im privaten Fenster: nur Anmelde-Bildschirm. |
| 10 | danach | Console → Sign-in method | **Anonym deaktivieren**. Optional alte anonyme Nutzer löschen. |
| 11 | danach | strava.com → Einstellungen → Meine Apps, dann App | App-Zugriff **widerrufen**, in der App **neu verbinden**, Läufe erscheinen |
| 12 | Auslieferung B | App, Plan-Tab → Konto | „Plan aus Datei übernehmen“ → Version 1. Optional in der Console prüfen, dass `plans/hm-2027` existiert. |
| 13 | danach | Flugmodus | App startet, Plan da, Satz speichern geht |

Später bei jeder Planänderung (Variante a): Claude Code ändert die JSON → `npm run version` →
Merge → in der App „Plan aus Datei übernehmen“.

---

## 4. Rollback-Plan

Aussperren ist grundsätzlich ausgeschlossen. Louis' Zugang zur Firebase-Console hängt nicht
am App-Login. Regeln, Anmeldearten und Passwort (Users → Passwort zurücksetzen) lassen sich
dort immer ändern.

- **R-S0 – Spike scheitert in der Home-Bildschirm-App** (Sitzung geht verloren oder Login
  scheitert): Die App bleibt unverändert. Optionen für Louis:
  - (i) nur den Safari-Tab nutzen;
  - (ii) Home-Bildschirm mit erneutem Login nach Verlust, sofern das selten passiert;
  - (iii) zurück zur Discovery.

  Kein Umbau auf Verdacht.
- **R-A1 – Login klappt nach Auslieferung A auf einem Gerät nicht:** Die Regeln sind noch
  offen (Schritt 8 noch nicht erfolgt). Merge-Commit per `git revert` zurücknehmen → Pages
  liefert in 1–2 Minuten die alte anonyme Version aus. Den Worker auf die Vorversion
  zurückrollen (`npx wrangler rollback`, **Befehl vor Umsetzung verifizieren**, sonst den
  vorherigen Commit deployen). Kein Datenverlust, weil Pfade und Daten unverändert sind.
- **R-A3 – Nach dem Scharfschalten fehlt etwas:** In der Console die Regel-Historie
  öffnen, die vorige Version wiederherstellen und bei Bedarf „Anonym“ wieder aktivieren. Das
  öffnet die Lücke vorübergehend wieder, deshalb so kurz wie möglich halten und die Ursache
  in A1/A2 beheben.
- **R-B – Plan aus Firestore fehlerhaft:** Die App fällt automatisch auf die Datei zurück.
  Dauerhaft geht es zurück, indem `plans/hm-2027` in der Console gelöscht wird (→
  `notImported`) oder per neuer Übernahme.

---

## 5. Tests (Erweiterungen)

- **Stubs (A9, `stubs.test.mjs` wacht darüber):**
  - **Jedes** `firebase-init.js`-Stub-Literal in `app.test.mjs` bekommt die neuen
    Exporte. Das sind der Standard-Stub und die Fehler-Stubs um Zeile 527, 876 und 1599.
  - Der Auth-Zustand wird per `ctx.addInitScript` gesteuert, z. B.
    `window.__AUTH__ = "ok" | "signedOut" | "forbidden" | "anonymous"`.
  - Standard ist `"ok"`; die Stub-UID liest der Test per Regex aus `config.js` statt sie zu
    kopieren.
  - `loadActivePlanDoc` liefert standardmäßig `null`.
  - Der `config.js`-Stub bekommt `ALLOWED_UID`.
- **Browser-Szenarien:**
  - die Auth-Zustände wie in der Abnahme von A1;
  - der Coach-Request trägt `Authorization`, ohne Token gibt es 0 Coach-Requests und der
    Fallback erscheint;
  - Strava `/refresh` bekommt 401 → genau ein Retry;
  - die Plan-Lade-Matrix aus B2;
  - Import-Ablehnung;
  - Anzeige „Datei neuer“.
- **`worker.test.mjs`:**
  - Testschlüssel per `crypto.subtle.generateKey` erzeugen, JWTs selbst signieren, den
    JWK-Abruf im bestehenden `fetch`-Mock nach URL routen.
  - 401 bei: Header fehlt, kein `Bearer`, kaputtes JWT, `alg: none`/HS256, unbekannter
    `kid`, falsche Signatur, `exp` abgelaufen, `iat` in der Zukunft, falsches `aud`/`iss`,
    fremde `sub`.
  - 500 ohne `ALLOWED_UID`/`FIREBASE_PROJECT_ID`.
  - Gültig → die Route läuft.
  - JWK-Cache: zwei Requests → ein Abruf; unbekannter `kid` → einmal neu laden.
  - `OPTIONS` erlaubt `Authorization`.
  - Alle bestehenden `/coach`-, `/exchange`- und `/refresh`-Tests laufen mit gültigem Token
    weiter (gemeinsamer Helfer).
- **Node:** `access.test.mjs`, `config-consistency.test.mjs`.
- Regeln werden nicht automatisch getestet (Emulator wäre eine Dependency). Geprüft wird per
  Louis-Schritt 9.

---

## 6. Aufteilung coder / frontend-designer

- **coder:** `spike/`, `access.js`, die gesamte Logik und Verdrahtung in `firebase-init.js`,
  `app.js`, `strava.js`, `plan-store.js`, `worker.js`, `wrangler.toml`, `config.js`,
  `firestore.rules`, Tests, Doku. Markup in `view-account.js` nur mit bestehenden bzw. vom
  Designer genannten Klassen, ohne Inline-Styles.
- **frontend-designer:** `style.css` und eine kurze Markup-Referenz (Abschnitt in
  `docs/ui-markup-dashboard-v2.md` oder eigene Datei) für Anmelde-Bildschirm, „Kein
  Zugriff“ und Konto-Karte (inkl. der B2-Zustände). Prüft fluid-responsive durch echtes
  Ändern der Fensterbreite.

---

## 7. Risiken

- **R1 Home-Bildschirm-App:** Sitzung, Schlüsselbund-Ausfüllen oder IndexedDB können sich
  dort anders verhalten als im Tab. Die Home-Bildschirm-App hat außerdem eigenen Speicher,
  also eine eigene Anmeldung. → S0 klärt das, bevor gebaut wird.
- **R2 Offline-Start:** `authReady()` muss die gespeicherte Sitzung ohne Netz liefern;
  `getDoc` darf beim Plan-Laden nicht hängen (Timeout + Cache). → S0 Flugmodus, B2-Abnahme.
- **R3 JWK-Endpunkt:** Liefert Google die Schlüssel nur als X.509-Zertifikate, muss der
  Worker SPKI selbst aus dem Zertifikat lösen (ohne Bibliothek machbar, aber fehleranfällig).
  Ist das nicht sauber lösbar → Dependency-Gate. **Vor A2 verifizieren.**
- **R4 Offene Offline-Schreibvorgänge der anonymen Sitzung** gehen beim Abmelden nicht mehr
  raus → Louis-Schritt 5.
- **R5 Deploy-Fenster** zwischen Worker und Pages (Minuten): Coach zeigt den Fallback, ein
  Strava-Refresh kann scheitern. Akzeptiert, siehe Schritt 6.
- **R6 UID-Tippfehler** würde Louis aus der App (nicht aus der Console) aussperren. → Die
  UID kommt aus der Console (S0), die Konsistenz-Prüfung hält die drei Stellen gleich, und
  „Kein Zugriff“ zeigt die angemeldete UID an.
- **R7 Öffentliches Repo:** Doku und Commit-Texte beschreiben die bisherige Lücke nicht.
  Details bleiben in `.private/security-notes.md`.
- **R8 Notfall-Kopie veraltet** nach Schritt-2-Änderungen. Für 1b nicht relevant, weil die
  Datei bis Schritt 2 die Quelle der Übernahmen bleibt.

## 8. Offene Fragen an Louis

1. **G1 bestätigen:** E-Mail + Passwort als einzige Methode in 1b, Passkey in den Backlog.
   **Google-Popup zusätzlich: ja oder nein?** Vorschlag: nein. Es bringt gegenüber dem
   Schlüsselbund kaum Komfort, in der Home-Bildschirm-App ist es fraglich, und es bräuchte
   `louisbhr.github.io` als autorisierte Domain.
2. **G4 bestätigen:** `latestVersion` als zusätzliches Meta-Feld und Versionen als flaches
   Plan-Objekt + `source`/`importedAt`.

Technisch zu verifizieren, keine Frage an Louis: die Console-Option „Selbstregistrierung
aus“, die JWK-URL (R3), `wrangler rollback` und das Verhalten von `initializeAuth` ohne
Resolver (S0).

Aufwand: **mittel.** S0 klein (0,5 Sitzung + Louis' Gerätetest), A 1–2 Sitzungen, B ca. 1
Sitzung. Visual Plan: nicht publiziert (Plan-MCP-Tools im Planner-Subagent nicht
verfügbar). Die Schwelle ist erreicht (Security, Schema, API), Publizieren durch
Orchestrator oder architecture-reviewer möglich.
