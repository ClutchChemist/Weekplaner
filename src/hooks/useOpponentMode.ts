import { useMemo } from "react";
import { normalizeOpponentInfo } from "@/utils/session";

export type OpponentMode = "home" | "away" | null;

export function getOpponentMode(raw: string): OpponentMode {
  const n = normalizeOpponentInfo(raw);
  if (n.startsWith("@")) return "away";
  if (n.toLowerCase().startsWith("vs")) return "home";
  return null;
}

export function getOpponentName(raw: string): string {
  const n = normalizeOpponentInfo(raw);
  if (n.startsWith("@")) return n.slice(1).trim();
  if (n.toLowerCase().startsWith("vs")) return n.slice(2).trim();
  return n;
}

export function composeOpponentInfo(mode: OpponentMode, name: string): string {
  const trimmed = name.trim();
  if (mode === "away") return trimmed ? `@ ${trimmed}` : "@";
  if (mode === "home") return trimmed ? `vs ${trimmed}` : "vs";
  return trimmed;
}

export function useOpponentMode(raw: string) {
  return useMemo(
    () => ({
      mode: getOpponentMode(raw),
      name: getOpponentName(raw),
    }),
    [raw]
  );
}
