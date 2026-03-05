import { describe, expect, it } from "vitest";
import { EligibilityValidationError, resolveEligibility } from "@/rules/eligibility";

describe("eligibility engine", () => {
  it("1) 2025-07-31 DBB U18", () => {
    const r = resolveEligibility({ referenceDate: "2025-07-31", competition: "DBB", ageClass: "U18" });
    expect(r.seasonStartYear).toBe(2024);
    expect(r.coreYears).toEqual([2007]);
    expect(r.autoEligibleYears).toEqual([2007, 2008, 2009, 2010]);
    expect(r.conditionalEligibleYears).toEqual([2011, 2012]);
  });

  it("2) 2025-08-01 DBB U18", () => {
    const r = resolveEligibility({ referenceDate: "2025-08-01", competition: "DBB", ageClass: "U18" });
    expect(r.seasonStartYear).toBe(2025);
    expect(r.coreYears).toEqual([2008]);
    expect(r.autoEligibleYears).toEqual([2008, 2009, 2010, 2011]);
    expect(r.conditionalEligibleYears).toEqual([2012, 2013]);
  });

  it("3) 2025-07-31 DBB U16", () => {
    const r = resolveEligibility({ referenceDate: "2025-07-31", competition: "DBB", ageClass: "U16" });
    expect(r.seasonStartYear).toBe(2024);
    expect(r.coreYears).toEqual([2009]);
    expect(r.autoEligibleYears).toEqual([2009, 2010, 2011, 2012]);
    expect(r.conditionalEligibleYears).toEqual([2013]);
  });

  it("4) 2025-08-01 DBB U16", () => {
    const r = resolveEligibility({ referenceDate: "2025-08-01", competition: "DBB", ageClass: "U16" });
    expect(r.seasonStartYear).toBe(2025);
    expect(r.coreYears).toEqual([2010]);
    expect(r.autoEligibleYears).toEqual([2010, 2011, 2012, 2013]);
    expect(r.conditionalEligibleYears).toEqual([2014]);
  });

  it("5) 2025-06-14 WBV U18 override", () => {
    const r = resolveEligibility({ referenceDate: "2025-06-14", competition: "WBV", ageClass: "U18" });
    expect(r.phase).toBe("override");
    expect(r.autoEligibleYears).toEqual([2008, 2009]);
    expect(r.notes.join(" ")).toContain("2. Mannschaft");
    expect(r.notes.join(" ")).toContain("2009");
  });

  it("6) 2025-06-15 WBV U16 override", () => {
    const r = resolveEligibility({ referenceDate: "2025-06-15", competition: "WBV", ageClass: "U16" });
    expect(r.phase).toBe("override");
    expect(r.autoEligibleYears).toEqual([2010, 2011]);
    expect(r.notes.join(" ")).toContain("2. Mannschaft");
    expect(r.notes.join(" ")).toContain("2011");
  });

  it("7) 2025-06-16 WBV U18 regular fallback", () => {
    const r = resolveEligibility({ referenceDate: "2025-06-16", competition: "WBV", ageClass: "U18" });
    expect(r.phase).toBe("regular");
    expect(r.seasonStartYear).toBe(2024);
    expect(r.coreYears).toEqual([2007]);
  });

  it("8) 2025-08-01 WBV U18 with older year exception", () => {
    const r = resolveEligibility({ referenceDate: "2025-08-01", competition: "WBV", ageClass: "U18" });
    expect(r.seasonStartYear).toBe(2025);
    expect(r.coreYears).toEqual([2008]);
    expect(r.autoEligibleYears).toEqual([2008, 2009, 2010, 2011]);
    expect(r.conditionalEligibleYears).toEqual([2007, 2012, 2013]);
    expect(r.exceptions.join(" ")).toContain("olderYearLimit=1");
    expect(r.exceptions.join(" ")).toContain("year=2007");
    expect(r.exceptions.join(" ")).toContain("NBBL_TA");
  });

  it("9) 2025-08-01 WBV U16 with older year exception", () => {
    const r = resolveEligibility({ referenceDate: "2025-08-01", competition: "WBV", ageClass: "U16" });
    expect(r.seasonStartYear).toBe(2025);
    expect(r.coreYears).toEqual([2010]);
    expect(r.autoEligibleYears).toEqual([2010, 2011, 2012, 2013]);
    expect(r.conditionalEligibleYears).toEqual([2009, 2014]);
    expect(r.exceptions.join(" ")).toContain("olderYearLimit=1");
    expect(r.exceptions.join(" ")).toContain("year=2009");
    expect(r.exceptions.join(" ")).toContain("JBBL_TA");
  });

  it("10) 2025-06-21 NBBL U19 qualification override", () => {
    const r = resolveEligibility({ referenceDate: "2025-06-21", competition: "NBBL", ageClass: "U19" });
    expect(r.phase).toBe("override");
    expect(r.autoEligibleYears).toEqual([2007, 2008, 2009, 2010, 2011, 2012]);
  });

  it("11) 2025-06-29 NBBL U19 qualification override", () => {
    const r = resolveEligibility({ referenceDate: "2025-06-29", competition: "NBBL", ageClass: "U19" });
    expect(r.phase).toBe("override");
    expect(r.autoEligibleYears).toEqual([2007, 2008, 2009, 2010, 2011, 2012]);
  });

  it("12) 2025-06-30 NBBL U19 regular provisional", () => {
    const r = resolveEligibility({ referenceDate: "2025-06-30", competition: "NBBL", ageClass: "U19" });
    expect(r.phase).toBe("regular");
    expect(r.seasonStartYear).toBe(2024);
    expect(r.coreYears).toEqual([2006]);
    expect(r.provisional).toBe(true);
  });

  it("13) 2025-08-01 NBBL U19 regular provisional", () => {
    const r = resolveEligibility({ referenceDate: "2025-08-01", competition: "NBBL", ageClass: "U19" });
    expect(r.seasonStartYear).toBe(2025);
    expect(r.coreYears).toEqual([2007]);
    expect(r.provisional).toBe(true);
  });

  it("14) 2025-08-01 JBBL U16 regular provisional", () => {
    const r = resolveEligibility({ referenceDate: "2025-08-01", competition: "JBBL", ageClass: "U16" });
    expect(r.seasonStartYear).toBe(2025);
    expect(r.coreYears).toEqual([2010]);
    expect(r.autoEligibleYears).toEqual([2010, 2011, 2012, 2013]);
    expect(r.conditionalEligibleYears).toEqual([2014]);
    expect(r.provisional).toBe(true);
  });

  it("15) 2025-08-01 NBBL U18 validation error", () => {
    try {
      resolveEligibility({ referenceDate: "2025-08-01", competition: "NBBL", ageClass: "U18" });
      throw new Error("expected validation error");
    } catch (err) {
      expect(err).toBeInstanceOf(EligibilityValidationError);
      expect((err as EligibilityValidationError).code).toBe("invalidAgeClassForCompetition");
    }
  });

  it("16) 2025-08-01 JBBL U19 validation error", () => {
    try {
      resolveEligibility({ referenceDate: "2025-08-01", competition: "JBBL", ageClass: "U19" });
      throw new Error("expected validation error");
    } catch (err) {
      expect(err).toBeInstanceOf(EligibilityValidationError);
      expect((err as EligibilityValidationError).code).toBe("invalidAgeClassForCompetition");
    }
  });
});

