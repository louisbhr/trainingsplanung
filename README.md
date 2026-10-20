# Halbmarathon-Tracker

Statische Web-App (Vanilla JS, kein Build-Step) für den 35-Wochen-Plan
Richtung 1:29:59 h. Krafteinheiten werden von Hand eingetragen und in
Firestore gespeichert, Läufe kommen automatisch aus Strava.

- **Dashboard** — was heute dran ist, KI-Coach (täglich zwei Sätze, montags
  Wochenbilanz), vier Ampeln (Wochensoll, Easy-Disziplin, Belastung,
  Kraft-Progression) mit Info-Knöpfen und „Im Detail“
- **Woche** — Tagesliste mit Status, vor/zurück blätterbar; Tag antippen
  klappt Details auf, „Tag öffnen“ führt in die Tagesansicht
- **Verlauf** — Gewichtsverlauf je Übung, Distanz/Pace der letzten Läufe
- **Plan** — Phasen, Zeitraum, HF- und Pace-Zonen; darunter „Daten
  exportieren“ (alle Trainingsdaten als JSON-Datei) und die Konto-Karte

Krafttage lassen sich über „Anpassen" für den jeweiligen Tag umbauen:
Übungen entfernen, zurückholen oder eigene hinzufügen.

Verschobene Läufe erkennt die App selbst: liegt am Plantag kein Lauf in
Strava, sucht sie einen Tag davor bis drei Tage danach und weist ihn als
nachgeholt aus (`runmatch.js`). Passt die Vermutung nicht, lässt sich über
„Anderen Lauf" von Hand zuordnen oder der Tag bewusst leer lassen.

Was die App heute kann, worauf sie aufbaut und was noch kommen soll,
steht in [`REQUIREMENTS.md`](REQUIREMENTS.md).

## 1. Auf GitHub Pages veröffentlichen

1. Repository auf GitHub anlegen (öffentlich, sonst braucht Pages GitHub Pro).
2. Alle Dateien hochladen (Drag & Drop im Browser reicht, oder `git push`).
3. Settings → Pages → „Deploy from a branch" → Branch `main`, Ordner `/root` → Save.
4. Nach 1–2 Minuten erreichbar unter `https://<dein-github-name>.github.io/<repo>/`.

## 2. Firestore-Regeln einspielen

Firebase-Console → Firestore Database → Regeln → Inhalt von
`firestore.rules` einfügen → Veröffentlichen. Die Firebase-Config in
`firebase-init.js` darf öffentlich im Code stehen — abgesichert wird über
die Regeln, nicht über Geheimhaltung.

Die Regeln lassen nur ein Konto zu: Louis' UID (`ALLOWED_UID`). Dieselbe UID
steht in `config.js`, `firestore.rules` und `wrangler.toml`;
`tests/config-consistency.test.mjs` hält die drei gleich.

**Login.** Die App verlangt eine Anmeldung mit E-Mail und Passwort. Das Konto
wird in der Firebase-Console angelegt (Authentication → Users), in der App
kann man sich nicht registrieren. Die Sitzung bleibt pro Gerät und Variante
(Safari-Tab, Home-Bildschirm-App) gespeichert; im Safari-Tab löscht Safari
Website-Daten nach 7 Tagen ohne Nutzung, dann kommt einmal der Login zurück.
Im Plan-Tab gibt es unten die Konto-Karte. „Abmelden“ sendet erst alle noch
offenen Einträge, räumt dann Offline-Speicher und lokale Kopien und bricht
ab, wenn noch etwas nicht übertragen ist.

**Worker-Variablen** (`wrangler.toml`, `[vars]`): `FIREBASE_PROJECT_ID` und
`ALLOWED_UID`. `/coach`, `/exchange` und `/refresh` prüfen immer das
Firebase-ID-Token (`Authorization: Bearer ...`); es gibt keinen Schalter, der
die Prüfung abschwächt. Fehlt eine der beiden Variablen, antwortet der
Worker mit 500 `not_configured`. Im Log (`npx wrangler tail`) steht bei
Ablehnung nur der Grund-Code (`auth: invalid:<grund>`), nie das Token.

## 3. Strava einrichten (der entscheidende Schritt)

Stravas Token-Endpunkt `POST /oauth/token` erlaubt **keine** CORS-Anfragen
aus dem Browser. Ohne Zwischenstation kann sich die Seite deshalb nie bei
Strava anmelden — genau daran hing die App vorher. Lösung: ein winziger
Cloudflare Worker, der nur den Token-Austausch übernimmt. Alles andere
(Aktivitäten abrufen) läuft weiter direkt im Browser.

**a) Worker deployen** — Dashboard oder CLI:

*Dashboard:* workers.cloudflare.com → „Create Worker" → Inhalt von
`worker.js` einfügen → Deploy.

*CLI:* `npx wrangler deploy` (nutzt `wrangler.toml`).

**b) Werte im Worker:** Öffentliches steht in `wrangler.toml` unter `[vars]`
(`STRAVA_CLIENT_ID`, `ALLOWED_ORIGINS`). Geheimes nur per
`npx wrangler secret put <NAME>`:

| Name | Wert |
| --- | --- |
| `STRAVA_CLIENT_SECRET` | das Client-Secret aus strava.com/settings/api |
| `ANTHROPIC_API_KEY` | Key aus einem eigenen Workspace mit Monatslimit, nur für den Coach (`/coach`) |

Achtung: Variablen, die nur im Cloudflare-Dashboard und nicht in
`wrangler.toml` stehen, löscht `wrangler deploy`. Secrets bleiben erhalten.

Ohne `ALLOWED_ORIGINS` nimmt der Worker Anfragen von jeder Herkunft an.

**c) Worker-URL in die App eintragen:** in `config.js` bei
`WORKER_URL_DEFAULT` die ausgegebene `*.workers.dev`-URL setzen, committen,
pushen. Zum schnellen Ausprobieren ohne Commit geht auch einmalig
`https://…/?worker=https://<worker>.workers.dev` — die URL wird dann lokal
im Browser gemerkt.

**d) Callback-Domain bei Strava:** auf strava.com/settings/api unter
„Authorization Callback Domain" die echte Domain eintragen, also z. B.
`<dein-name>.github.io` — ohne `https://` und ohne Pfad.

**e) Einmalig verbinden:** Seite öffnen → Lauftag → „Mit Strava verbinden".
Die Tokens liegen danach in Firestore und gelten für alle Geräte.

> **Sicherheitshinweis:** In der ersten Fassung stand das Strava-Client-Secret
> direkt in `strava.js` und liegt damit weiterhin in der Git-Historie dieses
> Repositories. Wenn das Repo öffentlich ist (oder war), **rotiere das Secret**
> auf strava.com/settings/api und trage das neue nur noch als Worker-Secret
> ein. Im ausgelieferten Code steht jetzt nur noch die unkritische Client-ID.

## 4. Nach jeder Änderung: Version stempeln

```bash
npm run version
```

Hängt einen Zeitstempel an die Verweise auf `style.css`, `app.js` und
alle Modul-Importe. Ohne ihn liefert der Browser nach einem Deploy
womöglich noch die alte Fassung aus — GitHub Pages lässt zehn Minuten
cachen, Safari auf dem Home-Bildschirm länger. Danach committen; der
Stempel steht im Diff. `npm test` prüft mit, dass er überall gesetzt und
überall derselbe ist.

## 5. Lokal testen

```bash
npm install && npx playwright install chromium
npm run serve     # http://127.0.0.1:8099
npm test          # Plan-Daten + Browser-Tests (ohne echte Konten)
```

Details siehe `tests/README.md`.

## Dateien

| Datei | Zweck |
| --- | --- |
| `index.html`, `style.css`, `app.js` | die App |
| `config.js` | Worker-URL, Strava-Client-ID und erlaubte UID |
| `plans/hm-2027.json` | Die eigentlichen Plandaten (Wochen, Einheiten, Ziel, Renndatum) — reine Daten, keine Generator-Funktionen mehr |
| `plan.js` | Reine Trainingsplan-**Logik**; nimmt den Plan (aus `plans/`) als Parameter entgegen, enthält selbst keine Plandaten |
| `plan-store.js` | Lädt `plans/hm-2027.json` per `fetch`, validiert sie und hält eine Kopie in `localStorage` fürs Funkloch |
| `runmatch.js` | Zuordnung von Strava-Läufen zu Plan-Lauftagen |
| `metrics.js` | Ampeln und Kennzahlen des Dashboards (ohne Browser testbar), Grenzwerte aus `THRESHOLDS` in `config.js` |
| `coach.js` | Coach im Browser: Eingabe bauen, Cache in Firestore (`coach/`, `coachweek/`), Tageslimits, Regel-Fallback |
| `ui.js`, `view-dashboard.js`, `view-week.js` | Gemeinsame UI-Helfer und die Ansichten von Dashboard und Wochen-Tab |
| `export.js` | Stellt die Export-Datei zusammen (Strava, Logs, Plan, Zuordnungen) |
| `firebase-init.js` | Firestore mit Offline-Cache und Anmeldung (E-Mail und Passwort) |
| `access.js`, `view-account.js` | Zugangslogik (Zustand der Sitzung, Fehlertexte, Token-Retry) und das Markup von Anmeldung und Konto-Karte |
| `strava.js` | Strava-Anbindung |
| `worker.js`, `wrangler.toml` | Cloudflare Worker: Strava-Token-Austausch und Coach-Endpunkt `/coach` (Claude API), alle mit Prüfung des Firebase-ID-Tokens |
| `tools/bump-version.mjs` | Setzt den Versionsstempel gegen Browser-Cache (auch auf die JSON-URL in `plan-store.js`) |
| `firestore.rules` | Firestore-Regeln |
| `manifest.webmanifest`, `icon.png` | „Zum Home-Bildschirm" auf dem Handy |
| `tests/` | Plan-, Logik-, Worker- und Browser-Tests |

## Was noch offen ist

- **Wochen 17–35** zeigen nur Phase, Zeitraum und Wochenkilometer
  (`placeholder: true`); Woche 1–16 sind ausformuliert (Stand 20.10.2026,
  Renntag So 02.05.2027 in Woche 35). Die weiteren Tagesdetails tragen wir
  nach den Re-Kalibrierungen (28.10. und 22.11.2026) nach
  — direkt in `plans/hm-2027.json` (nicht mehr in `plan.js`, das enthält
  seit M1 keine Plandaten mehr). Nach jeder Änderung an der JSON nicht
  `npm run version` vergessen (siehe HANDOFF.md, Falle 1).
- **Offline:** Eingaben werden lokal zwischengespeichert und später
  synchronisiert. Die App selbst lädt aber noch aus dem Netz (kein Service
  Worker), ohne Verbindung öffnet sie also nicht.
