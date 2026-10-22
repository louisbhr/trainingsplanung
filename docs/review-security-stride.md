# Security-Review Stride-Redesign (Pipeline-Schritt 11)

Stand: 22.10.2026, Branch `stride-redesign`, HEAD 9289c5f, Diff `a6e6c4b...HEAD`.
Modus: nur Bericht (parallel läuft Reviewer mit Coder-Fix-Schleife).

Ergebnis: 0 Critical, 0 High, 0 Medium, 2 Low.

## Findings

### Critical / High / Medium
Keine.

### Low

**L1: `shortDate(run.date)` ohne `esc()` mit Strava-Datum** (`view-run.js:193`, `view-run.js:322`, `view-history.js:163`, `view-history.js:187`)
`run.date` kommt aus `mapActivity` (`strava.js`, `start_date_local.slice(0,10)`) und wird in `shortDate()` nur zerschnitten (`ui.js:76`), nicht escaped. Strava liefert dort ein ISO-Datum, die Quelle ist die eigene, authentifizierte Worker-/Strava-Kette; ein Angriff bräuchte kompromittierte Strava-Daten. Ausnutzbarkeit praktisch null, aber das einzige Remote-Feld im Rendering ohne Escape oder Formprüfung.
Empfehlung: in `mapActivity` auf `/^\d{4}-\d{2}-\d{2}$/` prüfen (sonst Aktivität verwerfen) oder `shortDate()` mit `esc()` umhüllen. Dasselbe für `startTime` ist unkritisch, das läuft über `esc(name)`.

**L2: `docs/mockup-stride-luecken.html` ist ausführbar und liegt auf der Pages-Origin** (Zeile 1518, Inline-`<script>`)
Die Prototyp-Dateien in `docs/design-stride/` sind korrekt `.txt` (C7). Das E0-Mockup ist dagegen `.html` mit einem Inline-Skript und wird unter `/docs/mockup-stride-luecken.html` auf derselben Origin wie die App ausgeliefert. Das Skript ist statisch, nimmt keine Eingaben und lädt nichts Externes (keine URLs); gleiche Lage wie das bereits auf main liegende `mockup-dashboard-v2.html`. Kein aktueller Schaden, aber ein Skript auf der App-Origin ist vermeidbar.
Empfehlung: bei Gelegenheit auf `.html.txt` umbenennen oder das Skript auslagern; kein Blocker.

## Geprüft, unauffällig

- **XSS**: Alle `innerHTML`-Stellen (`app.js:82,95,185,1022,1679,1704,1737,1991,2054`, `ui.js:204`) bekommen HTML aus den view-Modulen. Dort laufen Strava-Name (`view-run.js:190,325,330`), Pace-Label, Coach-Text und Wochenbilanz (`view-dashboard.js:200,208,212`), Fehlerbanner-Meldungen (`:41`), E-Mail/UID (`view-account.js`), Notice und Login-Fehler (`:70,75`), Übungsnamen inkl. eigener/ersetzter (`view-kraft.js:201,232,326,357,358`, Formularwerte `esc(form.name)`), Plan-JSON-Strings (`view-plan.js:58,69-111`) und Info-Sheet-Texte (`ui.js:206`) durch `esc()` (deckt `& < > " '`). `aria-label` mit `vm.name` (`view-kraft.js:48`) wird erst beim Einsetzen escaped.
- **Zahlen in SVG/Attributen**: Balken, Phasenleiste und Range-Bars laufen durch `svgNum()` (`Number.isFinite`, gerundet), `pct()` (`view-run.js:21`, auf 0 bis 100 geklemmt) und `numAttr()` (`ui.js:72`, nie negativ); `barRects` liefert berechnete Zahlen. `Number(weekN)` bei der Wochenbilanz. Eigene dynamische `data-*`-Attribute (`data-source`, `data-action`, `data-info`) stammen aus festen Konstanten.
- **Entwurf (hm-tracker.kraftDraft.<Datum>)**: `parseDraft` (`kraftflow.js:~250`) prüft Version, Typen, `Object.hasOwn`, übernimmt nur Slugs der aktuellen Übungsliste (kein `__proto__`/`constructor`-Durchgriff), Zahlen endlich und 0 bis 1000, höchstens 8 Sätze, `doneSets` ganzzahlig und begrenzt; jeder Formfehler verwirft den Entwurf, die Funktion wirft nie. `serializeDraft` schreibt nur bekannte Felder. Inhalt sind nur kg/Wdh/Fokus-Slug, keine Geheimnisse. Schlüsselpräfix `hm-tracker.` wird beim Abmelden geräumt (`firebase-init.js:180-182`); Entwürfe älter als 7 Tage werden beim Start gelöscht (`app.js:1161`). `draftKey()` verlangt ein ISO-Datum.
- **sessionStorage-Hinweis**: fester Text (`CACHE_KEPT_NOTICE`), beim Lesen escaped gerendert.
- **Öffentliches Repo**: Die UID `gH4Te1JZzaO7DVoTSg9TtK4gw8p1` steht in genau denselben vier Dateien wie auf `a6e6c4b` (`config.js`, `firestore.rules`, `tests/worker.test.mjs`, `wrangler.toml`), nirgends neu (auch nicht in `docs/`, Memory, Prototypen). Keine Gmail-Adresse und keine Tokens/Secrets in getrackten Dateien (Treffer nur Google-JWK-URL und Noreply). Kein `.private`/`.env` getrackt. Der Firebase-`apiKey` ist der unveränderte, öffentliche Web-Key.
- **Prototypen/Docs**: `docs/design-stride/*.txt` enthalten Beispieldaten, keine Kennungen (grep auf UID, gmail, AIza, Bearer, sk-, secret ohne Treffer); externe `unpkg`-Erwähnungen stehen nur als Text im Architektur-Review.
- **Schriften**: SHA-256 stimmt mit `HANDOFF.md` überein (Geist `9ce2d978…cbd6`, GeistMono `119f3e15…27f7`, OFL `c683bfbc…ac46c90`). Selbst gehostet.
- **Externe Ressourcen**: `index.html` und `style.css` enthalten keine `http(s)://`-URLs, kein CDN, keine Google Fonts; einziges `<script>` ist `app.js` (Modul, same-origin); `style.css` hat keine `url()` außerhalb `fonts/`. Manifest und Icons unauffällig.
- **Unveränderte Sicherheitsdateien (C10)**: `firestore.rules`, `worker.js`, `wrangler.toml`, `access.js` im Diff ohne Änderung. `firebase-init.js` nur Versionsstempel, keine neuen Exporte. `config.js` nur neuer `THRESHOLDS.lauf.zuKurz`.
- **Worker-URL-Override (früherer High-Fund)**: kein Rückfall. `config.js` ignoriert `?worker=` und gemerkten Wert außerhalb von localhost/127.0.0.1 und löscht den alten Wert (`config.js:20-30`); Diff berührt diesen Teil nicht.
- **Unsichere Muster**: kein `eval`, `new Function`, `document.write`, `insertAdjacentHTML`, `outerHTML` in den App-Modulen. `CSS.escape` in `ui.js:130` korrekt für Selektoren.
- **Abhängigkeiten**: `package.json` nur Beschreibung und Testskripte, `package-lock.json` unverändert, keine neuen Pakete. `npm audit --omit=dev`: 0 Schwachstellen.
