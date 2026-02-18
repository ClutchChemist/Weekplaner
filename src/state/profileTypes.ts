import type { Coach, Player, ThemeSettings, WeekPlan } from "./types";

export type ProfileSyncMode = "local" | "cloud";
export type ProfileSyncProvider = "supabase";

export type ProfileSyncSettings = {
  mode: ProfileSyncMode;
  provider: ProfileSyncProvider;
  autoSync: boolean;
};

export type ProfilePayload = {
  rosterMeta: { season: string; ageGroups: unknown };
  players: Player[];
  coaches: Coach[];
  locations: NonNullable<ThemeSettings["locations"]>;
  clubLogoDataUrl: string | null;
};

export type SavedProfile = {
  id: string;
  name: string;
  payload: ProfilePayload;
  sync: ProfileSyncSettings;
};

export type CloudSnapshotV1 = {
  version: 1;
  savedAt: string;
  profileId: string;
  profileName: string;
  data: {
    rosterMeta: { season: string; ageGroups: unknown };
    players: Player[];
    coaches: Coach[];
    theme: ThemeSettings;
    plan: WeekPlan;
    clubLogoDataUrl: string | null;
  };
};

export const PROFILES_STORAGE_KEY = "ubc_planner_profiles_v1";
export const ACTIVE_PROFILE_STORAGE_KEY = "ubc_planner_active_profile_v1";
export const CLOUD_AUTO_SYNC_KEY = "ubc_cloud_auto_sync_v1";

export const DEFAULT_PROFILE_SYNC: ProfileSyncSettings = {
  mode: "local",
  provider: "supabase",
  autoSync: true,
};

export function normalizeProfileSync(raw: unknown): ProfileSyncSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PROFILE_SYNC };
  const r = raw as Record<string, unknown>;
  const mode = r.mode === "cloud" ? "cloud" : "local";
  const provider = r.provider === "supabase" ? "supabase" : "supabase";
  const autoSync = typeof r.autoSync === "boolean" ? r.autoSync : true;
  return { mode, provider, autoSync };
}

export function safeParseProfiles(raw: string | null): SavedProfile[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const e = entry as Record<string, unknown>;
        const id = typeof e.id === "string" ? e.id : "";
        const name = typeof e.name === "string" ? e.name : "";
        const payload = (e.payload && typeof e.payload === "object") ? (e.payload as ProfilePayload) : null;
        if (!id || !name || !payload) return null;
        return {
          id,
          name,
          payload,
          sync: normalizeProfileSync(e.sync),
        } satisfies SavedProfile;
      })
      .filter((p): p is SavedProfile => Boolean(p));
  } catch {
    return [];
  }
}
