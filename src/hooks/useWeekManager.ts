import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CalendarEvent as Session, WeekPlan } from "@/types";
import type { NewWeekMode } from "@/components/modals/NewWeekModal";
import {
  isoWeekMonday,
  kwLabelFromPlan,
  addDaysISO,
} from "@/utils/date";
import { applyWeekDatesToSessions } from "@/utils/session";
import { randomId } from "@/utils/id";

export function useWeekManager({
  plan,
  setPlan,
  masterPlan,
  birthdayPlayerIds,
  setNewWeekOpen,
  resetForm,
}: {
  plan: WeekPlan;
  setPlan: Dispatch<SetStateAction<WeekPlan>>;
  masterPlan: WeekPlan;
  birthdayPlayerIds: Set<string>;
  setNewWeekOpen: (open: boolean) => void;
  resetForm: () => void;
}) {
  const weekLabel = useMemo(() => {
    const base = kwLabelFromPlan(plan);
    return birthdayPlayerIds.size > 0 ? `${base} 🎂` : base;
  }, [plan, birthdayPlayerIds]);

  /** All 7 dates of the current plan's week (Mon–Sun). */
  const weekDates = useMemo(() => {
    const m = plan.weekId?.match(/WEEK_(\d{4}-\d{2}-\d{2})/);
    const base = m?.[1] ?? (() => {
      const dates = plan.sessions
        .map((s) => s.date)
        .filter((d): d is string => (d?.length ?? 0) === 10)
        .sort();
      return isoWeekMonday(dates[0] ?? new Date().toISOString().slice(0, 10));
    })();
    return Array.from({ length: 7 }, (_, i) => addDaysISO(base, i));
  }, [plan]);

  const createNewWeek = useCallback(
    (
      mode: NewWeekMode,
      keepParticipants: boolean,
      weekStartMondayISO: string
    ) => {
      if (mode === "MASTER") {
        setPlan(() => ({
          weekId: `WEEK_${weekStartMondayISO}`,
          sessions: applyWeekDatesToSessions(
            masterPlan.sessions,
            weekStartMondayISO
          ).map((s: Session) => ({ ...s, participants: [] })),
        }));
      } else if (mode === "EMPTY") {
        setPlan({ weekId: `WEEK_${weekStartMondayISO}`, sessions: [] });
      } else {
        // COPY_CURRENT
        setPlan((prev) => {
          const copied = prev.sessions.map((s) => ({
            ...s,
            id: randomId("sess_"),
            participants: keepParticipants ? [...(s.participants ?? [])] : [],
          }));
          return {
            weekId: `WEEK_${weekStartMondayISO}_copy`,
            sessions: applyWeekDatesToSessions(copied, weekStartMondayISO),
          };
        });
      }
      setNewWeekOpen(false);
      resetForm();
    },
    [masterPlan, setPlan, setNewWeekOpen, resetForm]
  );

  return { weekLabel, weekDates, createNewWeek };
}
