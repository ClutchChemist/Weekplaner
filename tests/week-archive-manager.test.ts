import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWeekArchiveManager } from "../src/hooks/useWeekArchiveManager";
import { WEEK_ARCHIVE_STORAGE_KEY } from "../src/state/weekArchive";

describe("useWeekArchiveManager", () => {
  beforeEach(() => {
    localStorage.removeItem(WEEK_ARCHIVE_STORAGE_KEY);
  });

  it("saves current week into archive for active profile", () => {
    const createWeekFromMode = vi.fn();
    const hook = renderHook(() =>
      useWeekArchiveManager({
        plan: {
          weekId: "WEEK_2026-02-23",
          sessions: [
            {
              id: "s1",
              date: "2026-02-24",
              day: "Di",
              teams: ["NBBL"],
              time: "18:00-19:30",
              location: "BSH",
              info: null,
              participants: [],
            },
          ],
        },
        setPlan: vi.fn(),
        activeProfileId: "p1",
        t: (k: string) => k,
        askConfirm: vi.fn(async () => true),
        createWeekFromMode,
      })
    );

    act(() => {
      hook.result.current.handleSaveCurrentWeekToArchive();
    });

    expect(hook.result.current.activeArchiveEntries.length).toBe(1);
    expect(hook.result.current.activeArchiveEntries[0].profileId).toBe("p1");
  });

  it("blocks createNewWeek when confirm is denied", async () => {
    const createWeekFromMode = vi.fn();
    const askConfirm = vi.fn(async () => false);
    const hook = renderHook(() =>
      useWeekArchiveManager({
        plan: {
          weekId: "WEEK_2026-02-23",
          sessions: [
            {
              id: "s1",
              date: "2026-02-24",
              day: "Di",
              teams: ["NBBL"],
              time: "18:00-19:30",
              location: "BSH",
              info: null,
              participants: [],
            },
          ],
        },
        setPlan: vi.fn(),
        activeProfileId: "",
        t: (k: string) => k,
        askConfirm,
        createWeekFromMode,
      })
    );

    await act(async () => {
      await hook.result.current.createNewWeek("MASTER", false, "2026-03-02");
    });

    expect(askConfirm).toHaveBeenCalledTimes(1);
    expect(createWeekFromMode).not.toHaveBeenCalled();
  });
});

