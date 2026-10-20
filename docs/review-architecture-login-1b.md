# Architektur-Review: Schritt 1b — Echtes Login + Plan nach Firestore

Stand: 03.10.2026 · architecture-reviewer · Grundlage: `docs/plan-login-1b.md`,
`docs/requirements-login.md`, `docs/requirements-marathon-coaching.md` (M5, M9), Code-Stand
Branch `login-1b` (`worker.js`, `firebase-init.js`, `firestore.rules`, `plan-store.js`,
`strava.js`, `app.js` init, `config.js`, `wrangler.toml`, `tests/app.test.mjs`,
`tests/stubs.test.mjs`).

Hinweis öffentliches Repo: Dieses Dokument beschreibt die bisherige Zugriffslücke bewusst
nicht. Details bleiben in `.private/security-notes.md`.

## Gesamturteil

**Freigabefähig mit Auflagen (B1–B12).** Die Grundrichtung stimmt: E-Mail + Passwort ohne
Redirect-Resolver, feste UID in Regeln und Worker, Token-Prüfung über Web Crypto ohne
Bibliothek, Versionen in einer Untersammlung, Rollout mit offenen Regeln zuerst. Keine neue
Dependency. Vier Punkte müssen vor der Umsetzung in den Plan:

1. Der Worker-Wechsel braucht keinen Ausfall: erst ein **Übergangsmodus**, dann Pflicht (B2).
2. Ausstehende Schreibvorgänge der anonymen Sitzung schützt die App selbst mit
   `waitForPendingWrites` (B5). „Einmal mit Netz öffnen“ bleibt nur als zusätzliche Vorsicht.
3. Der Spike teilt sich den Speicher (Origin) mit der Live-App. Er braucht deshalb eine
   **eigene Firebase-App-Instanz** und darf kein Dokument mit Zugangsdaten lesen (B8).
4. Versions-Dokument **verschachtelt** statt flach (E3, Empfehlung), damit Schritt 2 nur
   Felder ergänzt.

Visual Plan: nicht publiziert. Die Plan-MCP-Tools stehen in diesem Subagent nicht zur
Verfügung, und die Entscheidungen hier sind Sicherheits- und Ablauffragen, die sich als
Text gut prüfen lassen.

---

## Gates G1–G7

| Gate | Urteil | Kurz |
| --- | --- | --- |
| G1 Auth-Methode | **ok** | E-Mail + Passwort, `initializeAuth` ohne `popupRedirectResolver`, Konto in der Console. Google-Popup: nein. Ergänzung B10 (7-Tage-Regel in Safari). |
| G2 Zugriffsprüfung | **ok mit Auflage** | Anonym-Pfad mit `waitForPendingWrites` (B5), `ensureSignedIn`-Memo beim Abmelden zurücksetzen (B6), nach dem Abmelden neu laden. |
| G3 Firestore-Regeln | **ok mit Auflage** | Regeltext passt und deckt `plans/**` ab. Prüfung zusätzlich über den Rules Playground der Console (B7). Selbstregistrierung aus und Schutz vor E-Mail-Enumeration prüfen. |
| G4 Schema | **ok mit Änderung** | `latestVersion` ja. Versions-Dokument verschachtelt `{ plan, … }` plus Feld `n` (E3). Transaktion prüft, dass `versions/{n}` noch nicht existiert (B9). |
| G5 Worker-API | **ok mit Auflagen** | Claim-Liste ist vollständig. Ergänzen: Längenlimit, einheitliche 401 mit `error: "unauthorized"` auf allen Routen, 503 wenn keine Schlüssel verfügbar sind, JWK-Filter, Übergangsmodus (B1–B4). |
| G6 Dependencies | **ok** | Keine neuen. `waitForPendingWrites`, `terminate`, `clearIndexedDbPersistence` und `runTransaction` stammen aus derselben Firestore-CDN-Version 10.13.0. Risiko R3 entfällt (JWK-Endpunkt liefert RS256-JWKs, vom Orchestrator verifiziert). |
| G7 Dateien | **ok mit Änderung** | `access.js`, `view-account.js` und Tests wie geplant. `spike/` erst nach den Auflagen aus B8 und **früher löschen** (direkt nach S0, spätestens im ersten Commit von A1, nicht erst in B3). |

---

## Auflagen

### B1 Token-Prüfung im Worker: reicht der Plan?

Die Claim-Liste (alg RS256 mit `kid`, Signatur, `aud`, `iss`, `exp`, `iat`, `auth_time`,
`sub === ALLOWED_UID`) ist **inhaltlich vollständig**. Damit sie robust ist, fehlt noch
Folgendes:

- **Vor dem Parsen:** Token-Länge begrenzen (z. B. ≤ 4096 Zeichen), genau drei Teile,
  jedes Segment base64url. Header und Payload müssen JSON-Objekte sein. Jeder Parse-Fehler
  → 401.
- **Header:** `alg` exakt `"RS256"` (Whitelist mit einem Eintrag; `none`, `HS*`, `RS512` …
  werden abgelehnt). `kid` muss ein nicht-leerer String sein. `typ` ignorieren.
- **Claims typisieren:** `exp`, `iat` und `auth_time` müssen endliche Zahlen sein, `sub` ein
  nicht-leerer String. Toleranz für Uhrabweichung: `exp > now - 30`, `iat <= now + 60`,
  `auth_time <= now + 60`. Nur `iat`/`auth_time` bekommen 60 s, `exp` höchstens 30 s.
- **Konfiguration, fail closed:** `ALLOWED_UID` oder `FIREBASE_PROJECT_ID` fehlt **oder ist
  nach `trim()` leer** → 500 `not_configured`. Ein leerer String darf nie als „erlaubt“
  durchgehen.
- **JWK-Behandlung:** Nur Schlüssel mit `kty === "RSA"` und (falls vorhanden) `alg ===
  "RS256"` und `use === "sig"` übernehmen. Import per `crypto.subtle.importKey("jwk", …,
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])`. Die **importierten
  CryptoKeys** je `kid` cachen, nicht nur die JSON-Daten.
- **Cache:** modulweit, Gültigkeit = `max-age` aus `Cache-Control`, eingegrenzt auf
  60 s … 24 h. Fehlt der Header oder ist er unlesbar → 1 h. Ein Isolate-Cache reicht (bei
  Kaltstart ein zusätzlicher Abruf), Cache API oder KV sind nicht nötig.
- **Schlüsselrotation:** Google veröffentlicht neue Schlüssel, bevor damit signiert wird,
  und alte bleiben noch eine Weile im Set. Ein unbekannter `kid` führt zu höchstens einem
  Neuladen pro 60 s und Isolate (wie geplant). Ist der `kid` danach immer noch unbekannt
  → 401.
- **Schlüssel nicht abrufbar** (Google nicht erreichbar, kein gültiger Cache) → **503**
  `{ error: "auth_unavailable" }`, **nicht** 401. Sonst hält der Client einen Ausfall bei
  Google für eine abgelaufene Anmeldung und erneuert das Token sinnlos. Ein abgelaufener
  Cache darf bei einem Abruffehler höchstens 1 h weiterverwendet werden (stale-if-error),
  danach 503.
- **Fehlerform ohne Leak:** Jeder Prüffehler liefert **dieselbe** Antwort, `401 { error:
  "unauthorized", message: "Anmeldung erforderlich" }`, auf **allen** Routen (siehe B3). Der
  Grund wird nur intern als kurzer Code geloggt (`auth: invalid:exp`), **nie** das Token
  und nie Claims außer einem Code.
- **Bekannte Grenze, akzeptiert:** Ein ID-Token gilt bis zu 1 h. Sperrt Louis sein Konto
  oder ändert er das Passwort, bleibt ein schon ausgestelltes Token so lange gültig
  (Firestore und Worker). Für einen Ein-Nutzer-Fall ist das ausreichend. Im Notfall kann
  Louis `ALLOWED_UID` per Deploy auf einen leeren Wert setzen; das sperrt sofort, weil der
  Worker dann mit `not_configured` ablehnt.
- Optional und billig: `firebase.sign_in_provider === "anonymous"` → 401. Das ist doppelt
  gemoppelt, denn `sub`-Bindung schließt anonyme Konten bereits aus, schadet aber nicht.

Mit diesen Ergänzungen reicht die Prüfung. Eine Bibliothek ist nicht nötig.

Korrektur am Plan: `checkAccess` aus M2 existiert im Code nicht. Der Einhängepunkt ist der
Block nach Origin- und Methodenprüfung in `fetch()` von `worker.js`. Die Reihenfolge
OPTIONS → Origin → Methode → Token → Route bleibt richtig: Das Token wird geprüft, bevor
der Body gelesen wird.

### B2 Rollout ohne Ausfallfenster: Übergangsmodus im Worker (Empfehlung)

Heute erlaubt der Worker nur `Content-Type` als Header. Das neue Frontend schickt
`Authorization`, und der Preflight scheitert am alten Worker. Das alte Frontend wiederum
bekommt vom neuen Worker 401. Beide Reihenfolgen haben also ein Fenster. Dazu kommt, dass
Geräte mit noch geladener alter Version (Home-Bildschirm-App ohne Neuladen, Pages-Cache
etwa 10 min) länger brauchen als „ein paar Minuten“.

**Empfohlene Variante: drei Phasen über eine Variable `AUTH_MODE` in `wrangler.toml [vars]`**
(nicht im Dashboard, siehe Lektion M2):

1. **Worker deployen mit `AUTH_MODE = "report"`.** CORS erlaubt `Content-Type,
   Authorization`. Der Worker prüft ein mitgeschicktes Token vollständig und loggt das
   Ergebnis (`auth: ok` / `missing` / `invalid:<code>`), **blockiert aber nie**. Das alte
   Frontend läuft unverändert weiter. Smoke-Test: Coach und Strava funktionieren wie
   vorher.
2. **PR mergen → Pages.** Louis meldet sich auf allen drei Varianten an. Währenddessen
   beobachtet der Orchestrator `npx wrangler tail`: Jeder Request des neuen Frontends muss
   `auth: ok` zeigen. So ist die echte Token-Prüfung **live gegen echte Google-Schlüssel
   bewiesen**, bevor sie bindend wird. `invalid:*` → Fehler beheben, nichts ist kaputt.
3. **`AUTH_MODE = "required"` (Ein-Zeilen-Commit) + `npx wrangler deploy`**, am selben Tag.
   Smoke: `curl` ohne Token → 401, mit Müll-Token → 401.

Regeln:
- **Fehlt `AUTH_MODE` oder hat sie einen unbekannten Wert → `required`** (fail closed).
  Dazu gibt es einen Test.
- Im Report-Modus ist der Worker genau so offen wie heute, also keine Verschlechterung. Die
  Phase deshalb kurz halten (Stunden, nicht Tage).
- Der Report-Zweig wird in B3 (Aufräumen) wieder **entfernt**, damit kein Schalter
  liegenbleibt.
- Rollback in jeder Phase: `npx wrangler rollback` auf die Vorversion (Befehl verifiziert).
  Die `[vars]` gehören zur Worker-Version. Nach einem Rollback einmal prüfen, dass
  `AUTH_MODE` den erwarteten Wert hat.

Neue Reihenfolge der Louis-Schritte 6–11: (6a) Worker `report` deployen → (6b) PR mergen
→ (7) Anmelden auf drei Varianten + tail prüfen → (7b) Worker `required` deployen →
(8) Regeln veröffentlichen → (9) Prüfen inkl. Rules Playground und privatem Fenster →
(10) Anonym aus → (11) Strava widerrufen + neu verbinden.

### B3 Einheitliche 401 und Retry nur bei Worker-Auth-Fehlern

`/exchange` und `/refresh` reichen den **Statuscode von Strava** durch (`json(data,
res.status, cors)`). Ein 401 kann dort also auch von Strava kommen. Der geplante Retry in
`strava.js` („bei 401 Token erneuern und wiederholen“) würde dann Strava-Fehler fälschlich
als Anmeldeproblem behandeln.
- Die Auth-401 des Workers enthält auf **allen** Routen `error: "unauthorized"` (für
  `/exchange` und `/refresh` additiv zu `message`; `strava.js` liest `message` weiter).
- `strava.js` und `app.js` erneuern das Token **nur**, wenn `status === 401 && error ===
  "unauthorized"`, und zwar genau einmal mit `getIdToken(true)`.
- Der Retry bei `/exchange` ist sicher: Der Worker lehnt ab, bevor Strava den Einmal-Code
  sieht.
- Coach (`app.js`): Bei 401 reicht ebenfalls ein Retry, danach Fallback. 503
  `auth_unavailable` → sofort Fallback, kein Retry.

### B4 Strava-Redirect während abgemeldet

Kommt Louis von Strava mit `?code=` zurück und ist abgemeldet (z. B. nach der 7-Tage-Regel
in Safari, B10), muss der Code den Login überleben. Deshalb: nach erfolgreicher Anmeldung
`init()` **im selben Seitenaufruf fortsetzen** (nicht neu laden und nicht die URL
bereinigen), damit `handleAuthRedirect()` den Code noch einlöst. `handleAuthRedirect()`
läuft nur im Zustand `ok`. Dafür gibt es einen Browser-Test.

### B5 Ausstehende Schreibvorgänge der anonymen Sitzung

Firestore hält ausstehende Schreibvorgänge **je Nutzer** in IndexedDB. Nach dem Abmelden
des anonymen Nutzers werden sie unter dem neuen Nutzer nie gesendet, und nach dem
Scharfschalten der Regeln würden sie abgelehnt. Das ist praktisch Datenverlust.
„Einmal mit Netz öffnen“ reicht meistens, ist aber eine manuelle Vorsichtsmaßnahme ohne
Garantie.

**Auflage:** Im Zustand `anonymous` vor `signOutUser()`:
`await Promise.race([waitForPendingWrites(db), timeout(10 s)])`.
- Aufgelöst → still abmelden, Login zeigen.
- Timeout → **nicht** abmelden. Karte: „Es gibt noch nicht übertragene Einträge. Bitte mit
  Netz erneut öffnen.“ mit Knopf „Erneut versuchen“. Kein „Trotzdem fortfahren“; die
  Console bleibt der Notausgang.

Da die neue Version ohnehin nur mit Netz geladen wird (kein Service Worker), löst das in
der Praxis sofort auf. Louis-Schritt 5 bleibt als zusätzliche Vorsicht. Wegen B8 muss
Schritt 5 außerdem **vor** S0 kommen.

Dieselbe Funktion nutzt das normale „Abmelden“ im Plan-Tab (B6).

### B6 Abmelden: Zustand und Datenreste auf dem Gerät

- `ensureSignedIn()` merkt sich heute sein Promise (`signInPromise`). Nach dem Abmelden
  würde es den alten Nutzer weiter liefern. Das Promise muss deshalb bei jedem
  `onAuthStateChanged` bzw. in `signOutUser()` zurückgesetzt werden. Es wirft ohne
  passenden Nutzer (wie geplant).
- Nach `signOutUser()` immer `location.reload()`, damit keine Daten im Speicher bleiben
  (Pläne, Strava-`runCache`, Coach-Texte).
- **Datenreste:** Der Firestore-Offline-Cache (IndexedDB) und die Plan-Kopie in
  `localStorage` bleiben nach `signOut` auf dem Gerät. Die Regeln greifen nicht auf den
  lokalen Cache. Wer das entsperrte Gerät hat, ist aber ohnehin in der App. Das Risiko ist
  also klein, aber real, wenn Louis abmeldet, um ein Gerät abzugeben. Vorschlag (E4):
  „Abmelden“ = `waitForPendingWrites` (mit Timeout, sonst abbrechen mit Hinweis) →
  `signOut` → `terminate(db)` → `clearIndexedDbPersistence(db)` → eigene
  `localStorage`-Schlüssel (`hm-tracker.*`) löschen → neu laden. Das ist **nicht** für den
  stillen Anonym-Pfad (B5) gedacht, dort bleibt der Cache.
  Hinweis: Die Plandatei ist öffentlich (Pages), die Plan-Kopie also nicht vertraulich. Bei
  Schritt-2-Plänen ohne Datei-Kopie ist das anders.

### B7 Firestore-Regeln

- Der Regeltext aus G3 passt. `match /{document=**}` gilt rekursiv und deckt damit auch
  `plans/hm-2027/versions/{n}` und alle Schritt-2-Sammlungen ab (L2, M9). Lesbarer als
  Funktion:
  ```
  function isLouis() { return request.auth != null && request.auth.uid == "<LOUIS_UID>"; }
  match /{document=**} { allow read, write: if isLouis(); }
  ```
- **Unveränderliche Versionen** lassen sich mit der rekursiven Regel nicht erzwingen (Regeln
  werden mit ODER verknüpft). Dafür müsste man jede Sammlung einzeln aufzählen, und das
  widerspricht L2. → In 1b sichert die App das ab (B9), in Schritt 2 neu bewerten.
- **Prüfung ohne Emulator (keine Dependency):** Der **Rules Playground** in der Console
  (Firestore → Regeln → „Rules Playground“) ist bei Louis-Schritt 9 Pflicht, und zwar vor
  dem Deaktivieren von „Anonym“. Drei Simulationen auf `config/strava` und
  `plans/hm-2027/versions/1`: nicht angemeldet → verweigert, angemeldet mit fremder UID →
  verweigert, Louis' UID → erlaubt. Dazu der echte Test im privaten Fenster.
- Console: **Selbstregistrierung aus** (falls angeboten) und **Schutz vor
  E-Mail-Enumeration an** (Authentication → Settings) **vor S0** prüfen. Nach dem
  Scharfschalten sind fremde Konten zwar harmlos (UID-Bindung), sie sollen aber gar nicht
  erst entstehen können.
- `config-consistency.test.mjs` prüft zusätzlich `FIREBASE_PROJECT_ID` in `wrangler.toml`
  = `projectId` in `firebase-init.js`. Die UID muss einem plausiblen Muster entsprechen
  (z. B. `^[A-Za-z0-9]{20,128}$`), damit kein Platzhalter `<LOUIS_UID>` durchrutscht.

### B8 Spike S0

**Was er gefährdet:** Inhaltlich nichts Neues, denn die Firebase-Config ist ohnehin
öffentlich, und es gibt keine Secrets und keine UID-Geheimnisse. **Aber:** Spike und
Live-App liegen auf **demselben Origin** (`louisbhr.github.io`). Mit der Standard-App
`[DEFAULT]` teilen sie sich die gespeicherte Auth-Sitzung und den Firestore-Cache:
- Eine Anmeldung im Spike ersetzt im selben Browser die anonyme Sitzung der Live-App.
  Ausstehende anonyme Schreibvorgänge hängen dann fest (B5-Problem, aber ohne B5-Schutz,
  weil die Live-App noch alt ist).
- Ein Abmelden im Spike lässt die alte Live-App beim nächsten Start einen neuen anonymen
  Nutzer anlegen.

**Auflagen:**
- Der Spike nutzt eine **eigene App-Instanz**: `initializeApp(firebaseConfig, "spike")`.
  Damit bekommen Auth-Persistenz und Firestore-Cache eigene Schlüssel, und die Live-App
  bleibt unberührt.
- Der Firestore-Lesetest liest **kein Dokument mit Zugangsdaten**, auch nicht nur „existiert
  ja/nein“, denn das SDK lädt und cacht immer das ganze Dokument. Stattdessen ein
  harmloses Dokument, z. B. `dayplans/<ein Datum>` oder eine `logs`-Abfrage mit
  `limit(1)`. Für den Flugmodus-Test vorher einmal online lesen.
- Den Spike **erst lesen lassen, nachdem** E-Mail/Passwort aktiviert, Louis' Konto angelegt
  und die Selbstregistrierung (falls vorhanden) aus ist.
- Kein `signInAnonymously`, kein Token-Text in DOM oder Konsole (nur die Länge), keine
  Strava- oder Worker-Aufrufe.
- **Eigener Branch?** Nein. Pages liefert nur `main` aus, und der Home-Bildschirm-Test muss
  auf dem echten Origin laufen (eigener Speicher, Persistenz, Schlüsselbund-Domain). Ein
  lokaler Server im WLAN wäre nicht repräsentativ. Also Mini-PR nach `main` wie geplant,
  **aber löschen, sobald die S0-Ergebnisse in `.pipeline-state.md` stehen** (eigener
  kleiner Commit oder erster Commit von A1). Bei Bedarf lässt er sich aus Git
  wiederherstellen.
- `stubs.test.mjs` und `version.test.mjs` lesen nur Dateien im Wurzelverzeichnis. `spike/`
  bleibt also wirklich außen vor (geprüft: `readdirSync(root)`, nicht rekursiv).
- Prüfpunkt ergänzen: Ob mehrere Home-Bildschirm-Apps desselben Origins sich den Speicher
  teilen, ist in iOS-Versionen unterschiedlich. Für die Entscheidung zählt nur, dass die
  Sitzung **in der Home-Bildschirm-App selbst** hält.

### B9 Schema und Transaktion (G4) gegen Schritt 2

- `plans/hm-2027` = `{ activeVersion: <Zahl>, latestVersion: <Zahl>, updatedAt }`. Die
  einzige Wahrheit über „aktiv“ ist `activeVersion`. **Kein** `status` in 1b; den legt
  Schritt 2 fest (draft/active/superseded) und leitet ihn für Altversionen aus der Meta ab.
- **Versions-Dokument (E3, Empfehlung verschachtelt):**
  `versions/{n}` = `{ n, plan: <Plan-Objekt unverändert>, fileVersion, source: "file",
  importedAt }`.
  - Gründe: kein Abstreifen von Fremdfeldern vor `validatePlan` und keine Namenskollision,
    wenn Plan oder Metadaten in Schritt 2 wachsen. Schritt 2 ergänzt `status`, `reason`
    und `instructions` daneben, ohne Umbau (M5: „nur Felder ergänzen“).
  - `fileVersion` wird nach oben kopiert, damit die Konto-Karte vergleichen kann, ohne den
    Plan zu öffnen.
  - `n` als Zahlenfeld: Doc-IDs sind Strings (`"10" < "2"`). Listen in Schritt 2 sortieren
    nach `n`, nicht nach Doc-ID.
- **Transaktion:** Meta lesen, `n = (latestVersion || 0) + 1`, **`versions/{n}` lesen und
  abbrechen, falls sie existiert**, Version + Meta schreiben. Offline schlägt die
  Transaktion fehl → „Nur mit Netz“ (wie geplant).
- **`fileVersion`-Vergleich:** Format heute `"2026-09-27T16:21"`. Ein Vergleich als String
  ist nur korrekt, wenn `validatePlan` das Format per Regex erzwingt
  (`^\d{4}-\d\d-\d\dT\d\d:\d\d$`). Diese Prüfung ergänzen; ein ungültiges Format →
  `fileInvalid`.
- **Größe:** 1 MiB je Dokument, dazu **40 000 Indexeinträge je Dokument**. Die Plan-Map
  wird standardmäßig Feld für Feld indexiert. Beim HM-Plan liegt das voraussichtlich weit
  darunter, bei großen Schritt-2-Plänen kann es eng werden. In B2 beides messen. Optional
  (Console, keine Dependency): Index-Ausnahme für das Feld `plan` in der Sammlungsgruppe
  `versions`. Abgefragt wird darüber nie.
- Laden: `getDoc` mit Timeout, danach `getDocFromCache`, wie geplant. Versionen sind
  unveränderlich und lassen sich daher gut cachen.

### B10 Safari-Tab: 7-Tage-Regel

Safari löscht skriptbeschreibbaren Speicher (IndexedDB, localStorage) einer Website, die
an 7 Tagen der Safari-Nutzung nicht besucht wurde. Im **Safari-Tab** heißt das nach einer
längeren Pause: neu anmelden (Schlüsselbund + Face ID), Offline-Cache weg. Home-Bildschirm-
Apps sind davon ausgenommen. Das ist kein Blocker, gehört aber in S0 als erwartetes
Verhalten (nicht „Fehler“) und in die Doku. Es spricht zusätzlich für die
Home-Bildschirm-Variante, falls S0 sie bestätigt.

### B11 Tests und Stubs

Die Strategie des Plans trägt. Ergänzungen:
- `FIREBASE_STUB` und **jedes** Fehler-Stub-Literal bekommen `authReady`, `signIn`,
  `signOutUser`, `authHeaders` und `waitForPendingWrites` (bzw. die neue Abmelde-Funktion),
  ab B1 außerdem `loadActivePlanDoc` und `importPlanVersion`. Der Stub-Wächter erzwingt
  das ohnehin.
- Ein Zähler `window.__FS_CALLS__` in jedem Stub-Datenzugriff belegt „abgemeldet → 0
  Firestore-Aufrufe“.
- Anonym-Pfad: Stub-`waitForPendingWrites` löst auf → `signOutUser` aufgerufen; Stub hängt
  → kein `signOutUser`, Hinweiskarte sichtbar (mit `page.clock` vorspulen).
- Strava: 401 mit `error: "unauthorized"` → genau ein Retry mit `force`; 401 **ohne**
  dieses Feld (Strava-Fehler) → **kein** Retry. Coach: 503 `auth_unavailable` → Fallback
  ohne Retry.
- Strava-Redirect (`?code=`) im Zustand abgemeldet → nach dem Login genau ein
  `/exchange`-Aufruf (B4).
- `worker.test.mjs`:
  - Der Modul-Cache überlebt zwischen Tests. Deshalb entweder ein Test-Export zum
    Zurücksetzen oder Import mit `?t=` je Gruppe.
  - Zeit über einen gemockten `Date.now`.
  - Fälle: einheitlicher 401-Body für alle Gründe (kein Orakel), Token-Längenlimit, 503 bei
    JWK-Abruffehler ohne Cache, stale-if-error ≤ 1 h, leere bzw. nur aus Leerzeichen
    bestehende `ALLOWED_UID` → 500.
  - `AUTH_MODE`: `report` blockiert nie, loggt aber; `required` blockiert; fehlend oder
    unbekannt → `required`.
  - JWK mit `kty`/`alg`/`use`-Filter.
  - Node-Version: `globalThis.crypto.subtle` braucht Node ≥ 19 (sonst `node:crypto`
    `webcrypto`). Im Test einmal prüfen.
- `config-consistency.test.mjs` wie in B7 erweitert.
- Regeln: kein automatischer Test (Emulator = Dependency). Rules Playground plus privates
  Fenster gehören in die Abnahme (B7).

### B12 Kleinkram

- Nach `wrangler deploy` prüfen, dass `ALLOWED_ORIGINS`/`STRAVA_CLIENT_ID` weiter gesetzt
  sind. Sie stehen in `[vars]`, also sollte das passen; der Smoke-Test deckt es ab.
- Doku in B3 (README/HANDOFF/REQUIREMENTS) wie geplant ohne Details zur bisherigen Lücke.
  Commit-Nachrichten ebenso („Login und UID-Regeln“, nicht „Lücke X geschlossen“).
- Backlog-Einträge wie geplant (Passkey, Strava-Tokens in Worker-KV).

---

## Entscheidungen für Louis (Schritt 5)

| Nr. | Frage | Empfehlung |
| --- | --- | --- |
| **E1 (G1)** | Nur E-Mail + Passwort (Konto in der Console, Schlüsselbund + Face ID), kein Google-Popup, Passkey in den Backlog? | **Ja.** Google bringt gegenüber dem Schlüsselbund kaum Komfort und ist in der Home-Bildschirm-App unsicher. Hinweis: Im Safari-Tab kommt nach 7 Tagen ohne Nutzung einmal der Login zurück (B10). |
| **E2 (G5/Rollout)** | Worker-Umstellung in drei Phasen mit Übergangsmodus (`report` → Frontend → `required` am selben Tag) statt „Worker deployen, sofort mergen, ein paar Minuten Ausfall“? | **Ja, drei Phasen.** Kein Ausfall, und die Token-Prüfung ist live bewiesen, bevor sie bindend wird. Kosten: ein zusätzlicher Ein-Zeilen-Deploy. |
| **E3 (G4)** | Versions-Dokument verschachtelt `{ n, plan: {…}, fileVersion, source, importedAt }` statt flach, plus `latestVersion` in der Meta? | **Verschachtelt + `latestVersion`.** Schritt 2 ergänzt dann nur Felder, und es muss nichts abgestreift werden. |
| **E4 (Security)** | Soll „Abmelden“ im Plan-Tab das Gerät räumen (erst warten, bis alles übertragen ist, dann Offline-Cache und lokale Kopien löschen)? | **Ja.** Selten gebraucht, wenig Aufwand, keine Datenreste. Mit nicht übertragenen Einträgen bricht es ab statt zu löschen. |
| **E5 (G3)** | Regeln wie G3 (eine rekursive UID-Regel), Prüfung per Rules Playground + privatem Fenster, keine automatischen Regel-Tests? | **Ja.** Unveränderliche Plan-Versionen sichert in 1b die App ab; über Regeln erst in Schritt 2 neu bewerten. |
| **E6 (G7/S0)** | Spike als Mini-PR auf `main` (mit eigener Firebase-App-Instanz und harmlosem Lesetest) und direkt nach S0 wieder löschen? | **Ja.** Der echte Origin ist für den Home-Bildschirm-Test nötig; die eigene Instanz schützt die Live-App. |

Reihenfolge-Hinweis an Louis (keine Entscheidung): Vor dem Spike-Test die App auf jedem
Gerät einmal mit Netz öffnen. In der Console vor S0 außerdem Selbstregistrierung aus und
Schutz vor E-Mail-Enumeration an (falls vorhanden).
