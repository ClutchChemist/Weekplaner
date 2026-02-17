import type { Lang } from "../i18n/types";

export type ThemeGroupId = "Herren" | "2007" | "2008" | "2009" | "TBD";

export type ThemeUi = {
  bg: string;
  panel: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
  black: string;
  white: string;
  primary?: string;
  primaryText?: string;
};

export type ThemeLocations = {
  homeAddress?: string;
  homePlaceId?: string;
  home?: string;
  bsh?: string;
  shp?: string;
  seminarraum?: string;
  locations?: Record<string, { placeId?: string; address: string }>;
  custom?: Record<string, string>;
  definitions?: Record<string, { abbr: string; name: string; hallNo?: string }>;
  travelCache?: Record<string, { minutes: number; cachedAt: number }>;
};

export type ThemeState = {
  ui: ThemeUi;
  groups: Record<ThemeGroupId, { bg: string }>;
  locations?: ThemeLocations;
  clubName: string;
  locale: Lang;
};