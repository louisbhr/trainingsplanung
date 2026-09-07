# Halbmarathon-Tracker — Setup

## 1. Firestore-Regeln einspielen
In der Firebase-Console → Firestore Database → Regeln → Inhalt von
`firestore.rules` einfügen → Veröffentlichen.

## 2. Auf GitHub Pages veröffentlichen
1. Neues Repository auf GitHub anlegen (z. B. `hm-tracker`), sichtbar als
   "Public" (Pages braucht das im kostenlosen Plan, außer bei GitHub Pro).
2. Alle Dateien aus diesem Ordner in das Repository hochladen (per
   Drag & Drop im Browser reicht, oder `git push`).
3. Im Repo: Settings → Pages → "Deploy from a branch" → Branch `main`,
   Ordner `/root` → Save.
4. Nach 1-2 Minuten ist die Seite erreichbar unter
   `https://<dein-github-name>.github.io/hm-tracker/`.

## 3. Strava-Redirect korrigieren
Auf strava.com/settings/api unter "Authorization Callback Domain" die
echte Domain eintragen: `<dein-github-name>.github.io` (ohne `https://`
und ohne Pfad).

## 4. Einmalig mit Strava verbinden
1. Die Seite auf einem beliebigen Gerät öffnen (Laptop reicht, gilt dann
   für alle Geräte, weil die Tokens in Firestore liegen).
2. Zu einem Lauftag navigieren (Tab "Heute" oder "Woche" → Lauftag
   antippen).
3. Auf "Mit Strava verbinden" tippen, bei Strava bestätigen.
4. Danach lädt die Seite automatisch deine Läufe.

## Was noch fehlt / Grenzen dieser ersten Version
- Wochen 9-31 zeigen nur Phase und Zeitraum, noch keine Tagesdetails —
  die tragen wir nach der jeweiligen Re-Kalibrierung nach (einfach in
  `plan.js` ergänzen, gleiches Muster wie Woche 2-8).
- Der Verlauf für Lauf-Paces ist noch ein einfacher Balken-Platzhalter,
  kein echtes Zeitachsen-Diagramm — können wir verfeinern.
- Alles ungetestet in einem echten Browser gegen echte Firebase/Strava-
  Konten — bei den ersten Läufen kann es sein, dass wir noch etwas
  nachjustieren müssen. Meld dich einfach, sobald etwas nicht wie
  erwartet aussieht.
