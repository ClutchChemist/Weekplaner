import type { Coach, Player, ThemeSettings, WeekPlan } from "./types";

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
};

export type CloudSnapshotV1 = {
  version: 1;
  savedAt: string;
  data: {
    rosterMeta: { season: string; ageGroups: unknown };
    players: Player[];
    coaches: Coach[];
    theme: ThemeSettings;
    plan: WeekPlan;
    profiles: SavedProfile[];
    activeProfileId: string;
    clubLogoDataUrl: string | null;
  };
};

export const PROFILES_STORAGE_KEY = "ubc_planner_profiles_v1";
export const ACTIVE_PROFILE_STORAGE_KEY = "ubc_planner_active_profile_v1";
export const CLOUD_AUTO_SYNC_KEY = "ubc_cloud_auto_sync_v1";

export function safeParseProfiles(raw: string | null): SavedProfile[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedProfile => {
      if (!entry || typeof entry !== "object") return false;
      const e = entry as Record<string, unknown>;
      return typeof e.id === "string" && typeof e.name === "string" && typeof e.payload === "object";
    });
  } catch {
    return [];
  }
}
