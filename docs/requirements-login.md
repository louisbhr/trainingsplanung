# Requirements: Echtes Login + Plan in Firestore (Schritt 1b)

**Status: ENTWURF — Louis' Fragen aus Runde 1b sind beantwortet; eine neue
Frage (L6, Plan-Änderungen nach der Übertragung) ist offen.** Umsetzung
direkt nach Dashboard v2 (Schritt 1), vor Schritt 2. Enthält Approval-Gates
(Security, Regeländerung, Firestore-Schema, ggf. Dependency).

Stand: 27.09.2026 · Entscheidungen Louis: Login ist nötig und wird aus
Schritt 2 herausgelöst; der Plan kommt in drei Stufen in die Datenbank,
**Stufe 2 gehört zu diesem Schritt**. REQUIREMENTS.md, Abschnitt 5 #7
(„Echtes Login“) wird damit umgesetzt; Abschnitt 4 „Anonyme Anmeldung —
kein echter Schutz“ entfällt danach.

---

## Feature Vision

Nur Louis kommt an seine Trainingsdaten, seinen Plan, seine
Strava-Verbindung und den Coach — auf iPhone und MacBook einmal
angemeldet, danach dauerhaft, ohne im Gym je wieder etwas tippen zu
müssen. Ab diesem Schritt liegt der Plan in Firestore.

## Warum jetzt (Ist-Zustand)

- `firestore.rules` erlaubt **jedem angemeldeten Nutzer** Lesen und
  Schreiben auf alles.
- `firebase-init.js` meldet **jeden Besucher** der öffentlichen
  Pages-URL automatisch anonym an (`signInAnonymously`).
- Die Zugriffsregeln sind damit deutlich zu offen, auch für gespeicherte
  Zugangsdaten (Details nur lokal in `.private/security-notes.md`).
- Ab Schritt 1 kommt `/coach` dazu, der Geld kostet.
- Plandaten kommen deshalb erst mit dem Login nach Firestore.

## User Stories

- Louis meldet sich einmal pro Gerät an (Safari auf dem iPhone, ggf. als
  Home-Bildschirm-App, und Safari auf dem MacBook) und bleibt angemeldet,
  auch offline im Gym.
- Ein fremder Besucher der URL sieht nur einen Anmelde-Bildschirm und kann
  weder Daten lesen noch schreiben noch den Coach auslösen.
- Louis verliert beim Umstieg keinen einzigen Eintrag.
- Louis' Plan liegt geschützt in Firestore; fällt Firestore aus oder fehlt
  das Dokument, läuft die App mit der Notfall-Kopie aus der Datei weiter.

## Functional Requirements

### L1. Anmeldung

- **Geräte (Louis, 27.09.2026):** Safari auf dem iPhone und Safari auf dem
  MacBook. Ob er auf dem iPhone die Home-Bildschirm-App nutzt, ist nicht
  bestätigt → **beide Varianten testen** (Safari-Tab und
  Home-Bildschirm-App im Standalone-Modus).
- **Reihenfolge der Methoden** (erste, die auf allen drei Varianten
  zuverlässig funktioniert, gewinnt):
  1. **Passkey** (Louis' Wunsch). **Firebase-Unterstützung für Passkeys
     gegen die aktuelle Doku prüfen — nicht annehmen.** Nur übernehmen,
     wenn es ohne eigenen Server geht (Cloudflare Worker ist erlaubt).
  2. **Google-Login** über Firebase Auth. Achtung: Die App läuft auf
     `louisbhr.github.io`, `authDomain` ist `…firebaseapp.com`;
     Redirect-/Popup-Anmeldung ist in Safari und in Home-Bildschirm-Apps
     wegen Speicher-Partitionierung bekannt heikel. Auf dem echten iPhone
     testen.
  3. **E-Mail + Passwort**, ausgefüllt aus dem iCloud-Schlüsselbund — von
     Louis als Fallback akzeptiert, **„falls es nicht anders geht“**, also
     nur, wenn 1 und 2 im Test scheitern.
- **Angemeldet bleiben:** dauerhafte Sitzung (Firebase-Standard
  `browserLocalPersistence`), keine erneute Anmeldung nach App-Neustart;
  ohne Netz startet die App mit der gespeicherten Sitzung und dem
  Firestore-Offline-Cache.
- **Kein Konto anlegen in der App:** Es gibt genau ein erlaubtes Konto.
  Meldet sich ein anderes Konto an, zeigt die App „Kein Zugriff“ und
  meldet es wieder ab.
- **Anonyme Anmeldung entfällt** im Code (`signInAnonymously` raus) und
  wird nach der Umstellung in der Firebase-Console deaktiviert.
- UI: schlichter Anmelde-Bildschirm vor der App; „Konto/Abmelden“ im
  Plan-Tab (selten gebraucht, deshalb nicht in der Tableiste). Fehler
  landen in der bestehenden Firebase-Fehlerkarte, nicht als
  Strava-Problem.

### L2. Firestore-Regeln an Louis' UID

- **Feste UID in den Regeln, keine Datenmigration.** Die Dokumente hängen
  heute an keiner UID (`logs/…`, `dayplans/…`, `runlinks/…`,
  `config/strava`, ab Schritt 1 `coach/…`, `coachweek/…`, ab hier
  `plans/…`). Deshalb reicht:

  ```
  allow read, write: if request.auth != null && request.auth.uid == "<LOUIS_UID>";
  ```

  Pfade und Daten bleiben unverändert; kein Umkopieren, kein Umschreiben
  von `app.js`-Pfaden. Die UID ist kein Geheimnis und darf im öffentlichen
  Repo stehen.
- Ergebnis zu „Migration“: **nicht nötig.** Bisherige anonyme Konten
  verlieren einfach ihren Zugriff; sie können in der Console gelöscht
  werden (optional).
- Künftige Sammlungen (Schritt 2: `plans/…/versions`, `projects/`,
  `wellness/`) fallen automatisch unter dieselbe Regel.

### L3. Reihenfolge der Umstellung (damit Louis sich nicht aussperrt)

1. App mit Login ausliefern, **Regeln noch offen** (Stand heute). Plan
   kommt weiter aus der Datei.
2. Louis meldet sich auf iPhone und MacBook an; die App zeigt die eigene
   UID (im Plan-Tab unter „Konto“).
3. UID in `firestore.rules` eintragen, committen, in der Firebase-Console
   veröffentlichen.
4. Prüfen: angemeldet funktioniert alles; in einem privaten Fenster ohne
   Login ist nichts lesbar.
5. Anonyme Anmeldung in der Console deaktivieren.
6. Strava-Zugriff widerrufen und neu verbinden (L5).
7. **Erst jetzt:** Plan einmalig nach Firestore übertragen (L6).

### L4. Worker prüft das Firebase-ID-Token

- **Jetzt, in Schritt 1b** — nicht erst in Schritt 2. Begründung: `/coach`
  existiert ab Schritt 1 und kostet Geld; der Origin-Check stoppt gezielte
  Anfragen nicht; mit echtem Login gibt es ab 1b erstmals ein Token, das
  Louis eindeutig identifiziert. Schritt 2 übernimmt den Mechanismus.
- Gilt für **alle** Worker-Endpunkte: `/coach`, `/exchange`, `/refresh`.
  Ohne gültiges Token oder mit fremder UID → 401.
- Prüfung: Signatur (RS256, Google-Schlüssel), `aud` = Firebase-Projekt-ID,
  `iss`, Ablaufzeit, `sub` = Louis' UID (als Worker-Variable, nicht im
  Code fest). Öffentliche Schlüssel cachen.
- Umsetzung vorzugsweise **ohne Bibliothek** über Web Crypto im Worker;
  falls doch eine Bibliothek (z. B. für JWT) sinnvoll ist → Dependency-Gate.
- Origin-Check, Schema-Prüfung und Ausgabenlimit aus Schritt 1 bleiben.

### L5. Strava-Token (Louis: ja, widerrufen und neu verbinden)

- Das bisherige Refresh-Token gilt vorsorglich als **nicht mehr
  vertrauenswürdig**. Nach L3.5: Zugriff der App bei Strava widerrufen
  (strava.com → Einstellungen → Meine Apps) und in der App **neu
  verbinden**. Das erzeugt neue Tokens, die nur noch Louis lesen kann.
- Speicherort bleibt `config/strava` in Firestore (jetzt durch die
  UID-Regel geschützt). Tokens in den Worker (KV) zu verlegen, sodass der
  Browser das Refresh-Token nie sieht, ist sauberer, aber mehr Aufwand →
  Backlog-Kandidat, nicht Teil von 1b.
- Das Strava-Client-Secret ist nicht betroffen (liegt nur im Worker).

### L6. Plan nach Firestore (Stufe 2 von 3)

Entscheidung Louis (27.09.2026): Stufe 1 (Schritt 1) hat die Plandaten in
`plans/hm-2027.json` getrennt. **Stufe 2 überträgt diese Datei einmalig
nach Firestore; ab dann lädt die App den Plan aus Firestore.** Nicht vor
dem Login, weil die Regeln heute jedem Besucher Schreibzugriff geben.

- **Ziel (schon in der Struktur von Schritt 2, damit dort nichts
  umgebaut werden muss):**
  - `plans/hm-2027` = Metadaten `{ activeVersion, updatedAt }`;
  - `plans/hm-2027/versions/{n}` = Plan-Objekt **unverändert im Format
    aus Schritt 1** (`schemaVersion: 1`) plus
    `{ source: "file", importedAt, fileVersion }`.
  Jede Übernahme aus der Datei legt eine neue Version an und setzt
  `activeVersion`; nichts wird überschrieben. Größe unkritisch (weit unter
  dem Dokument-Limit von Firestore; in der Planung gegen die tatsächliche
  Dateigröße bestätigen).
- **Übertragung:** in der App, als Aktion „Plan aus Datei übernehmen“ im
  Plan-Tab unter „Konto“, nur für den angemeldeten Louis. Kein
  Server-Skript, keine Service-Account-Schlüssel, keine neue Dependency.
  Die Aktion validiert die Datei vor dem Schreiben (gleiche Prüfungen wie
  `tests/plan.test.mjs`) und schreibt nichts Halbes.
- **Laden:** Die App lädt den Plan aus Firestore (mit Offline-Cache).
  **Fallback/Notfall-Kopie:** Fehlt das Dokument, ist es ungültig oder
  nicht lesbar, lädt die App `plans/hm-2027.json` und zeigt einen
  dezenten Hinweis „Plan aus Notfall-Kopie“. Die Datei bleibt im Repo.
- **Quelle der Wahrheit** nach der Übertragung: Firestore. Wie spätere
  Änderungen durch Claude Code (Wochen 9–31 falls nach 1b, Renndatum,
  Re-Kalibrierung) bis Schritt 2 nach Firestore kommen → **offene Frage
  1**.
- Tests: Laden aus Firestore, Fallback auf die Datei, Ablehnung einer
  ungültigen Datei beim Übertragen.

## Design & UX Requirements

- **Kein Mockup** für den Anmelde-Bildschirm (Louis, 27.09.2026); Abnahme
  direkt in der App.
- Anmelde-Bildschirm und „Konto“-Bereich (UID-Anzeige, Abmelden, „Plan aus
  Datei übernehmen“) im Stil der App und des abgenommenen Dashboard-
  Mockups, Handy zuerst, Eingabefelder ≥ 16 px, fluid-responsive.

## Technical Preferences

- Firebase Auth aus derselben CDN-Version wie heute (10.13.0), kein
  Build-Schritt.
- Browser-Tests: Auth-Stub um „angemeldet“, „nicht angemeldet“ und
  „falsches Konto“ erweitern; Plan-Laden aus Firestore und Fallback
  stubben.
- Regeln werden manuell in der Console veröffentlicht (wie heute).
  Automatisierte Regel-Tests bräuchten den Firebase-Emulator
  (zusätzliche Dependency) → nicht vorgesehen, Prüfung per Checkliste L3.4.

## Approval-Gates

| Gate | Was genau |
| --- | --- |
| **Security** | Login-Methode (Passkey → Google → E-Mail/Passwort), Token-Prüfung im Worker für alle Endpunkte, Umgang mit fremden Konten, Strava-Token-Erneuerung |
| **Regeländerung** | `firestore.rules` auf feste UID, Deaktivieren der anonymen Anmeldung, Reihenfolge L3 |
| **Firestore-Schema** | neue Sammlung `plans/` mit `plans/hm-2027` (Metadaten, `activeVersion`) und Untersammlung `versions/` (Plan-Format aus Schritt 1 + Import-Metadaten) |
| **Dependency (eventuell)** | nur falls Passkey eine Firebase-Erweiterung/Bibliothek braucht oder die JWT-Prüfung im Worker nicht mit Web Crypto gelöst wird |
| **Worker-API** | alle Endpunkte verlangen `Authorization: Bearer <ID-Token>` (Änderung am Request-Format) |

## Success Metrics

- [ ] Louis ist in Safari auf dem iPhone (Tab und, falls genutzt,
      Home-Bildschirm-App) und in Safari auf dem MacBook angemeldet und
      bleibt es über Neustarts und Offline-Phasen.
- [ ] Privates Fenster ohne Login: Anmelde-Bildschirm, keine Daten,
      Firestore-Zugriff verweigert.
- [ ] Anderes Konto: „Kein Zugriff“, keine Daten.
- [ ] `/coach`, `/exchange`, `/refresh` ohne gültiges Token → 401.
- [ ] Alle bisherigen Logs, Tagespläne, Lauf-Zuordnungen und Coach-Texte
      sind nach der Umstellung unverändert da.
- [ ] Strava neu verbunden, altes Refresh-Token widerrufen.
- [ ] Anonyme Anmeldung in der Console deaktiviert.
- [ ] Plan liegt in `plans/hm-2027/versions/{activeVersion}`, die App lädt
      ihn von dort; mit gelöschtem/ungültigem Dokument läuft sie mit der
      Notfall-Kopie.
- [ ] `npm test` grün, inkl. neuer Auth- und Plan-Lade-Zustände.

## Offene Fragen an Louis

Beantwortet (27.09.2026): Geräte (Safari iPhone + MacBook, Home-Bildschirm
zu prüfen), E-Mail/Passwort als letzter Fallback ok, Strava widerrufen und
neu verbinden: ja, kein Mockup für den Anmelde-Bildschirm.

Neu durch Stufe 2:

1. **Plan-Änderungen zwischen Schritt 1b und Schritt 2:** Nach der
   Übertragung ist Firestore die Quelle. Wenn Claude Code danach den Plan
   ändert (z. B. Renndatum eintragen, HM-Wochen nachschärfen), wie kommt
   das in die App?
   - (a) Claude Code ändert weiter die JSON-Datei; nach dem Deploy tippst
     du in der App „Plan aus Datei übernehmen“ (die App zeigt an, wenn
     die Datei neuer ist als der Firestore-Stand).
   - (b) Claude Code schreibt direkt nach Firestore (bräuchte einen
     Service-Account-Schlüssel auf dem MacBook und eine neue Dependency).
   - **Entschieden 27.09.2026: (a).** *Empfehlung war:* (a) — keine Schlüssel, keine Dependency, jede Übernahme
     wird eine eigene Version, und die Datei bleibt als aktuelle
     Notfall-Kopie erhalten. Ab Schritt 2 kommen Änderungen dann direkt
     in Firestore dazu.

Technisch zu prüfen (keine Frage an Louis): Passkey-Unterstützung in
Firebase; ob Louis die Home-Bildschirm-App nutzt (Test auf seinem iPhone).

## Risiken

- **Passkey-Unterstützung unklar** — kann die Methode auf Google oder
  E-Mail/Passwort kippen (Reihenfolge in L1 geregelt).
- **Aussperren** bei falscher Reihenfolge → L3 ist Pflicht, die UID wird
  vor dem Scharfschalten der Regeln aus der App abgelesen.
- **Plan zu früh in Firestore** wäre nicht ausreichend geschützt → L6 erst
  nach L3.4.
- **Datei und Firestore laufen auseinander** → Anzeige „Datei neuer als
  Firestore“ (bei Antwort 1a) und `fileVersion` im Dokument.
- **Offline-Start mit abgelaufenem Token:** Firebase erneuert das ID-Token
  beim nächsten Netz; Firestore-Cache funktioniert solange weiter. Coach
  und Strava fallen offline ohnehin auf Fallback bzw. Cache zurück.
