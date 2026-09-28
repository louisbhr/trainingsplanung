# Markup-Referenz: Dashboard v2 (D0)

Für den Coder (M2-4 bis M2-11). Alle Klassen liegen bereits in `style.css`
(Abschnitt „Dashboard v2 (D0)“ am Dateiende plus die Erweiterungen an
`:root`, `#main`, `.card`, `.badge`, `.title-row`). **Kein neues CSS
nötig** — wenn eine Stelle in `style.css` fehlt, bitte beim
frontend-designer nachfragen statt selbst Klassen zu erfinden oder Inline-
Styles zu ergänzen (Review-Minor M5, `docs/review-code-m1.md`).

Konventionen in diesem Dokument:
- `${esc(...)}` = Text muss durch `esc()` (oder `textContent`) laufen —
  kommt aus Plandaten, Log-Namen oder (bei Coach/Wochenbilanz) von der KI.
- `${...}` ohne `esc` = rein clientseitig berechneter, bereits fester Wert
  (Zahl, vorformatiertes Datum, ISO-String) ohne Nutzereingabe/KI-Text.
- `data-action="…"` folgt der bestehenden Konvention aus `app.js`
  (**ein** delegierter Click-Handler auf `#app`, `e.target.closest(
  "[data-action]")`). Die hier vorgeschlagenen Namen sind Vorschläge für
  Konsistenz — der Coder entscheidet die endgültige Wortwahl/Verdrahtung.
- Inline `style="…"` ist nur für **berechnete Geometrie** in Ordnung
  (Balkenhöhen in px, Prozentbreiten, SVG-Koordinaten, Badge-Farbe über
  `.tone-*`) — nie für statisches Layout (Abstände, Zentrierung). Das
  Muster gibt es im bestehenden `app.js` schon (`app.js:1009`,
  `app.js:1043`) und wird hier fortgeführt, nicht neu erfunden.

---

## 0. Icons

`check`, `prev`, `next` existen bereits in der `ICONS`-Map in `app.js`
(werden 1:1 weiterverwendet). Neu für `ui.js`/die bestehende Map — **alle
mit `stroke-linecap="round"` auf dem `<svg>`, damit kein neues D5
wiederholt wird**:

```js
chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
chevronDown:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
chat:  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16v11H9l-4 4V5z"/><path d="M8 9h8M8 12.5h5"/></svg>',
info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/></svg>',
warn:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3.5 2.5 20.5h19L12 3.5z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="17.1" r="1.2" fill="currentColor" stroke="none"/></svg>',
missed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4"/></svg>',
dash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3.2 3.2"/></svg>',
close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
```

Jedes injizierte Icon braucht am Verwendungsort eine **Größenregel, die
das tatsächliche `<svg>`-Element trifft** — nie ein rohes `<svg>` ohne
Größenvorgabe in einer Flex-Zeile mit einem `flex:1`-Geschwister (das war
schon einmal ein Bug, siehe D5 und der Kommentar bei `.status-icon` in
`style.css`). Zwei gültige Muster, je nach Stelle in `style.css`:
1. **Deszendenten-Selektor auf `svg`** (`.info-btn svg`, `.ex-row svg`,
   `.bilanz-toggle svg`, `.week-nav button svg`) — das Icon einfach direkt
   einsetzen, kein Wrapper nötig, die Klasse muss nicht auf dem `<svg>`
   selbst sitzen.
2. **Gerahmter Wrapper mit eigener Box** (`.status-icon` in der
   Wochen-Tab-Tagesliste) — dort sitzt die Größe auf einem `<span
   class="status-icon">`, das Icon liegt als Kind darin, und
   `.status-icon svg { width:100%;height:100% }` skaliert es hinein. Nur
   dieses eine Muster braucht den Wrapper; die anderen Stellen brauchen
   **keinen** zusätzlichen Wrapper (siehe Coach-Karte, Abschnitt 3).

---

## 1. Kopfzeile Dashboard (F2)

```html
<div id="header">
  <p class="eyebrow">${dayLongDE(iso)}, ${dayNum}. ${monthNameDE}</p>
  <div class="title-row">
    <h1>Woche ${n} · ${esc(weekType)}</h1>
    <span class="badge tone-${phaseTone}">Phase ${phaseN} · ${esc(phaseName)}</span>
  </div>
  <p class="countdown">${countdownText}</p>
</div>
```

- Ohne aktiven Plan (F7): `<span class="badge">Ohne Plan</span>` (keine
  `tone-*`-Klasse → `.badge` fällt auf `--surface-1`/`--text-secondary`
  zurück, siehe `style.css`).
- `countdownText`:
  - `raceDateConfirmed: false` → „Rennen ca. Mitte April 2027 · Datum
    offen“ (Monat aus `raceDate` ableiten, kein Gedankenstrich).
  - `raceDateConfirmed: true`, nicht letzte Woche → „Noch X Wochen bis
    zum Rennen“.
  - letzte Planwoche → „Noch X Tage“.
  - nach Planende → „Rennen am TT.MM.JJJJ“ (vergangenes Datum) oder
    „Kein aktiver Plan“ in der `h1`-Zeile statt „Woche N“.
- `phaseTone` ist eine der bestehenden `.tone-*`-Klassen
  (`teal`/`coral`/`purple`/`sky`/`amber`) — nicht neu erfinden, Zuordnung
  Phase → Ton legt der Coder fest (analog Plan-Tab).

---

## 2. „Heute dran“ (F4)

Basis ist `.card` + `.today-card` + eine Typ-Klasse
(`k-kraft`/`k-lauf`/`k-long`/`k-ruhe`/`k-noplan`).

### Kraft

```html
<div class="card today-card k-kraft">
  <div class="top">
    <div>
      <p class="eyebrow2">Heute dran</p>
      <p class="name2">${esc(session.label)}</p>
      <p class="sub">${exerciseCount} Übungen · ${esc(setInfo)}</p>
    </div>
    <button type="button" class="start-btn" data-action="toggle-today-exercises"
      aria-expanded="false" aria-controls="todayExList">Starten</button>
  </div>
  <div class="ex-list" id="todayExList">
    <div class="ex-list-head"><span class="ex-progress">${done}/${total} geloggt</span></div>
    <button type="button" class="ex-row" data-action="open-day" data-date="${iso}">
      <span class="exn">${esc(ex.name)}</span>
      <span class="exs">${esc(ex.soll)}</span>
      ${ICONS.chevronRight}
    </button>
    <!-- … eine .ex-row je Übung … -->
    <p class="ex-hint">Tippen auf eine Übung öffnet die bestehende
      Kraft-Tagesansicht (Sätze, Anpassen, Progressionsvorschlag).</p>
  </div>
</div>
```

Toggle-Button: Label wechselt „Starten“ ↔ „Schließen“, `aria-expanded`
mitführen. `.ex-list.open` zeigt die Liste (Klasse setzen/entfernen,
kein Inline-`display`).

### Lauf / Long Run

```html
<div class="card today-card k-lauf"><!-- k-long für Long Run -->
  <p class="eyebrow2">Heute dran</p>
  <p class="name2">${esc(session.type)} ${esc(session.dist)}</p>
  <p class="sub">Ziel-Pace ${esc(session.pace)} · HF-Zone ${esc(session.hf)}</p>
  <!-- Nach dem Lauf: Ist-Werte statt/zusätzlich zur sub-Zeile, gleiches
       Muster wie die bestehende Kraft-/Lauf-Tagesansicht (metric-grid) -->
</div>
```

Solange Strava noch lädt (Ist-Werte fehlen):

```html
<p class="sub loading-hint">Ist-Werte werden nach dem Lauf aus Strava geladen.</p>
<div class="skel skel-line" style="width:70%;height:10px;"></div>
```

### Ruhe

```html
<div class="card today-card k-ruhe">
  <p class="name">${esc(session.name)}</p> <!-- i. d. R. "Ruhe" -->
  <p class="hint">${esc(session.note)}</p> <!-- optional, z. B. "Mobility" -->
</div>
```

### Kein aktiver Plan (F7)

```html
<div class="card today-card k-noplan">
  <p class="name">Kein Plan aktiv</p>
  <p class="hint">Läufe werden weiter aus Strava gezeigt.</p>
  <p class="hint strava-fallback">Heute: ${esc(stravaRun.summary)} (aus Strava)</p>
</div>
```

### Platzhalterwoche (9–31 vor Ausformulierung)

Kein `.today-card`, sondern die bestehende `.card.notice`:

```html
<div class="card notice">
  <p class="name">Details nach Re-Kalibrierung</p>
  <p class="hint">Phase ${phaseN} · ${esc(focus)}</p>
</div>
```

---

## 3. Coach-Karte (F6)

```html
<div class="coach-card">
  <div class="head">
    ${ICONS.chat}
    <div class="body">
      <p class="label">Coach</p>
      <p class="text">${esc(dailyText)}</p>
    </div>
  </div>
  <!-- nur an Tagen mit Wochenbilanz-Inhalt: -->
  <div class="divider"></div>
  <!-- Montag, automatisch ausgeklappt: -->
  <p class="bilanz-heading">Wochenbilanz · Woche ${weekN}</p>
  <p class="bilanz-body">${esc(weeklyText)}</p>
  <!-- Di–So, eingeklappt: -->
  <button type="button" class="bilanz-toggle" data-action="toggle-bilanz"
    aria-expanded="false" aria-controls="bilanzBody">
    Wochenbilanz W${weekN} ${ICONS.chevronDown}
  </button>
  <div class="bilanz-body" id="bilanzBody" hidden>${esc(weeklyText)}</div>
</div>
```

Kurzform **„Wochenbilanz W3“** nur im eingeklappten Toggle-Text; die
ausgeklappte/automatische Überschrift bleibt „Wochenbilanz · Woche 4“
(volle Form). `hidden`-Attribut togglen, nicht `display` inline setzen.

Ladezustand (Coach wartet, Dashboard nicht):

```html
<div class="coach-card">
  <div class="head">
    ${ICONS.chat}
    <div class="body">
      <p class="label">Coach</p>
      <div class="skel skel-line" style="width:92%;"></div>
      <div class="skel skel-line" style="width:60%;"></div>
      <p class="note">Wird vorbereitet. Das Dashboard wartet nicht darauf.</p>
    </div>
  </div>
</div>
```

Ohne aktiven Plan (F7, kein API-Aufruf): gleiche `.head`-Struktur, `ICONS.info`
statt `ICONS.chat`, `.text` mit dem festen Hinweistext.

**Wichtig:** `${ICONS.chat}`/`${ICONS.info}` **direkt** einsetzen, nicht in
einen zusätzlichen `<span class="icon">…</span>` einpacken. Die Größe
kommt aus `.coach-card .icon` in `style.css`, und die `icon`-Klasse sitzt
in der `ICONS`-Map bereits **auf dem `<svg>`-Tag selbst**
(`chat: '<svg class="icon" …>'`). Eine zusätzliche Wrapper-`<span
class="icon">` würde nichts kaputt machen (der Selektor trifft dann auch
die `<svg>` direkt), ist aber unnötige Verschachtelung — und genau der
Fehlertyp aus D5/`.status-icon`: eine Größenregel muss die Klasse auf dem
tatsächlichen `<svg>`-Element treffen, nicht nur auf einem umgebenden
Element, sonst greift sie bei `<span>`/`<div>` mangels eigener Box gar
nicht.

---

## 4. Vier Ampeln (F5) + Info-Sheet (D1)

```html
<div class="ampel-grid">
  <div class="ampel-tile">
    <div class="row1">
      <span class="ampel-dot st-${status}"></span>
      <p class="title">Wochensoll</p>
      <button type="button" class="info-btn" data-action="open-info" data-info="wochensoll"
        aria-label="Erklärung: Wochensoll">${ICONS.info}</button>
    </div>
    <p class="detail">${esc(detailText)}</p>
  </div>
  <!-- gleiches Muster für "easy", "belastung", "kraft" -->
</div>
```

`status` ∈ `gruen|gelb|rot|grau` (Ampel-Punkt-Form kommt automatisch aus
`.st-*` in `style.css`, keine zusätzliche Klasse nötig). Ladezustand:

```html
<div class="ampel-tile">
  <div class="row1"><span class="ampel-dot st-loading"></span><p class="title">Wochensoll</p></div>
  <div class="skel skel-line" style="width:80%;"></div>
</div>
```

### Info-Sheet — ein gemeinsames Element in `#app`, analog `#toast`

Einmal ins App-Grundgerüst (z. B. `index.html` oder beim ersten Rendern
in `ui.js`), **nicht** pro Ampel neu erzeugen:

```html
<div id="infoBackdrop" class="info-backdrop"></div>
<div id="infoSheet" class="info-sheet" role="dialog" aria-modal="true"
     aria-labelledby="infoSheetTitle" hidden>
  <div class="info-sheet-handle"></div>
  <div class="info-sheet-head">
    <h2 id="infoSheetTitle"></h2>
    <button type="button" id="infoSheetClose" class="info-sheet-close"
      data-action="close-info" aria-label="Erklärung schließen">${ICONS.close}</button>
  </div>
  <div id="infoSheetBody" class="info-sheet-body"><!-- p-Tags per esc() befüllen --></div>
</div>
```

Öffnen: `hidden` entfernen, dann (nächster Frame) `.open` auf
Backdrop+Sheet setzen, Fokus auf `#infoSheetClose`. Schließen: `.open`
entfernen, nach der Transition `hidden` wieder setzen, Fokus zurück auf
den auslösenden `.info-btn`. Escape-Taste und Backdrop-Klick schließen
ebenfalls (`data-action="close-info"` auf beiden). Inhalte kommen aus
`THRESHOLDS`-Werten, nicht als fester Text — siehe F5/D1 im
Requirements-Dokument für den Wortlaut je Ampel plus „Aerobe Effizienz“.

---

## 5. „Im Detail“ (F8)

### Wochenvolumen Soll/Ist

**Wichtig:** eigener Namensraum `si-*`, nicht `.bars`/`.bar-col`/
`.bar-label` — die gehören schon dem Verlauf-Tab-Chart (andere Höhe,
andere Bedeutung) und würden hier falsche Werte erben.

```html
<p class="section-label">Im Detail</p>
<div class="card">
  <p class="name">Wochenvolumen · Soll vs. Ist</p>
  <div class="si-bar-legend">
    <span class="lg-item"><span class="lg-swatch lg-soll"></span>Soll</span>
    <span class="lg-item"><span class="lg-swatch lg-ist"></span>Ist</span>
  </div>
  <div class="si-bars">
    <div class="si-bar-col">
      <div class="si-bar-pair">
        <div class="si-bar-soll" style="height:${sollH}px"></div>
        <!-- nur wenn ist != null && ist > 0: -->
        <div class="si-bar-ist" style="height:${istH}px"></div>
      </div>
      <span class="si-bar-label${isCurrent ? ' current' : ''}">W${w}</span>
    </div>
    <!-- … eine .si-bar-col je Woche der aktuellen Phase … -->
  </div>
</div>
```

Platzhalterwochen: `.si-bar-soll` weglassen (kein falsches 0-Soll),
zukünftige Wochen: nur `.si-bar-soll`, kein `.si-bar-ist`. Ladezustand:
`.si-bar-ist.skel` statt der echten Ist-Höhe.

### Aerobe Effizienz

```html
<div class="card">
  <div class="aerobe-head">
    <span class="aerobe-title"><span class="name">Aerobe Effizienz</span>
      <button type="button" class="info-btn" data-action="open-info" data-info="aerobe"
        aria-label="Erklärung: Aerobe Effizienz">${ICONS.info}</button>
    </span>
    <p class="aerobe-delta ${good ? 'good' : 'bad'}">${esc(deltaText)}</p>
  </div>
  <p class="hint">Ø Pace bei Läufen mit HF in der Z2-Zone</p>
  <svg class="aerobe-chart" viewBox="0 0 300 60">
    <polyline points="${pts}" fill="none" stroke="var(--coral-fg)" stroke-width="2.5" stroke-linecap="round"/>
    <!-- je Punkt: <circle .../><text .../> mit fill="var(--coral-fg)"/"var(--text-muted)" -->
  </svg>
</div>
```

Nach Planende (F7) ist dies die **einzige** verbleibende Karte in „Im
Detail“ (kein `.section-label` „Im Detail“ + Rest weglassen, nur diese
eine Karte direkt nach den Ampeln/Ruhemeldung zeigen).

### Adhärenz 4 Wochen / Als Nächstes

Beide in einem bestehenden `.metric-grid`, mit der neuen `.metric-tile`
als Kachel-Hintergrund (Größen sind über `.metric-tile .metric-label`/
`.metric-tile .metric-value` in `style.css` bewusst größer als die
generischen `.metric-label`/`.metric-value` aus Verlauf/Kraft-Tagesansicht
— nicht die globalen Regeln ändern, das würde dort mitlaufen):

```html
<div class="metric-grid">
  <div class="metric-tile">
    <p class="metric-label">Adhärenz 4 Wo.</p>
    <p class="metric-value">${pct} %</p>
    <div class="metric-bar-track"><div class="metric-bar-fill" style="width:${pct}%"></div></div>
    <p class="metric-sub">${done} von ${planned} Einheiten</p>
  </div>
  <div class="metric-tile">
    <p class="metric-label">Als Nächstes</p>
    <p class="metric-sub">${esc(line1)}<br>${esc(line2)}<br>${esc(line3)}</p>
  </div>
</div>
```

---

## 6. Wochen-Tab (F9)

```html
<div id="header">
  <div class="week-nav">
    <button type="button" class="icon-btn" data-action="week-tab-prev"
      ${hasPrev ? "" : "disabled"} aria-label="Vorherige Woche">${ICONS.prev}</button>
    <div class="titles">
      <p class="t1">Woche ${n} · ${esc(weekType)}</p>
      <p class="t2">${esc(dateRange)}</p>
    </div>
    <button type="button" class="icon-btn" data-action="week-tab-next"
      ${hasNext ? "" : "disabled"} aria-label="Nächste Woche">${ICONS.next}</button>
  </div>
</div>
<div id="main">
  <div class="week-summary">
    <div class="line"><span class="lbl">Laufvolumen</span>
      <span class="val">${ist != null ? ist + " / " : ""}${soll} km</span></div>
    <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    <div class="line"><span class="lbl">Kraft</span>
      <span class="val">${done}/${planned} Einheiten</span></div>
  </div>

  <!-- Ruhetag: gleiche Außenmaße wie aktive Tage, nicht antippbar -->
  <div class="day-row rest">
    <div class="head">
      <div class="dcol"><p class="d">${d}</p><p class="dt">${dt}</p></div>
      <div class="mid"><p class="n">Ruhe</p></div>
    </div>
  </div>

  <!-- Aktiver Tag: eigener Button, antippbar -->
  <button type="button" class="day-row solid${isToday ? ' today' : ''}"
    data-action="toggle-day-detail" data-week-day="${i}"
    aria-expanded="false" aria-controls="dayDetail${i}">
    <div class="head">
      <div class="dcol"><p class="d" style="color:${kindColorVar}">${d}</p><p class="dt">${dt}</p></div>
      <div class="mid">
        <p class="n">${esc(sessionName)}</p>
        <p class="s">${hasActual ? "Ist: " + esc(actualText) : "Ziel: " + esc(targetText)}</p>
      </div>
      <!-- genau eins der folgenden je Status: -->
      <span class="status-icon" style="color:var(--ok-fg);">${ICONS.check}</span>
      <span class="status-icon" style="color:var(--amber-fg);">${ICONS.warn}</span>
      <span class="missed-pill">verpasst</span>
      <span class="today-pill">Heute</span>
      <span class="partial-pill">Heute · ${doneCount}</span>
      <span class="status-icon" style="color:var(--text-muted);">${ICONS.dash}</span>
    </div>
    <div class="day-detail" id="dayDetail${i}">
      <p><span class="muted">Ziel:</span> ${esc(targetText)}</p>
      <p><span class="muted">Ist:</span> ${esc(actualText)}</p>
      <p class="warn-text">${esc(noteText)}</p> <!-- z. B. "Zu schnell: HF über Z2" oder "nachgeholt" -->
      <p class="danger-text">Nicht geloggt, zählt als verpasst.</p>
    </div>
  </button>

  <p class="hint center">Plan beendet – zeigt Woche ${lastWeek}.</p>
</div>
```

`kindColorVar` ∈ `var(--teal-fg)` (Kraft) / `var(--coral-fg)` (Lauf) /
`var(--purple-fg)` (Long Run) / `var(--text-muted)` (Ruhe, ungenutzt da
Ruhetage keine Farbklasse brauchen) — das ist der einzige Fall, in dem
eine Farbe inline gesetzt wird, weil sie vom Einheitentyp der jeweiligen
Zeile abhängt (Datenwert, keine Layoutentscheidung). „Nachgeholt“-Hinweis
(über `assignRuns`) landet in `.day-detail p` wie jeder andere Hinweistext,
keine eigene Klasse nötig.

`.hint.center` (neu in `style.css`) statt Inline-`style="text-align:
center"`. Hinweis: dieser Wochen-Tab-Fußhinweistext ist im aktuellen
D0-Umfang noch keine feste Vorgabe aus dem Mockup, nur eine sinnvolle
Interpretation von F7 für den Wochen-Tab — beim Bauen gerne mit dem
frontend-designer kurzschließen, falls die tatsächliche Lösung anders
aussehen soll.

---

## 7. Prüfliste für Louis (im Browser, nicht von mir getestet)

- **Beide Farbschemata:** System hell und dunkel (macOS/iOS
  Darstellungsoptionen umschalten), auf jedem Tab.
- **Fensterbreiten:** 375px (iPhone SE), 390×844, 768px (Tablet-Breite),
  1280×720 (bekannter #main-Höhen-Bug, jetzt mit `#main > * {
  flex-shrink: 0; }` behoben — bitte gezielt bei kleiner Fensterhöhe
  nachprüfen, nicht nur Breite), und einmal sehr breit (Desktop) — nirgends
  seitliches Scrollen, kein Clipping.
- **Plan-Tab-Icon** in der Tableiste: die drei Punkte links neben den
  Linien müssen jetzt sichtbar sein (vorher unsichtbar, D5).
- **Soll/Ist-Balken** („Im Detail“ → Wochenvolumen): Soll (gedämpfter Ton)
  und Ist (kräftiges Teal) klar unterscheidbar, auch in Graustufen/ohne
  Farbsehen (Formen/Helligkeit reichen). Kontrast beider Balken gegen die
  Kartenfläche wirkt in beiden Farbschemata kräftig genug (nicht nur
  eyeballen — bei Zweifel mit einem Kontrast-Checker gegen `--surface-1`
  nachmessen, Ziel ≥ 3:1).
- **Info-Sheets:** an allen vier Ampeln und „Aerobe Effizienz“ per Klick
  UND per Tastatur (Tab zum Button, Enter öffnet, Escape schließt, Fokus
  kehrt zum auslösenden Knopf zurück) — an mindestens einer Stelle prüfen.
- **Ampel-Formen:** Kreis/Raute/Quadrat/Ring optisch unterscheidbar auch
  ohne auf die Farbe zu achten.
- **Wochenbilanz:** montags automatisch ausgeklappt sichtbar, an einem
  anderen Wochentag eingeklappt mit der Kurzform „Wochenbilanz W‹n›“ und
  per Tippen aufklappbar.
- **Kraft-Tagesansicht bleibt erreichbar:** von „Heute dran“ → Starten →
  eine Übung antippen → landet in der bestehenden Ansicht, zurück
  funktioniert.
- **Bestehende Tabs (Verlauf, Plan) unverändert:** kurz durchklicken, dass
  nichts optisch kaputt aussieht (Badges, Titel-Zeile mit `gap`, `.hint`
  außerhalb von Karten).
- **Tastatur-Fokusringe** überall sichtbar (Tab durch Ampel-Info-Buttons,
  Bilanz-Toggle, Wochen-Tab-Tage, Start-Button).
- **`prefers-reduced-motion`:** Skeleton-Schimmer und Bilanz-Chevron-Dreh
  ruhig/ohne Animation, wenn die Systemeinstellung aktiv ist.
