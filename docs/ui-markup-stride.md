# Markup-Referenz: Stride (Grundgerüst, Etappe E0)

Für den Coder. Optik: `docs/design-stride/README.md` (Handoff, verbindlich) plus
`docs/mockup-stride-luecken.html` (E0-Nachtrag, enthält jeden hier beschriebenen Baustein als
lebendes Beispiel, hell und dunkel, 390 und 320 px). Dieses Dokument ist das **Grundgerüst**:
Tokens, Klassenschema, Bausteine, `data-action`-Namen, Escaping-Regeln. Jede Screen-Etappe
(E3 bis E8) ergänzt unten ihren Abschnitt „Screen-Ergänzungen“.

Die Klassen entstehen in `style.css` in Etappe E1 (Tokens, Bausteine) und je Screen-Etappe
(Screen-Abschnitt). **Der Coder schreibt kein CSS und kein statisches `style="…"`.** Fehlt eine
Klasse, fragt er den Designer (Review-Auflage C5).

---

## 1. Konventionen auf einen Blick

| Thema | Regel |
| --- | --- |
| Präfix | Alle neuen Klassen beginnen mit `sd-` (Stride). Grund: Alte Screens laufen bis zu ihrer Ablösung auf derselben `style.css` (Plan: „alte Klassen bleiben bis zu ihrer Ablösung“). `.card`, `.badge`, `.hint`, `.start-btn` usw. bleiben bis dahin unberührt und werden nicht wiederverwendet. |
| Aufbau | BEM-nah: Baustein `sd-card`, Teil `sd-card__top`, Variante `sd-card--danger`. Zwei Unterstriche für Teile, zwei Bindestriche für Varianten. Keine Verschachtelung tiefer als `baustein__teil`. |
| Zustand | `is-done`, `is-current`, `is-open`, `is-active`, `is-selected`, `is-today`, `is-rest`, `is-removed`, `is-ok`, `is-warn`. Zustände setzt der Coder per Klassenliste, nie per Inline-Style. |
| Geometrie | Einzige erlaubte Inline-Form: **CSS-Custom-Property mit geklemmter Zahl**, z. B. `style="--pct:27"`. Erlaubt sind `--pct`, `--from`, `--to`, `--at` (jeweils 0 bis 100, höchstens eine Nachkommastelle, ohne Einheit). Nie Text aus Daten im `style`. **Seit E3 gilt für reine Fortschrittsbalken stattdessen `<progress class="sd-prog" value max>` ganz ohne `style` (Abschnitt 9.0).** **Seit E6 gibt es auch für `sd-range` kein `style` mehr: Band und Marker sind Inline-SVG, die Lage steht in Zahlen-Attributen (Abschnitt 12.3).** Damit ist `style=` auf allen Stride-Screens verboten; `--from`/`--to`/`--at` und `--pct` (`.sd-bar`) sind tot. |
| Test-Haken | `data-action` für Klicks, `data-form` für Formulare, `data-card` / `data-kind` für Karten, `data-slug`, `data-date`, `data-run`, `data-set`, `data-field`, `data-dir` für Parameter. Dazu Rollen und `aria-label`. Layout-Klassen sind keine Test-Haken. |
| Mockup-Klassen | `mk-*` und `.frame`/`.spec`/`.state` gehören nur dem Mockup und kommen nie in die App. |
| Sprache | Sichtbare Texte Deutsch, Sentence case. Kein Gedankenstrich (Em-Dash) in sichtbaren Texten; der Halbgeviertstrich in Zahlenbereichen („6:15–6:40“) ist erlaubt. Zahlen deutsch („8,2 km“, „1:29:59“). |
| Button-Namen | Ein Button heißt überall gleich: „Neu laden“ bleibt „Neu laden“, „Abmelden“ bleibt „Abmelden“. |

### Schriften und Größen
- UI: `Geist, -apple-system, "Segoe UI", sans-serif`. Zahlen: `"Geist Mono", ui-monospace, Menlo, monospace` (Klasse `sd-mono`, `font-variant-numeric: tabular-nums`). `@font-face` und `preload` bindet der Designer in E1 ein; das Mockup zeigt den Ersatz-Stack.
- Eingabefelder mindestens 16 px (iOS-Zoom). Tippflächen mindestens 44 × 44 px.
- **Fluide Größen** laufen über Container-Query-Einheiten (`cqi`) auf der Inhaltsspalte: Display `clamp(26px, 7.7cqi, 30px)`, große Distanz `clamp(40px, 12.4cqi, 48px)`.
- **Falle:** `container-type: inline-size` macht das Element zum Containing Block für `position: fixed`. Es darf darum **nur** auf `#main` und `#header` stehen (und im Mockup auf `.sd-screen`), **nie** auf `#app` oder einem Vorfahren der fixierten Tab-Leiste oder der Sheets.

---

## 2. Tokens (`:root`, dunkel über `@media (prefers-color-scheme: dark)`)

Namen folgen dem Handoff (§3) und den vorhandenen Variablen. `--surface-0/1/2` werden in der ganzen
Datei durch `--bg` / `--sunk` / `--card` ersetzt. Die Hell/Dunkel-Werte stehen 1:1 im Mockup
(`.theme-light`, `.theme-dark`).

| Token | Hell | Dunkel | Verwendung |
| --- | --- | --- | --- |
| `--bg` | #f4f3ef | #17171a | Seite, offene Sätze |
| `--card` | #ffffff | #26262b | Karten, Sheet, Stepper-Tasten |
| `--sunk` | #efeee9 | #202024 | Felder, Sekundärbutton, Range-Spur |
| `--line` | #efeee9 | #33333a | Trennlinien |
| `--seg` | #e6e5df | #2c2c31 | Segment-Hintergrund, Hover Sekundärbutton |
| `--text-primary` / `-secondary` / `-muted` | #1c1c1a / #5f5e5a / #767570 (Louis 21.10.: statt #8a897f, 4,5:1) | #f2f1ec / #b3b2ab / #918f87 | Text |
| `--ink-faint` | #b5b4ac | #6e6d66 | Chevrons, Info-Icons (nie für Text) |
| `--ring-dashed` | #c9c8c0 | #55545a | offener Ring, Stepper-Unterlinie |
| `--ink-off` | #dcdbd5 | #3a3a40 | inaktive Punkte, Sheet-Griff, Ruhe-Streifen |
| `--track` | rgba(0,0,0,.08) | rgba(255,255,255,.10) | Balken-Hintergrund |
| `--primary` / `--primary-hover` / `--on-primary` | #0f6e56 / #0b5a46 / #fff | #5fcfa7 / #4cbf96 / #0c2a21 | Primärbutton, Haken |
| `--teal`, `--teal-fg` | #0f6e56 | #5fcfa7 | Kraft, Fortschritt, Text-Button |
| `--teal-bg` / `--teal-tint` / `--teal-soft` | #e1f5ee / #f3faf7 / #a8d5c4 | #0c3a2f / #142a24 / #2a5e4d | aktiver Tab, Heute-Zeile und aktiver Satz, Deload-Balken |
| `--coral-accent` | #c4532c | #ef8f61 | Lauf: Streifen, Balken, Haken-Kreis |
| `--coral` / `--coral-fg` / `--coral-bg` | #993c1d / #993c1d / #faece7 | #ef8f61 / #ef8f61 / #3d2013 | Lauf-Text und -Fläche |
| `--purple`, `--purple-fg`, `--purple-bg` | #534ab7 / #534ab7 / #eeedfe | #a49df5 / #a49df5 / #262156 | Long Run, Coach |
| `--purple-ink` / `--purple-soft` / `--purple-line` | #3d3590 / #dcd9fb / rgba(83,74,183,.18) | #d0ccff / #3b3480 / rgba(164,157,245,.22) | Coach-Text, Phasenbalken, Coach-Trennlinie |
| `--sky` / `--sky-bg` / `--sky-soft` | #1e6b8f / #e0f0f8 / #d3e7f1 | #5fb6dd / #0b2f42 / #1a4a62 | Recovery, Tipp „Deload halten“ |
| `--amber` / `--amber-bg` / `--amber-soft` | #96631a / #fbf0dc / #f3e3c4 | #ddaa55 / #3a2a0e / #5a4520 | Hinweis, teilweise, nachgeholt, zu kurz |
| `--ok-fg` / `--ok-bg` / `--ok-band` | #2f7d32 / #e3f2e1 / #cfe8d0 | #7ed88f / #123a1c / #1f5a2c | Ampel grün, „im Plan“, Zielband |
| `--danger-fg` / `--danger-bg` / `--danger-ink` | #b3261e / #fbe4e1 / #8c1d16 | #ff8a80 / #4a1f1c / #ffb4ab | Fehler, verpasst, Abmelden, Fließtext in Fehlerflächen |
| `--glass`, `--tab-shadow`, `--sheet-shadow`, `--backdrop` | siehe Mockup | siehe Mockup | Tab-Leiste, Sheet |

Das Zeichen ist ein `<img>` (`stride-mark.svg` / `stride-mark-dark.svg` über `<picture>`), darum gibt es keine `--mark-*`-Tokens (in E9 gelöscht).

**Neu gegenüber dem Handoff (Designer-Ergänzungen):** `--danger-ink`, `--purple-line`,
`--purple-soft`, `--sky-soft`, `--amber-soft`, `--teal-soft`, `--primary-hover`, `--seg`,
`--tab-shadow`, `--sheet-shadow`, `--backdrop`. Die Phasenbalken im Plan nehmen
`--teal-soft` / `--sky-soft` / `--amber-soft` / `--purple-soft`.

**Farbregeln (Handoff):** Teal = Hauptaktion, höchstens **eine** teal gefüllte Fläche pro Screen.
Koralle = Laufen, **nie** Fehler. Fehler und „verpasst“ sind Danger. Status nie nur über Farbe.

**Kontrast-Abweichung:** Offene Sätze zeigen ihren Wert in `--text-secondary`, nicht in
`--ink-faint` (Prototyp-Wert hat nur ca. 1,8:1). `--ink-faint` ist für Chevrons und Icons
reserviert, nicht für Text.

---

## 3. Bausteine

Alle Beispiele sind das Soll-Markup. `${esc(x)}` heißt: durch `esc()` (Abschnitt 6). Icons sind
`<svg class="sd-icon" viewBox="0 0 24 24">…</svg>` und tragen ihre Größe über die Klasse
(`sd-icon` 16 px, `sd-icon--20` 20 px). Ein rohes `<svg>` ohne Größenklasse in einer Flex-Zeile
ist verboten (schrumpft auf unsichtbar, siehe Spacing-Durchgang 03.10.). Icons sind rein
dekorativ (`aria-hidden="true"`), wenn daneben Text steht.

### 3.1 Marke
Flaches Zeichen, nie die Glas-Optik. In der App als `<img>` mit `<picture>`:
```html
<picture>
  <source srcset="stride-mark-dark.svg" media="(prefers-color-scheme: dark)">
  <img class="sd-mark" src="stride-mark.svg" alt="" width="28" height="28">
</picture>
```
`sd-mark` 28 px (Kopf), `sd-mark sd-mark--lg` 64 px (Login). Wortmarke daneben:
`<span>Stride</span>` in `.sd-brand` (Geist 600, −0.035em). Nie großgeschrieben, nie mit Distanz.

### 3.2 Buttons
```html
<button type="button" class="sd-btn sd-btn--primary" data-action="open-day">Lauf ansehen</button>
<button type="button" class="sd-btn sd-btn--primary sd-btn--lg" data-action="finish-set">Satz 2 fertig</button>
<button type="button" class="sd-btn">Sekundär</button>
<button type="button" class="sd-btn sd-btn--text">Text-Button</button>
<button type="button" class="sd-btn sd-btn--danger" data-action="logout">Abmelden</button>
<button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button>   <!-- auf Danger-Fläche -->
<button type="button" class="sd-btn sd-btn--coral" data-action="connect-strava">Strava verbinden</button>
<button type="button" class="sd-btn sd-btn--dashed" data-action="quick-add">+ Übung hinzufügen</button>
```
Höhen: Standard 44, `--primary` 50, `--primary sd-btn--lg` 54, `--md` 48. Zusätze: `--block` (volle Breite),
`--grow` (wächst in einer Button-Reihe), `--back` (Zurück-Knopf, siehe 3.9). Primärbuttons haben
`width: 100%`; in einer Reihe mit Text-Button `sd-btn--grow` ergänzen.
Zurück-Knopf: `<button class="sd-btn sd-btn--text sd-btn--back" data-action="back"><svg class="sd-icon sd-icon--20" …>Chevron links</svg>Heute</button>` (Label „Heute“ oder „Woche“ je nach Herkunft).

### 3.3 Pills
```html
<span class="sd-pill sd-pill--primary">Heute</span>
<span class="sd-pill sd-pill--primary">Heute · 2/8</span>           <!-- kombiniert, eine einzige Pill -->
<span class="sd-pill sd-pill--ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>erledigt</span>
<span class="sd-pill sd-pill--amber">7/8</span>   <!-- auch: HF zu hoch, zu kurz, von Hand, nachgeholt -->
<span class="sd-pill sd-pill--danger">verpasst</span>
<span class="sd-pill">Deload</span>                                   <!-- neutral: automatisch, Deload -->
<span class="sd-pill sd-pill--optional">optional</span>
<span class="sd-pill sd-pill--ok">im Plan</span>
<span class="sd-pill sd-pill--purple">eigene</span>
```
Der Text der Pill kommt aus festen Strings; nur `Heute · ${done}/${total}` und `${done}/${total}` enthalten Zahlen.

### 3.4 Haken-Kreis, Ring, laufend
```html
<span class="sd-check sd-check--22"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
<span class="sd-ring sd-ring--22"></span>                 <!-- offen: gestrichelt -->
<span class="sd-ring sd-ring--22 sd-ring--run"></span>    <!-- läuft: Ring 2 px teal + Punkt (per ::after) -->
```
Größen: ohne Zusatz 24 px, `--22`, `--20`. Kategorie: ohne Zusatz Kraft (teal), `sd-check--lauf`
(`--coral-accent`), `sd-check--long` (`--purple`). Der Haken-Pfad ist immer `M5 12.5l4.5 4.5L19 7.5`
(`assets/check.svg`), Strichstärke und Größe kommen aus der Klasse. Das alte „✓“-Zeichen entfällt überall.

### 3.5 Ampel-Formen (10 px)
```html
<span class="sd-ampel sd-ampel--ok"></span>     <!-- Kreis -->
<span class="sd-ampel sd-ampel--warn"></span>   <!-- Raute -->
<span class="sd-ampel sd-ampel--crit"></span>   <!-- Quadrat -->
<span class="sd-ampel sd-ampel--none"></span>   <!-- Ring, keine Daten -->
<span class="sd-ampel sd-ampel--load"></span>   <!-- Ring, lädt -->
```
Immer mit Text daneben; die Form allein trägt keine Information.

### 3.6 Stepper
Zwei Stepper in einer **umbrechenden** Zeile. Passen sie nicht nebeneinander (320 px immer), stehen
sie untereinander, jeder auf voller Breite. Die Einheit steht klein **unter** dem Wert.
```html
<div class="sd-steppers">
  <div class="sd-stepper sd-stepper--weight" role="group" aria-label="Gewicht in kg">
    <button type="button" class="sd-stepper__btn" data-action="step" data-field="kg" data-dir="-1" aria-label="Gewicht verringern">−</button>
    <button type="button" class="sd-stepper__val" data-action="edit-value" data-field="kg" aria-label="Gewicht eintippen, aktuell 62,5 kg">
      <span class="sd-stepper__num sd-mono" aria-live="polite">62,5</span><span class="sd-stepper__unit">kg</span>
    </button>
    <button type="button" class="sd-stepper__btn" data-action="step" data-field="kg" data-dir="1" aria-label="Gewicht erhöhen">+</button>
  </div>
  <div class="sd-stepper" role="group" aria-label="Wiederholungen"> … data-field="reps", Einheit „Wdh“ (bei Zeit: data-field="sec", Einheit „s“) … </div>
</div>
```
- Nur-Wdh-Modus: einziger Stepper mit `sd-stepper--solo` (volle Breite).
- Direkte Eingabe (V1): Tipp auf `sd-stepper__val` ersetzt die Schaltfläche durch
  `<span class="sd-stepper__field"><input class="sd-stepper__input" type="text" inputmode="decimal" aria-label="Gewicht in kg" value="82,5"><span class="sd-stepper__unit">kg</span></span>`,
  Inhalt markiert, Fokus im Feld. Im Satzkopf erscheint `<button class="sd-btn sd-btn--text" data-action="commit-value">Fertig</button>`. Wert wird beim Verlassen des Feldes, bei „Fertig“ oder beim Tipp auf ± übernommen. Kommazahlen wie „82,5“ parsen (`.replace(",", ".")`), ungültig = alter Wert.
- Schritte: Gewicht ±2,5 kg, Wdh ±1, Zeit ±5 s; Untergrenze 0.
- `aria-live="polite"` sitzt auf der Zahl.

### 3.7 Segment
```html
<div class="sd-seg" role="group" aria-label="Verlauf">
  <button type="button" class="sd-seg__opt is-active" aria-pressed="true" data-action="hist-mode" data-mode="lauf">Lauf</button>
  <button type="button" class="sd-seg__opt" aria-pressed="false" data-action="hist-mode" data-mode="kraft">Kraft</button>
</div>
```

### 3.8 Sheet (Info-Sheet `#infoSheet` und Zuordnungs-Sheet `#assignSheet`)
Beide Sheets teilen Markup und `createSheet()` (Auflage C6). In der App sind Sheet und Backdrop
`position: fixed` (Sheet unten, mit `env(safe-area-inset-bottom)` im unteren Padding); im Mockup absolut im Frame.
```html
<div class="sd-backdrop" id="assignBackdrop" hidden></div>
<div class="sd-sheet" id="assignSheet" role="dialog" aria-modal="true" aria-labelledby="assignSheetTitle" hidden>
  <div class="sd-sheet__grip"></div>
  <div class="sd-sheet__head">
    <h2 class="sd-sheet__title" id="assignSheetTitle" tabindex="-1">Lauf für ${dayShort}</h2>
    <button type="button" class="sd-sheet__close" data-action="close-sheet" aria-label="Schließen">${closeIcon}</button>
  </div>
  <!-- Inhalt -->
</div>
```
`hidden` plus `.open` für die Animation (ca. 250 ms ease-out, unter `prefers-reduced-motion` aus). Fokus beim Öffnen auf `.sd-sheet__title`,
beim Schließen zurück auf den Auslöser; Escape schließt. Der Sheet-Inhalt scrollt (`max-height: 78%`), Griff und Titelzeile bleiben sichtbar.

Info-Sheet-Inhalt (Gliederung Berechnung, Bedeutung, Grau oder „Ehrlicher Hinweis“):
```html
<div class="sd-sheet__blocks">
  <div><p class="sd-sheet__blockhead">Berechnung</p><p class="sd-sheet__blocktext">${esc(text)}</p></div>
</div>
```
(Klassen `sd-sheet__blocks/-blockhead/-blocktext` legt der Designer in E3 an; Überschrift 12/600 muted, Text 14.5, Zeilenhöhe 1.55.)

Zuordnungs-Sheet-Inhalt:
```html
<p class="sd-sheet__lead">Strava-Läufe von einem Tag davor bis drei Tage danach.</p>
<div class="sd-sheet__list" role="radiogroup" aria-label="Lauf wählen">
  <button type="button" class="sd-option is-selected" role="radio" aria-checked="true" data-action="assign-run" data-date="${iso}" data-run="${id}">
    <span class="sd-radio"></span>
    <span class="sd-option__main"><span class="sd-option__name">${dayShort} · ${esc(run.name)}</span><span class="sd-option__sub">${km} km · ${pace} /km · am Plantag</span></span>
  </button>
  <!-- belegt: <div class="sd-option" role="radio" aria-checked="false" aria-disabled="true"> … "gehört schon zu So, 18.10." -->
</div>
<div class="sd-sheet__tools">
  <button type="button" class="sd-btn sd-btn--text" data-action="reset-run" data-date="${iso}">Automatik zurück</button>   <!-- nur bei manueller Zuordnung oder ignoriert -->
  <button type="button" class="sd-btn sd-btn--text" data-action="reload-strava">${refreshIcon}Neu laden</button>
</div>
<button type="button" class="sd-btn sd-btn--danger sd-btn--md sd-btn--block" data-action="ignore-run" data-date="${iso}">Kein Lauf an diesem Tag</button>
```

### 3.9 Tab-Leiste und Kopfzeilen
Gebaut ist die Leiste in `index.html` als `<div id="tabbar">` mit vier `<button data-tab="dashboard|woche|verlauf|plan">` (Icon plus `<span>`); der aktive Tab trägt die Klasse `active`. Die im Mockup vorgesehenen Klassen `sd-tabbar` / `sd-tab` gibt es nicht (in E9 aus dem CSS entfernt).
Die Icon-Pfade stehen in `index.html`. In der App ist die Leiste fixiert an der 480-px-Spalte
(links/rechts 12 px, unten 26 px + `env(safe-area-inset-bottom)`), auf Detail-Seiten (`#app.is-detail`) ausgeblendet; `#main` bekommt unten 120 px Polster.
Detail-Kopfzeile:
```html
<nav class="sd-nav" aria-label="Kopfzeile">
  <button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${chevronLeft}Heute</button>
  <span class="sd-nav__meta">5 von 8 erledigt</span>   <!-- oder: <button class="sd-btn sd-btn--text" data-action="toggle-edit">Fertig</button> -->
</nav>
```

### 3.10 Karten
`sd-card` (Weiß auf `--bg`, Radius 22, Padding 20, Gap 14, kein Rahmen, kein Schatten). Varianten:
`--pad-sm` (16 × 20), `--list` (Padding 4 × 0, Gap 0, für Zeilenlisten), `--loose` (Gap 16), `--center` (zentriert, Leer- und Hinweiskarten),
`--coach` (Fläche `--purple-bg`), `--danger` (Fehlerfläche). Spalte: `<main class="sd-main">` (Gap 12, seitlich 12 px; `--tight` oben 16, `--flush` oben 4).
Abschnitts-Label: `<p class="sd-label">Status</p>`; mit Hinweis rechts: `<div class="sd-label-row"><p class="sd-label">Reihenfolge</p><p class="sd-hint">…</p></div>`.
Überzeile: `<p class="sd-eyebrow sd-eyebrow--coral"><span class="sd-eyebrow__dot"></span>Heute · Lauf</p>` (Varianten `--teal`, `--coral`, `--purple`, `--muted`; ohne Punkt: `--plain`).

Fehlerkarte / Banner (überall gleich, Heute, Kraft-Tag, Lauf-Tag):
```html
<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="firebase|strava|worker">
  <p class="sd-card__title sd-card__title--danger">${esc(title)}</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button></div>
</div>
```
Eine Fehlerkarte hat 0 bis 2 Aktionen; Koralle nie.

---

## 4. Zustands-Referenz der Lücken-Zustände (Mockup-IDs)

| ID | Zustand | Kern-Markup |
| --- | --- | --- |
| H1 | Heute, Lauf | `sd-card[data-card=today][data-kind=lauf]`, `sd-eyebrow--coral`, `sd-title`, `sd-text`, `sd-btn--primary` „Lauf ansehen“ |
| H2 | Lauf zugeordnet | `+ .sd-result` mit `sd-result__km`, `sd-pill--ok` „im Plan“ oder `sd-pill--amber` „zu kurz“, `sd-result__name` |
| H3 | Long Run | `data-kind=long`, `sd-eyebrow--purple` |
| H4 | Platzhalterwoche | `data-kind=placeholder`, `sd-eyebrow--muted` „Heute · Offen“, kein Button |
| H5 | Bis zum Rennen | `data-kind=race`, `sd-eyebrow--muted`, `.sd-nextrow` ohne Chevron, Kopf ohne `sd-chip` und ohne Phasenbalken |
| H6 | Coach und Wochenbilanz | `sd-card--coach`; Montag: `.sd-bilanz > h4.sd-bilanz__heading + p.sd-bilanz__body`; sonst `button.sd-bilanz__toggle[aria-expanded]` (+ `p.sd-bilanz__body`, bei zugeklappt `hidden`) |
| K1 | Kraft-Tag Gesamt | `sd-nav`, `sd-dots`, `sd-card[data-card=now]`, `sd-order__row`, `sd-card--pad-sm[data-card=strava-session]` (nur wenn Strava-Daten da), `sd-btn--text` „Anpassen“ |
| K2 | Anpassen-Modus | `sd-edit__row` (`is-removed` für entfernt), `sd-edit__actions`, `sd-btn--dashed` |
| K3 | Ersetzen / Hinzufügen | `form.sd-edit__form[data-form=replace]`, `form.sd-card[data-form=add-exercise]` mit `sd-field`, `sd-input` |
| K4 | Vorzeitig abschließen | `button.sd-set.is-done[data-action=reopen-set]`, `button[data-action=finish-early]` |
| K5 | Direkte Eingabe | `sd-stepper__input`, `[data-action=commit-value]` |
| K6 | Stepper 320 | `sd-steppers` (umbricht von selbst) |
| K7 | Nur-Wdh / „+ Gewicht“ | `sd-stepper--solo`, `[data-action=add-weight]` im `sd-set__head` |
| K8 | Ladefehler | `sd-card--danger[data-card=load-error]` |
| L1 | Nachgeholt, Plan-Hinweis | `sd-linkrow__note`, `.sd-planhint[data-card=plan-note]` |
| L2 | verpasst | `sd-card--center[data-card=missed]`, `sd-pill--danger`, `[data-action=pick-run]`, `[data-action=reload-strava]` |
| L3 | Range-Balken | `sd-range`, `sd-range__track` mit SVG `sd-range__band` und `sd-range__mark` (Zahlen-Attribute statt `style`, siehe 12.3); neutral: `sd-range__note` statt Spur; frei: `sd-range--plain` nur mit `sd-range__head` |
| L4 | Fehlerkarten | `sd-card--danger[data-source=…]` |
| L5 | Zuordnungs-Sheet | `sd-sheet`, `sd-option`, `sd-sheet__tools` |
| W1 | Wochenzeilen | `sd-day`, `sd-day__row`, Pills laut 3.3, `sd-vh` „(heute)“, `sd-day__detail` |
| P1 | Daten und Konto | `sd-split`, `sd-kvlist`, `sd-kv[data-slot=plan-source]` (Platzhalter, **kein** Button), `sd-notice` |
| A1 bis A3 | Login-Nebenscreens | `sd-auth`, `sd-auth__brand`, `sd-card`, `sd-notice--amber` / `--danger` |

### Range-Balken (Berechnung für `runcompare.js`)
- Geschlossene Zone `[min,max]`: Skala `min−30 s … max+30 s` (Pace) bzw. `min−18 … max+18` (HF). `--from`/`--to` = Zonengrenzen, `--at` = Istwert, jeweils `(wert − skalaMin) / (skalaMax − skalaMin) × 100`, geklemmt auf 0 bis 100.
- Offene Untergrenze „> g“: Skala `g−30 s … g+60 s` (Pace) bzw. `g−18 … g+36` (HF), Band von `g` bis 100. Offene Obergrenze „< g“: Skala `g−36 … g+18` (HF) bzw. `g−60 s … g+30 s` (Pace), Band von 0 bis `g`. Das Band reicht also bis an den Skalenrand.
- Achse links/rechts: Skalen-Min und -Max, Mitte „Ziel …“ mit dem Originaltext der Zone.
- Wertfarbe: `is-ok` (grün) im Ziel, sonst `is-warn` (amber). HF grün genau bei `avgHr ≤ hfMax`. Pace neutral (kein `is-ok`/`is-warn`, keine Spur, stattdessen `sd-range__note`) bei Intervall- und Schwellenläufen; frei (kein lesbares Ziel) = nur Kopfzeile, neutral.

---

## 5. `data-action`-Namen

Konvention: **kebab-case, Verb vorn** (`open-day`, `toggle-edit`). Ein delegierter Click-Handler auf
`#app` (`e.target.closest("[data-action]")`), keine `onclick`-Attribute. Formulare tragen `data-form`
und werden über das `submit`-Ereignis verarbeitet. Parameter immer als `data-*`:
`data-date` (ISO), `data-slug` (aus `slug()`), `data-run` (Strava-ID), `data-set` (0-basierter Satzindex),
`data-field` (`kg|reps|sec`), `data-dir` (`-1|1`), `data-mode` (`lauf|kraft`), `data-tab`.

**Bestehende Namen, die bleiben** (Tests und Handler hängen daran): `back`, `open-day`, `toggle-day-detail`,
`week-prev`, `week-next`, `week-today`, `toggle-bilanz`, `open-info`, `connect-strava`, `reload-strava`, `reload`,
`pick-run`, `assign-run`, `reset-run`, `ignore-run`, `hist-mode`, `export-data`, `logout`, `forbidden-logout`,
`retry-pending`, `toggle-edit`, `quick-add`, `add-exercise`, `cancel-add`, `replace-exercise`, `confirm-replace`,
`cancel-replace`, `remove-exercise`, `restore-exercise`.

**Neu:**

| Name | Wo | Parameter | Wirkung |
| --- | --- | --- | --- |
| `focus-exercise` | Dots, Reihenfolge-Liste | `data-slug` | macht die Übung zur Jetzt-Übung (auch erledigte, F6) |
| `step` | Stepper-Tasten | `data-field`, `data-dir` | Wert ± Schritt; Gewicht wirkt auf die folgenden Sätze, Wdh nur auf diesen Satz |
| `edit-value` | Stepper-Wert | `data-field` | wandelt den Wert in ein Eingabefeld (V1) |
| `commit-value` | „Fertig“ im Satzkopf | – | übernimmt den eingetippten Wert |
| `finish-set` | Primärbutton Jetzt-Karte | – | „Satz n fertig“; nach dem letzten Satz speichert es, danach „Weiter: …“ bzw. „Training abschließen“ |
| `finish-early` | Text-Button | – | „Mit n Sätzen abschließen“; speichert nur die fertigen Sätze (Auflage C1) |
| `reopen-set` | fertiger Satz | `data-set` | macht den Satz wieder aktiv |
| `add-weight` | „+ Gewicht“ | – | blendet den Gewichts-Stepper ein (Start 0) |
| `close-sheet` | ×-Knopf beider Sheets | – | ersetzt `close-picker` |

**Entfallen** (mit ihrem Screen): `toggle-sets`, `toggle-today-exercises`, `save`, `close-picker`.
Der Primärbutton der Jetzt-Karte wechselt sein Label, behält aber `data-action="finish-set"`; die Beschriftung im Verlauf
einer Einheit: „Satz n fertig“ → „Weiter: ‹nächste offene Übung›“ → „Training abschließen“. Letztere zwei bekommen
`data-action="next-exercise"` bzw. `data-action="finish-session"` (Namen verbindlich, weil Tests darauf zielen).

---

## 6. Welche Texte durch `esc()` müssen

`${esc(…)}` für **alles**, was nicht aus dem festen Quelltext stammt, auch in Attributen:

- Übungsnamen (Plan **und** vom Nutzer eingetippte eigene Übungen), `soll`, `hint`, `session.label`, Phasen- und Zielnamen, `info.note`.
- Progressions-Chip-Text, Hinweis-Texte aus `progression.js`/`metrics.js`/`coach.js` (auch wenn aktuell nur Zahlen drinstehen).
- Strava-Laufnamen (`run.name`), Pace-Labels, Zonen-Texte (`info.pace`, `info.hf`).
- Coach-Text und Wochenbilanz (KI-Text, höchste Gefahr, siehe `approved_escaping_pattern`).
- Fehlertexte (`s.error`, `loadError`, Firebase- und Strava-Meldungen).
- E-Mail und UID (Login-Wert `value="${esc(email)}"`, Konto-Karte, Kein-Zugriff-Karte), Hinweis-Texte (`notice`, `status`).
- Werte in `data-*`-Attributen (`data-slug="${esc(slug)}"`, `data-run="${esc(id)}"`).
- Formularwerte, die zurück ins Markup gehen (Ersetzen-Formular, Eingabefeld des Steppers).

**Nicht** durch `esc()`: feste deutsche Strings aus dem Quelltext, Icon-SVGs aus der `ICONS`-Map, Klassennamen aus Auswahllisten,
bereits formatierte Zahlen aus den Format-Helfern (`formatKm1`, Pace-Formatierer), ISO-Datumsstrings. Die Geometrie-Werte für `--pct`/`--from`/`--to`/`--at`
laufen durch einen Helfer `pct(x)` (Zahl, `Number.isFinite`, auf 0 bis 100 geklemmt, `toFixed(1)`), **nie** durch Textverkettung mit Datenwerten.

---

## 7. Responsive, Barrierefreiheit, Bewegung

- Fluide von 320 bis 1280 px: Spalte `max-width: 480px` zentriert, alle Zeilen `min-width: 0` mit `overflow-wrap: anywhere` für freie Texte; Buttonreihen und Stepper **umbrechen**, sie verschwinden nie.
- Bekannte Ausnahme der 44-px-Regel: die Fortschrittspunkte im Kraft-Tag sind bei acht Übungen und 320 px nur ca. 31 px breit (44 px hoch über `::after`). Die vollwertige Alternative ist die Reihenfolge-Liste direkt darunter.
- Fokus sichtbar (`:focus-visible`, 2 px `--teal-fg`), Status nie nur über Farbe, `aria-label` an jedem Stepper-Knopf, `role="alert"` an Fehlerkarten, `role="status"` an Hinweisen.
- `prefers-reduced-motion: reduce` schaltet Sheet-Übergang, Chevron-Drehung, Tasten-Skalierung und Skeleton-Schimmer ab.
- Leere Zustände: ein Satz, was fehlt, höchstens ein Hauptbutton (plus ein leiser Text-Button), keine Illustration. Ladezustände: graue Platzhalter-Balken (Höhe 10, Radius 5) je Slot, nie ein Spinner über allem.

---

## 8. Screen-Ergänzungen (je Etappe vom Designer nachgetragen)

| Etappe | Status | Wo |
| --- | --- | --- |
| E3 Heute | erledigt | Abschnitt 9 (Kopf, Banner, Heute-Karten, Coach, Status, Diese Woche, Info-Sheet-Blöcke) |
| E4 Woche | erledigt | Abschnitt 10 (Kopf mit Rundtasten, Summen-Karte, Tageszeilen-Akkordeon) |
| E5 Kraft-Tag | erledigt | Abschnitt 11 (Kopf, Dots, Jetzt-Karte, Sätze, Stepper, Reihenfolge, Strava-Zeile, Ladefehler, Anpassen-Modus E5b) |
| E6 Lauf-Tag | erledigt | Abschnitt 12 (Kopf, Vergleichs-Karte, Distanz- und Range-Balken, Strava-Zeile, alle Zustände, Zuordnungs-Sheet) |
| E7 Verlauf und Plan | erledigt | Abschnitte 13 (Verlauf Lauf und Kraft, Diagramme, Chips) und 14 (Plan, Ziel-Karte, Phasen, Zonen, Daten und Konto) |
| E8 Login und Nebenscreens | erledigt | Abschnitt 15 (Anmelden, Kein Zugriff, offene Einträge, Warten, Gate-Fehler) |
| E9 Abschluss | erledigt (CSS) | Abschnitt 16 (Löschungen, Safe Area, Konsistenz, bewusste Abweichungen, Rest-Migration) |

---

## 9. Screen-Ergänzungen: Heute (E3)

Optik: Handoff §5.1, Mockup H1 bis H6, Prototyp. CSS: Abschnitt „Heute (E3)“ am Ende von `style.css`.
Wiederverwendet wird alles aus Abschnitt 3 (`sd-card`, `sd-btn`, `sd-pill`, `sd-eyebrow`, `sd-nextrow`, `sd-stripe`,
`sd-result`, `sd-bilanz`, `sd-sheet__*`, `sd-ampel`, `sd-check`, `sd-ring`). **Kein `style=` auf diesem Screen.**

Icon-Konstanten (einmal in `view-dashboard.js` definieren, nicht `ICONS.*` nehmen, die haben keine Größenklasse):
```js
const I_CHAT    = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-4 4V5z"/><path d="M8 9h8M8 12.5h5"/></svg>';
const I_INFO    = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/></svg>';
const I_CHEV_R  = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const I_CHEV_D  = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const I_CHECK_W = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';   // in .sd-wd__dot
```
Haken-Kreis und Ring in der Übungsvorschau kommen aus `checkCircle("kraft", 20)` und `ringOpen(20)` (`ui.js`).

### 9.0 Seitenaufbau, Slots, dynamische Werte (Auflage C5)

```html
<!-- #header (Tab-Kopf OHNE brandHeadHTML(): .sd-head ist selbst die Markenzeile) -->
<div class="sd-head">…Kopf 9.1…</div>
<div class="sd-intro">…</div>

<!-- #main: genau ein .sd-main, darin fünf Slots -->
<div class="sd-main">
  <div id="banner-slot"></div>   <!-- Fehlerbanner, Strava-Banner (0 bis 2 Karten) -->
  <div id="today-slot"></div>    <!-- Heute-Karte (9.3) -->
  <div id="coach-slot"></div>    <!-- Coach-Karte (9.4) -->
  <div id="status-slot"></div>   <!-- Label + Status-Karte (9.5), ersetzt #ampel-slot -->
  <div id="week-slot"></div>     <!-- Label + Diese-Woche-Karte (9.6) -->
</div>
```
- Jeder Slot lädt einzeln nach. Ein **leerer Slot muss wirklich leer sein** (`innerHTML = ""`, kein Leerraum, kein Kommentar im Template), dann blendet `:empty` ihn aus und es entsteht kein 12-px-Loch.
- `#detail-slot` („Im Detail“) entfällt komplett (F3).
- Seit E3 steckt der Kopf in `<header class="sd-pagehead" data-region="pagehead">` als erstes Kind von `#main` (scrollt mit, trägt `env(safe-area-inset-top)` als padding-top); `#header` bleibt leer und ist `display: none`.
- `#main:has(> .sd-main)` und `.sd-pagehead:has(> .sd-head)` nullen das alte Seitenpolster bereits. Das Bodenpolster 120 px bleibt.

**Dynamische Werte ohne `style` (C5).** Es gibt auf Heute genau zwei Wertbalken, beide sind native `<progress>`:
```html
<progress class="sd-prog" value="8" max="35" aria-label="Planfortschritt, Woche 8 von 35"></progress>
<progress class="sd-prog sd-prog--coral" value="8.2" max="30" aria-label="Laufvolumen in Kilometern"></progress>
```
- Die Breite entsteht aus `value`/`max`, das Element klemmt selbst (`value` über `max` = voll, 0 = leer). Kein `style`, keine Custom Property, kein `pct()`.
- Helfer `numAttr(x)` in `view-dashboard.js`: `Number.isFinite(x) ? String(Math.round(Math.max(0, x) * 10) / 10) : "0"`. **Punkt als Dezimaltrenner** (HTML-Attribut), nie `formatKm1()` (Komma) im Attribut. Angezeigter Text daneben nutzt `formatKm1()`.
- `max` muss größer 0 sein. Ist die Soll-Summe 0 oder unbekannt, wird der Balken samt `.sd-weekvol`-Zeile weggelassen.
- Platzhalterbreiten sind feste Klassen: `sd-skel--w92`, `--w60`, `--w40`, `--chip` (72 px). Nicht `skelLine(width)` aus `ui.js` benutzen (das schreibt `style`).
- Alles andere Dynamische sind Klassen (`is-done`, `is-today`, `sd-wd--lauf`, `sd-ampel--warn` …).

### 9.1 Kopf

```html
<div class="sd-head">
  <div class="sd-brand">${markSVG(28)}<span>Stride</span></div>
  <span class="sd-chip"><span aria-hidden="true">W8 / 35</span><span class="sd-vh">Woche 8 von 35</span></span>
</div>
<div class="sd-intro">
  <p class="sd-intro__sub">Woche 8 · Entlastung</p>
  <h1 class="sd-display">Mittwoch, 21. Oktober</h1>
  <progress class="sd-prog" value="8" max="35" aria-label="Planfortschritt, Woche 8 von 35"></progress>
  <div class="sd-meta"><span>Phase 1 · Basis</span><span>193 Tage bis 02.05.</span></div>
</div>
```
| Zustand | Unterschied |
| --- | --- |
| Plan, Woche | wie oben. `sd-intro__sub` = `Woche ${n} · ${esc(weekType)}`. Meta links `Phase ${n} · ${esc(name)}`, rechts der Countdown-Text. |
| Platzhalterwoche | wie oben, `weekType` fehlt evtl.: dann nur `Woche ${n} · ${esc(phase.name)}`. |
| Bis zum Rennen (H5) | kein Chip, kein `<progress>`: `sd-intro__sub` „Zwischen zwei Planwochen“, `sd-meta` mit `<span>${esc(raceName)}</span><span>26 Tage bis 02.05.</span>`. |
| Kein Plan | kein Chip, kein `<progress>`: `sd-intro__sub` „Ohne Plan“, `sd-meta` nur wenn Text da (`<span>Rennen am 02.05.2027</span>`, ein Span). |

`sd-chip` und `sd-meta` brechen/laufen nie aus der Spalte: Chip ist `flex: none`, Meta bricht um (`flex-wrap`). Alle Texte der Zeile außer den festen Strings durch `esc()`.

### 9.2 Banner (`#banner-slot`)

Reihenfolge: Fehler zuerst, dann Strava. Beide dürfen gleichzeitig stehen.

**Fehlerbanner** (Firestore/Daten nicht geladen), Baustein aus 3.10:
```html
<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="firebase">
  <p class="sd-card__title sd-card__title--danger">Daten nicht geladen</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button></div>
</div>
```
**Strava nicht verbunden** (nur wenn `stravaState.connected === false`; bei `null` = Prüfung läuft, kein Banner; bei Fehler `data-source="strava"` als Fehlerkarte mit `reload-strava`-Knopf „Neu laden“):
```html
<div class="sd-card sd-card--banner" role="status" data-card="strava-disconnected">
  <div class="sd-banner__main">
    <p class="sd-card__title">Strava ist nicht verbunden</p>
    <p class="sd-card__text">Ohne Strava fehlen die Ist-Werte der Läufe.</p>
  </div>
  <button type="button" class="sd-btn sd-btn--coral" data-action="connect-strava">Verbinden</button>
</div>
```
Auf 320 px rutscht der Button unter den Text (Flex-Wrap), nichts wird abgeschnitten. Die Lauf-Karte zeigt dann **keinen** Ist-Wert-Block (der Banner erklärt es); den alten Satz „Strava ist nicht verbunden, deshalb fehlen die Ist-Werte“ in der Karte streichen.

### 9.3 Heute-Karte (`#today-slot`)

Immer ein `<article>` mit `data-card="today"`, `data-kind`, Titel als `<h2 class="sd-title" id="todayTitle">` und `aria-labelledby="todayTitle"`.
`data-kind`: `kraft | lauf | long | rest | placeholder | race | noplan`.

**Kraft** (`data-progress="none|partial|done"`):
```html
<article class="sd-card sd-card--loose" data-card="today" data-kind="kraft" data-progress="partial" aria-labelledby="todayTitle">
  <div class="sd-card__top">
    <p class="sd-eyebrow sd-eyebrow--teal"><span class="sd-eyebrow__dot"></span>Heute · Kraft</p>
    <span class="sd-pills">
      <span class="sd-pill">Deload</span>                                   <!-- nur in Deload-Wochen -->
      <span class="sd-pill sd-pill--optional">optional</span>              <!-- nur bei session.optional -->
      <span class="sd-pill sd-pill--ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>erledigt</span>   <!-- nur data-progress=done; = pill("ok-check","erledigt") -->
    </span>
  </div>
  <div>
    <h2 class="sd-title" id="todayTitle">${esc(session.label)}</h2>
    <p class="sd-text">3 von 8 Übungen erfasst</p>
  </div>
  <ul class="sd-preview" aria-label="Erste Übungen">
    <li class="sd-preview__row is-done">${checkCircle("kraft", 20)}<span class="sd-preview__name">${esc(ex.name)}</span><span class="sd-preview__soll sd-mono">${esc(ex.soll)}</span><span class="sd-vh">erfasst</span></li>
    <li class="sd-preview__row">${ringOpen(20)}<span class="sd-preview__name">${esc(ex.name)}</span><span class="sd-preview__soll sd-mono">${esc(ex.soll)}</span><span class="sd-vh">offen</span></li>
    <!-- insgesamt die ersten 3 Übungen -->
    <li class="sd-preview__more">+ 5 weitere Übungen</li>                  <!-- nur wenn mehr als 3; 1: "+ 1 weitere Übung" -->
  </ul>
  <button type="button" class="sd-btn sd-btn--primary" data-action="open-day" data-date="${session.date}">Weiter trainieren</button>
</article>
```
| Zustand | `sd-text` | Button-Label | Zeilen |
| --- | --- | --- | --- |
| nicht begonnen (`none`) | `${n} Übungen` (+ ` · ` + kurzer Zusatz aus dem Plan, z. B. Deload-Hinweis; Texte durch `esc()`) | Training starten | alle `ringOpen(20)`, `.sd-vh` „offen“ |
| begonnen (`partial`) | `${done} von ${n} Übungen erfasst` | Weiter trainieren | erfasste: `is-done` + `checkCircle`, `.sd-vh` „erfasst“ |
| erledigt (`done`) | `${n} von ${n} Übungen erfasst` | Einheit ansehen | alle `is-done`, Pill „erledigt“ |

Die Vorschau zeigt immer die ersten 3 Übungen in Planreihenfolge, nicht „die nächsten offenen“. Die Zeilen sind nicht antippbar (kein Chevron); einziger Einstieg ist der Primärbutton (`open-day` bleibt, `toggle-today-exercises` entfällt). Hat die Einheit keine Übungen, entfällt die `<ul>`.

**Ruhetag** (Prototyp: Ruhe mit „Morgen“-Zeile):
```html
<article class="sd-card" data-card="today" data-kind="rest" aria-labelledby="todayTitle">
  <p class="sd-eyebrow sd-eyebrow--muted"><span class="sd-eyebrow__dot"></span>Heute · Ruhe</p>
  <div><h2 class="sd-title" id="todayTitle">Ruhetag</h2><p class="sd-text">Mobility, Foam Rolling, Beine hoch.</p></div>
  <button type="button" class="sd-nextrow" data-action="open-day" data-date="${tomorrowISO}">
    <span class="sd-stripe sd-stripe--long"></span>
    <span class="sd-nextrow__main"><span class="sd-nextrow__label">Morgen</span><span class="sd-nextrow__value">Long run · 11 km</span></span>
    ${I_CHEV_R}
  </button>
</article>
```
Streifen: `sd-stripe--kraft | --lauf | --long` nach Art der morgigen Einheit. Ist morgen auch Ruhe: kein Button, stattdessen `<div class="sd-nextrow"><span class="sd-stripe"></span><span class="sd-nextrow__main"><span class="sd-nextrow__label">Morgen</span><span class="sd-nextrow__value">Ruhetag</span></span></div>` (ohne Chevron, nicht antippbar). Morgen außerhalb des Plans oder Platzhalterwoche ohne Details: Zeile weglassen. Wert (`Long run · 11 km`) durch `esc()`.

**Lauf und Long Run** (H1 bis H3). `data-kind="lauf"` bzw. `"long"` (Long Run = `LONG_RUN_TYPES`), Eyebrow `sd-eyebrow--coral` bzw. `sd-eyebrow--purple`, Text „Heute · Lauf“ bzw. „Heute · Long run“. Gerüst:
```html
<article class="sd-card" data-card="today" data-kind="lauf" aria-labelledby="todayTitle">
  <p class="sd-eyebrow sd-eyebrow--coral"><span class="sd-eyebrow__dot"></span>Heute · Lauf</p>
  <div>
    <h2 class="sd-title" id="todayTitle">${esc(session.type)} · ${esc(session.dist)}</h2>
    <p class="sd-text">Ziel <span class="sd-mono">${esc(session.pace)}</span> /km · HF <span class="sd-mono">${esc(session.hf)}</span> bpm</p>
  </div>
  <!-- Ist-Block: einer der vier unten, oder nichts -->
  <button type="button" class="sd-btn sd-btn--primary" data-action="open-day" data-date="${session.date}">Lauf ansehen</button>
</article>
```
(Steht in `session.pace`/`session.hf` die Einheit schon im Text, `/km` bzw. `bpm` im Template weglassen.) Der Button heißt in allen Lauf-Zuständen „Lauf ansehen“.

Ist-Block, je nach Strava-Zustand:
| Strava | Ist-Block |
| --- | --- |
| Prüfung läuft (`connected === null`) oder Läufe laden | `<div class="sd-skelstack sd-skelstack--rule" role="status"><span class="sd-skel sd-skel--w60"></span><span class="sd-skel sd-skel--w40"></span><span class="sd-vh">Lauf aus Strava wird geladen</span></div>` |
| nicht verbunden | nichts (Banner 9.2 erklärt es) |
| Ladefehler | nichts (Fehlerkarte im `#banner-slot`) |
| verbunden, noch kein Lauf zugeordnet | nichts (H1) |
| Lauf zugeordnet (H2) | siehe unten |

Zugeordnet:
```html
<div class="sd-result">
  <p class="sd-result__km sd-mono">${formatKm1(run.distanceKm)}<span class="sd-unit">km</span></p>
  <span class="sd-pills">
    <span class="sd-pill sd-pill--ok">im Plan</span>          <!-- oder: sd-pill--amber "zu kurz"; Urteil aus runcompare.js, kein Urteil = keine Pill -->
    <span class="sd-pill sd-pill--amber">nachgeholt</span>     <!-- nur wenn a.offset !== 0 -->
  </span>
  <p class="sd-result__name">${esc(run.name)}</p>
</div>
```
**Platzhalterwoche** (H4), kein Button:
```html
<article class="sd-card" data-card="today" data-kind="placeholder" aria-labelledby="todayTitle">
  <p class="sd-eyebrow sd-eyebrow--muted"><span class="sd-eyebrow__dot"></span>Heute · Offen</p>
  <div><h2 class="sd-title" id="todayTitle">Details nach der Re-Kalibrierung</h2><p class="sd-text">Die Einheiten dieser Woche stehen ab dem ${esc(dd.mm.)} fest. Geplant sind ${formatKm1(km)} km.</p></div>
</article>
```
Ohne bekanntes Datum/Kilometer: Satz kürzen auf „Die Einheiten dieser Woche stehen nach der Re-Kalibrierung fest.“

**Bis zum Rennen** (H5):
```html
<article class="sd-card" data-card="today" data-kind="race" aria-labelledby="todayTitle">
  <p class="sd-eyebrow sd-eyebrow--muted"><span class="sd-eyebrow__dot"></span>Heute · Frei</p>
  <div><h2 class="sd-title" id="todayTitle">Bis zum Rennen</h2><p class="sd-text">Der Plan endet vor dem Renntag. Für diesen Tag gibt es keine Einheit mehr.</p></div>
  <div class="sd-nextrow"><span class="sd-stripe sd-stripe--long"></span><div class="sd-nextrow__main"><span class="sd-nextrow__label">Renntag</span><span class="sd-nextrow__value">Sonntag, 02.05.2027</span></div><span class="sd-mono sd-hint">noch 26 Tage</span></div>
</article>
```
**Kein Plan** (Sekundärbutton, keine teal Fläche):
```html
<article class="sd-card" data-card="today" data-kind="noplan" aria-labelledby="todayTitle">
  <div>
    <h2 class="sd-title" id="todayTitle">Kein Plan aktiv</h2>
    <p class="sd-text">Läufe werden weiter aus Strava angezeigt.</p>
    <p class="sd-text">Heute: ${esc(stravaSummary)} (aus Strava)</p>     <!-- nur wenn Strava-Lauf heute da; sonst "Heute: noch kein Lauf." -->
  </div>
  <button type="button" class="sd-btn sd-btn--block" data-action="go-tab" data-tab="plan">Zum Plan</button>
</article>
```

### 9.4 Coach (`#coach-slot`)

Baustein `sd-card--coach` aus 3.10. Kein Fehlerzustand (Coach fällt auf den Regel-Text zurück, Hinweis F6).
```html
<!-- lädt -->
<article class="sd-card sd-card--coach" data-card="coach" data-state="loading" aria-busy="true">
  <p class="sd-eyebrow sd-eyebrow--purple">${I_CHAT}Coach</p>
  <div class="sd-skelstack" role="status">
    <span class="sd-skel sd-skel--purple sd-skel--w92"></span><span class="sd-skel sd-skel--purple sd-skel--w60"></span>
    <span class="sd-vh">Coach wird vorbereitet</span>
  </div>
</article>

<!-- geladen, ohne Wochenbilanz -->
<article class="sd-card sd-card--coach" data-card="coach">
  <p class="sd-eyebrow sd-eyebrow--purple">${I_CHAT}Coach</p>
  <p class="sd-coach__text">${esc(text)}</p>
</article>
```
Kein Plan / Bis zum Rennen: die geladene Variante mit dem festen Text (`coachNoPlanHTML`), ebenfalls `esc()`.

Mit Wochenbilanz (F3): Montags offen, sonst eingeklappt/aufgeklappt. Die Bilanz hängt als `<div class="sd-bilanz">` an das Ende der Karte (Trennlinie kommt aus der Klasse):
```html
<!-- Montag, offen -->
<div class="sd-bilanz">
  <h2 class="sd-bilanz__heading">Wochenbilanz · Woche ${weekN}</h2>
  <p class="sd-bilanz__body">${esc(text)}</p>
</div>
<!-- Di bis So, zugeklappt -->
<div class="sd-bilanz">
  <button type="button" class="sd-bilanz__toggle" data-action="toggle-bilanz" aria-expanded="false" aria-controls="bilanzBody">Wochenbilanz W${weekN}${I_CHEV_D}</button>
  <p class="sd-bilanz__body" id="bilanzBody" hidden>${esc(text)}</p>
</div>
<!-- Di bis So, aufgeklappt: gleiches Markup, aria-expanded="true" und ohne hidden am <p> -->
```
Tagessatz und Bilanz laden getrennt (bestehende `renderCoachSlot()`-Logik bleibt): Bilanz-Teil fehlt, bis er da ist.

### 9.5 Status (`#status-slot`)

Der Slot enthält Label und Karte. Immer vier Zeilen in der Reihenfolge Wochensoll, Easy-Disziplin, Belastung, Kraft-Progression. Die Zeile ist ein Button, auch im Ladezustand (die Erklärung ist statisch).
```html
<h2 class="sd-label" id="statusLabel">Status</h2>
<div class="sd-card sd-card--list" role="group" aria-labelledby="statusLabel" data-card="status" aria-busy="false">
  <button type="button" class="sd-statusrow" data-action="open-info" data-info="wochensoll" data-status="gelb">
    <span class="sd-statusrow__shape" aria-hidden="true"><span class="sd-ampel sd-ampel--warn"></span></span>
    <span class="sd-statusrow__main">
      <span class="sd-statusrow__title">Wochensoll</span>
      <span class="sd-statusrow__detail">62 % der geplanten km</span>
    </span>
    ${I_INFO}
    <span class="sd-vh">Status gelb. Erklärung öffnen</span>
  </button>
  <!-- weitere drei Zeilen -->
</div>
```
`data-info`: `wochensoll | easy | belastung | kraft`. Titel aus `AMPEL_LABELS`, Detail aus `a.detail` (beides `esc()`).

| `status` | Form (Klasse) | Text für Screenreader (`.sd-vh`) |
| --- | --- | --- |
| `gruen` | `sd-ampel--ok` | Status grün. Erklärung öffnen |
| `gelb` | `sd-ampel--warn` | Status gelb. Erklärung öffnen |
| `rot` | `sd-ampel--crit` | Status rot. Erklärung öffnen |
| `grau` (keine Daten) | `sd-ampel--none` | Keine Daten. Erklärung öffnen |
| lädt | `sd-ampel--load` | Status wird geladen. Erklärung öffnen |

Ladezeile: Karte bekommt `aria-busy="true"`, Detail ist ein einzelner Platzhalter, der Titel ist schon echter Text:
```html
<span class="sd-statusrow__detail"><span class="sd-skel sd-skel--chip"></span></span>
```
Alle vier laden gleichzeitig, schlägt das Laden fehl, bleibt es bei den Platzhaltern (bestehendes Verhalten); `grau`-Zeilen tragen den Grund aus `a.detail` („kein aktiver Plan“, „Woche ohne Details“). Die Form allein trägt nie die Information: Titel, Detail und `.sd-vh` stehen daneben.

### 9.6 Diese Woche (`#week-slot`)

Nur bei Plan mit Tagesdetails. **Bei Platzhalterwoche, Kein Plan und Bis zum Rennen bleibt der Slot leer.** Die ganze Karte ist ein Button, Tipp öffnet den Tab Woche.
```html
<h2 class="sd-label" id="weekLabel">Diese Woche</h2>
<button type="button" class="sd-card sd-weekcard" data-action="go-tab" data-tab="woche" data-card="week" aria-labelledby="weekLabel">
  <span class="sd-weekstrip">
    <span class="sd-wd sd-wd--lauf is-done">
      <span class="sd-wd__dow" aria-hidden="true">Mo</span>
      <span class="sd-wd__dot" aria-hidden="true">${I_CHECK_W}</span>
      <span class="sd-vh">Montag, Lauf 8 km, erledigt</span>
    </span>
    <span class="sd-wd sd-wd--kraft is-today">
      <span class="sd-wd__dow" aria-hidden="true">Di</span>
      <span class="sd-wd__dot" aria-hidden="true">A</span>
      <span class="sd-vh">Dienstag, Kraft A, offen, heute</span>
    </span>
    <span class="sd-wd sd-wd--long"> … <span class="sd-wd__dot" aria-hidden="true">11</span> … </span>
    <span class="sd-wd sd-wd--rest"> … <span class="sd-wd__dot" aria-hidden="true">–</span> <span class="sd-vh">Freitag, Ruhetag</span></span>
  </span>
  <span class="sd-weekload">
    <span class="sd-weekvol"><span class="sd-weekvol__label">Laufvolumen</span><span class="sd-weekvol__value sd-mono">8,2 / 30 km</span></span>
    <progress class="sd-prog sd-prog--coral" value="8.2" max="30" aria-label="Laufvolumen in Kilometern"></progress>
  </span>
  <span class="sd-vh">Woche öffnen</span>
</button>
```
Immer sieben `.sd-wd` Mo bis So.
| Zustand | Klassen auf `.sd-wd` | Inhalt von `.sd-wd__dot` | `.sd-vh` endet auf |
| --- | --- | --- | --- |
| offen | Art (`sd-wd--kraft`, `sd-wd--lauf` oder `sd-wd--long`) | Kraft: Kürzel A/B (Fallback „K“), Lauf/Long: gerundete km („8“, „11“) | „offen“ |
| erledigt | Art + `is-done` | `${I_CHECK_W}` | „erledigt“ |
| heute | zusätzlich `is-today` (Ring außen, Wochentag teal) | wie offen/erledigt | zusätzlich „, heute“ |
| Ruhe | `sd-wd--rest` | „–“ | „Ruhetag“ |
| verpasst (optional, siehe Hinweis) | Art + `is-missed` | wie offen | „verpasst“ |

Hinweis `is-missed`: der Handoff kennt für den Streifen nur offen/erledigt/heute. Eine vergangene, nicht erledigte Einheit sähe sonst wie eine künftige aus. `is-missed` (Danger-Fläche mit Innenring) ist eine optionale Ergänzung des Designers; der Coder setzt sie nur für Tage vor heute ohne erledigte Einheit (Woche-Tab nutzt dieselbe Regel „verpasst“). Lässt er sie weg, bleibt der Streifen handoff-treu.

Die 7 Kreise schrumpfen per Container-Query: 36 px ab 360 px Spaltenbreite, 32 px darunter, 28 px unter 320 px (Desktop-Fenster mit Scrollbalken). Heute-Ring (4 px außen) bleibt frei von den Nachbarn.

### 9.7 Info-Sheet-Inhalt

Sheet-Gerüst, Fokus auf Titel, Escape, Backdrop wie 3.8 (`createSheet()`, Auflage C6; `#infoSheet`/`#infoBackdrop` in `index.html` bekommen die `sd-sheet`/`sd-backdrop`-Klassen und `tabindex="-1"` am Titel). Inhalt:
```html
<div class="sd-sheet__blocks">
  <div><p class="sd-sheet__blockhead">Berechnung</p><p class="sd-sheet__blocktext">${esc(text)}</p></div>
  <div><p class="sd-sheet__blockhead">Bedeutung</p><p class="sd-sheet__blocktext">${esc(text)}</p></div>
  <div><p class="sd-sheet__blockhead">Ehrlicher Hinweis</p><p class="sd-sheet__blocktext">${esc(text)}</p></div>   <!-- nur Belastung -->
  <div><p class="sd-sheet__blockhead">Grau</p><p class="sd-sheet__blocktext">${esc(text)}</p></div>
</div>
```
- `infoContent()` liefert dafür Blöcke `{ heading, text }` (siehe Plan `openInfo(title, blocks, trigger)`), nicht mehr „Berechnung: …“ als Präfix im Fließtext. Reihenfolge immer Berechnung, Bedeutung, (Ehrlicher Hinweis), Grau.
- Zahlen in `text` kommen aus `THRESHOLDS` (`pct()`/`comma()` wie bisher). Die Überschriften sind feste Strings.
- Kein Lade- oder Leerzustand: Texte sind statisch. `aerobe` gehört nicht mehr zu Heute.

### 9.8 `data-action`-Namen auf Heute

| Name | Wo | Parameter | Wirkung |
| --- | --- | --- | --- |
| `open-day` | Primärbutton der Karte, „Morgen“-Zeile | `data-date` | bleibt (öffnet Kraft-/Lauf-Tag) |
| `open-info` | Status-Zeile | `data-info` | bleibt (öffnet Info-Sheet) |
| `close-sheet` | ×-Knopf, Backdrop-Klick | – | ersetzt `close-info` (siehe 3.8) |
| `toggle-bilanz` | Wochenbilanz-Auslöser | – | bleibt |
| `connect-strava` | Strava-Banner | – | bleibt |
| `reload` | Fehlerbanner | – | bleibt |
| `go-tab` | „Zum Plan“ (Kein Plan), Diese-Woche-Karte | `data-tab` (`woche` oder `plan`, die Schlüssel aus `index.html`) | **neu**: macht dasselbe wie ein Klick auf den Tab (`state.tab`, `selectedDate = null`, Woche: `weekNo = weekNoForTab(today)`, `render()`) |
Entfällt: `toggle-today-exercises`, `close-info`.

### 9.9 Welche Texte durch `esc()`

Zusätzlich zu Abschnitt 6: `session.label`, `ex.name`, `ex.soll`, `session.type/dist/pace/hf`, `run.name`, Phasen- und Wochentyp-Namen, Rennname, `a.detail`, Coach- und Bilanz-Text, Fehlermeldung, Strava-Zusammenfassung, `Morgen`-Wert, Infotexte. **Nicht** durch `esc()`: feste Strings (Labels, Button-Namen, „erfasst“/„offen“), Icon-Konstanten, `checkCircle()`/`ringOpen()`/`pill()` (escapen selbst), `formatKm1()`-Ergebnisse, ISO-Daten in `data-date`, Klassennamen aus Auswahllisten (`sd-wd--${kind}` nur aus einer festen Map `{kraft, lauf, long}`), die `numAttr()`-Werte in `<progress>`.

### 9.10 Barrierefreiheit auf Heute

- Überschriften: `h1` Datum, `h2` Heute-Karte, Status, Diese Woche und Wochenbilanz-Titel. Karten-Titel haben `aria-labelledby`.
- Status nie nur über Farbe: Ampel-Form plus Titel/Detail plus `.sd-vh`; Wochenstreifen: Haken-Form (erledigt), Label (offen), Ring und `.sd-vh` „heute“ (heute); Wochentag-Kürzel sind `aria-hidden`, der volle Name steht im `.sd-vh`.
- Ladezustände: `role="status"` auf dem Platzhalter-Stapel, `aria-busy` auf Coach-Karte und Status-Karte, der Lade-Text steht als `.sd-vh`.
- Fehlerbanner `role="alert"`, Strava-Banner `role="status"`.
- Tippflächen: Status-Zeile ≥ 56 px, Diese-Woche-Karte ganze Karte, „Morgen“-Zeile ≥ 64 px, Wochenbilanz-Auslöser 44 px, Buttons 44/50 px. Die Vorschau-Zeilen sind nicht interaktiv.
- Fokus: globales `:focus-visible` (2 px `--teal-fg`); alle Karten-Buttons haben abgerundete Ecken, der Ring folgt ihnen.
- Bewegung: Platzhalter-Schimmer wird unter `prefers-reduced-motion` zum ruhigen grauen Balken, Chevron-Drehung der Bilanz ist abgeschaltet.

### 9.11 Durch E3 überflüssig gewordene alte Klassen (Löschliste für `style.css`, nach dem Umbau)

**Erledigt in E4:** alle hier genannten Klassen sind aus `style.css` gelöscht (Grep über `*.js`, `index.html`, `tests/`: keine Treffer als Klasse). `.badge` und `.tone-*` bleiben.

Erst löschen, wenn `view-dashboard.js` und der Heute-Teil von `app.js` nicht mehr darauf zeigen und `tests/app.test.mjs` (Selektoren `.today-card`, `.ex-row`, `.coach-card`, `.ampel-tile`, `.ampel-dot`, `.bilanz-*`, `.si-bar-*`, `#header .badge/.countdown`) auf die neuen Hooks umgestellt ist.
- Kopf: `.countdown`, `#header .eyebrow`, `.badge`-Aufrufer `phaseBadgeHTML`/`noPlanBadgeHTML` (die Klasse `.badge` selbst bleibt, `badge()` in `ui.js` nutzen noch Kraft-/Lauf-Tag), `.tone-*` bleiben (Plan-Tab).
- Heute-Karte: `.today-card`, `.k-kraft`, `.k-lauf`, `.k-long`, `.k-ruhe`, `.k-noplan`, `.eyebrow2`, `.name2`, `.sub`, `.loading-hint`, `.strava-fallback`, `.start-btn`, `.ex-list`, `.ex-list-head`, `.ex-row`, `.exn`, `.exs`, `.ex-hint`, `.ex-progress`.
- Coach: `.coach-card` samt `.head/.icon/.label/.body/.text/.note/.divider`, `.bilanz-toggle`, `.bilanz-body`, `.bilanz-heading`.
- Ampeln: `.ampel-grid`, `.ampel-tile`, `.row1`, `.ampel-dot` (+ `.st-*`), `.info-btn`.
- Info-Sheet (alt): `.info-backdrop`, `.info-sheet`, `.info-sheet-handle`, `.info-sheet-head`, `.info-sheet-close`, `.info-sheet-body`.
- Im Detail: `.section-label`, `.si-bars`, `.si-bar-*`, `.lg-*` samt `.si-bar-legend`, `.aerobe-*`, `.metric-tile`, `.metric-bar-track/-fill`, `.metric-sub`, `.skel-tile-body`, `.skel-bar`.
- Platzhalter alt: `.skel`, `.skel-line`, `@keyframes skel-shimmer` (nach Entfernen von `skelLine()` aus `ui.js`).
- Slot-Regel `#today-slot, #coach-slot, #ampel-slot, #detail-slot` (ersetzt durch `.sd-main > [id$="-slot"]`).
- **Bleiben (noch benutzt):** `.metric-grid/-label/-value` (Lauf-Tag, Verlauf), `.center-note`, `.card.notice`, `.small-btn`, `.title-row` (Kraft-Tag, Verlauf), `.hint`, `.w-70` und die übrigen Utilities.

---

## 10. Screen-Ergänzungen: Woche (E4)

Optik: Handoff §5.2, Mockup W1, Prototyp (Woche). CSS: Abschnitt „Woche (E4)“ am Ende von `style.css`; die
Tageszeile selbst (`sd-day`, `sd-day__*`) steht schon im Abschnitt „Woche: Tageszeilen“ und wurde nur ergänzt.
Wiederverwendet: `sd-intro__sub`, `sd-display`, `sd-card`, `sd-card--list`, `sd-prog`, `sd-stripe`, `sd-pill`,
`sd-check`, `sd-ring`, `sd-btn`, `sd-vh`, `sd-mono`, `sd-unit`, `sd-hint`. **Kein `style=` auf diesem Screen.**

Icon-Konstanten (einmal in `view-week.js`, keine `ICONS.*`: die haben keine Größenklasse):
```js
const I_CHEV_L20 = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const I_CHEV_R20 = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const I_CHEV_R   = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';   // in "Tag öffnen"
```
Haken-Kreis und Ring kommen aus `checkCircle(kind, 22)` und `ringOpen(22)` (`ui.js`), Pills aus `pill(tone, text)`.

### 10.0 Seitenaufbau

```html
<!-- #main: erstes Kind ist der Seitenkopf (scrollt mit), danach genau ein .sd-main -->
<header class="sd-pagehead" data-region="pagehead">
  <div class="sd-weekhead">…Kopf 10.1…</div>        <!-- direktes Kind von .sd-pagehead, sonst greift das Seitenpolster nicht -->
</header>
<div class="sd-main sd-main--tight">
  <!-- optional: Fehlerkarte aus 3.10 (role="alert"), wenn Daten nicht geladen werden konnten -->
  <section class="sd-card sd-sums" data-card="week-sums" aria-labelledby="weekSumsTitle">…10.2…</section>
  <section class="sd-card sd-card--list sd-days" data-card="days" role="list" aria-labelledby="weekDaysTitle">…10.3…</section>
  <!-- nur im letzten Plan-Wochen-Zustand "Plan beendet": -->
  <p class="sd-hint sd-hint--center">Plan beendet. Zeigt Woche 35.</p>
</div>
```
Innerhalb von `section.sd-days` steht vor den Zeilen `<h2 class="sd-vh" id="weekDaysTitle">Tage dieser Woche</h2>`, in `sd-sums` entsprechend `<h2 class="sd-vh" id="weekSumsTitle">Wochensumme</h2>`
(absolut positioniert, erzeugt keinen Abstand). Die Tageskarte ist `role="list"`, jede Zeile (auch der Ruhetag) trägt `role="listitem"`.
**Platzhalterwoche:** `sd-sums` und `sd-days` entfallen, stattdessen die Karte aus 10.6.

### 10.1 Kopf

Aktuelle Woche, mittendrin:
```html
<div class="sd-weekhead">
  <div class="sd-weekhead__titles">
    <p class="sd-intro__sub">19.–25. Oktober · Entlastung</p>
    <h1 class="sd-display">Woche 8</h1>
  </div>
  <div class="sd-weeknav" role="group" aria-label="Woche wechseln">
    <button type="button" class="sd-roundbtn" data-action="week-prev" aria-label="Vorherige Woche">${I_CHEV_L20}</button>
    <button type="button" class="sd-roundbtn" data-action="week-next" aria-label="Nächste Woche">${I_CHEV_R20}</button>
  </div>
</div>
```
| Zustand | Unterschied |
| --- | --- |
| Andere als die aktuelle Woche | als letztes Kind von `.sd-weekhead` zusätzlich `<div class="sd-weekhead__today"><button type="button" class="sd-pillbtn" data-action="week-today">Zu heute</button></div>`. In der aktuellen Woche **fehlt** das ganze `div` (kein verstecktes Element). |
| Erste Woche | `data-action="week-prev"` bekommt das Attribut `disabled` (Deckkraft .35 kommt aus der Klasse). |
| Letzte Woche | `data-action="week-next"` bekommt `disabled`. |
| Nur eine Woche im Plan | beide `disabled`. |
| Wochentyp unbekannt | `sd-intro__sub` zeigt nur den Zeitraum. |
- Zeitraum: gleicher Monat `19.–25. Oktober`, über den Monatswechsel `28. Oktober–3. November` (Halbgeviertstrich, ohne Leerzeichen). Beides ein Text durch `esc()`, der Wochentyp ebenfalls.
- `disabled` statt `aria-disabled`: `tests/app.test.mjs` prüft `isDisabled()`. Nach jedem Blättern rendert `render()` den Kopf neu und der Fokus ginge verloren; der Coder setzt ihn auf den gleichen `data-action` zurück (oder, wenn der gerade `disabled` wurde, auf den anderen Pfeil).
- Die Tasten stehen oben rechts und springen nicht, wenn „Zu heute“ erscheint. Unter ca. 310 px Kopfbreite rutschen sie unter den Titel, sie verschwinden nie.

### 10.2 Summen-Karte

```html
<section class="sd-card sd-sums" data-card="week-sums" aria-labelledby="weekSumsTitle">
  <h2 class="sd-vh" id="weekSumsTitle">Wochensumme</h2>
  <div class="sd-sum" data-sum="lauf">
    <p class="sd-sum__label">Laufvolumen</p>
    <p class="sd-sum__value sd-mono">8,2 / 30<span class="sd-unit">km</span></p>
    <progress class="sd-prog sd-prog--coral" value="8.2" max="30" aria-label="Laufvolumen in Kilometern"></progress>
  </div>
  <div class="sd-sum" data-sum="kraft">
    <p class="sd-sum__label">Kraft</p>
    <p class="sd-sum__value sd-mono">1 / 2<span class="sd-unit">Einheiten</span></p>
    <progress class="sd-prog" value="1" max="2" aria-label="Krafteinheiten"></progress>
  </div>
</section>
```
| Fall | Markup |
| --- | --- |
| Kein Ist (Strava aus, nicht verbunden oder lädt noch) | Wert nur das Soll: `30<span class="sd-unit">km</span><span class="sd-vh">geplant</span>`, `value="0"`. Keine Platzhalterbalken; wenn Strava nachlädt, rendert die Woche neu. |
| Soll-km unbekannt oder 0 | der ganze `.sd-sum[data-sum=lauf]` entfällt, die Kraft-Summe steht allein (eine Spalte) |
| `kraftPlanned` 0 | `.sd-sum[data-sum=kraft]` entfällt |
| Optionale Kraft | zählt nicht in `kraftPlanned` (bleibt Regel aus M2-7: „0/1 Einheiten“) |
- Zahlen: Text mit `formatKm1()` (Komma), Attribute mit `numAttr()` (Punkt, siehe 9.0). `max` muss größer 0 sein.
- Zwei Spalten ab 360 px Spaltenbreite, darunter untereinander (kein Abschneiden bei 320 px). Der Wert wird fluid kleiner (19 bis 22 px) und die Einheit bricht notfalls unter die Zahl.

### 10.3 Tageszeile (alle Zustände)

Gerüst, eine Zeile = `.sd-day`, Kinder: `button.sd-day__row` plus `div.sd-day__detail`. Ruhetag ohne Button (10.4).
```html
<div class="sd-day" role="listitem" data-date="2026-10-19">
  <button type="button" class="sd-day__row" data-action="toggle-day-detail" aria-expanded="false" aria-controls="dayDetail-2026-10-19">
    <span class="sd-day__when">
      <span class="sd-day__dow"><span aria-hidden="true">Mo</span><span class="sd-vh">Montag</span></span>
      <span class="sd-day__date sd-mono">19.</span>
    </span>
    <span class="sd-stripe sd-stripe--lauf"></span>
    <span class="sd-day__main">
      <span class="sd-day__title">Easy run · 8 km</span>
      <span class="sd-day__sub">Ist: 8,2 km · 6:22 /km</span>
    </span>
    <span class="sd-day__status">…Status 10.5…</span>
  </button>
  <div class="sd-day__detail" id="dayDetail-2026-10-19" hidden>
    <p>Ziel: 8 km · 6:15–6:40 /km · HF 148–160</p>
    <p>Ist: 8,2 km · 6:22 /km · Ø 163 bpm</p>
    <p class="is-warn">Ø HF über der Zone (höchstens 160 bpm).</p>
    <button type="button" class="sd-btn" data-action="open-day" data-date="2026-10-19">Tag öffnen${I_CHEV_R}</button>
  </div>
</div>
```
Zeilenteile:
| Teil | Regel |
| --- | --- |
| Streifen | `sd-stripe--kraft` (Kraft), `sd-stripe--lauf` (Easy, Recovery, Schwelle, Intervalle, Kalibrierungstest), `sd-stripe--long` (Long Run, `LONG_RUN_TYPES`), ohne Zusatz (Ruhe). Klasse aus fester Map, nie aus Daten. |
| Titel | `esc(session.type)` + ` · ` + `esc(session.dist)` bzw. `esc(session.label)` bei Kraft. Bricht um (`overflow-wrap: anywhere`), keine Auslassungspunkte. |
| Sub-Zeile | Lauf offen `Ziel: …`, Lauf mit Strava `Ist: 8,2 km · 6:22 /km`, Kraft mit Fortschritt `2/8 erfasst`, ohne `Ziel: …` bzw. `8 Übungen`. Optionale Einheit: `Optional`. **Entlastungswoche (Deload): jede Kraftzeile bekommt ` · Deload` hinten an die Sub-Zeile** (so im abgenommenen Mockup W1, keine zweite Pill, weil die Statusspalte nur Platz für eine hat). Alles durch `esc()`. |
| Wochentag | `<span aria-hidden="true">Mo</span><span class="sd-vh">Montag</span>`; in der Heute-Zeile `Donnerstag, heute` im `.sd-vh`. Das Datum `19.` bleibt sichtbar. |
| Tönung | Heute-Zeile: `sd-day is-today` (Hintergrund `--teal-tint`, Kürzel in `--teal-fg`). Keine Tönung für verpasst/erledigt, das trägt die Statusspalte. |
| Detailzeilen | je ein `<p>`: `Ziel: …`, `Ist: …`, bei Kraft `Übungen: A, B, C`, Hinweise zusätzlich mit `class="is-warn"` (amber, z. B. HF über Zone, Kalibrierungstest „Ø Pace und Ø HF der 30 min notieren“, optional „zählt weder im Wochensoll noch als verpasst“) oder `class="is-danger"` (selten, Fehler). Texte durch `esc()`. |
| „Tag öffnen“ | immer als letztes Kind der Details, Sekundärbutton `sd-btn` mit Chevron (Chevron-Regel: öffnet einen neuen Screen). Der Button heißt überall „Tag öffnen“. |

Statusspalte `.sd-day__status` (immer genau eine Variante, Rangfolge siehe unten). Das Wort für Screenreader steht bei Symbolen im `.sd-vh`, Pills tragen es selbst:
| Zustand | Inhalt von `.sd-day__status` |
| --- | --- |
| Zukunft, offen | `${ringOpen(22)}<span class="sd-vh">offen</span>` |
| erledigt | `${checkCircle(kind, 22)}<span class="sd-vh">erledigt</span>`, `kind` = `kraft`, `lauf` oder `long` |
| erledigt, Ø HF über Grenze | `${pill("amber", "HF zu hoch")}` (ersetzt Haken **und** das alte Warn-Dreieck) |
| zu kurz (Lauf unter Soll) | `${pill("amber", "zu kurz")}` |
| nachgeholt (Lauf an anderem Tag) | `${pill("amber", "nachgeholt")}` |
| teilweise (vergangen) | `${pill("amber", `${done}/${total}`)}` |
| heute, offen | `${pill("primary", "Heute")}` |
| heute, teilweise | `${pill("primary", `Heute · ${done}/${total}`)}` (eine einzige Pill) |
| heute, erledigt | wie erledigt (Haken-Kreis), Zeile bleibt `is-today` |
| verpasst | `${pill("danger", "verpasst")}` |
| optionale Einheit, nicht gemacht (vergangen) | `${pill("optional", "optional")}` |
| optionale Einheit, offen (heute oder Zukunft) | wie offen bzw. heute |

**Rangfolge** (erste zutreffende Zeile gewinnt): verpasst, HF zu hoch, zu kurz, nachgeholt, teilweise, erledigt, heute (offen oder teilweise), optional nicht gemacht, Zukunft. Anforderungen 4.8 legen nur HF zu hoch vor teilweise vor Heute fest; die Stellung von „zu kurz“ und „nachgeholt“ ist eine Empfehlung des Designers (beide sind Erledigt-Varianten und stehen darum vor dem Haken). Alle weiteren zutreffenden Gründe stehen in den Detailzeilen, nie als zweite Pill.

Beispiel Heute teilweise:
```html
<div class="sd-day is-today" role="listitem" data-date="2026-10-22">
  <button type="button" class="sd-day__row" data-action="toggle-day-detail" aria-expanded="false" aria-controls="dayDetail-2026-10-22">
    <span class="sd-day__when">
      <span class="sd-day__dow"><span aria-hidden="true">Do</span><span class="sd-vh">Donnerstag, heute</span></span>
      <span class="sd-day__date sd-mono">22.</span>
    </span>
    <span class="sd-stripe sd-stripe--kraft"></span>
    <span class="sd-day__main"><span class="sd-day__title">Full Body B</span><span class="sd-day__sub">2/8 erfasst · Deload</span></span>
    <span class="sd-day__status"><span class="sd-pill sd-pill--primary">Heute · 2/8</span></span>
  </button>
  <div class="sd-day__detail" id="dayDetail-2026-10-22" hidden>…</div>
</div>
```

### 10.4 Ruhetag

Kein Button, kein `aria-expanded`, kein `data-action`, keine Details; nicht fokussierbar.
```html
<div class="sd-day is-rest" role="listitem">
  <div class="sd-day__row">
    <span class="sd-day__when">
      <span class="sd-day__dow"><span aria-hidden="true">Fr</span><span class="sd-vh">Freitag</span></span>
      <span class="sd-day__date sd-mono">23.</span>
    </span>
    <span class="sd-stripe"></span>
    <span class="sd-day__main"><span class="sd-day__title">Ruhe</span></span>
  </div>
</div>
```
Optional eine Sub-Zeile aus dem Plan (`<span class="sd-day__sub">Mobility, Foam Rolling</span>`, durch `esc()`). Ist heute Ruhetag: zusätzlich `is-today` und `Freitag, heute` im `.sd-vh`.

### 10.5 Aufgeklappte Zeile (Akkordeon)

Zugeklappt (Standard): `aria-expanded="false"`, `.sd-day__detail[hidden]`. Aufgeklappt:
```html
<div class="sd-day is-open" role="listitem" data-date="2026-10-19">
  <button type="button" class="sd-day__row" data-action="toggle-day-detail" aria-expanded="true" aria-controls="dayDetail-2026-10-19">…</button>
  <div class="sd-day__detail" id="dayDetail-2026-10-19">…</div>   <!-- ohne hidden -->
</div>
```
- Tipp auf `toggle-day-detail`: Zeile umschalten (`is-open`, `aria-expanded`, `hidden` am Detail-`div`). **Vorher alle anderen Zeilen schließen**: es ist immer höchstens eine offen. Zweiter Tipp auf dieselbe Zeile schließt sie.
- Der Klick auf „Tag öffnen“ (`open-day`) ist ein eigener Button im Detail, nicht in der Zeilen-Schaltfläche (keine verschachtelten Buttons).
- Kein Chevron an der Zeile (Chevron-Regel: nur Zeilen, die einen neuen Screen öffnen, tragen einen). Hinweis auf „aufklappbar“ geben `aria-expanded` und die Berührungs-/Hover-Tönung der Zeile.
- Beim Wechsel der Woche sind alle Zeilen zu. Beim Rücksprung aus dem Tag („‹ Woche“, E5/E6) darf der Coder die zuletzt geöffnete Zeile wieder öffnen; Pflicht ist es nicht.
- Fokus bleibt auf dem Zeilen-Button. Beim Öffnen scrollt nichts automatisch.

### 10.6 Woche ohne Details (Platzhalterwoche)

Kein `sd-sums`, kein `sd-days`; der Kopf (10.1) bleibt, die Pfeile funktionieren weiter.
```html
<section class="sd-card" data-card="week-placeholder">
  <h2 class="sd-card__title">Tagesdetails folgen</h2>
  <p class="sd-card__text">Nach der Re-Kalibrierung am ${esc(dd.mm.)} stehen hier die Einheiten. Geplant sind ${formatKm1(km)} km.</p>
</section>
```
Kürzungen: ohne Datum „Nach der Re-Kalibrierung stehen hier die Einheiten.“ (+ „ Geplant sind … km.“ nur wenn km bekannt); ohne beides nur der erste Satz.

### 10.7 Fehler, Laden, leer

- **Daten nicht geladen:** Fehlerkarte aus 3.10 (`data-source="firebase"`, Knopf „Neu laden“) als erstes Kind von `.sd-main`; Kopf bleibt, Summen/Tage zeigen den Planstand ohne Ist-Werte.
- **Strava lädt oder fehlt:** kein eigener Platzhalter. Summen und Zeilen zeigen die Planwerte (`Ziel: …`), sobald Läufe da sind rendert die Woche neu. Banner „Strava ist nicht verbunden“ gehört zu Heute, nicht hierher.
- **Leer:** Wochen ohne Details siehe 10.6; ein Plan ohne Wochen zeigt gar keinen Wochen-Tab-Inhalt (Heute: „Kein Plan“, E3). „Plan beendet“: Hinweiszeile unter der Liste (10.0).

### 10.8 `data-action`-Namen auf Woche

Alle Namen bleiben (Tests hängen daran), nur `toggle-day-detail` ändert sein Ziel (Attribute statt Klasse `.open`).
| Name | Wo | Parameter | Wirkung |
| --- | --- | --- | --- |
| `week-prev` | Rundtaste links | – | `state.weekNo - 1`, nicht unter 1 |
| `week-next` | Rundtaste rechts | – | `state.weekNo + 1`, nicht über `plan.totalWeeks` |
| `week-today` | Pill „Zu heute“ | – | `state.weekNo = weekNoForTab(todayISO())` |
| `toggle-day-detail` | Zeilen-Button | – (liest `aria-controls`, `closest(".sd-day")[data-date]`) | Zeile auf/zu, alle anderen zu |
| `open-day` | „Tag öffnen“ | `data-date` | öffnet Kraft- oder Lauf-Tag (Herkunft = Woche) |
Stabile Test-Haken: `[data-card="week-sums"]`, `[data-card="days"]`, `[data-card="week-placeholder"]`, `.sd-day[data-date]`, `[data-sum="lauf|kraft"]`.

### 10.9 Welche Texte durch `esc()`

Zusätzlich zu Abschnitt 6: Wochentyp, Zeitraum-Text, `session.type/dist/label`, Ziel- und Ist-Texte, alle Detailzeilen (auch Hinweise), Übungsnamen in `Übungen: …`, Planhinweis der Ruhetage, Re-Kalibrierungsdatum. **Nicht** durch `esc()`: feste Strings (Labels, „Zu heute“, „Tag öffnen“, Pill-Texte `HF zu hoch` usw.), die Icon-Konstanten, `checkCircle()` / `ringOpen()` / `pill()` (escapen selbst), `formatKm1()`-Ergebnisse, ISO-Daten in `data-date` und in der `id` `dayDetail-${iso}`, Klassen aus fester Map (`sd-stripe--${kind}`), `numAttr()`-Werte der `<progress>`.

### 10.10 Barrierefreiheit auf Woche

- Überschriften: `h1` „Woche 8“ (der Zeitraum steht als `sd-intro__sub` davor und gehört zur Überschrift visuell), `h2` nur unsichtbar (`Wochensumme`, `Tage dieser Woche`) oder sichtbar („Tagesdetails folgen“).
- Akkordeon: jede Zeile ist ein `button` mit `aria-expanded` und `aria-controls` auf das Detail-`div`; geschlossene Details sind `hidden` (aus dem Lesefluss). Ruhetage haben keinen Button.
- Status nie nur über Farbe: Haken-Kreis, Ring oder Pill mit Text plus `.sd-vh` („erledigt“, „offen“). „heute“ steht zusätzlich als Wort im Wochentag-`.sd-vh`; die Tönung allein trägt es nicht.
- Pfeiltasten haben `aria-label` („Vorherige Woche“, „Nächste Woche“), `disabled` an der Grenze. Der Wechsel wird beim neuen Rendern über den neuen `h1` „Woche 9“ erkennbar; kein `aria-live` nötig.
- Tippflächen: Zeile mindestens 64 px, Rundtasten 44 px, „Zu heute“ sichtbar 34 px mit 44 px Trefferfläche, „Tag öffnen“ 44 px.
- Fokus: globales `:focus-visible`; in der Tagesliste liegt der Ring innen, weil die Karte beschneidet.
- Bewegung: Tasten-Skalierung und Farbwechsel der Tasten sind unter `prefers-reduced-motion` aus; das Auf- und Zuklappen der Details ist ohnehin ohne Animation.
- Responsiv: bei 320 px stehen die Summen untereinander, Zeilenpolster 16, Einzug der Details 73; lange Titel und Hinweise brechen um, Pills laufen nie aus der Karte (die Statusspalte ist `flex: none`, der Titel gibt nach).

### 10.11 Durch E4 überflüssig gewordene alte Klassen (Löschliste, nach dem Umbau von `view-week.js`, `app.js` und Tests)

Erst löschen, wenn `view-week.js` die alten Funktionen nicht mehr hat und `tests/app.test.mjs` (Selektoren `.day-row`, `.day-detail`, `.week-summary`, `.partial-pill`, `.optional-pill`, `.missed-pill`, `.status-icon`) auf die neuen Hooks umgestellt ist.
- Summen: `.week-summary` samt `.line/.lbl/.val/.track/.fill`.
- Zeilen: `.day-row` (+ `.rest`, `.solid`, `.today`, `.head`, `.dcol`, `.dcol .d/.dt`, `.mid`, `.mid .n/.s`), `.day-row .day-toggle` (+ `:hover`, `:focus-visible`, `.d/.dt/.n/.s`), `.day-row .day-open`.
- Status: `.status-icon`, `.today-pill`, `.partial-pill`, `.optional-pill`, `.missed-pill`.
- Details: `.day-detail` (+ `.open`, `p`, `.muted`, `.warn-text`, `.danger-text`).
- Kopf: `.week-nav` (+ `.titles`, `p.t1`, `p.t2`, `button.icon-btn`, `button svg`), `.week-today-btn`.
- Schon heute ohne Verwender (Grep): `.day-grid`, `.day-pill`.
- **Bleiben (noch benutzt):** `.icon-btn`, `.small-btn` (Kraft-Tag, Lauf-Tag), `.fg-ok/.fg-amber/.fg-muted`, `.hint`, `.center-note`.
- Aus `view-week.js` entfallen mit E4 `statusCheckHTML`, `statusWarnHTML`, `statusFutureHTML`, `statusMissedHTML`, `statusTodayHTML`, `statusPartialHTML`, `statusOptionalHTML` als HTML-Strings mit alten Klassen; die Status-Spalte baut stattdessen `checkCircle`/`ringOpen`/`pill`. Danach sind `ICONS.warn`, `ICONS.dash`, `ICONS.check`, `ICONS.prev`, `ICONS.next`, `ICONS.chevronRight` zu prüfen (ob andere Screens sie noch nutzen).
- **Stand 21.10.2026 (Designer, E5-Durchgang):** Die oben gelisteten Klassen sind aus `style.css` gelöscht (Grep über `*.js`, `*.html`, `tests/` ohne Treffer; Treffer auf `toggle-day-detail` sind die `data-action`, nicht die Klasse), ebenso `.fg-ok`, `.fg-amber` und das Token `--soll-fill`. Geblieben: `.icon-btn`, `.small-btn`, `.fg-muted`, `.hint`, `.center-note`.

---

## 11. Screen-Ergänzungen: Kraft-Tag (E5)

Optik: Handoff §5.3 (Variante B „Fokus“), Mockup K1 bis K8 (`docs/mockup-stride-luecken.html`, abgenommen), Prototyp „Kraft-Tag B“.
CSS: Abschnitt „Kraft-Tag (E5)“ am Ende von `style.css`; die Bausteine selbst (`sd-nav`, `sd-dots`, `sd-now__*`, `sd-set*`, `sd-stepper*`, `sd-order__*`, `sd-edit__*`, `sd-tip*`) stehen im E1-Teil.
**Kein `style=` auf diesem Screen.** Alle Zahlen und Namen sind Text oder `data-*`, keine Geometrie.

Icon-Konstanten (einmal im Kraft-Modul definieren; `checkCircle("kraft", 22)` und `ringOpen(22)` kommen aus `ui.js`):
```js
const I_CHEV_L = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
// Laufender Ring (Übung ist Jetzt-Übung, noch nicht gespeichert): neuer kleiner Helfer neben ringOpen
const ringRun = (n) => `<span class="sd-ring sd-ring--${n} sd-ring--run"></span>`;
```

### 11.0 Seitenaufbau und Slots

```html
<header class="sd-pagehead" data-region="pagehead">
  <h1 class="sd-vh">${esc(session.label)}</h1>
  <nav class="sd-nav" aria-label="Kopfzeile">…11.1…</nav>
  <div class="sd-dots" role="group" aria-label="Übungen">…11.2…</div>
</header>
<div class="sd-main sd-main--tight">
  <p class="sd-vh" id="kraftLive" role="status" aria-live="polite"></p>   <!-- 11.13, immer leer gerendert -->
  <div id="banner-slot">…Ladefehler 11.9 oder nichts…</div>
  <div id="now-slot">…Alles-erfasst-Karte 11.8 (optional) + Jetzt-Karte 11.3…</div>
  <div id="order-slot">…Label-Zeile + Reihenfolge-Karte 11.6…</div>
  <div id="session-slot"></div>                                           <!-- Strava-Zeile 11.7, lädt async nach -->
  <button type="button" class="sd-btn sd-btn--text sd-btn--block" data-action="toggle-edit">Anpassen</button>
</div>
```
- Ein leerer Slot muss wirklich leer sein (`:empty` blendet ihn aus, Regel aus 9.0). `#session-slot` bleibt so lange leer, bis Strava-Daten da sind.
- Das Seitenpolster macht `#main:has(> .sd-main)`; unten bleiben die 32 px von `#app.is-detail`. Die Tab-Leiste ist auf dieser Seite aus.
- Dots stehen **im** `<header>` (nach `sd-nav`), nicht im `.sd-main`; der Kopf scrollt mit.
- Zustand `editMode` (Anpassen, 11.10) ersetzt `.sd-dots`, `now-slot`, `order-slot`, `session-slot` und den „Anpassen“-Knopf durch einen anderen Aufbau.

### 11.1 Kopfzeile

```html
<nav class="sd-nav" aria-label="Kopfzeile">
  <button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${I_CHEV_L}Heute</button>
  <span class="sd-nav__meta">5 von 8 erledigt</span>
</nav>
```
| Fall | Unterschied |
| --- | --- |
| Herkunft Heute / Woche | Label „Heute“ bzw. „Woche“ (fester String), `data-action="back"` bleibt |
| Zähler | `${done} von ${total} erledigt`; `done` = gespeicherte Übungen (`st.saved`), `total` = Übungen ohne die für heute entfernten |
| Keine Übungen | `<span class="sd-nav__meta">Keine Übungen</span>`, keine Dots |
| Anpassen-Modus | `<button type="button" class="sd-btn sd-btn--text" data-action="toggle-edit">Fertig</button>` statt `sd-nav__meta` (K2) |
| Laden | `sd-nav__meta` leer, aber im Markup (kein Sprung beim Nachladen) |

### 11.2 Fortschrittspunkte

Ein Segment pro Übung in Plan-Reihenfolge (entfernte fehlen, Ersetzungen stehen an der Stelle der ersetzten Übung, eigene am Ende).
```html
<div class="sd-dots" role="group" aria-label="Übungen">
  <button type="button" class="sd-dots__seg is-done" data-action="focus-exercise" data-slug="${esc(slug)}" aria-label="${esc(name)}, erledigt"></button>
  <button type="button" class="sd-dots__seg is-current" data-action="focus-exercise" data-slug="${esc(slug)}" aria-label="${esc(name)}, aktuelle Übung" aria-current="true"></button>
  <button type="button" class="sd-dots__seg" data-action="focus-exercise" data-slug="${esc(slug)}" aria-label="${esc(name)}, offen"></button>
</div>
```
- Farbe: `is-done` teal, `is-current` Textfarbe, sonst `--ink-off`. Ist die Jetzt-Übung schon gespeichert, trägt das Segment nur `is-current` (die Reihenfolge-Liste darunter zeigt den Haken) und `aria-label="${esc(name)}, aktuelle Übung, erledigt"`.
- Tipp = `focus-exercise` (auch auf erledigte Übungen, F6). Die Seite scrollt nicht.
- Trefferfläche 44 px hoch über `::after`; bei 8 Übungen und 320 px nur ca. 31 px breit (bekannte Ausnahme, die Liste ist die Alternative).

### 11.3 Jetzt-Karte

Immer ein `<article>`; `data-mode` ist Test-Haken: `weight` (kg × Wdh), `reps` (nur Wdh), `time` (Sekunden).
```html
<article class="sd-card sd-now" data-card="now" data-slug="${esc(slug)}" data-mode="weight" aria-labelledby="nowTitle">
  <div class="sd-card__top">
    <p class="sd-eyebrow sd-eyebrow--teal"><span class="sd-eyebrow__dot"></span>Jetzt</p>
    <span class="sd-last sd-mono">Letztes Mal 3×15 · 20 kg</span>
  </div>
  <div>
    <h2 class="sd-now__name" id="nowTitle">${esc(name)}</h2>
    <p class="sd-now__soll"><b>${esc(soll)}</b> · ${esc(hint)}</p>
  </div>
  <p class="sd-tip sd-tip--up">${esc(chip.text)}</p>
  <div class="sd-sets">…Sätze 11.4…</div>
  <button type="button" class="sd-btn sd-btn--primary sd-btn--lg" data-action="finish-set">Satz 2 fertig</button>
  <button type="button" class="sd-btn sd-btn--text sd-btn--block" data-action="finish-early">Mit 1 Satz abschließen</button>
</article>
```
| Teil | Regel |
| --- | --- |
| Eyebrow | „Jetzt“. Ist die Übung gespeichert und kein Satz aktiv (alle Sätze fertig): „Erledigt“ (`sd-eyebrow--teal`, gleicher Punkt) |
| Letztes Mal | `<span class="sd-last sd-mono">Letztes Mal ${n}×${reps}</span>`; mit Gewicht ` · ${kg} kg` (Top-Gewicht, Komma), Zeit `${n}×${sec} s`. **Ohne Historie** entfällt das ganze `<span>`, der Kopf zeigt nur die Eyebrow |
| Soll-Zeile | `<b>` = Soll (Mono 600). Ohne Hinweis nur `<p class="sd-now__soll"><b>…</b></p>` (kein Trennpunkt) |
| Chip | `<p class="sd-tip sd-tip--${level}">` mit `level` aus `progressionChip()`: `up` (teal, „Heute 62,5 kg“), `hold` (sky, „60 kg halten“), `down` (amber, „Heute 57,5 kg“), `info` (nur `sd-tip`, neutral, „Deload, 72,5 kg“). Eine Variante `sd-tip--stall` gibt es nicht (in E9 gelöscht, `progression.js` liefert kein `stall`). **Kein Chip ohne Vorschlag** (Element weglassen). Text durch `esc()` |
| Primärbutton | 11.5 |
| „Mit n Sätzen abschließen“ | 11.5; nur solange mindestens ein Satz fertig **und** noch ein Satz offen/aktiv ist |
| Speicherfehler | `<p class="sd-notice sd-notice--danger" role="alert" data-slot="save-error">Nicht gespeichert: ${esc(message)}. Der Satz bleibt offen, versuch es noch einmal.</p>` zwischen `.sd-sets` und Primärbutton. Verschwindet beim nächsten Versuch. Zusätzlich der Toast wie heute |

### 11.4 Sätze

Eine Liste `.sd-sets` mit genau einem aktiven Satz (außer die Übung ist vollständig fertig, dann keiner). Reihenfolge immer Satz 1 bis n.

**Fertig** (antippbar, öffnet den Satz wieder; kein Chevron, es öffnet keinen Screen):
```html
<button type="button" class="sd-set is-done" data-action="reopen-set" data-set="0" aria-label="Satz 1 wieder öffnen, bisher 20 kg × 15">
  <span class="sd-set__label">Satz 1</span><span class="sd-set__value sd-mono">20 kg × 15</span>${checkCircle("kraft", 22)}
</button>
```
**Offen** (nicht antippbar; Wert in `--text-secondary`, nicht `--ink-faint`):
```html
<div class="sd-set is-open"><span class="sd-set__label">Satz 3</span><span class="sd-set__value sd-mono">20 kg × 15</span><span class="sd-vh">offen</span></div>
```
**Aktiv** (Satzkopf, rechts höchstens ein Text-Button; darunter die Stepper):
```html
<div class="sd-set sd-set--active" role="group" aria-label="Satz 2">
  <div class="sd-set__head"><span class="sd-set__title">Satz 2</span></div>
  <div class="sd-steppers">…Stepper 11.4a…</div>
</div>
```
Wertformat in `sd-set__value` (Komma als Dezimaltrenner, Mono): `weight` → `62,5 kg × 6`; `reps` → `6 Wdh`; `time` → `30 s`. Nach „+ Gewicht“ (Modus bleibt `reps`, aber Gewichtswert > 0 oder Stepper sichtbar) → `0 kg × 6`.
- **Offene Sätze** zeigen den Startwert, der gelten würde (Gewicht des aktiven Satzes, Wdh laut letzter Einheit), er ändert sich mit, wenn im aktiven Satz das Gewicht geändert wird.
- **Wieder geöffneter fertiger Satz** (F6, `reopen-set`): wird zum aktiven Satz, Markup identisch zu „Aktiv“, Stepper mit den gespeicherten Werten. Der zuvor aktive Satz wird wieder „Offen“ (oder „Fertig“, wenn er schon fertig war). Es gibt keine eigene Kennzeichnung.
- **Alle Sätze fertig** (Übung gespeichert): nur „Fertig“-Zeilen, kein aktiver Satz, Eyebrow „Erledigt“.

**11.4a Stepper** (Baustein 3.6, Texte exakt so):
| Modus | Stepper |
| --- | --- |
| `weight` | zwei: `sd-stepper sd-stepper--weight` (`data-field="kg"`, Gruppe `aria-label="Gewicht in kg"`, Einheit „kg“, Schritt ±2,5) und `sd-stepper` (`data-field="reps"`, Gruppe „Wiederholungen“, Einheit „Wdh“, Schritt ±1) |
| `reps` | einer: `sd-stepper sd-stepper--solo` (`reps`, wie oben). Im Satzkopf rechts `<button type="button" class="sd-btn sd-btn--text" data-action="add-weight">+ Gewicht</button>` |
| `reps` nach „+ Gewicht“ | wie `weight`, aber Gruppe `aria-label="Zusatzgewicht in kg"`, Start 0 kg; der Satzkopf-Button entfällt |
| `time` | einer: `sd-stepper--solo` mit `data-field="sec"`, Gruppe `aria-label="Dauer in Sekunden"`, Einheit „s“, Schritt ±5; Tasten `aria-label="Sekunden verringern"` / `"Sekunden erhöhen"`, Wert `aria-label="Sekunden eintippen, aktuell 30 s"`. Kein „+ Gewicht“ |
Knopf-Labels: „Gewicht verringern“, „Gewicht erhöhen“, „Wiederholungen verringern“, „Wiederholungen erhöhen“. Untergrenze 0: der „−“-Knopf bekommt `disabled` (Deckkraft .35 aus der Basisregel). Zahl: `<span class="sd-stepper__num sd-mono" aria-live="polite">62,5</span>`.

**V1 Direkte Eingabe** (Tipp auf den Wert, `edit-value`): der `sd-stepper__val`-Button wird ersetzt durch
```html
<span class="sd-stepper__field"><input class="sd-stepper__input" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="Gewicht in kg" value="82,5"><span class="sd-stepper__unit">kg</span></span>
```
- `inputmode="decimal"` für `kg`, `inputmode="numeric"` für `reps` und `sec`; `aria-label` = Gruppenname („Wiederholungen“, „Dauer in Sekunden“). `value` ist ein geprüfter, formatierter Zahlentext (durch `esc()`, Komma). Inhalt markiert, Fokus im Feld. Schrift 24 px (also kein iOS-Zoom).
- Im Satzkopf erscheint rechts `<button type="button" class="sd-btn sd-btn--text" data-action="commit-value">Fertig</button>`. **Er ersetzt „+ Gewicht“**, solange das Feld offen ist; danach kommt „+ Gewicht“ zurück.
- Übernommen wird bei Enter, „Fertig“, Verlassen des Feldes oder Tipp auf ± (Komma parsen, ungültig = alter Wert). Es ist immer nur ein Feld offen.

### 11.5 Primärbutton und Abschließen

Genau ein Primärbutton, immer `sd-btn sd-btn--primary sd-btn--lg`:
| Zustand | Label | `data-action` | Zusatz |
| --- | --- | --- | --- |
| Satz n aktiv | `Satz ${n} fertig` (n = 1-basiert) | `finish-set` | |
| speichert (nach letztem Satz) | `Speichert …` | `finish-set` | `disabled`, `aria-busy="true"` |
| Übung fertig, es gibt eine weitere offene | `Weiter: ${esc(nextName)}` | `next-exercise` | `data-slug="${esc(nextSlug)}"` |
| Übung fertig, nichts mehr offen | `Training abschließen` | `finish-session` | geht zur Herkunft (Heute oder Woche), speichert nichts mehr |
| Übung ohne Sätze (nicht möglich) | – | – | wird nicht gerendert |
Die Beschriftung ist der ganze Weg einer Einheit: „Satz n fertig“ → „Weiter: …“ → „Training abschließen“. Lange Namen brechen im Button um (nie abgeschnitten).

**„Mit n Sätzen abschließen“** (F6):
```html
<button type="button" class="sd-btn sd-btn--text sd-btn--block" data-action="finish-early">Mit 2 Sätzen abschließen</button>
```
Text: `Mit ${n} ${n === 1 ? "Satz" : "Sätzen"} abschließen`, n = Zahl der fertigen Sätze (nur sie werden gespeichert, Auflage C1). Sichtbar ab n ≥ 1, solange noch ein Satz offen ist; sonst weglassen.

### 11.6 Reihenfolge-Liste

```html
<div class="sd-label-row"><p class="sd-label" id="orderLabel">Reihenfolge</p><p class="sd-hint">Antippen, um sie als Nächstes zu machen</p></div>
<div class="sd-card sd-card--list sd-order" data-card="order" role="group" aria-labelledby="orderLabel">
  <button type="button" class="sd-order__row is-done" data-action="focus-exercise" data-slug="${esc(slug)}">
    <span class="sd-order__pos sd-mono">1</span>${checkCircle("kraft", 22)}
    <span class="sd-order__main"><span class="sd-order__name">${esc(name)}</span><span class="sd-order__sub sd-mono">2× 6 · 60 kg</span><span class="sd-vh">erledigt</span></span>
  </button>
  …
</div>
```
| Zeile | Klassen / Status-Kreis | Untertitel |
| --- | --- | --- |
| erledigt | `is-done`, `checkCircle("kraft", 22)` | Zusammenfassung der **gespeicherten** Sätze: `2× 6 · 60 kg` (Anzahl gespeicherter Sätze, Wdh, Top-Gewicht), `2× 5 Wdh`, `2× 30 s` |
| Jetzt, nicht gespeichert | `is-current` + `aria-current="true"`, `ringRun(22)` | `läuft · Satz 2 von 3` (`.sd-vh` entfällt, der Text sagt es) |
| Jetzt, schon gespeichert (F6) | `is-current is-done`, Haken-Kreis | Zusammenfassung wie „erledigt“ |
| offen | ohne Klasse, `ringOpen(22)` | Soll als Text, z. B. `3×10/Seite`, `.sd-vh` „offen“ |
| eigene Übung | wie ihr Zustand | Untertitel mit Präfix `eigene · ` (`eigene · 3×10`), keine Pill (die Zeile ist einzeilig) |
| für heute entfernt | **nicht in der Liste** (und nicht in Dots, Zähler) | nur im Anpassen-Modus (11.10, `is-removed`) |
Name einzeilig mit Auslassungspunkten (`sd-order__name`), Untertitel ebenso. Zeile mindestens 48 px. Tipp = `focus-exercise`; die Seite scrollt nicht, der Fokus bleibt auf der getippten Zeile.

### 11.7 Strava-Zeile (F7)

Erscheint nur, wenn Strava verbunden ist und für den Tag eine Einheit mit Dauer oder Herzfrequenz existiert. Nicht antippbar, ohne Chevron.
```html
<div id="session-slot"><div class="sd-card sd-card--pad-sm" data-card="strava-session">
  <dl class="sd-kv"><dt>Einheit laut Strava</dt><dd class="sd-mono">58 min · Ø 121 bpm · max 158 bpm</dd></dl>
</div></div>
```
Teile entfallen einzeln, wenn der Wert fehlt (`58 min`, `Ø 121 bpm`, `max 158 bpm`); optional zuletzt ` · Relative Effort 42`. Nicht verbunden, Fehler oder keine Einheit: der Slot bleibt leer (kein Platzhalter, kein Hinweis; das Heute-Banner erklärt Strava). Alle Texte durch `esc()`.

### 11.8 Alles erfasst

Sind alle Übungen gespeichert, steht über der Jetzt-Karte (im `#now-slot`) eine ruhige Hinweiskarte; die Jetzt-Karte bleibt für Korrekturen bedienbar und der Primärbutton heißt „Training abschließen“.
```html
<div class="sd-card sd-card--done" data-card="all-done">
  <span class="sd-check sd-check--22"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
  <div><p class="sd-card__title">Alle 8 Übungen erfasst</p><p class="sd-card__text">Zum Korrigieren eine Übung antippen.</p></div>
</div>
```
Titel: `Alle ${n} Übungen erfasst`, bei genau einer Übung „Die Übung ist erfasst“. Zähler in der Kopfzeile `8 von 8 erledigt`, alle Dots `is-done`, außer dem aktuellen.
Die Karte ist getönt (`--teal-bg`), nicht gefüllt: die einzige gefüllte Fläche bleibt der Primärbutton.

### 11.9 Fehler, Laden, leer

**Ladefehler** (K8), im `#banner-slot`, direkt unter der Kopfzeile:
```html
<div class="sd-card sd-card--danger" role="alert" data-card="load-error" data-source="firebase">
  <p class="sd-card__title sd-card__title--danger">Gespeicherte Sätze nicht geladen</p>
  <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
  <p class="sd-card__text sd-card__text--danger">Eintragen geht trotzdem. Gespeichert wird erst, wenn das behoben ist.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button></div>
</div>
```
**Laden** (ersetzt `loadingCard`): Kopfzeile wie 11.1 (Zähler leer), im `.sd-main` nur
```html
<article class="sd-card sd-now" data-card="now" aria-busy="true" role="status">
  <div class="sd-skelstack sd-skelstack--fill">
    <span class="sd-skel sd-skel--w40"></span><span class="sd-skel sd-skel--name"></span>
    <span class="sd-skel sd-skel--set"></span><span class="sd-skel sd-skel--set"></span>
    <span class="sd-skel sd-skel--btn"></span>
    <span class="sd-vh">Gespeicherte Sätze werden geladen</span>
  </div>
</article>
```
**Leer** (Einheit ohne Übungen oder alle für heute entfernt), statt Dots, Jetzt-Karte und Liste (der „Anpassen“-Knopf unten entfällt, die Karte trägt ihn):
```html
<div class="sd-card sd-card--center" data-card="no-exercises">
  <h2 class="sd-card__title">Keine Übungen für heute</h2>
  <p class="sd-card__text">Im Anpassen-Modus lassen sich Übungen zurückholen oder hinzufügen.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--md" data-action="toggle-edit">Anpassen</button></div>
</div>
```
**Speichern** (optimistisch): Primärbutton `disabled` + „Speichert …“; bei Fehler Rücknahme (Satz wieder aktiv), Meldung `data-slot="save-error"` (11.3) und Toast.
**Entwurf wiederhergestellt** (V2): kein eigenes Element; nach dem Rendern ein Toast „Eingaben von vorhin wiederhergestellt“ (vorhandener `#toast`), nur wenn wirklich Werte aus dem Entwurf kommen.

### 11.10 Anpassen-Modus (E5b)

Eigene Ansicht statt Umbau der Jetzt-Karte (K2, K3). Kein Dots, keine Jetzt-Karte, keine Reihenfolge-Liste, keine Strava-Zeile.
```html
<header class="sd-pagehead" data-region="pagehead">
  <nav class="sd-nav" aria-label="Kopfzeile">
    <button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${I_CHEV_L}Heute</button>
    <button type="button" class="sd-btn sd-btn--text" data-action="toggle-edit">Fertig</button>
  </nav>
  <div class="sd-daytitle">
    <p class="sd-eyebrow sd-eyebrow--teal sd-eyebrow--plain">Anpassen · Di, 20.10.</p>
    <h1 class="sd-display">${esc(session.label)}</h1>
    <p class="sd-target">Änderungen gelten nur für heute.</p>
  </div>
</header>
<div class="sd-main">
  <div class="sd-card sd-card--list" data-card="edit-list">…Zeilen…</div>
  <button type="button" class="sd-btn sd-btn--dashed" data-action="quick-add">+ Übung hinzufügen</button>   <!-- oder das Formular 11.10b -->
</div>
```
Der Zähler „x von y erledigt“ entfällt hier. „Anpassen“ und „Fertig“ sind derselbe Knopf (`toggle-edit`), er behält den Namen durch den Ablauf. `+ Übung hinzufügen` gibt es **nur** hier, nicht mehr in der Normalansicht.

**Zeilen** (`sd-edit__row`, Reihenfolge wie im Plan, entfernte an ihrer Stelle):
```html
<div class="sd-edit__row" data-slug="${esc(slug)}">
  <div class="sd-edit__lead">${checkCircle("kraft", 22)}<div class="sd-edit__main"><p class="sd-edit__name">${esc(name)}</p><p class="sd-edit__sub sd-mono">2× 6 · 60 kg</p></div></div>
  <div class="sd-edit__actions">
    <button type="button" class="sd-btn" data-action="replace-exercise" data-slug="${esc(slug)}" aria-label="Ersetzen: ${esc(name)}">Ersetzen</button>
    <button type="button" class="sd-btn sd-btn--danger" data-action="remove-exercise" data-slug="${esc(slug)}" aria-label="Entfernen: ${esc(name)}">Entfernen</button>
  </div>
</div>
```
| Zeile | Unterschied |
| --- | --- |
| gespeichert | `checkCircle("kraft", 22)`, Sub = Zusammenfassung wie 11.6 |
| offen | `ringOpen(22)`, Sub = Soll |
| eigene Übung | im Namen `<span class="sd-pill sd-pill--purple">eigene</span>` nach dem Namen |
| für heute entfernt | `sd-edit__row is-removed`, `ringOpen(22)`, Sub „Für heute entfernt“ (kein Mono), nur ein Knopf: `<button type="button" class="sd-btn" data-action="restore-exercise" data-slug="…" aria-label="Zurückholen: ${esc(name)}">Zurückholen</button>` |
| Ersetzen offen | `<div class="sd-edit__row" data-replace="${esc(slug)}">`: die Knopfgruppe ist durch das Formular (unten) ersetzt, die anderen Zeilen bleiben unverändert |
Schmale Spalte (unter ca. 340 px): die Knöpfe rutschen unter den Namen und teilen sich die Breite (CSS-Container-Query, kein Zutun).

**Ersetzen-Formular** (in der Zeile, K3 links):
```html
<form class="sd-edit__form" data-form="replace">
  <p class="sd-hint">Ersetzt ${esc(name)} an dieser Stelle.</p>
  <label class="sd-field"><span class="sd-field__label">Neue Übung</span><input class="sd-input" type="text" id="rep-ex-name" name="name" autocomplete="off"></label>
  <label class="sd-field"><span class="sd-field__label">Soll</span><input class="sd-input" type="text" id="rep-ex-soll" name="soll" value="${esc(soll)}" autocomplete="off"></label>
  <p class="sd-notice sd-notice--danger" role="alert" data-slot="form-error">Bitte einen Namen eingeben.</p>   <!-- nur bei Fehler -->
  <div class="sd-actions">
    <button type="submit" class="sd-btn sd-btn--primary sd-btn--grow" data-action="confirm-replace" data-slug="${esc(slug)}">Übernehmen</button>
    <button type="button" class="sd-btn sd-btn--text" data-action="cancel-replace">Abbrechen</button>
  </div>
</form>
```
**11.10b Hinzufügen-Formular** (ersetzt den gestrichelten Knopf, K3 rechts):
```html
<form class="sd-card" data-form="add-exercise">
  <div><h2 class="sd-card__title">Übung hinzufügen</h2><p class="sd-hint">Gilt nur für diesen Tag (20.10.).</p></div>
  <label class="sd-field"><span class="sd-field__label">Name</span><input class="sd-input" type="text" id="new-ex-name" name="name" placeholder="z. B. Beinpresse" autocomplete="off"></label>
  <label class="sd-field"><span class="sd-field__label">Soll</span><input class="sd-input" type="text" id="new-ex-soll" name="soll" placeholder="z. B. 3x8-10" autocomplete="off"></label>
  <p class="sd-notice sd-notice--danger" role="alert" data-slot="form-error">Bitte einen Namen eingeben.</p>   <!-- nur bei Fehler -->
  <div class="sd-actions">
    <button type="submit" class="sd-btn sd-btn--primary sd-btn--grow" data-action="add-exercise">Hinzufügen</button>
    <button type="button" class="sd-btn sd-btn--text" data-action="cancel-add">Abbrechen</button>
  </div>
</form>
```
- `id` (`rep-ex-*`, `new-ex-*`) bleiben, weil bestehende Tests und Handler sie nutzen; `name` kommt dazu. Felder 48 px hoch, 16 px Schrift.
- Aus dem Platzhalter „Name, z. B. Beinpresse“ wird das Label „Name“ plus Platzhalter „z. B. Beinpresse“ (Platzhalter ersetzt kein Label).
- Fokus: beim Öffnen auf das erste Feld, beim Abbrechen oder Übernehmen zurück auf den auslösenden Knopf (bei Übernehmen auf die Zeile bzw. den „Hinzufügen“-Knopf der neuen Ansicht).
- Ein Klick auf `data-action` **und** das `submit`-Ereignis (Enter im Feld) führen zur selben Funktion; der Coder verhindert die Doppelauslösung (`preventDefault` im Submit).

### 11.11 `data-action`-Namen auf dem Kraft-Tag

Unverändert (Tests hängen daran): `back`, `reload`, `toggle-edit`, `quick-add`, `add-exercise`, `cancel-add`, `replace-exercise`, `confirm-replace`, `cancel-replace`, `remove-exercise`, `restore-exercise`.
Neu (Abschnitt 5, hier mit Stelle): 
| Name | Wo | Parameter | Wirkung |
| --- | --- | --- | --- |
| `focus-exercise` | Dots, Reihenfolge-Zeilen | `data-slug` | Jetzt-Übung wechseln (auch erledigte) |
| `step` | ±-Knöpfe | `data-field` (`kg|reps|sec`), `data-dir` (`-1|1`) | Wert ± Schritt (kg 2,5, Wdh 1, s 5); Gewicht wirkt auf die folgenden Sätze, Wdh/s nur auf den Satz |
| `edit-value` | Stepper-Wert | `data-field` | Feld öffnen (V1) |
| `commit-value` | „Fertig“ im Satzkopf | – | Feld übernehmen |
| `add-weight` | „+ Gewicht“ im Satzkopf | – | Gewichts-Stepper einblenden (Start 0) |
| `finish-set` | Primärbutton | – | „Satz n fertig“; nach dem letzten Satz Speichern |
| `finish-early` | Text-Button | – | „Mit n Sätzen abschließen“ |
| `reopen-set` | fertiger Satz | `data-set` (0-basiert) | Satz wieder aktiv |
| `next-exercise` | Primärbutton, wenn Übung fertig | `data-slug` der nächsten offenen | „Weiter: …“ |
| `finish-session` | Primärbutton, wenn alles fertig | – | „Training abschließen“ → zurück zur Herkunft |
Entfallen: `toggle-sets` („Sätze einzeln / Alle gleich“, jeder Satz ist jetzt einzeln), `save` (kein Speichern-Knopf mehr, gespeichert wird mit dem letzten Satz bzw. „Mit n Sätzen abschließen“).
Stabile Test-Haken: `[data-card="now"][data-slug][data-mode]`, `[data-card="order"]`, `[data-card="all-done"]`, `[data-card="load-error"]`, `[data-card="strava-session"]`, `[data-card="no-exercises"]`, `[data-form="replace"]`, `[data-form="add-exercise"]`, `[data-slot="save-error"]`, `.sd-set.is-done|.is-open|.sd-set--active`, `.sd-order__row.is-current`.

### 11.12 Welche Texte durch `esc()`

Zusätzlich zu Abschnitt 6: Übungsname **auch in `aria-label`** (Dots, Ersetzen, Entfernen, Zurückholen), `soll`, `hint`, Chip-Text, Name der nächsten Übung im Primärbutton, `data-slug`, Ladefehler- und Speicherfehlertext, `value` der Formulare und des Stepper-Feldes, Strava-Texte, Datumstexte der Anpassen-Überschrift. **Nicht**: feste Strings („Satz n fertig“, „Jetzt“, „Anpassen“ …), Icon-Konstanten, `checkCircle`/`ringOpen`/`ringRun` (feste Klassen), bereits formatierte Zahlen aus den Helfern (`62,5`), `data-field`/`data-dir`-Werte aus fester Liste. Werte aus dem Entwurf (V2) erscheinen nur als geprüfte Zahlen.

### 11.13 Barrierefreiheit, Fokus, Responsive

- **Live-Region:** `<p class="sd-vh" id="kraftLive" role="status" aria-live="polite">` bleibt leer gerendert; nach einer Aktion setzt der Coder den Text **nach** dem Einfügen (z. B. im nächsten Frame), sonst liest ein neu eingefügter Knoten nichts vor. Texte: nach `finish-set` „Satz 2 fertig. Als Nächstes Satz 3.“, nach dem Speichern „Squats gespeichert. Als Nächstes Deadlift.“ bzw. „Alle Übungen erfasst.“, nach `focus-exercise` „Jetzt: Deadlift.“ Rendert der Coder bei jedem Schritt `#main` ganz neu, muss `#kraftLive` außerhalb der neu geschriebenen Knoten liegen (oder der Text kommt über den vorhandenen Toast).
- **Fokus nach dem Neu-Rendern:** nach `finish-set`, `next-exercise`, `finish-early` auf den neuen Primärbutton; nach `focus-exercise` auf den getippten Dot bzw. die getippte Zeile (gleicher `data-slug`); nach `reopen-set` auf den ersten Stepper-Knopf des Satzes; nach `edit-value` ins Feld, nach `commit-value` auf den Wert-Button; nach `add-weight` auf den neuen Gewichts-Wert. Fokus nie auf `body` fallen lassen.
- Stepper: jede Taste `aria-label`, Wert `aria-live="polite"`. Status nie nur über Farbe: Haken-Kreis, Ring, Text („läuft · Satz 2 von 3“, `.sd-vh` „erledigt“ / „offen“). Dots tragen den Status im `aria-label`.
- Tippflächen: Stepper-Tasten 44 × 44, Wert 44 hoch, Primärbutton 54, Text-Buttons 44, Satzzeilen mindestens 44, Reihenfolge-Zeilen 48, Dots 44 hoch (Breite bei 8 Übungen und 320 px ca. 31 px, bekannte Ausnahme).
- 320 px: die beiden Stepper stehen untereinander, jeder über die volle Breite; Kopf (`sd-card__top`) umbricht; „Letztes Mal …“ rutscht unter „Jetzt“; Anpassen-Zeilen: Knöpfe unter dem Namen. Bei 1280 px bleibt die 480-px-Spalte zentriert.
- `prefers-reduced-motion`: Tasten-Skalierung und Hover-Übergänge aus (bestehende Regel am Dateiende deckt `.sd-btn`, `.sd-stepper__btn`).

### 11.14 Durch E5 überflüssig werdende alte Klassen (Löschliste, **nicht** vorab löschen)

Erst löschen, wenn `view-kraft.js` die alten Funktionen (`exerciseCard`, `simpleRowHTML`, `perSetRowsHTML`, `saveButtonHTML`, `toggleSets`, `readCard`, `fillSessionSlot` alt) nicht mehr hat und `tests/app.test.mjs` auf die neuen Haken umgestellt ist. Vorher je Klasse greppen (`*.js`, `*.html`, `tests/`).
- Karten: `.card.summary-card` (+ `.name`, `.hint`), `.card.done` (+ `p.hint`), `.card.removed`, `.card.current`, `.card.session-card` (+ `.name`, `.hint`, `.metric-label`, `.metric-value`).
- Eingabe: `input[type="number"]` (Regel), `.set-row` (+ `.set-label`), `.times`, `.ex-body`, `.hint.tiny`, `.status` (+ `:empty`, `.ok`, `.warn`).
- Speichern: `.save-btn` (+ `svg`, `.wide`, `.is-saved`, `:disabled`, `.icon-btn.save-btn`), `.primary-btn` **nicht** (Lauf-Tag und Verlauf nutzen sie noch).
- Anpassen: `.add-inline`, `.add-form` (+ `input[type="text"]`), `.edit-actions`, `.custom-tag`, `.danger-btn` **nicht** (`view-account.js` nutzt es für „Abmelden“).
- Progression: `.tip`, `.tip-up`, `.tip-hold`, `.tip-down`, `.tip-info` (ersetzt durch `.sd-tip--*`).
- Nach E5 prüfen: `.done-dot`, `.strava-note` (E6), `.link-btn` (E6), `.small-btn` (E6), `.seg`, die Utilities `.jc-between`, `.ai-start`, `.gap-10`, `.gap-8`, `.flex-1`, `.min-w-0`, `.mt-6`, `.mt-8`, `.mb-8`, `.w-full`, `.w-70`, `.fs-11`, `.fg-secondary` (je einzeln greppen, mehrere werden erst nach E6 frei).
- Aus `app.js` entfallen mit E5: `data-action="toggle-sets"`, `data-action="save"`, Ids `session-slot` (bleibt, aber mit neuem Inhalt), `progress-line`, `data-ex`, `data-status`, `data-kg`, `data-reps`.

### 11.15 Löschen (Kraft-Einträge)

Grundlage: `docs/requirements-delete-day.md`, `docs/plan-delete-day.md`, Auflagen D6/D7 in `docs/review-architecture-delete-day.md`. CSS: Abschnitt „Löschen von Kraft-Einträgen“ am Ende von `style.css`. Kein `style=`. Rot (`--danger-*`) nur hier und nur fürs Zerstörerische, Koralle nie, **keine zusätzliche Teal-Fläche**: Auf der Karte bleibt der Primärbutton die einzige, im Sheet ist „Löschen“ die Hauptaktion in Rot und „Abbrechen“ sekundär (grau).

**Neue Klassen:** `sd-btn--textdanger`, `sd-dangerzone`, `sd-confirm`, `sd-confirm__subject`, `sd-confirm__sub`, `sd-confirm__text`, `sd-confirm__list`, `sd-confirm__tag`, `sd-sheet__actions`. Wiederverwendet: `sd-btn`, `sd-btn--danger`, `sd-btn--md`, `sd-btn--block`, `sd-btn--grow`, `sd-hint--center`.

**1. Knopf B „Eintrag löschen“ (Jetzt-Karte)**

Bedingung: `vm.saved` (also auch beim Korrigieren und bei vorzeitig abgeschlossenen Übungen). Stelle: **letztes Kind der `.sd-now`-Karte, unter dem Primärbutton**. Begründung: Im Zustand „gespeichert“ ist der Primärbutton „Weiter: …“ bzw. „Training abschließen“, „Mit n Sätzen abschließen“ gibt es dann nur beim Korrigieren. Der Löschknopf steht daher am Ende des Daumenwegs, nie zwischen Primärbutton und der Alternative, und sieht durch Textform (kein Fond) neben dem 54-px-Primärbutton klein aus. Er teilt die Reihe nicht mit dem Primärbutton (keine Verwechslung beim Weitertippen) und steht auch nach „Mit n Sätzen abschließen“, falls beide sichtbar sind.
```html
<button type="button" class="sd-btn sd-btn--textdanger sd-btn--block" data-action="open-delete-entry" data-slug="${esc(slug)}">Eintrag löschen</button>
```
Deaktiviert (D7, solange die Übung `saving` ist oder ein Löschen früh läuft): zusätzlich `disabled`, Aussehen über die Basisregel (Deckkraft 0,4, kein Hover). Kein eigener Text.
`aria-label` entfällt, die Karte hat `aria-labelledby="nowTitle"`; der Sheet-Titel nennt die Übung.

**2. Knopf A „Einträge dieses Tages löschen“ (Anpassen-Modus)**

Bedingung: `!kraftLoadError` und mindestens ein Schlüssel in `kraftSaved` (auch nur verwaiste). Stelle: **letztes Kind von `.sd-main`, unter „+ Übung hinzufügen“** (bzw. unter dem Hinzufügen-Formular), abgesetzt durch `margin-top` 12 px zusätzlich zum Spaltenabstand. Der Hinweis steht unter dem Knopf und ist per `aria-describedby` verknüpft.
```html
<div class="sd-dangerzone" data-slot="delete-day">
  <button type="button" class="sd-btn sd-btn--danger sd-btn--md sd-btn--block" data-action="open-delete-day" aria-describedby="deleteDayHint">Einträge dieses Tages löschen</button>
  <p class="sd-hint sd-hint--center" id="deleteDayHint">Löscht die erfassten Sätze dieses Tages. Die Übungsliste bleibt.</p>
</div>
```
Deaktiviert (D7, sobald irgendeine Übung `saving` ist): nur dem Knopf `disabled` geben, der Hinweis bleibt. Lange Beschriftung bricht um (kein Abschneiden); Höhe mindestens 48 px.

**3. Bestätigungs-Sheet `#confirmSheet` (statisch in `index.html`, Geschwister von `#assignSheet`)**

`createSheet("confirmSheet", "confirmBackdrop")`. Gerüst fest:
```html
<div id="confirmBackdrop" class="sd-backdrop" data-action="close-sheet" hidden></div>
<div id="confirmSheet" class="sd-sheet" role="dialog" aria-modal="true" aria-labelledby="confirmSheetTitle" aria-describedby="confirmSheetBody" hidden>
  <div class="sd-sheet__grip"></div>
  <div class="sd-sheet__head">
    <h2 class="sd-sheet__title" id="confirmSheetTitle" tabindex="-1"></h2>
    <button type="button" id="confirmSheetClose" class="sd-sheet__close" data-action="close-sheet" aria-label="Schließen">${closeIcon}</button>
  </div>
  <div id="confirmSheetBody"></div>
  <div class="sd-sheet__actions">
    <button type="button" id="confirmSheetCancel" class="sd-btn sd-btn--md sd-btn--grow" data-action="close-sheet">Abbrechen</button>
    <button type="button" id="confirmSheetDelete" class="sd-btn sd-btn--md sd-btn--danger sd-btn--grow" data-action="confirm-delete">Löschen</button>
  </div>
</div>
```
Der Coder setzt `#confirmSheetTitle.textContent` und `#confirmSheetBody.innerHTML`. Die Knöpfe sind **fest und für A und B gleich**; beim Öffnen setzt der Coder sie zurück (`disabled` weg, `aria-busy` weg, Label „Löschen“). Beide Knöpfe teilen die Zeile (je mindestens 140 px, darunter brechen sie untereinander: Abbrechen oben, Löschen unten; bei 320 px = 280 px Sheet-Innenbreite stehen sie untereinander). Die Knopfzeile klebt (`position: sticky; bottom: 0`) am unteren Sheet-Rand und bleibt ab 320×568 ohne Scrollen sichtbar; die Liste ist auf `clamp(5rem, 24dvh, 11.5rem)` begrenzt und scrollt intern.

**Body für B (eine Übung)**: Titel `Eintrag löschen?`
```html
<div class="sd-confirm">
  <div>
    <p class="sd-confirm__subject">${esc(name)} am ${esc(dateShort)}</p>
    <p class="sd-confirm__sub sd-mono">${esc(summary)}</p>   <!-- optional, z. B. „3× 6 · 60 kg“; ohne Zusammenfassung weglassen -->
  </div>
  <p class="sd-confirm__text">Die erfassten Sätze werden gelöscht. Das lässt sich nicht rückgängig machen.</p>
</div>
```
`dateShort` wie `shortDate`, z. B. „Di, 08.09.“ (Beispiel: „Squats am Di, 08.09.“).

**Body für A (ganzer Tag)**: Titel `Einträge dieses Tages löschen?`
```html
<div class="sd-confirm">
  <div>
    <p class="sd-confirm__subject">${esc(countText)} am ${esc(dateShort)}</p>   <!-- „3 Einträge am Mo, 19.10.“ / „1 Eintrag am …“ -->
    <p class="sd-confirm__sub">davon 1 einer entfernten Übung</p>              <!-- nur bei verwaisten Einträgen -->
  </div>
  <ul class="sd-confirm__list" role="list" tabindex="0" aria-label="Betroffene Übungen">
    <li>${esc(name)}</li>
    <li>${esc(name)} <span class="sd-confirm__tag">(entfernt)</span></li>      <!-- verwaister Eintrag -->
  </ul>
  <p class="sd-confirm__text">Die erfassten Sätze werden gelöscht. Das lässt sich nicht rückgängig machen. Die Übungsliste des Tages bleibt.</p>
</div>
```
Reihenfolge der Liste: sichtbare Übungen in Planreihenfolge, danach verwaiste („(entfernt)“). Die Liste hat eine Höhengrenze (11,5 rem) und scrollt dann selbst, damit die Knöpfe sichtbar bleiben; `tabindex="0"` plus `aria-label` macht den Scrollbereich per Tastatur erreichbar.

**C. Beschäftigt („Löscht …“)** (Auflage D7, optimistisches Fenster)
```html
<button type="button" id="confirmSheetDelete" class="sd-btn sd-btn--md sd-btn--danger sd-btn--grow" data-action="confirm-delete" disabled aria-busy="true">Löscht …</button>
<button type="button" id="confirmSheetCancel" class="sd-btn sd-btn--md sd-btn--grow" data-action="close-sheet" disabled>Abbrechen</button>
```
Beide deaktiviert: „Abbrechen“ würde sonst etwas versprechen, was nicht mehr geht (Auflage D2: das Löschen läuft weiter). Deckkraft bei `aria-busy` 0,6 statt 0,4, damit „Löscht …“ lesbar bleibt. **Vor dem Deaktivieren den Fokus auf `#confirmSheetTitle` setzen**, sonst fällt er auf `body`. ×, Escape und Backdrop bleiben aktiv und brechen nichts ab. Eine Animation gibt es nicht (nur das „…“), also nichts für `prefers-reduced-motion`.

**4. `data-action`-Namen**

| Name | Wo | Parameter | Wirkung |
| --- | --- | --- | --- |
| `open-delete-entry` | „Eintrag löschen“ (Jetzt-Karte) | `data-slug` | Sheet B öffnen |
| `open-delete-day` | „Einträge dieses Tages löschen“ (Anpassen-Modus) | – | Sheet A öffnen |
| `confirm-delete` | „Löschen“ im Sheet | – | Operation aus `pendingDelete` ausführen (Auflage D2) |
| `close-sheet` | ×, Backdrop, „Abbrechen“ | – | bestehend |
Stabile Test-Haken: `#confirmSheet`, `#confirmSheetTitle`, `#confirmSheetBody`, `#confirmSheetDelete`, `#confirmSheetCancel`, `[data-slot="delete-day"]`, `.sd-confirm__list li`, `.sd-confirm__tag`.

**5. `esc()`** (Auflage D6): Übungsname (Subjekt, Liste, Eintragsname), `dateShort`, `countText`, Zusammenfassung, `data-slug`. Fest und ohne `esc()`: Titel, Fließtexte, „(entfernt)“, Knopfbeschriftungen. Der Body entsteht ausschließlich aus diesen `esc()`-geschützten View-Strings.

**6. Fokus**
- Öffnen: auf `#confirmSheetTitle` (macht `createSheet`). Auslöser wird als `trigger` übergeben.
- „Abbrechen“, ×, Escape, Backdrop: zurück auf den Auslöser (macht `createSheet`).
- Erfolg: zuerst `confirmSheet.close()`, danach `paintKraft(focus)`: bei B auf den Primärbutton der wieder offenen Übung (`{ kind: "primary" }`), bei A auf den ersten Knopf der ersten `.sd-edit__row`. Der Auslöser verschwindet, `liveTrigger` liefert `null`, der App-Fokus gewinnt.
- Früher Fehler: Sheet schließt, Fehler-Toast, Fokus auf den Auslöser (der noch existiert).
- Ansage über `#kraftLive` nach dem Einfügen: „Eintrag Squats gelöscht“ bzw. „Einträge gelöscht“.

**7. Responsive, hell/dunkel, Bewegung**
- 320 bis 1280 px: Sheet nutzt die bestehende Spalte (Radius 28, Grip, Titel 19/600, × 36 px mit 44-px-Trefferfläche). Namen brechen um (`overflow-wrap: anywhere`), nichts wird abgeschnitten. Knöpfe ≥ 44 px (Sheet 48, Textknopf 44, Block 48).
- Farben nur aus Tokens: Textknopf `--danger-fg` auf Karte/transparent (hell ca. 6,5:1, dunkel `#ff8a80`), Danger-Knopf `--danger-fg` auf `--danger-bg`, Listenfläche `--sunk`, „(entfernt)“ in `--text-secondary` (nicht `--text-muted`, das reicht auf `--sunk` nicht für 4,5:1). Dunkelmodus automatisch über die Tokens.
- Zustände: Hover nur mit `(hover: hover)` (`sd-btn--textdanger` bekommt `--danger-bg`), `:active` skaliert über `.sd-btn`, Fokusring global. Alles unter `prefers-reduced-motion` ohne Übergang über den bestehenden Block (`.sd-btn`, `.sd-sheet`, `.sd-backdrop`); neue Übergänge gibt es nicht.

---

## 12. Screen-Ergänzungen: Lauf-Tag (E6)

Optik: Handoff §5.4 (Variante B „Vergleich“), Mockup L1 bis L5 (abgenommen), Prototyp „Lauf-Tag B“.
CSS: Abschnitt „Lauf-Tag (E6)“ am Ende von `style.css`; die Bausteine (`sd-compare`, `sd-bigkm`, `sd-range*`, `sd-linkrow*`, `sd-planhint*`, `sd-option*`, `sd-radio`, `sd-sheet__*`) stehen im E1-Teil.
**Kein `style=` auf diesem Screen.** Distanzbalken = `<progress>`, Range-Balken = Inline-SVG mit Zahlen-Attributen (12.3).

Icon-Konstanten (einmal im Lauf-Modul; `ICONS.*` hat keine Größenklasse und ist hier tabu):
```js
const I_CHEV_L  = '<svg class="sd-icon sd-icon--20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const I_CHEV_R  = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const I_REFRESH = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.4 5.8"/><path d="M20 4v7h-7"/></svg>';
```
Geometrie-Helfer `pct(x)` (wie 9.0/Abschnitt 6): `Number.isFinite(x) ? String(Math.round(Math.min(100, Math.max(0, x)) * 10) / 10) : "0"`, Punkt als Dezimaltrenner. Nie `formatKm1()` in einem Attribut.

### 12.0 Seitenaufbau und Slots

```html
<header class="sd-pagehead" data-region="pagehead">
  <nav class="sd-nav" aria-label="Kopfzeile">…12.1…</nav>
  <div class="sd-daytitle">
    <p class="sd-eyebrow sd-eyebrow--coral sd-eyebrow--plain">Lauf · Mo, 19.10.</p>
    <h1 class="sd-display" tabindex="-1">Easy run · 8 km</h1>
    <p class="sd-target sd-mono">Ziel 6:15–6:40 /km · HF 148–160</p>   <!-- nur ohne Vergleichs-Karte, siehe 12.1 -->
  </div>
</header>
<div class="sd-main sd-main--tight">
  <div id="strava-slot">…eine der Karten aus 12.2 bis 12.9…</div>
  <div class="sd-planhint" data-card="plan-note">…12.5…</div>   <!-- nur wenn info.note -->
</div>
```
- Der Kopf ist **sofort** komplett (Plandaten sind da), nur `#strava-slot` lädt nach. `#strava-slot` behält seine Id (Tests). Er ist nie leer (Laden, Karte oder Fehler); im Slot liegen 1 bis 2 Karten untereinander (Gap 12 kommt vom Slot).
- Kein `#main` mit altem `planRunCard` mehr, kein `.strava-note` mit Läufer-Icon, kein Standard-Satz „Wird nicht hier eingetragen …“ (entfällt ersatzlos).
- `#app.is-detail` blendet die Tab-Leiste aus (wie Kraft-Tag). Kein Link zur Desktop-Analyse.

### 12.1 Kopfzeile

| Teil | Regel |
| --- | --- |
| Zurück | `<button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${I_CHEV_L}Heute</button>`, Label „Heute“ oder „Woche“ nach Herkunft (fester String). Kein `sd-nav__meta` |
| Überzeile | `Lauf · ${dayNameDE(iso)}, ${shortDate(iso)}` (Helfer-Ausgabe, kein `esc()` nötig). Farbe: Easy, Recovery, Intervalle, Schwelle: `sd-eyebrow--coral`; Long Run (`isLongRun(info)`): `sd-eyebrow--purple`. Beide ohne Punkt (`sd-eyebrow--plain`); das Wort „Lauf“ bleibt, die Farbe ist nur Zusatz. Großschrift macht das CSS |
| Titel | `<h1 class="sd-display" tabindex="-1">${esc(info.type)} · ${esc(info.dist)}</h1>`, Anzeigegröße 26 bis 30 px fluid, bricht um statt abzuschneiden. `tabindex="-1"`: Fokusziel nach Neu-Laden (12.11) |
| Ziel-Zeile | `<p class="sd-target sd-mono">Ziel ${esc(info.pace)} · HF ${esc(info.hf)}</p>` **nur in Zuständen ohne Vergleichs-Karte** (Zukunft, verpasst, ignoriert, Strava fehlt, Fehler, Laden). Mit Vergleichs-Karte steht das Ziel in der Achse der Balken. Fehlt einer der beiden Texte, entfällt sein Teil samt Trennpunkt |

### 12.2 Laden

Slot-Inhalt, bis `loadStrava()` fertig ist (ersetzt `loadingCard`):
```html
<article class="sd-card sd-compare" data-card="loading" aria-busy="true" role="status">
  <div class="sd-skelstack sd-skelstack--fill">
    <span class="sd-skel sd-skel--km"></span><span class="sd-skel sd-skel--w60"></span>
    <span class="sd-skel sd-skel--bar"></span>
    <span class="sd-skel sd-skel--w92"></span><span class="sd-skel sd-skel--w92"></span>
    <span class="sd-vh">Strava wird geprüft</span>
  </div>
</article>
```
„Neu laden“ (`reload-strava`) zeigt denselben Platzhalter im Slot, der Kopf bleibt stehen.

### 12.3 Vergleichs-Karte (Lauf zugeordnet)

```html
<article class="sd-card sd-compare" data-card="compare" data-status="ok" aria-label="Vergleich mit dem Plan">
  <div class="sd-compare__top">
    <div>
      <p class="sd-bigkm sd-mono">8,2<span class="sd-unit">km</span></p>
      <p class="sd-compare__sub">von 8 km · 52:12</p>
    </div>
    <span class="sd-pill sd-pill--ok">im Plan</span>
  </div>
  <progress class="sd-prog sd-prog--lg sd-prog--coral" value="8.2" max="8" aria-label="Distanz, 8,2 von 8 km"></progress>
  <div class="sd-range">…Pace 12.4…</div>
  <div class="sd-range">…Ø HF 12.4…</div>
</article>
```
**Distanz (variantenweise)**

| Fall | Unterschied |
| --- | --- |
| im Plan | `data-status="ok"`, Pill `sd-pill sd-pill--ok` „im Plan“ (`distanceStatus` = `imPlan`) |
| zu kurz | `data-status="short"`, Pill `sd-pill sd-pill--amber` „zu kurz“; Sub-Zeile und Balken wie oben (Balken < 100 %) |
| kein Soll-km (Platzhalter, freier Lauf) | `data-status="none"`; **keine** Pill, **kein** `<progress>`, Sub-Zeile nur `Dauer 52:12`. Rest der Karte unverändert |
| Long Run | Balken `sd-prog sd-prog--lg sd-prog--purple` statt `--coral`, sonst identisch |

- Zahl: `<p class="sd-bigkm sd-mono">` + `formatKm1()` (Komma) + `<span class="sd-unit">km</span>`. Größe `clamp(40px, 12.4cqi, 48px)`: bei 320 px 40 px, ab ca. 390 px 48 px. Die linke Spalte darf schrumpfen (`min-width: 0`), die Pill rutscht bei Platznot unter die Zahl statt sie zu quetschen.
- Sub-Zeile: `von ${esc(info.dist)} · ${esc(formatDuration(movingTimeSec))}`.
- **Distanzbalken ohne `style`:** `<progress value max>` mit `value` = Ist-km, `max` = Soll-km (Punkt als Dezimaltrenner, Helfer `numAttr` aus 9.0). Das Element klemmt selbst: Ist über Soll = voll, 0 = leer. `max` muss > 0 sein, sonst wird der Balken weggelassen (Fall „kein Soll“). `aria-label` nennt die echten Werte (auch über 100 %), `formatKm1()` im Label, `numAttr()` in `value`/`max`.

**12.3a Range-Balken ohne `style` (Auflage C5, Entscheid E6)**

Band und Marker sind **Inline-SVG; die Position steht in Zahlen-Attributen** (`x`, `width`, `x1`, `x2`). Es gibt kein `style`-Attribut und keine Custom Property. Die Zahlen kommen aus `rangeBar()` (`runcompare.js`, schon 0 bis 100, eine Nachkommastelle, geklemmt) und laufen zusätzlich durch `pct()`; im SVG sind sie reine Geometrie, nie Text aus Daten.
```html
<div class="sd-range">
  <div class="sd-range__head">
    <span class="sd-range__label">Pace</span>
    <span class="sd-range__value sd-mono is-ok"><span class="sd-ampel sd-ampel--ok" aria-hidden="true"></span>6:22 /km<span class="sd-vh">, im Zielbereich</span></span>
  </div>
  <div class="sd-range__track">
    <svg class="sd-range__band" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="35.3" y="0" width="29.4" height="6"/></svg>
    <svg class="sd-range__mark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line class="sd-range__halo" x1="43.5" y1="2" x2="43.5" y2="16"/><line class="sd-range__tick" x1="43.5" y1="2" x2="43.5" y2="16"/></svg>
  </div>
  <div class="sd-range__axis"><span>5:45</span><span>Ziel 6:15–6:40</span><span>7:10</span></div>
</div>
```
- Band: `x="${pct(from)}"`, `width="${pct(to - from)}"` (nie negativ; `from ≤ to` garantiert `rangeBar`). Marker: beide `<line>` bekommen `x1 = x2 = ${pct(at)}`. Alles andere (`y`, `height`, `viewBox`) ist fester Text.
- `preserveAspectRatio="none"` dehnt die 0 bis 100 auf die Spurbreite; Strichbreite und runde Enden des Markers bleiben durch `vector-effect: non-scaling-stroke` bei 4 px (Halo 8 px in `--card`, ergibt den 2-px-Rand). Wer die Zahlen im DOM liest, sieht Prozent der Spur.
- Beide SVG sind `aria-hidden`; der Text (Wert, Wort, Achse) trägt die Information.
- Wert: `<span class="sd-range__value sd-mono is-ok|is-warn">` mit Ampel-Form (`sd-ampel--ok` Kreis / `sd-ampel--warn` Raute) und verstecktem Wort `, im Zielbereich` bzw. `, außerhalb des Zielbereichs` (`sd-vh`). Die Form ist die Designer-Ergänzung gegenüber dem Mockup: Farbe allein trägt den Status nicht. Pace-Format `m:ss /km` (aus `paceLabel`), HF `151 bpm`.
- Achse: **immer drei `<span>`**: Skalen-Min, Mitte `Ziel …` mit dem Originaltext der Zone (durch `esc()`; `>` und `<` werden zu `&gt;`/`&lt;`), Skalen-Max. Min/Max aus `rangeScale()`, Pace als `m:ss` (ohne „/km“), HF als ganze Zahl. Die Mitte steht mittig (Grid), nicht zwischen den Rändern verteilt.

### 12.4 Die Range-Zeilen im Einzelnen

Zwei Zeilen in dieser Reihenfolge: Pace, dann Ø Herzfrequenz. Jede Zeile entscheidet für sich.

| Fall | Bedingung | Markup |
| --- | --- | --- |
| **geschlossen** | `parseTarget` = `closed` | wie 12.3a, Band `from` bis `to` |
| **offen unten** („> 6:40“) | `openMin` | Band bis 100 (`to` = 100), Achse Mitte `Ziel &gt; 6:40` |
| **offen oben** („< 148“) | `openMax` | Band ab 0 (`from` = 0), Achse Mitte `Ziel &lt; 148` |
| **Pace neutral** | `paceStatus` = `neutral` bei Ziel ≠ free (Schwelle, Intervalle, Test) | Kopf ohne `is-ok`/`is-warn`, **keine** Ampel, **keine** Spur, **keine** Achse; statt dessen `<p class="sd-range__note">Der Schnitt enthält Ein- und Auslaufen, darum ohne Zielband.</p>` im selben `.sd-range` |
| **frei** | Ziel = `free` | `<div class="sd-range sd-range--plain"><div class="sd-range__head">…Label und Wert neutral…</div></div>`, keine Ampel, keine Spur |
| **kein Messwert** | `avgHr`/Pace fehlt | Wert `–` (Halbgeviertstrich, kein Em-Dash), weder `is-ok` noch Ampel, kein Marker (`at = null`: `<svg class="sd-range__mark">` weglassen), Band und Achse bleiben |

Hinweiszeile nach den Zeilen, wenn mindestens eine Zeile `sd-range--plain` ist (direktes Kind der Karte, erklärt beide):
| Fall | Text |
| --- | --- |
| beide frei | `<p class="sd-range__note">Für diesen Lauf gibt es kein Zielband. Die Werte stehen nur zur Info.</p>` (beim Kalibrierungstest, `/test|kalibrierung/i`, genau der abgenommene Mockup-Satz: „Für den Test gibt es kein Zielband. Die Werte stehen nur zur Info.“) |
| nur Pace frei | `Für die Pace gibt es kein Zielband.` |
| nur HF frei | `Für die Herzfrequenz gibt es kein Zielband.` |
Pace-neutral braucht diese Zeile nicht (er trägt seine eigene Notiz). Farbregel: Pace `is-ok` im Band, sonst `is-warn`; HF `is-ok` genau bei `avgHr ≤ hfMax`; beides kommt fertig aus `paceStatus()`/`hrStatus()`.

### 12.5 Strava-Zeile und Plan-Hinweis

Zweites Element im Slot, nur wenn ein Lauf zugeordnet ist. Die ganze Zeile ist der Auslöser des Zuordnungs-Sheets (kein Läufer-Icon).
```html
<button type="button" class="sd-linkrow" data-card="strava-run" data-source="auto" data-action="pick-run" data-date="2026-10-19" aria-haspopup="dialog">
  <span class="sd-linkrow__main">
    <span class="sd-linkrow__label">Aus Strava</span>
    <span class="sd-linkrow__name">Morgenlauf</span>
    <span class="sd-linkrow__note" data-slot="shift-note">nachgeholt · Di, 20.10.</span>
  </span>
  <span class="sd-pill">automatisch</span>
  ${I_CHEV_R}
</button>
```
| Teil | Regel |
| --- | --- |
| Name | `${esc(run.name)}`. Das Mockup zeigt „Morgenlauf · 07:05“: die Uhrzeit ist im Laufmodell (`mapActivity`) nicht vorhanden. Sie erscheint nur, wenn der Coder `startTime` (`start_date_local.slice(11, 16)`) ergänzt, dann ` · ${startTime}`; sonst nur der Name |
| Pill automatisch | `source === "auto"` (und `"exact"`): neutral `<span class="sd-pill">automatisch</span>`, `data-source="auto"` |
| Pill von Hand | `source === "manual"`: `<span class="sd-pill sd-pill--amber">von Hand</span>`, `data-source="manual"` |
| Verschoben | Nur wenn `offset !== 0`: Zeile `sd-linkrow__note`. `offset > 0`: `nachgeholt · ${dayNameDE(run.date)}, ${shortDate(run.date)}`; `offset < 0`: `vorgezogen · ${dayNameDE(run.date)}, ${shortDate(run.date)}`. Amber, Text trägt den Status (nicht nur Farbe). Ersetzt `.shift-note` und `offsetLabel` im Lauf-Tag (Woche nutzt `offsetLabel` weiter) |
| Plan-Hinweis | Unter dem Slot: `<div class="sd-planhint" data-card="plan-note"><p class="sd-planhint__label">Hinweis aus dem Plan</p><p class="sd-planhint__text">${esc(info.note)}</p></div>`. Nur wenn `info.note` nicht leer; in **jedem** Zustand sichtbar, auch beim Laden (steht im statischen Teil, nicht im Slot) |
Tippfläche mindestens 64 px hoch. Bei Spalten unter 340 px schrumpfen Gap und Seitenpolster der Zeile; Name und Notiz brechen um, Pill und Chevron bleiben.

### 12.6 Zustandskarten (kein Lauf)

Alle einzeln zentriert (`sd-card sd-card--center`), Slot-Inhalt, mit Ziel-Zeile im Kopf (12.1). `<h2 class="sd-card__title">`.

**Zukunft oder heute, noch kein Lauf** (`data-card="empty"`):
```html
<article class="sd-card sd-card--center" data-card="empty">
  <h2 class="sd-card__title">Noch kein Lauf</h2>
  <p class="sd-card__text">Sobald der Lauf in Strava liegt, erscheint er hier.</p>
  <div class="sd-actions"><button type="button" class="sd-btn" data-action="pick-run" data-date="${iso}">Lauf von Hand zuordnen</button></div>
</article>
```
**Verpasst** (vergangener Tag, kein Lauf im Fenster, nicht ignoriert; `data-card="missed"`):
```html
<article class="sd-card sd-card--center" data-card="missed">
  <span class="sd-pill sd-pill--danger">verpasst</span>
  <h2 class="sd-card__title">Kein Lauf gefunden</h2>
  <p class="sd-card__text">Strava-Läufe von einem Tag davor bis drei Tage danach.</p>
  <div class="sd-actions">
    <button type="button" class="sd-btn" data-action="pick-run" data-date="${iso}">Lauf von Hand zuordnen</button>
    <button type="button" class="sd-btn sd-btn--text" data-action="reload-strava">${I_REFRESH}Neu laden</button>
  </div>
</article>
```
**Strava nicht verbunden** (`connected === false`, Worker da; `data-card="no-strava"`):
```html
<article class="sd-card sd-card--center" data-card="no-strava">
  <h2 class="sd-card__title">Strava ist nicht verbunden</h2>
  <p class="sd-card__text">Verbinde Strava, dann erscheint der Lauf hier automatisch.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--primary" data-action="connect-strava">Mit Strava verbinden</button></div>
</article>
```
Das ist die einzige gefüllte Teal-Fläche des Screens. Ersetzt den losen `primary-btn`.

**Bewusst ignoriert** (`source === "ignored"`; `data-card="ignored"`):
```html
<article class="sd-card sd-card--center" data-card="ignored">
  <h2 class="sd-card__title">Bewusst leer gelassen</h2>
  <p class="sd-card__text">Kein Lauf an diesem Tag. Zählt als verpasst.</p>
  <div class="sd-actions"><button type="button" class="sd-btn" data-action="reset-run" data-date="${iso}">Automatik zurück</button></div>
</article>
```
Sprachregel: „Lauf von Hand zuordnen“ öffnet immer das Zuordnungs-Sheet (`pick-run`), „Automatik zurück“ heißt überall gleich (Karte und Sheet).

### 12.7 Fehler

Slot-Inhalt statt der Karten; Kopf mit Ziel-Zeile. Fehlerkarte wie 3.10 (`role="alert"`, Danger, Koralle nie), drei getrennte Welten (`data-source`):
```html
<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="firebase">
  <p class="sd-card__title sd-card__title--danger">Daten-Problem (Firebase)</p>
  <p class="sd-card__text sd-card__text--danger">${esc(s.error)}</p>
  <p class="sd-card__text sd-card__text--danger">Nicht Strava, sondern der Datenspeicher. Prüfe, ob du angemeldet bist (Plan-Tab, Daten und Konto) und ob die Regeln aus <code>firestore.rules</code> in der Firebase-Console veröffentlicht sind.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--onbanner" data-action="reload-strava">Nochmal versuchen</button></div>
</div>

<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="strava">
  <p class="sd-card__title sd-card__title--danger">Strava-Problem</p>
  <p class="sd-card__text sd-card__text--danger">${esc(s.error)}</p>
  <div class="sd-actions">
    <button type="button" class="sd-btn sd-btn--onbanner" data-action="reload-strava">Nochmal versuchen</button>
    <button type="button" class="sd-btn sd-btn--onbanner" data-action="connect-strava">Neu verbinden</button>
  </div>
</div>

<div class="sd-card sd-card--danger" role="alert" data-card="error" data-source="worker">
  <p class="sd-card__title sd-card__title--danger">Strava noch nicht eingerichtet</p>
  <p class="sd-card__text sd-card__text--danger">Der Token-Worker fehlt (siehe README, Abschnitt „Strava“). Ohne ihn kann der Browser sich nicht bei Strava anmelden.</p>
</div>
```
Reihenfolge der Prüfung wie bisher: Worker fehlt, dann Fehler (Firebase vor Strava), dann nicht verbunden. Der Worker-Fall hat bewusst keine Aktion. Die Fehlertexte aus den Quellen (`Missing or insufficient permissions.` usw.) werden nicht verändert; ein Em-Dash in ihnen ist nicht Sache des Designs.
### 12.8 Gesamtzustands-Tabelle

| Zustand | Ziel-Zeile im Kopf | Slot-Inhalt |
| --- | --- | --- |
| Laden | ja | 12.2 |
| Worker fehlt | ja | 12.7 worker |
| Firebase- oder Strava-Fehler | ja | 12.7 |
| Strava nicht verbunden | ja | 12.6 no-strava |
| Bewusst ignoriert | ja | 12.6 ignored |
| Zugeordnet, auto oder von Hand | nein | 12.3 + 12.5 (+ Plan-Hinweis) |
| Kein Lauf, Tag heute oder Zukunft | ja | 12.6 empty |
| Kein Lauf, Tag vorbei | ja | 12.6 missed |

### 12.9 Zuordnungs-Sheet `#assignSheet`

Statische Hülle in `index.html`, Geschwister von `#infoSheet` (selbe Klassen, `createSheet("assignSheet", "assignBackdrop")`); der Coder füllt nur Titel und Körper:
```html
<div id="assignBackdrop" class="sd-backdrop" data-action="close-sheet" hidden></div>
<div id="assignSheet" class="sd-sheet" role="dialog" aria-modal="true" aria-labelledby="assignSheetTitle" hidden>
  <div class="sd-sheet__grip"></div>
  <div class="sd-sheet__head">
    <h2 class="sd-sheet__title" id="assignSheetTitle" tabindex="-1"></h2>
    <button type="button" id="assignSheetClose" class="sd-sheet__close" data-action="close-sheet" aria-label="Schließen"><svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div id="assignSheetBody"></div>
</div>
```
Titel per `textContent`: `Lauf für ${dayNameDE(iso)}, ${shortDate(iso)}` („Lauf für Mo, 19.10.“). Schließen: Backdrop, ×, Escape (alles schon in `createSheet`). Fokus beim Öffnen auf den Titel, beim Schließen zurück auf den Auslöser (Knopf mit `data-action="pick-run"` und gleichem `data-date`).

Körper (`#assignSheetBody.innerHTML`):
```html
<p class="sd-sheet__lead">Strava-Läufe von einem Tag davor bis drei Tage danach.</p>
<div class="sd-sheet__list" role="radiogroup" aria-label="Lauf wählen">
  <button type="button" class="sd-option" role="radio" aria-checked="false" data-action="assign-run" data-date="${iso}" data-run="${esc(id)}">
    <span class="sd-radio"></span>
    <span class="sd-option__main"><span class="sd-option__name">Mo, 19.10. · Morgenlauf</span><span class="sd-option__sub">8,2 km · 6:22 /km · am Plantag</span></span>
  </button>
  <button type="button" class="sd-option is-selected" role="radio" aria-checked="true" data-action="assign-run" data-date="${iso}" data-run="${esc(id)}">…</button>
  <div class="sd-option" role="radio" aria-checked="false" aria-disabled="true">
    <span class="sd-radio"></span>
    <span class="sd-option__main"><span class="sd-option__name">So, 18.10. · Recovery</span><span class="sd-option__sub">5,1 km · 6:52 /km</span><span class="sd-option__why">gehört schon zu So, 18.10.</span></span>
  </div>
</div>
<div class="sd-sheet__tools">
  <button type="button" class="sd-btn sd-btn--text" data-action="reset-run" data-date="${iso}">Automatik zurück</button>
  <button type="button" class="sd-btn sd-btn--text" data-action="reload-strava">${I_REFRESH}Neu laden</button>
</div>
<button type="button" class="sd-btn sd-btn--danger sd-btn--md sd-btn--block" data-action="ignore-run" data-date="${iso}">Kein Lauf an diesem Tag</button>
```
| Teil | Regel |
| --- | --- |
| Optionen | Sortierung wie `pickableRuns` (nächster Tag zuerst). Name `${dayNameDE(r.date)}, ${shortDate(r.date)} · ${esc(r.name)}`; Sub `${km} km · ${esc(r.paceLabel)} · ${abstand}`, `abstand` = „am Plantag“, „1 Tag später“, „2 Tage später“, „1 Tag früher“ (Betrag über `daysBetween`) |
| Gewählt | `is-selected` + `aria-checked="true"` am aktuell zugeordneten Lauf (`runAssignment[iso].run`), egal ob auto oder von Hand. Tipp auf ihn schließt das Sheet ohne Änderung |
| Belegt | Lauf, der fest zu einem anderen Plantag gehört (`manual`/`exact` dort): `<div>` statt `<button>`, `aria-disabled="true"`, **ohne** `data-action`; Inhalt 50 %, der Grund `sd-option__why` „gehört schon zu ${dayNameDE}, ${shortDate}“ bleibt voll lesbar. Dafür muss `pickableRuns` diese Läufe mitliefern (statt sie auszufiltern), mit Feld `takenBy` (ISO des anderen Tags) |
| Automatik zurück | Nur wenn `source` `manual` oder `ignored` ist, sonst weglassen. Bei nur einem Text-Button steht „Neu laden“ allein links |
| Neu laden | Immer. Während des Ladens bleibt das Sheet offen, der Knopf ist `disabled` + `aria-busy="true"` und heißt weiter „Neu laden“; danach wird nur der Körper neu geschrieben (Titel und Fokus bleiben) |
| Kein Lauf zur Auswahl | `radiogroup` entfällt, statt dessen `<p class="sd-sheet__lead" data-slot="no-options">Im Zeitfenster liegt kein freier Lauf. Mit „Neu laden“ holst du gerade hochgeladene Läufe.</p>`; Tools und Danger-Button bleiben |
| Danger-Button | Immer, „Kein Lauf an diesem Tag“ (`ignore-run`); danach zeigt der Slot die Karte „Bewusst leer gelassen“ |

### 12.10 `data-action`-Namen auf dem Lauf-Tag

Unverändert (Tests und Handler hängen daran): `back`, `pick-run`, `assign-run`, `reset-run`, `ignore-run`, `reload-strava`, `connect-strava`.
`close-picker` entfällt (ersetzt durch `close-sheet`, Abschnitt 5). Sonst keine neuen Namen. Parameter: `data-date` (ISO des Plantags) an `pick-run`/`assign-run`/`reset-run`/`ignore-run`, `data-run` (Strava-ID) nur an `assign-run`.
Stabile Test-Haken (ersetzen `.card.shifted`, `.pick-row`, `.pick-main`): `[data-card="compare"][data-status="ok|short|none"]`, `[data-card="strava-run"][data-source="auto|manual"]`, `[data-slot="shift-note"]`, `[data-card="plan-note"]`, `[data-card="empty|missed|no-strava|ignored|loading"]`, `[data-card="error"][data-source]`, `#assignSheet .sd-option[role="radio"]`, `.sd-option.is-selected`, `.sd-option[aria-disabled="true"]`, `.sd-range` (Anzahl 2), `.sd-range--plain`, `.sd-range__note`, `#strava-slot`.

### 12.11 Welche Texte durch `esc()`, Barrierefreiheit, Fokus, Responsive

**`esc()`** zusätzlich zu Abschnitt 6: `info.type`, `info.dist`, `info.pace`, `info.hf`, `info.note` (Titel, Ziel-Zeile, Achsenmitte „Ziel …“, Plan-Hinweis), `run.name`, `run.paceLabel`, `data-run="${esc(id)}"`, `s.error`. **Nicht**: feste Strings, Icon-Konstanten, `formatKm1()`/`formatDuration()`/`dayNameDE()`/`shortDate()`-Ausgaben, `value`/`max` (`numAttr`), SVG-Zahlen (`pct()`), `data-date` (ISO), Skalenwerte der Achse (formatierte Zahlen).

**ARIA**
- Sheet: `role="dialog" aria-modal="true" aria-labelledby`; Liste `role="radiogroup"`, Optionen `role="radio"` mit `aria-checked`; Belegte `aria-disabled="true"`. Alle wählbaren Optionen bleiben per Tab erreichbar (jede ist ein Button, Auswahl wirkt sofort); Pfeiltasten sind optional und kein Muss.
- Range-Balken: SVG `aria-hidden`; der Wert trägt Ampel-Form und verstecktes Wort („im Zielbereich“ / „außerhalb des Zielbereichs“), die Achse liest sich als Text („5:45 Ziel 6:15–6:40 7:10“). Distanzbalken: `<progress>` mit `aria-label` inklusive Werten.
- Vergleichs-Karte `aria-label`, Fehlerkarten `role="alert"`, Laden `role="status"`. Strava-Zeile `aria-haspopup="dialog"`.

**Fokus**
- Zuordnen (`assign-run`), Automatik zurück (`reset-run`): erst den Slot neu schreiben, **dann** `sheet.close()` aufrufen; so findet `liveTrigger` die neue Zeile über `data-action="pick-run"` + `data-date` und der Fokus liegt dort.
- `ignore-run`: der Auslöser existiert danach nicht mehr; Fokus auf `[data-action="reset-run"]` der Ignoriert-Karte.
- `reload-strava` im Slot: Fokus auf den Titel (`h1`, `tabindex="-1"`), wenn der Auslöser verschwindet. Im Sheet bleibt der Fokus auf „Neu laden“.
- Fokus nie auf `body` fallen lassen.

**Tippflächen:** Strava-Zeile 64, Optionen 56, Sheet-Buttons 44 (Danger 48), × 44 per `::after`, Karten-Buttons 44.
**Responsive:** 320: Zahl 40 px, Pill fällt bei Bedarf unter die Zahl, Strava-Zeile rückt enger, Achse bleibt dreispaltig, Aktionsreihen der Zustandskarten umbrechen, Sheet-Inhalt scrollt (höchstens 78 % der Höhe). 1280: Spalte bleibt 480 px zentriert.
**Bewegung:** Sheet 250 ms ease-out, unter `prefers-reduced-motion` aus (bestehende Regel). Keine neue Animation.
**Sprache:** Kein Gedankenstrich in den hier definierten Texten; der Halbgeviertstrich in „6:15–6:40“ und im Platzhalter „–“ ist erlaubt.

### 12.12 Durch E6 überflüssig werdende alte Klassen (Löschliste, **nicht** vorab löschen)

Greppen vom Designer am Stand HEAD 2062fbf: Alle folgenden Klassen werden **heute noch** von `app.js` (`renderRunDay`, `planRunCard`, `stravaResultHTML`, `runPickerHTML`) bzw. `tests/app.test.mjs` genutzt, darum steht die Löschung erst nach dem Umbau an:
- **Erledigt in E7 (Grep über `*.js`, `*.html`, `tests/`: nur Abwesenheits-Prüfungen und `data-slot="shift-note"`, keine Klassennutzung):** `.strava-note` (+ `svg`, `p`), `.card.shifted`, `.shift-note`, `.pick-row` (+ `.on`, `.pick-main`, `.pick-sub`), `.bg-coral`, `.fg-coral`, `.metric-value.xs`, `.icon-btn`, `.sd-pagehead .icon-btn svg`.
- Ursprüngliche Vormerkung (Lauf-Tag-eigen): `.strava-note` (+ `svg`, `p`), `.card.shifted`, `.shift-note`, `.pick-row` (+ `.on`, `.pick-main`, `.pick-sub`).
- Wahrscheinlich frei, je einzeln greppen: `.card.bg-coral`-Nutzung samt `.bg-coral`, `.fg-coral`, `.metric-value.xs`, `.metric-grid`, `.metric-label`, `.metric-value`, `.metric-value.sm` (`planRunCard` und `stravaResultHTML` waren die letzten Nutzer außer der Konto-Karte; `view-account.js` vorher prüfen).
- **Nicht löschen** (andere Screens): `.primary-btn` (Heute-Fallback, `app.js` Z. 2079, `view-dashboard.js` Z. 60), `.card.error-card` (`view-account.js`, `ui.js`), `.icon-btn`, `.small-btn`, `.link-btn` (je greppen, Verlauf/Plan nutzen sie evtl. noch), `.danger-btn`.
- Aus `app.js` entfallen: `data-action="close-picker"`, Ids/Klassen `pick-row`, `shift-note`, `shifted`, `strava-note`, der Standardsatz „Wird nicht hier eingetragen — die Daten kommen automatisch aus Strava.“ (enthält einen Em-Dash), `runPickerFor`-Inline-Karte (ersetzt durch das Sheet).
- Bereits gelöscht (Grep über `*.js`, `*.html`, `tests/`: keine Treffer): `.sd-bar`, `.sd-bar__fill`, `.sd-bar--coral`, `.sd-bar--lg`, `.sd-intro .sd-bar` und damit die letzte Nutzung von `--pct`.

---

## 13. Screen-Ergänzungen: Verlauf (E7)

Optik: Handoff §5.5. CSS: Abschnitt „Verlauf + Plan (E7)“ am Ende von `style.css`; wiederverwendet werden `sd-seg`, `sd-card*`, `sd-stripe`, `sd-pill`, `sd-btn`, `sd-skel*`, `sd-vh`, `sd-mono`, `sd-unit`, `sd-hint`. **Kein `style=` auf diesem Screen.**
Neu: `sd-tabhead`, `sd-filter`, `sd-infobtn`, `sd-tiles`/`sd-tile`, `sd-chart*`, `sd-best`, `sd-trend`, `sd-rows`/`sd-hrow*`, `sd-skel--val`, `sd-skel--chart`.

Icon-Konstante (einmal in `view-history.js`; `ICONS.*` hat keine Größenklasse und ist tabu):
```js
const I_INFO = '<svg class="sd-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/></svg>';
```
Zahlen-Helfer `svgNum(x)` (Geometrie in SVG-Attributen und `<title>`-freie Zahlen): `Number.isFinite(x) ? String(Math.round(x * 10) / 10) : "0"`, Punkt als Dezimaltrenner, **nie** `formatKm1()` im Attribut. Zahlen im Text (Tooltip, Liste, `aria-label`) laufen durch `formatKm1()` bzw. die Pace-Formatierer.

### 13.0 Seitenaufbau und Slot

```html
<header class="sd-pagehead" data-region="pagehead">
  <div class="sd-tabhead">
    <div class="sd-tabhead__titles"><h1 class="sd-display" tabindex="-1">Verlauf</h1></div>
    <div class="sd-seg" role="group" aria-label="Ansicht">
      <button type="button" class="sd-seg__opt is-active" aria-pressed="true"  data-action="hist-mode" data-mode="lauf">Lauf</button>
      <button type="button" class="sd-seg__opt"           aria-pressed="false" data-action="hist-mode" data-mode="kraft">Kraft</button>
    </div>
  </div>
  <!-- nur im Modus Kraft, direktes Kind des Kopfes (Abschnitt 13.5): -->
  <div class="sd-filter" role="group" aria-label="Übung wählen">…</div>
</header>
<div class="sd-main sd-main--tight">
  <div id="hist-slot">…Inhalt je Zustand…</div>
</div>
```
- **Default-Modus ist Lauf** (links). `state.historyMode` startet mit `"lauf"` (heute steht dort `"kraft"`).
- Der Kopf steht sofort; nur `#hist-slot` lädt nach und ist nie leer (Laden, Karten oder Fehler). `#hist-slot` bekommt Flex-Spalte und Gap 12 von der bestehenden Regel `.sd-main > [id$="-slot"]`.
- Reihenfolge Segment: **Lauf, Kraft** (vorher Kraft, Lauf). Die Aktion `hist-mode` und `data-mode` bleiben.
- **Segment-Semantik (Entscheid):** `role="group"` mit zwei Buttons und `aria-pressed`, wie 3.7. Kein `tablist`: es gibt kein Tabpanel und keine Pfeiltasten-Logik, zwei Umschalter mit Tab-Reihenfolge sind für ein Zwei-Wege-Umschalten ehrlicher und tragen ohne zusätzlichen Code.
- **Fokus nach `render()`:** der Modus-Wechsel baut den Kopf neu. Der Coder setzt den Fokus auf `[data-action="hist-mode"][data-mode="${neuerModus}"]` zurück, nie auf `body`.
- `.sd-tabhead` ist wie `.sd-weekhead` ein direktes Kind von `.sd-pagehead` (sonst greift das Seitenpolster nicht, Regel steht in `style.css`). Titel und Segment brechen um (Segment unter den Titel), wenn die Zeile zu eng wird; nichts verschwindet.

### 13.1 Modus Lauf: Zustände

| Zustand | `#hist-slot`-Inhalt | `data-card` |
| --- | --- | --- |
| Laden | 13.1a | `loading` |
| Worker fehlt (`!isWorkerConfigured`) | Fehlerkarte `data-source="worker"` aus 12.7, ohne Aktion | `error` |
| Fehler (`s.error`) | Fehlerkarte `data-source="strava"` aus 12.7 („Nochmal versuchen“ `reload-strava`, „Neu verbinden“ `connect-strava`) | `error` |
| Nicht verbunden (`s.connected === false`) | 13.1b | `no-strava` |
| Verbunden, keine Läufe | 13.1c | `empty` |
| Läufe da | 13.2 bis 13.4 | `run-stats`, `run-chart`, `run-list` |

**13.1a Laden** (Kopf und Segment stehen schon):
```html
<div class="sd-tiles" aria-hidden="true">
  <div class="sd-tile"><span class="sd-skel sd-skel--w60"></span><span class="sd-skel sd-skel--val"></span></div>   <!-- viermal -->
</div>
<div class="sd-card" data-card="loading" role="status" aria-busy="true">
  <span class="sd-skel sd-skel--w40"></span>
  <span class="sd-skel sd-skel--chart"></span>
  <span class="sd-vh">Verlauf wird geladen</span>
</div>
```
(Platzhalter-Kacheln sind `div`/`span`, **kein** `dl`: `dd` bringt einen Browser-Einzug mit.) Der Schimmer wird unter `prefers-reduced-motion` ruhig (bestehende Regel).

**13.1b Nicht verbunden** (einzige gefüllte Teal-Fläche des Screens, ersetzt den losen `primary-btn`):
```html
<article class="sd-card sd-card--center" data-card="no-strava">
  <h2 class="sd-card__title">Strava ist nicht verbunden</h2>
  <p class="sd-card__text">Verbinde Strava, dann erscheinen deine Läufe hier.</p>
  <div class="sd-actions"><button type="button" class="sd-btn sd-btn--primary" data-action="connect-strava">Mit Strava verbinden</button></div>
</article>
```
**13.1c Keine Läufe** (ersetzt `center-note`):
```html
<article class="sd-card sd-card--center" data-card="empty">
  <h2 class="sd-card__title">Noch keine Läufe</h2>
  <p class="sd-card__text">Seit ${shortDate(STRAVA_SINCE)} liegt noch kein Lauf in Strava.</p>
</article>
```

### 13.2 Kacheln (2 × 2)

```html
<dl class="sd-tiles" data-card="run-stats">
  <div class="sd-tile" data-tile="km7"><dt class="sd-tile__label">Letzte 7 Tage</dt><dd class="sd-tile__value sd-mono">18,4<span class="sd-unit">km</span></dd></div>
  <div class="sd-tile" data-tile="km28"><dt class="sd-tile__label">Letzte 28 Tage</dt><dd class="sd-tile__value sd-mono">62,0<span class="sd-unit">km</span></dd></div>
  <div class="sd-tile" data-tile="pace">
    <dt class="sd-tile__label">Ø Pace<button type="button" class="sd-infobtn" data-action="open-info" data-info="verlauf-pace" aria-haspopup="dialog" aria-label="Erklärung: Ø Pace">${I_INFO}</button></dt>
    <dd class="sd-tile__value sd-mono">6:22<span class="sd-unit">/km</span></dd>
  </div>
  <div class="sd-tile" data-tile="count"><dt class="sd-tile__label">Läufe seit Planstart</dt><dd class="sd-tile__value sd-mono">23</dd></div>
</dl>
```
- Reihenfolge fest: 7 Tage, 28 Tage, Ø Pace, Läufe. Werte mit `formatKm1()` (Komma), Ø Pace als `m:ss` ohne „/km“ im Wert (Einheit steht im `sd-unit`).
- Ø Pace ohne Pace-Daten: Wert `–` (Halbgeviertstrich), keine Einheit. Die alte Klammer „(10 Läufe)“ entfällt aus dem Label; die Grundlage steht im Info-Sheet.
- **(i) an berechneten Werten:** `open-info` mit `data-info="verlauf-pace"`; Inhalt siehe 13.7. Tippfläche 44 px (unsichtbar per `::after`), `aria-haspopup="dialog"`.
- Zahl fluid über `cqi`: 19 px bei 320 px, 22 px ab ca. 390 px. Die Einheit bricht unter die Zahl, wenn sie nicht daneben passt.
- Das Label „Läufe seit Planstart“ zählt `runs.length` seit `STRAVA_SINCE` (siehe offene Punkte im Bericht); die Kachel zeigt immer eine Zahl, auch `0`.

### 13.3 Diagramm „Distanz je Lauf“ (Auflage C5, Entscheid E7)

```html
<section class="sd-card" data-card="run-chart" aria-labelledby="runChartTitle">
  <div class="sd-card__top">
    <h2 class="sd-card__title" id="runChartTitle">Distanz je Lauf</h2>
    <p class="sd-hint">Letzte 10 Läufe</p>
  </div>
  <figure class="sd-chart">
    <svg class="sd-chart__plot" viewBox="0 0 320 120" preserveAspectRatio="none" role="img" focusable="false"
         aria-label="Balkendiagramm: Distanz der letzten 10 Läufe, von 5,2 bis 18,4 km. Die einzelnen Werte stehen in der Liste darunter.">
      <rect class="sd-chart__bar sd-chart__bar--lauf" x="3" y="63.5" width="24" height="61.5" rx="5"><title>19.10.: 8,2 km</title></rect>
      <rect class="sd-chart__bar sd-chart__bar--long" x="35" y="0" width="24" height="125" rx="5"><title>18.10.: 18,4 km</title></rect>
      <!-- … ein rect je Lauf, älteste links, neueste rechts -->
    </svg>
    <div class="sd-chart__axis" aria-hidden="true"><span>12</span><span>14</span><!-- … ein Span je Lauf --><span>19</span></div>
  </figure>
  <p class="sd-chart__legend"><span><span class="sd-chart__swatch sd-chart__swatch--lauf" aria-hidden="true"></span>Lauf</span><span><span class="sd-chart__swatch sd-chart__swatch--long" aria-hidden="true"></span>Long Run</span></p>   <!-- nur wenn mindestens ein Long Run dabei ist -->
</section>
```
**Mechanismus (C5):** ein Inline-SVG, die Balken sind `<rect>` mit Zahlen-Attributen, Farbe über die Klasse am `rect`, Beschriftung ist HTML darunter. `viewBox="0 0 320 120"` mit `preserveAspectRatio="none"`: der Plot dehnt sich auf die Kartenbreite (256 bis 416 px), die Höhe bleibt 120 px (1 Einheit = 1 px). Der Plot ist `role="img"`; das Rect-`<title>` ist nur der Maus-Tooltip.

**Geometrie** (n = Anzahl Läufe, 1 bis 10; `max` = größte Distanz; alle Werte durch `svgNum`):
- `slot = 320 / n`, `bw = min(24, slot - 6)`
- `x_i = slot * i + (slot - bw) / 2`
- `h_i = max(4, value_i / max * 120)`, `y_i = 120 - h_i`
- `height_i = h_i + 5`, `rx = 5`: das Rect ragt 5 Einheiten unter die Grundlinie, das SVG schneidet ab. Ergebnis: oben rund (Radius 5), unten bündig.
- Klasse: `sd-chart__bar--lauf` (Standard) oder `sd-chart__bar--long` (`isLongRun`). Ohne Modifier wäre die Farbe Teal (Kraft).
- `max <= 0` oder `n = 0`: kein Diagramm (Zustand 13.1c bzw. Karte weglassen).

**Beschriftung und Ausdünnen:** `.sd-chart__axis` hat **immer genau n** `<span>` (gleich breit, mittig unter dem Balken, daher passt die Position zu `x_i`). Lauf: Tag des Monats (`19`, 1 bis 2 Zeichen). Bei höchstens 10 Plätzen und 320 px Spalte ist ein Platz 25,6 px breit, das Label 11,4 px: alle Labels stehen. **Regel für alle Diagramme:** `step = ceil(n / 10)`; ein Label steht nur, wenn `(n - 1 - i) % step === 0` (vom neuesten Platz aus gezählt), alle anderen Spans bleiben **leer** (nicht weglassen, sonst verschiebt sich die Ausrichtung). Grund: 3 Zeichen Mono 9,5 px sind ca. 17 px, plus 6 px Luft, ergibt 23 px; bei 256 px Plotbreite passen so höchstens 11 Labels. Labels über 2 bis 3 Zeichen (z. B. „19.10.“) sind nicht erlaubt.

**Text-Alternative:** `aria-label` am SVG nennt Art, Anzahl, Minimum und Maximum (formatiert) und verweist auf die Liste. Die Achse ist `aria-hidden`; alle Werte stehen als Text in 13.4.

### 13.4 Liste „Letzte Läufe“

```html
<ul class="sd-card sd-card--list sd-rows" role="list" data-card="run-list" aria-label="Letzte Läufe">
  <li class="sd-hrow" role="listitem" data-kind="lauf" data-run="${esc(id)}">
    <span class="sd-stripe sd-stripe--lauf" aria-hidden="true"></span>
    <span class="sd-hrow__main"><span class="sd-hrow__title">${esc(typeOrName)}</span><span class="sd-hrow__sub sd-mono">Mo, 19.10.</span></span>
    <span class="sd-hrow__val sd-mono"><span>8,2 km</span><span class="sd-hrow__sep" aria-hidden="true">·</span><span><span class="sd-vh">Pace </span>6:22</span></span>
  </li>
  <!-- Long Run: data-kind="long", Streifen sd-stripe--long -->
</ul>
```
- Neueste zuerst, höchstens 10 (dieselben Läufe wie das Diagramm). Streifen `sd-stripe--lauf` bzw. `sd-stripe--long`. Titel 14/500: der Plan-Typ („Easy run“), wenn der Lauf einem Plantag zugeordnet ist, sonst der Strava-Name (beides durch `esc()`). Datum Mono 11.5 als `dayNameDE, shortDate`.
- Fehlt die Pace: `<span>–</span>` statt Pace und Trennpunkt weglassen.
- Unter 360 px Spaltenbreite stehen Distanz und Pace **untereinander** (rechtsbündig), der Punkt entfällt per CSS. Der Titel darf auf zwei Zeilen umbrechen (`overflow-wrap: anywhere`).
- Zeilen sind nicht antippbar (Handoff kennt keine Detailansicht), darum kein Button und kein Hover.

### 13.5 Modus Kraft: Chips

```html
<div class="sd-filter" role="group" aria-label="Übung wählen">
  <button type="button" class="sd-filter__chip is-active" aria-pressed="true"  data-action="pick-exercise" data-slug="squats"><span>Squats</span></button>
  <button type="button" class="sd-filter__chip"           aria-pressed="false" data-action="pick-exercise" data-slug="deadlift"><span>Deadlift</span></button>
</div>
```
- **Neue Aktion `pick-exercise`** (`data-slug` = `slug(e.name)`), ersetzt das `change`-Ereignis von `#ex-picker` (Select und `wirePicker()` entfallen). Wirkung: `state.historyExercise = slug`, `renderHistory()`.
- Reihenfolge wie `exerciseCatalog(plans[0])`. Der Name steht im inneren `<span>` (durch `esc()`), das schneidet sehr lange Namen bei 240 px mit „…“ ab; der volle Text bleibt im DOM.
- **Scrollen (Entscheid):** die Zeile scrollt nur in sich (`overflow-x: auto`), die Seite scrollt nie seitlich. Das Chip ist 36 px hoch, die Trefferfläche 44 px über `::after`; die Zeile hat oben und unten 4 px Polster, damit Fokusring und Trefferfläche nicht abgeschnitten werden. Das angeschnittene nächste Chip am rechten Rand ist der Hinweis, dass es weitergeht.
- **Nach `render()`** scrollt der Coder das aktive Chip in den Blick: `chip.scrollIntoView({ inline: "center", block: "nearest" })` (Standardverhalten, nicht `smooth`), und setzt den Fokus auf das aktive Chip zurück (`[data-action="pick-exercise"][data-slug="…"]`).
- Aktiv: `is-active` (Fläche `--teal-bg`, Text `--teal-fg`, innerer Ring) plus `aria-pressed="true"`. Das Chip ist ein Button, kein `radio`: Auswahl wirkt sofort, Tab erreicht jedes Chip.

### 13.6 Modus Kraft: Zustände und Karten

| Zustand | `#hist-slot`-Inhalt | `data-card` |
| --- | --- | --- |
| Laden | wie 13.1a, aber ohne Kacheln: Karte mit `sd-skel--w40`, `sd-skel--val`, `sd-skel--chart`, danach Listen-Karte mit drei `sd-skel--w92` | `loading` |
| Fehler (`loadLogsForExercise`) | `sd-card--danger`, `role="alert"`, Titel „Verlauf konnte nicht geladen werden“, Text `esc(err.message)`, Aktion `sd-btn--onbanner` „Neu laden“ `data-action="reload"` | `error` (`data-source="firebase"`) |
| Keine Einträge | 13.6a | `strength-empty` |
| Einträge | 13.6b und Liste 13.6c | `strength-best`, `strength-list` |

**13.6a Keine Einträge** (ersetzt `center-note`; die Chips bleiben stehen):
```html
<article class="sd-card sd-card--center" data-card="strength-empty">
  <h2 class="sd-card__title">Noch nichts erfasst</h2>
  <p class="sd-card__text">Für ${esc(name)} gibt es noch keinen Eintrag. Er erscheint hier, sobald du die Übung im Kraft-Tag abschließt.</p>
</article>
```
**13.6b Karte „Bestes Satzgewicht“**
```html
<section class="sd-card" data-card="strength-best" aria-labelledby="bestTitle">
  <div>
    <h2 class="sd-card__title" id="bestTitle">Bestes Satzgewicht</h2>
    <p class="sd-hint">Schwerster Satz je Woche</p>
  </div>
  <div class="sd-best">
    <p class="sd-best__val sd-mono"><span class="sd-vh">Zuletzt </span>82,5<span class="sd-unit">kg</span></p>
    <p class="sd-trend sd-mono is-up"><span>+25 kg</span><span class="sd-trend__since">seit W1</span><button type="button" class="sd-infobtn" data-action="open-info" data-info="verlauf-trend" aria-haspopup="dialog" aria-label="Erklärung: Trend">${I_INFO}</button></p>
  </div>
  <figure class="sd-chart">
    <svg class="sd-chart__plot sd-chart__plot--tall" viewBox="0 0 320 130" preserveAspectRatio="none" role="img" focusable="false" aria-label="Balkendiagramm: bestes Satzgewicht je Woche, W1 bis W8, von 57,5 bis 82,5 kg. Aktuelle Woche: 82,5 kg. Hellere Balken sind Entlastungswochen.">
      <rect class="sd-chart__bar" x="…" y="…" width="…" height="…" rx="5"><title>W1: 57,5 kg</title></rect>
      <rect class="sd-chart__bar sd-chart__bar--deload" …><title>W4: 60 kg (Entlastung)</title></rect>
    </svg>
    <div class="sd-chart__axis" aria-hidden="true"><span>W1</span><span></span><span></span><span>W4</span><!-- … --><span class="is-current">W8</span></div>
  </figure>
  <p class="sd-chart__legend"><span><span class="sd-chart__swatch sd-chart__swatch--deload" aria-hidden="true"></span>Entlastungswoche</span></p>   <!-- nur wenn mindestens ein Deload-Balken da ist -->
</section>
```
- **Große Zahl** (Mono 30/600): bester Wert der **letzten Woche mit Eintrag**. **Trend**: Differenz dieses Wertes zum Wert der **ersten** Woche im Diagramm, Text `+25 kg seit W1` mit der Nummer der ersten Plan-Woche (Entscheid Orchestrator: „seit W‹erste›“, nicht „bis W7“). Typografie: `sd-trend` Mono 12,5/600.
- **Trend-Varianten:**

| Fall | Klasse | Text |
| --- | --- | --- |
| mehr als zu Beginn | `sd-trend is-up` (`--ok-fg`) | `+25 kg` + `seit W1` |
| gleich | `sd-trend` (neutral, `--text-secondary`) | `unverändert` + `seit W1` |
| weniger (z. B. nach Entlastung) | `sd-trend` (neutral, **nicht** Danger oder Amber: weniger ist kein Fehler) | `−5 kg` (echtes Minus U+2212) + `seit W1` |
| nur ein Wert | kein `sd-trend`, kein (i) | – |
Das Vorzeichen trägt die Information, die Farbe ist Zusatz.
- **Übung ohne Gewicht** (`!usesWeight`): Titel „Wiederholungen gesamt“, Hint „Höchste Summe je Woche“, Einheit `Wdh` im `sd-unit`, Trend `+8 Wdh seit W1`, Diagramm-`aria-label` mit „Wiederholungen“ statt „Gewicht“. Sonst identisch.
- **Wochen-Balken:** ein Platz je Plan-Woche von der ersten Woche mit Eintrag bis zur **aktuellen** Woche (n höchstens 35). Eine Woche ohne Eintrag bleibt ein **leerer Platz** (kein Rect, Span bleibt stehen), die Zeit-Achse bleibt ehrlich. Wert je Woche = höchstes `topKg` (bzw. höchste `totalReps`) aller Einträge dieser Woche.
- **Geometrie:** wie 13.3, aber `viewBox="0 0 320 130"`, `h_i = max(4, value_i / max * 130)`, `y_i = 130 - h_i`, `bw = min(24, slot - 3)`, `rx = min(5, bw / 2)`. Die Höhe 130 px kommt von `sd-chart__plot--tall`.
- **Farben:** Normalwoche `sd-chart__bar` (Teal), Entlastung `sd-chart__bar--deload` (`--teal-soft`, hell #a8d5c4, dunkel #2a5e4d). Die Entlastung ist nicht nur Farbe: Legende „Entlastungswoche“ (nur wenn vorhanden), `<title>` „(Entlastung)“ und der `aria-label` nennen sie.
- **Aktuelle Woche:** ihr Achsen-Span trägt `class="is-current"` (Teal, fett) und steht **immer** mit Label da, auch wenn die Woche (noch) keinen Balken hat. Der Platz der aktuellen Woche ist der letzte.
- **Ausdünnen:** Regel aus 13.3 (`step = ceil(n / 10)`, vom neuesten Platz aus gezählt, leere Spans). Beispiel n = 35: `step = 4`, Labels bei W35, W31, …, W3; die aktuelle Woche ist immer beschriftet. Label „W12“ (3 Zeichen) ist die längste erlaubte Form.

**13.6c Liste „Letzte Einträge“**
```html
<ul class="sd-card sd-card--list sd-rows" role="list" data-card="strength-list" aria-label="Letzte Einträge">
  <li class="sd-hrow" role="listitem" data-date="2026-10-19">
    <span class="sd-stripe sd-stripe--kraft" aria-hidden="true"></span>
    <span class="sd-hrow__main"><span class="sd-hrow__title">Mo, 19.10.</span><span class="sd-hrow__sub sd-mono">Woche 8 · Entlastung</span></span>
    <span class="sd-hrow__val sd-mono"><span>62,5 kg</span><span class="sd-hrow__sep" aria-hidden="true">·</span><span>24 Wdh</span></span>
  </li>
</ul>
```
Neueste zuerst, höchstens 10. Der Zusatz „· Entlastung“ in der Sub-Zeile nur in Deload-Wochen, `Woche n` aus dem Datum. Ohne Gewicht steht in `sd-hrow__val` nur `<span>24 Wdh</span>` (kein Trennpunkt). Datum als `dayNameDE, shortDate` (Helfer-Ausgabe, kein `esc()`).

### 13.7 Info-Sheet-Inhalt (neue Schlüssel in `INFO_CONTENT`)

Gleiches Gerüst wie 9.7 (`openInfo(title, blocks, trigger)`, Blöcke `{ heading, text }`).
- `verlauf-pace`, Titel „Ø Pace“: **Berechnung** „Mittel der Pace aus den letzten bis zu 10 Läufen, die eine Pace haben. Jeder Lauf zählt gleich, unabhängig von der Distanz.“ **Bedeutung** „Ein Richtwert für dein Grundtempo. Intervalle und Long Runs ziehen den Schnitt, er sagt darum wenig über einzelne Einheiten.“
- `verlauf-trend`, Titel „Trend“: **Berechnung** „Differenz zwischen dem Wert der letzten Woche mit Eintrag und dem Wert der ersten Woche im Diagramm. Es zählt je Woche der schwerste Satz (bei Übungen ohne Gewicht die höchste Wiederholungssumme).“ **Bedeutung** „Ein Plus heißt: Du bewegst mehr als zu Beginn. In Entlastungswochen darf der Wert sinken, das ist gewollt.“

### 13.8 `data-action`-Namen, Test-Haken, `esc()`

| Name | Wo | Parameter | Wirkung |
| --- | --- | --- | --- |
| `hist-mode` | Segment | `data-mode` (`lauf`/`kraft`) | **bleibt**; setzt `state.historyMode`, `render()` |
| `pick-exercise` | Chip | `data-slug` | **neu**, ersetzt `#ex-picker` (`change`) |
| `open-info` | (i)-Knopf | `data-info` (`verlauf-pace`, `verlauf-trend`) | bleibt (öffnet Info-Sheet) |
| `connect-strava`, `reload-strava`, `reload` | Zustandskarten | – | bleiben |

Stabile Test-Haken (ersetzen `#ex-picker`, `.bars`): `[data-action="hist-mode"][aria-pressed="true"]`, `.sd-filter`, `.sd-filter__chip.is-active`, `[data-card="run-stats"] .sd-tile` (Anzahl 4), `[data-card="run-chart"] .sd-chart__bar` (Anzahl = Läufe), `[data-card="run-list"] .sd-hrow`, `[data-card="strength-best"]`, `.sd-chart__bar--deload`, `.sd-chart__axis .is-current`, `.sd-trend`, `[data-card="strength-list"] .sd-hrow`, `#hist-slot`, `[data-card="loading|empty|no-strava|strength-empty|error"]`.

**`esc()`** zusätzlich zu Abschnitt 6: `run.name`, Plan-Typ im Listentitel, Übungsnamen (Chip, Leer-Text, `<title>`), `err.message`, `s.error`, `data-slug`, `data-run`. **Nicht**: `svgNum()`-Werte in x/y/width/height, `formatKm1()`/Pace-/Datums-Ausgaben, `isoDate` in `data-date`, feste Strings, Icon-Konstante, die Klassen `sd-chart__bar--lauf|long|deload` (aus fester Map).

### 13.9 Barrierefreiheit, Fokus, Responsive

- Überschriften: `h1` „Verlauf“, `h2` je Karte (`sd-card__title`); die Karten tragen `aria-labelledby` bzw. `aria-label`.
- Diagramme: `role="img"` plus `aria-label` mit Zusammenfassung, alle Werte zusätzlich als Text in der Liste. Beschriftung und Legende sind Text; Entlastung und Long Run stehen in Legende und Tooltip, nicht nur in der Farbe.
- Kontrast: Achsen-Label 9,5 px in `--text-muted` (4,5:1, Louis 21.10.), nur ergänzend; Balken tragen ihre Information zusätzlich in der Liste. Die hellen Entlastungs-Balken (`--teal-soft`) liegen unter 3:1 zur Karte und gelten bewusst als „ruhige“ Darstellung des Handoffs; die Legende und die Liste tragen die Aussage.
- Tippflächen: Segment 44 px (34 sichtbar), Chips 44 px (36 sichtbar), (i) 44 px (20 sichtbar). Liste und Kacheln sind nicht interaktiv.
- Responsive: 320 px: Kacheln 2 × 2 mit 19-px-Werten, Distanz und Pace in Listenzeilen untereinander, Plotbreite 256 px; 390 px: 22-px-Werte, Zeilen einzeilig; 1280 px: Spalte bleibt 480 px zentriert, Plot 416 px. Der Kopf bricht (Segment unter den Titel) statt abzuschneiden; die Chips-Zeile erzeugt nie seitliches Scrollen der Seite (`#main` ist `overflow-x: hidden`, die Zeile scrollt in sich).
- Bewegung: nur 150-ms-Farbübergang an Chips (unter `prefers-reduced-motion` aus). Keine Diagramm-Animation.
- Sprache: kein Gedankenstrich; „–“ als Platzhalter und „−“ (Minus) als Vorzeichen sind erlaubt.

---

## 14. Screen-Ergänzungen: Plan und Konto (E7)

Optik: Handoff §5.6, Mockup P1 (abgenommen). CSS: derselbe Abschnitt „Verlauf + Plan (E7)“. Wiederverwendet: `sd-tabhead`, `sd-intro__sub`, `sd-display`, `sd-card*`, `sd-label`, `sd-pill`, `sd-split*`, `sd-kvlist`/`sd-kv`, `sd-rule`, `sd-notice*`, `sd-btn*`, `tone-*`. **Kein `style=`.** Die acht `style=`-Attribute des alten Plan-Tabs verschwinden: Zeitleiste (`flex`, `width`) wird 14.2, die Hilfsklassen `mt-*`, `fg-*`, `fs-11` entfallen.
Neu: `sd-goal*`, `sd-phasebar*`, `sd-phase*`, `sd-zone*`, `sd-split__status`, `sd-notice--quiet`, `sd-kv dd.is-danger`.

### 14.0 Seitenaufbau

```html
<header class="sd-pagehead" data-region="pagehead">
  <div class="sd-tabhead">
    <div class="sd-tabhead__titles">
      <p class="sd-intro__sub">Woche 8 von 35 · 23&nbsp;% geschafft</p>
      <h1 class="sd-display" tabindex="-1">Trainingsplan</h1>
    </div>
  </div>
</header>
<div class="sd-main sd-main--tight">
  <section class="sd-card sd-goal" data-card="goal" aria-labelledby="goalTitle">…14.1 und 14.2…</section>
  <h2 class="sd-label">Phasen</h2>
  <ul class="sd-card sd-card--list sd-rows" role="list" data-card="phases" aria-labelledby="…">…14.3…</ul>
  <h2 class="sd-label">Trainingsbereiche</h2>
  <ul class="sd-card sd-card--list sd-rows" role="list" data-card="zones">…14.4…</ul>
  <h2 class="sd-label">Daten und Konto</h2>
  <section class="sd-card sd-card--loose" data-card="account">…14.5…</section>
</div>
```
- Kein Ladezustand (der Plan ist synchron da). Der Konto-Teil erscheint nur mit `currentUser` (wie bisher). Die Überschriften der Listen sind `<h2 class="sd-label">` (nicht `<p>`), die Listen tragen `aria-label` mit demselben Text.
- Der Zeilentext „Woche n von N · p % geschafft“ bleibt inhaltlich unverändert (`done = w - 1`); Leerzeichen vor „%“ ist ein geschütztes (`&nbsp;`), sonst bricht „23“ und „%“ auseinander. Die Tests (`includes("0% geschafft")`) sind entsprechend auf `" %"` umzustellen. Test-Haken statt `.eyebrow`: `#main > header.sd-pagehead .sd-intro__sub`.
- `h1` mit `tabindex="-1"` als Fokusziel nach Tab-Wechsel.

### 14.1 Ziel-Karte

```html
<section class="sd-card sd-goal" data-card="goal" aria-labelledby="goalTitle">
  <div class="sd-goal__top">
    <div class="sd-goal__main">
      <h2 class="sd-goal__label" id="goalTitle">Ziel · Halbmarathon</h2>
      <p class="sd-goal__time sd-mono">1:29:59</p>
    </div>
    <div class="sd-goal__race">
      <p class="sd-goal__k">Renntag</p>
      <p class="sd-goal__date sd-mono">02.05.2027</p>
      <p class="sd-goal__pace sd-mono">4:16 /km</p>
    </div>
  </div>
  <svg class="sd-phasebar" …>…14.2…</svg>
</section>
```
| Fall | Unterschied |
| --- | --- |
| Renndatum bestätigt (`raceDateConfirmed`) | wie oben, Label „Renntag“, Datum `germanDate(raceDate)` |
| Renndatum nicht bestätigt | Label „Rennen ca.“, Datum `monthLabel(raceDate)` (z. B. „Mai 2027“), nach dem Phasenbalken zusätzlich `<p class="sd-hint">Das Renndatum ist noch nicht bestätigt.</p>` |
| Kein `targetPace` | `sd-goal__pace` entfällt |
Titel: `Ziel · ${esc(goal.distance)}`; Zielzeit `esc(displayGoal.time)`; Pace `esc(targetPace)` + „ /km“, falls die Quelle die Einheit nicht schon trägt. Die Zielzeit ist fluid (32 bis 40 px über `cqi`); passt die rechte Spalte nicht daneben (320 px, lange Zeit), rutscht sie unter die Zeit und bleibt rechtsbündig.

### 14.2 Phasenbalken (Auflage C5, Entscheid E7)

```html
<svg class="sd-phasebar" viewBox="0 0 300 10" preserveAspectRatio="none" role="img" focusable="false"
     aria-label="Phasen über 35 Wochen: Phase 1 Basis, Woche 1 bis 8, läuft. Phase 2 Aufbau, Woche 9 bis 18. …">
  <rect class="sd-phasebar__seg sd-phasebar__seg--teal"   x="0"     y="0" width="72.8" height="10" rx="5"/>
  <rect class="sd-phasebar__fill"                         x="0"     y="0" width="63.7" height="10" rx="5"/>
  <rect class="sd-phasebar__seg sd-phasebar__seg--sky"    x="75.8"  y="0" width="91"   height="10" rx="5"/>
  <rect class="sd-phasebar__seg sd-phasebar__seg--amber"  x="169.8" y="0" width="…"    height="10" rx="5"/>
  <rect class="sd-phasebar__seg sd-phasebar__seg--purple" x="…"     y="0" width="…"    height="10" rx="5"/>
</svg>
```
**Mechanismus:** ein SVG, die Segmente sind `<rect>` mit Zahlen in `x`/`width`; Farbe über Klassen. Kein `style`, kein `flex`, keine Prozentbreite im Markup. Der Balken dehnt sich auf die Kartenbreite (256 bis 416 px), Höhe 10 px, Radius 5.

**Geometrie** (k = Anzahl Phasen, `len_i = to - from + 1`, `total = Σ len_i`, alle Werte durch `svgNum`):
- `usable = 300 - 3 * (k - 1)` (3 Einheiten Lücke)
- `w_i = usable * len_i / total`, `x_i = Σ_{j<i} (w_j + 3)`
- erledigte Wochen `d = w - 1` (wie die Kopfzeile „geschafft“); in Phase i `done_i = clamp(d - (from_i - 1), 0, len_i)`
- Füll-Rect (`sd-phasebar__fill`, Teal) direkt nach dem Segment: `x = x_i`, `width = w_i * done_i / len_i`; **nur zeichnen, wenn `width > 0`**. Erledigte Phasen sind damit ganz gefüllt, die laufende anteilig, spätere gar nicht; der Rand des Füll-Rects ist durch `rx` automatisch rund.
- Segmentfarbe `sd-phasebar__seg--${tone}` mit `tone` aus der Plan-Phase (`teal`, `sky`, `amber`, `purple`; `coral` ist angelegt). Ohne Modifier grau (`--track`).
- Vor Planstart: `d = 0`, kein Füllen. Nach dem Plan: alles gefüllt.
- Text-Alternative: `aria-label` nennt Gesamtwochen, jede Phase mit Name und Wochenbereich und markiert die laufende mit „läuft“. Die gleiche Information steht in 14.3 als Text.

### 14.3 Phasen

```html
<ul class="sd-card sd-card--list sd-rows" role="list" data-card="phases" aria-label="Phasen">
  <li class="sd-phase tone-teal is-current" role="listitem" aria-current="true" data-phase="1">
    <span class="sd-phase__num" aria-hidden="true">1</span>
    <span class="sd-phase__main">
      <span class="sd-phase__name"><span class="sd-vh">Phase 1: </span>Basis</span>
      <span class="sd-phase__sub">21.09.–15.11. · Grundlagenausdauer aufbauen</span>
    </span>
    <span class="sd-pill sd-pill--teal">läuft</span>
  </li>
  <li class="sd-phase tone-sky" role="listitem" data-phase="2"> … ohne Pill … </li>
</ul>
```
- Kachel 32 px Radius 10 in der Kategoriefarbe: `tone-${tone}` am `li` setzt `--tone`/`--tone-bg` (bestehende Klassen). `tone` nur aus der festen Liste `teal|coral|purple|sky|amber`.
- Zeile 2: `${esc(phaseRange(plan, p))} · ${esc(p.focus)}`, bricht um. Name `esc(p.name)`.
- Laufende Phase: `is-current` (Tönung `--teal-tint`), `aria-current="true"`, Pill `sd-pill sd-pill--teal` „läuft“ (getönt, keine zweite gefüllte Teal-Fläche). Außerhalb des Plans (vor Start, nach Ende) gibt es keine laufende Phase.
- Test-Haken: `.sd-phase` (Anzahl 4), `.sd-phase.is-current` (1), `.sd-phasebar__seg` (4), Farbklasse am `li` (`tone-*`) statt der alten `.phase-card`.

### 14.4 Trainingsbereiche

```html
<ul class="sd-card sd-card--list sd-rows" role="list" data-card="zones" aria-label="Trainingsbereiche">
  <li class="sd-zone tone-sky" role="listitem" data-zone="Z1">
    <span class="sd-zone__badge">Z1</span>
    <span class="sd-zone__main"><span class="sd-zone__name">Erholung</span><span class="sd-zone__use">Aufwärmen, Auslaufen</span></span>
    <span class="sd-zone__vals"><span class="sd-zone__hf">120–135 bpm</span><span class="sd-zone__pace">6:50–7:30 /km</span></span>
  </li>
</ul>
```
Z1 sky, Z2 teal, Z3 amber, Z4 coral, Z5 purple kommen über `tone-${z.tone}` aus den Plandaten. Badge, Name und Texte `esc(tag)`, `esc(label)`, `esc(z.use)`, `esc(z.hf)`, `esc(z.pace)`. HF steht Mono 12,5 über der Pace (Mono 11, gedämpft); die Zeile „Verwendung“ (`sd-zone__use`) bleibt aus der alten Karte erhalten (Abweichung vom Handoff, der sie nicht nennt; sie erklärt die Zone). Die Werte bleiben einzeilig (`nowrap`), der Name bricht um.

### 14.5 Daten und Konto

```html
<h2 class="sd-label" id="accountTitle">Daten und Konto</h2>
<section class="sd-card sd-card--loose" data-card="account" aria-labelledby="accountTitle">
  <div class="sd-split">
    <div class="sd-split__main">
      <p class="sd-split__title">Daten exportieren</p>
      <p class="sd-split__hint">Alle Trainingsdaten als JSON-Datei, ohne Zugangs- und Standortdaten.</p>
      <p class="sd-split__hint sd-split__status" id="export-status" role="status" hidden></p>
    </div>
    <button type="button" class="sd-btn" data-action="export-data">Export</button>
  </div>
  <hr class="sd-rule" />
  <dl class="sd-kvlist">
    <div class="sd-kv"><dt>Angemeldet als</dt><dd>${esc(email)}</dd></div>
    <div class="sd-kv" data-slot="strava-status"><dt>Strava</dt><dd>verbunden · Sync heute 07:12</dd></div>
    <div class="sd-kv" data-slot="plan-source"><dt>Plan</dt><dd>Plandatei · Version 3</dd></div>
  </dl>
  <!-- Strava-Aktion nur bei „nicht verbunden“ / Fehler, siehe Tabelle -->
  <hr class="sd-rule" />
  <p class="sd-hint">Abmelden räumt dieses Gerät: lokale Kopien und der Offline-Speicher werden gelöscht. Nicht übertragene Einträge werden vorher gesendet.</p>
  <p class="sd-notice sd-notice--quiet" id="account-status" role="status" hidden></p>
  <div><button type="button" class="sd-btn sd-btn--danger" data-action="logout">Abmelden</button></div>
</section>
```
Ersetzt `renderExportCard()` und `renderAccountCard()` durch **eine** Funktion in `view-account.js`. Die UID entfällt auf dem Plan-Tab (sie bleibt nur in „Kein Zugriff“, A1).

**Strava-Zeile (`data-slot="strava-status"`)**

| Zustand | `<dd>` | zusätzlich unter der Liste |
| --- | --- | --- |
| Prüfung läuft (`connected === null`) | `wird geprüft …` | – |
| verbunden | `verbunden · Sync heute 07:12` (aus `lastFetchedAt`; anderer Tag: `Sync 20.10. 07:12`; ohne Zeitpunkt nur `verbunden`) | – |
| nicht verbunden | `nicht verbunden` | `<div><button type="button" class="sd-btn sd-btn--coral" data-action="connect-strava">Strava verbinden</button></div>` |
| Abruf-Fehler (`s.error`) | `class="is-danger"`: `Abruf fehlgeschlagen` | `<p class="sd-notice sd-notice--danger" role="alert">${esc(s.error)}</p>` und `<div class="sd-actions"><button type="button" class="sd-btn" data-action="reload-strava">Nochmal versuchen</button><button type="button" class="sd-btn sd-btn--coral" data-action="connect-strava">Neu verbinden</button></div>` |
| Worker fehlt | `nicht eingerichtet` | – (kein Button) |
Nach der Strava-Aktion folgt wie im Mockup ein `<hr class="sd-rule" />` vor dem Abmelden-Hinweis.

**Plan-Zeile (`data-slot="plan-source"`, Platzhalter für F1 / Login 1b Teil B):** reine Anzeige, **kein Button**. Text `Plandatei · Version ${esc(version)}`; ohne bekannte Version nur `Plandatei`. Kommt Teil B, rutscht „Plan aus Datei übernehmen“ als Sekundärbutton in diese Zeile.

**Export-Zustände** (`#export-status` ersetzt per CSS den Hinweis darüber, solange er sichtbar ist; Id und Textinhalt bleiben Test-Vertrag):

| Zustand | Text | Klasse am `#export-status` | Knopf |
| --- | --- | --- | --- |
| Ruhe | – (`hidden`, Hinweis sichtbar) | – | aktiv |
| läuft | `Lade Strava-Aktivitäten …`, `Lade Kraft-Logs und Zuordnungen …`, `Datei wird erstellt …` | – | `disabled` |
| fertig | `Export fertig.` | – | aktiv |
| unvollständig | `Exportiert, aber unvollständig: …` | `is-warn` | aktiv |
| Fehler | `Export fehlgeschlagen: …` | `is-danger` | aktiv |
| Teilen abgebrochen | leer, `hidden` | – | aktiv |
Der Knopf heißt in allen Zuständen „Export“. `setExportStatus(text, tone = "")` setzt zusätzlich `el.className = "sd-split__hint sd-split__status" + (tone ? " is-" + tone : "")`.

**Abmelden-Zustände** (`#account-status`, immer vor dem Knopf):

| Zustand | Text | Variante | Knopf |
| --- | --- | --- | --- |
| Ruhe | – (`hidden`) | – | aktiv |
| läuft | `Wird abgemeldet …` | `sd-notice sd-notice--quiet` | `disabled` |
| abgebrochen (offene Einträge) | `Abmelden abgebrochen. Es gibt noch nicht übertragene Einträge. Bitte mit Netz erneut versuchen.` | `sd-notice sd-notice--danger` | wieder aktiv |
| fehlgeschlagen | `Abmelden fehlgeschlagen: …` | `sd-notice sd-notice--danger` | wieder aktiv |
`setAccountStatus(text, tone = "")` setzt `el.className = "sd-notice " + (tone === "danger" ? "sd-notice--danger" : "sd-notice--quiet")`. Der Test sucht `includes("noch nicht übertragene")`: der neue Text enthält es weiter.

### 14.6 `data-action`-Namen auf Plan und Konto

Alle **bleiben** unverändert: `export-data`, `logout`, `connect-strava`, `reload-strava`, `forbidden-logout` (nur Login-Nebenscreen, E8). Neue Aktionen gibt es nicht. Stabile Test-Haken statt `.account-card`/`.export-card`/`.goal-card`/`.zone-line`/`.timeline`: `[data-card="account"]` (Anzahl 1), `[data-card="account"] [data-action="logout"]`, `[data-card="goal"]`, `.sd-phasebar__seg`, `.sd-phase`, `.sd-zone` (Anzahl 5), `[data-slot="plan-source"]`, `[data-slot="strava-status"]`, `#export-status`, `#account-status`.

### 14.7 `esc()`, Barrierefreiheit, Responsive

- **`esc()`** zusätzlich zu Abschnitt 6: `goal.distance`, `displayGoal.time`, `targetPace`, `phase.name`, `phase.focus`, `phaseRange()`, `z.zone`-Teile, `z.use`, `z.hf`, `z.pace`, `email`, `s.error`, Version, alle Status-Texte. **Nicht**: `svgNum()`-Werte im SVG, `tone`-Klassen (feste Liste), feste Strings, `germanDate()`/`monthLabel()`-Ausgaben.
- Überschriften: `h1` „Trainingsplan“, `h2` je Abschnitt (Ziel-Label, „Phasen“, „Trainingsbereiche“, „Daten und Konto“).
- Status nie nur Farbe: laufende Phase = Pill-Text + `aria-current` + Tönung; Export/Abmelden = Text; Strava-Fehler = Text „Abruf fehlgeschlagen“ plus Hinweiskarte.
- Tippflächen: alle `sd-btn` 44 px; Phasen und Zonen sind nicht interaktiv. Fokus: globales `:focus-visible`.
- 320 px: Zielzeit 32 px, rechte Spalte rutscht bei Platznot darunter; Export-Knopf rutscht unter den Hinweis (Flex-Wrap); Zeilen rücken auf 16 px Polster; Zonen-Werte bleiben einzeilig, der Name bricht um. 1280 px: Spalte 480 px zentriert.
- Bewegung: keine neue Animation.

### 14.8 Durch E7 überflüssig werdende alte Klassen (Löschliste, **nicht** vorab löschen)

Greppen vom Designer am Stand HEAD 71dcb51. Erst löschen, wenn `app.js` (`renderHistory`, `renderKraftHistory`, `renderRunHistory`, `barsHTML`, `renderPlan`), `view-account.js` (Konto/Daten-Karten) und `tests/app.test.mjs` (Z. 1198 bis 1240, 1607, 1823, 1881, 2106, 2151, 2561 bis 2568, 2716 bis 2753, 2941) umgebaut sind:
- Verlauf: `.seg` (+ `button`, `.on`; nicht zu verwechseln mit `.sd-seg`), `.bars`, `.bar-col`, `.bar`, `.bar-label`, `.bar-value`, `.list-row` (+ `span`), `.row` (nach Grep der übrigen Nutzer), `.center-note`, `.metric-grid`, `.metric-label`, `.metric-value`, `.metric-value.sm`, `.mt-*`, `.fg-secondary`, `.fg-muted`, `.fs-11` (jeweils nach Grep, `app.js` Z. 937/938 und `ui.js` nutzen `.center-note`/`.mt-8` noch).
- Plan: `.phase-card` (+ `.name`, `.hint`, `.is-current`), `.phase-head`, `.phase-weeks`, `.timeline` (+ `.seg`, `.seg i`), `.timeline-marker`, `.timeline-legend`, `.zone-row` (+ `.zone-vals`, `.tone-*`-Zusatz), `.zone-chip`, `.zone-line` (+ `.zname`, `.zvals`), `.goal-card`, `.goal-time`.
- Konto: `.card.account-card`, `.card.export-card`, `.account-logout`, `.export-btn`, `.small-btn`, `.danger-btn`. **Bleiben bis E8:** `.card.auth-card`, `.account-rows`, `.account-row` (Kein-Zugriff-Karte), `.primary-btn`, `.auth-*`, `.field*`, `.text-input`.
- **Bleiben auch nach E7:** `.tone-*` (neue Phasen und Zonen), `.badge` (`ui.js` `badge()`), `.card.error-card` (`ui.js` `errorCard()` in `app.js` Z. 919, 2349, 2529, 2576), `.link-btn` (`app.js` Z. 937), `.title-row`, `.eyebrow` (Z. 937/938, alter Tag-Kopf), `.primary-btn` (Login-Karten, E8).

---

## 15. Screen-Ergänzungen: Login und Nebenscreens (E8)

Quelle: Handoff §5.7, Mockup A1 bis A3 (`docs/mockup-stride-luecken.html`). **Nur Markup** (Auflage C10: keine Änderung an `signIn`, `authReady`, `accessState`, `authErrorText`, Abmelden), **kein `style=`** (C5). CSS: Abschnitt „Login (E8)“ in `style.css`. Die Bausteine `sd-auth`, `sd-auth__brand|name|tag|foot` stehen seit E1; neu in E8: `sd-field.is-invalid` (die Feldfehler-Zeile `sd-field__error` aus 15.1.4 wurde nicht gebaut und ist seit E9 aus dem CSS gelöscht), die Seitenkopf-Variante `:empty` und das Verhalten bei wenig Höhe.

### 15.0 Seitenaufbau und Seitenkopf

Jeder Gate-Screen (Anmelden, Kein Zugriff, offene Einträge, Warten, Fehler) hat dieselbe Gestalt:

```html
<header class="sd-pagehead" data-region="pagehead"></header>   <!-- leer, exakt "" -->
<div class="sd-auth">                                             <!-- einziges weiteres Kind von #main -->
  <div class="sd-auth__brand">…Marke, Name, ggf. Tagline…</div>
  <form|section class="sd-card" …>…</form|section>
  <p class="sd-auth__foot">…</p>                                  <!-- nur Login -->
</div>
```

- **Kein großer Titel „Anmelden“ im Seitenkopf.** Der Coder ruft auf allen Gate-Screens `setPageHead("")` mit **exakt leerem String** (kein Leerraum, kein Zeilenumbruch). `renderMain()` schreibt dann `<header class="sd-pagehead" data-region="pagehead"></header>`; CSS `.sd-pagehead:empty` reduziert ihn auf den Statusbar-Abstand (`env(safe-area-inset-top)`). Der Vertrag „`renderMain` ist der einzige Schreibweg“ bleibt erhalten.
- Folge für `showGate(title, html)`: der Parameter `title` entfällt (`showGate(html)`), weil kein Titel mehr gerendert wird. `init()` setzt statt `<h1>Trainingsplan</h1>` ebenfalls `setPageHead("")`.
- `#app.no-session` bleibt (blendet die Tab-Leiste aus). Zentrierung und Scrollen macht nur CSS: `.sd-auth` füllt die Resthöhe von `#main` und zentriert; ist der Inhalt höher (Tastatur, Querformat, 320 px mit Fehler), scrollt `#main`, nichts wird abgeschnitten.
- **Genau ein `h1` je Screen**: der Kartentitel (beim Login unsichtbar, `sd-vh`). Der Markenname „Stride“ ist ein `<p class="sd-auth__name">`, keine Überschrift.
- **Marke liegt auf `--bg`, nie in der Karte.** `stride-mark-dark.svg` hat eine #26262b-Kachel (Kartenfarbe); in der Karte wäre das Zeichen im Dunkelmodus unsichtbar. Darum steht der Markenblock immer über der Karte.

Markenblock (Hilfsfunktion `authBrandHTML(tagline = "")` in `view-account.js`):

```html
<div class="sd-auth__brand">
  ${markSVG(64)}
  <p class="sd-auth__name">Stride</p>
  <p class="sd-auth__tag">Trainingsplan, Strava-Läufe und Krafteinheiten an einem Ort.</p>   <!-- nur mit tagline -->
</div>
```
`markSVG(64)` aus `ui.js` bleibt unverändert (`sd-mark sd-mark--lg`, 64 px, `alt=""`). Die Tagline steht nur auf **Anmelden** und im **Warten**-Zustand (dort als Statuszeile statt Tagline, 15.4); „Kein Zugriff“, offene Einträge und Fehler haben nur Marke und Name.

### 15.1 Anmelden

Soll-Markup (Ruhe). `renderLogin({ email, error, notice, fieldErrors })`; die Fußnote ersetzt den alten Satz „Diese App ist privat. Anmelden geht nur mit dem Konto des Besitzers.“ (entfällt).

```html
<div class="sd-auth">
  ${authBrandHTML("Trainingsplan, Strava-Läufe und Krafteinheiten an einem Ort.")}
  <form class="sd-card" data-form="login" data-card="login" novalidate aria-labelledby="loginTitle">
    <h1 class="sd-vh" id="loginTitle">Anmelden</h1>
    <!-- optional: Hinweis (15.1.2) -->
    <div class="sd-field">
      <label class="sd-field__label" for="login-email">E-Mail</label>
      <input class="sd-input" id="login-email" type="email" name="email" autocomplete="username" inputmode="email"
        enterkeyhint="next" autocapitalize="none" autocorrect="off" spellcheck="false" required value="${esc(email)}" />
    </div>
    <div class="sd-field">
      <label class="sd-field__label" for="login-password">Passwort</label>
      <input class="sd-input" id="login-password" type="password" name="password" autocomplete="current-password"
        enterkeyhint="go" required />
    </div>
    <!-- optional: allgemeiner Fehler (15.1.3) -->
    <button type="submit" class="sd-btn sd-btn--primary">Anmelden</button>
  </form>
  <p class="sd-auth__foot">Registrieren ist in der App nicht möglich.</p>
</div>
```
Felder sind `div.sd-field` mit `label[for]` statt umhüllendem `label`, damit eine Feldfehler-Zeile **nicht** in den Label-Namen gerät (anders als die Kraft-Formulare, die keine Fehlerzeile je Feld haben). `form.elements.email` / `.password` und `button[type="submit"]` bleiben, die Submit-Logik ändert sich nicht.

**15.1.1 Zustände**

| Zustand | Auslöser (Code bleibt) | Markup-Unterschied zur Ruhe |
| --- | --- | --- |
| Ruhe | `showLogin()` | wie oben |
| Hinweis | `takeLogoutNotice()` liefert Text | Hinweis-Block 15.1.2 als erstes Kind der Karte (nach dem `h1`) |
| Senden | Submit-Handler setzt `disabled` | Knopf `disabled` (CSS 60 % Deckkraft), Form `aria-busy="true"`; Label optional „Anmelden …“ (Namensregel: bleibt sonst „Anmelden“) |
| Allgemeiner Fehler | `showLogin(email, authErrorText(code))` | Fehlerblock 15.1.3 zwischen Passwortfeld und Knopf; E-Mail bleibt gefüllt, Passwort leer |
| Feldfehler | Prüfung „leer“ vor dem Senden (siehe unten) | `.is-invalid` am `.sd-field`, `aria-invalid`, Fehlerzeile 15.1.4; kein allgemeiner Block |
| Offline | `auth/network-request-failed` | Allgemeiner Fehler mit dem bestehenden Text „Keine Verbindung. Das Anmelden geht nur mit Netz.“ (kein eigener Zustand, gleicher Block) |

Alle Fehlertexte kommen unverändert aus `access.js`; das Design ändert keinen Text. **Feldfehler** sind eine reine Anzeige-Variante der bestehenden Leer-Prüfung (`!email || !password`): Handoff-Beispiel „Bitte das Passwort eingeben.“. Der Coder darf die Prüfung in „E-Mail leer“ und „Passwort leer“ aufteilen („Bitte die E-Mail eingeben.“, „Bitte das Passwort eingeben.“; beide leer: beide Felder markiert). Das ändert nur den Text einer Client-Prüfung, nicht die Anmeldung; der Test „Bitte E-Mail und Passwort eingeben“ (30a) wird dann angepasst. Wird nicht aufgeteilt, bleibt der alte Satz als allgemeiner Fehler, beides ist gültig. Fehler aus Firebase sind **immer** allgemein.

**15.1.2 Hinweis „zweiter Tab“ (Abmelde-Hinweis, A3)**

```html
<p class="sd-notice sd-notice--amber" role="status" data-notice>${esc(notice)}</p>
```
Text unverändert aus `CACHE_KEPT_NOTICE`: „Abgemeldet. Der Offline-Speicher dieses Geräts konnte nicht geleert werden, weil die App noch in einem anderen Tab offen ist. Bitte alle Tabs der App schließen.“ Amber, weil es ein Zustand ist, kein Fehler. Steht über den Feldern, ist einmalig (verschwindet nach dem ersten Fehler-Rerender, wie bisher). Das Wort „zweiter Tab“ kommt in der UI **nicht** vor; die Rede ist von „einem anderen Tab“.

**15.1.3 Allgemeiner Fehler**

```html
<p class="sd-notice sd-notice--danger" role="alert" id="login-error" data-slot="login-error">${esc(error)}</p>
```
Nur rendern, wenn `error` nicht leer ist (nicht mehr als verstecktes `<p hidden>` vorhalten). Das Passwortfeld bekommt dann `aria-describedby="login-error"`. Danger-Fläche mit Text, nicht nur Farbe.

**15.1.4 Feldfehler** (Stand E9: nicht gebaut; geliefert wird nur der Ring `.is-invalid` plus `aria-invalid` am Feld und der allgemeine Fehlerblock 15.1.3. Das folgende Markup ist die verworfene Variante und bleibt als Referenz, falls Feldfehler je einzeln gezeigt werden sollen; dann `.sd-field__error` wieder anlegen.)

```html
<div class="sd-field is-invalid">
  <label class="sd-field__label" for="login-password">Passwort</label>
  <input class="sd-input" id="login-password" type="password" name="password" autocomplete="current-password"
    enterkeyhint="go" required aria-invalid="true" aria-describedby="login-password-error" />
  <p class="sd-field__error" id="login-password-error">Bitte das Passwort eingeben.</p>
</div>
```
Ring (1,5 px Danger) plus Text darunter. Für die E-Mail analog (`login-email-error`). Feldfehler und allgemeiner Fehler stehen nie gleichzeitig.

### 15.2 Kein Zugriff (A1)

```html
<div class="sd-auth">
  ${authBrandHTML()}
  <section class="sd-card" data-card="no-access" aria-labelledby="noAccessTitle">
    <div>
      <h1 class="sd-title sd-title--sm" id="noAccessTitle">Kein Zugriff</h1>
      <p class="sd-text">Dieses Konto ist für die App nicht freigegeben.</p>
    </div>
    <dl class="sd-kvlist">
      <div class="sd-kv"><dt>E-Mail</dt><dd>${esc(email || "unbekannt")}</dd></div>
      <div class="sd-kv"><dt>UID</dt><dd class="sd-mono">${esc(uid)}</dd></div>
    </dl>
    <button type="button" class="sd-btn sd-btn--primary" data-action="forbidden-logout">Abmelden</button>
  </section>
</div>
```
Die UID steht **nur hier**. Sie bricht an jeder Stelle um und lässt sich mit einem Tipp ganz markieren (`user-select: all`). Einzige Aktion: der teal Primärbutton „Abmelden“ (der einzige gefüllte teal Knopf auf dem Screen). `forbiddenLogout()` bleibt unverändert; ersetzt `accountRows()`.

### 15.3 Noch nicht übertragene Einträge (A2)

```html
<div class="sd-auth">
  ${authBrandHTML()}
  <section class="sd-card" data-card="pending-writes" aria-labelledby="pendingTitle">
    <div>
      <h1 class="sd-title sd-title--sm" id="pendingTitle">Noch nicht übertragene Einträge</h1>
      <p class="sd-text">Es gibt noch nicht übertragene Einträge. Bitte mit Netz erneut öffnen.</p>
    </div>
    <button type="button" class="sd-btn sd-btn--primary" data-action="retry-pending">Erneut versuchen</button>
  </section>
</div>
```
Kein Abmelden-Knopf (anonyme Altsitzung mit offenen Einträgen darf nicht abgemeldet werden). Der Titel enthält weiter „noch nicht übertragene“ (Testtext).

### 15.4 Warten: „Prüfe Anmeldung …“

Ersetzt `loadingCard("Anmeldung wird geprüft …")` in `init()` und `loadingCard("Einen Moment …")` in `handleAnonymousSession()`; beide über `renderGateWait(text)`:

```html
<div class="sd-auth" data-card="auth-wait">
  <div class="sd-auth__brand">
    ${markSVG(64)}
    <p class="sd-auth__name">Stride</p>
    <p class="sd-auth__tag" role="status">${esc(text)}</p>
  </div>
</div>
```
Texte: `Prüfe Anmeldung …` (init) und `Einen Moment …` (anonyme Altsitzung, unverändert). Keine Karte, kein Spinner, keine Animation: die Marke steht, der Text sagt, was passiert. Ein Wechsel zu Anmelden verschiebt die Marke leicht nach oben (Karte kommt dazu); das ist gewollt und ruhig genug. (Ändert den bisherigen Text „Anmeldung wird geprüft …“; in den Tests findet sich der alte Text nicht.)

### 15.5 Fehler beim Prüfen (Gate-Fehler)

Ersetzt `errorCard(err.message)` an den zwei Gate-Stellen (`authReady()` schlägt fehl; Abmelden der Altsitzung schlägt fehl). `errorCard()` in `ui.js` bleibt für die übrigen Stellen bis E9 unverändert.

```html
<div class="sd-auth">
  ${authBrandHTML()}
  <section class="sd-card sd-card--danger" data-card="gate-error" role="alert" aria-labelledby="gateErrorTitle">
    <div>
      <h1 class="sd-card__title sd-card__title--danger" id="gateErrorTitle">Problem</h1>
      <p class="sd-card__text sd-card__text--danger">${esc(message)}</p>
    </div>
    <button type="button" class="sd-btn sd-btn--onbanner" data-action="reload">Neu laden</button>
  </section>
</div>
```
Titel „Problem“ und Knopf „Neu laden“ behalten ihre Namen aus `errorCard()`.

### 15.6 `data-action`, Test-Haken, `esc()`

- **`data-action`** (alle unverändert): `forbidden-logout`, `retry-pending`, `reload`. Der Login ist ein Formular (`data-form="login"`, Submit-Ereignis), keine Aktion.
- **Test-Haken neu** (statt Layout-Klassen): `[data-card="login"]` (= das Formular), `[data-card="no-access"]`, `[data-card="pending-writes"]`, `[data-card="auth-wait"]`, `[data-card="gate-error"]`, `[data-slot="login-error"]`, `[data-notice]`, `#login-email`, `#login-password`, `.sd-auth__brand .sd-mark--lg` (Breite 64). Alt → neu für Szenarien 30a bis 30e und 32: `.auth-error` → `[data-slot="login-error"]`; `.auth-card` → `[data-card]` im `.sd-auth`; `.auth-brand .sd-mark--lg` → `.sd-auth__brand .sd-mark--lg`; Überschrift „Anmelden“ → `[data-card="login"] h1` (Text „Anmelden“, unsichtbar, `textContent` bleibt prüfbar); `#main > header.sd-pagehead h1` existiert auf diesen Screens **nicht mehr** (Kopf leer).
- **Zentrierungstest (30a):** nicht mehr „Karte“, sondern der Block aus Marke bis Fußnote. Raum oben = `brand.top - head.bottom`, unten = `main.bottom - foot.bottom`; das Polster ist bewusst asymmetrisch (oben 16, unten 32), erwartet |oben - unten| unter 32 und oben über 40 bei 390 × 844.
- **`esc()`** zusätzlich zu Abschnitt 6: `email` (Attribut `value="…"` und `dd`), `uid`, `error` (Firebase-Text über `authErrorText`, trotzdem escapen), `notice` (aus `sessionStorage`, also Fremdwert), `message` im Gate-Fehler, `text` in `renderGateWait`. **Nicht**: feste Strings (Tagline, Fußnote, Titel), `markSVG()`-Ausgabe, feste `id`s.

### 15.7 Barrierefreiheit

- Formular benannt über `aria-labelledby="loginTitle"` (unsichtbarer `h1`). Beide Felder haben ein sichtbares `label[for]`; Platzhalter ersetzen nie das Label.
- `autocomplete="username"` und `current-password` (Schlüsselbund), `type="email"` mit `inputmode="email"`, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`; `enterkeyhint` „next“/„go“. Felder 16 px (kein iOS-Zoom), 48 px hoch.
- Fehler: allgemeiner Fehler hat `role="alert"` und hängt per `aria-describedby` am Passwortfeld; Feldfehler hängen per `aria-describedby` an ihrem Feld, dazu `aria-invalid="true"` (nur im Fehlerfall). Die Feldfehlerzeile hat kein eigenes `role` (sie wird beim Fokus auf das Feld vorgelesen). Hinweis „anderer Tab“: `role="status"`.
- **Fokus nach dem Fehler-Rerender** (`showLogin` ersetzt das Formular, der Fokus ginge verloren): Coder fokussiert nach dem Rendern das erste Feld mit `aria-invalid="true"`, sonst das Passwortfeld. Beim Erstaufruf und beim Hinweis kein automatischer Fokus (Tastatur soll nicht aufspringen).
- Kontrast: Fließtext `--text-secondary`/`--text-muted` auf `--bg`, Fehler `--danger-fg` auf `--danger-bg` und `--card`, Hinweis `--amber` auf `--amber-bg` (nur bestehende Tokens aus Abschnitt 2, dieselben Paare wie in E3 bis E7; Hinweis hell liegt bei ca. 4,5:1, Orchestrator-Sichtprüfung im Dunkelmodus empfohlen). Status nie nur Farbe (Text im Block, Ring plus Zeile am Feld).
- Tippflächen: Felder 48, Primärbutton 50. Sichtbarer Fokus global (`:focus-visible`, Felder zusätzlich 2 px Teal). Keine Animation, nichts für `prefers-reduced-motion` nötig.

### 15.8 Responsive

- 320 bis 1280 px: Spalte 480 zentriert, Seite 24 px (mindestens die Safe Area). 320: Kartenbreite 272, Innenbreite 232; die Tagline (max. 280, `text-wrap: balance`) bricht auf drei Zeilen, nichts clippt. Hoch genug (mind. ca. 600) steht alles mittig, darunter scrollt `#main`.
- **Tastatur:** iOS verkleinert das Layout-Viewport nicht; der Browser schiebt das fokussierte Feld sichtbar (`scroll-padding-block: 24px` hält Luft am Rand). Android Chrome verkleinert `100dvh` erst mit `interactive-widget=resizes-content` im Viewport-Meta von `index.html` (offener Punkt, kein CSS). Bei weniger als 520 px Höhe schrumpfen Abstände und Marke (48 px), der Inhalt bleibt vollständig und scrollbar.
- Dunkelmodus: Marke (`stride-mark-dark.svg`) auf `--bg`, Karte `--card`, Felder `--sunk` (dunkler als die Karte); Autofill-Farben werden auf `--sunk` zurückgesetzt.

### 15.9 Durch E8 überflüssig werdende alte Klassen (Löschliste, **nicht** vorab löschen)

Erst löschen, wenn `view-account.js` umgebaut ist und `tests/app.test.mjs` (30a bis 30e, 32, Z. 2638 bis 2690) auf die Haken aus 15.6 zeigt:
- Login-Karten: `.card.auth-card` (+ `p.hint`), `#app.no-session #main > .auth-card`, `.auth-brand`, `.auth-brand-name`, `.field`, `.field-label`, `.text-input` (+ `:focus-visible`), `.auth-error` (+ `[hidden]`), `.auth-submit`, `.account-rows`, `.account-row` (+ `dt`, `dd`, `dd.account-uid`), `.primary-btn` (+ `:hover`, `:active`; einziger Rest-Verbraucher ist der Login, der Test `#hist-slot .primary-btn` erwartet 0).
- **Bleiben auch nach E8:** `.card`, `.card p.name`, `.card p.hint`, `.hint` (alte Detail-Kopf- und Hinweiskarten in `app.js` Z. 934 bis 960), `.card.notice`, `.card.error-card` (`errorCard()` in `ui.js`), `.center-note` (`loadingCard()`), `.mt-8` (`errorCard()`), `.link-btn`, `.title-row`, `.eyebrow`, `.badge`, `.tone-*`. Unbenutzte Utilities als E9-Kandidaten: `.mt-6`, `.mt-10`, `.jc-between`, `.gap-8`, `.w-full`.

### 15.10 Nachträge aus dem E7-Review

- **Ziel-Karte (Plan) bei 320 px:** Der Renntag-Block steht linksbündig (Label, Datum, Pace gemeinsam) unter der Zielzeit, wenn er umbricht; nebeneinander und rechtsbündig erst ab 375 px Spaltenbreite (`@container`). Markup aus 14.1 unverändert.
- **Tab-Kopf (Woche, Verlauf, Plan):** Seitenpolster `max(20px, env(safe-area-inset-left|right))`, Querformat mit Notch schneidet den Titel nicht mehr an.

---

## 16. Abschluss (E9)

Nur CSS und diese Doku; kein JS. `style.css` ging von 1340 auf 1250 Zeilen.

### 16.1 Gelöscht

- **Alte Anmeldung:** `.card.auth-card` (+ `p.hint`), `#app.no-session #main > .auth-card`, `#app.no-session #main` (Bodenpolster 16, vom `:has(> .sd-auth)`-Polster überstimmt), `.auth-brand`, `.auth-brand-name`, `.field`, `.field-label`, `.text-input` (+ `:focus-visible`), `.auth-error` (+ `[hidden]`), `.auth-submit`, `.account-rows`, `.account-row` (+ `dt`, `dd`, `dd.account-uid`), `.primary-btn` (+ `:hover`, `:active`).
- **Utilities:** `.mt-6`, `.mt-10`, `.jc-between`, `.gap-8`, `.w-full`.
- **Alte Karten:** `.hint`, `.hint.center`, `.card.notice p`, `.card.notice p.name` (alle Verbraucher stehen in `.card`, dort gilt `.card p.hint`).
- **Kopf:** `.sd-pagehead h1 .of`, `.sd-pagehead > .sd-brand` (die Marke liegt immer in `.sd-head`), die zweite `#main:has(...)`-Regel (Polster für einen alten Kopf in genulltem `#main`; trat nie mehr ein) und die toten Selektoren `.sd-intro, .sd-nav, .sd-head, .sd-dots, .sd-daytitle` in der ersten (direkte Kinder von `#main` sind nur Seitenkopf und `.sd-main` oder `.sd-auth`).
- **Marke:** `.sd-mark .m-bg|.m-a|.m-b` samt Tokens `--mark-bg|-a|-b` (hell und dunkel): das Zeichen ist ein `<img>`.
- **Tokens ohne Verbraucher:** `--border`.
- **Bausteine ohne Verbraucher:** `.sd-heading`, `.sd-block`, `.sd-main--flush` (+ `> .sd-label:first-child`), `.sd-intro--tight`, `.sd-actions--center`, `.sd-legend`, `.sd-tip--stall` (`progression.js` liefert kein `stall`), `.sd-field__error` (siehe 15.1.4), `.sd-tabbar` und `.sd-tab` samt `.is-active` (die Leiste ist `#tabbar button.active`).
- **Zusammengelegt:** drei verstreute `prefers-reduced-motion`-Blöcke zu einem; doppelte Deckkraft von `.sd-option[aria-disabled]`; veralteter `impeccable-disable side-tab`-Kommentar (kein farbiger `border-left` im CSS).

### 16.2 Bleibt, mit Verbraucher

| Regel | Verbraucher |
| --- | --- |
| `.card`, `.card p.name`, `.card p.hint`, `.card.notice` | `app.js` `renderDay()` Z. 945 bis 962 (Platzhalter, Bis zum Rennen, Kein Plan, Ruhetag), `ui.js` `errorCard()` |
| `.card.error-card` (+ `.name`, `p.hint`, `button`) | `ui.js` `errorCard()`; `app.js` Z. 916 und 2491 |
| `.center-note` | `ui.js` `loadingCard()`; `app.js` Z. 2461 und 2505 |
| `.mt-8` | `ui.js` `errorCard()` |
| `.sd-pagehead .eyebrow`, `.title-row`, `h1`; `.link-btn` | `app.js` `renderDay()` Z. 934 bis 942; `h1` auch Z. 915, 2490, 2504 |
| `.badge` | `ui.js` `badge()` via `app.js` `badgeForKind()` (nur `renderDay()`) |
| `--surface-1` | `app.js` `colorsFor()` Z. 160 |
| `.tone-teal|coral|purple|sky|amber` (+ `--sky-fg`, `--amber-fg`) | `view-plan.js` Z. 92 und 108 (Phasen-Nummer, Zonen-Badge) |
| `button`, `button:active`, `button:disabled` | alle Knöpfe ohne eigene Klasse (`errorCard`), `.sd-dots__seg`, `.sd-filter__chip` u. a. |
| `#header:empty` | `index.html` `<div id="header">` |

### 16.3 Safe Area

Alle Köpfe außerhalb von `.sd-main` tragen ihr Seitenpolster als `max(20px, env(safe-area-inset-left|right))`: `.sd-head`, `.sd-intro`, `.sd-weekhead`, `.sd-tabhead` (seit E8), `.sd-dots`, `.sd-daytitle`, `.sd-filter` (inkl. `scroll-padding-inline`), `.sd-sheet`. `.sd-nav`: `max(8px, …)`. `.sd-main` (12), `.sd-auth` (24), `#main` (1,25 rem) und `#tabbar` (12) hatten sie bereits. Innerhalb von `.sd-main` liegende Blöcke (`.sd-label`, `.sd-planhint`, Karten) erben sie über `.sd-main`.

### 16.4 Konsistenzprüfung gegen Handoff §3 und §4

Geprüft und in Ordnung: genau eine teal gefüllte Fläche je Screen (Heute: Training starten; Woche: Pill „Heute“; Kraft-Tag: Satz-fertig-Knopf, im Anpassen-Modus das eine offene Formular; Lauf, Verlauf: nur im Zustand „Strava fehlt“ ein Primärknopf; Plan: keiner; Gate-Screens: je einer). Koralle nur für Lauf und Strava, nie für Fehler (Fehler, verpasst, Abmelden: Danger). Radien (Pill 20, Feld 12, Knopf 14/16, Karte 22, Sheet 28, Tab-Leiste 32, Satz 16, Kachel 18). Tippflächen mindestens 44 (Dots und Info-Knopf über `::after`). Eingaben mindestens 16 px. Fokusring global für alle `button`, `a`, `input`, `select` und `[tabindex]`; kein sd-Baustein schaltet ihn ab, in Listen mit `overflow: hidden` liegt er innen.

Korrekturen in E9:
- **Bewegung:** `#toast` (Einblenden mit Verschiebung) fehlte unter `prefers-reduced-motion`; jetzt ein einziger Block am Dateiende, der auch `.sd-roundbtn`, `.sd-pillbtn`, Skeleton-Schimmer und die `:active`-Skalierung von `.sd-weekcard` führt.
- **Status nie nur Farbe:** `.sd-wd.is-missed` (verpasst) hatte nur Danger-Fläche und Ring; die Zahl ist jetzt zusätzlich durchgestrichen (und weiter „verpasst“ für Screenreader).
- **Tippfläche:** der Knopf „Neu laden“ in `errorCard()` war ein nackter `<button>` mit ca. 32 px; jetzt 44 px, Schrift 14/600, Fläche `--card` auf Danger.
- **Pressen großer Flächen:** `.sd-linkrow`, `button.sd-option`, `button.sd-nextrow` skalierten auf `:active` mit dem globalen `button:active` (3 %); jetzt nur Tönung, wie `.sd-day__row` und `.sd-statusrow`.
- **Fokus:** Überschriften mit `tabindex="-1"` (Fokusziel nach Seitenwechsel) zeigen keinen Ring mehr; sie sind kein Bedienelement.

### 16.5 Bewusste Abweichungen vom Handoff (alle abgenommen oder hier begründet)

- `--text-muted` hell **#767570** statt #8a897f (Louis 21.10.2026, 4,5:1).
- Stepper: Einheit **unter** dem Wert statt daneben (Umbruch bei 320 px).
- Offene Sätze zeigen den Wert in `--text-secondary`, nicht `--ink-faint` (Kontrast).
- Deload-Wochen im Kraft-Verlauf sind heller (`--teal-soft`); die Legende benennt sie mit Text, die Farbe trägt nicht allein.
- Range-Werte tragen Ampel-Form (Kreis oder Raute) und verstecktes Wort, nicht nur Farbe.
- `.sd-wd.is-missed` (verpasste Einheit in „Diese Woche“) ist im Handoff nicht vorgesehen.
- Fortschrittspunkte im Kraft-Tag: bei 320 px und acht Übungen ca. 31 px breit (44 px hoch); die Reihenfolge-Liste darunter ist die vollwertige Alternative. Aktuell, erledigt und offen unterscheiden sich nur über Farbe und `aria-current`/`aria-label`; die Zustandsformen (Ring, Haken) trägt die Liste.
- `.sd-btn--dashed` (Übung hinzufügen) hat Radius 22 (Karten-Optik), `.sd-pillbtn` 17 und `.sd-filter__chip` 18 (volle Rundung bei 34 und 36 px Höhe), Kleinteile (`.sd-tip`, `.sd-notice` 10; `.sd-zone__badge` 8).
- Aktive und erledigte Zustände von `.sd-seg__opt` unterscheiden sich über Fläche und Farbe (Standard-Muster eines Segment-Schalters), zusätzlich `aria-pressed`.

### 16.6 Offen für den Coder und Rest-Migration

1. **Genau ein `h1` je Screen.** Der Wartezustand `renderGateWait()` hat keinen: ein visuell verstecktes `<h1 class="sd-vh">Stride</h1>` als erstes Kind von `.sd-auth` ergänzen (der sichtbare Markenname bleibt `<p class="sd-auth__name">`). Der Übergangszustand `loadingCard("Plan wird geladen …")` (`startApp()`) hat ebenfalls keinen; er ist ein Sekundenzustand, darf aber mit `setPageHead('<h1 class="sd-vh">Stride</h1>')` einen bekommen.
2. **Der Tag ohne Einheit ist noch das alte Layout** (`renderDay()`: Ruhetag, Platzhalter, Bis zum Rennen, Kein Plan; erreichbar über die Zeile „Morgen“ auf Heute). Er nutzt Eyebrow, `h1` 24 px, `badge()` mit Inline-Style und `.card`; die übrigen Screens haben Display-Titel und sd-Karten. Empfohlenes Soll-Markup, danach fallen die Klassen aus 16.2 weg:

```html
<!-- setPageHead: showBack, sonst entfällt <nav> -->
<nav class="sd-nav" aria-label="Kopfzeile"><button type="button" class="sd-btn sd-btn--text sd-btn--back" data-action="back">${chevronLeft}${esc(label)}</button></nav>
<div class="sd-daytitle">
  <p class="sd-eyebrow sd-eyebrow--plain">Mo · 07.09. · heute</p>
  <h1 class="sd-display" tabindex="-1">Ruhetag</h1>   <!-- Woche N | Bis zum Rennen | Kein aktiver Plan -->
</div>
<!-- renderMain -->
<div class="sd-main sd-main--tight">
  <section class="sd-card sd-card--center" data-card="rest-day">
    <h2 class="sd-card__title">Details folgen</h2>   <!-- nur Platzhalter; sonst weglassen -->
    <p class="sd-card__text">Mobility, Foam Rolling, Beine hoch.</p>
  </section>
</div>
```
   Die Badge entfällt (der Titel nennt den Zustand schon). Texte unverändert: „Mobility, Foam Rolling, Beine hoch.“, „Der Plan endet vor dem Renntag, für diesen Tag gibt es keine Einheit mehr.“, „Für dieses Datum liegt kein Trainingsplan vor.“, Platzhalter: `${info.focus} — die genauen Werte tragen wir nach der Re-Kalibrierung nach.`
3. **`errorCard()` und `loadingCard()`** analog: `errorCard` als `sd-card sd-card--danger` mit `h1`-losem Titel „Problem“ und `sd-btn sd-btn--onbanner` „Neu laden“ (wie `renderGateError`, 15.5); `loadingCard` als `<p class="sd-hint sd-hint--center" role="status">`. Sind 2 und 3 umgesetzt, **löscht man**: `.card*`, `.card.notice`, `.card.error-card*`, `.center-note`, `.mt-8`, `.link-btn`, `.badge`, `.sd-pagehead .eyebrow|.title-row|h1`, die Basisregel `.sd-pagehead` ohne `:has` (Padding für den alten Kopf), `--surface-1` und das globale `button`-Grundstil (nur `button:active`/`:disabled` bleiben, wenn noch ein nackter Knopf existiert). `.tone-*` bleiben (Plan).
