import type { Lang } from "../i18n/types";
import type { GroupId } from "../config";

export type { Lang, GroupId };
export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type YouthTeam = "U18" | "NBBL" | "";
export type SeniorTeam = "HOL" | "1RLH" | "";

export type LizenzTyp = "DBB" | "NBBL" | string;

export type Lizenz = {
  typ: LizenzTyp;
  tna: string;
  verein?: string;
};

export type Player = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthYear?: number;
  positions?: Position[];
  isLocalPlayer?: boolean;
  lpCategory?: string;
  lizenzen?: Lizenz[];
  defaultTeams?: string[];
  group?: GroupId;
  primaryYouthTeam?: YouthTeam;
  primarySeniorTeam?: SeniorTeam;
  jerseyByTeam?: Record<string, number | null>;
  historyLast6?: Array<{
    date: string;
    opponent: string;
    note?: string;
  }>;
  yearColor?: string | null;
  taNumber?: string;
};

export type Location = {
  name: string;
  placeId?: string;
  address?: string;
  abbr?: string;
  hallNo?: string;
};

export type CalendarEvent = {
  id: string;
  date: string;
  day: string;
  teams: string[];
  /**
   * Legacy string time range (e.g. "18:00–19:30").
   * Use startMin/durationMin for all new logic.
   */
  time: string;
  /**
   * Minutes since midnight for session start (e.g. 18:00 → 1080)
   */
  startMin?: number;
  /**
   * Duration in minutes (e.g. 90)
   */
  durationMin?: number;
  location: string;
  info?: string | null;
  warmupMin?: number | null;
  travelMin?: number | null;
  participants: string[];
  kaderLabel?: string;
  excludeFromRoster?: boolean;
  rowColor?: string;
};

export type Session = CalendarEvent;

export type WeekPlan = {
  weekId: string;
  sessions: Session[];
  // legacy compatibility fields used by some split modules
  weekLabel?: string;
  rangeStartISO?: string;
  rangeEndISO?: string;
  events?: CalendarEvent[];
};

export type Coach = {
  id: string;
  name: string;
  role: string;
  license?: string;
};

export type UiTheme = {
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

export type ThemeSettings = {
  ui: UiTheme;
  groups: Record<GroupId, { bg: string }>;
  locations?: ThemeLocations;
  clubName: string;
  locale: Lang;
};

export type ThemePreset = { id: string; label: string; theme: ThemeSettings };
export type ThemeState = ThemeSettings;

export type RightModule = "calendar" | "preview" | "maps" | "none";
export type RightLayout = "single" | "split";
export type LeftTab = "players" | "coaches" | "locations";
export type ExtraPanel = null | "U18_ONLY" | "HOL_ONLY";
export type ConfirmDialogState = { open: boolean; title: string; message: string };

export type AppState = {
  settingsOpen: boolean;
  eventEditorOpen: boolean;
  newWeekOpen: boolean;
  rightSidebarOpen: boolean;
  rightLayout: RightLayout;
  rightTop: RightModule;
  rightBottom: RightModule;
  rightSplitPct: number;
  openGroup: GroupId | null;
  openExtra: ExtraPanel;
  leftTab: LeftTab;
  leftEditMode: boolean;
  openLocationName: string | null;
  rosterOpen: boolean;
  autoTravelLoading: boolean;
  confirmDialog: ConfirmDialogState;
  rosterSearch: string;
  selectedPlayerId: string | null;
};
