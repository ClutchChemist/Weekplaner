import type { Player, WeekPlan } from "./types";

export function computeTrainingCounts(plan: WeekPlan) {
  const m = new Map<string, number>();
  for (const s of plan.sessions) {
    for (const pid of s.participants ?? []) {
      m.set(pid, (m.get(pid) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * Returns a map from playerId to active dates in the current week.
 * Only dates included in `weekDates` are considered.
 */
export function computePlayerActiveDays(
  plan: WeekPlan,
  weekDates: string[]
): Map<string, Set<string>> {
  const weekDateSet = new Set(weekDates);
  const activeByPlayer = new Map<string, Set<string>>();

  for (const session of plan.sessions ?? []) {
    if (!weekDateSet.has(session.date)) continue;
    for (const playerId of session.participants ?? []) {
      if (!activeByPlayer.has(playerId)) {
        activeByPlayer.set(playerId, new Set<string>());
      }
      activeByPlayer.get(playerId)?.add(session.date);
    }
  }

  return activeByPlayer;
}

export function planDateSet(plan: WeekPlan): Set<string> {
  return new Set((plan.sessions ?? []).map((s) => String(s.date ?? "")).filter(Boolean));
}

export function isBirthdayOnAnyPlanDate(p: Player, dateSet: Set<string>): boolean {
  const bd = String(p.birthDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) return false;

  const mmdd = bd.slice(5, 10);
  for (const d of dateSet) {
    if (String(d).slice(5, 10) === mmdd) return true;
  }
  return false;
}

function hasBlockingHistoryNoteForDate(p: Player, dateISO: string): boolean {
  const entries = p.historyLast6 ?? [];
  if (!entries.length) return false;

  const blockRegex = /(verletzt|injur|schule|school|krank|ill|ausfall|absen|fehlt)/i;

  return entries.some((h) => {
    const d = String(h?.date ?? "").trim();
    if (!d || d !== dateISO) return false;
    const note = String(h?.note ?? "").trim();
    const opp = String(h?.opponent ?? "").trim();
    return blockRegex.test(`${note} ${opp}`);
  });
}

export function computeHistoryFlagsBySession(
  plan: WeekPlan,
  playerById: Map<string, Player>
): Map<string, string[]> {
  const res = new Map<string, string[]>();

  for (const s of plan.sessions ?? []) {
    const flagged: string[] = [];
    for (const pid of s.participants ?? []) {
      const p = playerById.get(pid);
      if (!p) continue;
      if (hasBlockingHistoryNoteForDate(p, s.date)) flagged.push(pid);
    }
    res.set(s.id, flagged);
  }

  return res;
}
