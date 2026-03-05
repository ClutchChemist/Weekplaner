export { ELIGIBILITY_RULES, type CompetitionId, type CompetitionRuleConfig } from "./config";
export {
  EligibilityValidationError,
  getDefaultRosterYearGroups,
  resolveEligibility,
  type EligibilityResult,
} from "./resolveEligibility";
export {
  canPlayerAppearForSeniorTeam,
  seniorEligibilityByYouthClass,
  type PlayerSeniorEligibility,
  type SeniorEligibilityLevel,
} from "./seniorEligibility";
export type { AgeClass } from "./types";
