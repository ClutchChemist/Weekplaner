import type { RefObject } from "react";
import type { Lang } from "@/i18n/types";
import type { Player, ThemeSettings } from "@/types";
import type { LocationUsageMap } from "@/utils/locations";
import { addMinutesToHHMM, weekdayShortLocalized } from "@/utils/date";
import { composeOpponentInfo, getOpponentMode, getOpponentName } from "@/hooks";
import { isGameInfo, normalizeOpponentInfo } from "@/utils/session";
import {
  getCachedTravelMinutes,
  getLocationOptions,
  resolveLocationAddress,
  resolveLocationPlaceId,
  setCachedTravelMinutes,
} from "@/utils/locations";
import { fetchTravelMinutes } from "@/utils/mapsApi";
import { normalizeTeamCode } from "@/utils/team";
import { getPlayerGroup } from "@/state/playerGrouping";
import { Button, Input, MinutePicker, Modal, segBtn } from "@/components/ui";
import { EventEditorModal } from "./EventEditorModal";

type QuickRosterTab = {
  id: string;
  label: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
  lang: Lang;

  editorRef: RefObject<HTMLDivElement | null>;
  opponentInputRef: RefObject<HTMLInputElement | null>;

  editingSessionId: string | null;
  onDeleteSession: (id: string) => void;

  weekLabel: string;
  weekDates: string[];

  formDate: string;
  setFormDate: (value: string) => void;
  allTeamOptions: string[];
  formTeams: string[];
  onToggleTeam: (team: string) => void;

  teamCodeDraft: string;
  setTeamCodeDraft: (value: string) => void;
  onAddTeamCodeFromDraftEvent: () => void;

  theme: ThemeSettings;
  setTheme: (next: ThemeSettings) => void;
  locationUsageMap: LocationUsageMap;
  locationMode: string;
  setLocationMode: (value: string) => void;
  setCustomLocation: (value: string) => void;
  onEditLocationsFromEvent: () => void;

  formStart: string;
  setFormStart: (value: string) => void;
  formDuration: number;
  setFormDuration: (value: number) => void;

  formOpponent: string;
  setFormOpponent: (value: string) => void;
  handleRecallLocationEdit: () => void;

  formWarmupMin: number;
  setFormWarmupMin: (value: number) => void;
  formTravelMin: number;
  setFormTravelMin: (value: number) => void;
  autoTravelLoading: boolean;
  setAutoTravelLoading: (loading: boolean) => void;
  autoTravelError: string | null;
  setAutoTravelError: (value: string | null) => void;
  currentLocationValue: () => string;

  formExcludeFromRoster: boolean;
  setFormExcludeFromRoster: (value: boolean) => void;
  formRowColor: string;
  setFormRowColor: (value: string) => void;

  upsertSession: () => void;
  onOpenQuickRoster: () => void;
  onResetEventForm: () => void;

  quickRosterOpen: boolean;
  onCloseQuickRoster: () => void;
  quickRosterTabs: QuickRosterTab[];
  quickRosterFilters: string[];
  onToggleQuickRosterFilter: (id: string) => void;
  onResetQuickRosterFilters: () => void;
  quickRosterSearch: string;
  setQuickRosterSearch: (value: string) => void;
  selectedParticipantsCount: number;
  quickRosterPlayers: Player[];
  countInFormParticipants: (playerId: string) => number;
  birthdayPlayerIds: Set<string>;
  removeFromFormParticipants: (playerId: string) => void;
  addToFormParticipants: (playerId: string) => void | Promise<void>;
};

export function EventPlannerModal({
  open,
  onClose,
  t,
  lang,
  editorRef,
  opponentInputRef,
  editingSessionId,
  onDeleteSession,
  weekLabel,
  weekDates,
  formDate,
  setFormDate,
  allTeamOptions,
  formTeams,
  onToggleTeam,
  teamCodeDraft,
  setTeamCodeDraft,
  onAddTeamCodeFromDraftEvent,
  theme,
  setTheme,
  locationUsageMap,
  locationMode,
  setLocationMode,
  setCustomLocation,
  onEditLocationsFromEvent,
  formStart,
  setFormStart,
  formDuration,
  setFormDuration,
  formOpponent,
  setFormOpponent,
  handleRecallLocationEdit,
  formWarmupMin,
  setFormWarmupMin,
  formTravelMin,
  setFormTravelMin,
  autoTravelLoading,
  setAutoTravelLoading,
  autoTravelError,
  setAutoTravelError,
  currentLocationValue,
  formExcludeFromRoster,
  setFormExcludeFromRoster,
  formRowColor,
  setFormRowColor,
  upsertSession,
  onOpenQuickRoster,
  onResetEventForm,
  quickRosterOpen,
  onCloseQuickRoster,
  quickRosterTabs,
  quickRosterFilters,
  onToggleQuickRosterFilter,
  onResetQuickRosterFilters,
  quickRosterSearch,
  setQuickRosterSearch,
  selectedParticipantsCount,
  quickRosterPlayers,
  countInFormParticipants,
  birthdayPlayerIds,
  removeFromFormParticipants,
  addToFormParticipants,
}: Props) {
  return (
    <>
      <EventEditorModal
        open={open}
        onClose={onClose}
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
                  {t("delete")}
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
                    placeholder={lang === "de" ? "Team hinzufugen (z. B. U20)" : "Add team (e.g. U20)"}
                    style={{ maxWidth: 260 }}
                  />
                  <Button
                    variant="outline"
                    onClick={onAddTeamCodeFromDraftEvent}
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
                        onClick={onEditLocationsFromEvent}
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
                            {t("eventRecallLocation")}
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
                                    ? (lang === "de" ? "Maps-Proxy nicht erreichbar (Port 5055). Proxy starten?" : "Maps proxy not reachable (port 5055). Start proxy?")
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
                                {autoTravelLoading ? `${t("calculating")}` : `${t("autoTravel")}`}
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

          <div style={{ padding: "0 12px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formExcludeFromRoster}
                onChange={(e) => setFormExcludeFromRoster(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--ui-accent)" }}
              />
              <span style={{ fontSize: 13, fontWeight: 900 }}>{t("excludeFromRoster") || "Aus Kaderubersicht verbergen"}</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 900 }}>{t("rowColorLabel")}:</span>
              <input
                type="color"
                value={formRowColor || "#ffffff"}
                onChange={(e) => setFormRowColor(e.target.value === "#ffffff" ? "" : e.target.value)}
                style={{ width: 36, height: 28, padding: 2, border: "1px solid var(--ui-border)", borderRadius: 6, cursor: "pointer" }}
                title="Hintergrundfarbe fur Datenzellen im Zeitplan (nur Preview/Export)"
              />
              {formRowColor ? (
                <button
                  type="button"
                  onClick={() => setFormRowColor("")}
                  style={{ fontSize: 11, color: "var(--ui-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {t("rowColorRemove")}
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, padding: 12, paddingTop: 0, alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={upsertSession}>
              {editingSessionId ? t("saveChanges") : t("addEvent")}
            </Button>
            <Button variant="outline" onClick={onOpenQuickRoster}>
              {t("rosterQuickPickerOpen")}
            </Button>
            <Button variant="outline" onClick={onResetEventForm}>
              {t("reset")}
            </Button>

            <div style={{ marginLeft: "auto", color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
              {(() => {
                const info = normalizeOpponentInfo(formOpponent);
                const dur = isGameInfo(info) ? 120 : formDuration;
                return (
                  <>{t("preview")}: {formStart}-{addMinutesToHHMM(formStart, dur)} | {currentLocationValue()}</>
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
          onClose={onCloseQuickRoster}
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
                    onClick={() => onToggleQuickRosterFilter(tab.id)}
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
                onClick={onResetQuickRosterFilters}
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
              {t("rosterQuickPickerSelectedCount")}: {selectedParticipantsCount}
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
                ).join(" | ");

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
                        {birthdayPlayerIds.has(p.id) ? " *" : ""}
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
    </>
  );
}

