import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Player, ThemeSettings, WeekPlan } from "@/types";
import type { Coach } from "@/types";
import type {
  CloudSnapshotV1,
  ProfileSyncMode,
  SavedProfile,
} from "@/state/profileTypes";

export function useCloudSnapshotHandlers({
  rosterMeta,
  players,
  coaches,
  theme,
  plan,
  activeProfileId,
  activeProfileName,
  activeProfileSync,
  clubLogoDataUrl,
  setRosterMeta,
  setPlayers,
  setCoaches,
  setTheme,
  setPlan,
  setClubLogoDataUrl,
  setProfiles,
  setProfileHydratedId,
  setActiveProfileId,
}: {
  rosterMeta: { season: string; ageGroups: unknown };
  players: Player[];
  coaches: Coach[];
  theme: ThemeSettings;
  plan: WeekPlan;
  activeProfileId: string | null;
  activeProfileName: string | null;
  activeProfileSync: { mode: ProfileSyncMode; autoSync?: boolean };
  clubLogoDataUrl: string | null;
  setRosterMeta: Dispatch<SetStateAction<{ season: string; ageGroups: unknown }>>;
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  setCoaches: Dispatch<SetStateAction<Coach[]>>;
  setTheme: Dispatch<SetStateAction<ThemeSettings>>;
  setPlan: Dispatch<SetStateAction<WeekPlan>>;
  setClubLogoDataUrl: (url: string | null) => void;
  setProfiles: Dispatch<SetStateAction<SavedProfile[]>>;
  setProfileHydratedId: (id: string) => void;
  setActiveProfileId: (id: string) => void;
}) {
  const buildCloudSnapshot = useCallback((): CloudSnapshotV1 => ({
    version: 1,
    savedAt: new Date().toISOString(),
    profileId: activeProfileId ?? "",
    profileName: activeProfileName ?? "",
    data: { rosterMeta, players, coaches, theme, plan, clubLogoDataUrl },
  }), [rosterMeta, players, coaches, theme, plan, activeProfileId, activeProfileName, clubLogoDataUrl]);

  const applyCloudSnapshot = useCallback((snapshot: CloudSnapshotV1) => {
    const data = snapshot.data;
    setRosterMeta(data.rosterMeta);
    setPlayers(data.players);
    setCoaches(data.coaches);
    setTheme(data.theme);
    setPlan(data.plan);
    setClubLogoDataUrl(data.clubLogoDataUrl ?? null);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === snapshot.profileId
          ? {
            ...p,
            payload: {
              rosterMeta: data.rosterMeta,
              players: data.players,
              coaches: data.coaches,
              locations: data.theme.locations ?? p.payload.locations,
              clubLogoDataUrl: data.clubLogoDataUrl,
            },
          }
          : p
      )
    );
    setProfileHydratedId(snapshot.profileId);
    setActiveProfileId(snapshot.profileId);
  }, [setRosterMeta, setPlayers, setCoaches, setTheme, setPlan, setClubLogoDataUrl, setProfiles, setProfileHydratedId, setActiveProfileId]);

  const isCloudSnapshotV1 = useCallback((raw: unknown): raw is CloudSnapshotV1 => {
    if (!raw || typeof raw !== "object") return false;
    const r = raw as Record<string, unknown>;
    return (
      r.version === 1 &&
      typeof r.profileId === "string" &&
      typeof r.profileName === "string" &&
      !!r.data &&
      typeof r.data === "object"
    );
  }, []);

  const cloudSyncSignal = useMemo(
    () => ({ rosterMeta, players, coaches, theme, plan, activeProfileId, clubLogoDataUrl, activeProfileSync }),
    [rosterMeta, players, coaches, theme, plan, activeProfileId, clubLogoDataUrl, activeProfileSync]
  );

  const cloudSyncEnabledForActiveProfile = Boolean(
    activeProfileId && activeProfileSync.mode === "cloud"
  );

  const updateActiveProfileSync = useCallback(
    (patch: Partial<{ mode: ProfileSyncMode; autoSync: boolean }>) => {
      if (!activeProfileId) return;
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfileId
            ? { ...p, sync: { ...p.sync, ...patch } }
            : p
        )
      );
    },
    [activeProfileId, setProfiles]
  );

  return {
    buildCloudSnapshot,
    applyCloudSnapshot,
    isCloudSnapshotV1,
    cloudSyncSignal,
    cloudSyncEnabledForActiveProfile,
    updateActiveProfileSync,
  };
}
