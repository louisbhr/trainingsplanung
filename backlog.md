# Stride — Backlog

Gesammelte Feature-Ideen, die nicht in der laufenden Pipeline stecken. Bei Bedarf per
Discovery wieder aufgreifen.

## Vorgemerkt

### Garmin-Erholungsdaten über Intervals.icu (HRV, Ruhepuls, Schlaf)

**Was:** Nächtliche HRV, Ruhepuls, Schlafphasen, Body Battery und Training Readiness von der
Garmin-Uhr in die App holen — als Erholungs-Signal fürs Dashboard und als Eingabe für den
Coach.

**Warum:** Das Belastungsverhältnis (km 7 Tage vs. 28 Tage) sagt nur, wie viel trainiert wurde,
nicht wie gut der Körper es verkraftet. Ein HRV-/Ruhepuls-Trend ist das deutlich bessere
Erholungssignal, gerade für die längere Marathon-Vorbereitung.

**Weg:** Strava bekommt von Garmin nur Aktivitäten, keine Wellness-Daten. Garmins offizielles
Developer-Programm nimmt derzeit keine neuen Anmeldungen an (Stand 09/2026). Intervals.icu ist
offizieller Garmin-Partner, synct Wellness-Daten wenige Minuten nach dem Uhr-Sync und hat eine
persönliche API mit API-Key → Abruf über den bestehenden Cloudflare Worker, Key als
Worker-Secret. Inoffizielle Garmin-Login-Bibliotheken bewusst verworfen (fragil, Passwort im
Worker, 2FA).

**Vorher (Louis):** Konto auf intervals.icu anlegen, Garmin Connect verbinden, unter
Settings → Integrations → Garmin Connect die Scopes „Wellness“ und „Sleep“ aktivieren. Dann
prüfen, welche Werte bei seiner Uhr tatsächlich ankommen (laut Forum je nach Modell lückenhaft).

**Aufwand:** M — neuer Worker-Endpunkt, Datenmodell für Wellness-Tage, Dashboard-Karte,
Coach-Eingabe erweitern.

**Einordnung:** In Schritt 2 übernommen (M10 in `docs/requirements-marathon-coaching.md`), Louis 2026-09-27.

**Herkunft:** Louis, 2026-09-24.

### Freunde als eigene Nutzer (Mehrbenutzerbetrieb)

**Was:** Freunde bekommen den Link, melden sich mit eigenen Daten an und nutzen die App unabhängig von Louis.

**Was dafür nötig ist:**
- Daten pro Person unter `users/{uid}/…`, Regeln „jeder nur seine eigenen Daten“, einmalige Migration von Louis' Daten.
- Einladungsliste statt offener Registrierung (Kosten des Coaches laufen über Louis' Key).
- Eigener Plan pro Person, setzt Schritt 2 (Ziel eintragen, Claude plant) voraus.
- Strava: neue API-Apps sind vermutlich auf den Besitzer beschränkt, Freigabe für weitere Athleten bei Strava beantragen (vorher prüfen).
- Coach-Limits pro Nutzer, Datenschutz der Gesundheitsdaten.

**Einordnung:** Bewusst später. 1b bleibt auf Louis allein zugeschnitten (feste UID), der Umbau auf `users/{uid}` kommt mit diesem Vorhaben. Ändert den Ausschluss „Mehrbenutzerbetrieb“ in REQUIREMENTS.md.

**Herkunft:** Louis, 2026-10-03.

## Ideen — 2026-10-20 (Ende Discovery Stride-Redesign)

### Pausen-Timer im Kraft-Tag — quick win · M

**Was:** Nach „Satz fertig“ startet im Fokus-Kraft-Tag automatisch ein Pausen-Countdown
(z. B. 90 s, per Tipp ±15 s oder überspringen), der beim nächsten „Satz fertig“ endet.

**Warum:** Im Studio schaut Louis zwischen den Sätzen ohnehin auf die App. Ein Timer an
genau dieser Stelle erspart den Wechsel zur Uhr-App und hält die Pausen gleichmäßig, was die
Progressionshinweise (alle Wdh sauber oder nicht) vergleichbarer macht.

**Offene Fragen:** Ton/Vibration am Ende, Verhalten bei gesperrtem Bildschirm bzw. App im
Hintergrund (iOS hält Web-Timer an, Restzeit also aus Startzeitpunkt berechnen, nicht
herunterzählen), feste oder je Übung unterschiedliche Pausenlänge. Reiner UI-Zustand, kein
Firestore-Feld nötig.

**Einordnung:** Bewusst aus dem Stride-Redesign herausgenommen (V3 in
`docs/requirements-stride.md`). Setzt den Satz-für-Satz-Ablauf aus Stride voraus.

**Herkunft:** Discovery Stride, Louis-Entscheid 2026-10-20.

### Desktop-Analyseansicht (Ersatz für „Im Detail“) — bigger bet · L

**Was:** Eine eigene Ansicht für breite Fenster, die Wochenvolumen Soll/Ist, Aerobe
Effizienz, Adhärenz 4 Wochen und „Als Nächstes“ wieder sichtbar macht, dazu die Verläufe
nebeneinander statt gestapelt.

**Warum:** Mit Stride fällt „Im Detail“ am Handy weg (F3), obwohl es mit Dashboard v2 im
September abgenommen wurde. Die Rechenfunktionen in `metrics.js` bleiben samt Tests nur
erhalten, damit diese Ansicht sie wiederverwenden kann. Ohne Eintrag hier gingen die
Trendwerte stillschweigend verloren, gerade die Aerobe Effizienz ist für die Wochen bis
zum Rennen und für Schritt 2 (Marathon) der aussagekräftigste Fortschrittswert.

**Einordnung:** Im Stride-Redesign ausdrücklich „nicht im Umfang“. Sinnvoll nach dem
Stride-Merge und vor oder mit Schritt 2; braucht vorher eine Entscheidung, ob ab einer
Breite umgeschaltet wird oder es ein eigener Tab ist (die Handy-Spalte bleibt sonst
bewusst auf 480 px begrenzt).

**Herkunft:** Product-Strategist, Discovery Stride 2026-10-20.

### Lösch-Funktion für Tageseinträge — quick win · M

**Was:** Ein gespeicherter Kraft-Eintrag (eine Übung an einem Tag) lässt sich wieder löschen,
etwa über „Zurücksetzen“ im Kraft-Tag. Heute kann ein Eintrag nur überschrieben, nie entfernt werden.

**Warum:** Louis hat das nach seinem Test-Training gebraucht: Die Testdaten blieben in
Verlauf und Ampeln stehen. Löschen heißt `deleteDoc` auf `logs/{datum}_{übung}`; das ist ein neuer
Export in `firebase-init.js` (alle Stub-Literale in `app.test.mjs` nachziehen) und eine Regel-Prüfung
in `firestore.rules`. Ein Ehrlichkeits-Hinweis („Gelöscht ist gelöscht“) und eine Bestätigung gehören dazu.

**Einordnung:** Nicht im Stride-Umfang (C10: `firebase-init.js` bekommt keine neuen Exporte).
Berührt Firestore-Zugriff, also vor der Umsetzung freigeben lassen.

**Herkunft:** Louis nach seinem Test-Training, Stride E9 (2026-10-22).

### 1b Meilenstein B im Stride-Stil — bigger bet · L

**Was:** Login 1b Meilenstein B (Plan nach Firestore, Knopf „Plan aus Datei übernehmen“ in der
Konto-Karte) wird nachgezogen, mit Oberfläche im Stride-Stil. Die Konto-Karte hat dafür eine
Platzhalterzeile („Plandatei“ ohne Knopf).

**Warum:** Entscheid F1 im Stride-Redesign: erst Stride, danach Meilenstein B. Voraussetzung ist
der Stride-Merge; Entwurf in `docs/plan-login-1b.md`, Abschnitt „Meilenstein B“.

**Einordnung:** Setzt neue Firestore-Dokumente und Regeln voraus (Freigabe nötig). Schritt 2
(Marathon-Coaching) baut darauf auf.

**Herkunft:** `docs/requirements-stride.md` F1/L19, `docs/plan-stride.md` R8.

