import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import type { Lang } from "./i18n/types";
import type {
  CalendarEvent as Session,
  GroupId,
  Player,
  Position,
  ThemeSettings,
  WeekPlan,
} from "@/types";
import { makeT, makeTF } from "./i18n/translate";
import { Button, Input, Modal, segBtn, Select } from "@/components/ui";
import {
  AppTopBar,
  CalendarPane,
  LeftSidebar,
  PrintView,
  RightSidebar,
  WeekPlanBoard,
} from "@/components/layout";
import { DraggablePlayerRow } from "@/components/roster";

import { ConfirmModal, EventEditorModal, NewWeekModal, ProfilesModal, PromptModal, ThemeSettingsModal } from "@/components/modals";
import {
  composeOpponentInfo,
  getOpponentMode,
  getOpponentName,
  useConfirmDialog,
  useDndPlan,
  useCloudSync,
  useCloudSnapshotHandlers,
  useCoaches,
  useEventPlannerState,
  useLocationUsageMap,
  usePdfExport,
  usePersistedState,
  usePlayerActions,
  usePromptDialog,
  useProfilesState,
  useRightSidebarPersistence,
  useWeekArchiveManager,
  useSessionEditor,
  useWeekManager,
  LOCATION_PRESETS,
} from "@/hooks";
import { useAppUiState } from "./state/useAppUiState";
import { reviveWeekPlan } from "./state/planReviver";
import {
  computeHistoryFlagsBySession,
  computeTrainingCounts,
  isBirthdayOnAnyPlanDate,
  planDateSet,
} from "./state/planDerived";
import { normalizeMasterWeek, normalizeRoster } from "./state/normalizers";
import {
  birthYearOf,
  getPlayerGroup,
  GROUPS,
  isCorePlayer,
  isHolOnly,
  isU18Only,
  makeParticipantSorter,
} from "./state/playerGrouping";
import { YEAR_GROUPS } from "./config";
import { dbbDobMatchesBirthDate, primaryTna } from "./state/playerMeta";
import { LAST_PLAN_STORAGE_KEY, STAFF_STORAGE_KEY, THEME_STORAGE_KEY } from "./state/storageKeys";
import {
  type ProfileSyncMode,
  type CloudSnapshotV1,
  type ProfilePayload,
  type SavedProfile,
} from "./state/profileTypes";
import { migrateLegacyBlueTheme, safeParseTheme } from "./state/themePersistence";
import { DEFAULT_THEME } from "./state/themeDefaults";
import { applyThemeToCssVars } from "./themes/cssVars";
import {
  addMinutesToHHMM,
  isoWeekMonday,
  kwLabelFromPlan,
  splitTimeRange,
  weekdayShortLocalized,
} from "./utils/date";
import {
  computeConflictsBySession,
  isGameInfo,
  isGameSession,
  normalizeOpponentInfo,
  sessionsOverlap,
} from "./utils/session";
import {
  getCachedTravelMinutes,
  getLocationOptions,
  resolveLocationAddress,
  resolveLocationPlaceId,
  setCachedTravelMinutes,
} from "./utils/locations";
import { fetchTravelMinutes } from "./utils/mapsApi";
import { buildPreviewPages, buildPrintPages } from "./utils/printExport";
import { normalizeYearColor, pickTextColor } from "./utils/color";
import { deleteCloudSnapshot, listCloudSnapshots } from "./utils/cloudSync";
import { randomId } from "./utils/id";
import { BASE_TEAM_OPTIONS, getLicenseTnaByType, getRequiredTaTypeForTeams, normalizeTeamCode } from "./utils/team";
import { selectScheduleSessions } from "@/features/week-planning/selectors/sessionSelectors";
import rosterRaw from "./data/roster.json";
import weekMasterRaw from "./data/weekplan_master.json";

/* ============================================================
   TYPES
   ============================================================ */

/* ============================================================
   CONSTANTS / PRESETS
   ============================================================ */

/* ============================================================
  UTILS (date/color/json/...)
  ============================================================ */

/* ============================================================
   HELPERS (colors / contrast)
   ============================================================ */

/* ============================================================
   ISO WEEK
   ============================================================ */

/* ============================================================
  DOWNLOAD JSON
  ============================================================ */

/* ============================================================
   ROSTER helpers (TA badge + grouping)
   ============================================================ */

/* ============================================================
  COMPONENTS (Modal..., Button..., Row..., Pane...)
  ============================================================ */

/* ============================================================
   UI PRIMITIVES (CSS vars)
   ============================================================ */

const CLUB_LOGO_STORAGE_KEY = "ubc_club_logo_v1";
const CLUB_LOGO_MAX_BYTES = 600 * 1024;

function fallbackYearGroupsByFormula(referenceDate: Date = new Date()): string[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const day = referenceDate.getDate();
  const seasonStartYear = month > 8 || (month === 8 && day >= 1) ? year : year - 1;
  return [seasonStartYear - 18, seasonStartYear - 17, seasonStartYear - 16].map(String);
}

function MinutePicker({
  value,
  onChange,
  presets,
  allowZero = true,
  placeholder = "Minuten",
}: {
  value: number;
  onChange: (v: number) => void;
  presets: number[];
  allowZero?: boolean;
  placeholder?: string;
}) {
  const items = allowZero ? [0, ...presets] : presets;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {items.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
              background: active ? "rgba(59,130,246,.18)" : "transparent",
              color: "var(--ui-text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {m}
          </button>
        );
      })}

      <Input
        type="number"
        value={String(value)}
        onChange={(v) => onChange(Math.max(allowZero ? 0 : 1, Math.floor(Number(v || "0"))))}
        placeholder={placeholder}
        style={{ maxWidth: 80 }}
      />
    </div>
  );
}


/* ============================================================
   LOCATIONS PANEL
   ============================================================ */

/* Locations UI moved to src/components/locations/LeftLocationsView.tsx */


/* ============================================================
   SETTINGS MODAL (Theme)
   ============================================================ */

/* ============================================================
   DND COMPONENTS
   ============================================================ */

/* ============================================================
   Optional right pane: Calendar week view (DnD)
   ============================================================ */

/* ============================================================
   PRINT VIEW → src/components/layout/PrintView.tsx
   ============================================================ */

/* ============================================================
   COACHES: persistence + defaults
   ============================================================ */

/* ============================================================
   NEW WEEK MODAL
   ============================================================ */

/* ============================================================
   GOOGLE MAPS HELPERS
   ============================================================ */

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const AUTO_MEETING_SUFFIX_RE = /\s*\|\s*(Treffpunkt|Meeting point):\s*\d{2}:\d{2}\s*$/i;

  function stripAutoMeetingSuffix(info: string): string {
    return String(info ?? "").replace(AUTO_MEETING_SUFFIX_RE, "").trim();
  }

  /* ============================================================
    STATE (useState...)
    ============================================================ */

  /* ----------------------
     Theme
     ---------------------- */
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = safeParseTheme(typeof window !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null, DEFAULT_THEME);
    return saved ? migrateLegacyBlueTheme(saved, DEFAULT_THEME) : DEFAULT_THEME;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") !== "1") return;

    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(LAST_PLAN_STORAGE_KEY);
    localStorage.removeItem(STAFF_STORAGE_KEY);
    localStorage.removeItem("right_sidebar_v1");

    url.searchParams.delete("reset");
    window.history.replaceState({}, "", url.toString());
    window.location.reload();
  }, []);

  useEffect(() => {
    setTheme((prev) => {
      const next = migrateLegacyBlueTheme(prev, DEFAULT_THEME);
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, []);

  useEffect(() => {
    applyThemeToCssVars(theme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const activeYearGroups = YEAR_GROUPS.length > 0 ? YEAR_GROUPS : fallbackYearGroupsByFormula();

  const groupBg = useMemo(() => {
    const yearFallbackKey = activeYearGroups[0] ?? "TBD";
    const fallback = theme.groups[yearFallbackKey]?.bg ?? DEFAULT_THEME.groups[yearFallbackKey]?.bg ?? "#6b7280";
    const next: Record<GroupId, string> = {
      Herren: theme.groups["Herren"]?.bg ?? DEFAULT_THEME.groups["Herren"].bg,
      TBD: theme.groups["TBD"]?.bg ?? DEFAULT_THEME.groups["TBD"].bg,
    };
    for (const year of activeYearGroups) {
      next[year] = theme.groups[year]?.bg ?? fallback;
    }
    return next;
  }, [activeYearGroups, theme.groups]);

  const groupText = useMemo(() => {
    const next: Record<GroupId, string | undefined> = {
      Herren: theme.groups["Herren"]?.fg,
      TBD: theme.groups["TBD"]?.fg,
    };
    for (const year of activeYearGroups) {
      next[year] = theme.groups[year]?.fg;
    }
    return next;
  }, [activeYearGroups, theme.groups]);

  // Initialize i18n early so it's available for all functions
  const lang: Lang = (theme.locale ?? "de") as Lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const tf = useMemo(() => makeTF(lang), [lang]);

  const {
    appUiState,
    setSettingsOpen,
    setEventEditorOpen,
    setRightOpen,
    setNewWeekOpen,
    setRightLayout,
    setRightTop,
    setRightBottom,
    setRightSplitPct,
    setOpenGroup,
    setOpenExtra,
    setLeftTab,
    setLeftEditMode,
    setOpenLocationName,
    setRosterOpen,
    setAutoTravelLoading,
    setConfirmDialog,
    setRosterSearch,
    setSelectedPlayerId,
  } = useAppUiState();

  const settingsOpen = appUiState.settingsOpen;
  const eventEditorOpen = appUiState.eventEditorOpen;
  const rightOpen = appUiState.rightSidebarOpen;
  const newWeekOpen = appUiState.newWeekOpen;
  const rightLayout = appUiState.rightLayout;
  const rightTop = appUiState.rightTop;
  const rightBottom = appUiState.rightBottom;
  const rightSplitPct = appUiState.rightSplitPct;
  const openGroup = appUiState.openGroup;
  const openExtra = appUiState.openExtra;
  const leftTab = appUiState.leftTab;
  const leftEditMode = appUiState.leftEditMode;
  const openLocationName = appUiState.openLocationName;
  const rosterOpen = appUiState.rosterOpen;
  const autoTravelLoading = appUiState.autoTravelLoading;
  const [autoTravelError, setAutoTravelError] = useState<string | null>(null);
  const confirmDialog = appUiState.confirmDialog;
  const rosterSearch = appUiState.rosterSearch;
  const selectedPlayerId = appUiState.selectedPlayerId;
  const { askConfirm, resolveConfirm } = useConfirmDialog(setConfirmDialog);
  const { promptDialog, setPromptValue, askPrompt, resolvePrompt } = usePromptDialog();
  const [lastDropError, setLastDropError] = useState<string | null>(null);

  /* ============================================================
    EFFECTS (useEffect...)
    ============================================================ */

  /* ----------------------
    Right Sidebar
    ---------------------- */

  useRightSidebarPersistence({
    rightOpen,
    rightLayout,
    rightTop,
    rightBottom,
    rightSplitPct,
    setRightOpen,
    setRightLayout,
    setRightTop,
    setRightBottom,
    setRightSplitPct,
  });

  /* ----------------------
     Staff / Coaches
     ---------------------- */
  const { coaches, setCoaches, importStaffFile, exportStaff, addCoach, updateCoach, deleteCoach } = useCoaches(
    t,
    setLastDropError
  );

  /* ============================================================
     HANDLERS (onDrag..., upsert..., export...)
     ============================================================ */

  /* ----------------------
     Load roster.json
     ---------------------- */
  const normalizedRoster = useMemo(() => normalizeRoster(rosterRaw as unknown), []);
  const [rosterMeta, setRosterMeta] = useState<{ season: string; ageGroups: unknown }>({
    season: normalizedRoster.season,
    ageGroups: normalizedRoster.ageGroups,
  });

  const [players, setPlayers] = useState<Player[]>(() => normalizedRoster.players);
  const masterPlan = useMemo(() => normalizeMasterWeek(weekMasterRaw as unknown), []);
  const [plan, setPlan] = usePersistedState<WeekPlan>(
    LAST_PLAN_STORAGE_KEY,
    masterPlan,
    reviveWeekPlan
  );

  const applyProfileData = useCallback((payload: ProfilePayload) => {
    setRosterMeta(payload.rosterMeta);
    setPlayers(payload.players);
    setCoaches(payload.coaches);
    if (payload.theme) {
      setTheme(payload.theme);
    } else {
      setTheme((prev) => ({
        ...prev,
        locations: payload.locations,
      }));
    }
    if (payload.plan) {
      setPlan(payload.plan);
    }
  }, [setCoaches, setPlan, setTheme]);

  const buildNewProfilePayload = useCallback<() => ProfilePayload>(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const emptyTheme: ThemeSettings = {
      ...DEFAULT_THEME,
      ui: { ...theme.ui },
      locale: theme.locale,
      clubName: theme.clubName,
      locations: {},
    };

    return {
      rosterMeta: {
        season: normalizedRoster.season,
        ageGroups: normalizedRoster.ageGroups,
      },
      players: [],
      coaches: [],
      locations: {},
      clubLogoDataUrl: null,
      theme: emptyTheme,
      plan: {
        weekId: `WEEK_${isoWeekMonday(todayIso)}`,
        sessions: [],
      },
    };
  }, [normalizedRoster.ageGroups, normalizedRoster.season, theme.clubName, theme.locale, theme.ui]);

  const {
    profiles,
    setProfiles,
    activeProfileId,
    setActiveProfileId,
    setProfileHydratedId,
    profilesOpen,
    setProfilesOpen,
    profileNameInput,
    setProfileNameInput,
    logoUploadError,
    profileMenuOpen,
    setProfileMenuOpen,
    profileMenuRef,
    clubLogoDataUrl,
    setClubLogoDataUrl,
    activeProfileName,
    activeProfileSync,
    currentProfilePayload,
    handleClubLogoUpload,
    createProfile,
    updateActiveProfile,
    deleteActiveProfile,
    selectProfile,
  } = useProfilesState({
    t,
    tf,
    rosterMeta,
    players,
    coaches,
    theme,
    plan,
    locations: (theme.locations ?? DEFAULT_THEME.locations!) as NonNullable<ThemeSettings["locations"]>,
    clubLogoStorageKey: CLUB_LOGO_STORAGE_KEY,
    clubLogoMaxBytes: CLUB_LOGO_MAX_BYTES,
    buildNewProfilePayload,
    onApplyProfileData: applyProfileData,
  });

  /* ----------------------
     Ensure TBD placeholder exists
     ---------------------- */
  useEffect(() => {
    setPlayers((prev) => {
      if (prev.some((p) => p.id === "TBD")) return prev;
      const tbd: Player = {
        id: "TBD",
        name: "TBD",
        firstName: "TBD",
        lastName: "",
        group: "TBD",
        positions: [],
        primaryYouthTeam: "",
        primarySeniorTeam: "",
        defaultTeams: [],
        lizenzen: [],
        isLocalPlayer: false,
      };
      return [...prev, tbd];
    });
  }, []);

  /* ----------------------
     Plan: use last plan if exists, else master
     ---------------------- */
  const scheduleSessions = useMemo(() => selectScheduleSessions(plan), [plan]);

  /* ----------------------
     Export HTML (Source of Truth)
     ---------------------- */
  const exportPages = useMemo(() => {
    return buildPrintPages({
      sessions: scheduleSessions,
      players,
      coaches,
      clubName: theme.clubName,
      locale: theme.locale,
      locations: theme.locations ?? DEFAULT_THEME.locations!,
      logoUrl: clubLogoDataUrl ?? undefined,
      groupColors: theme.groups ? Object.fromEntries(Object.entries(theme.groups).map(([k, v]) => [k, v.bg])) : undefined,
      groupTextColors: theme.groups ? Object.fromEntries(Object.entries(theme.groups).map(([k, v]) => [k, v.fg ?? ""])) : undefined,
      kwText: kwLabelFromPlan(plan),
    });
  }, [scheduleSessions, plan, players, coaches, theme, clubLogoDataUrl]);

  const previewPages = useMemo(() => {
    const groupColors = Object.fromEntries(
      Object.entries(theme.groups).map(([k, v]) => [k, v.bg])
    );
    const groupTextColors = Object.fromEntries(
      Object.entries(theme.groups).map(([k, v]) => [k, v.fg ?? ""])
    );
    return buildPreviewPages({
      sessions: scheduleSessions,
      players,
      coaches,
      clubName: theme.clubName,
      locale: theme.locale,
      locations: theme.locations ?? DEFAULT_THEME.locations!,
      logoUrl: clubLogoDataUrl ?? undefined,
      groupColors,
      groupTextColors,
      kwText: kwLabelFromPlan(plan),
    });
  }, [scheduleSessions, plan, players, coaches, theme, clubLogoDataUrl]);

  const { createPlanPdf, createPlanPngPages } = usePdfExport({
    exportPages,
    clubName: theme.clubName,
    weekId: plan.weekId,
  });

  /* ----------------------
     Derived
     ---------------------- */
  const conflictsBySession = useMemo(() => computeConflictsBySession(plan), [plan]);

  const [collapsedParticipantsBySession, setCollapsedParticipantsBySession] = useState<Record<string, boolean>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const historyFlagsBySession = useMemo(
    () => computeHistoryFlagsBySession(plan, playerById),
    [plan, playerById]
  );

  const sortParticipants = useMemo(() => makeParticipantSorter(playerById), [playerById]);
  const trainingCounts = useMemo(() => computeTrainingCounts(plan), [plan]);
  const locationUsageMap = useLocationUsageMap(scheduleSessions);

  // Plan date set & birthdays for players present in the plan
  const planDates = useMemo(() => planDateSet(plan), [plan]);

  const birthdayPlayerIds = useMemo(() => {
    const res = new Set<string>();
    for (const s of scheduleSessions) {
      for (const pid of s.participants ?? []) {
        const p = playerById.get(pid);
        if (!p) continue;
        if (isBirthdayOnAnyPlanDate(p, planDates)) res.add(pid);
      }
    }
    return res;
  }, [scheduleSessions, playerById, planDates]);

  /* ----------------------
     Sidebar grouping
     ---------------------- */
  const playersByGroup = useMemo(() => {
    const map = new Map<GroupId, Player[]>();
    for (const g of GROUPS) map.set(g.id, []);

    for (const p of players) {
      // nur Core (oder TBD) in die Jahrgang/Herren-Gruppen
      if (!isCorePlayer(p)) continue;
      map.get(getPlayerGroup(p))?.push(p);
    }

    for (const [gid, arr] of map.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, "de"));
      map.set(gid, arr);
    }
    return map;
  }, [players]);
  const u18OnlyPlayers = useMemo(() => {
    return players.filter(isU18Only).slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [players]);

  const holOnlyPlayers = useMemo(() => {
    return players.filter(isHolOnly).slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [players]);
  /* ----------------------
    LEFT TABS: Players / Coaches / Locations
    ---------------------- */

  /* ============================================================
     DnD: add/remove participants
     ============================================================ */
  function removePlayerFromSession(sessionId: string, playerId: string, occurrenceIndex?: number) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const base = [...(s.participants ?? [])];
        const next =
          typeof occurrenceIndex === "number"
            ? base.filter((id, idx) => !(id === playerId && idx === occurrenceIndex))
            : base.filter((id) => id !== playerId);
        next.sort(sortParticipants);
        return { ...s, participants: next };
      }),
    }));
  }


  /* ============================================================
     Event planner
     ============================================================ */


  const {
    editorState,
    setEditingSessionId,
    setFormDate,
    setFormTeams,
    setLocationMode,
    setCustomLocation,
    setFormStart,
    setFormDuration,
    setFormOpponent,
    setFormWarmupMin,
    setFormTravelMin,
    setFormExcludeFromRoster,
    setFormRowColor,
    currentLocationValue,
    onToggleTeam,
    resetForm,
    buildSessionFromForm,
  } = useEventPlannerState();

  const {
    editingSessionId,
    formDate,
    formTeams,
    locationMode,
    formStart,
    formDuration,
    formOpponent,
    formWarmupMin,
    formTravelMin,
    formExcludeFromRoster,
    formRowColor,
  } = editorState;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const opponentInputRef = useRef<HTMLInputElement | null>(null);
  const editorTopRef = useRef<HTMLDivElement | null>(null);
  const [quickRosterOpen, setQuickRosterOpen] = useState(false);
  const [quickRosterSearch, setQuickRosterSearch] = useState("");
  const [teamCodeDraft, setTeamCodeDraft] = useState("");
  const [formParticipants, setFormParticipants] = useState<string[]>([]);
  const [quickRosterFilters, setQuickRosterFilters] = useState<string[]>([activeYearGroups[0] ?? "TBD"]);

  function handleRecallLocationEdit() {
    const current = currentLocationValue().trim();
    setLeftTab("locations");
    setLeftEditMode(true);

    if (!current || current === "-") {
      setOpenLocationName(null);
      return;
    }

    setOpenLocationName(current);
  }
  const { upsert: upsertSessionInPlan, remove: removeSessionFromPlan } = useSessionEditor(setPlan, sortParticipants);

  function upsertSession() {
    if (!formDate || formTeams.length === 0) return;

    if (editingSessionId) {
      const old = plan.sessions.find((s) => s.id === editingSessionId);
      if (old) upsertSessionInPlan(buildSessionFromForm(old.id, formParticipants));
    } else {
      upsertSessionInPlan(buildSessionFromForm(undefined, formParticipants));
    }

    resetForm();
    setFormParticipants([]);
    setQuickRosterOpen(false);
    setQuickRosterSearch("");
  }

  function onEditSession(s: Session) {
    setEventEditorOpen(true);
    setQuickRosterOpen(false);
    setQuickRosterSearch("");
    setEditingSessionId(s.id);
    setFormDate(s.date);
    setFormTeams(Array.isArray(s.teams) ? s.teams : []);

    // Scroll to editor and focus opponent field
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Focus nach einer kurzen Verzögerung, damit das Scroll abgeschlossen ist
      setTimeout(() => {
        opponentInputRef.current?.focus();
        opponentInputRef.current?.select();
      }, 500);
    });

    const loc = (s.location ?? "").trim();
    const savedLocations = Object.keys(theme.locations?.locations ?? {});
    const isKnownLocation = LOCATION_PRESETS.includes(loc as (typeof LOCATION_PRESETS)[number]) || savedLocations.includes(loc);
    setLocationMode(isKnownLocation ? loc : "");
    setCustomLocation("");

    const tr = splitTimeRange(s.time ?? "");
    const start = tr ? tr[0] : "18:00";
    setFormStart(start);

    if (tr) {
      const [st, en] = tr;
      const startMin = parseInt(st.slice(0, 2), 10) * 60 + parseInt(st.slice(3, 5), 10);
      const endMin = parseInt(en.slice(0, 2), 10) * 60 + parseInt(en.slice(3, 5), 10);
      const dur = Math.max(0, endMin - startMin);
      setFormDuration(dur || 90);
    } else {
      setFormDuration(90);
    }

    setFormOpponent(stripAutoMeetingSuffix(s.info ?? ""));
    setFormParticipants([...(s.participants ?? [])]);

    const game = isGameInfo(s.info ?? "");
    setFormWarmupMin(game ? Number(s.warmupMin ?? 30) : 30);
    setFormTravelMin(game ? Number(s.travelMin ?? 0) : 0);
    setFormExcludeFromRoster(s.excludeFromRoster === true);
    setFormRowColor(s.rowColor ?? "");
  }

  async function onDeleteSession(sessionId: string) {
    const s = plan.sessions.find((x) => x.id === sessionId);
    const label = s ? `${s.day} ${s.date} | ${(s.teams ?? []).join("/")} | ${s.time}` : sessionId;
    if (!(await askConfirm(t("delete"), tf("confirmDeleteEvent", { label })))) return;

    removeSessionFromPlan(sessionId);
    if (editingSessionId === sessionId) {
      resetForm();
      setFormParticipants([]);
      setQuickRosterOpen(false);
      setQuickRosterSearch("");
    }
  }

  function toggleSessionTravel(sessionId: string) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const cur = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));
        const next = cur > 0 ? 0 : 30;
        return { ...s, travelMin: next };
      }),
    }));
  }

  function toggleSessionWarmup(sessionId: string) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const cur = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));
        const next = cur > 0 ? 0 : 30;
        return { ...s, warmupMin: next };
      }),
    }));
  }

  function handleOpenEventEditor(eventId: string) {
    const target = plan.sessions.find((x) => x.id === eventId);
    if (!target) return;
    onEditSession(target);
    requestAnimationFrame(() => {
      editorTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        const dateEl = document.getElementById("event_form_date") as HTMLInputElement | null;
        if (dateEl) dateEl.focus();
      }, 500);
    });
  }

  function upsertPlayerLicenseTna(player: Player, typ: string, tna: string): Player {
    const wanted = String(typ ?? "").trim().toUpperCase();
    const nextTna = String(tna ?? "").trim();
    const list = [...(player.lizenzen ?? [])];
    const idx = list.findIndex((x) => String(x.typ ?? "").trim().toUpperCase() === wanted);
    const entry = { typ: wanted, tna: nextTna, verein: list[idx]?.verein ?? "" };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...entry };
    } else {
      list.push(entry);
    }
    return { ...player, lizenzen: list };
  }

  const allTeamOptions = useMemo(() => {
    const fromPlayers = players.flatMap((p) => p.defaultTeams ?? []);
    const fromPlan = plan.sessions.flatMap((s) => s.teams ?? []);
    const options = [...BASE_TEAM_OPTIONS, ...fromPlayers, ...fromPlan, ...(formTeams ?? [])]
      .map((team) => normalizeTeamCode(team))
      .filter(Boolean);
    return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "de"));
  }, [formTeams, plan.sessions, players]);

  function addTeamCodeFromDraft(applyTo: "event" | "player") {
    const teamCode = normalizeTeamCode(teamCodeDraft);
    if (!teamCode) return;
    if (applyTo === "event") {
      setFormTeams((prev) => (prev.includes(teamCode) ? prev : [...prev, teamCode]));
    } else if (selectedPlayerId) {
      const selected = players.find((p) => p.id === selectedPlayerId);
      const current = selected?.defaultTeams ?? [];
      if (!current.includes(teamCode)) {
        updatePlayer(selectedPlayerId, { defaultTeams: [...current, teamCode] });
      }
    }
    setTeamCodeDraft("");
  }

  const quickRosterTabs = useMemo(() => {
    const yearTabs = activeYearGroups.map((year) => ({
      id: year,
      label: year,
    }));

    const dynamicTeamCodes = Array.from(
      new Set(
        players
          .flatMap((p) => p.defaultTeams ?? [])
          .map((code) => normalizeTeamCode(String(code ?? "")))
          .filter(Boolean)
      )
    );

    const teamCodes = Array.from(new Set([...allTeamOptions, ...dynamicTeamCodes].map((code) => normalizeTeamCode(code))));

    const teamLabelByCode: Record<string, string> = {
      HOL: t("rosterQuickPickerTabHol"),
      U18: t("rosterQuickPickerTabU18"),
      NBBL: t("rosterQuickPickerTabNbbl"),
      "1RLH": t("rosterQuickPickerTabRlh"),
    };

    const teamTabs = teamCodes.map((code) => ({
      id: code,
      label: teamLabelByCode[code] ?? code,
    }));

    return [
      ...yearTabs,
      ...teamTabs,
      { id: "TBD", label: t("rosterQuickPickerTabTbd") },
    ];
  }, [activeYearGroups, allTeamOptions, players, t]);

  useEffect(() => {
    const available = new Set(quickRosterTabs.map((tab) => tab.id));
    setQuickRosterFilters((prev) => {
      const next = prev.filter((id) => available.has(id));
      if (next.length > 0) return next;
      return [quickRosterTabs[0]?.id ?? activeYearGroups[0] ?? "TBD"];
    });
  }, [activeYearGroups, quickRosterTabs]);

  const quickRosterPlayers = useMemo(() => {
    const q = quickRosterSearch.trim().toLowerCase();
    const inSearch = (p: Player) => {
      if (!q) return true;
      const text = [
        p.name,
        p.firstName,
        p.lastName,
        p.primaryYouthTeam,
        p.primarySeniorTeam,
        ...(p.defaultTeams ?? []),
        primaryTna(p),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    };

    const inTab = (p: Player) => {
      if (quickRosterFilters.length === 0) return true;
      return quickRosterFilters.every((filter) => {
        if (activeYearGroups.includes(String(filter))) {
          const g = getPlayerGroup(p);
          return g === filter;
        }
        if (filter === "TBD") return p.id === "TBD";
        const defaults = (p.defaultTeams ?? [])
          .map((code) => normalizeTeamCode(String(code ?? "")));
        return defaults.includes(normalizeTeamCode(String(filter ?? "")));
      });
    };

    return players
      .filter(inTab)
      .filter(inSearch)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [activeYearGroups, players, quickRosterFilters, quickRosterSearch]);

  function countInFormParticipants(playerId: string): number {
    return formParticipants.reduce((acc, id) => acc + (id === playerId ? 1 : 0), 0);
  }

  function removeFromFormParticipants(playerId: string) {
    setFormParticipants((prev) => {
      const idx = prev.findIndex((id) => id === playerId);
      if (idx < 0) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function addToFormParticipants(playerId: string) {
    if (!playerId) return;

    if (playerId !== "TBD" && formParticipants.includes(playerId)) return;

    const draft = buildSessionFromForm(editingSessionId ?? "__draft__", formParticipants);
    const overlaps = playerId === "TBD"
      ? []
      : plan.sessions.filter((session) => {
        if (session.id === draft.id) return false;
        if (!(session.participants ?? []).includes(playerId)) return false;
        return sessionsOverlap(session, draft);
      });

    if (overlaps.length) {
      const labelA = `${draft.day} ${draft.date} ${draft.time}`;
      const labelB = overlaps.map((x) => `${x.day} ${x.date} ${x.time}`).join(" | ");
      setLastDropError(`Konflikt: Spieler ist bereits in überschneidenden Events (${labelB}). Ziel: ${labelA}`);
      return;
    }

    const targetIsGame = isGameSession(draft);
    const requiredTaType = getRequiredTaTypeForTeams(draft.teams);
    if (playerId !== "TBD" && targetIsGame && requiredTaType) {
      const player = players.find((p) => p.id === playerId);
      if (player && !getLicenseTnaByType(player, requiredTaType)) {
        const input = await askPrompt(
          t("confirm"),
          tf("promptTaNumber", {
            playerName: player.name,
            teams: draft.teams.join("·"),
            type: requiredTaType,
          }),
          "",
          t("taNumber")
        );

        if (input === null || input.trim() === "") return;

        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? upsertPlayerLicenseTna(p, requiredTaType, input.trim()) : p))
        );
      }
    }

    setLastDropError(null);
    setFormParticipants((prev) => [...prev, playerId].sort(sortParticipants));
  }

  const dnd = useDndPlan({
    weekPlan: plan,
    setWeekPlan: setPlan,
    players,
    setPlayers,
    setLastDropError,
    sortParticipants,
    removePlayerFromSession,
    sessionsOverlap,
    isGameSession,
    t,
    tf,
    confirm: askConfirm,
    prompt: askPrompt,
  });

  const {
    buildCloudSnapshot,
    applyCloudSnapshot,
    isCloudSnapshotV1,
    cloudSyncSignal,
    cloudSyncEnabledForActiveProfile,
    updateActiveProfileSync,
  } = useCloudSnapshotHandlers({
    rosterMeta,
    players,
    coaches,
    theme,
    plan,
    activeProfileId,
    activeProfileName,
    activeProfileSync,
    clubLogoDataUrl,
    setRosterMeta,
    setPlayers,
    setCoaches,
    setTheme,
    setPlan,
    setClubLogoDataUrl,
    setProfiles,
    setProfileHydratedId,
    setActiveProfileId,
  });

  const {
    cloudConfigured,
    cloudEmailInput,
    cloudStatusMsg,
    cloudUserEmail,
    cloudBusy,
    cloudLastSyncAt,
    cloudAutoSync,
    setCloudEmailInput,
    signInToCloud,
    signOutFromCloud,
    loadSnapshotFromCloud,
    saveSnapshotToCloud,
    toggleCloudAutoSync,
  } = useCloudSync<CloudSnapshotV1>({
    t,
    profileId: activeProfileId || null,
    enabled: cloudSyncEnabledForActiveProfile,
    autoSyncEnabled: Boolean(activeProfileSync.autoSync),
    onAutoSyncChange: (next: boolean) => updateActiveProfileSync({ autoSync: next }),
    buildSnapshot: buildCloudSnapshot,
    applySnapshot: applyCloudSnapshot,
    isSnapshot: isCloudSnapshotV1,
    autoSyncSignal: cloudSyncSignal,
  });
  const cloudFirstSetupDoneForEmailRef = useRef<string | null>(null);
  const [cloudBootstrapPendingProfileId, setCloudBootstrapPendingProfileId] = useState<string | null>(null);
  const [cloudProfileStatusMsg, setCloudProfileStatusMsg] = useState("");

  useEffect(() => {
    if (!cloudConfigured || !cloudUserEmail) {
      setCloudProfileStatusMsg("");
      return;
    }
    if (cloudFirstSetupDoneForEmailRef.current === cloudUserEmail) return;
    let cancelled = false;

    void (async () => {
      try {
        const cloudRows = await listCloudSnapshots();
        if (cancelled) return;

        const cloudProfiles: SavedProfile[] = [];
        for (const row of cloudRows) {
          if (!isCloudSnapshotV1(row.snapshot)) continue;
          const snap = row.snapshot;
          cloudProfiles.push({
            id: row.profileId || snap.profileId,
            name: snap.profileName || row.profileId || t("profileNamePlaceholder"),
            payload: {
              rosterMeta: snap.data.rosterMeta,
              players: snap.data.players,
              coaches: snap.data.coaches,
              locations: (snap.data.theme.locations ?? DEFAULT_THEME.locations!) as NonNullable<ThemeSettings["locations"]>,
              clubLogoDataUrl: snap.data.clubLogoDataUrl ?? null,
              theme: snap.data.theme,
              plan: snap.data.plan,
            },
            sync: { mode: "cloud", provider: "supabase", autoSync: true },
          });
        }

        if (cloudProfiles.length === 0) {
          let bootstrapProfileId = "";

          if (profiles.length > 0) {
            const source = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
            bootstrapProfileId = source.id;

            setProfiles((prev) =>
              prev.map((p) =>
                p.id === source.id
                  ? {
                    ...p,
                    payload: currentProfilePayload,
                    sync: {
                      ...p.sync,
                      mode: "cloud",
                      provider: "supabase",
                    },
                  }
                  : p
              )
            );
          } else {
            bootstrapProfileId = randomId("profile_");
            const starter: SavedProfile = {
              id: bootstrapProfileId,
              name: t("profileDefaultName"),
              payload: buildNewProfilePayload(),
              sync: { mode: "cloud", provider: "supabase", autoSync: true },
            };
            setProfiles([starter]);
          }

          if (bootstrapProfileId) {
            setActiveProfileId(bootstrapProfileId);
            setCloudBootstrapPendingProfileId(bootstrapProfileId);
          }

          cloudFirstSetupDoneForEmailRef.current = cloudUserEmail;
          return;
        }

        setProfiles((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p] as const));
          for (const cloudProfile of cloudProfiles) {
            const existing = byId.get(cloudProfile.id);
            byId.set(cloudProfile.id, {
              ...(existing ?? cloudProfile),
              ...cloudProfile,
              sync: {
                mode: "cloud",
                provider: "supabase",
                autoSync: existing?.sync.autoSync ?? cloudProfile.sync.autoSync,
              },
            });
          }
          return Array.from(byId.values());
        });

        setActiveProfileId((prev) => prev || cloudProfiles[0].id);
        cloudFirstSetupDoneForEmailRef.current = cloudUserEmail;
        setCloudProfileStatusMsg("");
      } catch (err) {
        // keep local profiles if cloud listing fails
        const msg = err instanceof Error ? err.message : String(err ?? "");
        const full = `${t("cloudProfileSyncError")}: ${msg || "unknown error"}`;
        setCloudProfileStatusMsg(full);
        console.error(full);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeProfileId,
    cloudConfigured,
    cloudUserEmail,
    currentProfilePayload,
    buildNewProfilePayload,
    isCloudSnapshotV1,
    profiles,
    setActiveProfileId,
    setProfiles,
    t,
  ]);

  useEffect(() => {
    if (!cloudBootstrapPendingProfileId) return;
    if (activeProfileId !== cloudBootstrapPendingProfileId) return;
    if (!cloudSyncEnabledForActiveProfile || !cloudUserEmail) return;

    void saveSnapshotToCloud(false).finally(() => {
      setCloudBootstrapPendingProfileId(null);
    });
  }, [
    activeProfileId,
    cloudBootstrapPendingProfileId,
    cloudSyncEnabledForActiveProfile,
    cloudUserEmail,
    saveSnapshotToCloud,
  ]);

  const handleDeleteProfile = useCallback(() => {
    const profileIdToDelete = activeProfileId;
    const deleteCloudCopy = Boolean(
      profileIdToDelete && activeProfileSync.mode === "cloud" && cloudUserEmail
    );

    deleteActiveProfile();

    if (!deleteCloudCopy || !profileIdToDelete) return;
    void deleteCloudSnapshot(profileIdToDelete).catch((err) => {
      // local deletion should still succeed even if cloud delete fails
      const msg = err instanceof Error ? err.message : String(err);
      const full = `${t("cloudProfileDeleteError")}: ${msg}`;
      setCloudProfileStatusMsg(full);
      console.error(full);
    });
  }, [activeProfileId, activeProfileSync.mode, cloudUserEmail, deleteActiveProfile, t]);

  /* ============================================================
     Roster editor: import/export roster.json
     (minimal editor – erweitert später um LP/Trikot/Positions etc.)
     ============================================================ */

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return playerById.get(selectedPlayerId) ?? null;
  }, [selectedPlayerId, playerById]);

  const { updatePlayer, addNewPlayer, deletePlayer, importRosterFile, importMmbFile, exportRoster } = usePlayerActions({
    players,
    setPlayers,
    rosterMeta,
    setRosterMeta,
    setPlan,
    setSelectedPlayerId,
    setLastDropError,
    t,
    clubName: theme.clubName,
  });

  const rosterFileRef = useRef<HTMLInputElement | null>(null);
  const mmbFileRef = useRef<HTMLInputElement | null>(null);

  /* ============================================================
     New Week
     ============================================================ */

  const {
    weekLabel,
    weekDates,
    createNewWeek: createWeekFromMode,
  } = useWeekManager({
    plan,
    setPlan,
    masterPlan,
    birthdayPlayerIds,
    setNewWeekOpen,
    resetForm,
  });

  const closeNewWeek = useCallback(() => setNewWeekOpen(false), [setNewWeekOpen]);

  const {
    weekArchiveOpen,
    setWeekArchiveOpen,
    archiveTemplateStart,
    setArchiveTemplateStart,
    activeArchiveEntries,
    handleSaveCurrentWeekToArchive,
    handleLoadArchiveEntry,
    handleDeleteArchiveEntry,
    handleUseArchiveAsTemplate,
    createNewWeek,
  } = useWeekArchiveManager({
    plan,
    setPlan,
    activeProfileId,
    t,
    askConfirm,
    createWeekFromMode,
  });

  /* ============================================================
     Responsive CSS
     ============================================================ */

  const responsiveCss = `
    /* --- Robust defaults --- */
    * { box-sizing: border-box; }

    input, select, button, textarea {
      font: inherit;
    }

    input, select, textarea {
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .shrink0 { min-width: 0; }

    /* Grid helpers */
    .grid2 {
      display: grid;
      grid-template-columns: minmax(110px, 160px) minmax(0, 1fr);
      gap: 10px;
    }

    .grid2equal {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .rosterGrid {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      gap: 12px;
    }

    .flexRow {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .flexRow > * { min-width: 0; }

    .touchBtn {
      min-height: 42px;
    }

    .leftTabsRow {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .leftTabsGroup {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
      flex: 1 1 260px;
    }

    .leftTabsEdit {
      margin-left: auto;
      display: flex;
      justify-content: flex-end;
      min-width: 0;
      flex: 0 0 auto;
    }

    .leftSectionHeader {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .groupHeaderBtn {
      width: 100%;
      text-align: left;
      border: 1px solid var(--ui-border);
      background: var(--ui-card);
      color: var(--ui-text);
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-weight: 900;
    }

    .groupHeaderLeft {
      min-width: 0;
      flex: 1 1 auto;
    }

    .groupHeaderRight {
      min-width: 0;
      color: var(--ui-muted);
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .topBar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .topBarLeft,
    .topBarRight {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    .topBarRight {
      margin-left: auto;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .profileQuickMenu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 240px;
      max-width: min(320px, 92vw);
      border: 1px solid var(--ui-border);
      border-radius: 12px;
      background: var(--ui-card);
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
      padding: 8px;
      z-index: 200;
      display: grid;
      gap: 6px;
    }

    .modalBody { container-type: inline-size; }

    /* Layout */
    .appGrid {
      display: grid;
      grid-template-columns: minmax(280px, 380px) 1fr;
      height: 100vh;
    }

    .appGrid3 {
      grid-template-columns: minmax(280px, 380px) 1fr minmax(360px, 520px);
    }

    @media (max-width: 980px) {
      .appGrid {
        grid-template-columns: 1fr;
        height: auto;
        min-height: 100vh;
      }
      .leftPane {
        border-right: none !important;
        border-bottom: 1px solid var(--ui-border);
        max-height: none !important;
      }

      .leftTabsEdit {
        margin-left: 0;
        width: 100%;
        justify-content: flex-start;
      }

      .groupHeaderRight {
        white-space: normal;
      }

      .rightPane {
        height: auto !important;
      }
      .optionalPane {
        border-left: none !important;
        border-top: 1px solid var(--ui-border);
      }
      .grid2, .grid2equal, .rosterGrid {
        grid-template-columns: 1fr;
      }

      .topBar {
        align-items: stretch;
      }

      .topBarLeft,
      .topBarRight {
        width: 100%;
      }

      .topBarRight {
        margin-left: 0;
        justify-content: flex-start;
      }

      .profileQuickMenu {
        position: fixed;
        left: 12px;
        right: 12px;
        top: auto;
        bottom: 12px;
        max-width: none;
        min-width: 0;
        max-height: 55vh;
        overflow: auto;
        z-index: 1000;
      }
    }

    .weekGrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(320px, 1fr));
      gap: 12px;
    }
    @media (max-width: 1100px) {
      .weekGrid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
    }

    @container (max-width: 860px) {
      .rosterGrid, .grid2, .grid2equal {
        grid-template-columns: 1fr;
      }
    }
  `;

  /* ============================================================
     Render
     ============================================================ */

  // DnD Sensors: separate mouse/touch improve Android drag reliability.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 140, tolerance: 8 },
    })
  );

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <>
      <style>{responsiveCss}</style>

      <PrintView
        plan={plan}
        playerById={playerById}
        groupBg={groupBg}
        groupText={groupText}
        coaches={coaches}
        birthdayPlayerIds={birthdayPlayerIds}
        clubName={theme.clubName}
        logoUrl={clubLogoDataUrl ?? null}
        locations={theme.locations}
        t={t}
      />

      <div
        id="app-root"
        style={{
          background: "var(--ui-bg)",
          color: "var(--ui-text)",
          minHeight: "100vh",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        }}
      >
        <DndContext sensors={sensors} onDragStart={dnd.onDragStart} onDragOver={dnd.onDragOver} onDragEnd={dnd.onDragEnd}>
          <div className={rightOpen ? "appGrid appGrid3" : "appGrid"}>
            {/* LEFT */}
            <LeftSidebar
              t={t}
              leftTab={leftTab}
              leftEditMode={leftEditMode}
              onSelectTab={(tab) => { setLeftTab(tab); setLeftEditMode(false); }}
              onToggleEditMode={() => setLeftEditMode((v) => !v)}
              onOpenRoster={() => { setRosterSearch(""); setRosterOpen(true); }}
              openExtra={openExtra}
              onToggleU18Only={() => setOpenExtra((prev) => (prev === "U18_ONLY" ? null : "U18_ONLY"))}
              onToggleHolOnly={() => setOpenExtra((prev) => (prev === "HOL_ONLY" ? null : "HOL_ONLY"))}
              u18OnlyPlayers={u18OnlyPlayers}
              holOnlyPlayers={holOnlyPlayers}
              openGroup={openGroup}
              onToggleGroup={(gid) => setOpenGroup((prev) => (prev === gid ? null : gid))}
              playersByGroup={playersByGroup}
              renderDraggablePlayer={(p) => (
                <DraggablePlayerRow
                  key={p.id}
                  player={p}
                  trainingCount={trainingCounts.get(p.id) ?? 0}
                  groupBg={groupBg}
                  groupText={groupText}
                  isBirthday={birthdayPlayerIds.has(p.id)}
                  t={t}
                />
              )}
              coaches={coaches}
              onAddCoach={addCoach}
              onUpdateCoach={updateCoach}
              onDeleteCoach={deleteCoach}
              onExportStaff={exportStaff}
              onImportStaffFile={importStaffFile}
              theme={theme}
              setTheme={setTheme}
              locationUsageMap={locationUsageMap}
              openLocationName={openLocationName}
              setOpenLocationName={setOpenLocationName}
            />
            {/* RIGHT */}
            <div className="rightPane" style={{ padding: 16, overflow: "auto", background: "var(--ui-bg)" }}>
              <AppTopBar
                locale={lang}
                t={t}
                clubLogoDataUrl={clubLogoDataUrl}
                activeProfileName={activeProfileName}
                profiles={profiles}
                activeProfileId={activeProfileId}
                profileMenuOpen={profileMenuOpen}
                profileMenuRef={profileMenuRef}
                onToggleLang={() =>
                  setTheme((p) => ({ ...p, locale: (p.locale === "de" ? "en" : "de") as Lang }))
                }
                onOpenProfiles={() => setProfilesOpen(true)}
                onToggleProfileMenu={() => setProfileMenuOpen((v) => !v)}
                onSelectProfileFromMenu={(id) => {
                  selectProfile(id);
                  setProfileMenuOpen(false);
                }}
                activeProfileSelected={Boolean(activeProfileId)}
                onOpenWeekArchive={() => setWeekArchiveOpen(true)}
                eventEditorOpen={eventEditorOpen}
                onToggleEventEditor={() => setEventEditorOpen((v) => !v)}
                onOpenNewWeek={() => setNewWeekOpen(true)}
                rightOpen={rightOpen}
                onToggleRightSidebar={() => setRightOpen((v) => !v)}
                onOpenSettings={() => setSettingsOpen(true)}
              />

              {/* Editor Top Anchor */}
              <div ref={editorTopRef} id="event-editor-top" />

              {/* Event planner */}
              <EventEditorModal
                open={eventEditorOpen}
                onClose={() => setEventEditorOpen(false)}
                title={editingSessionId ? t("eventEdit") : t("eventPlan")}
                closeLabel={t("close")}
              >
                <div ref={editorRef} style={{ border: `1px solid var(--ui-border)`, borderRadius: 16, background: "var(--ui-panel)", overflow: "hidden" }}>
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      background: "var(--ui-panel)",
                      borderBottom: editingSessionId ? `1px solid var(--ui-border)` : "none",
                      padding: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>
                        {editingSessionId ? t("eventEdit") : t("eventPlan")}
                      </div>
                      <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                        {t("week")}: {weekLabel}
                      </div>
                    </div>
                    {editingSessionId && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <Button
                          variant="danger"
                          onClick={() => onDeleteSession(editingSessionId)}
                          style={{ padding: "8px 10px", fontSize: 13 }}
                        >
                          🗑 {t("delete")}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>

                    <div className="grid2">
                      <div style={{ fontWeight: 900 }}>{t("date")}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {weekDates.map((d) => {
                            const active = d === formDate;
                            const wd = weekdayShortLocalized(d, lang);
                            const dd = d.slice(8, 10);
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setFormDate(d)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 999,
                                  border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
                                  background: active ? "rgba(59,130,246,.18)" : "transparent",
                                  color: "var(--ui-text)",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  fontSize: 12,
                                  minHeight: 36,
                                }}
                              >
                                {wd} {dd}
                              </button>
                            );
                          })}
                        </div>
                        <Input id="event_form_date" type="date" value={formDate} onChange={setFormDate} />
                      </div>

                      <div style={{ fontWeight: 900 }}>{t("teams")}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div className="flexRow">
                        {allTeamOptions.map((teamOption) => {
                          const active = formTeams.includes(teamOption);
                          return (
                            <Button
                              key={teamOption}
                              variant={active ? "solid" : "outline"}
                              onClick={() => onToggleTeam(teamOption)}
                              style={{ padding: "8px 10px" }}
                            >
                              {teamOption}
                            </Button>
                          );
                        })}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <Input
                            value={teamCodeDraft}
                            onChange={setTeamCodeDraft}
                            placeholder={lang === "de" ? "Team hinzufügen (z. B. U20)" : "Add team (e.g. U20)"}
                            style={{ maxWidth: 260 }}
                          />
                          <Button
                            variant="outline"
                            onClick={() => addTeamCodeFromDraft("event")}
                            disabled={!teamCodeDraft.trim()}
                            style={{ padding: "8px 10px" }}
                          >
                            + Team
                          </Button>
                        </div>
                      </div>

                      <div style={{ fontWeight: 900 }}>{t("location")}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {(() => {
                          const locationOptions = getLocationOptions(theme, t, locationUsageMap).filter((o) => o.kind !== "custom");
                          return (
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <select
                                value={locationMode}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setLocationMode(v);
                                  setCustomLocation("");
                                }}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  border: "1px solid var(--ui-border)",
                                  background: "var(--ui-card)",
                                  color: "var(--ui-text)",
                                  fontWeight: 900,
                                  width: "100%",
                                }}
                              >
                                <option value="">{t("selectPlaceholder")}</option>
                                {locationOptions.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setLeftTab("locations");
                                  setLeftEditMode(true);
                                  setOpenLocationName(locationMode || null);
                                }}
                                style={{ padding: "8px 10px", whiteSpace: "nowrap" }}
                              >
                                {lang === "de" ? "Orte bearbeiten" : "Edit locations"}
                              </Button>
                            </div>
                          );
                        })()}
                        {!locationMode && (
                          <div style={{ fontSize: 11, color: "var(--ui-muted)", fontWeight: 800 }}>
                            {lang === "de" ? "Ort zuerst links unter Orte anlegen, dann hier auswahlen." : "Create a location in the left Locations panel first, then select it here."}
                          </div>
                        )}
                      </div>

                      <div style={{ fontWeight: 900 }}>{t("start")}</div>
                      <Input type="time" value={formStart} onChange={setFormStart} />

                      <div style={{ fontWeight: 900 }}>{t("duration")} (Min)</div>
                      <MinutePicker
                        value={formDuration}
                        onChange={setFormDuration}
                        presets={[60, 90, 120]}
                        allowZero={false}
                        placeholder={t("minutesExample")}
                      />

                      <div style={{ fontWeight: 900 }}>{t("eventOpponent")}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {(() => {
                          const opponentMode = getOpponentMode(formOpponent);
                          const opponentName = getOpponentName(formOpponent);

                          return (
                            <>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextMode = opponentMode === "home" ? null : "home";
                                    setFormOpponent(composeOpponentInfo(nextMode, opponentName));
                                  }}
                                  style={{
                                    ...segBtn(opponentMode === "home"),
                                    padding: "8px 10px",
                                    fontSize: 12,
                                  }}
                                  title={t("eventModeHomeTitle")}
                                >
                                  vs {t("eventModeHome")}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextMode = opponentMode === "away" ? null : "away";
                                    setFormOpponent(composeOpponentInfo(nextMode, opponentName));
                                  }}
                                  style={{
                                    ...segBtn(opponentMode === "away"),
                                    padding: "8px 10px",
                                    fontSize: 12,
                                  }}
                                  title={t("eventModeAwayTitle")}
                                >
                                  @ {t("eventModeAway")}
                                </button>

                                {opponentMode === "away" && (
                                  <button
                                    type="button"
                                    onClick={handleRecallLocationEdit}
                                    style={{
                                      ...segBtn(false),
                                      padding: "8px 10px",
                                      fontSize: 12,
                                    }}
                                    title={t("eventRecallLocationTitle")}
                                  >
                                    📍 {t("eventRecallLocation")}
                                  </button>
                                )}
                              </div>

                              <Input
                                ref={opponentInputRef}
                                value={formOpponent}
                                onChange={setFormOpponent}
                                placeholder={t("eventOpponentExample")}
                              />
                            </>
                          );
                        })()}
                      </div>

                      {(() => {
                        const info = normalizeOpponentInfo(formOpponent);
                        const game = isGameInfo(info);
                        const away = info.startsWith("@");
                        if (!game) return null;

                        return (
                          <>
                            <div style={{ fontWeight: 900 }}>{t("meetingWarmupMin")}</div>
                            <MinutePicker
                              value={formWarmupMin}
                              onChange={setFormWarmupMin}
                              presets={[45, 60, 75, 90, 105, 120]}
                              allowZero={true}
                              placeholder={t("minutesExample")}
                            />

                            {away && (
                              <>
                                <div style={{ fontWeight: 900 }}>{t("travelMin")}</div>
                                <div style={{ display: "grid", gap: 8 }}>
                                  <MinutePicker
                                    value={formTravelMin}
                                    onChange={setFormTravelMin}
                                    presets={[30, 45, 60, 75, 90, 105, 120, 150]}
                                    allowZero={true}
                                    placeholder={t("minutesExample")}
                                  />
                                  {(() => {
                                    const homeAddr = theme.locations?.homeAddress ?? "";
                                    const destAddr = resolveLocationAddress(currentLocationValue(), theme);

                                    const homePid = theme.locations?.homePlaceId ?? "";
                                    const destPid = resolveLocationPlaceId(currentLocationValue(), theme);

                                    const canAutoTravel = Boolean(homeAddr && destAddr);

                                    async function handleAutoTravel() {
                                      if (!canAutoTravel || autoTravelLoading) return;

                                      setAutoTravelLoading(true);
                                      setAutoTravelError(null);
                                      try {
                                        // Cache nur nutzen, wenn PlaceIds vorhanden
                                        if (homePid && destPid) {
                                          const cached = getCachedTravelMinutes(homePid, destPid, theme);
                                          if (cached != null) {
                                            setFormTravelMin(cached);
                                            setAutoTravelLoading(false);
                                            return;
                                          }
                                        }

                                        const minutes = await fetchTravelMinutes(homeAddr, destAddr);
                                        if (minutes != null) {
                                          setFormTravelMin(minutes);
                                          if (homePid && destPid) {
                                            setCachedTravelMinutes(homePid, destPid, minutes, theme, setTheme);
                                          }
                                        } else {
                                          setAutoTravelError(lang === "de" ? "Keine Route gefunden." : "No route found.");
                                        }
                                      } catch (err) {
                                        const msg = err instanceof Error ? err.message : String(err);
                                        const isNetwork = msg.includes("fetch") || msg.includes("Failed") || msg.includes("NetworkError");
                                        setAutoTravelError(
                                          isNetwork
                                            ? (lang === "de" ? "🔌 Maps-Proxy nicht erreichbar (Port 5055). Proxy starten?" : "🔌 Maps proxy not reachable (port 5055). Start proxy?")
                                            : (lang === "de" ? `Fehler: ${msg}` : `Error: ${msg}`)
                                        );
                                      } finally {
                                        setAutoTravelLoading(false);
                                      }
                                    }

                                    return (
                                      <button
                                        type="button"
                                        onClick={handleAutoTravel}
                                        disabled={!canAutoTravel || autoTravelLoading}
                                        title={
                                          canAutoTravel
                                            ? t("autoTravelTitle")
                                            : t("autoTravelDisabledTitle")
                                        }
                                        style={{
                                          ...segBtn(false),
                                          padding: "8px 10px",
                                          fontSize: 12,
                                          opacity: canAutoTravel ? 1 : 0.5,
                                          cursor: canAutoTravel && !autoTravelLoading ? "pointer" : "not-allowed",
                                        }}
                                      >
                                        {autoTravelLoading ? `⏳ ${t("calculating")}` : `🚗 ${t("autoTravel")}`}
                                      </button>
                                    );
                                  })()}
                                  {autoTravelError && (
                                    <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 800, marginTop: 4 }}>
                                      {autoTravelError}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Options */}
                  <div style={{ padding: "0 12px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={formExcludeFromRoster}
                        onChange={(e) => setFormExcludeFromRoster(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "var(--ui-accent)" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 900 }}>{t("excludeFromRoster") || "Aus Kaderübersicht verbergen"}</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 900 }}>Zeilenfarbe im Zeitplan:</span>
                      <input
                        type="color"
                        value={formRowColor || "#ffffff"}
                        onChange={(e) => setFormRowColor(e.target.value === "#ffffff" ? "" : e.target.value)}
                        style={{ width: 36, height: 28, padding: 2, border: "1px solid var(--ui-border)", borderRadius: 6, cursor: "pointer" }}
                        title="Hintergrundfarbe für Datenzellen im Zeitplan (nur Preview/Export)"
                      />
                      {formRowColor ? (
                        <button
                          type="button"
                          onClick={() => setFormRowColor("")}
                          style={{ fontSize: 11, color: "var(--ui-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Farbe entfernen ✕
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, padding: 12, paddingTop: 0, alignItems: "center", flexWrap: "wrap" }}>
                      <Button onClick={upsertSession}>
                        {editingSessionId ? t("saveChanges") : t("addEvent")}
                      </Button>
                      <Button variant="outline" onClick={() => setQuickRosterOpen(true)}>
                        {t("rosterQuickPickerOpen")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setFormParticipants([]);
                          setQuickRosterOpen(false);
                          setQuickRosterSearch("");
                        }}
                      >
                        {t("reset")}
                      </Button>

                    <div style={{ marginLeft: "auto", color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                      {(() => {
                        const info = normalizeOpponentInfo(formOpponent);
                        const dur = isGameInfo(info) ? 120 : formDuration;
                        return (
                          <>{t("preview")}: {formStart}–{addMinutesToHHMM(formStart, dur)} | {currentLocationValue()}</>
                        );
                      })()}
                      {normalizeOpponentInfo(formOpponent) ? ` | ${normalizeOpponentInfo(formOpponent)}` : ""}
                    </div>
                  </div>
                </div>
              </EventEditorModal>

              {quickRosterOpen && (
                <Modal
                  title={t("rosterQuickPickerTitle")}
                  onClose={() => setQuickRosterOpen(false)}
                  closeLabel={t("close")}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {quickRosterTabs.map((tab) => {
                        const active = quickRosterFilters.includes(tab.id);
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() =>
                              setQuickRosterFilters((prev) =>
                                prev.includes(tab.id)
                                  ? prev.filter((x) => x !== tab.id)
                                  : [...prev, tab.id]
                              )
                            }
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
                              background: active ? "rgba(59,130,246,.18)" : "transparent",
                              color: "var(--ui-text)",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                      <Button
                        variant="outline"
                        onClick={() => setQuickRosterFilters([])}
                        style={{ padding: "8px 10px" }}
                      >
                        {t("reset")}
                      </Button>
                    </div>

                    <Input
                      value={quickRosterSearch}
                      onChange={setQuickRosterSearch}
                      placeholder={t("rosterQuickPickerSearchPlaceholder")}
                    />

                    <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                      {t("rosterQuickPickerSelectedCount")}: {formParticipants.length}
                    </div>

                    <div style={{ maxHeight: "50vh", overflow: "auto", display: "grid", gap: 8 }}>
                      {quickRosterPlayers.length === 0 && (
                        <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12 }}>
                          {t("rosterQuickPickerEmpty")}
                        </div>
                      )}

                      {quickRosterPlayers.map((p) => {
                        const selectedCount = countInFormParticipants(p.id);
                        const isSelected = selectedCount > 0;
                        const group = getPlayerGroup(p);
                        const teamsLabel = Array.from(
                          new Set(
                            (p.defaultTeams ?? [])
                              .map((code) => normalizeTeamCode(String(code ?? "")))
                              .filter(Boolean)
                              .map((code) => (code === "1RLH" ? "RLH" : code))
                          )
                        ).join(" · ");

                        return (
                          <div
                            key={p.id}
                            style={{
                              border: "1px solid var(--ui-border)",
                              borderRadius: 12,
                              background: "var(--ui-card)",
                              padding: 10,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {p.name}
                                {birthdayPlayerIds.has(p.id) ? " 🎂" : ""}
                                {selectedCount > 1 ? ` (${selectedCount})` : ""}
                              </div>
                              <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                                {group} {teamsLabel ? `| ${teamsLabel}` : ""}
                              </div>
                            </div>

                            {isSelected ? (
                              <Button
                                variant="outline"
                                onClick={() => removeFromFormParticipants(p.id)}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {t("remove")}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  void addToFormParticipants(p.id);
                                }}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {t("add")}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Modal>
              )}

              {/* Week plan board */}
              <WeekPlanBoard
                sessions={scheduleSessions}
                lang={lang}
                t={t}
                lastDropError={lastDropError}
                conflictsBySession={conflictsBySession}
                historyFlagsBySession={historyFlagsBySession}
                editingSessionId={editingSessionId}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                collapsedParticipantsBySession={collapsedParticipantsBySession}
                onToggleParticipantsCollapse={(sid) => setCollapsedParticipantsBySession((p) => ({ ...p, [sid]: !p[sid] }))}
                onEditSession={handleOpenEventEditor}
                onDeleteSession={onDeleteSession}
                playerById={playerById}
                removePlayerFromSession={removePlayerFromSession}
                groupBg={groupBg}
                groupText={groupText}
                birthdayPlayerIds={birthdayPlayerIds}
              />

              {/* Print */}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button onClick={createPlanPdf} style={{ padding: "12px 14px" }}>
                  {t("createPdf")}
                </Button>

                <Button onClick={createPlanPngPages} style={{ padding: "12px 14px" }}>
                  {t("exportPng")}
                </Button>
              </div>
            </div>

            <RightSidebar
              open={rightOpen}
              layout={rightLayout}
              topModule={rightTop}
              bottomModule={rightBottom}
              splitPct={rightSplitPct}
              onChangeLayout={setRightLayout}
              onChangeTop={setRightTop}
              onChangeBottom={setRightBottom}
              onChangeSplitPct={setRightSplitPct}
              t={t}
              context={{
                previewPages,
                renderCalendar: () => (
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{t("calendarOverview")}</div>
                      <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                        {weekDates[0]} — {weekDates[6]}
                      </div>
                    </div>
                    <CalendarPane
                      weekDates={weekDates}
                      weekPlan={plan}
                      onOpenEventEditor={handleOpenEventEditor}
                      roster={players}
                      onUpdateWeekPlan={setPlan}
                      dnd={dnd}
                      onDelete={(id) => onDeleteSession(id)}
                      onToggleTravel={toggleSessionTravel}
                      onToggleWarmup={toggleSessionWarmup}
                      editingSessionId={editingSessionId}
                      t={t}
                    />
                  </div>
                ),
              }}
            />
          </div>
        </DndContext>
      </div>

      {/* Settings Modal */}
      <ThemeSettingsModal
        open={settingsOpen}
        theme={theme}
        defaultTheme={DEFAULT_THEME}
        onChangeTheme={setTheme}
        onReset={() => setTheme(DEFAULT_THEME)}
        onClose={() => setSettingsOpen(false)}
        t={t}
        onConfirmOverwrite={(title, message) => askConfirm(title, message)}
      />

      {/* New Week Modal */}
      <NewWeekModal
        open={newWeekOpen}
        onClose={closeNewWeek}
        onCreate={createNewWeek}
        defaultMode="MASTER"
        t={t}
      />

      <ConfirmModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => resolveConfirm(true)}
        onCancel={() => resolveConfirm(false)}
        t={t}
      />

      <PromptModal
        open={promptDialog.open}
        title={promptDialog.title}
        message={promptDialog.message}
        value={promptDialog.value}
        onValueChange={setPromptValue}
        placeholder={promptDialog.placeholder}
        onConfirm={() => resolvePrompt(promptDialog.value.trim())}
        onCancel={() => resolvePrompt(null)}
        t={t}
      />

      <ProfilesModal
        open={profilesOpen}
        onClose={() => setProfilesOpen(false)}
        t={t}
        tf={tf}
        lang={lang}
        profiles={profiles}
        activeProfileId={activeProfileId}
        activeProfileName={activeProfileName}
        profileNameInput={profileNameInput}
        onProfileNameInputChange={setProfileNameInput}
        onSelectProfile={selectProfile}
        onCreateProfile={createProfile}
        onUpdateProfile={updateActiveProfile}
        onDeleteProfile={handleDeleteProfile}
        clubLogoDataUrl={clubLogoDataUrl}
        logoUploadError={logoUploadError}
        logoMaxKb={Math.round(CLUB_LOGO_MAX_BYTES / 1024)}
        onLogoUpload={handleClubLogoUpload}
        onLogoRemove={() => setClubLogoDataUrl(null)}
        syncMode={activeProfileSync.mode}
        onSyncModeChange={(mode: ProfileSyncMode) => updateActiveProfileSync({ mode })}
        cloudConfigured={cloudConfigured}
        cloudUserEmail={cloudUserEmail}
        cloudEmailInput={cloudEmailInput}
        cloudStatusMsg={[cloudStatusMsg, cloudProfileStatusMsg].filter(Boolean).join(" | ")}
        cloudLastSyncAt={cloudLastSyncAt}
        cloudBusy={cloudBusy}
        cloudAutoSync={cloudAutoSync}
        onEmailInputChange={setCloudEmailInput}
        onSignIn={() => {
          void signInToCloud();
        }}
        onLoad={() => {
          void loadSnapshotFromCloud();
        }}
        onSave={() => {
          void saveSnapshotToCloud(false);
        }}
        onToggleAutoSync={toggleCloudAutoSync}
        onSignOut={() => {
          void signOutFromCloud();
        }}
      />

      {weekArchiveOpen && (
        <Modal title={t("weekArchiveTitle")} onClose={() => setWeekArchiveOpen(false)} closeLabel={t("close")}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                {activeProfileName ? `${t("cloudProfileCurrent")}: ${activeProfileName}` : t("profileNone")}
              </div>
              <Button
                variant="outline"
                onClick={handleSaveCurrentWeekToArchive}
                disabled={!activeProfileId || (plan.sessions ?? []).length === 0}
              >
                {t("weekArchiveSaveCurrent")}
              </Button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>{t("weekArchiveTemplateDate")}</div>
              <Input type="date" value={archiveTemplateStart} onChange={setArchiveTemplateStart} />
            </div>

            {activeArchiveEntries.length === 0 ? (
              <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                {t("weekArchiveEmpty")}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: "55vh", overflow: "auto" }}>
                {activeArchiveEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      border: "1px solid var(--ui-border)",
                      borderRadius: 12,
                      background: "var(--ui-card)",
                      padding: 10,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{entry.label}</div>
                    <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                      {new Date(entry.savedAt).toLocaleString(lang === "de" ? "de-DE" : "en-GB")}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Button variant="outline" onClick={() => handleLoadArchiveEntry(entry)}>
                        {t("weekArchiveLoadDraft")}
                      </Button>
                      <Button variant="outline" onClick={() => handleUseArchiveAsTemplate(entry)}>
                        {t("weekArchiveUseTemplate")}
                      </Button>
                      <Button variant="danger" onClick={() => handleDeleteArchiveEntry(entry)}>
                        {t("delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Roster Editor Modal */}
      {rosterOpen && (
        <Modal title={`${t("rosterEdit")} (roster.json)`} onClose={() => setRosterOpen(false)} closeLabel={t("close")}>
          <div className="rosterGrid">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                <div className="flexRow">
                  <Button onClick={addNewPlayer} style={{ padding: "8px 10px" }}>+ {t("playersSingle")}</Button>
                  <Button variant="outline" onClick={exportRoster} style={{ padding: "8px 10px" }}>
                    {t("export")} roster.json
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => rosterFileRef.current?.click()}
                    style={{ padding: "8px 10px" }}
                  >
                    {t("import")} roster.json
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => mmbFileRef.current?.click()}
                    style={{ padding: "8px 10px" }}
                  >
                    {t("import")} MMB (Excel/PDF)
                  </Button>
                  <input
                    ref={rosterFileRef}
                    type="file"
                    accept="application/json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importRosterFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <input
                    ref={mmbFileRef}
                    type="file"
                    accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importMmbFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>

                <div style={{ marginTop: 10, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {t("rosterHintTbd")}
                </div>
                <div style={{ marginTop: 6, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {t("importMmbHint")}
                </div>
              </div>

              <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("players")}</div>
                <Input
                  value={rosterSearch}
                  onChange={setRosterSearch}
                  placeholder={t("rosterSearchPlaceholder")}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ fontSize: 12, color: "var(--ui-muted)", fontWeight: 800, marginBottom: 8 }}>
                  {t("filter")}: {rosterSearch.trim() ? `"${rosterSearch.trim()}"` : "—"}
                </div>
                <div style={{ display: "grid", gap: 6, maxHeight: "60vh", overflow: "auto" }}>
                  {(() => {
                    const q = rosterSearch.trim().toLowerCase();

                    const list = players
                      .filter((p) => p.id !== "TBD")
                      .filter((p) => {
                        if (!q) return true;
                        const hay = [
                          p.name,
                          p.firstName,
                          p.lastName,
                          String(p.birthYear ?? ""),
                          String(p.birthDate ?? ""),
                          primaryTna(p),
                        ]
                          .filter(Boolean)
                          .join(" ")
                          .toLowerCase();
                        return hay.includes(q);
                      })
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, "de"));

                    return list.map((p) => {
                      const active = p.id === selectedPlayerId;
                      const gid = getPlayerGroup(p);
                      const bg = normalizeYearColor(p.yearColor) ?? groupBg[gid] ?? groupBg.TBD;
                      const text = p.yearColor ? pickTextColor(bg) : (groupText[gid] ?? pickTextColor(bg));
                      const subText = text === "#fff" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.72)";
                      const tna = primaryTna(p);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlayerId(p.id)}
                          style={{
                            textAlign: "left",
                            border: `1px solid ${active ? "var(--ui-soft)" : "rgba(0,0,0,0.18)"}`,
                            background: bg,
                            color: text,
                            borderRadius: 12,
                            padding: "10px 10px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                          title={tna ? `${t("primaryTaTna")}: ${tna}` : t("noTaTna")}
                        >
                          <span style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.name}
                          </span>
                          <span style={{ fontWeight: 900, color: subText }}>{gid}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {!selectedPlayer ? (
                <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12, color: "var(--ui-muted)", fontWeight: 900 }}>
                  {t("selectPlayerLeft")}
                </div>
              ) : (
                <>
                  <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedPlayer.name}</div>
                      <Button
                        variant="outline"
                        onClick={() => deletePlayer(selectedPlayer.id)}
                        style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                      >
                        {t("delete").toLowerCase()}
                      </Button>
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("firstName")}</div>
                        <Input value={selectedPlayer.firstName ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { firstName: v })} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("name")}</div>
                        <Input value={selectedPlayer.lastName ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { lastName: v })} />
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("birthYearForGroup")}</div>
                        <Input
                          type="number"
                          value={String(selectedPlayer.birthYear ?? "")}
                          onChange={(v) => updatePlayer(selectedPlayer.id, { birthYear: v ? parseInt(v, 10) : undefined })}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("birthDateOptional")}</div>
                        <Input type="date" value={selectedPlayer.birthDate ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { birthDate: v })} />
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("group")}</div>
                        {(() => {
                          const y = birthYearOf(selectedPlayer);
                          const yearLocked = typeof y === "number" && activeYearGroups.includes(String(y));
                          return (
                            <Select
                              value={selectedPlayer.group ?? getPlayerGroup(selectedPlayer)}
                              onChange={(v) => updatePlayer(selectedPlayer.id, { group: v as GroupId })}
                              options={
                                yearLocked
                                  ? [{ value: String(y), label: String(y) }]
                                  : [
                                    ...activeYearGroups.map((year) => ({ value: year, label: year })),
                                    { value: "Herren", label: "Herren" },
                                  ]
                              }
                              disabled={yearLocked}
                            />
                          );
                        })()}
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("localPlayer")}</div>
                        <Select
                          value={selectedPlayer.isLocalPlayer ? "true" : "false"}
                          onChange={(v) => updatePlayer(selectedPlayer.id, { isLocalPlayer: v === "true" })}
                          options={[
                            { value: "true", label: t("lpYes") },
                            { value: "false", label: t("lpNo") },
                          ]}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 12, borderTop: `1px solid var(--ui-border)`, paddingTop: 12 }}>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("licensesTa")}</div>

                      {(() => {
                        const check = dbbDobMatchesBirthDate(selectedPlayer);
                        if (check?.ok) return null;

                        return (
                          <div
                            style={{
                              marginTop: 10,
                              border: "1px solid #ef4444",
                              background: "rgba(239,68,68,0.12)",
                              borderRadius: 12,
                              padding: "10px 12px",
                              fontWeight: 900,
                              fontSize: 12,
                              color: "var(--ui-text)",
                            }}
                          >
                            ⚠️ {t("dbbTaBirthMismatch")}: {check?.reason}
                          </div>
                        );
                      })()}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("dbbTna")}</div>
                          <Input
                            value={(selectedPlayer.lizenzen ?? []).find((x) => String(x.typ).toUpperCase() === "DBB")?.tna ?? ""}
                            onChange={(v) => {
                              const list = [...(selectedPlayer.lizenzen ?? [])].filter((x) => String(x.typ).toUpperCase() !== "DBB");
                              if (v.trim()) list.push({ typ: "DBB", tna: v.trim(), verein: theme.clubName });
                              updatePlayer(selectedPlayer.id, { lizenzen: list });
                            }}
                            placeholder={t("dbbTnaExample")}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("nbblTna")}</div>
                          <Input
                            value={(selectedPlayer.lizenzen ?? []).find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna ?? ""}
                            onChange={(v) => {
                              const list = [...(selectedPlayer.lizenzen ?? [])].filter((x) => String(x.typ).toUpperCase() !== "NBBL");
                              if (v.trim()) list.push({ typ: "NBBL", tna: v.trim(), verein: theme.clubName });
                              updatePlayer(selectedPlayer.id, { lizenzen: list });
                            }}
                            placeholder={t("nbblTnaExample")}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                        {t("rosterPlayerIdHint")}
                      </div>
                    </div>
                  </div>

                  <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("positionsMultiSelect")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(["PG", "SG", "SF", "PF", "C"] as Position[]).map((pos) => {
                        const current = selectedPlayer.positions ?? [];
                        const active = current.includes(pos);
                        return (
                          <Button
                            key={pos}
                            variant={active ? "solid" : "outline"}
                            onClick={() => {
                              const next = active ? current.filter((x) => x !== pos) : [...current, pos];
                              updatePlayer(selectedPlayer.id, { positions: next });
                            }}
                            style={{ padding: "8px 10px" }}
                          >
                            {pos}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ============================================================
    ANCHOR:ROSTER_DEFAULT_TEAMS
    Zweck:
    - defaultTeams sind Metadaten (Zugehörigkeit), NICHT die Session-Zuteilung.
    - nutzt du für: Gruppierung Herren, Filter, spätere Exports/Reports.
   ============================================================ */}
                  <div
                    style={{
                      border: `1px solid var(--ui-border)`,
                      borderRadius: 14,
                      background: "var(--ui-card)",
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("defaultTeams")}</div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {allTeamOptions.map((t) => {
                        const current = selectedPlayer.defaultTeams ?? [];
                        const active = current.includes(t);

                        return (
                          <Button
                            key={t}
                            variant={active ? "solid" : "outline"}
                            onClick={() => {
                              const next = active ? current.filter((x) => x !== t) : [...current, t];
                              updatePlayer(selectedPlayer.id, { defaultTeams: next });
                            }}
                            style={{ padding: "8px 10px" }}
                          >
                            {t}
                          </Button>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Input
                        value={teamCodeDraft}
                        onChange={setTeamCodeDraft}
                        placeholder={lang === "de" ? "Team hinzufügen (z. B. U20)" : "Add team (e.g. U20)"}
                        style={{ maxWidth: 260 }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => addTeamCodeFromDraft("player")}
                        disabled={!teamCodeDraft.trim() || !selectedPlayerId}
                        style={{ padding: "8px 10px" }}
                      >
                        + Team
                      </Button>
                    </div>

                    <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                      {t("defaultTeamsHint")}
                    </div>
                  </div>

                  {/* ============================================================
    ANCHOR:ROSTER_JERSEY_BY_TEAM
    Zweck:
    - Trikotnummer pro Team (z.B. NBBL vs 1RLH unterschiedlich möglich)
    - wird im PrintView Spiel-Export genutzt (Sortierung & Tabelle)
   ============================================================ */}
                  <div
                    style={{
                      border: `1px solid var(--ui-border)`,
                      borderRadius: 14,
                      background: "var(--ui-card)",
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("jerseyNumbersByTeam")}</div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 1fr",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {allTeamOptions.map((teamCode) => {
                        const current = selectedPlayer.jerseyByTeam ?? {};
                        const value = current[teamCode];

                        return (
                          <div key={teamCode} style={{ display: "contents" }}>
                            <div style={{ fontWeight: 900 }}>{teamCode}</div>
                            <Input
                              type="number"
                              value={value === null || value === undefined ? "" : String(value)}
                              onChange={(v) => {
                                const next = { ...(selectedPlayer.jerseyByTeam ?? {}) } as Record<string, number | null>;
                                const trimmed = (v ?? "").trim();
                                next[teamCode] = trimmed ? parseInt(trimmed, 10) : null;
                                updatePlayer(selectedPlayer.id, { jerseyByTeam: next });
                              }}
                              placeholder={t("jerseyExample")}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                      {t("jerseyHint")}
                    </div>
                  </div>

                  {/* ============================================================
    ANCHOR:ROSTER_HISTORY_LAST6
    Zweck:
    - optionale Notizen (letzte 6 Spiele)
    - aktuell nur Editor-Feature (später Tooltip/Export möglich)
   ============================================================ */}
                  <div
                    style={{
                      border: `1px solid var(--ui-border)`,
                      borderRadius: 14,
                      background: "var(--ui-card)",
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{t("historyLast6")}</div>

                      <Button
                        variant="outline"
                        onClick={() => {
                          const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                          if (cur.length >= 6) return;
                          cur.push({ date: "", opponent: "", note: "" });
                          updatePlayer(selectedPlayer.id, { historyLast6: cur });
                        }}
                        style={{ padding: "8px 10px" }}
                      >
                        + {t("entry")}
                      </Button>
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {(selectedPlayer.historyLast6 ?? []).slice(0, 6).map((h, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "140px 1fr 120px",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <Input
                            type="date"
                            value={h.date ?? ""}
                            onChange={(v) => {
                              const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                              cur[idx] = { ...cur[idx], date: v };
                              updatePlayer(selectedPlayer.id, { historyLast6: cur });
                            }}
                          />

                          <Input
                            value={h.opponent ?? ""}
                            onChange={(v) => {
                              const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                              cur[idx] = { ...cur[idx], opponent: v };
                              updatePlayer(selectedPlayer.id, { historyLast6: cur });
                            }}
                            placeholder={t("opponentExample")}
                          />

                          <Button
                            variant="outline"
                            onClick={() => {
                              const cur = (selectedPlayer.historyLast6 ?? []).slice(0, 6);
                              cur.splice(idx, 1);
                              updatePlayer(selectedPlayer.id, { historyLast6: cur });
                            }}
                            style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                          >
                            {t("delete").toLowerCase()}
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                      {t("historyLast6Hint")}
                    </div>
                  </div>

/* --- Ende Roster-Editor (im Modal) --- */
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
