import { describe, expect, it } from 'vitest';
import type { WeekPlan } from '../src/types';
import {
  domainSessionTimeLabel,
  toDomainSession,
  validateDomainSession,
} from '../src/shared/domain/session';
import {
  domainSessionToLegacySession,
  legacySessionToDomainSession,
} from '../src/shared/domain/sessionAdapter';
import {
  selectRosterSessions,
  selectScheduleSessions,
} from '../src/features/week-planning/selectors/sessionSelectors';

describe('session domain', () => {
  it('derives start/duration from legacy time if missing', () => {
    const domain = toDomainSession({
      id: 's1',
      date: '2026-02-24',
      day: 'Di',
      teams: ['NBBL'],
      time: '20:15-22:00',
      location: 'BSH',
      participants: ['p1', 'p1', 'p2'],
    });

    expect(domain.startMin).toBe(1215);
    expect(domain.durationMin).toBe(105);
    expect(domain.participants).toEqual(['p1', 'p2']);
  });

  it('converts domain session back to legacy with computed time label', () => {
    const legacy = domainSessionToLegacySession({
      id: 's2',
      date: '2026-02-25',
      day: 'Mi',
      teams: ['HOL'],
      startMin: 17 * 60,
      durationMin: 60,
      location: 'Seminarraum',
      participants: [],
      excludeFromRoster: true,
    });

    expect(legacy.time).toBe('17:00-18:00');
    expect(legacy.excludeFromRoster).toBe(true);
  });

  it('validates required domain constraints', () => {
    const errors = validateDomainSession({
      id: '',
      date: '',
      day: '',
      teams: [],
      startMin: -1,
      durationMin: 5,
      location: '',
      participants: [],
    });

    expect(errors).toContain('missing_id');
    expect(errors).toContain('missing_date');
    expect(errors).toContain('missing_day');
    expect(errors).toContain('missing_teams');
    expect(errors).toContain('invalid_start_min');
    expect(errors).toContain('invalid_duration_min');
    expect(errors).toContain('missing_location');
  });

  it('keeps schedule complete but filters roster by excludeFromRoster', () => {
    const plan: WeekPlan = {
      weekId: 'WEEK_2026-02-23',
      sessions: [
        {
          id: 'sA',
          date: '2026-02-24',
          day: 'Di',
          teams: ['1RLH'],
          time: '20:00-22:00',
          location: 'BSH',
          participants: [],
          excludeFromRoster: true,
        },
        {
          id: 'sB',
          date: '2026-02-24',
          day: 'Di',
          teams: ['NBBL'],
          time: '17:00-18:00',
          location: 'Seminarraum',
          participants: [],
        },
      ],
    };

    const schedule = selectScheduleSessions(plan);
    const roster = selectRosterSessions(plan);

    expect(schedule.map((s) => s.id)).toEqual(['sB', 'sA']);
    expect(roster.map((s) => s.id)).toEqual(['sB']);
  });

  it('uses the same time rendering for adapter and domain helper', () => {
    const domain = legacySessionToDomainSession({
      id: 's3',
      date: '2026-02-26',
      day: 'Do',
      teams: ['U18'],
      time: '18:45-20:15',
      location: 'SHP',
      participants: [],
    });

    expect(domainSessionTimeLabel(domain)).toBe('18:45-20:15');
  });
});
