import { describe, expect, it } from "vitest";
import { canPlayerAppearForSeniorTeam, seniorEligibilityByYouthClass } from "@/rules/eligibility";

describe("senior eligibility", () => {
  it("maps youth classes correctly", () => {
    expect(seniorEligibilityByYouthClass("U14")).toBe("NONE");
    expect(seniorEligibilityByYouthClass("U16")).toBe("WITH_PERMIT");
    expect(seniorEligibilityByYouthClass("U18")).toBe("AUTO");
  });

  it("blocks U14 for senior team", () => {
    const allowed = canPlayerAppearForSeniorTeam({
      youthAgeClass: "U14",
      teamLeague: "HOL",
      teamId: "hol-a",
      eligibility: { seniorRosterTeamIds: ["hol-a"] },
    });
    expect(allowed).toBe(false);
  });

  it("requires permit for U16", () => {
    const denied = canPlayerAppearForSeniorTeam({
      youthAgeClass: "U16",
      teamLeague: "HOL",
      teamId: "hol-a",
      eligibility: { seniorRosterTeamIds: ["hol-a"], seniorPermitGranted: false },
    });
    expect(denied).toBe(false);

    const allowed = canPlayerAppearForSeniorTeam({
      youthAgeClass: "U16",
      teamLeague: "HOL",
      teamId: "hol-a",
      eligibility: { seniorRosterTeamIds: ["hol-a"], seniorPermitGranted: true, seniorPermitTeamIds: ["hol-a"] },
    });
    expect(allowed).toBe(true);
  });

  it("enforces nationality proof for 1RLH", () => {
    const denied = canPlayerAppearForSeniorTeam({
      youthAgeClass: "U18",
      teamLeague: "1RLH",
      teamId: "rlh-a",
      eligibility: { seniorRosterTeamIds: ["rlh-a"], nationalityVerified: false },
    });
    expect(denied).toBe(false);

    const allowed = canPlayerAppearForSeniorTeam({
      youthAgeClass: "U18",
      teamLeague: "1RLH",
      teamId: "rlh-a",
      eligibility: { seniorRosterTeamIds: ["rlh-a"], nationalityVerified: true },
    });
    expect(allowed).toBe(true);
  });
});

