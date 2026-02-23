import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CalendarEvent as Session, WeekPlan } from "@/types";
import { sortSessions } from "@/features/week-planning/selectors/sessionSelectors";

export function useSessionEditor(
  setPlan: Dispatch<SetStateAction<WeekPlan>>,
  sortParticipants: (a: string, b: string) => number
) {
  const upsert = useCallback(
    (session: Session) => {
      setPlan((prev) => {
        const hasExisting = prev.sessions.some((s) => s.id === session.id);
        const nextSession = {
          ...session,
          participants: (session.participants ?? []).slice().sort(sortParticipants),
        };

        const sessions = hasExisting
          ? prev.sessions.map((s) => (s.id === session.id ? nextSession : s))
          : [...prev.sessions, nextSession];

        return { ...prev, sessions: sortSessions(sessions) };
      });
    },
    [setPlan, sortParticipants]
  );

  const remove = useCallback(
    (id: string) => {
      setPlan((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== id),
      }));
    },
    [setPlan]
  );

  return { upsert, remove } as const;
}
