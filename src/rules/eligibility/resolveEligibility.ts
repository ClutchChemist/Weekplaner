import { ELIGIBILITY_RULES, type CompetitionDateOverride, type CompetitionId, type CompetitionRuleConfig } from "./config";

export type EligibilityResult = {
  competition: CompetitionId;
  ageClass: string;
  seasonStartYear: number;
  phase: "regular" | "override";
  coreYears: number[];
  autoEligibleYears: number[];
  conditionalEligibleYears: number[];
  exceptions: string[];
  notes: string[];
  provisional: boolean;
  resolvedBy: "override" | "seasonRule" | "dbbFallback";
  sourceRef?: string;
  sourceVersion: string;
};

export class EligibilityValidationError extends Error {
  code: "invalidAgeClassForCompetition";

  constructor(message: string) {
    super(message);
    this.name = "EligibilityValidationError";
    this.code = "invalidAgeClassForCompetition";
  }
}

const DEFAULT_COMPETITION: CompetitionId = "DBB";
const SUPPORTED_AGES = ["U20", "U19", "U18", "U17", "U16", "U15", "U14", "U13", "U12", "U11", "U10", "U9", "U8"];

type Reachability = "auto" | "conditional" | "none";
type RangeRule = { autoMaxTarget: number; conditionalMaxTarget: number };

const DBB_PLAY_UP_RULES: Record<number, RangeRule> = {
  20: { autoMaxTarget: 20, conditionalMaxTarget: 20 },
  19: { autoMaxTarget: 20, conditionalMaxTarget: 20 },
  18: { autoMaxTarget: 20, conditionalMaxTarget: 20 },
  17: { autoMaxTarget: 20, conditionalMaxTarget: 20 },
  16: { autoMaxTarget: 20, conditionalMaxTarget: 20 },
  15: { autoMaxTarget: 20, conditionalMaxTarget: 20 },
  14: { autoMaxTarget: 17, conditionalMaxTarget: 19 },
  13: { autoMaxTarget: 16, conditionalMaxTarget: 18 },
  12: { autoMaxTarget: 15, conditionalMaxTarget: 16 },
  11: { autoMaxTarget: 14, conditionalMaxTarget: 14 },
  10: { autoMaxTarget: 13, conditionalMaxTarget: 13 },
  9: { autoMaxTarget: 12, conditionalMaxTarget: 12 },
  8: { autoMaxTarget: 12, conditionalMaxTarget: 12 },
};

function toIso(date: Date | string): string {
  if (typeof date === "string") return date;
  return date.toISOString().slice(0, 10);
}

function parseAgeClassNumber(ageClass: string): number | null {
  const match = String(ageClass ?? "").trim().toUpperCase().match(/^U(\d{1,2})$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveSeasonStartYear(referenceDate: string, cutoverMMDD: string): number {
  const year = Number.parseInt(referenceDate.slice(0, 4), 10);
  const mmdd = referenceDate.slice(5, 10);
  return mmdd >= cutoverMMDD ? year : year - 1;
}

function getConfig(competition: CompetitionId): CompetitionRuleConfig {
  return ELIGIBILITY_RULES.competitions.find((x) => x.competition === competition)
    ?? ELIGIBILITY_RULES.competitions.find((x) => x.competition === DEFAULT_COMPETITION)!
;
}

function findDateOverride(overrides: CompetitionDateOverride[], referenceDateIso: string, ageClass: string): CompetitionDateOverride | null {
  return (
    overrides.find(
      (x) =>
        x.ageClass.toUpperCase() === ageClass.toUpperCase() &&
        referenceDateIso >= x.from &&
        referenceDateIso <= x.to
    ) ?? null
  );
}

function classifyReachability(sourceAge: number, targetAge: number): Reachability {
  if (sourceAge > targetAge) return "none";
  const rule = DBB_PLAY_UP_RULES[sourceAge];
  if (!rule) return sourceAge === targetAge ? "auto" : "none";
  if (targetAge <= rule.autoMaxTarget) return "auto";
  if (targetAge <= rule.conditionalMaxTarget) return "conditional";
  return "none";
}

function buildExactOverrideResult(
  params: {
    competition: CompetitionId;
    ageClass: string;
    seasonStartYear: number;
    override: CompetitionDateOverride;
  }
): EligibilityResult {
  const { competition, ageClass, seasonStartYear, override } = params;
  const autoYears =
    override.mode === "EXACT_AUTO_YEARS"
      ? [...(override.autoYears ?? [])]
      : Array.from(
          { length: (override.range?.maxBirthYear ?? 0) - (override.range?.minBirthYear ?? 0) + 1 },
          (_, idx) => (override.range?.minBirthYear ?? 0) + idx
        );

  const coreYears = autoYears.length > 0 ? [Math.min(...autoYears)] : [];
  return {
    competition,
    ageClass,
    seasonStartYear,
    phase: "override",
    coreYears,
    autoEligibleYears: Array.from(new Set(autoYears)).sort((a, b) => a - b),
    conditionalEligibleYears: [],
    exceptions: [],
    notes: override.notes ?? [],
    provisional: false,
    resolvedBy: "override",
    sourceRef: override.sourceRef,
    sourceVersion: ELIGIBILITY_RULES.sourceVersion,
  };
}

function seasonBaseYearForAgeClass(
  cfg: CompetitionRuleConfig,
  seasonStartYear: number,
  ageClass: string
): number | null {
  const table = cfg.explicitSeasonTables.find((x) => x.seasonStartYear === seasonStartYear);
  if (table?.baseYears?.[ageClass] !== undefined) return table.baseYears[ageClass];
  const ageNum = parseAgeClassNumber(ageClass);
  if (!ageNum) return null;
  return seasonStartYear - (ageNum - 1);
}

export function resolveEligibility(params: {
  referenceDate: Date | string;
  competition: CompetitionId;
  ageClass: string;
}): EligibilityResult {
  const referenceDateIso = toIso(params.referenceDate);
  const cfg = getConfig(params.competition);
  const ageClass = String(params.ageClass ?? "").toUpperCase();

  if (!cfg.primaryAgeClasses.includes(ageClass)) {
    throw new EligibilityValidationError(
      `invalidAgeClassForCompetition: ${cfg.competition}/${ageClass}`
    );
  }

  const seasonStartYear = deriveSeasonStartYear(referenceDateIso, cfg.defaultSeasonCutover);
  const override = findDateOverride(cfg.dateOverrides, referenceDateIso, ageClass);
  if (override) {
    return buildExactOverrideResult({
      competition: cfg.competition,
      ageClass,
      seasonStartYear,
      override,
    });
  }

  const baseBirthYear = seasonBaseYearForAgeClass(cfg, seasonStartYear, ageClass);
  if (baseBirthYear === null) {
    return {
      competition: cfg.competition,
      ageClass,
      seasonStartYear,
      phase: "regular",
      coreYears: [],
      autoEligibleYears: [],
      conditionalEligibleYears: [],
      exceptions: [],
      notes: [`No base year configured for ${ageClass}`],
      provisional: true,
      resolvedBy: "dbbFallback",
      sourceRef: undefined,
      sourceVersion: ELIGIBILITY_RULES.sourceVersion,
    };
  }

  const targetAgeNum = parseAgeClassNumber(ageClass) ?? 0;
  const auto = new Set<number>();
  const conditional = new Set<number>();

  for (const sourceAgeClass of SUPPORTED_AGES) {
    const sourceAgeNum = parseAgeClassNumber(sourceAgeClass);
    if (!sourceAgeNum) continue;
    const sourceBaseYear = seasonStartYear - (sourceAgeNum - 1);
    const reach = classifyReachability(sourceAgeNum, targetAgeNum);
    if (reach === "auto") auto.add(sourceBaseYear);
    if (reach === "conditional") conditional.add(sourceBaseYear);
  }

  const result: EligibilityResult = {
    competition: cfg.competition,
    ageClass,
    seasonStartYear,
    phase: "regular",
    coreYears: [baseBirthYear],
    autoEligibleYears: Array.from(auto).sort((a, b) => a - b),
    conditionalEligibleYears: Array.from(conditional).sort((a, b) => a - b),
    exceptions: [],
    notes: [],
    provisional: false,
    resolvedBy: "dbbFallback",
    sourceRef: undefined,
    sourceVersion: ELIGIBILITY_RULES.sourceVersion,
  };

  const seasonTable = cfg.explicitSeasonTables.find((x) => x.seasonStartYear === seasonStartYear);
  if (seasonTable?.sourceRef) {
    result.sourceRef = seasonTable.sourceRef;
    result.resolvedBy = "seasonRule";
  }

  for (const rule of cfg.seasonRules.filter((x) => x.ageClass.toUpperCase() === ageClass)) {
    if (rule.ruleType === "OLDER_YEAR_LIMIT" && typeof rule.olderYearLimit === "number") {
      const olderYear = typeof rule.olderYearBirthOffset === "number"
        ? baseBirthYear + rule.olderYearBirthOffset
        : undefined;
      const limitText = `olderYearLimit=${rule.olderYearLimit}`;
      const yearText = olderYear !== undefined ? ` year=${olderYear}` : "";
      const requiresText = rule.olderYearRequires ? ` requires=${rule.olderYearRequires}` : "";
      result.exceptions.push(`${limitText}${yearText}${requiresText}`);
      if (typeof rule.olderYearBirthOffset === "number") {
        result.conditionalEligibleYears = Array.from(
          new Set([
            ...result.conditionalEligibleYears,
            baseBirthYear + rule.olderYearBirthOffset,
          ])
        ).sort((a, b) => a - b);
      }
    }
    if (rule.ruleType === "CUSTOM_NOTE" && rule.note) {
      result.notes.push(rule.note);
    }
    if (rule.sourceRef) {
      result.notes.push(`source:${rule.sourceRef}`);
      result.sourceRef = rule.sourceRef;
      result.resolvedBy = "seasonRule";
    }
  }

  const hasExplicitTable = cfg.explicitSeasonTables.some((x) => x.seasonStartYear === seasonStartYear);
  if (!hasExplicitTable && cfg.fallbackPolicy.markAsProvisionalWhenNoSeasonDoc) {
    result.provisional = true;
    result.notes.push("provisional:no_explicit_season_doc");
  }

  return result;
}

export function getDefaultRosterYearGroups(referenceDate: Date | string, competition: CompetitionId = "DBB"): string[] {
  const ages = ["U19", "U18", "U17"];
  const years = ages
    .map((ageClass) => {
      try {
        return resolveEligibility({ referenceDate, competition, ageClass }).coreYears[0];
      } catch {
        return undefined;
      }
    })
    .filter((year): year is number => Number.isFinite(year));
  const unique = Array.from(new Set(years)).sort((a, b) => a - b);
  return unique.map(String);
}
