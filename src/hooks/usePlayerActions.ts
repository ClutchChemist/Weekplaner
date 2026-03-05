import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Player, WeekPlan } from "@/types";
import { enrichPlayersWithBirthFromDBBTA, upsertPlayerLicenseTna } from "@/state/playerMeta";
import { normalizeRoster } from "@/state/normalizers";
import { birthYearOf, fallbackYearGroupsByFormula } from "@/state/playerGrouping";
import { downloadJson } from "@/utils/json";
import { randomId } from "@/utils/id";
import {
  birthYearFromIso,
  type ImportedMmbRow,
  type MmbImportIssueCode,
  type MmbImportIssue,
  type MmbImportReport,
  lpStatusToFlags,
  parseMmbImportFile,
  splitImportedName,
} from "@/utils/mmbImport";
import { resolveEligibility } from "@/rules/eligibility";
import { normalizeTeamCode } from "@/utils/team";

export type MmbImportFeedback = {
  kind: "success" | "error";
  fileName: string;
  createdCount: number;
  updatedCount: number;
  importedRows: number;
  duplicateRowsSkipped: number;
  missingColumnsSheets: string[];
  issueDetails: Array<{
    code: MmbImportIssueCode;
    label: string;
    sheetName?: string;
    rowNumber?: number;
  }>;
  previewRows: Array<{
    sheetName?: string;
    rowNumber?: number;
    name: string;
    taNumber?: string;
    birthDate?: string;
  }>;
  message?: string;
  sourceType?: "xlsx" | "pdf";
};

export function usePlayerActions({
  players,
  setPlayers,
  rosterMeta,
  setRosterMeta,
  setPlan,
  setSelectedPlayerId,
  setLastDropError,
  t,
  clubName,
}: {
  players: Player[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  rosterMeta: { season: string; ageGroups: unknown };
  setRosterMeta: Dispatch<SetStateAction<{ season: string; ageGroups: unknown }>>;
  setPlan: Dispatch<SetStateAction<WeekPlan>>;
  setSelectedPlayerId: Dispatch<SetStateAction<string | null>>;
  setLastDropError: (err: string | null) => void;
  t: (k: string) => string;
  clubName: string;
}) {
  const [mmbImportFeedback, setMmbImportFeedback] = useState<MmbImportFeedback | null>(null);

  function clearMmbImportFeedback() {
    setMmbImportFeedback(null);
  }

  function missingColumnsSheetsFromReport(report: MmbImportReport): string[] {
    return report.issues
      .filter((issue) => issue.code === "missing_required_columns")
      .map((issue) => issue.sheetName ?? "Unknown");
  }

  function issueToText(issue: MmbImportIssue): string {
    const row = issue.rowNumber ? ` #${issue.rowNumber}` : "";
    const sheet = issue.sheetName ? ` (${issue.sheetName})` : "";
    if (issue.code === "missing_required_columns") return `${t("importMmbIssueMissingColumns")}${sheet}`;
    if (issue.code === "row_missing_name") return `${t("importMmbIssueMissingName")}${row}${sheet}`;
    if (issue.code === "row_invalid_ta") return `${t("importMmbIssueInvalidTa")}${row}${sheet}`;
    if (issue.code === "row_invalid_birth_date") return `${t("importMmbIssueInvalidBirthDate")}${row}${sheet}`;
    return `${issue.code}${row}${sheet}`;
  }

  function issueDetailsForFeedback(report: MmbImportReport): MmbImportFeedback["issueDetails"] {
    return report.issues
      .filter((issue) => issue.code !== "missing_required_columns")
      .slice(0, 50)
      .map((issue) => ({
        code: issue.code,
        label: issueToText(issue),
        sheetName: issue.sheetName,
        rowNumber: issue.rowNumber,
      }));
  }

  function previewRowsForFeedback(rows: ImportedMmbRow[]): MmbImportFeedback["previewRows"] {
    return rows.slice(0, 150).map((row) => ({
      sheetName: row.sourceSheet,
      rowNumber: row.sourceRow,
      name: row.name,
      taNumber: row.taNumber,
      birthDate: row.birthDate,
    }));
  }

  function normalizeTeamCodes(input: string[]): string[] {
    return Array.from(
      new Set(
        input
          .map((x) => normalizeTeamCode(String(x ?? "")))
          .filter(Boolean)
      )
    );
  }

  function derivePrimaryTeams(defaultTeams: string[]): Pick<Player, "primaryYouthTeam" | "primarySeniorTeam"> {
    const teams = normalizeTeamCodes(defaultTeams);
    const primaryYouthTeam = teams.includes("NBBL") ? "NBBL" : teams.includes("U18") ? "U18" : "";
    const primarySeniorTeam = teams.includes("HOL") ? "HOL" : teams.includes("1RLH") ? "1RLH" : "";
    return { primaryYouthTeam, primarySeniorTeam };
  }

  function sanitizeDefaultTeamsByAge(player: Player, defaultTeams: string[]): string[] {
    const teams = normalizeTeamCodes(defaultTeams);
    const year = birthYearOf(player);
    const u18 = resolveEligibility({
      referenceDate: new Date(),
      competition: "WBV",
      ageClass: "U18",
    });
    if (typeof year === "number" && !u18.autoEligibleYears.includes(year)) {
      return teams.filter((team) => team !== "U18");
    }
    return teams;
  }

  function upsertDbbLicense(player: Player, taNumber?: string): Player {
    const tna = String(taNumber ?? "").trim();
    if (!tna) return player;
    return upsertPlayerLicenseTna(player, "DBB", tna);
  }

  function findExistingPlayerIndexForImport(
    prev: Player[],
    params: { taNumber?: string; name: string; birthDate?: string }
  ): number {
    const ta = String(params.taNumber ?? "").trim();
    if (ta) {
      const byTa = prev.findIndex((p) =>
        (p.lizenzen ?? []).some(
          (l) => String(l.typ ?? "").toUpperCase() === "DBB" && String(l.tna ?? "").trim() === ta
        )
      );
      if (byTa >= 0) return byTa;
    }

    const nameKey = String(params.name ?? "").trim().toLowerCase();
    const birthDate = String(params.birthDate ?? "").trim();
    if (!nameKey) return -1;

    return prev.findIndex((p) => {
      if (p.id === "TBD") return false;
      const pName = String(p.name ?? "").trim().toLowerCase();
      if (pName !== nameKey) return false;
      if (!birthDate) return true;
      return String(p.birthDate ?? "").trim() === birthDate;
    });
  }

  function updatePlayer(id: string, patch: Partial<Player>) {
    if (id === "TBD") return;
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (patch.firstName !== undefined || patch.lastName !== undefined) {
          const fn = patch.firstName !== undefined ? patch.firstName : (p.firstName ?? "");
          const ln = patch.lastName !== undefined ? patch.lastName : (p.lastName ?? "");
          const computed = `${fn} ${ln}`.trim();
          next.name = computed || next.name;
        }
        const resolvedDefaults = sanitizeDefaultTeamsByAge(
          next,
          patch.defaultTeams !== undefined ? patch.defaultTeams : (next.defaultTeams ?? [])
        );
        const derived = derivePrimaryTeams(resolvedDefaults);
        next.defaultTeams = resolvedDefaults;
        next.primaryYouthTeam = derived.primaryYouthTeam;
        next.primarySeniorTeam = derived.primarySeniorTeam;
        return next;
      })
    );
  }

  function addNewPlayer() {
    const id = randomId("p_");
    // Dynamically compute current-season youth birth year
    const yearGroups = fallbackYearGroupsByFormula();
    const defaultBirthYear = parseInt(yearGroups[0] ?? "2009", 10);
    const defaultGroup = yearGroups[0] ?? "2009";
    const p: Player = {
      id,
      firstName: t("firstName"),
      lastName: t("name"),
      name: `${t("firstName")} ${t("name")}`,
      birthYear: defaultBirthYear,
      birthDate: "",
      positions: [],
      primaryYouthTeam: "",
      primarySeniorTeam: "",
      defaultTeams: [],
      lizenzen: [],
      isLocalPlayer: false,
      group: defaultGroup,
    };
    setPlayers((prev) => [...prev, p]);
    setSelectedPlayerId(id);
  }

  function deletePlayer(id: string) {
    if (id === "TBD") return;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => ({
        ...s,
        participants: (s.participants ?? []).filter((pid) => pid !== id),
      })),
    }));
    setSelectedPlayerId((prev) => (prev === id ? null : prev));
  }

  async function importRosterFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      let normalized = {
        season: "",
        ageGroups: null as unknown,
        players: [] as Player[],
      };
      if (Array.isArray(json)) {
        const { players: enriched } = enrichPlayersWithBirthFromDBBTA(json as Player[]);
        normalized.players = enriched;
      } else if (json?.players) {
        normalized = normalizeRoster(json);
      } else {
        return;
      }
      const cleaned = normalized.players.filter((p) => String(p.id) !== "TBD");
      setRosterMeta({
        season: normalized.season || rosterMeta.season,
        ageGroups: normalized.ageGroups ?? rosterMeta.ageGroups,
      });
      setPlayers(cleaned);
      setSelectedPlayerId(cleaned[0]?.id ?? null);
      setLastDropError(null);
    } catch (err) {
      setLastDropError(t("importJsonError"));
    }
  }

  async function importMmbFile(file: File) {
    try {
      clearMmbImportFeedback();
      const parsed = await parseMmbImportFile(file);
      const importedRows = parsed.rows;
      const missingColumnsSheets = missingColumnsSheetsFromReport(parsed.report);
      if (!importedRows.length) {
        setMmbImportFeedback({
          kind: "error",
          fileName: file.name,
          createdCount: 0,
          updatedCount: 0,
          importedRows: 0,
          duplicateRowsSkipped: parsed.report.duplicateRowsSkipped,
          missingColumnsSheets,
          issueDetails: issueDetailsForFeedback(parsed.report),
          previewRows: [],
          sourceType: parsed.report.sourceType,
          message: t("importMmbNoRowsError"),
        });
        setLastDropError(t("importMmbNoRowsError"));
        return;
      }

      const next = [...players];
      let createdCount = 0;
      let updatedCount = 0;

      for (const row of importedRows) {
        const split = splitImportedName(row);
        const fullName = split.fullName || row.name.trim();
        if (!fullName) continue;

        const idx = findExistingPlayerIndexForImport(next, {
          taNumber: row.taNumber,
          name: fullName,
          birthDate: row.birthDate,
        });

        const lpFlags = lpStatusToFlags(row.lpStatus);
        const birthYear = birthYearFromIso(row.birthDate);

        if (idx >= 0) {
          let candidate: Player = { ...next[idx] };
          candidate = upsertDbbLicense(candidate, row.taNumber);
          candidate = {
            ...candidate,
            name: fullName,
            firstName: split.firstName || candidate.firstName,
            lastName: split.lastName || candidate.lastName,
            birthDate: row.birthDate ?? candidate.birthDate,
            birthYear: birthYear ?? candidate.birthYear,
            taNumber: row.taNumber ?? candidate.taNumber,
            lpCategory: lpFlags.lpCategory ?? candidate.lpCategory,
            isLocalPlayer:
              lpFlags.isLocalPlayer !== undefined ? lpFlags.isLocalPlayer : candidate.isLocalPlayer,
          };
          next[idx] = candidate;
          updatedCount += 1;
          continue;
        }

        let created: Player = {
          id: randomId("p_"),
          name: fullName,
          firstName: split.firstName,
          lastName: split.lastName,
          birthDate: row.birthDate,
          birthYear,
          lpCategory: lpFlags.lpCategory,
          isLocalPlayer: lpFlags.isLocalPlayer,
          taNumber: row.taNumber,
          positions: [],
          primaryYouthTeam: "",
          primarySeniorTeam: "",
          defaultTeams: [],
          lizenzen: [],
          group: "TBD",
        };
        created = upsertDbbLicense(created, row.taNumber);
        next.push(created);
        createdCount += 1;
      }

      setPlayers(next);
      setMmbImportFeedback({
        kind: "success",
        fileName: file.name,
        createdCount,
        updatedCount,
        importedRows: parsed.report.importedRows,
        duplicateRowsSkipped: parsed.report.duplicateRowsSkipped,
        missingColumnsSheets,
        issueDetails: issueDetailsForFeedback(parsed.report),
        previewRows: previewRowsForFeedback(importedRows),
        sourceType: parsed.report.sourceType,
      });
      setLastDropError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (msg.includes("unsupported_file_type")) {
        setMmbImportFeedback({
          kind: "error",
          fileName: file.name,
          createdCount: 0,
          updatedCount: 0,
          importedRows: 0,
          duplicateRowsSkipped: 0,
          missingColumnsSheets: [],
          issueDetails: [],
          previewRows: [],
          message: t("importMmbUnsupportedTypeError"),
        });
        setLastDropError(t("importMmbUnsupportedTypeError"));
        return;
      }
      setMmbImportFeedback({
        kind: "error",
        fileName: file.name,
        createdCount: 0,
        updatedCount: 0,
        importedRows: 0,
        duplicateRowsSkipped: 0,
        missingColumnsSheets: [],
        issueDetails: [],
        previewRows: [],
        message: `${t("importMmbFailedError")}: ${msg || "unknown error"}`,
      });
      setLastDropError(`${t("importMmbFailedError")}: ${msg || "unknown error"}`);
    }
  }

  function exportRoster() {
    const exportPlayers = players
      .filter((p) => p.id !== "TBD")
      .map((p) => {
        const y = birthYearOf(p);
        return {
          id: p.id,
          name: p.name,
          birthYear: y ?? null,
          isLocalPlayer: !!p.isLocalPlayer,
          lizenzen: (p.lizenzen ?? []).map((l) => ({
            typ: l.typ,
            tna: l.tna,
            verein: l.verein ?? clubName,
          })),
          defaultTeams: p.defaultTeams ?? [],
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          birthDate: p.birthDate ?? "",
          positions: p.positions ?? [],
          group: p.group ?? "",
          lpCategory: p.lpCategory ?? "",
          jerseyByTeam: p.jerseyByTeam ?? {},
          historyLast6: p.historyLast6 ?? [],
          yearColor: p.yearColor ?? null,
        };
      });
    downloadJson("roster.json", {
      season: rosterMeta.season,
      ageGroups: rosterMeta.ageGroups,
      players: exportPlayers,
    });
  }

  return {
    updatePlayer,
    addNewPlayer,
    deletePlayer,
    importRosterFile,
    importMmbFile,
    mmbImportFeedback,
    clearMmbImportFeedback,
    exportRoster,
  };
}
