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
  GroupId,
  Player,
  ThemeSettings,
  WeekPlan,
} from "@/types";
import { makeT, makeTF } from "./i18n/translate";
import { Button } from "@/components/ui";
import {
  AppTopBar,
  CalendarOverviewPanel,
  LeftSidebar,
  PrintView,
  RightSidebar,
  WeekPlanBoard,
} from "@/components/layout";
import {
  ConfirmModal,
  EventEditorModal,
  EventPlannerForm,
  NewWeekModal,
  ProfilesModal,
  PromptModal,
  RosterEditorModal,
  ThemeSettingsModal,
} from "@/components/modals";
import { DraggablePlayerRow } from "@/components/roster";
import {
  useCloudSnapshotHandlers,
  useCoaches,
  useConfirmDialog,
  useDndPlan,
  useCloudSync,
  LOCATION_PRESETS,
  TEAM_OPTIONS,
  useEventPlannerState,
  useLocationUsageMap,
  usePdfExport,
  usePlayerActions,
  useProfilesState,
  usePersistedState,
  useRightSidebarPersistence,
  useSessionEditor,
  usePromptDialog,
  useWeekManager,
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
  getPlayerGroup,
  GROUPS,
  isCorePlayer,
  isHolOnly,
  isU18Only,
  makeParticipantSorter,
} from "./state/playerGrouping";
import { LAST_PLAN_STORAGE_KEY, THEME_STORAGE_KEY } from "./state/storageKeys";
import type { CloudSnapshotV1 } from "./state/profileTypes";
import { migrateLegacyBlueTheme, safeParseTheme } from "./state/themePersistence";
import { DEFAULT_THEME } from "./state/themeDefaults";
import { applyThemeToCssVars } from "./themes/cssVars";
import { splitTimeRange } from "./utils/date";
import {
  computeConflictsBySession,
  isGameInfo,
  isGameSession,
  sessionsOverlap,
} from "./utils/session";
import { ensureLocationSaved } from "./utils/locations";
import { buildPreviewPages, buildPrintPages } from "./utils/printExport";
import rosterRaw from "./data/roster.json";
import weekMasterRaw from "./data/weekplan_master.json";

const CLUB_LOGO_STORAGE_KEY = "ubc_club_logo_v1";
const CLUB_LOGO_MAX_BYTES = 600 * 1024;

export default function App() {
  // ── Theme ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = safeParseTheme(
      typeof window !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null,
      DEFAULT_THEME
    );
    return saved ? migrateLegacyBlueTheme(saved, DEFAULT_THEME) : DEFAULT_THEME;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") !== "1") return;
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(LAST_PLAN_STORAGE_KEY);
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

  const lang: Lang = (theme.locale ?? "de") as Lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const tf = useMemo(() => makeTF(lang), [lang]);

  const groupBg = useMemo(
    () => ({
      "2007": theme.groups["2007"].bg,
      "2008": theme.groups["2008"].bg,
      "2009": theme.groups["2009"].bg,
      Herren: theme.groups["Herren"].bg,
      TBD: theme.groups["TBD"].bg,
    }) as Record<GroupId, string>,
    [theme]
  );

  // ── UI State ─────────────────────────────────────────────────────────────
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

  const {
    settingsOpen, eventEditorOpen, rightSidebarOpen: rightOpen,
    newWeekOpen, rightLayout, rightTop, rightBottom, rightSplitPct,
    openGroup, openExtra, leftTab, leftEditMode, openLocationName,
    rosterOpen, autoTravelLoading, confirmDialog, rosterSearch, selectedPlayerId,
  } = appUiState;

  const { askConfirm, resolveConfirm } = useConfirmDialog(setConfirmDialog);
  const { promptDialog, setPromptValue, askPrompt, resolvePrompt } = usePromptDialog();

  useRightSidebarPersistence({
    rightOpen, rightLayout, rightTop, rightBottom, rightSplitPct,
    setRightOpen, setRightLayout, setRightTop, setRightBottom, setRightSplitPct,
  });

  // ── Roster / Players ─────────────────────────────────────────────────────
  const normalizedRoster = useMemo(() => normalizeRoster(rosterRaw as unknown), []);
  const [rosterMeta, setRosterMeta] = useState({ season: normalizedRoster.season, ageGroups: normalizedRoster.ageGroups });
  const [players, setPlayers] = useState<Player[]>(() => normalizedRoster.players);
  const [lastDropError, setLastDropError] = useState<string | null>(null);

  // ── Coaches ──────────────────────────────────────────────────────────────
  const { coaches, setCoaches, addCoach, updateCoach, deleteCoach, exportStaff, importStaffFile } =
    useCoaches(t, setLastDropError);

  // ── Profiles & Logo ───────────────────────────────────────────────────────
  const {
    profiles, setProfiles, activeProfileId, setActiveProfileId, setProfileHydratedId,
    profilesOpen, setProfilesOpen, profileNameInput, setProfileNameInput,
    logoUploadError, profileMenuOpen, setProfileMenuOpen, profileMenuRef,
    clubLogoDataUrl, setClubLogoDataUrl, activeProfileName, activeProfileSync,
    handleClubLogoUpload, createProfile, updateActiveProfile, deleteActiveProfile, selectProfile,
  } = useProfilesState({
    t, tf, rosterMeta, players, coaches,
    locations: (theme.locations ?? DEFAULT_THEME.locations!) as NonNullable<ThemeSettings["locations"]>,
    clubLogoStorageKey: CLUB_LOGO_STORAGE_KEY,
    clubLogoMaxBytes: CLUB_LOGO_MAX_BYTES,
    onApplyProfileData: (payload) => {
      setRosterMeta(payload.rosterMeta);
      setPlayers(payload.players);
      setCoaches(payload.coaches);
      setTheme((prev) => ({ ...prev, locations: payload.locations }));
    },
  });

  // ── TBD placeholder ──────────────────────────────────────────────────────
  useEffect(() => {
    setPlayers((prev) => {
      if (prev.some((p) => p.id === "TBD")) return prev;
      return [...prev, {
        id: "TBD", name: "TBD", firstName: "TBD", lastName: "", group: "TBD",
        positions: [], primaryYouthTeam: "", primarySeniorTeam: "",
        defaultTeams: [], lizenzen: [], isLocalPlayer: false,
      }];
    });
  }, []);

  // ── Plan ─────────────────────────────────────────────────────────────────
  const masterPlan = useMemo(() => normalizeMasterWeek(weekMasterRaw as unknown), []);
  const [plan, setPlan] = usePersistedState<WeekPlan>(LAST_PLAN_STORAGE_KEY, masterPlan, reviveWeekPlan);

  // ── Derived ──────────────────────────────────────────────────────────────
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
  const locationUsageMap = useLocationUsageMap(plan.sessions ?? []);
  const planDates = useMemo(() => planDateSet(plan), [plan]);

  const birthdayPlayerIds = useMemo(() => {
    const res = new Set<string>();
    for (const s of plan.sessions ?? [])
      for (const pid of s.participants ?? []) {
        const p = playerById.get(pid);
        if (p && isBirthdayOnAnyPlanDate(p, planDates)) res.add(pid);
      }
    return res;
  }, [plan, playerById, planDates]);

  const playersByGroup = useMemo(() => {
    const map = new Map<GroupId, Player[]>();
    for (const g of GROUPS) map.set(g.id, []);
    for (const p of players) {
      if (!isCorePlayer(p)) continue;
      map.get(getPlayerGroup(p))?.push(p);
    }
    for (const [gid, arr] of map.entries())
      map.set(gid, arr.sort((a, b) => a.name.localeCompare(b.name, "de")));
    return map;
  }, [players]);

  const u18OnlyPlayers = useMemo(
    () => players.filter(isU18Only).sort((a, b) => a.name.localeCompare(b.name, "de")),
    [players]
  );
  const holOnlyPlayers = useMemo(
    () => players.filter(isHolOnly).sort((a, b) => a.name.localeCompare(b.name, "de")),
    [players]
  );

  // ── Player Actions ────────────────────────────────────────────────────────
  const { updatePlayer, addNewPlayer, deletePlayer, importRosterFile, exportRoster } =
    usePlayerActions({
      players, setPlayers, rosterMeta, setRosterMeta,
      setPlan, setSelectedPlayerId, setLastDropError, t,
    });

  // ── Export Pages ──────────────────────────────────────────────────────────
  const exportPages = useMemo(() => buildPrintPages({
    sessions: plan?.sessions ?? [], players, coaches,
    clubName: theme.clubName, locale: theme.locale,
    locations: theme.locations ?? DEFAULT_THEME.locations!,
    logoUrl: clubLogoDataUrl ?? undefined,
  }), [plan, players, coaches, theme, clubLogoDataUrl]);

  const previewPages = useMemo(() => buildPreviewPages({
    sessions: plan?.sessions ?? [], players, coaches,
    clubName: theme.clubName, locale: theme.locale,
    locations: theme.locations ?? DEFAULT_THEME.locations!,
    logoUrl: clubLogoDataUrl ?? undefined,
  }), [plan, players, coaches, theme, clubLogoDataUrl]);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const { createPlanPdf, createPlanPngPages } = usePdfExport({
    exportPages, clubName: theme.clubName, weekId: plan.weekId,
  });

  // ── Cloud Snapshot Handlers ───────────────────────────────────────────────
  const {
    buildCloudSnapshot, applyCloudSnapshot, isCloudSnapshotV1,
    cloudSyncSignal, cloudSyncEnabledForActiveProfile, updateActiveProfileSync,
  } = useCloudSnapshotHandlers({
    rosterMeta, players, coaches, theme, plan,
    activeProfileId, activeProfileName, activeProfileSync, clubLogoDataUrl,
    setRosterMeta, setPlayers, setCoaches, setTheme, setPlan,
    setClubLogoDataUrl, setProfiles, setProfileHydratedId, setActiveProfileId,
  });

  // ── Cloud Sync ────────────────────────────────────────────────────────────
  const {
    cloudConfigured, cloudEmailInput, cloudStatusMsg, cloudUserEmail,
    cloudBusy, cloudLastSyncAt, cloudAutoSync, setCloudEmailInput,
    signInToCloud, signOutFromCloud, loadSnapshotFromCloud,
    saveSnapshotToCloud, toggleCloudAutoSync,
  } = useCloudSync<CloudSnapshotV1>({
    t, profileId: activeProfileId || null,
    enabled: cloudSyncEnabledForActiveProfile,
    autoSyncEnabled: Boolean(activeProfileSync.autoSync),
    onAutoSyncChange: (next) => updateActiveProfileSync({ autoSync: next }),
    buildSnapshot: buildCloudSnapshot,
    applySnapshot: applyCloudSnapshot,
    isSnapshot: isCloudSnapshotV1,
    autoSyncSignal: cloudSyncSignal,
  });

  // ── Session Editor / Event Planner ────────────────────────────────────────
  function removePlayerFromSession(sessionId: string, playerId: string) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          participants: (s.participants ?? []).filter((id) => id !== playerId).sort(sortParticipants),
        };
      }),
    }));
  }

  const {
    editorState, setEditingSessionId, setFormDate, setFormTeams,
    setLocationMode, setCustomLocation, setFormStart, setFormDuration,
    setFormOpponent, setFormWarmupMin, setFormTravelMin,
    currentLocationValue, onToggleTeam, resetForm, buildSessionFromForm,
  } = useEventPlannerState();

  const {
    editingSessionId, formDate, formTeams, locationMode, customLocation,
    formStart, formDuration, formOpponent, formWarmupMin, formTravelMin,
  } = editorState;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const opponentInputRef = useRef<HTMLInputElement | null>(null);
  const editorTopRef = useRef<HTMLDivElement | null>(null);

  function handleRecallLocationEdit() {
    const current = currentLocationValue().trim();
    setLeftTab("locations");
    setLeftEditMode(true);
    if (!current || current === "—") { setOpenLocationName(null); return; }
    const known = Object.prototype.hasOwnProperty.call(theme.locations?.locations ?? {}, current);
    const isPreset = LOCATION_PRESETS.includes(current as (typeof LOCATION_PRESETS)[number]);
    if (!known && !isPreset) ensureLocationSaved(theme, setTheme, current);
    setOpenLocationName(current);
  }

  const { upsert: upsertSessionInPlan, remove: removeSessionFromPlan } =
    useSessionEditor(setPlan, sortParticipants);

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
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { opponentInputRef.current?.focus(); opponentInputRef.current?.select(); }, 500);
    });
    const loc = (s.location ?? "").trim();
    const savedLocations = Object.keys(theme.locations?.locations ?? {});
    const isKnownLocation =
      LOCATION_PRESETS.includes(loc as (typeof LOCATION_PRESETS)[number]) ||
      savedLocations.includes(loc);
    if (isKnownLocation) { setLocationMode(loc); setCustomLocation(""); }
    else { setLocationMode("__CUSTOM__"); setCustomLocation(loc); }
    const tr = splitTimeRange(s.time ?? "");
    setFormStart(tr ? tr[0] : "18:00");
    if (tr) {
      const [st, en] = tr;
      const startMin = parseInt(st.slice(0, 2), 10) * 60 + parseInt(st.slice(3, 5), 10);
      const endMin = parseInt(en.slice(0, 2), 10) * 60 + parseInt(en.slice(3, 5), 10);
      setFormDuration(Math.max(0, endMin - startMin) || 90);
    } else { setFormDuration(90); }
    setFormOpponent(s.info ?? "");
    const game = isGameInfo(s.info ?? "");
    setFormWarmupMin(game ? Number(s.warmupMin ?? 30) : 30);
    setFormTravelMin(game ? Number(s.travelMin ?? 0) : 0);
    // setFormEventColor(s.eventColor ?? ""); // eventColor not in CalendarEvent
  }

  async function onDeleteSession(sessionId: string) {
    const s = plan.sessions.find((x) => x.id === sessionId);
    const label = s
      ? [s.day, s.date, "|", (s.teams ?? []).join("/"), "|", s.time].join(" ")
      : sessionId;
    if (!(await askConfirm(t("delete"), String(label)))) return;
    removeSessionFromPlan(sessionId);
    if (editingSessionId === sessionId) resetForm();
  }

  function toggleSessionTravel(sessionId: string) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const cur = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));
        return { ...s, travelMin: cur > 0 ? 0 : 30 };
      }),
    }));
  }

  function toggleSessionWarmup(sessionId: string) {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const cur = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));
        return { ...s, warmupMin: cur > 0 ? 0 : 30 };
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
        (document.getElementById("event_form_date") as HTMLInputElement | null)?.focus();
      }, 500);
    });
  }

  // ── DnD ──────────────────────────────────────────────────────────────────
  const dnd = useDndPlan({
    weekPlan: plan, setWeekPlan: setPlan, players, setPlayers,
    setLastDropError, sortParticipants, removePlayerFromSession,
    sessionsOverlap, isGameSession, t, tf, confirm: askConfirm, prompt: askPrompt,
  });

  // ── Week Manager ──────────────────────────────────────────────────────────
  const { weekLabel, weekDates, createNewWeek } = useWeekManager({
    plan, setPlan, masterPlan, birthdayPlayerIds, setNewWeekOpen, resetForm,
  });

  const closeNewWeek = useCallback(() => setNewWeekOpen(false), [setNewWeekOpen]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PrintView
        plan={plan} playerById={playerById} groupBg={groupBg}
        coaches={coaches} birthdayPlayerIds={birthdayPlayerIds}
        clubName={theme.clubName} logoUrl={clubLogoDataUrl}
        locations={theme.locations} t={t}
      />

      <div
        id="app-root"
        style={{ background: "var(--ui-bg)", color: "var(--ui-text)", minHeight: "100vh",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}
      >
        <DndContext sensors={sensors} onDragStart={dnd.onDragStart} onDragOver={dnd.onDragOver} onDragEnd={dnd.onDragEnd}>
          <div className={rightOpen ? "appGrid appGrid3" : "appGrid"}>
            <LeftSidebar
              t={t} leftTab={leftTab} leftEditMode={leftEditMode}
              onSelectTab={(tab) => { setLeftTab(tab); setLeftEditMode(false); }}
              onToggleEditMode={() => setLeftEditMode((v) => !v)}
              onOpenRoster={() => { setRosterSearch(""); setRosterOpen(true); }}
              openExtra={openExtra}
              onToggleU18Only={() => setOpenExtra((prev) => (prev === "U18_ONLY" ? null : "U18_ONLY"))}
              onToggleHolOnly={() => setOpenExtra((prev) => (prev === "HOL_ONLY" ? null : "HOL_ONLY"))}
              u18OnlyPlayers={u18OnlyPlayers} holOnlyPlayers={holOnlyPlayers}
              openGroup={openGroup}
              onToggleGroup={(groupId) => setOpenGroup((prev) => (prev === groupId ? null : groupId))}
              playersByGroup={playersByGroup}
              renderDraggablePlayer={(p) => (
                <DraggablePlayerRow player={p} trainingCount={trainingCounts.get(p.id) ?? 0}
                  groupBg={groupBg} isBirthday={birthdayPlayerIds.has(p.id)} t={t} />
              )}
              coaches={coaches} onAddCoach={addCoach} onUpdateCoach={updateCoach}
              onDeleteCoach={deleteCoach} onExportStaff={exportStaff} onImportStaffFile={importStaffFile}
              theme={theme} setTheme={setTheme} locationUsageMap={locationUsageMap}
              openLocationName={openLocationName} setOpenLocationName={setOpenLocationName}
            />

            <div className="rightPane" style={{ padding: 16, overflow: "auto", background: "var(--ui-bg)" }}>
              <AppTopBar
                locale={lang} t={t} clubLogoDataUrl={clubLogoDataUrl}
                activeProfileName={activeProfileName} profiles={profiles}
                activeProfileId={activeProfileId} profileMenuOpen={profileMenuOpen}
                profileMenuRef={profileMenuRef}
                onToggleLang={() => setTheme((p) => ({ ...p, locale: (p.locale === "de" ? "en" : "de") as Lang }))}
                onOpenProfiles={() => setProfilesOpen(true)}
                onToggleProfileMenu={() => setProfileMenuOpen((v) => !v)}
                onSelectProfileFromMenu={(id) => { selectProfile(id); setProfileMenuOpen(false); }}
                eventEditorOpen={eventEditorOpen}
                onToggleEventEditor={() => setEventEditorOpen((v) => !v)}
                onOpenNewWeek={() => setNewWeekOpen(true)}
                rightOpen={rightOpen} onToggleRightSidebar={() => setRightOpen((v) => !v)}
                onOpenSettings={() => setSettingsOpen(true)}
              />

              <div ref={editorTopRef} id="event-editor-top" />

              <EventEditorModal open={eventEditorOpen} onClose={() => setEventEditorOpen(false)}
                title={editingSessionId ? t("eventEdit") : t("eventPlan")} closeLabel={t("close")}>
                <EventPlannerForm
                  editorRef={editorRef} opponentInputRef={opponentInputRef}
                  editingSessionId={editingSessionId} weekLabel={weekLabel} weekDates={weekDates}
                  formDate={formDate} formTeams={formTeams} teamOptions={TEAM_OPTIONS}
                  theme={theme} locationUsageMap={locationUsageMap} locationMode={locationMode}
                  customLocation={customLocation} formStart={formStart} formDuration={formDuration}
                  formOpponent={formOpponent} formWarmupMin={formWarmupMin} formTravelMin={formTravelMin}
                  autoTravelLoading={autoTravelLoading}
                  setTheme={setTheme} setLeftTab={setLeftTab} setLeftEditMode={setLeftEditMode}
                  setOpenLocationName={setOpenLocationName} setAutoTravelLoading={setAutoTravelLoading}
                  setFormDate={setFormDate} onToggleTeam={onToggleTeam} setLocationMode={setLocationMode}
                  setCustomLocation={setCustomLocation} setFormStart={setFormStart}
                  setFormDuration={setFormDuration} setFormOpponent={setFormOpponent}
                  setFormWarmupMin={setFormWarmupMin} setFormTravelMin={setFormTravelMin}
                  currentLocationValue={currentLocationValue}
                  onRecallLocationEdit={handleRecallLocationEdit} upsertSession={upsertSession}
                  resetForm={resetForm}
                  onDeleteCurrentSession={() => { if (!editingSessionId) return; void onDeleteSession(editingSessionId); }}
                  t={t} lang={lang}
                />
              </EventEditorModal>

              <WeekPlanBoard
                sessions={plan.sessions} lang={lang} t={t} lastDropError={lastDropError}
                conflictsBySession={conflictsBySession as Map<string, Array<{ playerId: string }>>}
                historyFlagsBySession={historyFlagsBySession} editingSessionId={editingSessionId}
                selectedSessionId={selectedSessionId} onSelectSession={setSelectedSessionId}
                collapsedParticipantsBySession={collapsedParticipantsBySession}
                onToggleParticipantsCollapse={(id) =>
                  setCollapsedParticipantsBySession((prev) => ({ ...prev, [id]: !prev[id] }))}
                onEditSession={onEditSession}
                onDeleteSession={(id) => { void onDeleteSession(id); }}
                playerById={playerById} removePlayerFromSession={removePlayerFromSession}
                groupBg={groupBg} birthdayPlayerIds={birthdayPlayerIds}
              />

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button onClick={createPlanPdf} style={{ padding: "12px 14px" }}>{t("createPdf")}</Button>
                <Button onClick={createPlanPngPages} style={{ padding: "12px 14px" }}>{t("exportPng")}</Button>
              </div>
            </div>

            <RightSidebar
              open={rightOpen} layout={rightLayout} topModule={rightTop} bottomModule={rightBottom}
              splitPct={rightSplitPct} onChangeLayout={setRightLayout} onChangeTop={setRightTop}
              onChangeBottom={setRightBottom} onChangeSplitPct={setRightSplitPct} t={t}
              context={{
                previewPages,
                renderCalendar: () => (
                  <CalendarOverviewPanel
                    weekDates={weekDates} weekPlan={plan} roster={players}
                    onOpenEventEditor={handleOpenEventEditor} onUpdateWeekPlan={setPlan} dnd={dnd}
                    onDelete={(id) => { void onDeleteSession(id); }}
                    onToggleTravel={toggleSessionTravel} onToggleWarmup={toggleSessionWarmup}
                    editingSessionId={editingSessionId} t={t}
                  />
                ),
              }}
            />
          </div>
        </DndContext>
      </div>

      <ThemeSettingsModal open={settingsOpen} theme={theme} defaultTheme={DEFAULT_THEME}
        onChangeTheme={setTheme} onReset={() => setTheme(DEFAULT_THEME)}
        onClose={() => setSettingsOpen(false)} t={t}
        onConfirmOverwrite={(title, message) => askConfirm(title, message)} />

      <NewWeekModal open={newWeekOpen} onClose={closeNewWeek} onCreate={createNewWeek}
        defaultMode="MASTER" t={t} />

      <ConfirmModal open={confirmDialog.open} title={confirmDialog.title} message={confirmDialog.message}
        onConfirm={() => resolveConfirm(true)} onCancel={() => resolveConfirm(false)} t={t} />

      <PromptModal open={promptDialog.open} title={promptDialog.title} message={promptDialog.message}
        value={promptDialog.value} onValueChange={setPromptValue} placeholder={promptDialog.placeholder}
        onConfirm={() => resolvePrompt(promptDialog.value.trim())} onCancel={() => resolvePrompt(null)} t={t} />

      <ProfilesModal
        open={profilesOpen} onClose={() => setProfilesOpen(false)} t={t} tf={tf} lang={lang}
        profiles={profiles} activeProfileId={activeProfileId} activeProfileName={activeProfileName}
        profileNameInput={profileNameInput} onProfileNameInputChange={setProfileNameInput}
        onSelectProfile={selectProfile} onCreateProfile={createProfile}
        onUpdateProfile={updateActiveProfile} onDeleteProfile={deleteActiveProfile}
        clubLogoDataUrl={clubLogoDataUrl} logoUploadError={logoUploadError}
        logoMaxKb={Math.round(CLUB_LOGO_MAX_BYTES / 1024)} onLogoUpload={handleClubLogoUpload}
        onLogoRemove={() => setClubLogoDataUrl(null)} syncMode={activeProfileSync.mode}
        onSyncModeChange={(mode) => updateActiveProfileSync({ mode })}
        cloudConfigured={cloudConfigured} cloudUserEmail={cloudUserEmail}
        cloudEmailInput={cloudEmailInput} cloudStatusMsg={cloudStatusMsg}
        cloudLastSyncAt={cloudLastSyncAt} cloudBusy={cloudBusy} cloudAutoSync={cloudAutoSync}
        onEmailInputChange={setCloudEmailInput}
        onSignIn={() => { void signInToCloud(); }}
        onLoad={() => { void loadSnapshotFromCloud(); }}
        onSave={() => { void saveSnapshotToCloud(false); }}
        onToggleAutoSync={toggleCloudAutoSync}
        onSignOut={() => { void signOutFromCloud(); }}
      />

      <RosterEditorModal
        open={rosterOpen} onClose={() => setRosterOpen(false)} t={t}
        players={players} selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId}
        rosterSearch={rosterSearch} onRosterSearchChange={setRosterSearch}
        addNewPlayer={addNewPlayer} exportRoster={exportRoster} importRosterFile={importRosterFile}
        deletePlayer={deletePlayer} updatePlayer={updatePlayer}
        teamOptions={TEAM_OPTIONS} clubName={theme.clubName}
      />
    </>
  );
}
