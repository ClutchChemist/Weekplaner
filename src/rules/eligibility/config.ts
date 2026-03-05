export type CompetitionId = "DBB" | "WBV" | "NBBL" | "JBBL";

export type DateOverrideMode = "EXACT_AUTO_YEARS" | "EXACT_RANGE";
export type RuleType = "OLDER_YEAR_LIMIT" | "CUSTOM_NOTE";

export type CompetitionDateOverride = {
  from: string;
  to: string;
  ageClass: string;
  mode: DateOverrideMode;
  autoYears?: number[];
  range?: {
    minBirthYear: number;
    maxBirthYear: number;
  };
  notes?: string[];
  sourceRef?: string;
};

export type CompetitionSeasonRule = {
  ageClass: string;
  ruleType: RuleType;
  olderYearLimit?: number;
  olderYearRequires?: string;
  olderYearBirthOffset?: number;
  note?: string;
  sourceRef?: string;
};

export type CompetitionRuleConfig = {
  competition: CompetitionId;
  defaultSeasonCutover: string;
  primaryAgeClasses: string[];
  ageClassBaseMode: "FORMULA" | "EXPLICIT_TABLE";
  explicitSeasonTables: Array<{
    seasonStartYear: number;
    baseYears: Record<string, number>;
    sourceRef?: string;
  }>;
  dateOverrides: CompetitionDateOverride[];
  seasonRules: CompetitionSeasonRule[];
  fallbackPolicy: {
    allowDBBPlayUpDefault: boolean;
    markAsProvisionalWhenNoSeasonDoc: boolean;
  };
};

export const ELIGIBILITY_RULES: { sourceVersion: string; competitions: CompetitionRuleConfig[] } = {
  sourceVersion: "2025.1",
  competitions: [
    {
      competition: "DBB",
      defaultSeasonCutover: "08-01",
      primaryAgeClasses: [
        "U20",
        "U19",
        "U18",
        "U17",
        "U16",
        "U15",
        "U14",
        "U13",
        "U12",
        "U11",
        "U10",
        "U9",
        "U8",
      ],
      ageClassBaseMode: "FORMULA",
      explicitSeasonTables: [
        {
          seasonStartYear: 2025,
          baseYears: {
            U20: 2006,
            U19: 2007,
            U18: 2008,
            U17: 2009,
            U16: 2010,
            U15: 2011,
            U14: 2012,
            U13: 2013,
            U12: 2014,
            U11: 2015,
            U10: 2016,
            U9: 2017,
            U8: 2018,
          },
          sourceRef: "DBB Wichtige Hinweise 2025/26, Ziff. 3.1",
        },
      ],
      dateOverrides: [],
      seasonRules: [],
      fallbackPolicy: {
        allowDBBPlayUpDefault: true,
        markAsProvisionalWhenNoSeasonDoc: false,
      },
    },
    {
      competition: "WBV",
      defaultSeasonCutover: "08-01",
      primaryAgeClasses: ["U18", "U17", "U16", "U15", "U14", "U13", "U12", "U11", "U10"],
      ageClassBaseMode: "EXPLICIT_TABLE",
      explicitSeasonTables: [
        {
          seasonStartYear: 2025,
          baseYears: {
            U18: 2008,
            U17: 2009,
            U16: 2010,
            U15: 2011,
            U14: 2012,
            U13: 2013,
            U12: 2014,
            U11: 2015,
            U10: 2016,
          },
          sourceRef: "WBV Ausschreibung 2025/26, C.2.1",
        },
      ],
      dateOverrides: [
        {
          from: "2025-06-14",
          to: "2025-06-14",
          ageClass: "U18",
          mode: "EXACT_AUTO_YEARS",
          autoYears: [2008, 2009],
          notes: [
            "WBV Jugend-Qualifikation männlich/offen 1. Mannschaft",
            "2. Mannschaft nur älterer Jahrgang ausgeschlossen -> effektiv nur 2009",
          ],
          sourceRef: "WBV Quali 2025/26 männlich/offen",
        },
        {
          from: "2025-06-15",
          to: "2025-06-15",
          ageClass: "U16",
          mode: "EXACT_AUTO_YEARS",
          autoYears: [2010, 2011],
          notes: [
            "WBV Jugend-Qualifikation männlich/offen 1. Mannschaft",
            "2. Mannschaft nur älterer Jahrgang ausgeschlossen -> effektiv nur 2011",
          ],
          sourceRef: "WBV Quali 2025/26 männlich/offen",
        },
      ],
      seasonRules: [
        {
          ageClass: "U18",
          ruleType: "OLDER_YEAR_LIMIT",
          olderYearLimit: 1,
          olderYearRequires: "NBBL_TA",
          olderYearBirthOffset: -1,
          sourceRef: "WBV Ausschreibung 2025/26, C.2.3",
        },
        {
          ageClass: "U16",
          ruleType: "OLDER_YEAR_LIMIT",
          olderYearLimit: 1,
          olderYearRequires: "JBBL_TA",
          olderYearBirthOffset: -1,
          sourceRef: "WBV Ausschreibung 2025/26, C.2.3",
        },
      ],
      fallbackPolicy: {
        allowDBBPlayUpDefault: true,
        markAsProvisionalWhenNoSeasonDoc: false,
      },
    },
    {
      competition: "NBBL",
      defaultSeasonCutover: "08-01",
      primaryAgeClasses: ["U19"],
      ageClassBaseMode: "FORMULA",
      explicitSeasonTables: [],
      dateOverrides: [
        {
          from: "2025-06-21",
          to: "2025-06-29",
          ageClass: "U19",
          mode: "EXACT_RANGE",
          range: {
            minBirthYear: 2007,
            maxBirthYear: 2012,
          },
          notes: [
            "Gilt nur für NBBL-Qualifikation 2025/26",
            "Qualifikation zählt zum Wettbewerb 2025/26",
          ],
          sourceRef: "NBBL Quali 2025/26, Ziff. 2/4/9",
        },
      ],
      seasonRules: [],
      fallbackPolicy: {
        allowDBBPlayUpDefault: true,
        markAsProvisionalWhenNoSeasonDoc: true,
      },
    },
    {
      competition: "JBBL",
      defaultSeasonCutover: "08-01",
      primaryAgeClasses: ["U16"],
      ageClassBaseMode: "FORMULA",
      explicitSeasonTables: [],
      dateOverrides: [],
      seasonRules: [],
      fallbackPolicy: {
        allowDBBPlayUpDefault: true,
        markAsProvisionalWhenNoSeasonDoc: true,
      },
    },
  ],
};
