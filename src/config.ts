import { getDefaultRosterYearGroups } from "./rules/eligibility";

export const YEAR_GROUPS = getDefaultRosterYearGroups(new Date(), "DBB");
export type YearGroup = string;
export type GroupId = string;
