import type { ThemeSettings, UiTheme } from "./types";
import { YEAR_GROUPS, GroupId } from "../config";

export function safeParseTheme(raw: string | null, fallbackTheme: ThemeSettings): ThemeSettings | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;

    const ui = obj.ui;
    const groups = obj.groups;

    const needUiKeys: Array<keyof UiTheme> = [
      "bg",
      "panel",
      "card",
      "border",
      "text",
      "muted",
      "soft",
      "black",
      "white",
    ];

    if (!ui || typeof ui !== "object") return null;
    for (const k of needUiKeys) {
      if (typeof ui[k] !== "string" || !ui[k]) return null;
    }

    const gids: GroupId[] = [...YEAR_GROUPS, "Herren", "TBD"];
    if (!groups || typeof groups !== "object") return null;
    for (const gid of gids) {
      if (!groups[gid] || typeof groups[gid].bg !== "string" || !groups[gid].bg)
        return null;
    }

    return {
      ui: {
        bg: ui.bg,
        panel: ui.panel,
        card: ui.card,
        border: ui.border,
        text: ui.text,
        muted: ui.muted,
        soft: ui.soft,
        black: ui.black,
        white: ui.white,
        primary: typeof ui.primary === "string" && ui.primary ? ui.primary : undefined,
        primaryText:
          typeof ui.primaryText === "string" && ui.primaryText ? ui.primaryText : undefined,
      },
      groups: {
        "2007": { bg: groups["2007"].bg },
        "2008": { bg: groups["2008"].bg },
        "2009": { bg: groups["2009"].bg },
        Herren: { bg: groups["Herren"].bg },
        TBD: { bg: groups["TBD"].bg },
      },
      clubName: typeof obj.clubName === "string" ? obj.clubName : fallbackTheme.clubName,
      locale: (obj.locale === "de" || obj.locale === "en") ? obj.locale : fallbackTheme.locale,
    };
  } catch {
    return null;
  }
}

export function migrateLegacyBlueTheme(theme: ThemeSettings, fallbackTheme: ThemeSettings): ThemeSettings {
  const legacyMap: Record<string, string> = {
    "#0b0f19": "#0d0d0d",
    "#111827": "#171717",
    "#0f172a": "#212121",
    "#243041": "#303030",
    "#e5e7eb": "#ececec",
    "#9ca3af": "#b4b4b4",
    "#cbd5e1": "#676767",
    "#111111": "#000000",
    "#e7e7e7": "#3d3d3d",
    "#0f0f10": "#ffffff",
    "#2563eb": "#4b5563",
    "#f59e0b": "#6b7280",
    "#16a34a": "#9ca3af",
  };

  const hasLegacyBlueBase =
    [theme.ui.bg, theme.ui.panel, theme.ui.card].map((x) => x.toLowerCase()).some((x) =>
      ["#0b0f19", "#111827", "#0f172a"].includes(x)
    );

  const mapColor = (hex: string) => legacyMap[hex.toLowerCase()] ?? hex;

  const migratedUi: UiTheme = {
    ...theme.ui,
    bg: mapColor(theme.ui.bg),
    panel: mapColor(theme.ui.panel),
    card: mapColor(theme.ui.card),
    border: mapColor(theme.ui.border),
    text: mapColor(theme.ui.text),
    muted: mapColor(theme.ui.muted),
    soft: mapColor(theme.ui.soft),
    black: mapColor(theme.ui.black),
    white: mapColor(theme.ui.white),
    primary: mapColor(theme.ui.primary ?? fallbackTheme.ui.primary ?? "#3d3d3d"),
    primaryText: mapColor(theme.ui.primaryText ?? fallbackTheme.ui.primaryText ?? "#ffffff"),
  };

  if (!hasLegacyBlueBase) {
    return { ...theme, ui: migratedUi };
  }

  return {
    ui: migratedUi,
    groups: {
      "2007": { bg: mapColor(theme.groups["2007"].bg) },
      "2008": { bg: mapColor(theme.groups["2008"].bg) },
      "2009": { bg: mapColor(theme.groups["2009"].bg) },
      Herren: { bg: mapColor(theme.groups["Herren"].bg) },
      TBD: { bg: mapColor(theme.groups["TBD"].bg) },
    },
    clubName: theme.clubName ?? fallbackTheme.clubName,
    locale: theme.locale ?? fallbackTheme.locale,
  };
}
