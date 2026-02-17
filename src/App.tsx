import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import type { Lang } from "./i18n/types";
import type {
  CalendarEvent as Session,
  Coach,
  GroupId,
  Player,
  Position,
  ThemeSettings,
  WeekPlan,
} from "./state/types";
import { makeT, makeTF } from "./i18n/translate";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Select } from "./components/ui/Select";
import { Modal } from "./components/ui/Modal";
import { segBtn } from "./components/ui/segBtn";
import { CalendarPane } from "./components/layout/CalendarPane";
import { ConfirmModal, EventEditorModal, NewWeekModal, ThemeSettingsModal } from "./components/modals";
import type { NewWeekMode } from "./components/modals/NewWeekModal";
import { useDndPlan } from "./hooks/useDndPlan";
import { useConfirmDialog } from "./hooks/useConfirmDialog";
import { useRightSidebarPersistence } from "./hooks/useRightSidebarPersistence";
import { usePersistedState } from "./hooks/usePersistedState";
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
  PRINT_GROUP_ORDER,
} from "./state/playerGrouping";
import {
  dbbDobMatchesBirthDate,
  enrichPlayersWithBirthFromDBBTA,
  hasAnyTna,
  primaryTna,
} from "./state/playerMeta";
import { LAST_PLAN_STORAGE_KEY, STAFF_STORAGE_KEY, THEME_STORAGE_KEY } from "./state/storageKeys";
import { DEFAULT_STAFF, safeParseStaff } from "./state/staffPersistence";
import { migrateLegacyBlueTheme, safeParseTheme } from "./state/themePersistence";
import { DEFAULT_THEME } from "./state/themeDefaults";
import { applyThemeToCssVars } from "./themes/cssVars";
import { debounce } from "./utils/async";
import {
  addDaysISO,
  addMinutesToHHMM,
  dateToDDMMYYYY_DOTS,
  dateToShortDE,
  isoWeekMonday,
  kwLabelFromPlan,
  normalizeDash,
  splitTimeRange,
  weekdayOffsetFromDEShort,
  weekdayShortLocalized,
  weekdayShortDE,
} from "./utils/date";
import {
  computeConflictsBySession,
  isGameInfo,
  isGameSession,
  normalizeOpponentInfo,
  sessionsOverlap,
} from "./utils/session";
import {
  ensureLocationSaved,
  getCachedTravelMinutes,
  getLocationOptions,
  resolveLocationAddress,
  resolveLocationPlaceId,
  setCachedTravelMinutes,
  splitAddressLines,
} from "./utils/locations";
import { fetchPlaceDetails, fetchPlacePredictions, fetchTravelMinutes, generateSessionToken } from "./utils/mapsApi";
import { buildPreviewPages, buildPrintPages, type PrintPage } from "./utils/printExport";
import { normalizeYearColor, pickTextColor } from "./utils/color";
import { downloadJson } from "./utils/json";
import { randomId } from "./utils/id";
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

type SidebarModule = "calendar" | "preview" | "maps" | "none";

type ProfilePayload = {
  rosterMeta: { season: string; ageGroups: unknown };
  players: Player[];
  coaches: Coach[];
  locations: NonNullable<ThemeSettings["locations"]>;
};

type SavedProfile = {
  id: string;
  name: string;
  payload: ProfilePayload;
};

const PROFILES_STORAGE_KEY = "ubc_planner_profiles_v1";
const ACTIVE_PROFILE_STORAGE_KEY = "ubc_planner_active_profile_v1";

function safeParseProfiles(raw: string | null): SavedProfile[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedProfile => {
      if (!entry || typeof entry !== "object") return false;
      const e = entry as Record<string, unknown>;
      return typeof e.id === "string" && typeof e.name === "string" && typeof e.payload === "object";
    });
  } catch {
    return [];
  }
}

function RightSidebarModuleSelect({
  value,
  onChange,
  t,
}: {
  value: SidebarModule;
  onChange: (v: SidebarModule) => void;
  t: (k: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SidebarModule)}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid var(--ui-border)",
        background: "var(--ui-panel)",
        color: "var(--ui-text)",
        fontWeight: 900,
      }}
    >
      <option value="calendar">{t("calendar")}</option>
      <option value="preview">{t("preview")}</option>
      <option value="maps">{t("maps")}</option>
      <option value="none">—</option>
    </select>
  );
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

/* ============================================================
   ADDRESS AUTOCOMPLETE (Google Places)
   ============================================================ */

function AddressAutocomplete({
  value,
  placeId,
  onChange,
  placeholder,
}: {
  value: string;
  placeId?: string;
  onChange: (address: string, placeId: string) => void;
  placeholder?: string;
}) {
  type PlaceSuggestion = {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { secondaryText?: { text?: string } };
    };
  };

  const [inputVal, setInputVal] = React.useState(value);
  const [predictions, setPredictions] = React.useState<PlaceSuggestion[]>([]);
  const [sessionToken] = React.useState(() => generateSessionToken());
  const [loading, setLoading] = React.useState(false);
  const [showPredictions, setShowPredictions] = React.useState(false);

  React.useEffect(() => {
    setInputVal(value);
  }, [value]);

  const fetchPredictions = React.useMemo(
    () =>
      debounce(async (input: string) => {
        if (!input.trim()) {
          setPredictions([]);
          return;
        }
        try {
          setLoading(true);
          const res = await fetchPlacePredictions(input, sessionToken);
          setPredictions(res.suggestions ?? []);
        } catch (err) {
          console.error("Places Autocomplete error:", err);
          setPredictions([]);
        } finally {
          setLoading(false);
        }
      }, 400),
    [sessionToken]
  );

  function handleInputChange(v: string) {
    setInputVal(v);
    setShowPredictions(true);
    fetchPredictions(v);
  }

  async function handleSelectPrediction(pred: PlaceSuggestion) {
    try {
      setLoading(true);
      const pId = pred.placePrediction?.placeId ?? "";
      const details = await fetchPlaceDetails(pId, sessionToken);
      onChange(details.formattedAddress ?? "", pId);
      setInputVal(details.formattedAddress ?? "");
      setPredictions([]);
      setShowPredictions(false);
    } catch (err) {
      console.error("Place Details error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <Input
        value={inputVal}
        onChange={handleInputChange}
        placeholder={placeholder ?? "..."}
      />
      {loading && (
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--ui-muted)" }}>
          ...
        </div>
      )}
      {showPredictions && predictions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--ui-bg)",
            border: "1px solid var(--ui-border)",
            borderRadius: 8,
            marginTop: 4,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {predictions.map((pred, idx) => {
            const text = pred.placePrediction?.text?.text ?? "";
            const desc = pred.placePrediction?.structuredFormat?.secondaryText?.text ?? "";
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPrediction(pred)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  borderBottom: idx < predictions.length - 1 ? "1px solid var(--ui-border)" : "none",
                  fontSize: 13,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ui-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontWeight: 600 }}>{text}</div>
                {desc && <div style={{ fontSize: 11, color: "var(--ui-muted)", marginTop: 2 }}>{desc}</div>}
              </button>
            );
          })}
        </div>
      )}
      {placeId && (
        <div style={{ fontSize: 10, color: "var(--ui-muted)", marginTop: 4 }}>
          ID: {placeId.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LEFT LOCATIONS VIEW (with edit mode)
   ============================================================ */

function LeftLocationsView({
  theme,
  setTheme,
  editMode,
  openLocationName,
  setOpenLocationName,
  t,
}: {
  theme: ThemeSettings;
  setTheme: (t: ThemeSettings) => void;
  editMode: boolean;
  openLocationName: string | null;
  setOpenLocationName: (v: string | null) => void;
  t: (k: string) => string;
}) {
  // Wenn editMode AN: nutze bestehendes LocationsPanel (inkl. Autocomplete)
  if (editMode) {
    return <LocationsPanel theme={theme} setTheme={setTheme} t={t} />;
  }

  const L = theme.locations ?? {};
  const locs = L.locations ?? {};
  const defs = L.definitions ?? {};

  const names = Object.keys(locs).sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{t("locations")}</div>
      <div style={{ color: "var(--ui-muted)", fontSize: 13, fontWeight: 800 }}>
        {t("locationsHintExpand")}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {names.map((name) => {
          const isOpen = openLocationName === name;
          const addr = locs[name]?.address ?? "";
          const def = defs[name] ?? { abbr: "", name: name, hallNo: "" };

          return (
            <div
              key={name}
              style={{
                border: "1px solid var(--ui-border)",
                borderRadius: 14,
                background: "var(--ui-card)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenLocationName(isOpen ? null : name)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  color: "var(--ui-text)",
                  padding: "12px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 950, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {def.name || name}
                </div>
                <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>
                  {def.abbr ? def.abbr : name}
                </div>
                {def.hallNo ? (
                  <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>
                    Halle {def.hallNo}
                  </div>
                ) : null}
                <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>{isOpen ? "▲" : "▼"}</div>
              </button>

              {isOpen && (
                <div style={{ borderTop: "1px solid var(--ui-border)", padding: 12, display: "grid", gap: 6 }}>
                  {addr ? (
                    splitAddressLines(addr).map((line, idx) => (
                      <div key={idx} style={{ fontSize: 12, fontWeight: 800, color: "var(--ui-text)" }}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 900, color: "var(--ui-muted)" }}>{t("locationsNoAddress")}</div>
                  )}

                  {locs[name]?.placeId ? (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--ui-muted)", fontWeight: 900 }}>
                      PlaceId: {locs[name].placeId}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {names.length === 0 && <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>{t("locationsEmpty")}</div>}
      </div>
    </div>
  );
}

/* ============================================================
   LOCATION CARD (Progressive Disclosure)
   ============================================================ */

function LocationCard({
  name,
  def,
  isPreset,
  locData,
  onToggle,
  open,
  onRemove,
  onDefChange,
  onAddressChange,
  t,
}: {
  name: string;
  def: { abbr: string; name: string; hallNo?: string };
  isPreset: boolean;
  locData: { address: string; placeId?: string };
  open: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onDefChange: (next: { abbr: string; name: string; hallNo?: string }) => void;
  onAddressChange: (addr: string, placeId: string) => void;
  t: (k: string) => string;
}) {
  const hasMaps = Boolean(locData.placeId);

  return (
    <div
      style={{
        border: "1px solid var(--ui-border)",
        borderRadius: 14,
        background: "var(--ui-card)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "var(--ui-text)",
          cursor: "pointer",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {def.name || name}
          </div>
          <div style={{ fontSize: 12, color: "var(--ui-muted)", fontWeight: 800, marginTop: 2 }}>
            {def.abbr ? `${t("abbr")}: ${def.abbr}` : `${t("abbr")}: —`}
            {def.hallNo ? `  •  ${t("hall")} ${def.hallNo}` : ""}
            {hasMaps ? `  •  ${t("maps")} ✓` : `  •  ${t("maps")} —`}
          </div>
        </div>

        <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>{open ? "▲" : "▼"}</div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--ui-border)", padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {t("label")}
              </div>
              <Input value={def.name} onChange={(v) => onDefChange({ ...def, name: v })} placeholder={t("locationNameExample")} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {t("abbreviation")}
              </div>
              <Input value={def.abbr} onChange={(v) => onDefChange({ ...def, abbr: v })} placeholder={t("abbrExample")} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {t("hallNumber")}
              </div>
              <Input value={def.hallNo ?? ""} onChange={(v) => onDefChange({ ...def, hallNo: v })} placeholder={t("optional")} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
              {t("addressGoogleAutocomplete")}
            </div>
            <AddressAutocomplete
              value={locData.address}
              placeId={locData.placeId}
              onChange={onAddressChange}
              placeholder={t("searchAddress")}
            />
          </div>

          {!isPreset && onRemove && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,.55)",
                  background: "transparent",
                  color: "#ef4444",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {t("remove")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LOCATIONS PANEL
   ============================================================ */

function LocationsPanel({
  theme,
  setTheme,
  t,
}: {
  theme: ThemeSettings;
  setTheme: (t: ThemeSettings) => void;
  t: (k: string) => string;
}) {
  const loc = theme.locations ?? {};

  function setHomeAddress(address: string, placeId: string) {
    setTheme({
      ...theme,
      locations: { ...(theme.locations ?? {}), homeAddress: address, homePlaceId: placeId },
    });
  }

  function setLocationAddress(name: string, address: string, placeId: string) {
    const locs = theme.locations?.locations ?? {};
    setTheme({
      ...theme,
      locations: {
        ...(theme.locations ?? {}),
        locations: { ...locs, [name]: { address, placeId } },
      },
    });
  }

  function removeLocation(name: string) {
    const locs = { ...(theme.locations?.locations ?? {}) };
    delete locs[name];
    setTheme({ ...theme, locations: { ...(theme.locations ?? {}), locations: locs } });
  }

  function getDef(name: string) {
    const defs = theme.locations?.definitions ?? {};
    return defs[name] ?? { abbr: name, name, hallNo: "" };
  }
  
  function setDef(name: string, next: { abbr: string; name: string; hallNo?: string }) {
    setTheme({
      ...theme,
      locations: {
        ...(theme.locations ?? {}),
        definitions: {
          ...(theme.locations?.definitions ?? {}),
          [name]: next,
        },
      },
    });
  }

  // List of custom locations (user-defined, not BSH/SHP/Seminarraum)
  const presetNames = ["BSH", "SHP", "Seminarraum"];
  const customLocationNames = Object.keys(loc.locations ?? {}).filter((n) => !presetNames.includes(n));

  // State for which location is expanded
  const [openName, setOpenName] = React.useState<string | null>(null);

  // Combined list: presets + custom, sorted
  const allNames = [
    ...presetNames,
    ...customLocationNames.sort((a, b) => a.localeCompare(b)),
  ];

  return (
    <div style={{ padding: 12, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("home")}</div>
        <AddressAutocomplete
          value={loc.homeAddress ?? ""}
          placeId={loc.homePlaceId}
          onChange={setHomeAddress}
          placeholder={t("startPointOptional")}
        />
      </div>

      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("trainingAndGameLocations")}</div>

        {/* Progressive Disclosure: Card-Liste */}
        <div style={{ display: "grid", gap: 10 }}>
          {allNames.map((name) => {
            const isPreset = presetNames.includes(name);
            const locData = loc.locations?.[name] ?? { address: "", placeId: undefined };
            const def = getDef(name);

            return (
              <LocationCard
                key={name}
                name={name}
                def={def}
                isPreset={isPreset}
                locData={locData}
                open={openName === name}
                onToggle={() => setOpenName(openName === name ? null : name)}
                onRemove={!isPreset ? () => removeLocation(name) : undefined}
                onDefChange={(next) => setDef(name, next)}
                onAddressChange={(addr, pId) => setLocationAddress(name, addr, pId)}
                t={t}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   SETTINGS MODAL (Theme)
   ============================================================ */

/* ============================================================
   DND COMPONENTS
   ============================================================ */

export const DraggablePlayerRow = React.memo(function DraggablePlayerRow({
  player,
  trainingCount,
  groupBg,
  isBirthday,
  t,
}: {
  player: Player;
  trainingCount: number;
  groupBg: Record<GroupId, string>;
  isBirthday: boolean;
  t: (k: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `player:${player.id}`,
    data: { type: "player", playerId: player.id },
  });

  const style: CSSProperties = {
    cursor: "grab",
    opacity: isDragging ? 0.6 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    boxShadow: isDragging
      ? "0 10px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)"
      : "none",
    zIndex: isDragging ? 40 : undefined,
  };

  const group = getPlayerGroup(player);
  const bg = normalizeYearColor(player.yearColor) ?? groupBg[group];
  const text = pickTextColor(bg);
  const subText = text === "#fff" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.70)";

  const pos = (player.positions ?? []).join("/") || "—";
  const isTbd = player.id === "TBD";

  const taOk = hasAnyTna(player);
  const taDobCheck = isTbd ? { ok: true } : dbbDobMatchesBirthDate(player);

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 12,
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: bg,
        }}
        title={
          isTbd
            ? t("placeholder")
            : (player.lizenzen ?? [])
                .map((l) => `${String(l.typ).toUpperCase()}: ${l.tna}`)
                .join(" | ") || t("noTaTnaSaved")
        }
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 900,
              color: text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={!taDobCheck.ok ? taDobCheck.reason : undefined}
          >
            {player.name}{isBirthday ? " 🎂" : ""}{!taDobCheck.ok ? " ⚠️" : ""}
          </div>
          <div style={{ fontSize: 12, color: subText, fontWeight: 800 }}>
            {isTbd
              ? t("placeholder")
              : `${player.primaryYouthTeam || ""}${
                  player.primarySeniorTeam ? ` • ${player.primarySeniorTeam}` : ""
                }`}
          </div>
        </div>

        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          {isTbd ? (
            <>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>TBD</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>{t("groupTbdLong")}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>{pos}</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>{trainingCount}x</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>
                TA {taOk ? "✓" : "—"}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

DraggablePlayerRow.displayName = "DraggablePlayerRow";

function DroppableSessionShell({
  session,
  children,
  hasHistoryFlag = false,
  isEditing = false,
  isSelected = false,
  onSelect,
}: {
  session: Session;
  children: ReactNode;
  hasHistoryFlag?: boolean;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelect?: (session: Session) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `session:${session.id}`,
    data: { type: "session", sessionId: session.id },
  });

  const emphasize = isEditing || isSelected;
  const baseBorder = emphasize ? "2px solid var(--ui-accent)" : (hasHistoryFlag ? "1px solid #ef4444" : `1px solid var(--ui-border)`);
  const baseBg = emphasize ? "rgba(59,130,246,0.25)" : (hasHistoryFlag ? "rgba(239,68,68,0.08)" : "var(--ui-card)");

  return (
    <div
      id={`session_card_${session.id}`}
      ref={setNodeRef}
      style={{
        border: isOver ? `2px dashed var(--ui-soft)` : baseBorder,
        borderRadius: 14,
        padding: 12,
        background: baseBg,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(session);
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Optional right pane: Calendar week view (DnD)
   ============================================================ */

function ParticipantCard({
  player,
  onRemove,
  groupBg,
  isBirthday,
  t,
}: {
  player: Player;
  onRemove: () => void;
  groupBg: Record<GroupId, string>;
  isBirthday: boolean;
  t: (k: string) => string;
}) {
  const group = getPlayerGroup(player);
  const bg = normalizeYearColor(player.yearColor) ?? groupBg[group];
  const text = pickTextColor(bg);

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 12,
        padding: "8px 10px",
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        background: bg,
        alignItems: "center",
      }}
    >
      <div style={{ fontWeight: 900, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {player.name}{isBirthday ? " 🎂" : ""}
      </div>
      <button
        onClick={onRemove}
        style={{
          border: "1px solid rgba(255,255,255,0.6)",
          background: "rgba(255,255,255,0.25)",
          color: text,
          borderRadius: 10,
          padding: "6px 10px",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        {t("remove")}
      </button>
    </div>
  );
}

/* ============================================================
   PRINT VIEW (kept)
   ============================================================ */

function exportShortName(p: Player): string {
  if (p.id === "TBD") return "TBD";
  const fn = (p.firstName ?? "").trim();
  const ln = (p.lastName ?? "").trim();

  if (fn || ln) {
    const initial = ln ? ln[0].toUpperCase() : "";
    const first = fn ? fn : (p.name ?? "").split(" ")[0] ?? "";
    return (first || "").trim() + (initial ? ` ${initial}` : "");
  }

  const parts = String(p.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}`;
}

function PrintView({
  plan,
  playerById,
  groupBg,
  coaches,
  birthdayPlayerIds,
  t,
}: {
  plan: WeekPlan;
  playerById: Map<string, Player>;
  groupBg: Record<GroupId, string>;
  coaches: Coach[];
  birthdayPlayerIds: Set<string>;
  t: (k: string) => string;
}) {
  const logoUrl = "https://ubc.ms/wp-content/uploads/2022/06/ubc-logo.png";

  const mondayDate =
    plan.sessions.find((s) => (s.day || "").toLowerCase().startsWith("mo"))?.date ??
    plan.sessions[0]?.date ??
    new Date().toISOString().slice(0, 10);

  const kwText = kwLabelFromPlan(plan);

  function sessionLabel(s: Session) {
    if (s.kaderLabel) return s.kaderLabel;
    const day = s.day || weekdayShortDE(s.date);
    const t = (s.teams ?? []).join("+").replaceAll("1RLH", "RLH");
    return `${day}-${t || "Event"}`;
  }

  function exportDateCell(s: Session) {
    const day = (s.day || "").toLowerCase();
    if (day.startsWith("mo")) return dateToDDMMYYYY_DOTS(s.date);
    return dateToShortDE(s.date);
  }

  function sortedParticipantsForSession(s: Session): Player[] {
    const players: Player[] = (s.participants ?? [])
      .map((pid) => playerById.get(pid))
      .filter(Boolean) as Player[];

    const byGroup: Record<GroupId, Player[]> = {
      "2007": [],
      "2008": [],
      "2009": [],
      Herren: [],
      TBD: [],
    };

    for (const p of players) byGroup[getPlayerGroup(p)].push(p);
    for (const gid of PRINT_GROUP_ORDER) byGroup[gid].sort((a, b) => a.name.localeCompare(b.name, "de"));

    return PRINT_GROUP_ORDER.flatMap((gid) => byGroup[gid]);
  }

  const rosterColumns = plan.sessions.map((s) => ({
    id: s.id,
    label: sessionLabel(s),
    players: sortedParticipantsForSession(s),
  }));

  const maxRows = Math.max(0, ...rosterColumns.map((c) => c.players.length));
  const hasTbd = plan.sessions.some((s) => (s.participants ?? []).includes("TBD"));

  return (
    <div id="print-root" style={{ padding: 18, background: "white", color: "#111" }}>
      <style>
        {`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            #app-root { display: none !important; }
            #print-root { display: block !important; }
            @page { size: A4 portrait; margin: 10mm; }
          }
          @media screen {
            #print-root { display: none; }
          }

          table { border-collapse: collapse; width: 100%; table-layout: auto; }
          th, td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            font-size: 11px;
            vertical-align: middle;
            text-align: center;
            white-space: nowrap;
          }
          th { background: #f3f4f6; font-weight: 900; }

          .infoCol {
            white-space: normal !important;
            word-break: break-word;
            text-align: left !important;
            min-width: 260px;
          }
        `}
      </style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logoUrl} alt="UBC" style={{ height: 38 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>UBC Münster</div>
            <div style={{ fontSize: 11, fontWeight: 800 }}>{t("seasonTrainingOverview")}</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 900 }}>{dateToDDMMYYYY_DOTS(mondayDate)}</div>
          <div style={{ fontSize: 11, fontWeight: 900 }}>{t("trainingWeek")}: {kwText}</div>
          <div style={{ fontSize: 10, color: "#374151", fontWeight: 700 }}>
            BSH = Ballsporthalle; SHP = Sporthalle Pascal; Seminarraum = Seminarraum
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>{t("weekOverview")}</div>
      <div style={{ marginTop: 6 }}>
        <table>
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("day")}</th>
              <th>{t("time")}</th>
              <th>{t("teams")}</th>
              <th>{t("hall")}</th>
              <th>{t("roster")}</th>
              <th className="infoCol">{t("info")}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              return plan.sessions.map((s, i, arr) => {
                const prev = arr[i - 1];
                const sameDayAsPrev = prev ? prev.date === s.date : false;

                const dayLower = (s.day || "").toLowerCase();
                const isWeekend = dayLower.startsWith("sa") || dayLower.startsWith("so");

                const infoText = (s.info ?? "").trim();
                const isGame = infoText.toLowerCase().startsWith("vs") || infoText.startsWith("@");

                const topBorder =
                  !sameDayAsPrev ? (isWeekend ? "2px solid #111" : "1px solid #bbb") : "1px solid #ddd";

                return (
                  <tr
                    key={s.id}
                    style={{
                      background: isGame ? "#F59E0B" : "transparent",
                      color: "#111",
                    }}
                  >
                    <td style={{ borderTop: topBorder }}>{sameDayAsPrev ? "" : exportDateCell(s)}</td>
                    <td style={{ borderTop: topBorder }}>{sameDayAsPrev ? "" : s.day}</td>
                    <td style={{ borderTop: topBorder }}>{s.time}</td>
                    <td style={{ borderTop: topBorder }}>{(s.teams ?? []).join(" / ")}</td>
                    <td style={{ borderTop: topBorder }}>{s.location}</td>
                    <td style={{ borderTop: topBorder }}>{sessionLabel(s)}</td>
                    <td className="infoCol" style={{ borderTop: topBorder }}>{s.info ?? ""}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>{t("rosterLists")}</div>
      <div style={{ marginTop: 6 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              {rosterColumns.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }, (_, i) => i).map((rowIdx) => (
              <tr key={rowIdx}>
                <td style={{ fontWeight: 900 }}>{rowIdx + 1}</td>
                {rosterColumns.map((c) => {
                  const p = c.players[rowIdx];
                  if (!p) return <td key={c.id}></td>;

                  const gid = getPlayerGroup(p);
                  const bg = normalizeYearColor(p.yearColor) ?? groupBg[gid];
                  const text = pickTextColor(bg);

                  return (
                    <td
                      key={c.id}
                      style={{
                        background: bg,
                        color: text,
                        fontWeight: 900,
                      }}
                    >
                          {exportShortName(p)}{birthdayPlayerIds.has(p.id) ? " 🎂" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {hasTbd && (
          <div style={{ marginTop: 6, fontSize: 10, color: "#374151", fontWeight: 700 }}>
            {t("tbdLegend")}
          </div>
        )}
      </div>

      {(() => {
        const games = plan.sessions.filter((s) => {
          const info = (s.info ?? "").trim();
          const low = info.toLowerCase();
          return low.startsWith("vs") || info.startsWith("@");
        });

        function getOpponent(info: string): { mode: "HOME" | "AWAY"; opponent: string } {
          const t = (info ?? "").trim();
          if (t.startsWith("@")) return { mode: "AWAY", opponent: t.slice(1).trim() || "—" };
          const low = t.toLowerCase();
          if (low.startsWith("vs")) return { mode: "HOME", opponent: t.slice(2).trim() || "—" };
          return { mode: "HOME", opponent: t || "—" };
        }

        function jerseyForTeam(p: Player, team: string): string {
          const jb = p.jerseyByTeam ?? {};
          const v = jb[team];
          if (typeof v === "number" && Number.isFinite(v)) return String(v);
          if (v === 0) return "0";
          return "";
        }

        function taForPlayer(p: Player): string {
          // prefer DBB, fallback NBBL, fallback any
          const list = p.lizenzen ?? [];
          const dbb = list.find((x) => String(x.typ).toUpperCase() === "DBB")?.tna;
          const nbbl = list.find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna;
          return (dbb ?? nbbl ?? list[0]?.tna ?? "").trim();
        }

        if (!games.length) return null;

        return (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 12 }}>{t("gameExports")}</div>

            <div style={{ marginTop: 8, display: "grid", gap: 12 }}>
              {games.map((g) => {
                const team = (g.teams ?? [])[0] ?? "—";
                const opp = getOpponent(g.info ?? "");
                const title = `${dateToShortDE(g.date)} | ${team} ${opp.mode === "AWAY" ? "@ " : "vs "}${opp.opponent}`;

                const players: Player[] = (g.participants ?? [])
                  .map((pid) => playerById.get(pid))
                  .filter(Boolean) as Player[];

                // sort: jersey (numeric) then name
                players.sort((a, b) => {
                  const ja = parseInt(jerseyForTeam(a, team) || "999", 10);
                  const jb = parseInt(jerseyForTeam(b, team) || "999", 10);
                  if (ja !== jb) return ja - jb;
                  return a.name.localeCompare(b.name, "de");
                });

                return (
                  <div key={g.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900, fontSize: 11 }}>{title}</div>
                      <div style={{ fontWeight: 800, fontSize: 11, color: "#374151" }}>
                        {g.time} | {g.location}
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 28 }}>#</th>
                            <th style={{ width: 54 }}>{t("jersey")}</th>
                            <th>{t("lastName")}</th>
                            <th>{t("firstName")}</th>
                            <th style={{ width: 120 }}>TA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p, idx) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 900 }}>{idx + 1}</td>
                              <td>{jerseyForTeam(p, team)}</td>
                              <td style={{ textAlign: "left" }}>{(p.lastName ?? "").trim()}</td>
                              <td style={{ textAlign: "left" }}>{(p.firstName ?? "").trim()}</td>
                              <td>{taForPlayer(p)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 10, color: "#374151", fontWeight: 800 }}>
                      {t("coaches")}: {(coaches ?? []).map((c) => `${c.role}: ${c.name}${c.license ? ` (${c.license})` : ""}`).join(" | ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>{t("coaches")}</div>
      <div style={{ marginTop: 6, fontSize: 11 }}>
        {(coaches ?? []).map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #eee", padding: "4px 0" }}>
            <div style={{ fontWeight: 800 }}>{c.role}: {c.name}</div>
            <div style={{ color: "#374151", fontWeight: 800 }}>{c.license ? `${t("license")} ${c.license}` : `${t("license")} —`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   COACHES: persistence + defaults
   ============================================================ */


/* ============================================================
   NEW WEEK MODAL
   ============================================================ */

/* ============================================================
   PRINT PREVIEW & EXPORT HELPERS
   ============================================================ */

function ExportPreview({ pages, t }: { pages: PrintPage[]; t: (k: string) => string }) {
  const [currentPage, setCurrentPage] = React.useState(0);

  if (pages.length === 0) {
    return (
      <div style={{ padding: 16, color: "#999" }}>
        {t("previewNoPages")}
      </div>
    );
  }

  const page = pages[currentPage];
  const canPrev = currentPage > 0;
  const canNext = currentPage < pages.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Navigation header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #444",
          backgroundColor: "#2a2a2a",
        }}
      >
        <button
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev}
          style={{
            padding: "6px 12px",
            backgroundColor: canPrev ? "#3f3f3f" : "#2a2a2a",
            border: "1px solid #555",
            color: canPrev ? "#fff" : "#666",
            cursor: canPrev ? "pointer" : "not-allowed",
            borderRadius: 4,
          }}
        >
          ◀
        </button>
        <span style={{ color: "#ddd", fontSize: 14 }}>
          {t("previewPageLabel")} {currentPage + 1} {t("previewOfLabel")} {pages.length}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
          disabled={!canNext}
          style={{
            padding: "6px 12px",
            backgroundColor: canNext ? "#3f3f3f" : "#2a2a2a",
            border: "1px solid #555",
            color: canNext ? "#fff" : "#666",
            cursor: canNext ? "pointer" : "not-allowed",
            borderRadius: 4,
          }}
        >
          ▶
        </button>
      </div>

      {/* Page content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#fff",
          padding: 16,
        }}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}


/* ============================================================
   RIGHT SIDEBAR
   ============================================================ */

function RightSidebar({
  open,
  layout,
  topModule,
  bottomModule,
  splitPct,
  onChangeLayout,
  onChangeTop,
  onChangeBottom,
  onChangeSplitPct,
  context,
  t,
}: {
  open: boolean;
  layout: "single" | "split";
  topModule: SidebarModule;
  bottomModule: SidebarModule;
  splitPct: number;
  onChangeLayout: (v: "single" | "split") => void;
  onChangeTop: (v: SidebarModule) => void;
  onChangeBottom: (v: SidebarModule) => void;
  onChangeSplitPct: (v: number) => void;
  context: {
    renderCalendar?: () => React.ReactNode;
    previewPages: PrintPage[];
  };
  t: (k: string) => string;
}) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const el = document.getElementById("rightSidebarSplitRoot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const y = e.clientY - r.top;
      const pct = Math.max(0.2, Math.min(0.8, y / r.height));
      onChangeSplitPct(pct);
    };

    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onChangeSplitPct]);

  if (!open) return null;

  const renderModule = (m: SidebarModule) => {
    if (m === "none") return <div style={{ color: "var(--ui-muted)", padding: 20 }}>{t("rightNoModule")}</div>;
    if (m === "calendar") return context.renderCalendar ? context.renderCalendar() : null;
    if (m === "preview")
      return <ExportPreview pages={context.previewPages} t={t} />;
    if (m === "maps")
      return (
        <div style={{ padding: 10, color: "var(--ui-muted)" }}>
          {t("rightMapsPlaceholder")}
        </div>
      );
    return null;
  };

  return (
    <div
      style={{
        borderLeft: "1px solid var(--ui-border)",
        background: "var(--ui-panel)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minWidth: 360,
      }}
    >
      {/* Header */}
      <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 950 }}>{t("rightAreaTitle")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => onChangeLayout(layout === "split" ? "single" : "split")}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--ui-border)", background: "transparent", color: "var(--ui-text)", fontWeight: 900, cursor: "pointer" }}
          >
            {layout === "split" ? t("layoutSplit") : t("layoutSingle")}
          </button>
        </div>
      </div>

      {/* Body */}
      {layout === "single" ? (
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center" }}>
            <RightSidebarModuleSelect value={topModule} onChange={onChangeTop} t={t} />
          </div>
          <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(topModule)}</div>
        </div>
      ) : (
        <div id="rightSidebarSplitRoot" style={{ position: "relative", minHeight: 0, display: "grid", gridTemplateRows: `${splitPct}fr 10px ${(1 - splitPct)}fr` }}>
          {/* Top */}
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center" }}>
              <RightSidebarModuleSelect value={topModule} onChange={onChangeTop} t={t} />
            </div>
            <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(topModule)}</div>
          </div>

          {/* Divider */}
          <div
            onMouseDown={() => setDragging(true)}
            style={{
              cursor: "row-resize",
              background: "rgba(255,255,255,0.04)",
              borderTop: "1px solid var(--ui-border)",
              borderBottom: "1px solid var(--ui-border)",
            }}
            title={t("rightResizeTitle")}
          />

          {/* Bottom */}
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center" }}>
              <RightSidebarModuleSelect value={bottomModule} onChange={onChangeBottom} t={t} />
            </div>
            <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(bottomModule)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   GOOGLE MAPS HELPERS
   ============================================================ */

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

  const [profiles, setProfiles] = useState<SavedProfile[]>(() =>
    safeParseProfiles(typeof window !== "undefined" ? localStorage.getItem(PROFILES_STORAGE_KEY) : null)
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "" : ""
  );
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const activeProfileName = useMemo(
    () => profiles.find((p) => p.id === activeProfileId)?.name ?? null,
    [profiles, activeProfileId]
  );

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const node = profileMenuRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setProfileMenuOpen(false);
    }
    window.addEventListener("mousedown", onDocMouseDown);
    return () => window.removeEventListener("mousedown", onDocMouseDown);
  }, [profileMenuOpen]);

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

  const staffFileRef = useRef<HTMLInputElement | null>(null);

  /* ============================================================
     HANDLERS (onDrag..., upsert..., export...)
     ============================================================ */

  async function importStaffFile(file: File) {
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
    if (normalized.length) setCoaches(normalized);
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

  useEffect(() => {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (!activeProfileId) {
      localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
  }, [activeProfileId]);

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
      logoUrl: undefined,
    });
  }, [plan, players, coaches, theme]);

  const previewPages = useMemo(() => {
    return buildPreviewPages({
      sessions: plan?.sessions ?? [],
      players,
      coaches,
      clubName: theme.clubName,
      locale: theme.locale,
      locations: theme.locations ?? DEFAULT_THEME.locations!,
      logoUrl: undefined,
    });
  }, [plan, players, coaches, theme]);

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

  const TEAM_OPTIONS = ["U18", "NBBL", "HOL", "1RLH"];

  const LOCATION_PRESETS = ["BSH", "SHP", "Seminarraum"] as const;
  type LocationMode = string; // any location name or "__CUSTOM__"

  type EditorState = {
    editingSessionId: string | null;
    formDate: string;
    formTeams: string[];
    locationMode: LocationMode;
    customLocation: string;
    formStart: string;
    formDuration: number;
    formOpponent: string;
    formWarmupMin: number;
    formTravelMin: number;
  };

  const [editorState, setEditorState] = useState<EditorState>({
    editingSessionId: null,
    formDate: new Date().toISOString().slice(0, 10),
    formTeams: ["NBBL"],
    locationMode: "BSH",
    customLocation: "",
    formStart: "18:00",
    formDuration: 90,
    formOpponent: "",
    formWarmupMin: 30,
    formTravelMin: 0,
  });

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

  function setEditorField<K extends keyof EditorState>(key: K, value: React.SetStateAction<EditorState[K]>) {
    setEditorState((prev) => ({
      ...prev,
      [key]: typeof value === "function" ? (value as (p: EditorState[K]) => EditorState[K])(prev[key]) : value,
    }));
  }

  const setEditingSessionId = (value: React.SetStateAction<string | null>) => setEditorField("editingSessionId", value);
  const setFormDate = (value: React.SetStateAction<string>) => setEditorField("formDate", value);
  const setFormTeams = (value: React.SetStateAction<string[]>) => setEditorField("formTeams", value);
  const setLocationMode = (value: React.SetStateAction<LocationMode>) => setEditorField("locationMode", value);
  const setCustomLocation = (value: React.SetStateAction<string>) => setEditorField("customLocation", value);
  const setFormStart = (value: React.SetStateAction<string>) => setEditorField("formStart", value);
  const setFormDuration = (value: React.SetStateAction<number>) => setEditorField("formDuration", value);
  const setFormOpponent = (value: React.SetStateAction<string>) => setEditorField("formOpponent", value);
  const setFormWarmupMin = (value: React.SetStateAction<number>) => setEditorField("formWarmupMin", value);
  const setFormTravelMin = (value: React.SetStateAction<number>) => setEditorField("formTravelMin", value);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const opponentInputRef = useRef<HTMLInputElement | null>(null);
  const editorTopRef = useRef<HTMLDivElement | null>(null);

  // Default-Logik:
  // - sobald "vs" oder "@" erkannt wird: Treffen+Warm-up default 90 min
  // - bei "@": zusätzlich Reisezeit default 90 min, bei "vs": Reisezeit = 0
  useEffect(() => {
    const info = normalizeOpponentInfo(formOpponent);
    const game = isGameInfo(info);
    const away = info.startsWith("@");

    setEditorState((prev) => {
      let nextWarmupMin = prev.formWarmupMin;
      let nextTravelMin = prev.formTravelMin;

      if (game) {
        if (nextWarmupMin <= 0) nextWarmupMin = 90;

        if (away) {
          if (nextTravelMin <= 0) nextTravelMin = 90;
        } else if (nextTravelMin !== 0) {
          nextTravelMin = 0;
        }
      } else {
        if (nextWarmupMin !== 0) nextWarmupMin = 0;
        if (nextTravelMin !== 0) nextTravelMin = 0;
      }

      if (nextWarmupMin === prev.formWarmupMin && nextTravelMin === prev.formTravelMin) {
        return prev;
      }

      return {
        ...prev,
        formWarmupMin: nextWarmupMin,
        formTravelMin: nextTravelMin,
      };
    });
  }, [formOpponent]);

  function currentLocationValue(): string {
    if (locationMode === "__CUSTOM__") return (customLocation || "").trim() || "—";
    return locationMode;
  }

  function onToggleTeam(t: string) {
    setFormTeams((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function resetForm() {
    setEditingSessionId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTeams(["NBBL"]);
    setLocationMode("BSH");
    setCustomLocation("");
    setFormStart("18:00");
    setFormDuration(90);
    setFormOpponent("");
    setFormWarmupMin(30);
    setFormTravelMin(0);
  }

  function buildSessionFromForm(existingId?: string, keepParticipants?: string[]): Session {
    const info = normalizeOpponentInfo(formOpponent);
    const isGame = isGameInfo(info);
    const dur = isGame ? 120 : formDuration;
    const end = addMinutesToHHMM(formStart, dur);
    const time = `${formStart}–${end}`;

    return {
      id: existingId ?? randomId("sess_"),
      date: formDate,
      day: weekdayShortDE(formDate),
      teams: [...formTeams].sort((a, b) => a.localeCompare(b, "de")),
      time,
      location: currentLocationValue(),
      info: info || null,
      warmupMin: isGame ? Math.max(0, Math.floor(formWarmupMin)) : null,
      travelMin: isGame ? Math.max(0, Math.floor(formTravelMin)) : null,
      participants: keepParticipants ?? [],
    };
  }

  function upsertSession() {
    if (!formDate || formTeams.length === 0) return;

    setPlan((prev) => {
      const next = { ...prev, sessions: [...prev.sessions] };

      if (editingSessionId) {
        const idx = next.sessions.findIndex((s) => s.id === editingSessionId);
        if (idx >= 0) {
          const old = next.sessions[idx];
          const updated = buildSessionFromForm(old.id, old.participants ?? []);
          updated.participants = (updated.participants ?? []).sort(sortParticipants);
          next.sessions[idx] = updated;
        }
      } else {
        next.sessions.push(buildSessionFromForm());
      }

      next.sessions.sort((a, b) => {
        const ad = a.date.localeCompare(b.date);
        if (ad !== 0) return ad;
        return a.time.localeCompare(b.time);
      });

      return next;
    });

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

    setPlan((prev) => ({ ...prev, sessions: prev.sessions.filter((x) => x.id !== sessionId) }));
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
  });

  const currentProfilePayload = useCallback((): ProfilePayload => {
    return {
      rosterMeta,
      players,
      coaches,
      locations: (theme.locations ?? DEFAULT_THEME.locations!) as NonNullable<ThemeSettings["locations"]>,
    };
  }, [rosterMeta, players, coaches, theme.locations]);

  function applyProfile(profile: SavedProfile) {
    setRosterMeta(profile.payload.rosterMeta);
    setPlayers(profile.payload.players);
    setCoaches(profile.payload.coaches);
    setTheme((prev) => ({
      ...prev,
      locations: profile.payload.locations,
    }));
  }

  function createProfile() {
    const name = profileNameInput.trim();
    if (!name) return;
    const id = randomId("profile_");
    const entry: SavedProfile = {
      id,
      name,
      payload: currentProfilePayload(),
    };
    setProfiles((prev) => [...prev, entry]);
    setActiveProfileId(id);
    setProfileNameInput("");
  }

  function updateActiveProfile() {
    if (!activeProfileId) return;
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? {
              ...p,
              name: profileNameInput.trim() || p.name,
              payload: currentProfilePayload(),
            }
          : p
      )
    );
  }

  function deleteActiveProfile() {
    if (!activeProfileId) return;
    setProfiles((prev) => prev.filter((p) => p.id !== activeProfileId));
    setActiveProfileId("");
  }

  function selectProfile(id: string) {
    setActiveProfileId(id);
    const hit = profiles.find((p) => p.id === id);
    if (hit) {
      applyProfile(hit);
      setProfileNameInput(hit.name);
    }
  }

  useEffect(() => {
    if (!activeProfileId) return;
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === activeProfileId);
      if (idx < 0) return prev;
      const nextPayload = currentProfilePayload();
      const cur = prev[idx];
      if (JSON.stringify(cur.payload) === JSON.stringify(nextPayload)) return prev;
      const copy = [...prev];
      copy[idx] = { ...cur, payload: nextPayload };
      return copy;
    });
  }, [activeProfileId, currentProfilePayload]);

  /* ============================================================
     Roster editor: import/export roster.json
     (minimal editor – erweitert später um LP/Trikot/Positions etc.)
     ============================================================ */

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return playerById.get(selectedPlayerId) ?? null;
  }, [selectedPlayerId, playerById]);

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

  const rosterFileRef = useRef<HTMLInputElement | null>(null);

  async function importRosterFile(file: File) {
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

    // Temporary container for rendering (offscreen)
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
      // Render all pages into host
      for (let i = 0; i < exportPages.length; i++) {
        const p = exportPages[i];
        const pageEl = document.createElement("div");
        pageEl.className = "page";
        pageEl.style.width = "820px";
        pageEl.style.minHeight = "1060px";
        pageEl.style.background = "#ffffff";
        pageEl.style.color = "#111";
        pageEl.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
        pageEl.style.boxSizing = "border-box";
        pageEl.style.padding = "20mm";
        pageEl.style.pageBreakAfter = i < exportPages.length - 1 ? "always" : "auto";
        pageEl.innerHTML = p.html;
        host.appendChild(pageEl);
      }

      // Wait for rendering
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger browser print dialog
      window.print();
    } finally {
      document.body.removeChild(host);
    }
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
      <style>{responsiveCss}</style>

      <PrintView
        plan={plan}
        playerById={playerById}
        groupBg={groupBg}
        coaches={coaches}
        birthdayPlayerIds={birthdayPlayerIds}
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
            <div
              className="leftPane"
              style={{
                padding: 16,
                borderRight: `1px solid var(--ui-border)`,
                overflow: "auto",
                background: "var(--ui-panel)",
              }}
            >
              {/* Left Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => { setLeftTab("players"); setLeftEditMode(false); }}
                  style={segBtn(leftTab === "players")}
                >
                  {t("players")}
                </button>
                <button
                  type="button"
                  onClick={() => { setLeftTab("coaches"); setLeftEditMode(false); }}
                  style={segBtn(leftTab === "coaches")}
                >
                  {t("coaches")}
                </button>
                <button
                  type="button"
                  onClick={() => { setLeftTab("locations"); setLeftEditMode(false); }}
                  style={segBtn(leftTab === "locations")}
                >
                  {t("locations")}
                </button>

                <div style={{ marginLeft: "auto" }}>
                  <button
                    type="button"
                    onClick={() => setLeftEditMode((v) => !v)}
                    style={{
                      ...segBtn(false),
                      borderColor: leftEditMode ? "var(--ui-accent)" : "var(--ui-border)",
                      background: leftEditMode ? "rgba(59,130,246,.18)" : "transparent",
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 950,
                    }}
                    title={t("editModeCurrentListTitle")}
                  >
                    {leftEditMode ? t("editModeOn") : t("editModeOff")}
                  </button>
                </div>
              </div>

              {leftTab === "players" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{t("roster")}</div>
                    <Button variant="outline" onClick={() => { setRosterSearch(""); setRosterOpen(true); }} style={{ padding: "8px 10px" }}>
                      {leftEditMode ? t("rosterEdit") : t("rosterShow")}
                    </Button>
                  </div>

                  <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 13, fontWeight: 700 }}>
                    {t("playersPanelHint")}
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
  {/* U18-only */}
  <div style={{ borderRadius: 14 }}>
    <button
      onClick={() => setOpenExtra((prev) => (prev === "U18_ONLY" ? null : "U18_ONLY"))}
      style={{
        width: "100%",
        textAlign: "left",
        border: `1px solid var(--ui-border)`,
        background: "var(--ui-card)",
        color: "var(--ui-text)",
        borderRadius: 14,
        padding: "12px 12px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        fontWeight: 900,
      }}
    >
      <span>{t("groupU18Only")}</span>
      <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
        {u18OnlyPlayers.length} {t("players")}
      </span>
    </button>

    {openExtra === "U18_ONLY" && (
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {u18OnlyPlayers.map((p) => (
          <DraggablePlayerRow
            key={p.id}
            player={p}
            trainingCount={trainingCounts.get(p.id) ?? 0}
            groupBg={groupBg}
            isBirthday={birthdayPlayerIds.has(p.id)}
            t={t}
          />
        ))}
      </div>
    )}
  </div>

  {/* HOL-only */}
  <div style={{ borderRadius: 14 }}>
    <button
      onClick={() => setOpenExtra((prev) => (prev === "HOL_ONLY" ? null : "HOL_ONLY"))}
      style={{
        width: "100%",
        textAlign: "left",
        border: `1px solid var(--ui-border)`,
        background: "var(--ui-card)",
        color: "var(--ui-text)",
        borderRadius: 14,
        padding: "12px 12px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        fontWeight: 900,
      }}
    >
      <span>{t("groupHolOnly")}</span>
      <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
        {holOnlyPlayers.length} {t("players")}
      </span>
    </button>

    {openExtra === "HOL_ONLY" && (
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {holOnlyPlayers.map((p) => (
          <DraggablePlayerRow
            key={p.id}
            player={p}
            trainingCount={trainingCounts.get(p.id) ?? 0}
            groupBg={groupBg}
            isBirthday={birthdayPlayerIds.has(p.id)}
            t={t}
          />
        ))}
      </div>
    )}
  </div>
</div>
<div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {GROUPS.map((g) => {
                      const arr = playersByGroup.get(g.id) ?? [];
                      const isOpen = openGroup === g.id;
                      const groupRightLabel = g.id === "TBD" ? t("groupTbdLong") : `${arr.length} ${t("players")}`;

                      return (
                        <div key={g.id} style={{ borderRadius: 14 }}>
                          <button
                            onClick={() => setOpenGroup((prev) => (prev === g.id ? null : g.id))}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: `1px solid var(--ui-border)`,
                              background: "var(--ui-card)",
                              color: "var(--ui-text)",
                              borderRadius: 14,
                              padding: "12px 12px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              fontWeight: 900,
                            }}
                            >
                            <span>{g.label}</span>
                            <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
                              {g.label} | {groupRightLabel}
                            </span>
                          </button>

                          {isOpen && (
                            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                              {arr.map((p) => (
                                <DraggablePlayerRow
                                  key={p.id}
                                  player={p}
                                  trainingCount={trainingCounts.get(p.id) ?? 0}
                                  groupBg={groupBg}
                                  isBirthday={birthdayPlayerIds.has(p.id)}
                                  t={t}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {leftTab === "coaches" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{t("coaches")}</div>
                    {leftEditMode && (
                      <Button variant="outline" onClick={addCoach} style={{ padding: "8px 10px" }}>
                        + {t("coach")}
                      </Button>
                    )}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="outline" onClick={exportStaff} style={{ padding: "8px 10px" }}>
                      {t("export")} staff.json
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => staffFileRef.current?.click()}
                      style={{ padding: "8px 10px" }}
                    >
                      {t("import")} staff.json
                    </Button>
                    <input
                      ref={staffFileRef}
                      type="file"
                      accept="application/json"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) importStaffFile(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {coaches.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          border: `1px solid var(--ui-border)`,
                          borderRadius: 14,
                          background: "var(--ui-card)",
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                          <div style={{ fontWeight: 900 }}>{c.role}</div>
                          {leftEditMode && (
                            <Button
                              variant="outline"
                              onClick={() => deleteCoach(c.id)}
                              style={{ padding: "6px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                            >
                              {t("delete").toLowerCase()}
                            </Button>
                          )}
                        </div>

                        {!leftEditMode ? (
                          <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                            {c.name} {c.license ? `• ${c.license}` : ""}
                          </div>
                        ) : (
                          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("name")}</div>
                              <Input value={c.name} onChange={(v) => updateCoach(c.id, { name: v })} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("role")}</div>
                              <Input value={c.role} onChange={(v) => updateCoach(c.id, { role: v })} />
                            </div>
                            <div style={{ gridColumn: "1 / span 2" }}>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("licenseNumber")}</div>
                              <Input
                                value={c.license ?? ""}
                                onChange={(v) => updateCoach(c.id, { license: v })}
                                placeholder={t("licenseNumberExample")}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {leftTab === "locations" && (
                <LeftLocationsView
                  theme={theme}
                  setTheme={setTheme}
                  editMode={leftEditMode}
                  openLocationName={openLocationName}
                  setOpenLocationName={setOpenLocationName}
                  t={t}
                />
              )}
            </div>

            {/* RIGHT */}
            <div className="rightPane" style={{ padding: 16, overflow: "auto", background: "var(--ui-bg)" }}>
              {/* Top bar */}
              <div className="topBar">
                {/* Left: Flag Button */}
                <div className="topBarLeft">
                  <Button
                    className="touchBtn"
                    variant="outline"
                    onClick={() => setTheme((p) => ({ ...p, locale: (p.locale === "de" ? "en" : "de") as Lang }))}
                    title={t("language")}
                    style={{
                      width: 38,
                      height: 34,
                      padding: 0,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={theme.locale === "de" ? "/flags/de.svg" : "/flags/gb.svg"}
                      alt={theme.locale === "de" ? "Deutsch" : "English"}
                      style={{ width: 24, height: 16, borderRadius: 2, display: "block" }}
                    />
                  </Button>

                  <div ref={profileMenuRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                    <Button
                      className="touchBtn"
                      variant="outline"
                      onClick={() => setProfilesOpen(true)}
                      title={activeProfileName ?? t("profileNone")}
                      style={{
                        padding: "8px 10px",
                        maxWidth: 230,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      👤 {activeProfileName ?? t("profiles")}
                    </Button>

                    <Button
                      className="touchBtn"
                      variant="outline"
                      onClick={() => setProfileMenuOpen((v) => !v)}
                      title={t("profiles")}
                      style={{ width: 32, height: 34, padding: 0, display: "grid", placeItems: "center" }}
                    >
                      ▾
                    </Button>

                    {profileMenuOpen && (
                      <div className="profileQuickMenu">
                        {profiles.length === 0 && (
                          <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12, padding: "6px 8px" }}>
                            {t("profileNone")}
                          </div>
                        )}

                        {profiles.map((p) => {
                          const active = p.id === activeProfileId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                selectProfile(p.id);
                                setProfileMenuOpen(false);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
                                background: active ? "rgba(59,130,246,.18)" : "transparent",
                                color: "var(--ui-text)",
                                fontWeight: 900,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={p.name}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Other Buttons */}
                <div className="topBarRight">
                  <Button
                    className="touchBtn"
                    variant={eventEditorOpen ? "solid" : "outline"}
                    onClick={() => setEventEditorOpen((v) => !v)}
                    style={{ padding: "8px 10px" }}
                  >
                    📝 {t("event")}
                  </Button>
                  <Button className="touchBtn" variant="outline" onClick={() => setNewWeekOpen(true)} style={{ padding: "8px 10px" }}>
                    {t("newWeek")}
                  </Button>
                  <Button
                    className="touchBtn"
                    variant={rightOpen ? "solid" : "outline"}
                    onClick={() => setRightOpen((v) => !v)}
                    title={t("toggleRightSidebar")}
                    style={{ padding: "8px 10px" }}
                  >
                    📌 {t("right")}
                  </Button>
                  <Button
                    className="touchBtn"
                    variant="outline"
                    onClick={() => setSettingsOpen(true)}
                    title={t("settings")}
                    style={{ padding: "8px 10px", borderRadius: 12 }}
                  >
                    ⚙︎
                  </Button>
                </div>
              </div>

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
                  <div className="flexRow">
                    {TEAM_OPTIONS.map((teamOption) => {
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
                      const locationOptions = getLocationOptions(theme, t);
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
                            const locationOptions = getLocationOptions(theme, t);
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

                                  // Optional: direkt auf Orte springen und aufklappen
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
                  <Input ref={opponentInputRef} value={formOpponent} onChange={setFormOpponent} placeholder={t("eventOpponentExample")} />

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
              </EventEditorModal>

              {/* Week plan board */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{t("weekPlan")}</div>
                {lastDropError && (
                  <div
                    style={{
                      marginTop: 8,
                      border: "1px solid #ef4444",
                      background: "rgba(239,68,68,0.12)",
                      color: "var(--ui-text)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {lastDropError}
                  </div>
                )}
                <div className="weekGrid" style={{ marginTop: 10 }}>
                  {plan.sessions.map((s) => (
                    <DroppableSessionShell
                      key={s.id}
                      session={s}
                      hasHistoryFlag={(historyFlagsBySession.get(s.id) ?? []).length > 0}
                      isEditing={editingSessionId === s.id}
                      isSelected={selectedSessionId === s.id}
                      onSelect={(session) => setSelectedSessionId(session.id)}
                    >
                      {(() => {
                        const dayLabel = weekdayShortLocalized(s.date, lang) || s.day;
                        const participantsCollapsed = collapsedParticipantsBySession[s.id] === true;
                        return (
                      <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 900, color: "var(--ui-text)" }}>
                            {dayLabel} • {s.date}
                          </div>
                          <div style={{ fontWeight: 800, color: "var(--ui-soft)" }}>
                            {(s.teams ?? []).join(" / ")} — {s.time} — {s.location}
                          </div>
                          {s.info ? (
                            <div style={{ fontSize: 12, color: "var(--ui-muted)", marginTop: 4, fontWeight: 900 }}>
                              {s.info}
                            </div>
                          ) : null}
                                                  {/* ANCHOR:SESSION_CONFLICT_BADGE
                           Konfliktanzeige pro Session:
                           - zeigt Anzahl der Spieler, die in einem überschneidenden Event ebenfalls eingetragen sind
                           - Tooltip listet Namen (gekürzt)
                        */}
                        {(() => {
                          const conflicts = conflictsBySession.get(s.id) ?? [];
                          if (!conflicts.length) return null;

                          const uniquePlayers = Array.from(new Set(conflicts.map((c) => c.playerId)));
                          const names = uniquePlayers
                            .map((pid) => playerById.get(pid)?.name ?? pid)
                            .slice(0, 8)
                            .join(", ");

                          return (
                            <div
                              title={names}
                              style={{
                                marginTop: 6,
                                display: "inline-block",
                                border: "1px solid #ef4444",
                                background: "rgba(239,68,68,0.12)",
                                color: "var(--ui-text)",
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              {t("conflict")}: {uniquePlayers.length}
                            </div>
                          );
                        })()}

                        {(() => {
                          const flaggedIds = historyFlagsBySession.get(s.id) ?? [];
                          if (!flaggedIds.length) return null;

                          const names = flaggedIds
                            .map((pid) => playerById.get(pid)?.name ?? pid)
                            .slice(0, 8)
                            .join(", ");

                          return (
                            <div
                              title={names}
                              style={{
                                marginTop: 6,
                                display: "inline-block",
                                border: "1px solid #ef4444",
                                background: "rgba(239,68,68,0.12)",
                                color: "var(--ui-text)",
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              {t("hint")}: {flaggedIds.length} ({t("history")})
                            </div>
                          );
                        })()}

                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "var(--ui-text)", fontWeight: 900 }}>
                            {(s.participants ?? []).length} {t("players")}
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setCollapsedParticipantsBySession((prev) => ({
                                  ...prev,
                                  [s.id]: !participantsCollapsed,
                                }))
                              }
                              style={{ padding: "8px 10px" }}
                            >
                              {participantsCollapsed ? t("expandPlayers") : t("collapsePlayers")}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => onEditSession(s)}
                              title={t("eventEdit")}
                              style={{ padding: "8px 10px" }}
                            >
                              ⚙︎
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => onDeleteSession(s.id)}
                              style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                            >
                              {t("delete").toLowerCase()}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {!participantsCollapsed && (
                        <>
                          <hr style={{ border: 0, borderTop: `1px solid var(--ui-border)`, margin: "10px 0" }} />

                          <div style={{ display: "grid", gap: 6 }}>
                            {(s.participants ?? []).map((pid) => {
                              const p = playerById.get(pid);
                              if (!p) return null;
                              return (
                                <ParticipantCard
                                  key={pid}
                                  player={p}
                                  onRemove={() => removePlayerFromSession(s.id, pid)}
                                  groupBg={groupBg}
                                  isBirthday={birthdayPlayerIds.has(pid)}
                                  t={t}
                                />
                              );
                            })}
                            {(s.participants ?? []).length === 0 && (
                              <div style={{ color: "var(--ui-muted)", fontSize: 13, fontWeight: 800 }}>
                                {t("dropPlayersHere")}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      </>
                    );
                      })()}
                    </DroppableSessionShell>
                  ))}
                </div>
              </div>

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

      {profilesOpen && (
        <Modal title={t("profiles")} onClose={() => setProfilesOpen(false)} closeLabel={t("close")}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>{t("profileActive")}</div>
              <select
                value={activeProfileId}
                onChange={(e) => selectProfile(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--ui-border)",
                  background: "var(--ui-card)",
                  color: "var(--ui-text)",
                }}
              >
                <option value="">— {t("profileNone")} —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>{t("name")}</div>
              <Input
                value={profileNameInput}
                onChange={setProfileNameInput}
                placeholder={t("profileNamePlaceholder")}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={createProfile}>
                {t("profileSaveNew")}
              </Button>
              <Button variant="outline" onClick={updateActiveProfile} disabled={!activeProfileId}>
                {t("profileUpdate")}
              </Button>
              <Button variant="danger" onClick={deleteActiveProfile} disabled={!activeProfileId}>
                {t("profileDelete")}
              </Button>
            </div>

            <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
              {t("profileHint")}
            </div>
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
                </div>

                <div style={{ marginTop: 10, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                  {t("rosterHintTbd")}
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
                      const tna = primaryTna(p);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlayerId(p.id)}
                          style={{
                            textAlign: "left",
                            border: `1px solid ${active ? "var(--ui-soft)" : "var(--ui-border)"}`,
                            background: active ? "var(--ui-panel)" : "var(--ui-card)",
                            color: "var(--ui-text)",
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
                          <span style={{ fontWeight: 900, color: "var(--ui-muted)" }}>{gid}</span>
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
                          const yearLocked = y === 2007 || y === 2008 || y === 2009;
                          return (
                            <Select
                              value={selectedPlayer.group ?? getPlayerGroup(selectedPlayer)}
                              onChange={(v) => updatePlayer(selectedPlayer.id, { group: v as GroupId })}
                              options={
                                yearLocked
                                  ? [{ value: String(y), label: String(y) }]
                                  : [
                                      { value: "2007", label: "2007" },
                                      { value: "2008", label: "2008" },
                                      { value: "2009", label: "2009" },
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
                              if (v.trim()) list.push({ typ: "DBB", tna: v.trim(), verein: "UBC Münster" });
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
                              if (v.trim()) list.push({ typ: "NBBL", tna: v.trim(), verein: "UBC Münster" });
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
    {TEAM_OPTIONS.map((t) => {
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
    {TEAM_OPTIONS.map((teamCode) => {
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