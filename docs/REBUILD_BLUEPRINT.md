# Rebuild Blueprint (Phase 2)

Stand: 2026-02-23

## Ziel
Das Projekt auf ein robustes, testbares Grundgeruest umstellen, ohne fachliche Features zu verlieren:
- Wochenplanung mit Event-Editor und DnD
- Kader-/Teilnehmer-Logik
- Export (Preview/PDF/PNG)
- Profile + Cloud-Sync
- i18n/Theme

Der Rebuild ist inkrementell geplant: neue Architektur neben bestehendem Code aufbauen, dann kontrolliert umschalten.

## Leitprinzipien
1. Eine klare Domain-Quelle fuer Event-Zeit:
- Primär: `startMin`, `durationMin`
- Abgeleitet: `timeLabel` (nur UI/Export)

2. Business-Logik raus aus Render-Komponenten:
- Selektoren, Reducer, Services in eigene Module

3. Feature-Slices statt App-Monolith:
- Jede Feature-Vertikale hat Domain, State, UI, Tests

4. Strikte Trennung:
- `shared/domain` (Typen + Regeln)
- `features/*` (fachliche Flows)
- `app/*` (Orchestrierung)

5. Migration ohne Big Bang:
- Adapter fuer Altformat
- Feature-Flag/Umschaltung pro Slice

## Zielstruktur
```text
src/
  app/
    AppShell.tsx
    providers/
      AppProviders.tsx
      I18nProvider.tsx
      ThemeProvider.tsx
    routing/
  shared/
    domain/
      session.ts
      player.ts
      profile.ts
      validation.ts
    ui/
      components/
      modal/
    lib/
      date/
      id/
      storage/
      typing/
  features/
    week-planning/
      domain/
      state/
      selectors/
      hooks/
      ui/
    roster/
      domain/
      state/
      selectors/
      hooks/
      ui/
    export/
      domain/
      selectors/
      services/
      ui/
    profiles-sync/
      domain/
      state/
      hooks/
      services/
  legacy/
    (temporäre Adapter/Bridge-Module)
```

## Domain-Entscheidungen
### Session (neu)
Pflichtfelder:
- `id`, `date`, `day`, `teams`, `startMin`, `durationMin`, `location`, `participants`

Optionale Felder:
- `info`, `warmupMin`, `travelMin`, `excludeFromRoster`, `rowColor`

Abgeleitet:
- `timeLabel = HH:MM-HH:MM` (kein Source-of-Truth)

### Invarianten
- `startMin` in `[0..1439]`
- `durationMin >= 15` und Vielfaches von 5
- `participants` dedupliziert
- `excludeFromRoster` beeinflusst nur Kaderdarstellung, nie Zeitplan-Sichtbarkeit

## Selektoren (zentral)
- `selectScheduleSessions(plan)` -> alle Sessions
- `selectRosterSessions(plan)` -> `!excludeFromRoster`
- `selectSortedSessions(plan)` -> Datum + `startMin`
- `selectConflicts(plan)` -> DnD-/Overlap-Konflikte
- `selectWeekDates(plan)` -> Wochenheader

## Rebuild-Phasen
### Phase 0: Safety-Net
Ergebnis:
- Vitest lauffaehig in CI/Local
- Test-Basis fuer kritische Flows

Tasks:
1. Test-Infra stabilisieren (`vitest run` als CI-Job)
2. Snapshot-Tests fuer Export-HTML (Schedule + Roster)
3. Unit-Tests:
   - Session-Invarianten
   - Sortierung/Overlap
   - `excludeFromRoster` Verhalten

### Phase 1: Domain-Kern + Adapter
Ergebnis:
- Neues Session-Modell inkl. Konverter von Legacy-Daten

Tasks:
1. `shared/domain/session.ts` + Validatoren
2. Adapter:
   - `legacySessionToDomainSession`
   - `domainSessionToLegacySession`
3. Read-Pfad zuerst:
   - Komponenten lesen via Selektoren aus Domain-Modell

### Phase 2: Week Planning Slice
Ergebnis:
- Editor + DnD + Week Board laufen auf neuer State-Logik

Tasks:
1. `features/week-planning/state`
2. Reducer/Actions:
   - create/update/delete session
   - assign/unassign participant
   - toggle travel/warmup
3. UI-Komponenten umhaengen:
   - WeekPlanBoard
   - CalendarPane
   - EventEditorForm

### Phase 3: Export Slice
Ergebnis:
- Export komplett selector-basiert und deterministisch

Tasks:
1. Export-Datenmodelle von UI trennen
2. `selectScheduleSessions` und `selectRosterSessions` hart trennen
3. Print/Preview/PDF Services vereinheitlichen

### Phase 4: Profiles + Cloud
Ergebnis:
- Profile-State und Cloud-Sync entkoppelt vom App-Monolith

Tasks:
1. Profile-State in eigenes Feature verlagern
2. Snapshot-Build/Apply zentralisieren
3. Cloud-API-Hardening + Fehlerpfade testen

### Phase 5: Cleanup Legacy
Ergebnis:
- `App.tsx` auf Orchestrierung reduziert
- tote Hooks/Komponenten entfernt

Tasks:
1. Nicht verwendete Hooks entfernen oder final integrieren
2. Doppelte Komponenten eliminieren
3. i18n-Key-Audit auf 0 Missing Keys bringen

## Abnahmekriterien pro Phase
- `npm run lint` gruen
- `npm run build` gruen
- Vitest-Suite gruen
- Keine Feature-Regression laut Checkliste

## Checkliste „Feature Parity“
1. Event erstellen/bearbeiten/loeschen
2. DnD Teilnehmer zuweisen/entfernen
3. Konflikt-Hinweise bei Overlap
4. `excludeFromRoster`:
- Zeitplan sichtbar
- Kaderbereich ausgeblendet
5. Neue Woche (Master/Empty/Copy)
6. Export Preview/PDF/PNG
7. Profile speichern/wechseln
8. Cloud Save/Load/AutoSync

## Priorisierte Quick Wins (vor Rebuild-Start)
1. `App.tsx` in Container + Presenter splitten (ohne Verhalten zu aendern)
2. Unbenutzte Hooks markieren/entfernen (`usePlanHistory` etc.)
3. Doppelte Komponenten konsolidieren (`DraggablePlayerRow`, `ParticipantCard`)
4. i18n-Missing-Keys sofort schliessen

## Risiken
1. Versteckte Feature-Kopplungen im Monolith
2. Legacy `time`-String Nebenwirkungen
3. Export-HTML als implizite Business-Logik

Mitigation:
- Adapter-Layer, Feature-Flags, Snapshot-Tests, kleine PR-Schritte

## Nächster Umsetzungsschritt
Start mit **Phase 0 + Phase 1 (minimaler Kern)**:
1. Domain-Session Modul anlegen
2. Adapter für bestehende Session-Daten
3. Erste Selektoren (`schedule`/`roster`) und Tests
