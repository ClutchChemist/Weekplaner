// Export GROUPS for barrel import
import type { GroupId } from "./types";
export const GROUPS: GroupId[] = ["2007", "2008", "2009", "Herren", "TBD"];
import type { GroupId, ThemeSettings } from "./types";
import { YEAR_GROUPS, GroupId } from "../config";

export const DEFAULT_GROUP_COLORS: Record<GroupId, { bg: string }> = {
  ...Object.fromEntries(YEAR_GROUPS.map((y, i) => [y, { bg: ["#fbbf24", "#60a5fa", "#34d399"][i % 3] }])),
  Herren: { bg: "#f472b6" },
  TBD: { bg: "#d1d5db" },
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
