import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CalendarEvent as Session, WeekPlan } from "@/types";
import type { NewWeekMode } from "@/components/modals/NewWeekModal";
import {
  addDaysISO,
  isoWeekMonday,
  kwLabelFromPlan,
  normalizeDash,
  weekdayOffsetFromDEShort,
  weekdayShortDE,
} from "@/utils/date";
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
    try {
      return birthdayPlayerIds.size > 0 ? `${base} 🎂` : base;
    } catch {
      return base;
    }
  }, [plan, birthdayPlayerIds]);

  const weekDates = useMemo(() => {
    let base: string;
    if (plan.weekId?.startsWith("WEEK_")) {
      const m = plan.weekId.match(/WEEK_(\d{4}-\d{2}-\d{2})/);
      base = m?.[1] ?? (() => {
        const dates = plan.sessions
          .map((s) => s.date)
          .filter((d) => d?.length === 10)
          .sort();
        return dates.length
          ? isoWeekMonday(dates[0])
          : isoWeekMonday(new Date().toISOString().slice(0, 10));
      })();
    } else {
      const dates = plan.sessions
        .map((s) => s.date)
        .filter((d) => d?.length === 10)
        .sort();
      base = dates.length
        ? isoWeekMonday(dates[0])
        : isoWeekMonday(new Date().toISOString().slice(0, 10));
    }
    return Array.from({ length: 7 }, (_, i) => addDaysISO(base, i));
  }, [plan]);

  function applyWeekDatesToSessions(
    sessions: Session[],
    weekStartMondayISO: string
  ): Session[] {
    return sessions
      .map((s) => {
        const off = weekdayOffsetFromDEShort(s.day);
        const effectiveOffset =
          off !== null
            ? off
            : s.date
            ? (new Date(s.date + "T00:00:00").getDay() + 6) % 7
            : 0;
        const nextDate = addDaysISO(weekStartMondayISO, effectiveOffset);
        return {
          ...s,
          date: nextDate,
          day: weekdayShortDE(nextDate),
          time: normalizeDash(String(s.time ?? "")),
        };
      })
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.time.localeCompare(b.time);
      });
  }

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
          ).map((s) => ({ ...s, participants: [] })),
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
