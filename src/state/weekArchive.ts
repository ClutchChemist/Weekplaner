import type { WeekPlan } from "./types";

export type WeekArchiveEntry = {
  id: string;
  savedAt: string;
  label: string;
  profileId: string;
  plan: WeekPlan;
};

export const WEEK_ARCHIVE_STORAGE_KEY = "ubc_week_archive_v1";

export function safeParseWeekArchive(raw: string | null): Record<string, WeekArchiveEntry[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const src = parsed as Record<string, unknown>;
    const out: Record<string, WeekArchiveEntry[]> = {};

    for (const [key, value] of Object.entries(src)) {
      if (!Array.isArray(value)) continue;

      out[key] = value
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const e = item as Record<string, unknown>;
          if (
            typeof e.id !== "string" ||
            typeof e.savedAt !== "string" ||
            typeof e.label !== "string" ||
            typeof e.profileId !== "string" ||
            !e.plan ||
            typeof e.plan !== "object"
          ) {
            return null;
          }

          return {
            id: e.id,
            savedAt: e.savedAt,
            label: e.label,
            profileId: e.profileId,
            plan: e.plan as WeekPlan,
          } satisfies WeekArchiveEntry;
        })
        .filter((entry): entry is WeekArchiveEntry => Boolean(entry));
    }

    return out;
  } catch {
    return {};
  }
}
