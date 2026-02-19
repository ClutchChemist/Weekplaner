import type { RefObject } from "react";
import type { Lang } from "@/i18n/types";
import type { LocationUsageMap } from "@/utils/locations";
import type { ThemeSettings } from "@/types";
import { addMinutesToHHMM, weekdayShortLocalized } from "@/utils/date";
import { composeOpponentInfo, getOpponentMode, getOpponentName } from "@/hooks";
import { isGameInfo, normalizeOpponentInfo } from "@/utils/session";
import {
  ensureLocationSaved,
  getCachedTravelMinutes,
  getLocationOptions,
  resolveLocationAddress,
  resolveLocationPlaceId,
  setCachedTravelMinutes,
} from "@/utils/locations";
import { fetchTravelMinutes } from "@/utils/mapsApi";
import { Button, Input, segBtn } from "@/components/ui";

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

type Props = {
  editorRef: RefObject<HTMLDivElement | null>;
  opponentInputRef: RefObject<HTMLInputElement | null>;
  editingSessionId: string | null;
  weekLabel: string;
  weekDates: string[];
  formDate: string;
  formTeams: string[];
  teamOptions: string[];
  theme: ThemeSettings;
  locationUsageMap: LocationUsageMap;
  locationMode: string;
  customLocation: string;
  formStart: string;
  formDuration: number;
  formOpponent: string;
  formWarmupMin: number;
  formTravelMin: number;
  autoTravelLoading: boolean;
  setTheme: (theme: ThemeSettings) => void;
  setLeftTab: (tab: "players" | "coaches" | "locations") => void;
  setLeftEditMode: (enabled: boolean) => void;
  setOpenLocationName: (name: string | null) => void;
  setAutoTravelLoading: (loading: boolean) => void;
  setFormDate: (value: string) => void;
  onToggleTeam: (team: string) => void;
  setLocationMode: (value: string) => void;
  setCustomLocation: (value: string) => void;
  setFormStart: (value: string) => void;
  setFormDuration: (value: number) => void;
  setFormOpponent: (value: string) => void;
  setFormWarmupMin: (value: number) => void;
  setFormTravelMin: (value: number) => void;
  currentLocationValue: () => string;
  onRecallLocationEdit: () => void;
  upsertSession: () => void;
  resetForm: () => void;
  onDeleteCurrentSession: () => void;
  t: (k: string) => string;
  lang: Lang;
};

export function EventPlannerForm({
  editorRef,
  opponentInputRef,
  editingSessionId,
  weekLabel,
  weekDates,
  formDate,
  formTeams,
  teamOptions,
  theme,
  locationUsageMap,
  locationMode,
  customLocation,
  formStart,
  formDuration,
  formOpponent,
  formWarmupMin,
  formTravelMin,
  autoTravelLoading,
  setTheme,
  setLeftTab,
  setLeftEditMode,
  setOpenLocationName,
  setAutoTravelLoading,
  setFormDate,
  onToggleTeam,
  setLocationMode,
  setCustomLocation,
  setFormStart,
  setFormDuration,
  setFormOpponent,
  setFormWarmupMin,
  setFormTravelMin,
  currentLocationValue,
  onRecallLocationEdit,
  upsertSession,
  resetForm,
  onDeleteCurrentSession,
  t,
  lang,
}: Props) {
  return (
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
              onClick={onDeleteCurrentSession}
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
          <div className="flexRow">
            {teamOptions.map((teamOption) => {
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

          <div style={{ fontWeight: 900 }}>{t("location")}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(() => {
              const locationOptions = getLocationOptions(theme, t, locationUsageMap);
              return (
                <select
                  value={locationMode === "__CUSTOM__" ? "__CUSTOM__" : locationMode}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__CUSTOM__") {
                      setLocationMode("__CUSTOM__");
                      setCustomLocation("");
                    } else {
                      setLocationMode(v);
                      setCustomLocation("");
                    }
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
              );
            })()}
            {locationMode === "__CUSTOM__" && (
              <div style={{ display: "grid", gap: 6 }}>
                <Input
                  value={customLocation}
                  onChange={(v) => setCustomLocation(v)}
                  placeholder={t("customLocationPlaceholder")}
                />

                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, color: "var(--ui-muted)", fontWeight: 800 }}>
                    {t("customLocationHint")}
                  </div>

                  {(() => {
                    const name = customLocation.trim().replace(/\s+/g, " ");
                    const locationOptions = getLocationOptions(theme, t, locationUsageMap);
                    const alreadyExists = locationOptions.some(
                      (o) => o.value.toLowerCase() === name.toLowerCase() && o.kind !== "custom"
                    );

                    if (alreadyExists && name) {
                      return (
                        <div style={{ fontSize: 11, color: "var(--ui-accent)", fontWeight: 900, whiteSpace: "nowrap" }}>
                          ✓ {t("locationAlreadyExists")}
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (!name) return;

                          ensureLocationSaved(theme, setTheme, name);

                          setLeftTab("locations");
                          setLeftEditMode(true);
                          setOpenLocationName(name);
                        }}
                        disabled={!name}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--ui-border)",
                          background: "transparent",
                          color: "var(--ui-text)",
                          fontWeight: 900,
                          cursor: name ? "pointer" : "not-allowed",
                          opacity: name ? 1 : 0.5,
                          whiteSpace: "nowrap",
                        }}
                        title={t("saveCustomLocationTitle")}
                      >
                        {t("saveAsLocation")}
                      </button>
                    );
                  })()}
                </div>
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
                        onClick={onRecallLocationEdit}
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
                    value={opponentName}
                    onChange={(v) => setFormOpponent(composeOpponentInfo(opponentMode, v))}
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
                  allowZero={false}
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
                            }
                          } catch (err) {
                            console.error("Auto-Reisezeit error:", err);
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
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, padding: 12, paddingTop: 0, alignItems: "center", flexWrap: "wrap" }}>
        <Button onClick={upsertSession}>
          {editingSessionId ? t("saveChanges") : t("addEvent")}
        </Button>
        <Button variant="outline" onClick={resetForm}>{t("reset")}</Button>

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
  );
}