import type { GroupId, Player } from "./types";

export const GROUPS: Array<{
  id: GroupId;
  label: string;
  order: number;
}> = [
  { id: "2007", label: "2007", order: 0 },
  { id: "2008", label: "2008", order: 1 },
  { id: "2009", label: "2009", order: 2 },
  { id: "Herren", label: "Herren", order: 3 },
  { id: "TBD", label: "TBD", order: 4 },
];

const GROUP_ORDER = new Map<GroupId, number>(GROUPS.map((g) => [g.id, g.order]));

export const PRINT_GROUP_ORDER: GroupId[] = ["2007", "2008", "2009", "Herren", "TBD"];

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

  if (y === 2007) return "2007";
  if (y === 2008) return "2008";
  if (y === 2009) return "2009";

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
  return (aId: string, bId: string) => {
    const a = playerById.get(aId);
    const b = playerById.get(bId);

    const ga = a ? getPlayerGroup(a) : "2009";
    const gb = b ? getPlayerGroup(b) : "2009";

    const oa = GROUP_ORDER.get(ga) ?? 999;
    const ob = GROUP_ORDER.get(gb) ?? 999;
    if (oa !== ob) return oa - ob;

    const aName = ((a?.name ?? aId) || "").toLowerCase();
    const bName = ((b?.name ?? bId) || "").toLowerCase();
    return aName.localeCompare(bName, "de");
  };
}
