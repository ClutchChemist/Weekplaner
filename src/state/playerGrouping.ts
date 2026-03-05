import { YEAR_GROUPS, type GroupId } from "@/config";
import type { Player } from "./types";

export const GROUPS: Array<{
  id: GroupId;
  label: string;
  order: number;
}> = [
  ...YEAR_GROUPS.map((year, idx) => ({ id: year, label: year, order: idx })),
  { id: "Herren", label: "Herren", order: YEAR_GROUPS.length },
  { id: "TBD", label: "TBD", order: YEAR_GROUPS.length + 1 },
];

const GROUP_ORDER = new Map<GroupId, number>(GROUPS.map((g) => [g.id, g.order]));

export const PRINT_GROUP_ORDER: GroupId[] = [...YEAR_GROUPS, "Herren", "TBD"];

export function birthYearOf(p: Player): number | null {
  if (p.birthDate && p.birthDate.length >= 4) {
    const y = parseInt(p.birthDate.slice(0, 4), 10);
    if (Number.isFinite(y)) return y;
  }
  if (typeof p.birthYear === "number" && Number.isFinite(p.birthYear)) return p.birthYear;
  return null;
}

export function getPlayerGroup(p: Player): GroupId {
  if (p.id === "TBD" || (p.name ?? "").toLowerCase() === "tbd") return "TBD";

  const teams = (p.defaultTeams ?? []).map((x) => String(x).toUpperCase());
  const y = birthYearOf(p);

  if (y !== null) {
    const yStr = String(y);
    if (YEAR_GROUPS.includes(yStr)) return yStr;
  }

  if (p.group) return p.group;

  if (teams.includes("1RLH") || teams.includes("HOL")) return "Herren";

  return "TBD";
}

function teamSet(p: Player) {
  return new Set((p.defaultTeams ?? []).map((x) => String(x).toUpperCase()));
}

export function isCorePlayer(p: Player): boolean {
  if (p.id === "TBD") return true;
  const t = teamSet(p);
  return t.has("NBBL") || t.has("1RLH");
}

export function isU18Only(p: Player): boolean {
  if (p.id === "TBD") return false;
  const t = teamSet(p);
  return t.has("U18") && !t.has("NBBL") && !t.has("1RLH") && !t.has("HOL");
}

export function isHolOnly(p: Player): boolean {
  if (p.id === "TBD") return false;
  const t = teamSet(p);
  return t.has("HOL") && !t.has("NBBL") && !t.has("1RLH");
}

export function makeParticipantSorter(playerById: Map<string, Player>) {
  const fallbackGroup = YEAR_GROUPS[YEAR_GROUPS.length - 1] ?? "TBD";
  return (aId: string, bId: string) => {
    const a = playerById.get(aId);
    const b = playerById.get(bId);

    const ga = a ? getPlayerGroup(a) : fallbackGroup;
    const gb = b ? getPlayerGroup(b) : fallbackGroup;

    const oa = GROUP_ORDER.get(ga) ?? 999;
    const ob = GROUP_ORDER.get(gb) ?? 999;
    if (oa !== ob) return oa - ob;

    const aName = ((a?.name ?? aId) || "").toLowerCase();
    const bName = ((b?.name ?? bId) || "").toLowerCase();
    return aName.localeCompare(bName, "de");
  };
}

