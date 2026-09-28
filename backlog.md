# Halbmarathon-Tracker — Backlog

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
