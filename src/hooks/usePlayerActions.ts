import type { Dispatch, SetStateAction } from "react";
import type { Player, WeekPlan } from "@/types";
import { enrichPlayersWithBirthFromDBBTA } from "@/state/playerMeta";
import { normalizeRoster } from "@/state/normalizers";
import { birthYearOf } from "@/state/playerGrouping";
import { downloadJson } from "@/utils/json";
import { randomId } from "@/utils/id";
import {
  birthYearFromIso,
  lpStatusToFlags,
  parseMmbImportFile,
  splitImportedName,
} from "@/utils/mmbImport";
import { resolveEligibility } from "@/rules/eligibility";
import { normalizeTeamCode } from "@/utils/team";

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
    const list = [...(player.lizenzen ?? [])];
    const idx = list.findIndex((x) => String(x.typ ?? "").toUpperCase() === "DBB");
    if (idx >= 0) {
      list[idx] = { ...list[idx], tna };
    } else {
      list.push({ typ: "DBB", tna, verein: clubName || undefined });
    }
    return { ...player, lizenzen: list };
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
    const p: Player = {
      id,
      firstName: t("firstName"),
      lastName: t("name"),
      name: `${t("firstName")} ${t("name")}`,
      birthYear: 2009,
      birthDate: "",
      positions: [],
      primaryYouthTeam: "",
      primarySeniorTeam: "",
      defaultTeams: [],
      lizenzen: [],
      isLocalPlayer: false,
      group: "2009",
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
      console.warn("Roster import failed", err);
      setLastDropError(t("importJsonError"));
    }
  }

  async function importMmbFile(file: File) {
    try {
      const importedRows = await parseMmbImportFile(file);
      if (!importedRows.length) {
        setLastDropError(t("importMmbNoRowsError"));
        return;
      }

      setPlayers((prev) => {
        const next = [...prev];

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
        }
        return next;
      });
      setLastDropError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (msg.includes("unsupported_file_type")) {
        setLastDropError(t("importMmbUnsupportedTypeError"));
        return;
      }
      console.warn("MMB import failed", err);
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
            verein: l.verein ?? "UBC MÃ¼nster",
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
    exportRoster,
  };
}
