import type { GroupId, ThemeSettings } from "./types";

export const DEFAULT_GROUP_COLORS: Record<GroupId, { bg: string }> = {
  "2007": { bg: "#4b5563" },
  "2008": { bg: "#6b7280" },
  "2009": { bg: "#9ca3af" },
  Herren: { bg: "#ffffff" },
  TBD: { bg: "#4b5563" },
};

export const DEFAULT_THEME: ThemeSettings = {
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
  groups: DEFAULT_GROUP_COLORS,
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
  clubName: "UBC Münster",
  locale: "de",
};
