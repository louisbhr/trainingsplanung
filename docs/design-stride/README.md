# Handoff: Stride – Mobile-Redesign, neues Logo, neuer Name

## Overview
Die App „Halbmarathon Tracker / HM Tracker“ (Repo `louisbhr/trainingsplanung`) heißt ab jetzt **Stride**, bekommt ein neues Logo und ein überarbeitetes **mobiles** UI. Der Umfang umfasst nur Design, Logo und Name. Fachlogik, Datenmodell, Firebase, Strava-Worker, Ampel-Berechnung (`metrics.js`, `config.js` THRESHOLDS) und Plan-Format bleiben unverändert.

**Nicht im Umfang:** die Desktop-Analyseansicht (kommt später). Am Handy bleibt alles so knapp wie hier beschrieben.

## About the Design Files
Die Dateien in `design/` sind **Design-Referenzen in HTML**, also Prototypen, die Aussehen und Verhalten zeigen. Sie sind kein Produktionscode. Die Aufgabe ist, sie im **bestehenden Vanilla-JS-Setup** des Repos nachzubauen (`index.html`, `style.css` mit CSS-Variablen, `app.js` / `view-*.js` mit Template-Strings, `ui.js`). Kein Framework einführen, keinen Code aus `design/` übernehmen.

Zum Ansehen `design/Stride Prototyp.dc.html` im Browser öffnen; `support.js` muss daneben liegen. In der Leiste links lassen sich Screens, Varianten, Hell/Dunkel und Zustände umschalten. Gültig ist **Kraft-Tag B** und **Lauf-Tag B**; A ist verworfen.

## Fidelity
**High-fidelity.** Farben, Typografie, Abstände, Radien und Interaktionen sind final und sollen so genau wie möglich umgesetzt werden. Inhalte (Gewichte, Strava-Läufe, Verlaufswerte) sind Beispieldaten; die echten kommen wie bisher aus Firestore, Strava und `plans/hm-2027.json`.

---

## 1. Umbenennung zu „Stride“

| Datei | Alt | Neu |
| --- | --- | --- |
| `index.html` `<title>` | Halbmarathon Tracker | Stride |
| `index.html` `apple-mobile-web-app-title` | HM Tracker | Stride |
| `index.html` `meta description` | „Trainingstracker für den Halbmarathon-Plan: …“ | „Trainingsplan, Strava-Läufe und Krafteinheiten an einem Ort.“ |
| `index.html` `theme-color` light | #ffffff | #f4f3ef |
| `manifest.webmanifest` `name` / `short_name` | Halbmarathon Tracker / HM Tracker | Stride / Stride |
| `manifest.webmanifest` `background_color` | #ffffff | #f4f3ef |
| `view-account.js` `.auth-brand-name` | Halbmarathon Tracker | Stride |
| Tab-Leiste `data-tab="dashboard"` Label | Dashboard | Heute |
| `README.md` (Titel/Einleitung) | Halbmarathon Tracker | Stride |

**Wichtig – bewusst NICHT umbenennen:** alle `localStorage`/`sessionStorage`-Schlüssel mit Präfix `hm-tracker.` / `hm-tracker-notice`, `package.json` `name`, die Worker-URL `hm-tracker-auth…` und die Tests. Sonst gehen gespeicherte Pläne und Overrides verloren, und Abmelden/Aufräumen (`firebase-init.js` filtert auf `hm-tracker.`) greift nicht mehr. Interne IDs dürfen den alten Namen behalten.

Name nie in Großbuchstaben, nie mit Distanz kombiniert. Das Ziel steht als Untertitel, z. B. „Halbmarathon · 02.05.2027“, und kommt aus dem aktiven Plan, damit es später für den Marathon passt.

## 2. Logo

**Motiv „Kadenz“:** zwei abgerundete Balken (Schritte), um 14° nach vorn geneigt. Weiß = landender Fuß, Koralle = abdrückender Fuß. Nicht spiegeln, nicht drehen.

| Datei (`assets/`) | Verwendung |
| --- | --- |
| `icon.png` (1024², quadratisch, Glas-Optik eingebacken) | ersetzt `icon.png` im Repo-Root (Manifest, Favicon) |
| `icon-512.png`, `icon-192.png` | zusätzlich ins Manifest |
| `apple-touch-icon.png` (180²) | `<link rel="apple-touch-icon">` |
| `stride-mark.svg` / `stride-mark-dark.svg` | **flaches** Zeichen in der App (Header, Login), hell/dunkel |
| `check.svg` | der neue Haken (siehe Bausteine) |

Die PNGs sind quadratisch ohne Rundung, weil iOS und Android selbst maskieren. Das Motiv liegt innerhalb der Maskable-Safe-Zone.

```json
"icons": [
  { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
  { "src": "icon.png", "sizes": "1024x1024", "type": "image/png", "purpose": "any" }
]
```

**Regeln:** Glas-Optik nur als App-Icon auf dem Home-Bildschirm. In der App immer das flache SVG. Mindestgröße 20 px. Wortmarke „Stride“: Geist 600, letter-spacing −0.035em, Abstand zum Zeichen 10 px (28-px-Zeichen) bzw. 14 px (64-px-Zeichen).

Flaches SVG (für Inline-Nutzung):
```html
<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#0f6e56"/><g transform="rotate(14 32 32)"><rect x="17" y="27" width="11" height="22" rx="5.5" fill="#fff"/><rect x="36" y="15" width="11" height="22" rx="5.5" fill="#e0673d"/></g></svg>
```

---

## 3. Design Tokens

Die Namen folgen den vorhandenen Variablen in `style.css`. Bestehende Werte bleiben, neu sind die mit ★ markierten Tokens. Dunkel gilt über `prefers-color-scheme: dark` (und den vorhandenen Override, falls es einen gibt).

### Farben

| Token | Hell | Dunkel | Verwendung |
| --- | --- | --- | --- |
| `--bg` ★ | #f4f3ef | #17171a | Seitenhintergrund |
| `--card` ★ | #ffffff | #26262b | Karten, Sheet |
| `--sunk` ★ | #efeee9 | #202024 | Eingabefelder, Sekundärbuttons, Segment-Hintergrund |
| `--line` ★ | #efeee9 | #33333a | Trennlinien in Listen |
| `--text-primary` | #1c1c1a | #f2f1ec | Text |
| `--text-secondary` | #5f5e5a | #b3b2ab | Text 2 |
| `--text-muted` | #8a897f | #918f87 | Text 3, Hinweise |
| `--ink-faint` ★ | #b5b4ac | #6e6d66 | Chevrons, Info-Icons |
| `--ring-dashed` ★ | #c9c8c0 | #55545a | gestrichelter „offen“-Ring |
| `--ink-off` ★ | #dcdbd5 | #3a3a40 | inaktive Fortschrittspunkte, Sheet-Griff |
| `--track` ★ | rgba(0,0,0,.08) | rgba(255,255,255,.10) | Hintergrund von Fortschrittsbalken |
| `--primary` ★ | #0f6e56 | #5fcfa7 | Primärbutton-Fläche, aktiver Zustand |
| `--on-primary` ★ | #ffffff | #0c2a21 | Text/Haken auf Primär |
| `--teal` / `--teal-fg` | #0f6e56 | #5fcfa7 | Kraft, Fortschritt |
| `--teal-bg` | #e1f5ee | #0c3a2f | aktiver Tab, Tip „steigern“ |
| `--teal-tint` ★ | #f3faf7 | #142a24 | hervorgehobene Zeile (Heute, aktiver Satz) |
| `--coral-accent` ★ | #c4532c | #ef8f61 | Lauf: Streifen, Balken, Haken-Kreis |
| `--coral` / `--coral-fg` | #993c1d | #ef8f61 | Lauf-Text |
| `--coral-bg` | #faece7 | #3d2013 | Lauf-Fläche |
| `--purple` / `-fg` / `-bg` | #534ab7 / #eeedfe | #a49df5 / #262156 | Long Run, Coach |
| `--purple-ink` ★ | #3d3590 | #d0ccff | Coach-Fließtext |
| `--sky` / `-bg` | #1e6b8f / #e0f0f8 | #5fb6dd / #0b2f42 | Recovery, Z1, Tip „Deload halten“ |
| `--amber` / `-bg` | #96631a / #fbf0dc | #ddaa55 / #3a2a0e | Hinweis, teilweise, nachgeholt |
| `--ok-fg` / `--ok-bg` | #2f7d32 / #e3f2e1 | #7ed88f / #123a1c | Ampel grün, „im Plan“ |
| `--ok-band` ★ | #cfe8d0 | #1f5a2c | Zielbereich in Range-Balken |
| `--danger-fg` / `--danger-bg` | #b3261e / #fbe4e1 | #ff8a80 / #4a1f1c | Fehler, verpasst, Abmelden |
| `--glass` ★ | rgba(255,255,255,.86) | rgba(38,38,43,.86) | Tab-Leiste |
| Logo-Koralle | #e0673d | #ef8f61 | nur im Logo |

**Farbregeln:**
- Teal ist die Hauptaktion; pro Screen höchstens **eine** teal gefüllte Fläche.
- Koralle bedeutet Laufen, **nie** Fehler. Fehler und „verpasst“ sind immer Danger-Rot.
- Status nie nur über Farbe: Ampel = Farbe + Form (siehe unten), Kategorie = Farbstreifen + Text.

### Typografie
Neue Schriften: **Geist** (UI) und **Geist Mono** (alle Zahlen). Beide Open Source (SIL OFL). Am besten als woff2 selbst hosten (`fonts/`), alternativ Google Fonts. Fallback `-apple-system, "Segoe UI", sans-serif` bzw. `ui-monospace, Menlo, monospace`.

| Rolle | Größe / Gewicht / letter-spacing | Beispiel |
| --- | --- | --- |
| Display | 30 / 600 / −0.03em, line-height 1.1 | „Dienstag, 20. Oktober“ |
| Titel | 24 / 600 / −0.02em | „Full Body A“ |
| Überschrift | 17 / 600 / −0.01em | |
| Abschnitts-Label | 13 / 600, `--text-secondary` | „Status“, „Diese Woche“ |
| Fließtext | 15 / 400 / lh 1.5 | Coach |
| Listentitel | 14.5 / 600 | Tageszeile |
| Hinweis | 12–12.5 / 400, `--text-muted` | Untertitel |
| Überzeile | 11.5 / 600 / +0.06em, Großbuchstaben | „HEUTE · KRAFT“ |
| Daten | Geist Mono 13–48 / 500–600 / −0.02 bis −0.04em | „8,2 km“, „6:22 /km“ |

Einheiten hinter Mono-Zahlen in Geist 12–18 px, Gewicht 500, `--text-muted`, Abstand 3–6 px. Minimum 10.5 px (nur Achsenbeschriftung), sonst 11 px. Eingabefelder mindestens 16 px, sonst zoomt iOS. Deutsche Zahlen: Komma (8,2 km), Zeiten mit Doppelpunkt (1:29:59).

### Abstände, Radien, Schatten
- **4er-Raster.** Karten haben 12 px Rand zum Screen und 8–12 px zueinander, 20 px Innenabstand. Abschnitts-Labels: 28 px oben, 10 px unten, 20 px seitlich. Header-Inhalte 20 px seitlich, 54 px Statusbar-Abstand → `env(safe-area-inset-top)`.
- **Tippflächen** mindestens 44×44 px.
- **Radien:** Chip/Pill 20 px (voll rund) · Feld 12 · Button 14 (groß 16) · Karte 22 · Sheet 28 (oben) · Tab-Leiste 32 · Satz-Karte 16.
- **Karten ohne Schatten und ohne Rahmen** (weiß auf `--bg`). Schatten nur für schwebende Elemente:
  - Tab-Leiste: `0 8px 24px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.08)`
  - Sheet: `0 -10px 30px rgba(0,0,0,.2)`

---

## 4. Bausteine

**Primärbutton:** Höhe 50 (Kraft-Fokus 54), Radius 14/16, `--primary` / `--on-primary`, 15–16 px / 600, volle Breite. Hover/Active: #0b5a46 (hell) bzw. #4cbf96 (dunkel).
**Sekundärbutton:** Höhe 44, Radius 12, `--sunk`, `--text-primary`, 14 / 600.
**Text-Button:** ohne Fläche, `--teal`, 14–15 / 500–600 (z. B. „‹ Heute“ oben links mit Chevron).
**Danger-Button:** `--danger-bg` / `--danger-fg`.

**Pill (Status):** 11–11.5 / 600, padding 4×10, Radius 20.
- Heute = `--primary` / `--on-primary`
- erledigt = `--ok-bg` / `--ok-fg`, mit Haken 11 px
- 7/8, nachgeholt, zu kurz = `--amber-bg` / `--amber`
- verpasst = Danger
- Deload = `--sunk` / `--text-secondary`
- optional = gestrichelter 1-px-Rahmen `--text-muted`

**Haken (neu, ersetzt das ✓-Zeichen überall):** SVG-Pfad `M5 12.5l4.5 4.5L19 7.5`, stroke-width 3.2, round caps/joins (`assets/check.svg`).
- **Erledigt:** gefüllter Kreis 24 px (Listen; 20–22 px in kompakten Listen) in der Farbe der Einheit (Kraft = `--teal`, Lauf = `--coral-accent`, Long = `--purple`), Haken 13 px in `--on-primary`/weiß.
- **Offen:** gestrichelter Ring gleicher Größe, 1.5 px `--ring-dashed`.
- **Läuft gerade:** Ring 2 px `--teal` mit 8-px-Punkt in der Mitte.

**Ampel-Formen** (10 px): grün = Kreis `--ok-fg` · Achtung = Raute (9 px Quadrat, 45° gedreht, Radius 2) `--amber` · kritisch = Quadrat Radius 2.5 `--danger-fg` · keine Daten = Ring 2 px `--text-muted` · lädt = Ring 2 px `--ink-off`.

**Tageszeile (Woche):** padding 14×20, gap 14. Links Tag (12/600) über Datum (Mono 11, muted), 30 px breit. Dann Streifen 3 px × volle Höhe, Radius 2, Farbe der Einheit. Dann Titel 14.5/600 + Untertitel 12 muted. Rechts der Status (Haken, Pill oder Ring). Die Heute-Zeile hat Hintergrund `--teal-tint` und den Tag in `--teal`. Ruhetage: Titel 400 muted, nicht antippbar.

**Stepper (Kraft):** runde Tasten 44 px `--card` auf `--teal-tint`-Fläche (aktiver Satz). Wert Geist Mono 24/600 dazwischen. Gewicht ±2,5 kg, Wiederholungen ±1, Zeit ±5 s.

**Segment-Schalter:** Container `--seg` (#e6e5df / #2c2c31), padding 3, Radius 12. Aktives Segment `--card`, Radius 9, Höhe 34, 13/600.

**Tab-Leiste (schwebend):** links/rechts 12 px, unten 26 px + `env(safe-area-inset-bottom)`, Höhe 64, Radius 32, `--glass` + `backdrop-filter: blur(22px) saturate(180%)`. 4 Items gleich breit, Icon 20 px über Label 10.5/600. Aktiv: Item-Fläche `--teal-bg` (Radius 26) + `--teal`. Inaktiv `--text-secondary`. Labels: **Heute · Woche · Verlauf · Plan**. Icons wie bisher in `index.html`. Auf Detail-Screens (Kraft-Tag, Lauf-Tag) wird die Leiste ausgeblendet. Scroll-Bereich unten 120 px Polster.

**Info-Sheet** (vorhandenes `#infoSheet` restylen): Backdrop rgba(0,0,0,.38), Sheet `--card`, Radius 28 oben, max. 78 % Höhe, padding 10/20/36. Griff 36×5 `--ink-off`. Titel 19/600, Schließen-Knopf 36 px rund `--sunk`. Inhalt als Blöcke mit Überschrift 12/600 muted und Text 14.5 / lh 1.55. Gliederung immer **Berechnung → Bedeutung → Grau** (bzw. „Ehrlicher Hinweis“). Die Texte kommen aus den Grenzwerten in `config.js`.

**Leer- und Ladezustände:**
- Leer: ein Satz, was fehlt, plus genau ein Button. Keine Illustrationen.
- Laden: Seite sofort zeigen; Coach, Strava und Ampeln laden einzeln mit grauen Platzhalter-Balken (Höhe 10, Radius 5), nie ein Spinner über allem.

---

## 5. Screens

Basis: 390 px Breite, `--bg`. Alle Karten `--card`, Radius 22.

### 5.1 Heute (Tab „Heute“, bisher Dashboard – `view-dashboard.js`)
1. **Kopf:** flaches Zeichen 28 px + „Stride“ 16/600. Rechts Pill „W8 / 35“ (Mono 12/500, `--card`).
2. „Woche 8 · Entlastung“ (14, secondary), darunter das Datum als Display. Phasenbalken 6 px (`--track`, Füllung `--teal` = Woche/Gesamt), darunter Mono 11.5: „Phase 1 · Basis“ links, „194 Tage bis 02.05.“ rechts.
3. **Banner** (nur bei Bedarf):
   - Fehler: Fläche `--danger-bg`, Titel „Daten nicht geladen“, Erklärung, weißer Button „Neu laden“.
   - Strava getrennt: Karte „Strava ist nicht verbunden“ + Button „Verbinden“ (`--coral-bg` / `--coral`).
4. **Heute-Karte:**
   - Kraft: Überzeile „● HEUTE · KRAFT“ (teal), rechts Pill „Deload“. Titel „Full Body A“, darunter „x von y Übungen erfasst“ bzw. „8 Übungen · ca. 80 % …“. Vorschau der ersten 3 Übungen (Status-Kreis 20 px, Name 14.5, Soll Mono 13 rechts, Trennlinien), „+ 5 weitere Übungen“. Primärbutton „Training starten“ / „Weiter trainieren“ / „Einheit ansehen“ → Kraft-Tag.
   - Ruhetag: „HEUTE · RUHE“, „Ruhetag“, „Mobility, Foam Rolling, Beine hoch.“, darunter Zeile „Morgen“ + nächste Einheit mit Farbstreifen und Chevron.
   - Kein Plan: „Kein Plan aktiv“ + Erklärung + Sekundärbutton „Zum Plan“.
5. **Coach-Karte:** Fläche `--purple-bg`, Überzeile „COACH“ mit Sprechblasen-Icon (`--purple`), Text 15 / lh 1.5 in `--purple-ink`. Beim Laden zwei Platzhalter-Balken.
6. **Status:** Label „Status“, Karte mit 4 Zeilen (Wochensoll, Easy-Disziplin, Belastung, Kraft-Progression). Je Zeile Ampel-Form, Titel 14.5/500, Detail 13 secondary rechts und ein Info-Icon (Kreis mit i, `--ink-faint`). Die ganze Zeile öffnet das Info-Sheet.
7. **Diese Woche:** Karte mit 7 Spalten. Kürzel 11 muted über einem Kreis 36 px:
   - offen = Kategorie-Fläche mit Label (Mono 11/600: km bzw. A/B, „–“ für Ruhe)
   - erledigt = gefüllt in Kategoriefarbe mit weißem Haken
   - heute = zusätzlicher Ring `0 0 0 2px --card, 0 0 0 4px --teal`

   Darunter „Laufvolumen“ + „8,2 / 30 km“ (Mono) und ein Balken 6 px `--coral-accent`. Ein Tipp auf die Karte öffnet den Tab Woche.

### 5.2 Woche (`view-week.js`)
- **Kopf:** „19.–25. Oktober · Entlastung“ (14, secondary) über „Woche 8“ (Display). Rechts zwei runde Tasten 44 px (`--card`) für zurück/vor; an der Grenze opacity .35. Außerhalb der aktuellen Woche erscheint eine Pill „Zu heute“ (`--teal-bg` / `--teal`, Höhe 34).
- **Summen-Karte**, 2 Spalten:
  - Laufvolumen „8,2 / 30 km“ (Mono 22 + Einheit), Balken 5 px Koralle
  - Kraft „1 / 2 Einheiten“, Balken teal
- **Tagesliste** in einer Karte (Tageszeile siehe Bausteine). Ein Tipp klappt die Zeile auf: Detailzeilen 13 secondary (Ziel, Ist, Hinweise in amber), eingerückt 84 px, dazu Sekundärbutton „Tag öffnen ›“ → Kraft- oder Lauf-Tag. Es ist immer nur eine Zeile offen.
- **Woche ohne Details:** Karte „Tagesdetails folgen“ + „Nach der Re-Kalibrierung am 28.10. stehen hier die Einheiten. Geplant sind 40 km.“

### 5.3 Kraft-Tag (`app.js` renderKraftDay) – **Variante B „Fokus“**
Ziel: im Studio eine Übung groß bedienen und gleichzeitig den ganzen Plan sehen. Die Reihenfolge der Übungen in der App wird **nicht** verändert. Man trainiert in beliebiger Reihenfolge und tippt einfach die Übung an, die man gerade macht.

1. **Kopfzeile:** links Text-Button „‹ Heute“ bzw. „‹ Woche“ (je nach Herkunft), rechts Mono 12.5 secondary „x von y erledigt“. Keine Tab-Leiste.
2. **Fortschrittspunkte:** eine Reihe Segmente (flex 1, 6 px hoch, Radius 3, gap 4), eins pro Übung. Erledigt = `--teal`, aktuell = `--text-primary`, offen = `--ink-off`. Antippbar.
3. **Jetzt-Karte** (Karte, padding 20, gap 14):
   - Überzeile „● JETZT“ (teal), rechts Mono 12 muted „Letztes Mal 4×5 · 75 kg“.
   - Übungsname 26/600 −0.03em, darunter „**2×6** · Hinweis“ (Soll Mono 600).
   - Optionaler Progressions-Tipp als Chip (12.5/600, padding 6×10, Radius 10). Varianten aus `progression.js`:
     - Deload halten = `--sky-bg` / `--sky`
     - stagniert = amber
     - steigern = `--teal-bg` / `--teal` („+2,5 kg: zuletzt alle 15 Wdh sauber“)
   - **Sätze:**
     - Aktiver Satz: Fläche `--teal-tint`, Rahmen inset 1.5 px `--teal`, Radius 16, Label „Satz n“ 12.5/600 teal. Darunter zwei Stepper nebeneinander, Gewicht (flex 1.3) und Wiederholungen (flex 1); Wert Mono 24. Übungen ohne Gewicht zeigen nur den Wdh- bzw. Sekunden-Stepper.
     - Andere Sätze: kompakte Zeile auf `--bg`, Radius 14, padding 10×12: „Satz n“ (12.5 muted, 54 px) · „62,5 kg × 6“ (Mono 14; erledigt muted, offen faint) · erledigt = Haken-Kreis 22 px.
   - Gewicht ändern im aktiven Satz übernimmt den Wert für alle folgenden Sätze. Wiederholungen gelten nur für diesen Satz.
   - **Primärbutton** 54 px:
     - „Satz n fertig“: markiert den Satz und macht den nächsten aktiv.
     - Nach dem letzten Satz ist die Übung gespeichert (bisherige Speicherlogik); der Button heißt dann „Weiter: ‹nächste offene Übung›“.
     - Nach der letzten Übung: „Training abschließen“ → zurück zu Heute.
4. **Reihenfolge** (Label „Reihenfolge“, rechts 12 muted „Antippen, um sie als Nächstes zu machen“). Liste aller Übungen in Plan-Reihenfolge in einer Karte, Zeile padding 8×16:
   - Nummer (Mono 11.5 muted, 16 px)
   - Status-Kreis 22 px (erledigt = Haken teal · läuft = Ring + Punkt · offen = gestrichelt)
   - Name 14.5 (aktuell 600, erledigt muted) mit einzeiligem Ellipsis
   - Untertitel Mono 11.5 muted: erledigt = Zusammenfassung „2× 6 · 60 kg“, aktuell = „läuft · Satz 2 von 2“, offen = Soll

   Die aktuelle Zeile hat Hintergrund `--teal-tint`. Ein Tipp auf eine nicht erledigte Zeile macht sie zur Jetzt-Übung; die Seite bleibt stehen.
5. „Anpassen“ (Übung heute entfernen, zurückholen, eigene hinzufügen) gibt es heute schon. Für B wird es als Text-Button „Anpassen“ unter der Reihenfolge-Liste umgesetzt und öffnet den bestehenden Bearbeiten-Modus. Funktion unverändert.

### 5.4 Lauf-Tag (`app.js` renderRunDay, `runmatch.js`) – **Variante B „Vergleich“**
1. Kopfzeile wie Kraft-Tag. Überzeile in Kategoriefarbe, z. B. „LAUF · MO, 19.10.“ (Long Run lila), Titel „Easy run · 8 km“ (Display).
2. **Vergleichs-Karte** (padding 22×20, gap 20):
   - Links groß die Distanz in Mono 48/600, −0.04em, mit „km“ (18 muted). Darunter „von 8 km · 52:12“ (13.5 secondary). Rechts oben eine Pill „im Plan“ (`--ok-bg` / `--ok-fg`) bzw. „zu kurz“ (amber).
   - Distanzbalken 8 px, Radius 4, Füllung in Kategoriefarbe = Ist/Soll (max. 100 %).
   - **Range-Balken** für Pace und Ø Herzfrequenz:
     - Kopfzeile: Label 13 secondary, Wert Mono 15/600 (grün im Ziel, sonst amber).
     - Balken: Spur 6 px `--sunk`, Zielband `--ok-band`, Marker 4×18 px `--text-primary` mit 2-px-Rand in `--card`.
     - Achse Mono 10.5 muted: Min · „Ziel 6:15–6:40“ · Max.
     - Skalen: Pace 5:45–7:15 /km, HF 130–175 bpm. Am besten aus der Zone ±30 s bzw. ±18 bpm berechnen.
3. **Strava-Zeile** (Karte, padding 16×20): „Aus Strava“ (12 muted) über dem Laufnamen „Morgenlauf · 07:05“ (14.5/600). Rechts eine Pill „automatisch“ (`--sunk` / secondary) bzw. „von Hand“ (amber), dann ein Chevron. **Kein Läufer-Icon.** Ein Tipp öffnet das Zuordnungs-Sheet.
4. **Zuordnungs-Sheet:** Titel „Lauf für Mo, 19.10.“, Hinweis „Strava-Läufe von einem Tag davor bis drei Tage danach.“ Optionen als Zeilen (Radius 16, `--bg`) mit Radio 20 px; die gewählte Option hat Ring 2 px teal und Hintergrund `--teal-tint`. Läufe, die schon einem anderen Tag gehören, haben opacity .5, sind nicht wählbar und tragen „gehört schon zu …“. Unten ein Danger-Button „Kein Lauf an diesem Tag“.
5. **Zustände** (jeweils eine Karte, zentriert):
   - Zukunft: „Noch kein Lauf“ + Sekundärbutton „Lauf von Hand zuordnen“
   - Strava fehlt: „Strava ist nicht verbunden“ + „Läufe werden nicht hier eingetragen, sie kommen aus Strava.“ + Primärbutton „Mit Strava verbinden“
   - Ignoriert: „Bewusst leer gelassen“ + „Kein Lauf an diesem Tag. Zählt als verpasst.“ + „Automatik zurück“
6. Den Hinweis-Link auf die Desktop-Analyse im Prototyp **weglassen**, bis die Desktop-Version existiert.

### 5.5 Verlauf (`app.js` renderHistory)
- Kopf „Verlauf“ (Display) mit Segment-Schalter rechts: **Lauf | Kraft**. **Default: Lauf** (links).
- **Lauf:**
  - 2×2 Kacheln (Radius 18): Letzte 7 Tage, Letzte 28 Tage, Ø Pace, Läufe seit Planstart. Werte Mono 22.
  - Karte „Distanz je Lauf“: Balken 120 px hoch, Koralle bzw. Long Run lila, Radius 5, darunter der Tag in Mono 9.5.
  - Liste der letzten Läufe: Streifen 3 px, Typ 14/500, Datum Mono 11.5, rechts „8,2 km · 6:22“.
- **Kraft:**
  - Übungs-Chips, horizontal scrollbar (Höhe 36, aktiv `--teal-bg` / `--teal`).
  - Karte „Bestes Satzgewicht“ (Mono 30), rechts der Trend „+25 kg bis W7“ in `--ok-fg`.
  - Wochen-Balken 130 px hoch, teal; Deload-Wochen heller (#a8d5c4 / dunkel #2a5e4d); aktuelle Woche mit Label in teal.
  - Liste der letzten Einträge.

### 5.6 Plan (`app.js` renderPlan, `view-account.js`)
- „Woche 8 von 35 · 23 % geschafft“ über „Trainingsplan“.
- **Ziel-Karte:** „Ziel · Halbmarathon“ (12 muted), Zielzeit Mono 40/600 teal. Rechts „Renntag“ mit Datum Mono 15 und „4:16 /km“. Darunter der Phasenbalken: 4 Segmente proportional zu den Wochen, gap 3, Höhe 10, Radius 5, Farben `--teal-bg`, `--sky`-hell, `--amber`-hell, `--purple`-hell; die aktuelle Phase wird anteilig teal gefüllt.
- **Phasen:** Zeilen mit Nummern-Kachel 32 px (Radius 10, Kategorie-Farbe), Name 14.5/600, „Zeitraum · Fokus“ 12 muted; die laufende Phase hat eine Pill „läuft“.
- **Trainingsbereiche:** Zone-Badge Mono 12/600 (Z1 sky, Z2 teal, Z3 amber, Z4 coral, Z5 purple), Name, rechts HF (Mono 12.5) über Pace (Mono 11 muted).
- **Daten und Konto:** „Daten exportieren“ + Sekundärbutton „Export“ (`export.js`). Darunter „Angemeldet als“, Strava-Status und der Danger-Button „Abmelden“.

### 5.7 Login (`view-account.js`)
Vertikal zentriert, seitlich 24 px:
- Flaches Zeichen 64 px, darunter „Stride“ 32/600 und „Trainingsplan, Strava-Läufe und Krafteinheiten an einem Ort.“ (15 secondary, max. 280 px).
- Karte mit Feldern „E-Mail“ und „Passwort“: Label 12.5/500, Feld 48 px, `--sunk`, Radius 12, 16 px. Fehler in Danger-Fläche, z. B. „Bitte das Passwort eingeben.“ Primärbutton „Anmelden“.
- Fußnote „Registrieren ist in der App nicht möglich.“ (12 muted).

## 6. Interactions & Behavior
- **Navigation:** Tabs wechseln ohne Animation. Kraft- und Lauf-Tag sind Unterseiten mit Zurück-Button zur Herkunft (Heute oder Woche); beim Öffnen scrollt die Seite nach oben.
- **Chevron-Regel:** Zeilen mit Chevron › öffnen einen neuen Screen, Zeilen ohne Chevron klappen an Ort und Stelle auf.
- **Sheet:** öffnet sich von unten, ca. 250 ms ease-out. Schließen über Backdrop, ×-Knopf oder Escape. Fokus beim Öffnen auf den Titel, beim Schließen zurück auf den Auslöser (Verhalten von `#infoSheet` beibehalten).
- **Hover/Active** (Desktop-Browser): Primärbutton dunkler (#0b5a46). Sonst keine Hover-Effekte nötig.
- **Dunkelmodus:** alle Tokens über `prefers-color-scheme`. Die Logo-Variante wechselt auf `stride-mark-dark.svg`. `theme-color` dunkel bleibt #17171a.

## 7. State
Keine neuen Daten. Neu ist nur reiner UI-Zustand:
- Kraft-Tag: `focusExerciseId`. Startwert ist die erste nicht gespeicherte Übung; ein Tipp in der Reihenfolge-Liste setzt sie. Dazu `doneSets` je Übung (Satz-für-Satz-Abhaken). Gespeichert wird wie bisher pro Übung, sobald alle Sätze fertig sind.
- Woche: `openDayIndex` (eine Zeile offen).
- Verlauf: `historyMode`, Standard `"lauf"`.

## Files
- `design/Stride Prototyp.dc.html`: klickbarer Prototyp aller Mobile-Screens, hell und dunkel. Maßgeblich sind Kraft-Tag **B** und Lauf-Tag **B**.
- `design/Stride Regelbogen.dc.html`: Regelbogen mit Marke, Farben, Schrift, Abständen, Bausteinen und Verhalten.
- `design/GlassIcon.dc.html`: Referenz für die Glas-Optik des App-Icons.
- `design/support.js`: wird nur zum Öffnen der Referenzdateien gebraucht, nicht übernehmen.
- `assets/`: Icons und Logo (siehe Abschnitt 2).
