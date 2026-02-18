import { useEffect, useState } from "react";
import type { ThemePreset } from "@/types";
import { THEME_USER_PRESETS_KEY } from "@/utils/constants";

function asThemePreset(value: unknown): ThemePreset | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const theme = record.theme;
  if (!theme || typeof theme !== "object") return null;

  const id = String(record.id ?? "");
  const label = String(record.label ?? "");
  if (!id || !label) return null;

  return { id, label, theme: theme as ThemePreset["theme"] };
}

function safeParseThemePresets(raw: string | null): ThemePreset[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(asThemePreset).filter((p): p is ThemePreset => p !== null);
  } catch {
    return [];
  }
}

export function useThemePresets() {
  const [presets, setPresets] = useState<ThemePreset[]>(() => {
    if (typeof window === "undefined") return [];
    return safeParseThemePresets(localStorage.getItem(THEME_USER_PRESETS_KEY));
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_USER_PRESETS_KEY, JSON.stringify(presets));
  }, [presets]);

  return { presets, setPresets } as const;
}
