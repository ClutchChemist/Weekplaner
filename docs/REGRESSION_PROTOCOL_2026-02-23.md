# Regression Protocol (2026-02-23)

## Automated checks (executed)

- `npm run lint` -> PASS
- `npm run build` -> PASS

## Code-path verification (critical issues)

- `excludeFromRoster` is persisted in event form build:
  - `src/hooks/useEventPlannerState.ts` -> `buildSessionFromForm()` writes `excludeFromRoster`.
- Event editor rehydrates values from selected event:
  - `src/App.tsx` -> `onEditSession(s)` sets:
    - `setFormDate(s.date)`
    - `setFormTeams(...)`
    - `setFormStart(...)`
    - `setFormDuration(...)`
    - `setFormOpponent(s.info ?? "")`
    - `setFormExcludeFromRoster(s.excludeFromRoster === true)`

## Manual browser regression (to execute once)

### A) Event edit correctness

1. Create 2 different events (different day/team/time/location).
2. Open each via gear icon.
3. Verify editor shows the exact original values.
4. Save a change and verify card + editor reopening show updated values.

Expected:
- No fallback to Monday / NBBL / 18:00 unless the event actually has those values.

### B) `excludeFromRoster` behavior

1. Create event and enable `excludeFromRoster`.
2. Save.
3. Verify event still appears in schedule/weekly table and export preview/PDF.
4. Verify event is hidden from roster section only.
5. Reopen event editor and verify checkbox remains enabled.

Expected:
- Event does not disappear from schedule.
- Only roster visibility changes.

### C) Week archive flow

1. Open `Neue Woche planen` while draft exists.
2. Validate confirm flow:
   - Save draft -> appears in archive.
   - Discard draft -> proceeds without archive entry.
3. Validate archive actions:
   - Load draft
   - Use as template
   - Delete entry

Expected:
- Confirm dialogs and archive actions behave consistently.

### D) Profiles + cloud panel

1. Open Profiles modal.
2. Create, rename, delete profile.
3. Change sync mode local/cloud.
4. Verify cloud buttons state and status text.

Expected:
- Profile selection and sync mode persist correctly.

### E) Export

1. Export PDF.
2. Export PNG pages.

Expected:
- Output files are generated without runtime errors.

## Notes

- `npm test` is currently blocked in this environment because `vitest` binary is not locally available and npm offline cache prevents fetching.
- New hook-level tests were added:
  - `tests/cloud-snapshot-handlers.test.ts`
  - `tests/week-archive-manager.test.ts`
