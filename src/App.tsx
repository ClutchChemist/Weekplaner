import {
  useCallback,
  useDeferredValue,
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
import "./App.css";

import type { Lang } from "./i18n/types";
import type {
  CalendarEvent as Session,
  GroupId,
  Player,
  ThemeSettings,
  WeekPlan,
} from "@/types";
import { makeT, makeTF } from "./i18n/translate";
import {
  LeftSidebar,
  MainWorkspace,
  PrintView,
} from "@/components/layout";
import { DraggablePlayerRow } from "@/components/roster";
import {
  ConfirmModal,
  EventPlannerModal,
  NewWeekModal,
  RosterEditorModal,
  ProfilesModal,
  PromptModal,
  ThemeSettingsModal,
  WeekArchiveModal,
  ResetDataModal,
  type ResetCategory,
} from "@/components/modals";
import {
  useConfirmDialog,
  useCloudBootstrap,
  useCloudBootstrapUpload,
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
  computePlayerActiveDays,
  computeHistoryFlagsBySession,
  computeTrainingCounts,
  isBirthdayOnAnyPlanDate,
  planDateSet,
} from "./state/planDerived";
import { normalizeMasterWeek, normalizeRoster } from "./state/normalizers";
import {
  birthYearOf,
  canonicalGroupId,
  getPlayerGroup,
  groupLabel,
  makeParticipantSorter,
  fallbackYearGroupsByFormula,
} from "./state/playerGrouping";
import { YEAR_GROUPS } from "./config";
import { upsertPlayerLicenseTna } from "./state/playerMeta";
import { LAST_PLAN_STORAGE_KEY, STAFF_STORAGE_KEY, THEME_STORAGE_KEY } from "./state/storageKeys";
import {
  type ProfileSyncMode,
  type CloudSnapshotV1,
  type ProfilePayload,
} from "./state/profileTypes";
import { migrateLegacyBlueTheme, safeParseTheme } from "./state/themePersistence";
import { DEFAULT_THEME } from "./state/themeDefaults";
import { DEFAULT_STAFF } from "./state/staffPersistence";
import { applyThemeToCssVars } from "./themes/cssVars";
import {
  isoWeekMonday,
  kwLabelFromPlan,
  splitTimeRange,
  weekdayShortLocalized,
} from "./utils/date";
import {
  computeConflictsBySession,
  isGameInfo,
  isGameSession,
  sessionsOverlap,
  stripAutoMeetingSuffix,
}
  from "./utils/session";
import { buildPreviewPages, buildPrintPages } from "./utils/printExport";
import { deleteCloudSnapshot } from "./utils/cloudSync";
import { getLicenseTnaByType, getRequiredTaTypeForTeams, normalizeTeamCode } from "./utils/team";
import { selectScheduleSessions } from "@/features/week-planning/selectors/sessionSelectors";
import { matchesPlayerSearch } from "./utils/player";
import rosterRaw from "./data/roster.json";
import weekMasterRaw from "./data/weekplan_master.json";

const CLUB_LOGO_STORAGE_KEY = "ubc_club_logo_v1";
const CLUB_LOGO_MAX_BYTES = 600 * 1024;

/** Default session duration in minutes for non-game events */
const DEFAULT_SESSION_DURATION_MIN = 90;
/** Default warmup time in minutes */
const DEFAULT_WARMUP_MIN = 30;
/** Delay before focusing a form element after scroll (ms) */
const FOCUS_SCROLL_DELAY_MS = 500;
const BUILD_VERSION_LABEL = `v${__APP_VERSION__} (${__GIT_COMMIT__})`;

/* ============================================================
   APP
   ============================================================ */

export default function App() {

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
    applyThemeToCssVars(theme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const activeYearGroups = YEAR_GROUPS.length > 0 ? YEAR_GROUPS : fallbackYearGroupsByFormula();

  const groupBg = useMemo(() => {
    const next: Record<GroupId, string> = {};
    for (const [gid, cfg] of Object.entries(theme.groups ?? {})) {
      if (cfg?.bg) next[gid] = cfg.bg;
    }
    const yearFallbackKey = activeYearGroups[0] ?? "TBD";
    const fallback = next[yearFallbackKey] ?? DEFAULT_THEME.groups[yearFallbackKey]?.bg ?? "#6b7280";
    for (const year of activeYearGroups) {
      next[year] = next[year] ?? DEFAULT_THEME.groups[year]?.bg ?? fallback;
    }
    next.Herren = next.Herren ?? DEFAULT_THEME.groups.Herren.bg;
    next.TBD = next.TBD ?? DEFAULT_THEME.groups.TBD.bg;
    return next;
  }, [activeYearGroups, theme.groups]);

  const groupText = useMemo(() => {
    const next: Record<GroupId, string | undefined> = {};
    for (const [gid, cfg] of Object.entries(theme.groups ?? {})) {
      if (cfg?.fg) next[gid] = cfg.fg;
    }
    for (const year of activeYearGroups) {
      if (!(year in next)) next[year] = theme.groups[year]?.fg;
    }
    if (!("Herren" in next)) next.Herren = theme.groups.Herren?.fg;
    if (!("TBD" in next)) next.TBD = theme.groups.TBD?.fg;
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
    setLeftTab,
    setLeftEditMode,
    setOpenLocationName,
    setRosterOpen,
    setResetDataOpen,
    setAutoTravelLoading,
    setConfirmDialog,
    setRosterSearch,
    setSelectedPlayerId,
  } = useAppUiState();

  const {
    settingsOpen,
    eventEditorOpen,
    rightSidebarOpen: rightOpen,
    newWeekOpen,
    rightLayout,
    rightTop,
    rightBottom,
    rightSplitPct,
    openGroup,
    leftTab,
    leftEditMode,
    openLocationName,
    rosterOpen,
    resetDataOpen,
    autoTravelLoading,
    confirmDialog,
    rosterSearch,
    selectedPlayerId,
  } = appUiState;
  const [autoTravelError, setAutoTravelError] = useState<string | null>(null);
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

  const makeTbdPlaceholder = useCallback((source?: Player): Player => ({
    ...(source ?? {}),
    id: "TBD",
    name: "TBD",
    firstName: "TBD",
    lastName: "",
    group: "TBD",
    positions: source?.positions ?? [],
    primaryYouthTeam: "",
    primarySeniorTeam: "",
    defaultTeams: [],
    lizenzen: [],
    isLocalPlayer: false,
    taNumber: undefined,
  }), []);

  function handleResetData(categories: ResetCategory[]) {
    if (categories.includes("players")) {
      setPlayers((prev) => {
        const tbd = prev.find((player) => player.id === "TBD");
        return [makeTbdPlaceholder(tbd)];
      });
      setSelectedPlayerId(null);
    }
    if (categories.includes("coaches")) {
      setCoaches(DEFAULT_STAFF);
    }
    if (categories.includes("locations")) {
      setTheme((prev) => ({ ...prev, locations: DEFAULT_THEME.locations }));
    }
    if (categories.includes("plan")) {
      setPlan((prev) => ({ ...prev, sessions: [] }));
    }
  }

  const applyProfileData = useCallback((payload: ProfilePayload) => {
    setRosterMeta(payload.rosterMeta);
    setPlayers((prev) => {
      const tbd = payload.players.find((player) => player.id === "TBD") ?? prev.find((player) => player.id === "TBD");
      const withoutTbd = payload.players
        .filter((player) => player.id !== "TBD")
        .map((player) =>
          canonicalGroupId(player.group) === "TBD" ? { ...player, group: undefined } : player
        );
      return [...withoutTbd, makeTbdPlaceholder(tbd)];
    });
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
  }, [setCoaches, setPlan, setTheme, makeTbdPlaceholder]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayers((prev) => {
      const tbd = prev.find((p) => p.id === "TBD");
      const withoutTbd = prev
        .filter((p) => p.id !== "TBD")
        .map((p) => (canonicalGroupId(p.group) === "TBD" ? { ...p, group: undefined } : p));
      return [...withoutTbd, makeTbdPlaceholder(tbd)];
    });
  }, [makeTbdPlaceholder]);

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
    setUiError: setLastDropError,
    noPagesMessage: t("previewNoPages"),
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
  const systemGroupIds = useMemo(() => new Set<GroupId>([...activeYearGroups, "Herren", "TBD"]), [activeYearGroups]);

  const customGroupIds = useMemo(() => {
    const ids = new Set<GroupId>();
    const addIfCustom = (raw: string) => {
      const groupId = canonicalGroupId(raw);
      if (!groupId) return;
      if (systemGroupIds.has(groupId)) return;
      ids.add(groupId);
    };

    for (const gid of Object.keys(theme.groups ?? {})) {
      addIfCustom(gid);
    }
    for (const p of players) {
      addIfCustom(String(p.group ?? ""));
      for (const teamCode of p.defaultTeams ?? []) {
        addIfCustom(normalizeTeamCode(String(teamCode ?? "")));
      }
    }
    for (const session of plan.sessions ?? []) {
      for (const teamCode of session.teams ?? []) {
        addIfCustom(normalizeTeamCode(String(teamCode ?? "")));
      }
    }

    return Array.from(ids).sort((a, b) => a.localeCompare(b, "de"));
  }, [plan.sessions, players, systemGroupIds, theme.groups]);

  const sidebarGroups = useMemo(() => {
    return [
      ...activeYearGroups.map((id) => ({ id: id as GroupId, label: id })),
      { id: "Herren" as GroupId, label: groupLabel("Herren") },
      ...customGroupIds.map((id) => ({ id, label: groupLabel(id) })),
      { id: "TBD" as GroupId, label: "TBD" },
    ];
  }, [activeYearGroups, customGroupIds]);

  const playersByGroup = useMemo(() => {
    const map = new Map<GroupId, Player[]>();
    for (const g of sidebarGroups) map.set(g.id, []);

    for (const p of players) {
      const groupId = getPlayerGroup(p);
      if (p.id !== "TBD" && groupId === "TBD") continue;
      if (!map.has(groupId)) map.set(groupId, []);
      map.get(groupId)?.push(p);
    }

    for (const [gid, arr] of map.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, "de"));
      map.set(gid, arr);
    }
    return map;
  }, [players, sidebarGroups]);

  const groupEntries = useMemo(
    () =>
      sidebarGroups.map((g) => ({
        id: g.id,
        label: g.label,
        isSystem: systemGroupIds.has(g.id),
        count: (playersByGroup.get(g.id) ?? []).length,
      })),
    [playersByGroup, sidebarGroups, systemGroupIds]
  );

  function setGroupColor(groupId: GroupId, patch: { bg?: string; fg?: string | undefined }) {
    setTheme((prev) => {
      const current = prev.groups[groupId] ?? DEFAULT_THEME.groups[groupId] ?? { bg: "#6b7280", fg: undefined };
      return {
        ...prev,
        groups: {
          ...prev.groups,
          [groupId]: {
            ...current,
            ...patch,
          },
        },
      };
    });
  }

  function addCustomGroup(rawName: string): boolean {
    const groupId = canonicalGroupId(normalizeTeamCode(rawName));
    if (!groupId) return false;
    if (systemGroupIds.has(groupId)) return false;
    setTheme((prev) => ({
      ...prev,
      groups: {
        ...prev.groups,
        [groupId]: prev.groups[groupId] ?? { bg: "#6b7280", fg: undefined },
      },
    }));
    return true;
  }

  function deleteCustomGroup(groupId: GroupId) {
    if (systemGroupIds.has(groupId)) return;

    setTheme((prev) => {
      const nextGroups = { ...prev.groups };
      delete nextGroups[groupId];
      return { ...prev, groups: nextGroups };
    });

    setPlayers((prev) =>
      prev.map((p) => {
        const cleanedTeams = (p.defaultTeams ?? []).filter(
          (teamCode) => canonicalGroupId(normalizeTeamCode(String(teamCode ?? ""))) !== groupId
        );
        const cleanedGroup = canonicalGroupId(p.group) === groupId ? undefined : p.group;
        return { ...p, group: cleanedGroup, defaultTeams: cleanedTeams };
      })
    );

    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => ({
        ...s,
        teams: (s.teams ?? []).filter(
          (teamCode) => canonicalGroupId(normalizeTeamCode(String(teamCode ?? ""))) !== groupId
        ),
      })),
    }));
    setOpenGroup((prev) => (prev === groupId ? null : prev));
  }

  function autoAssignPlayerGroups(opts: { years: boolean; senior: boolean }) {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === "TBD") return p;
        const year = birthYearOf(p);
        const teams = (p.defaultTeams ?? []).map((x) => normalizeTeamCode(String(x ?? "")));
        if (opts.years && typeof year === "number" && activeYearGroups.includes(String(year))) {
          return { ...p, group: String(year), yearGroupDeselected: false };
        }
        if (opts.senior && (teams.includes("1RLH") || teams.includes("HOL"))) {
          return { ...p, group: "Herren" };
        }
        return p;
      })
    );
  }
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
      }, FOCUS_SCROLL_DELAY_MS);
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
      setFormDuration(dur || DEFAULT_SESSION_DURATION_MIN);
    } else {
      setFormDuration(90);
    }

    setFormOpponent(stripAutoMeetingSuffix(s.info ?? ""));
    setFormParticipants([...(s.participants ?? [])]);

    const game = isGameInfo(s.info ?? "");
    setFormWarmupMin(game ? Number(s.warmupMin ?? DEFAULT_WARMUP_MIN) : DEFAULT_WARMUP_MIN);
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
      }, FOCUS_SCROLL_DELAY_MS);
    });
  }



  const allTeamOptions = useMemo(() => {
    const fromPlayers = players.flatMap((p) => p.defaultTeams ?? []);
    const fromPlan = plan.sessions.flatMap((s) => s.teams ?? []);
    const options = [...customGroupIds, ...fromPlayers, ...fromPlan, ...(formTeams ?? [])]
      .map((team) => normalizeTeamCode(team))
      .filter(Boolean);
    return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "de"));
  }, [customGroupIds, formTeams, plan.sessions, players]);

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

  const effectiveQuickRosterFilters = useMemo(() => {
    const available = new Set(quickRosterTabs.map((tab) => tab.id));
    const next = quickRosterFilters.filter((id) => available.has(id));
    if (next.length > 0) return next;
    return [quickRosterTabs[0]?.id ?? activeYearGroups[0] ?? "TBD"];
  }, [activeYearGroups, quickRosterFilters, quickRosterTabs]);

  // Deferred search prevents filtering on every keystroke (performance)
  const deferredRosterSearch = useDeferredValue(quickRosterSearch);

  const quickRosterPlayers = useMemo(() => {
    const searchQuery = deferredRosterSearch;
    const inTab = (p: Player) => {
      if (effectiveQuickRosterFilters.length === 0) return true;
      return effectiveQuickRosterFilters.every((filter) => {
        if (activeYearGroups.includes(String(filter))) return getPlayerGroup(p) === filter;
        if (filter === "TBD") return p.id === "TBD";
        const defaults = (p.defaultTeams ?? []).map((code) => normalizeTeamCode(String(code ?? "")));
        return defaults.includes(normalizeTeamCode(String(filter ?? "")));
      });
    };
    return players
      .filter(inTab)
      .filter((p) => matchesPlayerSearch(p, searchQuery))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [activeYearGroups, players, effectiveQuickRosterFilters, deferredRosterSearch]);

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
  const [cloudBootstrapPendingProfileId, setCloudBootstrapPendingProfileId] = useState<string | null>(null);
  const [cloudProfileStatusMsg, setCloudProfileStatusMsg] = useState("");

  useCloudBootstrap({
    cloudConfigured,
    cloudUserEmail,
    isCloudSnapshotV1,
    profiles,
    activeProfileId,
    currentProfilePayload,
    buildNewProfilePayload,
    setProfiles,
    setActiveProfileId,
    setCloudBootstrapPendingProfileId,
    setCloudProfileStatusMsg,
    t,
  });

  useCloudBootstrapUpload({
    cloudBootstrapPendingProfileId,
    activeProfileId,
    cloudSyncEnabledForActiveProfile,
    cloudUserEmail,
    saveSnapshotToCloud,
    setCloudBootstrapPendingProfileId,
  });

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
    });
  }, [activeProfileId, activeProfileSync.mode, cloudUserEmail, deleteActiveProfile, t]);

  /* ============================================================
     Roster editor: import/export roster.json
     (minimal editor – erweitert später um LP/Trikot/Positions etc.)
     ============================================================ */

  const {
    updatePlayer,
    addNewPlayer,
    deletePlayer,
    importRosterFile,
    importMmbFile,
    mmbImportFeedback,
    clearMmbImportFeedback,
    exportRoster,
  } = usePlayerActions({
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
  const activeDaysByPlayer = useMemo(() => computePlayerActiveDays(plan, weekDates), [plan, weekDates]);
  const plannedDaysByPlayer = useMemo(() => {
    const weekDateOrder = new Map<string, number>();
    weekDates.forEach((date, index) => weekDateOrder.set(date, index));

    const result = new Map<string, string[]>();
    for (const [playerId, activeDays] of activeDaysByPlayer.entries()) {
      const labels = Array.from(activeDays)
        .sort((a, b) => {
          const ai = weekDateOrder.get(a);
          const bi = weekDateOrder.get(b);
          if (ai != null || bi != null) return (ai ?? Number.MAX_SAFE_INTEGER) - (bi ?? Number.MAX_SAFE_INTEGER);
          return a.localeCompare(b);
        })
        .map((date) => `${weekdayShortLocalized(date, lang)} ${date.slice(8, 10)}.${date.slice(5, 7)}`);
      result.set(playerId, labels);
    }
    return result;
  }, [activeDaysByPlayer, weekDates, lang]);

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
              onOpenResetData={() => setResetDataOpen(true)}
              openGroup={openGroup}
              onToggleGroup={(gid) => setOpenGroup((prev) => (prev === gid ? null : gid))}
              sidebarGroups={sidebarGroups}
              playersByGroup={playersByGroup}
              groupEntries={groupEntries}
              onAddGroup={addCustomGroup}
              onDeleteGroup={deleteCustomGroup}
              onAutoAssignGroups={autoAssignPlayerGroups}
              onSetGroupBg={(gid, color) => setGroupColor(gid, { bg: color })}
              onSetGroupFg={(gid, color) => setGroupColor(gid, { fg: color })}
              renderDraggablePlayer={(p) => (
                <DraggablePlayerRow
                  key={p.id}
                  player={p}
                  trainingCount={trainingCounts.get(p.id) ?? 0}
                  activeDays={activeDaysByPlayer.get(p.id) ?? new Set<string>()}
                  weekDates={weekDates}
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
            <MainWorkspace
              t={t}
              topBarProps={{
                locale: lang,
                t,
                clubLogoDataUrl,
                activeProfileName,
                profiles,
                activeProfileId,
                profileMenuOpen,
                profileMenuRef,
                onToggleLang: () =>
                  setTheme((p) => ({ ...p, locale: (p.locale === "de" ? "en" : "de") as Lang }))
                ,
                onOpenProfiles: () => setProfilesOpen(true),
                onToggleProfileMenu: () => setProfileMenuOpen((v) => !v),
                onSelectProfileFromMenu: (id) => {
                  selectProfile(id);
                  setProfileMenuOpen(false);
                },
                activeProfileSelected: Boolean(activeProfileId),
                onOpenWeekArchive: () => setWeekArchiveOpen(true),
                eventEditorOpen,
                onToggleEventEditor: () => setEventEditorOpen((v) => !v),
                onOpenNewWeek: () => setNewWeekOpen(true),
                rightOpen,
                onToggleRightSidebar: () => setRightOpen((v) => !v),
                onOpenSettings: () => setSettingsOpen(true),
              }}
              editorTopRef={editorTopRef}
              eventPlannerNode={(
                <EventPlannerModal
                  open={eventEditorOpen}
                  onClose={() => setEventEditorOpen(false)}
                  t={t}
                  lang={lang}
                  editorRef={editorRef}
                  opponentInputRef={opponentInputRef}
                  editingSessionId={editingSessionId}
                  onDeleteSession={onDeleteSession}
                  weekLabel={weekLabel}
                  weekDates={weekDates}
                  formDate={formDate}
                  setFormDate={setFormDate}
                  allTeamOptions={allTeamOptions}
                  formTeams={formTeams}
                  onToggleTeam={onToggleTeam}
                  teamCodeDraft={teamCodeDraft}
                  setTeamCodeDraft={setTeamCodeDraft}
                  onAddTeamCodeFromDraftEvent={() => addTeamCodeFromDraft("event")}
                  theme={theme}
                  setTheme={setTheme}
                  locationUsageMap={locationUsageMap}
                  locationMode={locationMode}
                  setLocationMode={setLocationMode}
                  setCustomLocation={setCustomLocation}
                  onEditLocationsFromEvent={() => {
                    setLeftTab("locations");
                    setLeftEditMode(true);
                    setOpenLocationName(locationMode || null);
                  }}
                  formStart={formStart}
                  setFormStart={setFormStart}
                  formDuration={formDuration}
                  setFormDuration={setFormDuration}
                  formOpponent={formOpponent}
                  setFormOpponent={setFormOpponent}
                  handleRecallLocationEdit={handleRecallLocationEdit}
                  formWarmupMin={formWarmupMin}
                  setFormWarmupMin={setFormWarmupMin}
                  formTravelMin={formTravelMin}
                  setFormTravelMin={setFormTravelMin}
                  autoTravelLoading={autoTravelLoading}
                  setAutoTravelLoading={setAutoTravelLoading}
                  autoTravelError={autoTravelError}
                  setAutoTravelError={setAutoTravelError}
                  currentLocationValue={currentLocationValue}
                  formExcludeFromRoster={formExcludeFromRoster}
                  setFormExcludeFromRoster={setFormExcludeFromRoster}
                  formRowColor={formRowColor}
                  setFormRowColor={setFormRowColor}
                  upsertSession={upsertSession}
                  onOpenQuickRoster={() => setQuickRosterOpen(true)}
                  onResetEventForm={() => {
                    resetForm();
                    setFormParticipants([]);
                    setQuickRosterOpen(false);
                    setQuickRosterSearch("");
                  }}
                  quickRosterOpen={quickRosterOpen}
                  onCloseQuickRoster={() => setQuickRosterOpen(false)}
                  quickRosterTabs={quickRosterTabs}
                  quickRosterFilters={effectiveQuickRosterFilters}
                  onToggleQuickRosterFilter={(id) =>
                    setQuickRosterFilters((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  onResetQuickRosterFilters={() => setQuickRosterFilters([])}
                  quickRosterSearch={quickRosterSearch}
                  setQuickRosterSearch={setQuickRosterSearch}
                  selectedParticipantsCount={formParticipants.length}
                  quickRosterPlayers={quickRosterPlayers}
                  countInFormParticipants={countInFormParticipants}
                  birthdayPlayerIds={birthdayPlayerIds}
                  plannedDaysByPlayer={plannedDaysByPlayer}
                  removeFromFormParticipants={removeFromFormParticipants}
                  addToFormParticipants={addToFormParticipants}
                />
              )}
              weekPlanBoardProps={{
                sessions: scheduleSessions,
                lang,
                t,
                lastDropError,
                conflictsBySession,
                historyFlagsBySession,
                editingSessionId,
                selectedSessionId,
                onSelectSession: setSelectedSessionId,
                collapsedParticipantsBySession,
                onToggleParticipantsCollapse: (sid) => setCollapsedParticipantsBySession((p) => ({ ...p, [sid]: !p[sid] })),
                onEditSession: handleOpenEventEditor,
                onDeleteSession,
                playerById,
                removePlayerFromSession,
                groupBg,
                groupText,
                birthdayPlayerIds,
                weekDates,
                trainingCounts,
                activeDaysByPlayer,
              }}
              onCreatePlanPdf={createPlanPdf}
              onCreatePlanPngPages={createPlanPngPages}
              rightOpen={rightOpen}
              rightLayout={rightLayout}
              rightTop={rightTop}
              rightBottom={rightBottom}
              rightSplitPct={rightSplitPct}
              onChangeRightLayout={setRightLayout}
              onChangeRightTop={setRightTop}
              onChangeRightBottom={setRightBottom}
              onChangeRightSplitPct={setRightSplitPct}
              previewPages={previewPages}
              calendarOverviewProps={{
                weekDates,
                weekPlan: plan,
                roster: players,
                onOpenEventEditor: handleOpenEventEditor,
                onUpdateWeekPlan: setPlan,
                dnd,
                onDelete: (id) => onDeleteSession(id),
                onToggleTravel: toggleSessionTravel,
                onToggleWarmup: toggleSessionWarmup,
                editingSessionId,
                t,
              }}
            />
          </div>
        </DndContext>
      </div>
      <div
        style={{
          position: "fixed",
          left: 8,
          bottom: 6,
          zIndex: 60,
          color: "var(--ui-muted)",
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.75,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {BUILD_VERSION_LABEL}
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

      <WeekArchiveModal
        open={weekArchiveOpen}
        onClose={() => setWeekArchiveOpen(false)}
        t={t}
        lang={lang}
        activeProfileName={activeProfileName}
        activeProfileId={activeProfileId}
        sessionCount={(plan.sessions ?? []).length}
        archiveTemplateStart={archiveTemplateStart}
        onArchiveTemplateStartChange={setArchiveTemplateStart}
        activeArchiveEntries={activeArchiveEntries}
        onSaveCurrentWeekToArchive={handleSaveCurrentWeekToArchive}
        onLoadArchiveEntry={handleLoadArchiveEntry}
        onUseArchiveAsTemplate={handleUseArchiveAsTemplate}
        onDeleteArchiveEntry={handleDeleteArchiveEntry}
      />

      <ResetDataModal
        open={resetDataOpen}
        onClose={() => setResetDataOpen(false)}
        onReset={handleResetData}
        t={t}
      />

      <RosterEditorModal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        t={t}
        lang={lang}
        players={players}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayerId={setSelectedPlayerId}
        rosterSearch={rosterSearch}
        onRosterSearchChange={setRosterSearch}
        addNewPlayer={addNewPlayer}
        exportRoster={exportRoster}
        importRosterFile={importRosterFile}
        importMmbFile={importMmbFile}
        mmbImportFeedback={mmbImportFeedback}
        clearMmbImportFeedback={clearMmbImportFeedback}
        deletePlayer={deletePlayer}
        updatePlayer={updatePlayer}
        activeYearGroups={activeYearGroups}
        allTeamOptions={allTeamOptions}
        teamCodeDraft={teamCodeDraft}
        onTeamCodeDraftChange={setTeamCodeDraft}
        onAddTeamCodeFromDraft={() => addTeamCodeFromDraft("player")}
        clubName={theme.clubName}
        groupBg={groupBg}
        groupText={groupText}
      />
    </>
  );
}

