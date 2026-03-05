# Projekt-TODO (geparkt)

Stand: 2026-02-18

Diese Liste sammelt bewusst geparkte Refactor-/Qualitätsaufgaben, die wir in kleinen Paketen später umsetzen.

## Roadmap „Struktur Schritt für Schritt"

- [x] 1) Code-Formatierung (`.prettierrc`, VS-Code-Format-on-save)
- [x] 2) Code-Analyse (ESLint + React-Hooks-Regeln + Prettier-Interop)
- [x] 3) Calendar-Teil splitten (neue Unterkomponenten)
- [x] 4) Custom Hooks (`useSessionEditor.ts`, `useThemePresets.ts`)
- [x] 5) TS Strict Mode (bereits aktiv)
- [x] 6) Komfort-Imports (Alias `@/` + konsistente Barrel-Exports)
- [x] 7) Modale Dialoge statt Browser-`confirm`/`prompt`

### Aktueller Stand (2026-02-18)

- Prettier und `eslint-config-prettier` installiert.
- `package.json` erweitert um `format` und `format:check`.
- `eslint.config.js` um Prettier-Interop und Regeln (`no-console`, `@typescript-eslint/no-unused-vars`) ergänzt.
- Workspace-Settings in `.vscode/settings.json` um Format-on-save + Prettier-Formatter ergänzt.


## Nächstes Paket (P1)

- [x] `useSessionEditor()` als eigenen Hook extrahieren
  - Ziel: Event-Editor-Logik aus `src/App.tsx` entkoppeln
  - Ergebnis: kleinere Hauptdatei, bessere Testbarkeit

- [x] `App.tsx` Importpfade auf Barrel-Exports ausweiten
  - z. B. `hooks`, `state`, `types`
  - Ziel: weniger Import-Boilerplate

- [x] `ParticipantCard`/DnD-Props auf stabile Referenzen prüfen
  - Ziel: `React.memo` maximal wirksam machen (weniger Re-Renders)

## Danach (P2)

- [x] Date-Helfer weiter vereinheitlichen
  - ggf. Benennungen glätten (`isoWeekNumber` vs. `getISOWeek`)
  - Duplikat-API reduzieren, intern auf einen Kernpfad mappen

- [x] `src/types/index.ts` schrittweise als primären Type-Import etablieren
  - Zielbild: `import type { Player, WeekPlan } from "@/types"`

- [x] Optionales `src/constants.ts` evaluieren
  - nur wenn zusätzliche app-weite Konstanten außerhalb `state/storageKeys.ts` entstehen

## Später / optional (P3)

- [ ] OAuth/SSO Login evaluieren und einführen (Google + Microsoft)
  - Ziel: Alternative zu Magic-Link, schnelleres Sign-in für wiederkehrende Nutzer
  - Scope: Supabase Provider-Konfiguration + UI-Buttons + Redirect/Callback-Handling
  - Hinweis: Setup von OAuth-Credentials (Google Cloud / Azure Entra) erforderlich

- [ ] Test-Basis aufbauen (Vitest)
  - Ziel: kritische Logik absichern (Reducer, Snapshot-Validation, Cloud-Sync Guards)
  - Scope: mindestens Unit-Tests für `state/*` und `utils/*` Kernpfade

- [ ] Changelog-Automation evaluieren
  - Ziel: Releases konsistent und automatisch dokumentieren
  - Kandidaten: `release-please` oder `conventional-changelog`

- [ ] API-Zugriffsschicht weiter zentralisieren
  - Ziel: klare Runtime-Fallback-Logik für Dev/Prod an einer Stelle
  - Scope: bestehende `mapsApi.ts` als gemeinsames Muster für weitere Backend-Calls nutzen

- [x] Einheitliches Modal-basiertes Confirm/Alert überall durchziehen
  - `window.alert/confirm/prompt` vollständig vermeiden

- [x] State-Slices evaluieren (z. B. Zustand/Jotai) für Theme/Roster
  - nur bei wachsender Komplexität/Prop-Drilling-Bedarf

- [x] Styling-Strategie evaluieren (CSS Modules/Tailwind)
  - nur wenn aktueller Ansatz bei Wartung/Skalierung bremst

## Neue Feature-TODOs (2026-03-05)

- [x] Kader-Schnellauswahl im Event-Editor erweitern
  - Add/Delete von Spielern direkt im Event-Editor ermöglichen (ohne Umweg über andere Panels)

- [x] Sonderfall `TBD` im Event-Kader anpassen
  - `TBD` benötigt keine TA-Nummer
  - `TBD` darf mehrfach pro Event im Kader hinzugefügt werden

- [x] Info-Spalte im Event-Editor als robusten Freitext prüfen
  - Bearbeitung mit Leerzeichen und normalem Freitext sicherstellen
  - Regressionscheck: bestehende Edit- und Save-Flows dürfen nicht blockieren

- [x] Treffpunkt-Uhrzeit bei Spiel-Info automatisch anhängen
  - Bei `vs`/`at` den berechneten Treffpunkt am Ende von `info` ergänzen
  - Format: `<freitext> | Treffpunkt: HH:MM`
  - Berechnung: `Eventstart - Warmup - (bei Auswärtsspiel zusätzlich Fahrzeit)`

- [ ] Kaderliste-Import aus MMB-Liste ergänzen
  - Importpfad/Dateiformat definieren und robustes Mapping auf bestehende Spielerfelder implementieren
  - Fehlerfälle (fehlende Spalten, ungültige Werte, Duplikate) mit UI-Feedback behandeln

- [x] Kontrast bei Jahrgangsfarben in der Kaderübersicht absichern
  - Lesbarkeit bei hellen Hintergründen sicherstellen (automatische Textfarb-Anpassung)
  - Alternative/Erweiterung prüfen: pro Jahrgang zusätzlich eine explizite Textfarbe konfigurierbar machen

- [x] Neues Profil immer leer initialisieren
  - Beim Erstellen eines neuen Profils mit leerem Zustand starten (`Kader`, `Coaches`, `Orte`, etc.)
  - Keine automatische Übernahme von Daten aus dem aktuell aktiven oder anderen Profilen

## Code-Review Follow-ups (2026-03-05)

- [x] Profil-Erstellung und Cloud-First-Setup auf leeren Startzustand umbauen
  - `createProfile` darf nicht `currentProfilePayload` übernehmen
  - Cloud-Bootstrap ohne bestehende Cloud-Profile muss ebenfalls leer initialisieren

- [x] Cloud-Fehlerpfade sichtbar machen (statt still zu schlucken)
  - Fehler beim Laden/Löschen von Cloud-Profilen in Status-UI oder Log sichtbar machen
  - Ziel: keine stillen Inkonsistenzen zwischen lokalem Zustand und Supabase

- [x] TopBar-Refactor abschließen (Doppelimplementierung entfernen)
  - Entweder `AppTopBar` vollständig nutzen oder Inline-TopBar konsolidieren
  - Ziel: eine einzige Quelle für TopBar-Logik und Profile-Quickmenu

- [x] Unbenutzte Alt-Konstanten aufräumen
  - `CLOUD_AUTO_SYNC_KEY` prüfen und entfernen oder korrekt integrieren

## Notizen

- Strict Mode ist bereits aktiv (`tsconfig.app.json`).
- UI-/Hook-/State-Barrels sind bereits angelegt.
- `src/data/README.md` wurde ergänzt.
- Calendar wurde in Unterkomponenten zerlegt (`src/components/calendar/*`).
- `@/` Alias ist aktiv in TSConfig + Vite.
- Prompt/Confirm laufen über Modals (kein `window.prompt/confirm/alert` mehr in `src/**`).
