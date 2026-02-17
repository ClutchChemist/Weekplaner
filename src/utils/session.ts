import type { CalendarEvent as Session, WeekPlan } from "../state/types";
import { splitTimeRange } from "./date";

export type SessionConflict = {
  sessionId: string;
  playerId: string;
  otherSessionId: string;
};

export function normalizeOpponentInfo(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
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
  return t.startsWith("vs") || t.startsWith("@") || t.includes(" vs ") || t.includes(" @ ");
}

export function isGameSession(s: Session): boolean {
  const info = s.info || "";
  return info.includes("vs") || info.includes("@");
}

export function sessionsOverlap(a: Session, b: Session): boolean {
  if (!a.date || !b.date) return false;
  if (a.date !== b.date) return false;

  const ra = splitTimeRange(a.time ?? "");
  const rb = splitTimeRange(b.time ?? "");
  if (!ra || !rb) return false;

  const [aStart, aEnd] = ra;
  const [bStart, bEnd] = rb;

  if (aStart === aEnd || bStart === bEnd) return false;

  const aS = parseInt(aStart.slice(0, 2), 10) * 60 + parseInt(aStart.slice(3, 5), 10);
  const aE = parseInt(aEnd.slice(0, 2), 10) * 60 + parseInt(aEnd.slice(3, 5), 10);
  const bS = parseInt(bStart.slice(0, 2), 10) * 60 + parseInt(bStart.slice(3, 5), 10);
  const bE = parseInt(bEnd.slice(0, 2), 10) * 60 + parseInt(bEnd.slice(3, 5), 10);

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
