import type { AgeClass } from "@/rules/eligibility/types";

export type SeniorEligibilityLevel = "NONE" | "WITH_PERMIT" | "AUTO";

export type PlayerSeniorEligibility = {
  seniorRosterTeamIds: string[];
  seniorPermitGranted?: boolean;
  seniorPermitTeamIds?: string[];
  nationalityVerified?: boolean;
  residencePermitVerified?: boolean;
};

export function seniorEligibilityByYouthClass(ageClass: AgeClass | null | undefined): SeniorEligibilityLevel {
  if (!ageClass) return "AUTO";
  if (ageClass === "U15" || ageClass === "U16") return "WITH_PERMIT";
  if (ageClass === "U17" || ageClass === "U18" || ageClass === "U19" || ageClass === "U20") return "AUTO";
  return "NONE";
}

export function canPlayerAppearForSeniorTeam(params: {
  youthAgeClass: AgeClass | null | undefined;
  teamLeague: string;
  teamId: string;
  eligibility: PlayerSeniorEligibility;
  isNonEuPlayer?: boolean;
}): boolean {
  const { youthAgeClass, teamLeague, teamId, eligibility, isNonEuPlayer } = params;
  const level = seniorEligibilityByYouthClass(youthAgeClass);

  if (level === "NONE") return false;
  if (!eligibility.seniorRosterTeamIds.includes(teamId)) return false;

  if (level === "WITH_PERMIT") {
    if (!eligibility.seniorPermitGranted) return false;
    if (eligibility.seniorPermitTeamIds?.length && !eligibility.seniorPermitTeamIds.includes(teamId)) return false;
  }

  const normalizedLeague = String(teamLeague ?? "").trim().toUpperCase();
  if (["1RLH", "2RLH", "RLD"].includes(normalizedLeague)) {
    if (!eligibility.nationalityVerified) return false;
    if (isNonEuPlayer && !eligibility.residencePermitVerified) return false;
  }

  return true;
}

