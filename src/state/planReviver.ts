import type { Session, WeekPlan } from "./types";
import { normalizeDash } from "../utils/date";
import { domainSessionToLegacySession, legacySessionToDomainSession } from "@/shared/domain/sessionAdapter";
import { sortSessions } from "@/features/week-planning/selectors/sessionSelectors";

export function reviveWeekPlan(raw: string): WeekPlan | null {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.sessions)) return null;

  const sessions: Session[] = root.sessions.map((rawSession) => {
    const s = (rawSession && typeof rawSession === "object")
      ? (rawSession as Record<string, unknown>)
      : {};

    const normalizedSession: Session = {
      id: String(s.id ?? ""),
      date: String(s.date ?? ""),
      day: String(s.day ?? ""),
      teams: Array.isArray(s.teams) ? s.teams.map((x) => String(x)) : [],
      time: normalizeDash(String(s.time ?? "")),
      location: String(s.location ?? ""),
      info: s.info !== undefined && s.info !== null ? String(s.info) : null,
      warmupMin: s.warmupMin !== undefined && s.warmupMin !== null ? Number(s.warmupMin) : null,
      travelMin: s.travelMin !== undefined && s.travelMin !== null ? Number(s.travelMin) : null,
      participants: Array.isArray(s.participants) ? s.participants.map((x) => String(x)) : [],
      kaderLabel: s.kaderLabel ? String(s.kaderLabel) : undefined,
    };
    return domainSessionToLegacySession(legacySessionToDomainSession(normalizedSession));
  });

  const sortedSessions = sortSessions(sessions);

  return {
    weekId: String(root.weekId ?? "LAST"),
    sessions: sortedSessions,
  };
}
