export const YEAR_GROUPS = ["2007", "2008", "2009"] as const;
export type YearGroup = typeof YEAR_GROUPS[number];
export type GroupId = YearGroup | "Herren" | "TBD";
