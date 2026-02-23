import type { Dispatch, SetStateAction } from "react";
import type { Player, WeekPlan } from "@/types";
import { enrichPlayersWithBirthFromDBBTA } from "@/state/playerMeta";
import { normalizeRoster } from "@/state/normalizers";
import { birthYearOf } from "@/state/playerGrouping";
import { downloadJson } from "@/utils/json";
import { randomId } from "@/utils/id";

export function usePlayerActions({
  players,
  setPlayers,
  rosterMeta,
  setRosterMeta,
  setPlan,
  setSelectedPlayerId,
  setLastDropError,
  t,
}: {
  players: Player[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  rosterMeta: { season: string; ageGroups: unknown };
  setRosterMeta: Dispatch<SetStateAction<{ season: string; ageGroups: unknown }>>;
  setPlan: Dispatch<SetStateAction<WeekPlan>>;
  setSelectedPlayerId: Dispatch<SetStateAction<string | null>>;
  setLastDropError: (err: string | null) => void;
  t: (k: string) => string;
}) {
  function updatePlayer(id: string, patch: Partial<Player>) {
    if (id === "TBD") return;
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (patch.firstName !== undefined || patch.lastName !== undefined) {
          const fn =
            patch.firstName !== undefined
              ? patch.firstName
              : (p.firstName ?? "");
          const ln =
            patch.lastName !== undefined ? patch.lastName : (p.lastName ?? "");
          const computed = `${fn} ${ln}`.trim();
          next.name = computed || next.name;
        }
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
        const { players: enriched } = enrichPlayersWithBirthFromDBBTA(
          json as Player[]
        );
        normalized.players = enriched;
      } else if (json?.players) {
        normalized = normalizeRoster(json);
      } else {
        return;
      }
      const cleaned = normalized.players.filter(
        (p) => String(p.id) !== "TBD"
      );
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
            verein: l.verein ?? "UBC Münster",
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
    exportRoster,
  };
}
