import type { ThemeState } from "@/types";
import { YEAR_GROUPS } from "@/config";

function buildGroupColors(colors: string[], herrenBg: string, tbdBg: string) {
  const groups: ThemeState["groups"] = {
    Herren: { bg: herrenBg },
    TBD: { bg: tbdBg },
  };
  for (let i = 0; i < YEAR_GROUPS.length; i += 1) {
    const year = YEAR_GROUPS[i];
    groups[year] = { bg: colors[i] ?? colors[colors.length - 1] };
  }
  return groups;
}

export const THEME_PRESETS: Record<string, ThemeState> = {
  "default-dark": {
    ui: {
      bg: "#0d0d0d",
      panel: "#171717",
      card: "#212121",
      border: "#303030",
      text: "#ececec",
      muted: "#b4b4b4",
      soft: "#676767",
      black: "#000000",
      white: "#ffffff",
      primary: "#3d3d3d",
      primaryText: "#ffffff",
    },
    groups: buildGroupColors(["#4b5563", "#6b7280", "#9ca3af"], "#ffffff", "#4b5563"),
    locations: {
      home: "",
      bsh: "",
      shp: "",
      seminarraum: "",
      custom: {},
      definitions: {
        BSH: { abbr: "BSH", name: "BSH" },
        SHP: { abbr: "SHP", name: "SHP" },
        Seminarraum: { abbr: "Seminarraum", name: "Seminarraum" },
      },
    },
    clubName: "UBC MÃ¼nster",
    locale: "de",
  },
  "slate-dark": {
    ui: {
      bg: "#121212",
      panel: "#1a1a1a",
      card: "#242424",
      border: "#313131",
      text: "#ededed",
      muted: "#b5b5b5",
      soft: "#717171",
      black: "#000000",
      white: "#ffffff",
      primary: "#3f3f3f",
      primaryText: "#ffffff",
    },
    groups: buildGroupColors(["#4b5563", "#6b7280", "#9ca3af"], "#ffffff", "#4b5563"),
    clubName: "UBC MÃ¼nster",
    locale: "de",
  },
  light: {
    ui: {
      bg: "#f8fafc",
      panel: "#ffffff",
      card: "#ffffff",
      border: "#e5e7eb",
      text: "#1f1f1f",
      muted: "#6b7280",
      soft: "#374151",
      black: "#111111",
      white: "#ffffff",
    },
    groups: buildGroupColors(["#9ca3af", "#d1d5db", "#e5e7eb"], "#2b2b2b", "#9ca3af"),
    clubName: "UBC MÃ¼nster",
    locale: "de",
  },
};

