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
| Geometrie | Einzige erlaubte Inline-Form: **CSS-Custom-Property mit geklemmter Zahl**, z. B. `style="--pct:27"`. Erlaubt sind `--pct`, `--from`, `--to`, `--at` (jeweils 0 bis 100, höchstens eine Nachkommastelle, ohne Einheit). Nie Text aus Daten im `style`. |
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

- **E3 Heute:** Status-Zeilen, „Diese Woche“-Streifen, Kraft-Karte mit Vorschau, Info-Sheet-Blöcke (offen).
- **E4 Woche:** Kopf mit Rundtasten, Summen-Karte (offen).
- **E5 Kraft-Tag:** Feinheiten der Jetzt-Karte, Entwurf-Wiederherstellung (offen).
- **E6 Lauf-Tag:** Zustände Zukunft, Strava fehlt, ignoriert (aus dem Prototyp, offen).
- **E7 Verlauf und Plan**, **E8 Login:** offen.
