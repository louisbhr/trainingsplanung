# Handoff: Halbmarathon-Tracker

Für eine neue Session, die hier weitermacht. **Was die App kann und was
noch kommen soll, steht in [`REQUIREMENTS.md`](REQUIREMENTS.md)** — dieses
Dokument ist das Operative: loslegen, ausliefern, und die Fallen, die
schon einmal Zeit gekostet haben.

Stand: 24.09.2026 · alles auf `main` (`70ae84f`) · Trainingswoche 4 von 31
(Deload) · Wettkampf Anfang/Mitte April 2027

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

`npm test` läuft fünfmal: 81 Prüfungen der Plandaten, 29 der
Lauf-Zuordnung, 27 der Progressionslogik, 19 der Versionsstempel (alle
ohne Browser), dazu 141 Browser-Checks in Chromium. Für die Browser-Tests
muss `npm run serve` laufen; Firebase und Strava sind darin gestubbt, es
braucht also keine echten Konten.

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
| Firebase | Projekt `trainingsplanung-2c6c0` | Firestore + anonyme Anmeldung. Config steht offen in `firebase-init.js`, das ist bei Firebase so vorgesehen; abgesichert wird über `firestore.rules`. |
| Cloudflare Worker | `trainingsplanung-auth` | Strava-Token-Austausch. Hält `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ALLOWED_ORIGINS` als Worker-Secrets. |
| Strava | strava.com/settings/api | Client-ID öffentlich in `config.js`. Callback-Domain muss `louisbhr.github.io` sein. |
| GitHub Pages | Repo-Einstellungen | Deployt `main`, Ordner `/`. |

**Keine Geheimnisse ins Repo.** Das Strava-Client-Secret stand in der
ersten Fassung im Code und liegt deshalb weiterhin in der Historie
(Commit `5160b7d`); es wurde rotiert. Eine ältere, hochgeladene
`HANDOFF.md` aus der Anfangszeit enthält dieses alte Secret im Klartext —
nicht wiederverwenden.

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
   eine eigene Fehlerkarte. Wenn „nichts lädt": zuerst prüfen, ob in
   Firebase die anonyme Anmeldung aktiv und die Regeln veröffentlicht
   sind — beides war anfangs nicht der Fall und hat lange nach einem
   Strava-Problem ausgesehen.
5. **Strava und CORS.** `POST /oauth/token` geht nicht aus dem Browser,
   dafür ist der Worker da. Aktivitäten abrufen geht direkt.
6. **Browser-Tests fangen Module per RegExp ab**, nicht per Glob — sonst
   gehen die Routen am angehängten `?v=…` vorbei.

## Wie hier gearbeitet wird

- Oberfläche, Kommentare, Commit-Nachrichten auf Deutsch.
- Jede Verhaltensänderung bekommt einen Test. Logik, die ohne Browser
  prüfbar ist, gehört in ein eigenes Modul (`runmatch.js`,
  `progression.js`) statt in `app.js`.
- Neue Tests gegenprüfen: einmal absichtlich kaputt machen und sehen,
  dass sie rot werden. Ein Test, der nicht fehlschlagen kann, ist keiner.
- Vor dem Commit alle fünf Testläufe grün.
- Handy zuerst: Tests laufen gegen 390×844, und es darf nichts seitlich
  aus dem Bild ragen.

## Nächster Schritt

**Die Trainer-Auswertung ist fällig** (war für Ende September verabredet,
damit genug echte Daten da sind — die sind jetzt da). Worker-Endpunkt
`/coach`, der die Claude API aufruft und eine kurze Einschätzung zum
Trainingsfortschritt liefert. Details, Kostenrahmen und die beiden
offenen Punkte (Endpunkt an die Firebase-Anmeldung binden, Tageslimit)
stehen in `REQUIREMENTS.md`, Abschnitt 5, Punkt 1.

Danach steht in derselben Liste, was noch ansteht — der nächste
inhaltliche Meilenstein sind die Wochen 9–31, die nach der
Re-Kalibrierung am Ende von Woche 8 (ab 26.10.2026) ausformuliert werden.
