import { useMemo } from "react";
import { buildLocationUsageMap } from "@/utils/locations";

export function useLocationUsageMap(sessions: Array<{ location?: string | null }>) {
  return useMemo(() => buildLocationUsageMap(sessions), [sessions]);
}
