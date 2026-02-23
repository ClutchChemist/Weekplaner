import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { CalendarEvent as Session, WeekPlan } from "@/types";
import type { NewWeekMode } from "@/components/modals/NewWeekModal";
import {
  addDaysISO,
  dateToShortDE,
  isoWeekMonday,
  kwLabelFromPlan,
  normalizeDash,
  weekdayOffsetFromDEShort,
  weekdayShortDE,
} from "@/utils/date";
import { randomId } from "@/utils/id";
import {
  safeParseWeekArchive,
  WEEK_ARCHIVE_STORAGE_KEY,
  type WeekArchiveEntry,
} from "@/state/weekArchive";
import { usePersistedState } from "./usePersistedState";

type Args = {
  plan: WeekPlan;
  setPlan: Dispatch<SetStateAction<WeekPlan>>;
  activeProfileId: string;
  t: (key: string) => string;
  askConfirm: (title: string, message: string) => Promise<boolean>;
  createWeekFromMode: (
    mode: NewWeekMode,
    keepParticipants: boolean,
    weekStartMondayISO: string
  ) => void;
};

function cloneWeekPlan(src: WeekPlan): WeekPlan {
  return JSON.parse(JSON.stringify(src)) as WeekPlan;
}

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
            ? (new Date(`${s.date}T00:00:00`).getDay() + 6) % 7
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
      const ad = a.date.localeCompare(b.date);
      return ad !== 0 ? ad : a.time.localeCompare(b.time);
    });
}

export function useWeekArchiveManager({
  plan,
  setPlan,
  activeProfileId,
  t,
  askConfirm,
  createWeekFromMode,
}: Args) {
  const [weekArchiveOpen, setWeekArchiveOpen] = useState(false);
  const [weekArchiveByProfile, setWeekArchiveByProfile] = usePersistedState<
    Record<string, WeekArchiveEntry[]>
  >(WEEK_ARCHIVE_STORAGE_KEY, {}, (savedRaw) => safeParseWeekArchive(savedRaw));
  const [archiveTemplateStart, setArchiveTemplateStart] = useState<string>(() =>
    isoWeekMonday(new Date().toISOString().slice(0, 10))
  );

  const activeArchiveEntries = useMemo(() => {
    if (!activeProfileId) return [] as WeekArchiveEntry[];
    return (weekArchiveByProfile[activeProfileId] ?? []).filter(
      (entry) => entry.profileId === activeProfileId
    );
  }, [activeProfileId, weekArchiveByProfile]);

  function savePlanToArchive(
    targetPlan: WeekPlan,
    profileId: string,
    reason: "manual" | "auto" = "manual"
  ) {
    const reasonLabel =
      reason === "auto" ? t("weekArchiveLabelAuto") : t("weekArchiveLabelManual");
    const weekLabel = kwLabelFromPlan(targetPlan);
    const firstDate = targetPlan.sessions?.[0]?.date ?? "";
    const firstDateLabel = firstDate ? dateToShortDE(firstDate) : "—";
    const sessionCount = (targetPlan.sessions ?? []).length;
    const label = `${reasonLabel} • ${weekLabel} • ${t("weekArchiveLabelStart")} ${firstDateLabel} • ${sessionCount} ${t("weekArchiveLabelEvents")}`;

    const entry: WeekArchiveEntry = {
      id: randomId("wk_arch_"),
      savedAt: new Date().toISOString(),
      label,
      profileId,
      plan: cloneWeekPlan(targetPlan),
    };

    setWeekArchiveByProfile((prev) => {
      const current = prev[profileId] ?? [];
      const next = [entry, ...current].slice(0, 30);
      return { ...prev, [profileId]: next };
    });
  }

  function handleSaveCurrentWeekToArchive() {
    if (!activeProfileId) return;
    savePlanToArchive(plan, activeProfileId, "manual");
  }

  function handleLoadArchiveEntry(entry: WeekArchiveEntry) {
    if (!activeProfileId || entry.profileId !== activeProfileId) return;
    setPlan(cloneWeekPlan(entry.plan));
    setWeekArchiveOpen(false);
  }

  function handleDeleteArchiveEntry(entry: WeekArchiveEntry) {
    if (!activeProfileId || entry.profileId !== activeProfileId) return;
    setWeekArchiveByProfile((prev) => {
      const current = prev[activeProfileId] ?? [];
      return {
        ...prev,
        [activeProfileId]: current.filter((e) => e.id !== entry.id),
      };
    });
  }

  function handleUseArchiveAsTemplate(entry: WeekArchiveEntry) {
    if (!activeProfileId || entry.profileId !== activeProfileId) return;
    const copied = (entry.plan.sessions ?? []).map((s) => ({
      ...s,
      id: randomId("sess_"),
      participants: [...(s.participants ?? [])],
    }));
    const shifted = applyWeekDatesToSessions(copied, archiveTemplateStart);
    setPlan({
      weekId: `WEEK_${archiveTemplateStart}_tpl`,
      sessions: shifted,
    });
    setWeekArchiveOpen(false);
  }

  async function createNewWeek(
    mode: NewWeekMode,
    keepParticipants: boolean,
    weekStartMondayISO: string
  ) {
    const hasDraft = (plan.sessions ?? []).length > 0;
    if (hasDraft) {
      if (!activeProfileId) {
        const proceedNoProfile = await askConfirm(
          t("profiles"),
          t("weekArchiveNeedsProfile")
        );
        if (!proceedNoProfile) return;
      } else {
        const saveDraft = await askConfirm(
          t("weekArchiveCreateQuestionTitle"),
          t("weekArchiveCreateQuestionBody")
        );
        if (saveDraft) {
          savePlanToArchive(plan, activeProfileId, "auto");
        } else {
          const discardDraft = await askConfirm(
            t("weekArchiveDiscardTitle"),
            t("weekArchiveDiscardBody")
          );
          if (!discardDraft) return;
        }
      }
    }

    createWeekFromMode(mode, keepParticipants, weekStartMondayISO);
  }

  return {
    weekArchiveOpen,
    setWeekArchiveOpen,
    archiveTemplateStart,
    setArchiveTemplateStart,
    activeArchiveEntries,
    handleSaveCurrentWeekToArchive,
    handleLoadArchiveEntry,
    handleDeleteArchiveEntry,
    handleUseArchiveAsTemplate,
    createNewWeek,
  };
}
