import type { CalendarEvent as Session, WeekPlan } from "@/types";
import { legacySessionToDomainSession } from "@/shared/domain/sessionAdapter";

function compareSessions(a: Session, b: Session): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const aStart = legacySessionToDomainSession(a).startMin;
  const bStart = legacySessionToDomainSession(b).startMin;
  return aStart - bStart;
}

export function selectScheduleSessions(plan: WeekPlan): Session[] {
  return [...(plan.sessions ?? [])].sort(compareSessions);
}

export function selectRosterSessions(plan: WeekPlan): Session[] {
  return [...(plan.sessions ?? [])].filter((s) => !s.excludeFromRoster).sort(compareSessions);
}
