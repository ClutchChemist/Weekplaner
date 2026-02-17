import { addDaysISO, isoWeekMonday, normalizeDash, weekdayOffsetFromDEShort, weekdayShortDE } from "../utils/date";
import { randomId } from "../utils/id";
import { enrichPlayersWithBirthFromDBBTA, safeNameSplit } from "./playerMeta";
import type {
  GroupId,
  Lizenz,
  Player,
  Position,
  SeniorTeam,
  Session,
  WeekPlan,
  YouthTeam,
} from "./types";

export function normalizeRoster(input: unknown): { season: string; ageGroups: unknown; players: Player[] } {
  const root = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
  const season = String(root.season ?? "");
  const ageGroups = root.ageGroups ?? null;
  const list = Array.isArray(root.players) ? root.players : [];

  const players: Player[] = list.map((raw) => {
    const r = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
    const id = String(r.id ?? randomId("p_"));
    const name = String(r.name ?? "Spieler");
    const split = safeNameSplit(name);

    const birthYear = typeof r.birthYear === "number" ? r.birthYear : undefined;
    const isLocalPlayer = typeof r.isLocalPlayer === "boolean" ? r.isLocalPlayer : undefined;

    const lizenzen: Lizenz[] = Array.isArray(r.lizenzen)
      ? r.lizenzen
          .map((rawLic) => {
            const x = (rawLic && typeof rawLic === "object") ? (rawLic as Record<string, unknown>) : {};
            return {
              typ: String(x.typ ?? ""),
              tna: String(x.tna ?? ""),
              verein: x.verein ? String(x.verein) : undefined,
            };
          })
          .filter((x: Lizenz) => x.typ)
      : [];

    const defaultTeams = Array.isArray(r.defaultTeams)
      ? (r.defaultTeams as unknown[])
          .map((x) => String(x).toUpperCase().replaceAll(".1", "").replaceAll(".2", ""))
      : [];

    const primaryYouthTeam: YouthTeam =
      defaultTeams.includes("NBBL") ? "NBBL" : defaultTeams.includes("U18") ? "U18" : "";

    const primarySeniorTeam: SeniorTeam =
      defaultTeams.includes("HOL") ? "HOL" : defaultTeams.includes("1RLH") ? "1RLH" : "";

    const p: Player = {
      id,
      name,

      firstName: r.firstName ? String(r.firstName) : split.firstName,
      lastName: r.lastName ? String(r.lastName) : split.lastName,

      birthYear,
      birthDate: r.birthDate ? String(r.birthDate) : undefined,

      positions: Array.isArray(r.positions)
        ? ((r.positions as unknown[]).map((x) => String(x)) as Position[])
        : [],

      isLocalPlayer,
      lpCategory: r.lpCategory ? String(r.lpCategory) : undefined,
      lizenzen,
      defaultTeams,

      primaryYouthTeam,
      primarySeniorTeam,

      group: (r.group ? String(r.group) : undefined) as GroupId | undefined,

      jerseyByTeam:
        r.jerseyByTeam && typeof r.jerseyByTeam === "object"
          ? (Object.fromEntries(
              Object.entries(r.jerseyByTeam as Record<string, unknown>).map(([k, v]) => [
                k,
                typeof v === "number" || v === null ? v : null,
              ])
            ) as Record<string, number | null>)
          : undefined,

      historyLast6: Array.isArray(r.historyLast6)
        ? r.historyLast6
            .slice(0, 6)
            .map((rawHist) => {
              const x = (rawHist && typeof rawHist === "object") ? (rawHist as Record<string, unknown>) : {};
              return {
                date: String(x.date ?? ""),
                opponent: String(x.opponent ?? ""),
                note: x.note ? String(x.note) : undefined,
              };
            })
            .filter((x) => x.date || x.opponent)
        : undefined,

      yearColor: typeof r.yearColor === "string" || r.yearColor === null ? r.yearColor : null,
    };

    return p;
  });

  const { players: enrichedPlayers } = enrichPlayersWithBirthFromDBBTA(players);

  return { season, ageGroups, players: enrichedPlayers };
}

export function mapMasterTeamToCore(team: string): string[] {
  const t = String(team ?? "").trim();
  const u = t.toUpperCase();
  if (!u) return [];
  if (u.startsWith("NBBL")) return ["NBBL"];
  if (u.startsWith("U18")) return ["U18"];
  if (u.startsWith("HOL")) return ["HOL"];
  if (u.startsWith("1RLH")) return ["1RLH"];
  return [t];
}

export function normalizeMasterWeek(input: unknown): WeekPlan {
  const root = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
  const sessionsRaw = Array.isArray(root.sessions) ? root.sessions : [];
  const baseMonday = isoWeekMonday(new Date().toISOString().slice(0, 10));
  const sessions: Session[] = sessionsRaw.map((rawSession) => {
    const s = (rawSession && typeof rawSession === "object") ? (rawSession as Record<string, unknown>) : {};
    const id = String(s.id ?? randomId("sess_"));
    const day = String(s.day ?? "");
    const dateRaw = String(s.date ?? "").trim();
    const offset = weekdayOffsetFromDEShort(day);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? dateRaw
      : addDaysISO(baseMonday, offset ?? 0);
    const team = s.team ? String(s.team) : "";
    const teams: string[] = Array.isArray(s.teams) ? s.teams.map((x) => String(x)) : mapMasterTeamToCore(team);

    const timeRaw = String(s.time ?? "");
    const time = timeRaw.includes("–") ? timeRaw : normalizeDash(timeRaw);

    return {
      id,
      date,
      day: day || weekdayShortDE(date),
      teams: teams.map((x: string) => x.replaceAll(".1", "").replaceAll(".2", "")),
      time,
      location: String(s.location ?? ""),
      info: (s.info ?? "") ? String(s.info) : null,
      participants: Array.isArray(s.participants) ? s.participants.map((x) => String(x)) : [],
      kaderLabel: s.kaderLabel ? String(s.kaderLabel) : undefined,
    };
  });

  sessions.sort((a, b) => {
    const ad = a.date.localeCompare(b.date);
    if (ad !== 0) return ad;
    return a.time.localeCompare(b.time);
  });

  return {
    weekId: String(root.weekId ?? "MASTER"),
    sessions: sessions.map((s) => ({ ...s, participants: [] })),
  };
}
