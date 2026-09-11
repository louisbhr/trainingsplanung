# Halbmarathon-Tracker

Statische Web-App (Vanilla JS, kein Build-Step) für den 31-Wochen-Plan
Richtung 1:29:59 h. Krafteinheiten werden von Hand eingetragen und in
Firestore gespeichert, Läufe kommen automatisch aus Strava.

- **Heute** — die heutige Einheit, mit Eingabefeldern bzw. Strava-Daten
- **Woche** — Wochenübersicht, vor/zurück blätterbar, Tag antippen für Details
- **Verlauf** — Gewichtsverlauf je Übung, Distanz/Pace der letzten Läufe
- **Plan** — Phasen, Zeitraum, HF- und Pace-Zonen

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

**b) Secrets im Worker setzen** (Settings → Variables and Secrets, oder
`npx wrangler secret put <NAME>`):

| Name | Wert |
| --- | --- |
| `STRAVA_CLIENT_ID` | die Client-ID aus strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | das Client-Secret von dort |
| `ALLOWED_ORIGINS` | optional, aber empfohlen: `https://<dein-name>.github.io` |

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

## 4. Lokal testen

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
| `config.js` | Worker-URL und Strava-Client-ID |
| `plan.js` | Trainingsplan; Daten werden aus `PLAN_START` berechnet |
| `runmatch.js` | Zuordnung von Strava-Läufen zu Plan-Lauftagen |
| `firebase-init.js` | Firestore + anonyme Anmeldung, mit Offline-Cache |
| `strava.js` | Strava-Anbindung |
| `worker.js`, `wrangler.toml` | Cloudflare Worker für den Token-Austausch |
| `firestore.rules` | Firestore-Regeln |
| `manifest.webmanifest`, `icon.png` | „Zum Home-Bildschirm" auf dem Handy |
| `tests/` | Plan- und Browser-Tests |

## Was noch offen ist

- **Wochen 9–31** zeigen nur Phase und Zeitraum. Die Tagesdetails tragen
  wir nach der Re-Kalibrierung am Ende von Phase 1 nach — gleiches Muster
  wie Woche 1–8 in `plan.js`, die Datumsangaben ergeben sich automatisch.
- **Offline:** Eingaben werden lokal zwischengespeichert und später
  synchronisiert. Die App selbst lädt aber noch aus dem Netz (kein Service
  Worker), ohne Verbindung öffnet sie also nicht.
- **Anonyme Anmeldung:** die Firestore-Regeln erlauben jedem angemeldeten
  Nutzer Zugriff, und jeder Besucher der Seite meldet sich anonym an. Für
  ein privates Tool okay; wer es dichter will, nimmt echtes Login und
  bindet die Regeln an die eigene UID.
