import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CalendarEvent as Session, WeekPlan } from "@/types";

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

        sessions.sort((a, b) => {
          const byDate = a.date.localeCompare(b.date);
          if (byDate !== 0) return byDate;
          return a.time.localeCompare(b.time);
        });

        return { ...prev, sessions };
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
