export function birthYearOf(p: { birthYear?: number }): number | null {
  return typeof p.birthYear === "number" ? p.birthYear : null;
}
// Export all helpers for barrel import
import type { Player, GroupId, WeekPlan } from "./types";

// Sorts by player name (case-insensitive)
export function makeParticipantSorter(playerById?: Map<string, Player>) {
  return (a: string, b: string) => {
    if (!playerById) return 0;
    const pa = playerById.get(a);
    const pb = playerById.get(b);
    if (!pa || !pb) return 0;
    return (pa.name || "").localeCompare(pb.name || "", "de", { sensitivity: "base" });
  };
}

// Returns true if player is not TBD and has a name
export function isCorePlayer(p: Player): boolean {
  return !!p && p.id !== "TBD" && !!p.name;
}

// Returns the group of the player, or "TBD" if missing
export function getPlayerGroup(p: Player): GroupId {
  return (p.group as GroupId) || "TBD";
}

// Returns true if player is only in U18
export function isU18Only(p: Player): boolean {
  return p.primaryYouthTeam === "U18" && !p.primarySeniorTeam;
}

// Returns true if player is only in HOL
export function isHolOnly(p: Player): boolean {
  return p.primarySeniorTeam === "HOL" && !p.primaryYouthTeam;
}

// Returns a set of all plan session dates
export function planDateSet(plan: WeekPlan): Set<string> {
  return new Set((plan.sessions ?? []).map((s) => String(s.date ?? "")).filter(Boolean));
}

// Returns true if player's birthday matches any plan date (MM-DD)
export function isBirthdayOnAnyPlanDate(p: Player, dateSet: Set<string>): boolean {
  const bd = String(p.birthDate ?? "").trim();
  if (!/\d{4}-\d{2}-\d{2}/.test(bd)) return false;
  const mmdd = bd.slice(5, 10);
  for (const d of dateSet) {
    if (String(d).slice(5, 10) === mmdd) return true;
  }
  return false;
}
// If not already defined, define and export them below or above as needed
import type { Player } from "./types";

export function safeNameSplit(full: string): { firstName: string; lastName: string } {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function primaryTna(p: Player): string {
  const liz = p.lizenzen ?? [];
  const dbb = liz.find((x) => String(x.typ).toUpperCase() === "DBB")?.tna;
  const nbbl = liz.find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna;
  return dbb || nbbl || "";
}

export function hasAnyTna(p: Player): boolean {
  return (p.lizenzen ?? []).some((l) => String(l.tna ?? "").trim().length > 0);
}

function toISODate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) return null;

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function birthDateFromDBBTA(taRaw?: string | null): string | null {
  if (!taRaw) return null;

  const ta = String(taRaw).trim();
  if (!/^\d{6,}$/.test(ta)) return null;

  const dd = Number(ta.slice(0, 2));
  const mm = Number(ta.slice(2, 4));
  const yy = Number(ta.slice(4, 6));

  const yyyy = yy <= 29 ? 2000 + yy : 1900 + yy;
  return toISODate(yyyy, mm, dd);
}

function getDbbTna(p: Player): string {
  const liz = p.lizenzen ?? [];
  const dbb = liz.find((x) => String(x.typ).toUpperCase() === "DBB")?.tna ?? "";
  return String(dbb).trim();
}

function parseDbbDobFromTna(tna: string): { dd: number; mm: number; yy: number } | null {
  const s = String(tna ?? "").trim();
  const m = s.match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yy = parseInt(m[3], 10);
  if (!(dd >= 1 && dd <= 31)) return null;
  if (!(mm >= 1 && mm <= 12)) return null;
  return { dd, mm, yy };
}

function birthDateParts(p: Player): { dd: number; mm: number; yy: number } | null {
  const bd = String(p.birthDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) return null;
  const yyyy = parseInt(bd.slice(0, 4), 10);
  const mm = parseInt(bd.slice(5, 7), 10);
  const dd = parseInt(bd.slice(8, 10), 10);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return { dd, mm, yy: yyyy % 100 };
}

export function dbbDobMatchesBirthDate(p: Player): { ok: boolean; reason?: string } {
  const tna = getDbbTna(p);
  if (!tna) return { ok: true };

  const taDob = parseDbbDobFromTna(tna);
  if (!taDob) return { ok: false, reason: "DBB-TA Format unklar (erwartet DDMMYY...)" };

  const bd = birthDateParts(p);
  if (!bd) return { ok: false, reason: "Geburtsdatum fehlt/ungültig (YYYY-MM-DD)" };

  const ok = taDob.dd === bd.dd && taDob.mm === bd.mm && taDob.yy === bd.yy;
  if (ok) return { ok: true };

  return {
    ok: false,
    reason: `Mismatch: TA startet ${String(taDob.dd).padStart(2,"0")}.${String(taDob.mm).padStart(2,"0")}.${String(taDob.yy).padStart(2,"0")} vs birthDate ${String(bd.dd).padStart(2,"0")}.${String(bd.mm).padStart(2,"0")}.${String(bd.yy).padStart(2,"0")}`,
  };
}

export function enrichPlayersWithBirthFromDBBTA(
  players: Player[],
  opts?: { overrideBirthYear?: boolean }
): { players: Player[]; warnings: string[] } {
  const overrideBirthYear = opts?.overrideBirthYear ?? true;
  const warnings: string[] = [];

  const result = players.map((p) => {
    const tna = getDbbTna(p);
    if (!tna) return p;

    const derived = birthDateFromDBBTA(tna);
    if (!derived) {
      warnings.push(`${p.name}: DBB-TNA nicht parsbar oder ungültiges Datum (${tna})`);
      return p;
    }

    const alreadyOk = p.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate);
    if (alreadyOk) return p;

    const updated = { ...p, birthDate: derived };

    const parsedYear = Number(derived.slice(0, 4));
    const currentBirthYear = typeof p.birthYear === "number" ? p.birthYear : undefined;
    const yearIsValid = currentBirthYear && currentBirthYear >= 1930 && currentBirthYear <= new Date().getFullYear();

    if (!yearIsValid) {
      updated.birthYear = parsedYear;
    } else if (overrideBirthYear && currentBirthYear !== parsedYear) {
      updated.birthYear = parsedYear;
    }

    return updated;
  });

  return { players: result, warnings };
}
