# Handoff: Stride

Für eine neue Session, die hier weitermacht. **Was die App kann und was
noch kommen soll, steht in [`REQUIREMENTS.md`](REQUIREMENTS.md)** — dieses
Dokument ist das Operative: loslegen, ausliefern, und die Fallen, die
schon einmal Zeit gekostet haben.

Stand: 22.10.2026 · Branch `stride-redesign` (Etappen E0 bis E9, noch nicht
gemergt; `main` steht auf dem Stand vor Stride, Merge-Base `a6e6c4b`) ·
Renntag So 02.05.2027 · Das Stride-Redesign (neuer Name, neues Design, alle
sechs Screens neu) ist umgesetzt; offen sind Pipeline-Schritte 8 bis 12 und der Merge

## Loslegen

```bash
git clone https://github.com/louisbhr/trainingsplanung
cd trainingsplanung
npm install && npx playwright install chromium

npm run serve      # http://127.0.0.1:8099 — in einem zweiten Terminal
npm test           # muss komplett grün sein, bevor irgendetwas gepusht wird
```

Node 22. Kein Build-Schritt: die Dateien im Repo-Wurzelverzeichnis sind
exakt das, was der Browser lädt.

`npm test` läuft 20-mal (die Aufrufe in `package.json`, Skript `test`):
Prüfungen der Plandaten gegen `plans/hm-2027.json`
plus der reinen Logik aus `plan.js` (`plan.test.mjs`), ein Tag-für-Tag-
Vergleich der neuen gegen die eingefrorene alte Plan-Logik
(`plan-golden.test.mjs`, nur bis Woche 8), ein Stub-Wächter
(`stubs.test.mjs`), die Lauf-Zuordnung, die Progressionslogik, der
Versionsstempel und der Export (`export.test.mjs`), dazu `metrics.test.mjs` (Ampeln), `coach.test.mjs`
(Coach-Cache und Fallback) und `worker.test.mjs` (`/coach` inkl.
Vertragstest gegen die echten App-Eingaben, dazu die Token-Prüfung),
`access.test.mjs` (Zugangslogik) und `config-consistency.test.mjs` (UID und
Projekt-ID an allen Stellen gleich), alle ohne Browser, und
`kraftflow`, `runcompare`, `history-data`, `view-run`, `view-history` (reine Logik und Markup der neuen Module), `naming-guard` und `static-greps` (Quelltext-Wächter), und zuletzt die Browser-Checks in Chromium (1125 Checks, darunter Szenario 34, die Prüfmatrix über sieben Fenstergrößen, hell und dunkel).
**Der Testserver auf Port 8099 muss laufen** (`npm run serve`, aus diesem Verzeichnis); Firebase und Strava sind
darin gestubbt, es braucht also keine echten Konten.

## Ausliefern

1. `npm run version` — **nicht vergessen**, siehe Falle 1.
2. Committen, auf einen Branch pushen, per Pull Request nach `main`.
3. GitHub Pages deployt `main` automatisch nach 1–2 Minuten.
   Live: https://louisbhr.github.io/trainingsplanung/
   Status: https://github.com/louisbhr/trainingsplanung/actions

## Fremdsysteme

Nichts davon muss für die Entwicklung eingerichtet werden — die Tests
laufen ohne. Nur wer am echten Login oder an Strava-Abrufen arbeitet,
braucht Zugang.

| System | Wo | Was dort liegt |
| --- | --- | --- |
| Firebase | Projekt `trainingsplanung-2c6c0` | Firestore und Authentication mit dem Anbieter **E-Mail/Passwort** (ein Konto, in der Console angelegt; Anonym ist aus). Config steht offen in `firebase-init.js`, das ist bei Firebase so vorgesehen; abgesichert wird über `firestore.rules` (feste UID). |
| Cloudflare Worker | `trainingsplanung-auth` | Strava-Token-Austausch. Hält `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ALLOWED_ORIGINS` und `ANTHROPIC_API_KEY` (eigener Workspace, Monatslimit) als Worker-Secrets. Endpunkte `/exchange`, `/refresh`, `/coach`, alle mit Token-Pflicht. `[vars]` in `wrangler.toml`: `STRAVA_CLIENT_ID`, `ALLOWED_ORIGINS`, `FIREBASE_PROJECT_ID`, `ALLOWED_UID`. Die Token-Prüfung ist immer verbindlich; fehlt eine der beiden Firebase-Variablen, antwortet der Worker mit 500 `not_configured`. Deployt wird von Hand (`npx wrangler deploy`), nicht von GitHub. |
| Strava | strava.com/settings/api | Client-ID öffentlich in `config.js`. Callback-Domain muss `louisbhr.github.io` sein. |
| GitHub Pages | Repo-Einstellungen | Deployt `main`, Ordner `/`. |

**Keine Geheimnisse ins Repo.** Das Strava-Client-Secret stand in der
ersten Fassung im Code und liegt deshalb weiterhin in der Historie
(Commit `5160b7d`); es wurde rotiert. Eine ältere, hochgeladene
`HANDOFF.md` aus der Anfangszeit enthält dieses alte Secret im Klartext —
nicht wiederverwenden.

## Schriften (Stride)

Geist und Geist Mono liegen selbst gehostet in `fonts/` (kein Drittanbieter-Aufruf
zur Laufzeit, SIL Open Font License 1.1 in `fonts/OFL.txt`). Dateien unverändert, nicht
reduziert. Quelle: GitHub-Release `vercel/geist-font` **v1.8.1** (aktueller stabiler
Release), Archiv
`https://github.com/vercel/geist-font/releases/download/v1.8.1/geist-font-v1.8.1.zip`,
daraus `Geist/webfonts/Geist[wght].woff2`, `GeistMono/webfonts/GeistMono[wght].woff2`
und `OFL.txt`.

| Datei | Größe | SHA-256 |
| --- | --- | --- |
| `fonts/Geist-Variable-1.8.1.woff2` | 69 492 Byte | `9ce2d97863cab59a0c7522534112d6c42a4e25c0e6b2ab37766761b0f82cfbd6` |
| `fonts/GeistMono-Variable-1.8.1.woff2` | 71 236 Byte | `119f3e159fc15dd77311e929d3a657a193b57a3e625234666bc43c6e2b1127f7` |
| `fonts/OFL.txt` | 4 383 Byte | `c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90` |

Das Design-Handoff liegt als Referenz in `docs/design-stride/`; die Prototyp-Dateien
tragen absichtlich die Endung `.txt`, damit sie nie als Seite auf GitHub Pages laufen.

## Fallen, die schon Zeit gekostet haben

1. **Versionsstempel.** GitHub Pages lässt CSS und JS zehn Minuten
   cachen, Safari auf dem Home-Bildschirm länger. Ohne `npm run version`
   vor dem Commit sieht man die Änderung nicht — schlimmer noch: teils
   neu, teils alt, weil jede Datei ihren eigenen Cache-Eintrag hat.
   Deshalb stempelt `tools/bump-version.mjs` auch jeden Import zwischen
   den Modulen. Kommt ein **neues Modul** dazu, muss es in die Liste in
   diesem Skript; `npm test` schlägt sonst an.
2. **Eingabefelder unter 16px.** iOS Safari zoomt beim Antippen hinein,
   danach lässt sich die Seite seitlich schieben und füllt den Schirm
   nicht mehr. Jedes `input`/`select` bleibt bei mindestens 16px, ein
   Test wacht darüber.
3. **Kein `toISOString()` für Datumsangaben.** Das rechnet in UTC und
   zeigt zwischen Mitternacht und 02:00 den falschen Tag an. Die Helfer
   in `plan.js` (`toISO`, `fromISO`, `addDays`) sind lokal und
   DST-fest — nur die benutzen.
4. **Firestore-Fehler sehen aus wie Strava-Fehler.** Sie sind als
   `FirebaseAccessError` mit `source: "firebase"` markiert und bekommen
   eine eigene Fehlerkarte. Wenn „nichts lädt": zuerst prüfen, ob man
   angemeldet ist (Plan-Tab, Konto) und ob die Regeln aus
   `firestore.rules` in der Firebase-Console veröffentlicht sind.
5. **Strava und CORS.** `POST /oauth/token` geht nicht aus dem Browser,
   dafür ist der Worker da. Aktivitäten abrufen geht direkt.
6. **Login und Tests.** Die Browser-Tests ersetzen `firebase-init.js` durch
   ein Stub-Modul. Der Auth-Zustand kommt per `addInitScript`
   (`window.__AUTH__ = "ok" | "signedOut" | "forbidden" | "anonymous"`),
   `window.__FS_CALLS__` zählt Firestore-Zugriffe. Jedes Stub-Literal
   braucht alle Exporte von `firebase-init.js` (der Stub-Wächter sagt es).
   Die UID im Test liest `tests/app.test.mjs` aus `config.js`.
   **Worker-Tests:** der Schlüssel-Cache lebt modulweit, `worker.test.mjs`
   importiert den Worker deshalb mit `?t=<n>` frisch.
7. **Browser-Tests fangen Module per RegExp ab**, nicht per Glob — sonst
   gehen die Routen am angehängten `?v=…` vorbei.
8. **Nach jeder Änderung an `plans/hm-2027.json`** (Wochen 17–35 ausformulieren,
   Renndatum eintragen) `npm run version` nicht vergessen. Die JSON-URL in
   `plan-store.js` trägt einen eigenen Stempel, den `fetch(..., {cache:
   "no-cache"})` zwar meist über ein 304 abfängt — aber eben nicht immer
   (Safari auf dem Home-Bildschirm hält sich hartnäckiger). `npm test`
   prüft mit, dass dieser Stempel überall derselbe ist.
9. **Parallele Agenten brauchen eigene Worktrees.** Zwei Sessions im selben
   Verzeichnis überschreiben sich gegenseitig die Dateien und Branches.
   Jede Arbeit bekommt `git worktree add <pfad> -b <branch> origin/main`;
   `node_modules` wird per Symlink aus dem Hauptverzeichnis verlinkt (nicht
   committen, steht in `.gitignore`). Beim Entfernen: `git worktree remove`.
10. **Port 8099 belegt.** Die Browser-Tests sprechen fest `127.0.0.1:8099`
    an. Läuft dort ein Server aus einem anderen Worktree, testen sie
    stillschweigend fremden Code (oder scheitern bunt). Vor jedem Lauf
    `lsof -ti :8099` prüfen, fremden Server beenden, den eigenen aus dem
    richtigen Verzeichnis starten, danach wieder beenden.
11. **Worker-`[vars]` gehören in `wrangler.toml`.** `wrangler deploy` setzt
    den Worker auf genau diese Datei zurück: Variablen, die nur im
    Cloudflare-Dashboard stehen, sind danach weg. Secrets (`wrangler secret
    put`) bleiben erhalten. Ändert sich eine Variable, die Datei ändern, nicht
    das Dashboard.
12. **Abmelden und zweiter Tab.** „Abmelden“ kann den Offline-Speicher nicht
    leeren, solange die App in einem anderen Tab offen ist; die App sagt das
    nach dem Neuladen auf dem Anmeldebildschirm. Das Abmelden in einem
    anderen Tab bemerkt ein offener Tab erst beim Neuladen.
13. **Neue Module der Stride-Etappen.** `kraftflow.js` (Kraft-Ablauf), `runcompare.js`
    (Lauf-Vergleich), `history-data.js` (Verlauf-Daten) sind rein und ohne Browser
    getestet; `view-kraft.js`, `view-run.js`, `view-history.js`, `view-plan.js` liefern
    nur Markup und importieren nie Firebase, Strava oder `app.js`. Zustand und
    Verdrahtung bleiben in `app.js`. Der Seitenkopf steht in `#main` und wird nur über
    `renderMain()`/`setPageHead()` geschrieben.
14. **`.pipeline-state.md` ist in `.gitignore`.** Der Pipeline-Stand lebt nur lokal
    und im Agenten-Arbeitsverzeichnis, nie im Repo.

## Wie hier gearbeitet wird

- Oberfläche, Kommentare, Commit-Nachrichten auf Deutsch.
- Jede Verhaltensänderung bekommt einen Test. Logik, die ohne Browser
  prüfbar ist, gehört in ein eigenes Modul (`runmatch.js`,
  `progression.js`) statt in `app.js`.
- Neue Tests gegenprüfen: einmal absichtlich kaputt machen und sehen,
  dass sie rot werden. Ein Test, der nicht fehlschlagen kann, ist keiner.
- Vor dem Commit alle Testläufe grün.
- Nirgends `style="…"` im gerenderten Markup (Auflage C5): Balken und Verläufe sind
  SVG-Attribute oder `<progress>`, Farben kommen über Klassen. `tests/static-greps.test.mjs`
  und die Prüfmatrix (Szenario 34) wachen darüber.
- Handy zuerst: Tests laufen gegen 390×844, und es darf nichts seitlich
  aus dem Bild ragen.

## Nächster Schritt

0. **Stride abschließen:** Pipeline 8 bis 11 auf dem Gesamtstand, Louis-Test (Schritt 12), Merge.
   Danach Home-Bildschirm-App löschen und neu hinzufügen (neuer Name und Icon).
1. **Wochen 17–35 ausformulieren**, jeweils nach den Re-Kalibrierungen
   (nächste: So 22.11.2026), direkt in `plans/hm-2027.json`.
2. **Schritt 2: Marathon-Coaching** (Mehrziel, Blöcke, Plan-Erzeugung durch
   Claude) — Entwurf in `docs/requirements-marathon-coaching.md`, noch nicht
   freigegeben.
3. **Bekannte Schuld:** `app.js` hat rund 2500 Zeilen; das Auslagern der
   Datenaufbereitung (`dashboard-data.js`) ist vorgemerkt. Offene
   Minor-Punkte aus den Reviews stehen in `docs/review-code-m2.md`
   (M1, M3, M4, M7, M9–M11) und `docs/review-code-login-1b.md` (N3, S1).

Was sonst noch geplant ist, steht in `REQUIREMENTS.md`, Abschnitt 5;
Ideen ohne Termin in `backlog.md`.
