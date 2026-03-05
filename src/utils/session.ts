import type { CalendarEvent as Session, WeekPlan } from "@/types";
import {
  splitTimeRange,
  parseHHMM,
  addDaysISO,
  normalizeDash,
  weekdayOffsetFromDEShort,
  weekdayShortDE,
} from "./date";

export type SessionConflict = {
  sessionId: string;
  playerId: string;
  otherSessionId: string;
};

// ---------------------------------------------------------------------------
// Meeting suffix helpers (shared – avoids copies in App.tsx & useEventPlannerState)
// ---------------------------------------------------------------------------

const AUTO_MEETING_SUFFIX_RE = /\s*\|\s*(Treffpunkt|Meeting point):\s*\d{2}:\d{2}\s*$/i;

/** Strips auto-appended meeting-time suffix from opponent info strings. */
export function stripAutoMeetingSuffix(info: string): string {
  return String(info ?? "").replace(AUTO_MEETING_SUFFIX_RE, "").trim();
}

// ---------------------------------------------------------------------------
// Opponent info normalisation
// ---------------------------------------------------------------------------

export function normalizeOpponentInfo(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "at") return "@";
  if (lower.startsWith("at ")) {
    const rest = s.slice(2).trim();
    return rest ? `@ ${rest}` : "@";
  }
  if (lower.startsWith("@")) {
    const rest = s.slice(1).trim();
    return rest ? `@ ${rest}` : "@";
  }
  if (lower.startsWith("vs")) {
    const rest = s.slice(2).trim();
    return rest ? `vs ${rest}` : "vs";
  }
  return s;
}

export function isGameInfo(info: string | null | undefined): boolean {
  const t = String(info ?? "").trim().toLowerCase();
  return (
    t.startsWith("vs") ||
    t.startsWith("@") ||
    t.startsWith("at ") ||
    t.includes(" vs ") ||
    t.includes(" @ ") ||
    t.includes(" at ")
  );
}

export function isGameSession(s: Session): boolean {
  const info = s.info || "";
  return info.includes("vs") || info.includes("@");
}

// ---------------------------------------------------------------------------
// Overlap / conflict detection
// ---------------------------------------------------------------------------

export function sessionsOverlap(a: Session, b: Session): boolean {
  if (!a.date || !b.date) return false;
  if (a.date !== b.date) return false;

  const ra = splitTimeRange(a.time ?? "");
  const rb = splitTimeRange(b.time ?? "");
  if (!ra || !rb) return false;

  const [aStart, aEnd] = ra;
  const [bStart, bEnd] = rb;

  if (aStart === aEnd || bStart === bEnd) return false;

  const aS = parseHHMM(aStart);
  const aE = parseHHMM(aEnd);
  const bS = parseHHMM(bStart);
  const bE = parseHHMM(bEnd);

  return aS < bE && bS < aE;
}

export function computeConflictsBySession(plan: WeekPlan): Map<string, SessionConflict[]> {
  const res = new Map<string, SessionConflict[]>();
  for (const s of plan.sessions) res.set(s.id, []);

  const sessions = plan.sessions.slice();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (!sessionsOverlap(a, b)) continue;

      const aSet = new Set(a.participants ?? []);
      const bSet = new Set(b.participants ?? []);

      for (const pid of aSet) {
        if (!bSet.has(pid)) continue;
        res.get(a.id)?.push({ sessionId: a.id, playerId: pid, otherSessionId: b.id });
        res.get(b.id)?.push({ sessionId: b.id, playerId: pid, otherSessionId: a.id });
      }
    }
  }

  return res;
}

// ---------------------------------------------------------------------------
// Week-date application (shared – avoids copies in useWeekManager & useWeekArchiveManager)
// ---------------------------------------------------------------------------

/**
 * Re-dates a list of sessions to a new week (given as Monday ISO date),
 * preserving each session's weekday. Normalises time dashes and sorts.
 */
export function applyWeekDatesToSessions(
  sessions: Session[],
  weekStartMondayISO: string
): Session[] {
  return sessions
    .map((s) => {
      const off = weekdayOffsetFromDEShort(s.day);
      const effectiveOffset =
        off !== null
          ? off
          : s.date
            ? (new Date(`${s.date}T00:00:00`).getDay() + 6) % 7
            : 0;
      const nextDate = addDaysISO(weekStartMondayISO, effectiveOffset);
      return {
        ...s,
        date: nextDate,
        day: weekdayShortDE(nextDate),
        time: normalizeDash(String(s.time ?? "")),
      };
    })
    .sort((a, b) => {
      const ad = a.date.localeCompare(b.date);
      return ad !== 0 ? ad : a.time.localeCompare(b.time);
    });
}
