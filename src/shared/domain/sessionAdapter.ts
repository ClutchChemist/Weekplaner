import type { CalendarEvent as LegacySession } from "@/types";
import type { DomainSession } from "./session";
import { domainSessionTimeLabel, toDomainSession } from "./session";

export function legacySessionToDomainSession(session: LegacySession): DomainSession {
  return toDomainSession(session);
}

export function domainSessionToLegacySession(session: DomainSession): LegacySession {
  return {
    id: session.id,
    date: session.date,
    day: session.day,
    teams: [...session.teams],
    time: domainSessionTimeLabel(session),
    startMin: session.startMin,
    durationMin: session.durationMin,
    location: session.location,
    info: session.info ?? null,
    warmupMin: session.warmupMin ?? null,
    travelMin: session.travelMin ?? null,
    participants: [...session.participants],
    kaderLabel: session.kaderLabel,
    excludeFromRoster: session.excludeFromRoster === true,
    rowColor: session.rowColor,
  };
}
