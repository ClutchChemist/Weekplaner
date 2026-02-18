import type { ThemeSettings } from "../state/types";

export type LocationOption = {
  value: string;
  label: string;
  kind: "preset" | "saved" | "custom";
};

export type LocationUsageMap = Record<string, number>;

export function buildLocationUsageMap(sessions: Array<{ location?: string | null }>): LocationUsageMap {
  const usage: LocationUsageMap = {};
  for (const s of sessions) {
    const loc = String(s?.location ?? "").trim();
    if (!loc) continue;
    usage[loc] = (usage[loc] ?? 0) + 1;
  }
  return usage;
}

export function sortLocationNamesByUsage(names: string[], usageMap: LocationUsageMap = {}): string[] {
  return [...names].sort((a, b) => {
    const diff = (usageMap[b] ?? 0) - (usageMap[a] ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "de");
  });
}

export function splitAddressLines(addr: string) {
  const cleaned = String(addr ?? "").trim();
  if (!cleaned) return [];
  const parts = cleaned.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [cleaned];
}

export function resolveLocationAddress(location: string, theme: ThemeSettings): string {
  const loc = (location || "").trim();
  const L = theme.locations ?? {};
  if (!loc) return "";

  if (L.locations?.[loc]?.address) return L.locations[loc].address;
  if (loc === "BSH") return L.bsh ?? "";
  if (loc === "SHP") return L.shp ?? "";
  if (loc === "Seminarraum") return L.seminarraum ?? "";

  return L.custom?.[loc] ?? "";
}

export function resolveLocationPlaceId(location: string, theme: ThemeSettings): string {
  const loc = (location || "").trim();
  const L = theme.locations ?? {};
  if (!loc) return "";
  return L.locations?.[loc]?.placeId ?? "";
}

export function getLocationOptions(
  theme: ThemeSettings,
  t: (key: string) => string,
  usageMap: LocationUsageMap = {}
): LocationOption[] {
  const L = theme.locations ?? {};
  const locs = L.locations ?? {};
  const defs = L.definitions ?? {};

  const presetNames = ["BSH", "SHP", "Seminarraum"];

  const allNames = Array.from(new Set([...presetNames, ...Object.keys(locs)]));

  const items: LocationOption[] = sortLocationNamesByUsage(allNames, usageMap).map((name) => {
    const d = defs[name] ?? { abbr: "", name, hallNo: "" };
    const hall = d.hallNo ? ` • ${t("hall")} ${d.hallNo}` : "";
    const abbr = d.abbr ? ` (${d.abbr})` : "";
    const isPreset = presetNames.includes(name);
    return { value: name, label: `${d.name || name}${abbr}${hall}`, kind: isPreset ? "preset" : "saved" };
  });

  return [
    ...items,
    { value: "__CUSTOM__", label: `— ${t("custom")} / ${t("freeText")} —`, kind: "custom" },
  ];
}

export function ensureLocationSaved(
  theme: ThemeSettings,
  setTheme: (t: ThemeSettings) => void,
  rawName: string
) {
  const name = String(rawName ?? "").trim().replace(/\s+/g, " ");
  if (!name) return;

  const L = theme.locations ?? {};
  const locs = { ...(L.locations ?? {}) };
  const defs = { ...(L.definitions ?? {}) };

  if (!locs[name]) {
    locs[name] = { address: "", placeId: "" };
  }

  if (!defs[name]) {
    defs[name] = { abbr: "", name, hallNo: "" };
  }

  setTheme({
    ...theme,
    locations: {
      ...L,
      locations: locs,
      definitions: defs,
    },
  });
}

export function getCachedTravelMinutes(
  homePlaceId: string,
  destPlaceId: string,
  theme: ThemeSettings
): number | null {
  const cache = theme.locations?.travelCache ?? {};
  const key = `${homePlaceId}|${destPlaceId}|DRIVE`;
  const entry = cache[key];
  if (!entry) return null;

  const ttl = 7 * 24 * 60 * 60 * 1000;
  const age = Date.now() - entry.cachedAt;
  if (age > ttl) return null;

  return entry.minutes;
}

export function setCachedTravelMinutes(
  homePlaceId: string,
  destPlaceId: string,
  minutes: number,
  theme: ThemeSettings,
  setTheme: (t: ThemeSettings) => void
) {
  const key = `${homePlaceId}|${destPlaceId}|DRIVE`;
  setTheme({
    ...theme,
    locations: {
      ...(theme.locations ?? {}),
      travelCache: {
        ...(theme.locations?.travelCache ?? {}),
        [key]: { minutes, cachedAt: Date.now() },
      },
    },
  });
}
