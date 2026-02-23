# Code-Cleanup-Audit

Stand: 2026-02-23

## Vorgehen

- `npm run lint` ausgeführt, um strukturelle und Typing-Probleme sichtbar zu machen.
- Die betroffenen Dateien stichprobenartig geprüft.

## Priorität A (blockiert Build/Lint)

1. **`src/App.tsx` ist stark beschädigt und enthält Stub-/Kommentarreste im Produktivcode**
   - Importbereich enthält mehrfach "Stubs" und eingebettete, unbalancierte Kommentarblöcke.
   - Das führt zu einem Parser-Fehler (`Identifier expected`) und macht die Datei schwer wartbar.
   - **Aufräumen:** Datei auf einen klaren, kompilierbaren Zustand zurückführen (echte Imports + echte Komponenten, keine globalen Stubs in `App.tsx`).

2. **`src/components/layout/CalendarPane.tsx` enthält kaputte Typ-/Props-Struktur**
   - Zwischen Utility-Funktionen stehen lose Props-Zeilen (`weekPlan: WeekPlan;`, `roster: Player[];`) ohne `type Props`-Block.
   - Zusätzlich ist in `dnd` ein Codefragment (`const sM = ...`) innerhalb der Typdefinition gelandet.
   - **Aufräumen:** vollständige Props-Typdefinition rekonstruieren und Fremdfragmente entfernen.

3. **`src/hooks/useDndPlan.ts` enthält eingefügte Code-Fragmente und fehlerhafte Klammerstruktur**
   - Im `onDragStart`-Bereich liegen irrelevante Zeilen (`const sM = ...`, `const eM = ...`).
   - Im TA-Handling ist `const startMin = ...` mitten im Branch eingefügt.
   - Ergebnis: Parser-Fehler (`Declaration or statement expected`).
   - **Aufräumen:** Hook syntaktisch bereinigen, Klammern/Branches neu validieren.

## Priorität B (Lint-/Qualitätsprobleme)

4. **`src/hooks/useCloudSnapshotHandlers.ts`: unvollständige Hook-Dependencies + `any`**
   - `applyCloudSnapshot` nutzt `setRosterMeta`, `setPlayers`, `setTheme`, diese fehlen aber im Dependency-Array.
   - `setProfiles` ist als `Dispatch<SetStateAction<any[]>>` getypt.
   - **Aufräumen:** Dependency-Array korrigieren, Profiltyp statt `any[]` einführen.

5. **`src/hooks/usePlanHistory.ts`: Ref-Zugriff im Return für Render-State**
   - `canUndo`/`canRedo` lesen `history.current`/`future.current` direkt beim Rendern.
   - Lint-Regel `react-hooks/refs` schlägt zu.
   - **Aufräumen:** `canUndo`/`canRedo` über `useState` modellieren oder das History-Modell auf Reducer umstellen.

6. **`tests/date.test.ts`: `any` im Testcode**
   - Kein Blocker, aber unnötige Typverwässerung.
   - **Aufräumen:** präzise Mocks/Typen einsetzen.

## Empfohlene Reihenfolge

1. `App.tsx` stabilisieren.
2. `CalendarPane.tsx` und `useDndPlan.ts` syntaktisch reparieren.
3. Danach `npm run lint` erneut laufen lassen.
4. Anschließend Hook-/Typing-Aufräumarbeiten (`useCloudSnapshotHandlers`, `usePlanHistory`, Tests).

## Quick Wins

- Für die drei Parser-Fehler-Dateien jeweils eine kleine "syntaktisch clean"-PR erstellen (keine Feature-Änderung), damit Review-Risiko klein bleibt.
- Danach zweite PR für Hook-Dependencies und Typschulden.
- Optional: CI-Gate auf `npm run lint` als Pflichtcheck setzen, damit solche Brüche nicht wieder in `main` landen.
