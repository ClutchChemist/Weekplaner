import { parseHHMM, splitTimeRange } from "@/utils/date";
import type { CalendarEvent as LegacySession } from "@/types";

export const MIN_SESSION_DURATION_MIN = 15;
export const DEFAULT_SESSION_DURATION_MIN = 90;

export type DomainSession = {
  id: string;
  date: string;
  day: string;
  teams: string[];
  startMin: number;
  durationMin: number;
  location: string;
  participants: string[];
  info?: string | null;
  warmupMin?: number | null;
  travelMin?: number | null;
  excludeFromRoster?: boolean;
  rowColor?: string;
  kaderLabel?: string;
};

export function dedupeParticipants(ids: string[]): string[] {
  return Array.from(new Set((ids ?? []).map((x) => String(x))));
}

function normalizeDurationMin(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SESSION_DURATION_MIN;
  return Math.max(MIN_SESSION_DURATION_MIN, Math.floor(value ?? DEFAULT_SESSION_DURATION_MIN));
}

function deriveStartDurationFromTime(time: string): { startMin: number; durationMin: number } {
  const parts = splitTimeRange(time);
  if (!parts) {
    return { startMin: 18 * 60, durationMin: DEFAULT_SESSION_DURATION_MIN };
  }

  const [start, end] = parts;
  const startMin = parseHHMM(start);
  const endMin = parseHHMM(end);
  const durationMin = normalizeDurationMin(endMin - startMin);
  return { startMin, durationMin };
}

export function toDomainSession(session: LegacySession): DomainSession {
  const fromTime = deriveStartDurationFromTime(session.time ?? "");
  const startMin = Number.isFinite(session.startMin) ? Number(session.startMin) : fromTime.startMin;
  const durationMin = normalizeDurationMin(
    Number.isFinite(session.durationMin) ? Number(session.durationMin) : fromTime.durationMin
  );

  return {
    id: String(session.id ?? ""),
    date: String(session.date ?? ""),
    day: String(session.day ?? ""),
    teams: Array.isArray(session.teams) ? session.teams.map(String) : [],
    startMin: Math.max(0, Math.floor(startMin)),
    durationMin,
    location: String(session.location ?? ""),
    participants: dedupeParticipants(session.participants ?? []),
    info: session.info ?? null,
    warmupMin: session.warmupMin ?? null,
    travelMin: session.travelMin ?? null,
    excludeFromRoster: session.excludeFromRoster === true,
    rowColor: session.rowColor,
    kaderLabel: session.kaderLabel,
  };
}

export function domainSessionTimeLabel(session: DomainSession): string {
  const startH = String(Math.floor(session.startMin / 60)).padStart(2, "0");
  const startM = String(session.startMin % 60).padStart(2, "0");
  const endTotal = session.startMin + session.durationMin;
  const endH = String(Math.floor(endTotal / 60)).padStart(2, "0");
  const endM = String(endTotal % 60).padStart(2, "0");
  return `${startH}:${startM}-${endH}:${endM}`;
}

export function validateDomainSession(session: DomainSession): string[] {
  const errors: string[] = [];
  if (!session.id.trim()) errors.push("missing_id");
  if (!session.date.trim()) errors.push("missing_date");
  if (!session.day.trim()) errors.push("missing_day");
  if (!session.location.trim()) errors.push("missing_location");
  if (session.teams.length === 0) errors.push("missing_teams");
  if (!Number.isFinite(session.startMin) || session.startMin < 0 || session.startMin > 1439) {
    errors.push("invalid_start_min");
  }
  if (!Number.isFinite(session.durationMin) || session.durationMin < MIN_SESSION_DURATION_MIN) {
    errors.push("invalid_duration_min");
  }
  return errors;
}
