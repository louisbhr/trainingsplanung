# Code-Review Schritt 1b – Login, Meilenstein A

Stand: 20.10.2026 · Branch `login-1b` · Diff `0c7fe21..HEAD` (8c7961a, 3d95322, e6adfd7, dazu der
Security-Fix eb70d11)
Maßstab: docs/plan-login-1b.md (S0, A1, A2), docs/review-architecture-login-1b.md (Auflagen B1 bis
B12 verbindlich, E1 bis E6 bestätigt), HANDOFF.md, CLAUDE.md.

**Urteil: freigegeben.** Es gibt keine Critical- und keine Important-Befunde im Code. Eine
Spec-Abweichung ist im Ablauf noch offen: Das Styling kommt vom coder statt vom frontend-designer
(S1 unten). Sie blockiert diesen Schritt nicht, muss aber vor Louis' Test (Schritt 12) geklärt
sein. Dazu kommen sechs Minor-Punkte.

## Selbst geprüft (nicht aus Selbstberichten übernommen)

- `npm test` mit `npm run serve` (:8099) zweimal selbst laufen lassen, zuletzt auf eb70d11: alle
  Node-Suiten grün (metrics 38, coach 28, worker 73, access 18, consistency 6, dazu plan,
  golden, runmatch, progression, version und stubs) und 336/336 Browser-Checks.
- **Echte Google-Schlüssel:** Den JWK-Endpunkt live abgerufen. Er liefert `kty: RSA`,
  `alg: RS256`, `use: sig` und `Cache-Control: max-age≈20000`. Alle vier Schlüssel lassen
  sich mit genau dem Import aus `fetchSigningKeys` laden (RSASSA-PKCS1-v1_5, 2048 Bit). Filter
  und TTL-Logik passen also zum echten Endpunkt.
- **Claims gegen echte Firebase-ID-Tokens:** `aud` = Projekt-ID, `iss` =
  `https://securetoken.google.com/<projekt>`, `sub` = UID, `iat`, `exp`, `auth_time` und
  `firebase.sign_in_provider`. Namen und Typen stimmen. Die Toleranzen entsprechen B1
  (exp 30 s, iat/auth_time 60 s).
- **Echter Browser, echte CORS-Preflight:** Ich habe den Worker hinter einem Node-Server laufen
  lassen und von `localhost:8099` aus mit `Authorization` aufgerufen. Ergebnis:
  `OPTIONS → 204` (Chromium fragt `authorization,content-type` an), danach `POST → 401` mit
  lesbarem Body `{ error: "unauthorized", … }`. Die CORS-Header sitzen also auch auf der 401.
- **Echtes Modul ohne Stubs:** Die App mit dem echten `firebase-init.js` in einem frischen Profil
  geladen, mit `?code=` in der URL. Ergebnis: Anmeldebildschirm, keine Tableiste, **kein iframe**
  zu `firebaseapp.com`, **kein** Firestore-Netzverkehr vor dem Login, der `?code=` bleibt in der
  URL stehen. Ein falsches Passwort gegen das echte Projekt zeigt „E-Mail oder Passwort stimmt
  nicht.“ im Formular.
- Wegwerf-Proben liegen außerhalb des Repos und wurden nicht committet.

## Spec-Abweichungen (Stufe 1)

Bewertung der sieben Abweichungen, die der coder gemeldet hat:

| Nr. | Abweichung | Bewertung |
| --- | --- | --- |
| 1 | Login-Fehler im Formular (`.auth-error`, `role="alert"`) statt in der Firebase-Fehlerkarte | **Akzeptieren.** Das ist besser als der Plan: Die E-Mail bleibt stehen, der Fehler steht am Feld, und alles bleibt in einem Schirm. Abnahmetext in A1 entsprechend lesen. |
| 2 | Anonym-Pfad lädt nach dem Flush nicht neu | **Akzeptieren.** B6 verlangt das Neuladen, damit keine Daten im Speicher bleiben. Im Anonym-Pfad wurde aber noch nichts geladen, denn das Gate steht vor `loadPlans` und vor jedem Firestore-Zugriff (Browser-Check 30d: 0 Firestore-Aufrufe). Das echte „Abmelden“ lädt weiter neu (app.js:2009 ff.). |
| 3 | `AUTH_MODE=report` blockiert auch bei fehlender Konfiguration nicht | **Akzeptieren.** „Report blockiert nie“ (B2) hat hier Vorrang. Der Worker ist in dieser Phase nicht offener als heute, und der Fehler fällt in Phase 2 auf: `wrangler tail` zeigt dann `auth: not_configured` statt `auth: ok`. Grenze: Die Notsperre „`ALLOWED_UID` leer“ (B1) wirkt erst ab `required`, also Phase 2 kurz halten. |
| 4 | Worker-Import mit `?t=` in den Tests | **Keine Abweichung.** B11 nennt genau diesen Weg. |
| 5 | Check auf den neuen Kartentext umgestellt (`"Anonymous"` → `"angemeldet"`) | **Akzeptieren.** Der Plan verlangt den neuen Kartentext (A1). Der Check prüft weiterhin Quelle, Originalmeldung und dass kein „Neu verbinden“ erscheint. |
| 6 | Styling selbst in `style.css` geschrieben | **Offen (S1).** CLAUDE.md und Plan A1/§6 legen Styling in die Hand des frontend-designers. Handwerklich sauber: Es nutzt nur vorhandene Tokens, alle geprüft. Die Felder haben 16 px, die Knöpfe 44 px, und es gibt kein seitliches Scrollen bei 320/390/1280. Dunkelmodus ist per Screenshot belegt. Die Rollenregel ist trotzdem verletzt. **Vor Schritt 12:** entweder ein kurzer Pass des frontend-designers (Anmelde-Schirm, „Kein Zugriff“, Hinweis zu offenen Einträgen, Konto-Karte, inkl. echter Größenänderung) oder Louis verzichtet ausdrücklich darauf. |
| 7 | „Abmelden“ ohne Bestätigungsdialog | **Akzeptieren.** Der Plan verlangt keinen. Die Karte sagt vorher, was passiert. Bei offenen Einträgen bricht das Abmelden ab, ohne etwas zu löschen (Check 30f). Ein Fehltipp kostet nur ein erneutes Anmelden per Schlüsselbund, Serverdaten gehen nicht verloren. |

Weitere Abgleiche ohne Befund:
- Die Doku (README, HANDOFF, tests/README) ist schon in A nachgezogen statt erst in B3. Das ist
  in Ordnung. REQUIREMENTS.md und backlog.md bleiben für B3.
- S0/B8: `spike/` und `spike-logic.test.mjs` wurden in 8c7961a gelöscht, wie verlangt direkt
  nach S0.
- Öffentliches Repo (R7, B12): Commit-Texte und Doku beschreiben keine Zugriffslücke. Der alte
  README-Absatz zur offenen Regel wurde entfernt, nicht umformuliert. Gut.

## Schwerpunkte (Stufe 2)

**Aussperr- und Datenverlust-Risiken im Rollout: ok.**
- Anonym-Sitzung (B5): `handleAnonymousSession` (app.js:1987) wartet mit 10 s Timeout auf
  `waitForPendingWrites`. Bei Timeout wird **nicht** abgemeldet, es erscheint eine Karte mit
  „Erneut versuchen“ und ohne „Trotzdem“. Die Checks 30d und 30e decken beide Wege ab, 30e
  sogar mit `page.clock`.
- Abmelden räumt das Gerät (E4/B6, firebase-init.js:162): Reihenfolge Flush → `signOut` →
  `terminate` → `clearIndexedDbPersistence` → `hm-tracker.*` löschen → Neuladen. Bei offenen
  Einträgen wird abgebrochen, ohne etwas zu löschen. Der Präfix deckt die Plan-Kopie
  (`hm-tracker.plan.*`) und den Override-Schlüssel ab. Mehr eigene Schlüssel gibt es nicht.
- Restrisiko (kein Code-Befund): Öffnet ein Gerät die neue Version erst **nach** dem
  Veröffentlichen der Regeln (Louis-Schritt 8), lehnt der Server die anonymen Writes ab. Sie
  sind dann verloren, auch wenn `waitForPendingWrites` auflöst. Gegenmittel ist die Reihenfolge
  der Louis-Schritte: 5 und 7 auf **allen** Varianten vor Schritt 8. Das steht so im Plan.
- Aussperren ist ausgeschlossen: Die UID ist an drei Stellen gleich (Konsistenz-Test inkl.
  Muster, Platzhalter fällt durch), und „Kein Zugriff“ zeigt die UID an.

**Token-Prüfung im Worker (B1): ok.** Die Längengrenze steht vor dem Parsen. Es müssen genau
drei Teile sein, jedes Segment base64url, und Header wie Payload müssen JSON-Objekte sein.
`alg` muss exakt `RS256` sein, `kid` ein nicht-leerer String, die Claims sind typisiert.
Fehlende oder nach `trim()` leere Konfiguration führt zu 500. Der JWK-Filter greift, gecacht
werden die importierten CryptoKeys. Die TTL ist auf 60 s … 24 h eingegrenzt, Standard 1 h.
Neu geladen wird höchstens einmal pro 60 s, gleichzeitige Abrufe teilen sich einen. Gilt
stale-if-error länger als 1 h oder fehlt der Cache ganz, antwortet der Worker mit 503
`auth_unavailable`. Alle Prüffehler liefern dieselbe 401. Ins Log geht nur der Grund-Code, nie
Token oder UID (eigener Test). Die Prüfung läuft vor dem Lesen des Bodys (Test mit kaputtem
JSON → 401).

**AUTH_MODE-Defaults: ok.** Nur exakt `"report"` gilt als report. `undefined`, `""`, `"bogus"`,
`"Report"` und `"report "` führen zu `required` (Tests). `wrangler.toml:26` steht für Phase 1
korrekt auf `report`.

**CORS mit Authorization: ok.** Im echten Browser geprüft (siehe oben).

**Retry nur bei `error === "unauthorized"`: ok.** `fetchWithAuthRetry` (access.js) prüft
`status === 401` und das Feld per `clone()`. Das ergibt genau einen Retry mit `force`. Ein
Strava-401 ohne das Feld und ein 503 lösen keinen Retry aus. Abgedeckt ist das sowohl in Node
als auch im Browser (Coach und `/refresh`). Ein Retry bei `/exchange` ist sicher, weil der
Worker ablehnt, bevor Strava den Code sieht. Seit eb70d11 geht das Token nur an den eigenen
Worker-Origin, und den Override gibt es nur noch auf localhost.

**Strava-Redirect nach dem Login (B4): ok.** Der Login setzt `init()` im selben Seitenaufruf
fort (app.js:2040). Check 32 belegt: abgemeldet 0 `/exchange`-Aufrufe, nach dem Login genau
einer mit Token und Originalcode, danach ist die URL bereinigt.

**Races im Gate: ok.** `init()` wartet auf `authStateReady()`, das gilt auch offline. Das
Memo in `ensureSignedIn` wird bei jedem `onAuthStateChanged` und in `signOutUser` geleert
(B6). Ein laufendes `ensureSignedIn` liest `currentUser` erst nach `authStateReady`. Beim
Login ist der Knopf gesperrt, ein Doppel-Submit ist also nicht möglich. `startApp` hängt keine
eigenen Listener an, deshalb ist ein zweiter `init()`-Lauf (retry-pending, Login) harmlos.

**Stubs und Tests nicht tautologisch: ok** (Ausnahme N5). Der Firebase-Stub bildet die Zustände
ab, die Logik in `app.js` läuft echt. `__FS_CALLS__` zählt in jedem Datenzugriff. Die
Worker-Tests signieren mit eigenen RSA-Schlüsseln, darunter „falscher Schlüssel, gleiche
`kid`“ und „Payload nach dem Signieren verändert“. Die echten Firebase-Funktionen
(`signOutAndWipeDevice`, `ensureSignedIn` mit UID-Prüfung) sind nicht automatisch getestet.
Ohne Emulator geht das nicht. Meine Probe mit dem echten Modul deckt den Start ab, Abmelden
und Räumen prüft Louis in Schritt 9.

## Befunde

### Critical
Keine.

### Important
Keine.

### Minor

- **N1 Coach zählt Auth-Fehler als Generierung** (coach.js:195). Der Versuch wird vor dem Aufruf
  gezählt (absichtlich, A4/K2). Ein 401 nach dem Retry oder ein 503 `auth_unavailable`
  verbraucht deshalb ein Tageskontingent. Fällt Google aus oder ist der Worker falsch
  konfiguriert, kann das Tageslimit ohne einen einzigen echten Claude-Aufruf aufgebraucht sein.
  Fix (optional): `requestCoach` bekommt aus `fetchWorker` ein Kennzeichen „nicht gezählt“
  (z. B. Status 401/503 mit `error` in {unauthorized, auth_unavailable}) und schreibt
  `generations` dann auf den alten Wert zurück. Alternativ akzeptieren, weil der Fall selten
  ist.
- **N2 Irreführender Text offline** (strava.js:58). Jeder Firebase-Fehler beim Token, also auch
  `auth/network-request-failed`, wird zu „Anmeldung abgelaufen, bitte neu laden.“. Fix: Bei
  `err.code === "auth/network-request-failed"` die bestehende Netzwerkmeldung zeigen.
- **N3 Abmelden in einem anderen Tab** wird nicht bemerkt. Die App zeigt bis zum Neuladen weiter
  geladene Daten, Firestore-Zugriffe laufen dann auf die Fehlerkarte. Fix (optional): Nach
  `startApp` per `onAuthStateChanged` neu laden, sobald die UID nicht mehr `currentUser.uid`
  ist.
- **N4 Räumen bei offenem zweitem Tab** (firebase-init.js:171). `clearIndexedDbPersistence`
  scheitert mit `failed-precondition`, wenn ein anderer Tab Firestore hält (multi-tab). Das
  landet nur im `console.warn`, die Karte sagt trotzdem „geräumt“. Fix: `{ ok: true,
  cacheCleared: false }` zurückgeben und nach dem Neuladen bzw. per Toast „Bitte andere Tabs
  schließen und erneut abmelden“ zeigen.
- **N5 Wirkungsloser Teil-Check** (tests/worker.test.mjs:509–518). `bodies` sammelt nur
  `{ status }`, `bodies.size === 1` prüft also nichts zusätzlich, denn `assertUnauthorized`
  vergleicht den Body schon vollständig. Fix: die Zeilen entfernen oder den Body hineinnehmen.
- **N6 Commit-Autor im öffentlichen Repo.** Die Commits ab 0c7fe21 tragen
  `louisbehre@h93-189.cit.hs-offenburg.de`, also einen Hostnamen aus dem Hochschulnetz. Ein
  älterer Commit trägt schon `…fritz.box`. Das ist kein Code-Fehler. Vor dem Push empfehle ich
  `git config user.email 80367378+louisbhr@users.noreply.github.com` im App-Repo. Ob die
  ungepushten Commits umgeschrieben werden, entscheidet Louis. Dieses Review habe ich mit der
  noreply-Adresse committet.

### Hinweise zum Rollout (kein Befund)
- `AUTH_MODE = "report"` steht öffentlich im Repo. Phase 1 und 2 deshalb wie in B2 am selben Tag
  abschließen. Smoke für Phase 3: `curl` ohne Token → 401, Müll-Token → 401 **und** ein echter
  Aufruf aus der App → 200 (nicht 500), damit eine fehlende Konfiguration auffällt.
- Bei einer Schlüsselrotation innerhalb von 60 s nach einem Neuladen, das jemand mit einer
  erfundenen `kid` ausgelöst hat, bekommt ein echtes Token für höchstens 60 s eine 401. Google
  veröffentlicht neue Schlüssel vor ihrer Nutzung, das ist also praktisch irrelevant und nach B1
  akzeptiert.

## Fix-Liste für den coder

Keine Pflicht-Fixes. N1 bis N5 sind optional (empfohlen: N2, N5, weil sie billig sind). S1
liegt nicht beim coder, sondern geht an den frontend-designer oder an Louis zur Entscheidung.
