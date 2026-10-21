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
| Geometrie | Einzige erlaubte Inline-Form: **CSS-Custom-Property mit geklemmter Zahl**, z. B. `style="--pct:27"`. Erlaubt sind `--pct`, `--from`, `--to`, `--at` (jeweils 0 bis 100, höchstens eine Nachkommastelle, ohne Einheit). Nie Text aus Daten im `style`. **Seit E3 gilt für reine Fortschrittsbalken stattdessen `<progress class="sd-prog" value max>` ganz ohne `style` (Abschnitt 9.0).** Die `style`-Form bleibt nur für `sd-range` (Lauf-Tag, E6) übrig, solange es dafür keine Alternative gibt. |
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
| `--mark-bg` / `--mark-a` / `--mark-b` | #0f6e56 / #fff / #e0673d | #26262b / #5fcfa7 / #ef8f61 | Farben des Zeichens (nur wenn es inline gerendert wird) |

**Neu gegenüber dem Handoff (Designer-Ergänzungen):** `--danger-ink`, `--purple-line`,
`--purple-soft`, `--sky-soft`, `--amber-soft`, `--teal-soft`, `--primary-hover`, `--seg`,
`--tab-shadow`, `--sheet-shadow`, `--backdrop`, `--mark-*`. Die Phasenbalken im Plan nehmen
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
```html
<nav class="sd-tabbar" aria-label="Hauptnavigation">
  <button type="button" class="sd-tab is-active" aria-current="page" data-tab="dashboard">${icon}<span>Heute</span></button>
  <button type="button" class="sd-tab" data-tab="week">${icon}<span>Woche</span></button>
  <button type="button" class="sd-tab" data-tab="history">${icon}<span>Verlauf</span></button>
  <button type="button" class="sd-tab" data-tab="plan">${icon}<span>Plan</span></button>
</nav>
```
Die Icon-Pfade stehen in der `TABS`-Liste im Mockup-Skript (und heute in `index.html`). In der App ist die Leiste fixiert an der 480-px-Spalte
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
| L3 | Range-Balken | `sd-range`, `sd-range__track[style="--from:…;--to:…;--at:…"]`; neutral: `sd-range__note` statt Spur; frei: nur `sd-range__head` |
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

- **E3 Heute:** erledigt, siehe Abschnitt 9 unten (Kopf, Banner, Heute-Karten, Coach, Status, Diese Woche, Info-Sheet-Blöcke).
- **E4 Woche:** erledigt, siehe Abschnitt 10 (Kopf mit Rundtasten, Summen-Karte, Tageszeilen-Akkordeon).
- **E5 Kraft-Tag:** Design erledigt, siehe Abschnitt 11 (Kopf, Dots, Jetzt-Karte, Sätze, Stepper, Reihenfolge, Strava-Zeile, Ladefehler, Anpassen-Modus E5b, Löschliste 11.14).
- **E6 Lauf-Tag:** Zustände Zukunft, Strava fehlt, ignoriert (aus dem Prototyp, offen).
- **E7 Verlauf und Plan**, **E8 Login:** offen.

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
| Chip | `<p class="sd-tip sd-tip--${level}">` mit `level` aus `progressionChip()`: `up` (teal, „Heute 62,5 kg“), `hold` (sky, „60 kg halten“), `down` (amber, „Heute 57,5 kg“), `info` (nur `sd-tip`, neutral, „Deload, 72,5 kg“). `sd-tip--stall` (amber, „Seit 2 Einheiten ohne Steigerung“) ist als Variante vorhanden, falls der Coder die Stagnation getrennt zeigen will. **Kein Chip ohne Vorschlag** (Element weglassen). Text durch `esc()` |
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
