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
  // Kein .trim() hier – der User tippt gerade, Leerzeichen müssen erhalten bleiben.
  // Normalisierung (trim) geschieht beim Speichern via normalizeOpponentInfo.
  if (mode === "away") return name !== "" ? `@ ${name}` : "@";
  if (mode === "home") return name !== "" ? `vs ${name}` : "vs";
  return name;
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
