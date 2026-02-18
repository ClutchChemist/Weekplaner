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

- [x] Einheitliches Modal-basiertes Confirm/Alert überall durchziehen
  - `window.alert/confirm/prompt` vollständig vermeiden

- [x] State-Slices evaluieren (z. B. Zustand/Jotai) für Theme/Roster
  - nur bei wachsender Komplexität/Prop-Drilling-Bedarf

- [x] Styling-Strategie evaluieren (CSS Modules/Tailwind)
  - nur wenn aktueller Ansatz bei Wartung/Skalierung bremst

## Notizen

- Strict Mode ist bereits aktiv (`tsconfig.app.json`).
- UI-/Hook-/State-Barrels sind bereits angelegt.
- `src/data/README.md` wurde ergänzt.
- Calendar wurde in Unterkomponenten zerlegt (`src/components/calendar/*`).
- `@/` Alias ist aktiv in TSConfig + Vite.
- Prompt/Confirm laufen über Modals (kein `window.prompt/confirm/alert` mehr in `src/**`).
