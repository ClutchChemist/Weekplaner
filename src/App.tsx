import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import type { Lang } from "./i18n/types";
import type {
  CalendarEvent as Session,
  Coach,
  GroupId,
  Player,
  ThemeSettings,
  WeekPlan,
} from "@/types";
import { makeT, makeTF } from "./i18n/translate";
import { Button } from "@/components/ui";
import { AppTopBar, CalendarOverviewPanel, LeftSidebar, PrintView, RightSidebar, WeekPlanBoard } from "@/components/layout";
import { ConfirmModal, EventEditorModal, EventPlannerForm, NewWeekModal, ProfilesModal, PromptModal, RosterEditorModal, ThemeSettingsModal } from "@/components/modals";
import { DraggablePlayerRow } from "@/components/roster";
import type { NewWeekMode } from "./components/modals/NewWeekModal";
import {
  useConfirmDialog,
  useDndPlan,
  useCloudSync,
  LOCATION_PRESETS,
  TEAM_OPTIONS,
  useEventPlannerState,
  useLocationUsageMap,
  useProfilesState,
  usePersistedState,
  useRightSidebarPersistence,
  useSessionEditor,
  usePromptDialog,
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
import { birthYearOf, getPlayerGroup, GROUPS, isCorePlayer, isHolOnly, isU18Only, makeParticipantSorter } from "./state/playerGrouping";
import {
  enrichPlayersWithBirthFromDBBTA,
} from "./state/playerMeta";
import { LAST_PLAN_STORAGE_KEY, STAFF_STORAGE_KEY, THEME_STORAGE_KEY } from "./state/storageKeys";
import { DEFAULT_STAFF, safeParseStaff } from "./state/staffPersistence";
import {
  type ProfileSyncMode,
  type CloudSnapshotV1,
} from "./state/profileTypes";
import { migrateLegacyBlueTheme, safeParseTheme } from "./state/themePersistence";
import { DEFAULT_THEME } from "./state/themeDefaults";
import { applyThemeToCssVars } from "./themes/cssVars";
import {
  addDaysISO,
  isoWeekMonday,
  kwLabelFromPlan,
  normalizeDash,
  splitTimeRange,
  weekdayOffsetFromDEShort,
  weekdayShortDE,
} from "./utils/date";
import {
  computeConflictsBySession,
  isGameInfo,
  isGameSession,
  sessionsOverlap,
} from "./utils/session";
import {
  ensureLocationSaved,
} from "./utils/locations";
import { buildPreviewPages, buildPrintPages } from "./utils/printExport";
import { downloadJson } from "./utils/json";
import { randomId } from "./utils/id";
import rosterRaw from "./data/roster.json";
import weekMasterRaw from "./data/weekplan_master.json";

const CLUB_LOGO_STORAGE_KEY = "ubc_club_logo_v1";
const CLUB_LOGO_MAX_BYTES = 600 * 1024;


export default function App() {

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

  const groupBg = useMemo(() => {
    return {
      "2007": theme.groups["2007"].bg,
      "2008": theme.groups["2008"].bg,
      "2009": theme.groups["2009"].bg,
      Herren: theme.groups["Herren"].bg,
      TBD: theme.groups["TBD"].bg,
    } as Record<GroupId, string>;
  }, [theme]);

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
  const confirmDialog = appUiState.confirmDialog;
  const rosterSearch = appUiState.rosterSearch;
  const selectedPlayerId = appUiState.selectedPlayerId;
  const { askConfirm, resolveConfirm } = useConfirmDialog(setConfirmDialog);
  const { promptDialog, setPromptValue, askPrompt, resolvePrompt } = usePromptDialog();

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
  const [coaches, setCoaches] = usePersistedState<Coach[]>(
    STAFF_STORAGE_KEY,
    DEFAULT_STAFF,
    (savedRaw) => safeParseStaff(savedRaw) ?? DEFAULT_STAFF
  );

  /* ============================================================
     HANDLERS (onDrag..., upsert..., export...)
     ============================================================ */

  async function importStaffFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const list = Array.isArray(json) ? json : json?.coaches;
      if (!Array.isArray(list)) return;
      const normalized: Coach[] = list
        .map((rawCoach) => {
          const c = (rawCoach && typeof rawCoach === "object") ? (rawCoach as Record<string, unknown>) : {};
          return {
            id: String(c.id ?? randomId("c_")),
            name: String(c.name ?? ""),
            role: String(c.role ?? "Coach"),
            license: c.license !== undefined ? String(c.license ?? "") : "",
          };
        })
        .filter((c: Coach) => c.id && c.name);
      if (normalized.length) {
        setCoaches(normalized);
        setLastDropError(null);
      } else {
        setLastDropError(t("importJsonError"));
      }
    } catch (err) {
      console.warn("Staff import failed", err);
      setLastDropError(t("importJsonError"));
    }
  }

  function exportStaff() {
    downloadJson("staff.json", coaches);
  }

  function addCoach() {
    const id = randomId("c_");
    setCoaches((prev) => [...prev, { id, name: "Name", role: "Coach", license: "" }]);
  }

  function updateCoach(id: string, patch: Partial<Coach>) {
    setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteCoach(id: string) {
    setCoaches((prev) => prev.filter((c) => c.id !== id));
  }

  /* ----------------------
     Load roster.json
     ---------------------- */
  const normalizedRoster = useMemo(() => normalizeRoster(rosterRaw as unknown), []);
  const [rosterMeta, setRosterMeta] = useState<{ season: string; ageGroups: unknown }>({
    season: normalizedRoster.season,
    ageGroups: normalizedRoster.ageGroups,
  });

  const [players, setPlayers] = useState<Player[]>(() => normalizedRoster.players);

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
    locations: (theme.locations ?? DEFAULT_THEME.locations!) as NonNullable<ThemeSettings["locations"]>,
    clubLogoStorageKey: CLUB_LOGO_STORAGE_KEY,
    clubLogoMaxBytes: CLUB_LOGO_MAX_BYTES,
    onApplyProfileData: (payload) => {
      setRosterMeta(payload.rosterMeta);
      setPlayers(payload.players);
      setCoaches(payload.coaches);
      setTheme((prev) => ({
        ...prev,
        locations: payload.locations,
      }));
    },
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
  const masterPlan = useMemo(() => normalizeMasterWeek(weekMasterRaw as unknown), []);

  const [plan, setPlan] = usePersistedState<WeekPlan>(
    LAST_PLAN_STORAGE_KEY,
    masterPlan,
    reviveWeekPlan
  );

  /* ----------------------
     Export HTML (Source of Truth)
     ---------------------- */
  const exportPages = useMemo(() => {
    return buildPrintPages({
      sessions: plan?.sessions ?? [],
      players,
      coaches,
      clubName: theme.clubName,
      locale: theme.locale,
      locations: theme.locations ?? DEFAULT_THEME.locations!,
      logoUrl: clubLogoDataUrl ?? undefined,
    });
  }, [plan, players, coaches, theme, clubLogoDataUrl]);

  const previewPages = useMemo(() => {
    return buildPreviewPages({
      sessions: plan?.sessions ?? [],
      players,
      coaches,
      clubName: theme.clubName,
      locale: theme.locale,
      locations: theme.locations ?? DEFAULT_THEME.locations!,
      logoUrl: clubLogoDataUrl ?? undefined,
    });
  }, [plan, players, coaches, theme, clubLogoDataUrl]);

  /* ----------------------
     Derived
     ---------------------- */
  const conflictsBySession = useMemo(() => computeConflictsBySession(plan), [plan]);

  const [lastDropError, setLastDropError] = useState<string | null>(null);
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
  const locationUsageMap = useLocationUsageMap(plan.sessions ?? []);

  // Plan date set & birthdays for players present in the plan
  const planDates = useMemo(() => planDateSet(plan), [plan]);

  const birthdayPlayerIds = useMemo(() => {
    const res = new Set<string>();
    for (const s of plan.sessions ?? []) {
      for (const pid of s.participants ?? []) {
        const p = playerById.get(pid);
        if (!p) continue;
        if (isBirthdayOnAnyPlanDate(p, planDates)) res.add(pid);
      }
    }
    return res;
  }, [plan, playerById, planDates]);

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
  return players.filter(isU18Only).slice().sort((a,b)=>a.name.localeCompare(b.name,"de"));
}, [players]);

const holOnlyPlayers = useMemo(() => {
  return players.filter(isHolOnly).slice().sort((a,b)=>a.name.localeCompare(b.name,"de"));
}, [players]);
  /* ----------------------
    LEFT TABS: Players / Coaches / Locations
    ---------------------- */

  /* ============================================================
     DnD: add/remove participants
     ============================================================ */
  function removePlayerFromSession(sessionId: string, playerId: string) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const next = (s.participants ?? []).filter((id) => id !== playerId).sort(sortParticipants);
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
    customLocation,
    formStart,
    formDuration,
    formOpponent,
    formWarmupMin,
    formTravelMin,
  } = editorState;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const opponentInputRef = useRef<HTMLInputElement | null>(null);
  const editorTopRef = useRef<HTMLDivElement | null>(null);

  function handleRecallLocationEdit() {
    const current = currentLocationValue().trim();
    setLeftTab("locations");
    setLeftEditMode(true);

    if (!current || current === "—") {
      setOpenLocationName(null);
      return;
    }

    const known = Object.prototype.hasOwnProperty.call(theme.locations?.locations ?? {}, current);
    const isPreset = LOCATION_PRESETS.includes(current as (typeof LOCATION_PRESETS)[number]);

    if (!known && !isPreset) {
      ensureLocationSaved(theme, setTheme, current);
    }

    setOpenLocationName(current);
  }

  const { upsert: upsertSessionInPlan, remove: removeSessionFromPlan } = useSessionEditor(setPlan, sortParticipants);

  function upsertSession() {
    if (!formDate || formTeams.length === 0) return;

    if (editingSessionId) {
      const old = plan.sessions.find((s) => s.id === editingSessionId);
      if (old) upsertSessionInPlan(buildSessionFromForm(old.id, old.participants ?? []));
    } else {
      upsertSessionInPlan(buildSessionFromForm());
    }

    resetForm();
  }

  function onEditSession(s: Session) {
    setEventEditorOpen(true);
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
    // Check if location is a preset or saved location
    const savedLocations = Object.keys(theme.locations?.locations ?? {});
    const isKnownLocation = LOCATION_PRESETS.includes(loc as (typeof LOCATION_PRESETS)[number]) || savedLocations.includes(loc);
    
    if (isKnownLocation) {
      setLocationMode(loc);
      setCustomLocation("");
    } else {
      setLocationMode("__CUSTOM__");
      setCustomLocation(loc);
    }

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

    setFormOpponent(s.info ?? "");

    const game = isGameInfo(s.info ?? "");
    setFormWarmupMin(game ? Number(s.warmupMin ?? 30) : 30);
    setFormTravelMin(game ? Number(s.travelMin ?? 0) : 0);
  }

  async function onDeleteSession(sessionId: string) {
    const s = plan.sessions.find((x) => x.id === sessionId);
    const label = s ? `${s.day} ${s.date} | ${(s.teams ?? []).join("/")} | ${s.time}` : sessionId;
    if (!(await askConfirm(t("delete"), tf("confirmDeleteEvent", { label })))) return;

    removeSessionFromPlan(sessionId);
    if (editingSessionId === sessionId) resetForm();
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

  const buildCloudSnapshot = useCallback((): CloudSnapshotV1 => {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      profileId: activeProfileId,
      profileName: activeProfileName ?? "",
      data: {
        rosterMeta,
        players,
        coaches,
        theme,
        plan,
        clubLogoDataUrl,
      },
    };
  }, [rosterMeta, players, coaches, theme, plan, activeProfileId, activeProfileName, clubLogoDataUrl]);

  const applyCloudSnapshot = useCallback((snapshot: CloudSnapshotV1) => {
    const data = snapshot.data;

    setRosterMeta(data.rosterMeta);
    setPlayers(data.players);
    setCoaches(data.coaches);
    setTheme(data.theme);
    setPlan(data.plan);
    setClubLogoDataUrl(data.clubLogoDataUrl ?? null);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === snapshot.profileId
          ? {
              ...p,
              payload: {
                rosterMeta: data.rosterMeta,
                players: data.players,
                coaches: data.coaches,
                locations: data.theme.locations ?? p.payload.locations,
                clubLogoDataUrl: data.clubLogoDataUrl,
              },
            }
          : p
      )
    );
    setProfileHydratedId(snapshot.profileId);
    setActiveProfileId(snapshot.profileId);
  }, [setCoaches, setPlan, setClubLogoDataUrl, setProfiles, setProfileHydratedId, setActiveProfileId]);

  const isCloudSnapshotV1 = useCallback((raw: unknown): raw is CloudSnapshotV1 => {
    if (!raw || typeof raw !== "object") return false;
    const r = raw as Record<string, unknown>;
    return (
      r.version === 1 &&
      typeof r.profileId === "string" &&
      typeof r.profileName === "string" &&
      !!r.data &&
      typeof r.data === "object"
    );
  }, []);

  const cloudSyncSignal = useMemo(
    () => ({ rosterMeta, players, coaches, theme, plan, activeProfileId, clubLogoDataUrl, activeProfileSync }),
    [rosterMeta, players, coaches, theme, plan, activeProfileId, clubLogoDataUrl, activeProfileSync]
  );

  const cloudSyncEnabledForActiveProfile = Boolean(activeProfileId && activeProfileSync.mode === "cloud");

  const updateActiveProfileSync = useCallback(
    (patch: Partial<{ mode: ProfileSyncMode; autoSync: boolean }>) => {
      if (!activeProfileId) return;
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfileId
            ? {
                ...p,
                sync: {
                  ...p.sync,
                  ...patch,
                },
              }
            : p
        )
      );
    },
    [activeProfileId, setProfiles]
  );

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
    onAutoSyncChange: (next) => updateActiveProfileSync({ autoSync: next }),
    buildSnapshot: buildCloudSnapshot,
    applySnapshot: applyCloudSnapshot,
    isSnapshot: isCloudSnapshotV1,
    autoSyncSignal: cloudSyncSignal,
  });

  /* ============================================================
     Roster editor: import/export roster.json
     (minimal editor – erweitert später um LP/Trikot/Positions etc.)
     ============================================================ */

  function updatePlayer(id: string, patch: Partial<Player>) {
    if (id === "TBD") return;

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };

        if (patch.firstName !== undefined || patch.lastName !== undefined) {
          const fn = patch.firstName !== undefined ? patch.firstName : (p.firstName ?? "");
          const ln = patch.lastName !== undefined ? patch.lastName : (p.lastName ?? "");
          const computed = `${fn} ${ln}`.trim();
          next.name = computed || next.name;
        }

        return next;
      })
    );
  }

  function addNewPlayer() {
    const id = randomId("p_");
    const p: Player = {
      id,
      firstName: t("firstName"),
      lastName: t("name"),
      name: `${t("firstName")} ${t("name")}`,
      birthYear: 2009,
      birthDate: "",
      positions: [],
      primaryYouthTeam: "",
      primarySeniorTeam: "",
      defaultTeams: [],
      lizenzen: [],
      isLocalPlayer: false,
      group: "2009",
    };
    setPlayers((prev) => [...prev, p]);
    setSelectedPlayerId(id);
  }

  function deletePlayer(id: string) {
    if (id === "TBD") return;

    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => ({
        ...s,
        participants: (s.participants ?? []).filter((pid) => pid !== id),
      })),
    }));
    setSelectedPlayerId((prev) => (prev === id ? null : prev));
  }

  async function importRosterFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // accept either new schema {season,ageGroups,players} or old {players:[...]} or raw array
      let normalized = { season: "", ageGroups: null as unknown, players: [] as Player[] };

      if (Array.isArray(json)) {
        // Raw array -> enrich direkt
        const { players: enriched } = enrichPlayersWithBirthFromDBBTA(json as Player[]);
        normalized.players = enriched;
      } else if (json?.players) {
        normalized = normalizeRoster(json); // enrichment happens inside normalizeRoster
      } else {
        return;
      }

      // ensure we don't import TBD
      const cleaned = normalized.players.filter((p) => String(p.id) !== "TBD");
      setRosterMeta({ season: normalized.season || rosterMeta.season, ageGroups: normalized.ageGroups ?? rosterMeta.ageGroups });
      setPlayers(cleaned);
      setSelectedPlayerId(cleaned[0]?.id ?? null);
      setLastDropError(null);
    } catch (err) {
      console.warn("Roster import failed", err);
      setLastDropError(t("importJsonError"));
    }
  }

  function exportRoster() {
    const exportPlayers = players.filter((p) => p.id !== "TBD").map((p) => {
      // keep roster.json schema + preserve extra fields for future
      const y = birthYearOf(p);
      return {
        id: p.id,
        name: p.name,
        birthYear: y ?? null,
        isLocalPlayer: !!p.isLocalPlayer,
        lizenzen: (p.lizenzen ?? []).map((l) => ({
          typ: l.typ,
          tna: l.tna,
          verein: l.verein ?? "UBC Münster",
        })),
        defaultTeams: p.defaultTeams ?? [],
        // extensions (optional)
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        birthDate: p.birthDate ?? "",
        positions: p.positions ?? [],
        group: p.group ?? "",
        lpCategory: p.lpCategory ?? "",
        jerseyByTeam: p.jerseyByTeam ?? {},
        historyLast6: p.historyLast6 ?? [],
        yearColor: p.yearColor ?? null,
      };
    });

    downloadJson("roster.json", {
      season: rosterMeta.season,
      ageGroups: rosterMeta.ageGroups,
      players: exportPlayers,
    });
  }

  /* ============================================================
     Print / PDF
     ============================================================ */

  async function createPlanPdf() {
    if (!exportPages || exportPages.length === 0) {
      console.warn("No export pages available for PDF export.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
    if (!printWindow) {
      console.warn("Could not open print window for PDF export.");
      return;
    }

    const pagesHtml = exportPages
      .map(
        (p, i) => `
          <section class="print-page" data-page-index="${i + 1}">
            ${p.html}
          </section>
        `
      )
      .join("\n");

    const html = `
      <!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${theme.clubName} Weekplan PDF</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111;
              font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            }

            .print-root {
              width: 100%;
            }

            .print-page {
              break-after: page;
              page-break-after: always;
              box-sizing: border-box;
            }

            .print-page:last-child {
              break-after: auto;
              page-break-after: auto;
            }
          </style>
        </head>
        <body>
          <main class="print-root">${pagesHtml}</main>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      if (printWindow.document.readyState === "complete") {
        setTimeout(done, 250);
      } else {
        printWindow.addEventListener("load", () => setTimeout(done, 250), { once: true });
      }
    });

    printWindow.focus();
    printWindow.print();

    setTimeout(() => {
      try {
        printWindow.close();
      } catch {
        // ignore
      }
    }, 400);
  }

  async function createPlanPngPages() {
    // lazy import (nur wenn genutzt)
    const { toPng } = await import("html-to-image");

    // Offscreen container (damit nichts im UI flackert)
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = "900px";
    host.style.background = "#ffffff";
    host.style.padding = "0";
    host.style.zIndex = "999999";
    document.body.appendChild(host);

    try {
      // exportPages existieren bei dir bereits (useMemo)
      const pages = exportPages ?? [];
      if (pages.length === 0) return;

      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];

        // Wrapper pro Seite (A4-ish)
        const pageEl = document.createElement("div");
        pageEl.style.width = "820px";
        pageEl.style.minHeight = "1060px";
        pageEl.style.background = "#ffffff";
        pageEl.style.color = "#111";
        pageEl.style.fontFamily =
          'system-ui, -apple-system, Segoe UI, Roboto, Arial';
        pageEl.style.boxSizing = "border-box";
        pageEl.style.padding = "0";
        pageEl.innerHTML = p.html;

        host.appendChild(pageEl);

        // Render -> PNG
        const dataUrl = await toPng(pageEl, {
          backgroundColor: "#ffffff",
          pixelRatio: 2, // bessere Schärfe
        });

        // Download
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `week_${plan.weekId}_page_${String(i + 1).padStart(2, "0")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        // cleanup per page
        host.removeChild(pageEl);
      }
    } finally {
      host.remove();
    }
  }

  /* ============================================================
     New Week
     ============================================================ */

  const closeNewWeek = useCallback(() => setNewWeekOpen(false), [setNewWeekOpen]);

  function applyWeekDatesToSessions(sessions: Session[], weekStartMondayISO: string): Session[] {
    return sessions
      .map((s) => {
        const off = weekdayOffsetFromDEShort(s.day);
        // Fallback: wenn day fehlt, versuche aus vorhandenem date; sonst Mo
        const effectiveOffset =
          off !== null
            ? off
            : s.date
            ? (new Date(s.date + "T00:00:00").getDay() + 6) % 7
            : 0;

        const nextDate = addDaysISO(weekStartMondayISO, effectiveOffset);

        return {
          ...s,
          date: nextDate,
          day: weekdayShortDE(nextDate), // konsistent
          time: normalizeDash(String(s.time ?? "")),
        };
      })
      .sort((a, b) => {
        const ad = a.date.localeCompare(b.date);
        if (ad !== 0) return ad;
        return a.time.localeCompare(b.time);
      });
  }

  function createNewWeek(mode: NewWeekMode, keepParticipants: boolean, weekStartMondayISO: string) {
    if (mode === "MASTER") {
      setPlan(() => {
        const sessionsWithDates = applyWeekDatesToSessions(masterPlan.sessions, weekStartMondayISO);
        return {
          weekId: `WEEK_${weekStartMondayISO}`,
          sessions: sessionsWithDates.map((s) => ({ ...s, participants: [] })), // master = without participants
        };
      });
    } else if (mode === "EMPTY") {
      setPlan({ weekId: `WEEK_${weekStartMondayISO}`, sessions: [] });
    } else {
      // COPY_CURRENT
      setPlan((prev) => {
        const copied = prev.sessions.map((s) => ({
          ...s,
          id: randomId("sess_"),
          participants: keepParticipants ? [...(s.participants ?? [])] : [],
        }));

        const shifted = applyWeekDatesToSessions(copied, weekStartMondayISO);

        return {
          weekId: `WEEK_${weekStartMondayISO}_copy`,
          sessions: shifted,
        };
      });
    }
    setNewWeekOpen(false);
    resetForm();
  }

  /* ============================================================
     Render
     ============================================================ */

  const weekLabel = useMemo(() => {
    const base = kwLabelFromPlan(plan);
    try {
      return (birthdayPlayerIds && birthdayPlayerIds.size > 0) ? `${base} 🎂` : base;
    } catch {
      return base;
    }
  }, [plan, birthdayPlayerIds]);

  const weekDates = useMemo(() => {
    // Extrahiere Wochen-Start aus weekId (Format: WEEK_2026-02-17 oder ähnlich)
    let base: string;
    if (plan.weekId && plan.weekId.startsWith("WEEK_")) {
      const dateMatch = plan.weekId.match(/WEEK_(\d{4}-\d{2}-\d{2})/);
      if (dateMatch && dateMatch[1]) {
        base = dateMatch[1];
      } else {
        // Fallback: nutze Sessions oder heutiges Datum
        const dates = plan.sessions.map((s) => s.date).filter((d) => typeof d === "string" && d.length === 10).sort();
        base = dates.length ? isoWeekMonday(dates[0]) : isoWeekMonday(new Date().toISOString().slice(0, 10));
      }
    } else {
      // Fallback: nutze Sessions oder heutiges Datum
      const dates = plan.sessions.map((s) => s.date).filter((d) => typeof d === "string" && d.length === 10).sort();
      base = dates.length ? isoWeekMonday(dates[0]) : isoWeekMonday(new Date().toISOString().slice(0, 10));
    }
    const out: string[] = [];
    for (let i = 0; i < 7; i++) out.push(addDaysISO(base, i));
    return out;
  }, [plan]);

  // DnD Sensors für zuverlässiges Event-Clicking
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
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
        coaches={coaches}
        birthdayPlayerIds={birthdayPlayerIds}
        clubName={theme.clubName}
        logoUrl={clubLogoDataUrl}
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
            <LeftSidebar
              t={t}
              leftTab={leftTab}
              leftEditMode={leftEditMode}
              onSelectTab={(tab) => {
                setLeftTab(tab);
                setLeftEditMode(false);
              }}
              onToggleEditMode={() => setLeftEditMode((v) => !v)}
              onOpenRoster={() => {
                setRosterSearch("");
                setRosterOpen(true);
              }}
              openExtra={openExtra}
              onToggleU18Only={() => setOpenExtra((prev) => (prev === "U18_ONLY" ? null : "U18_ONLY"))}
              onToggleHolOnly={() => setOpenExtra((prev) => (prev === "HOL_ONLY" ? null : "HOL_ONLY"))}
              u18OnlyPlayers={u18OnlyPlayers}
              holOnlyPlayers={holOnlyPlayers}
              openGroup={openGroup}
              onToggleGroup={(groupId) => setOpenGroup((prev) => (prev === groupId ? null : groupId))}
              playersByGroup={playersByGroup}
              renderDraggablePlayer={(p) => (
                <DraggablePlayerRow
                  player={p}
                  trainingCount={trainingCounts.get(p.id) ?? 0}
                  groupBg={groupBg}
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
                onToggleLang={() => setTheme((p) => ({ ...p, locale: (p.locale === "de" ? "en" : "de") as Lang }))}
                onOpenProfiles={() => setProfilesOpen(true)}
                onToggleProfileMenu={() => setProfileMenuOpen((v) => !v)}
                onSelectProfileFromMenu={(id) => {
                  selectProfile(id);
                  setProfileMenuOpen(false);
                }}
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
                <EventPlannerForm
                  editorRef={editorRef}
                  opponentInputRef={opponentInputRef}
                  editingSessionId={editingSessionId}
                  weekLabel={weekLabel}
                  weekDates={weekDates}
                  formDate={formDate}
                  formTeams={formTeams}
                  teamOptions={TEAM_OPTIONS}
                  theme={theme}
                  locationUsageMap={locationUsageMap}
                  locationMode={locationMode}
                  customLocation={customLocation}
                  formStart={formStart}
                  formDuration={formDuration}
                  formOpponent={formOpponent}
                  formWarmupMin={formWarmupMin}
                  formTravelMin={formTravelMin}
                  autoTravelLoading={autoTravelLoading}
                  setTheme={setTheme}
                  setLeftTab={setLeftTab}
                  setLeftEditMode={setLeftEditMode}
                  setOpenLocationName={setOpenLocationName}
                  setAutoTravelLoading={setAutoTravelLoading}
                  setFormDate={setFormDate}
                  onToggleTeam={onToggleTeam}
                  setLocationMode={setLocationMode}
                  setCustomLocation={setCustomLocation}
                  setFormStart={setFormStart}
                  setFormDuration={setFormDuration}
                  setFormOpponent={setFormOpponent}
                  setFormWarmupMin={setFormWarmupMin}
                  setFormTravelMin={setFormTravelMin}
                  currentLocationValue={currentLocationValue}
                  onRecallLocationEdit={handleRecallLocationEdit}
                  upsertSession={upsertSession}
                  resetForm={resetForm}
                  onDeleteCurrentSession={() => {
                    if (!editingSessionId) return;
                    void onDeleteSession(editingSessionId);
                  }}
                  t={t}
                  lang={lang}
                />
              </EventEditorModal>

              <WeekPlanBoard
                sessions={plan.sessions}
                lang={lang}
                t={t}
                lastDropError={lastDropError}
                conflictsBySession={conflictsBySession as Map<string, Array<{ playerId: string }>>}
                historyFlagsBySession={historyFlagsBySession}
                editingSessionId={editingSessionId}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                collapsedParticipantsBySession={collapsedParticipantsBySession}
                onToggleParticipantsCollapse={(sessionId) =>
                  setCollapsedParticipantsBySession((prev) => ({
                    ...prev,
                    [sessionId]: !prev[sessionId],
                  }))
                }
                onEditSession={onEditSession}
                onDeleteSession={(sessionId) => {
                  void onDeleteSession(sessionId);
                }}
                playerById={playerById}
                removePlayerFromSession={removePlayerFromSession}
                groupBg={groupBg}
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
                  <CalendarOverviewPanel
                    weekDates={weekDates}
                    weekPlan={plan}
                    roster={players}
                    onOpenEventEditor={handleOpenEventEditor}
                    onUpdateWeekPlan={setPlan}
                    dnd={dnd}
                    onDelete={(id) => {
                      void onDeleteSession(id);
                    }}
                    onToggleTravel={toggleSessionTravel}
                    onToggleWarmup={toggleSessionWarmup}
                    editingSessionId={editingSessionId}
                    t={t}
                  />
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
        onDeleteProfile={deleteActiveProfile}
        clubLogoDataUrl={clubLogoDataUrl}
        logoUploadError={logoUploadError}
        logoMaxKb={Math.round(CLUB_LOGO_MAX_BYTES / 1024)}
        onLogoUpload={handleClubLogoUpload}
        onLogoRemove={() => setClubLogoDataUrl(null)}
        syncMode={activeProfileSync.mode}
        onSyncModeChange={(mode) => {
          updateActiveProfileSync({ mode });
        }}
        cloudConfigured={cloudConfigured}
        cloudUserEmail={cloudUserEmail}
        cloudEmailInput={cloudEmailInput}
        cloudStatusMsg={cloudStatusMsg}
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

      <RosterEditorModal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        t={t}
        players={players}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
        rosterSearch={rosterSearch}
        onRosterSearchChange={setRosterSearch}
        addNewPlayer={addNewPlayer}
        exportRoster={exportRoster}
        importRosterFile={importRosterFile}
        deletePlayer={deletePlayer}
        updatePlayer={updatePlayer}
        teamOptions={TEAM_OPTIONS}
        clubName={theme.clubName}
      />
    </>
  );
}