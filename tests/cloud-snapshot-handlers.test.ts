import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSnapshotHandlers } from "../src/hooks/useCloudSnapshotHandlers";
import { DEFAULT_THEME } from "../src/state/themeDefaults";
import type { SavedProfile } from "../src/state/profileTypes";

describe("useCloudSnapshotHandlers", () => {
  it("validates snapshots and exposes cloud enablement", () => {
    const setProfiles = vi.fn();
    const hook = renderHook(() =>
      useCloudSnapshotHandlers({
        rosterMeta: { season: "2026", ageGroups: {} },
        players: [],
        coaches: [],
        theme: DEFAULT_THEME,
        plan: { weekId: "WEEK_2026-02-23", sessions: [] },
        activeProfileId: "p1",
        activeProfileName: "Main",
        activeProfileSync: { mode: "cloud", autoSync: true },
        clubLogoDataUrl: null,
        setRosterMeta: vi.fn(),
        setPlayers: vi.fn(),
        setCoaches: vi.fn(),
        setTheme: vi.fn(),
        setPlan: vi.fn(),
        setClubLogoDataUrl: vi.fn(),
        setProfiles,
        setProfileHydratedId: vi.fn(),
        setActiveProfileId: vi.fn(),
      })
    );

    expect(hook.result.current.cloudSyncEnabledForActiveProfile).toBe(true);
    expect(
      hook.result.current.isCloudSnapshotV1({
        version: 1,
        profileId: "p1",
        profileName: "Main",
        data: {},
      })
    ).toBe(true);
    expect(hook.result.current.isCloudSnapshotV1({ version: 2 })).toBe(false);
  });

  it("updates active profile sync settings through setProfiles", () => {
    const setProfiles = vi.fn();
    const hook = renderHook(() =>
      useCloudSnapshotHandlers({
        rosterMeta: { season: "2026", ageGroups: {} },
        players: [],
        coaches: [],
        theme: DEFAULT_THEME,
        plan: { weekId: "WEEK_2026-02-23", sessions: [] },
        activeProfileId: "p1",
        activeProfileName: "Main",
        activeProfileSync: { mode: "local", autoSync: true },
        clubLogoDataUrl: null,
        setRosterMeta: vi.fn(),
        setPlayers: vi.fn(),
        setCoaches: vi.fn(),
        setTheme: vi.fn(),
        setPlan: vi.fn(),
        setClubLogoDataUrl: vi.fn(),
        setProfiles,
        setProfileHydratedId: vi.fn(),
        setActiveProfileId: vi.fn(),
      })
    );

    act(() => {
      hook.result.current.updateActiveProfileSync({ mode: "cloud", autoSync: false });
    });

    const updater = setProfiles.mock.calls[0][0] as (p: SavedProfile[]) => SavedProfile[];
    const prev: SavedProfile[] = [
      {
        id: "p1",
        name: "Main",
        payload: {
          rosterMeta: { season: "2026", ageGroups: {} },
          players: [],
          coaches: [],
          locations: DEFAULT_THEME.locations!,
          clubLogoDataUrl: null,
        },
        sync: { mode: "local", provider: "supabase", autoSync: true },
      },
    ];
    const next = updater(prev);
    expect(next[0].sync.mode).toBe("cloud");
    expect(next[0].sync.autoSync).toBe(false);
  });
});

