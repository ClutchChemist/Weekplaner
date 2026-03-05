import type { Player } from "@/types";

export const BASE_TEAM_OPTIONS = ["U18", "NBBL", "HOL", "1RLH"] as const;

export function normalizeTeamCode(value: string): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "";
  if (normalized === "RLH") return "1RLH";
  return normalized;
}

export function getRequiredTaTypeForTeams(teams: string[]): "NBBL" | "JBBL" | "DBB" | null {
  const normalized = teams.map((team) => normalizeTeamCode(team));
  if (normalized.includes("NBBL")) return "NBBL";
  if (normalized.includes("JBBL")) return "JBBL";
  if (normalized.some((team) => team === "U18" || team === "HOL" || team === "1RLH")) return "DBB";
  return null;
}

export function getLicenseTnaByType(player: Player, typ: string): string {
  const wanted = String(typ ?? "").trim().toUpperCase();
  if (!wanted) return "";
  return (
    (player.lizenzen ?? []).find((x) => String(x.typ ?? "").trim().toUpperCase() === wanted)?.tna ?? ""
  ).trim();
}

