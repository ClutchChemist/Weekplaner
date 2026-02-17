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
  Lizenz,
  Player,
  Position,
  SeniorTeam,
  ThemeLocations,
  ThemeSettings,
  UiTheme,
  WeekPlan,
  YouthTeam,
} from "./state/types";
import { I18N } from "./i18n/dict";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Select } from "./components/ui/Select";
import { Modal } from "./components/ui/Modal";
import { segBtn } from "./components/ui/Toggle";
import { CalendarPane } from "./components/layout/CalendarPane";
import { ConfirmModal, EventEditorModal, NewWeekModal, ThemeSettingsModal } from "./components/modals";
import type { NewWeekMode } from "./components/modals/NewWeekModal";
import { useDndPlan } from "./hooks/useDndPlan";
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
  weekdayShortDE,
} from "./utils/date";
import { normalizeYearColor, pickTextColor } from "./utils/color";
import { downloadJson } from "./utils/json";
import { randomId, uid } from "./utils/id";
import rosterRaw from "./data/roster.json";
import weekMasterRaw from "./data/weekplan_master.json";

/* ============================================================
   TYPES
   ============================================================ */

/* ============================================================
   I18N
   ============================================================ */

function makeT(locale: Lang) {
  return (key: string) => I18N[locale]?.[key] ?? key;
}

function makeTF(locale: Lang) {
  return (key: string, vars: Record<string, string | number> = {}) => {
    const tpl = I18N[locale]?.[key] ?? key;
    return tpl.replace(/{(\w+)}/g, (_, k) => String(vars[k] ?? `{${k}}}`));
  };
}

/* ============================================================
   CONSTANTS / PRESETS
   ============================================================ */

const DEFAULT_GROUP_COLORS: Record<GroupId, { bg: string }> = {
  "2007": { bg: "#4b5563" },
  "2008": { bg: "#6b7280" },
  "2009": { bg: "#9ca3af" },
  Herren: { bg: "#ffffff" },
  TBD: { bg: "#4b5563" },
};

const DEFAULT_THEME: ThemeSettings = {
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
  // Gruppen bleiben wie gehabt
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


const THEME_STORAGE_KEY = "ubc_planner_theme_v1";
function stableStringify(obj: unknown) {
  try {
    return JSON.stringify(obj, Object.keys(obj as any).sort());
  } catch {
    return JSON.stringify(obj);
  }
}

function safeParseTheme(raw: string | null): ThemeSettings | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;

    const ui = obj.ui;
    const groups = obj.groups;

    const needUiKeys: Array<keyof UiTheme> = [
      "bg",
      "panel",
      "card",
      "border",
      "text",
      "muted",
      "soft",
      "black",
      "white",
    ];

    if (!ui || typeof ui !== "object") return null;
    for (const k of needUiKeys) {
      if (typeof ui[k] !== "string" || !ui[k]) return null;
    }

    const gids: GroupId[] = ["2007", "2008", "2009", "Herren", "TBD"];
    if (!groups || typeof groups !== "object") return null;
    for (const gid of gids) {
      if (!groups[gid] || typeof groups[gid].bg !== "string" || !groups[gid].bg)
        return null;
    }

    return {
      ui: {
        bg: ui.bg,
        panel: ui.panel,
        card: ui.card,
        border: ui.border,
        text: ui.text,
        muted: ui.muted,
        soft: ui.soft,
        black: ui.black,
        white: ui.white,
        primary: typeof ui.primary === "string" && ui.primary ? ui.primary : undefined,
        primaryText:
          typeof ui.primaryText === "string" && ui.primaryText ? ui.primaryText : undefined,
      },
      groups: {
        "2007": { bg: groups["2007"].bg },
        "2008": { bg: groups["2008"].bg },
        "2009": { bg: groups["2009"].bg },
        Herren: { bg: groups["Herren"].bg },
        TBD: { bg: groups["TBD"].bg },
      },
      clubName: typeof obj.clubName === "string" ? obj.clubName : DEFAULT_THEME.clubName,
      locale: (obj.locale === "de" || obj.locale === "en") ? obj.locale : DEFAULT_THEME.locale,
    };
  } catch {
    return null;
  }
}

function migrateLegacyBlueTheme(theme: ThemeSettings): ThemeSettings {
  const legacyMap: Record<string, string> = {
    "#0b0f19": "#0d0d0d",
    "#111827": "#171717",
    "#0f172a": "#212121",
    "#243041": "#303030",
    "#e5e7eb": "#ececec",
    "#9ca3af": "#b4b4b4",
    "#cbd5e1": "#676767",
    "#111111": "#000000",
    "#e7e7e7": "#3d3d3d",
    "#0f0f10": "#ffffff",
    "#2563eb": "#4b5563",
    "#f59e0b": "#6b7280",
    "#16a34a": "#9ca3af",
  };

  const hasLegacyBlueBase =
    [theme.ui.bg, theme.ui.panel, theme.ui.card].map((x) => x.toLowerCase()).some((x) =>
      ["#0b0f19", "#111827", "#0f172a"].includes(x)
    );

  const mapColor = (hex: string) => legacyMap[hex.toLowerCase()] ?? hex;

  const migratedUi: UiTheme = {
    ...theme.ui,
    bg: mapColor(theme.ui.bg),
    panel: mapColor(theme.ui.panel),
    card: mapColor(theme.ui.card),
    border: mapColor(theme.ui.border),
    text: mapColor(theme.ui.text),
    muted: mapColor(theme.ui.muted),
    soft: mapColor(theme.ui.soft),
    black: mapColor(theme.ui.black),
    white: mapColor(theme.ui.white),
    primary: mapColor(theme.ui.primary ?? DEFAULT_THEME.ui.primary ?? "#3d3d3d"),
    primaryText: mapColor(theme.ui.primaryText ?? DEFAULT_THEME.ui.primaryText ?? "#ffffff"),
  };

  if (!hasLegacyBlueBase) {
    return { ...theme, ui: migratedUi };
  }

  return {
    ui: migratedUi,
    groups: {
      "2007": { bg: mapColor(theme.groups["2007"].bg) },
      "2008": { bg: mapColor(theme.groups["2008"].bg) },
      "2009": { bg: mapColor(theme.groups["2009"].bg) },
      Herren: { bg: mapColor(theme.groups["Herren"].bg) },
      TBD: { bg: mapColor(theme.groups["TBD"].bg) },
    },
    clubName: theme.clubName ?? DEFAULT_THEME.clubName,
    locale: theme.locale ?? DEFAULT_THEME.locale,
  };
}

function applyThemeToCssVars(theme: ThemeSettings) {
  const r = document.documentElement;
  r.style.setProperty("--ui-bg", theme.ui.bg);
  r.style.setProperty("--ui-panel", theme.ui.panel);
  r.style.setProperty("--ui-card", theme.ui.card);
  r.style.setProperty("--ui-border", theme.ui.border);
  r.style.setProperty("--ui-text", theme.ui.text);
  r.style.setProperty("--ui-muted", theme.ui.muted);
  r.style.setProperty("--ui-soft", theme.ui.soft);
  r.style.setProperty("--ui-black", theme.ui.black);
  r.style.setProperty("--ui-white", theme.ui.white);

  /* Auch die neuen Standard-Variablen setzen */
  r.style.setProperty("--bg", theme.ui.bg);
  r.style.setProperty("--panel", theme.ui.panel);
  r.style.setProperty("--panel2", theme.ui.card);
  r.style.setProperty("--border", theme.ui.border);
  r.style.setProperty("--text", theme.ui.text);
  r.style.setProperty("--muted", theme.ui.muted);
  // primary accent
  if (theme.ui.primary) r.style.setProperty("--primary", theme.ui.primary);
  if (theme.ui.primaryText) r.style.setProperty("--primaryText", theme.ui.primaryText);
}

/* ============================================================
   GROUPS
   ============================================================ */

const GROUPS: Array<{
  id: GroupId;
  label: string;
  order: number;
}> = [
  { id: "2007", label: "2007", order: 0 },
  { id: "2008", label: "2008", order: 1 },
  { id: "2009", label: "2009", order: 2 },
  { id: "Herren", label: "Herren", order: 3 },
  { id: "TBD", label: "TBD", order: 4 },
];

const GROUP_ORDER = new Map<GroupId, number>(GROUPS.map((g) => [g.id, g.order]));
const PRINT_GROUP_ORDER: GroupId[] = ["2007", "2008", "2009", "Herren", "TBD"];

/* ============================================================
  UTILS (date/color/json/...)
  ============================================================ */

/* ============================================================
   HELPERS (colors / contrast)
   ============================================================ */

function normalizeOpponentInfo(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower.startsWith("@")) {
    const rest = s.slice(1).trim();
    return rest ? `@ ${rest}` : "@";
  }
  if (lower.startsWith("vs")) {
    const rest = s.slice(2).trim();
    return rest ? `vs ${rest}` : "vs";
  }
  return s;
}

/* ============================================================
   ISO WEEK
   ============================================================ */

/* ============================================================
  DOWNLOAD JSON
  ============================================================ */

/* ============================================================
   ROSTER helpers (TA badge + grouping)
   ============================================================ */

function safeNameSplit(full: string): { firstName: string; lastName: string } {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function primaryTna(p: Player): string {
  const liz = p.lizenzen ?? [];
  const dbb = liz.find((x) => String(x.typ).toUpperCase() === "DBB")?.tna;
  const nbbl = liz.find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna;
  return dbb || nbbl || "";
}

function hasAnyTna(p: Player): boolean {
  return (p.lizenzen ?? []).some((l) => String(l.tna ?? "").trim().length > 0);
}
/* ============================================================
   DBB-TA Parsing: DDMMYY Geburtsdatum-Validierung
   ============================================================ */

function toISODate(y: number, m: number, d: number): string | null {
  // Validierung via Date-Objekt
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) return null;

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; // garantiert YYYY-MM-DD
}

/**
 * Erwartet DBB-TA/TNA als String, mind. 6 Zeichen.
 * Format: DDMMYYxxxx...
 * Pivot-Year: 00–29 => 2000–2029, sonst 1900–1999
 */
function birthDateFromDBBTA(taRaw?: string | null): string | null {
  if (!taRaw) return null;

  const ta = String(taRaw).trim();
  if (!/^\d{6,}$/.test(ta)) return null;

  const dd = Number(ta.slice(0, 2));
  const mm = Number(ta.slice(2, 4));
  const yy = Number(ta.slice(4, 6));

  const yyyy = yy <= 29 ? 2000 + yy : 1900 + yy;
  return toISODate(yyyy, mm, dd);
}

function getDbbTna(p: Player): string {
  const liz = p.lizenzen ?? [];
  const dbb = liz.find((x) => String(x.typ).toUpperCase() === "DBB")?.tna ?? "";
  return String(dbb).trim();
}

function parseDbbDobFromTna(tna: string): { dd: number; mm: number; yy: number } | null {
  const s = String(tna ?? "").trim();
  // DBB TA: DDMMYYXXX (mind. 6 Ziffern am Anfang)
  const m = s.match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yy = parseInt(m[3], 10);
  if (!(dd >= 1 && dd <= 31)) return null;
  if (!(mm >= 1 && mm <= 12)) return null;
  return { dd, mm, yy };
}

function birthDateParts(p: Player): { dd: number; mm: number; yy: number } | null {
  const bd = String(p.birthDate ?? "").trim(); // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) return null;
  const yyyy = parseInt(bd.slice(0, 4), 10);
  const mm = parseInt(bd.slice(5, 7), 10);
  const dd = parseInt(bd.slice(8, 10), 10);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return { dd, mm, yy: yyyy % 100 };
}

function dbbDobMatchesBirthDate(p: Player): { ok: boolean; reason?: string } {
  const tna = getDbbTna(p);
  if (!tna) return { ok: true }; // kein DBB -> nichts prüfen

  const taDob = parseDbbDobFromTna(tna);
  if (!taDob) return { ok: false, reason: "DBB-TA Format unklar (erwartet DDMMYY...)" };

  const bd = birthDateParts(p);
  if (!bd) return { ok: false, reason: "Geburtsdatum fehlt/ungültig (YYYY-MM-DD)" };

  const ok = taDob.dd === bd.dd && taDob.mm === bd.mm && taDob.yy === bd.yy;
  if (ok) return { ok: true };

  return {
    ok: false,
    reason: `Mismatch: TA startet ${String(taDob.dd).padStart(2,"0")}.${String(taDob.mm).padStart(2,"0")}.${String(taDob.yy).padStart(2,"0")} vs birthDate ${String(bd.dd).padStart(2,"0")}.${String(bd.mm).padStart(2,"0")}.${String(bd.yy).padStart(2,"0")}`,
  };
}

function birthYearOf(p: Player): number | null {
  if (p.birthDate && p.birthDate.length >= 4) {
    const y = parseInt(p.birthDate.slice(0, 4), 10);
    if (Number.isFinite(y)) return y;
  }
  if (typeof p.birthYear === "number" && Number.isFinite(p.birthYear)) return p.birthYear;
  return null;
}

function getPlayerGroup(p: Player): GroupId {
  if (p.id === "TBD" || (p.name ?? "").toLowerCase() === "tbd") return "TBD";

  const teams = (p.defaultTeams ?? []).map((x) => String(x).toUpperCase());
  const y = birthYearOf(p);

  // 1) Jahrgang IMMER zuerst, wenn 2007/08/09 bekannt (überschreibt auch p.group)
  if (y === 2007) return "2007";
  if (y === 2008) return "2008";
  if (y === 2009) return "2009";

  // 2) Wenn kein Jahrgang greift, dann explizite group respektieren
  if (p.group) return p.group;

  // 3) Herren nur, wenn klar Senior-Core (oder HOL-only / 1RLH)
  if (teams.includes("1RLH") || teams.includes("HOL")) return "Herren";

  return "TBD";
}


function teamSet(p: Player) {
  return new Set((p.defaultTeams ?? []).map((x) => String(x).toUpperCase()));
}

function isCorePlayer(p: Player): boolean {
  if (p.id === "TBD") return true;
  const t = teamSet(p);
  return t.has("NBBL") || t.has("1RLH");
}

function isU18Only(p: Player): boolean {
  if (p.id === "TBD") return false;
  const t = teamSet(p);
  return t.has("U18") && !t.has("NBBL") && !t.has("1RLH") && !t.has("HOL");
}

function isHolOnly(p: Player): boolean {
  if (p.id === "TBD") return false;
  const t = teamSet(p);
  return t.has("HOL") && !t.has("NBBL") && !t.has("1RLH");
}


function makeParticipantSorter(playerById: Map<string, Player>) {
  return (aId: string, bId: string) => {
    const a = playerById.get(aId);
    const b = playerById.get(bId);

    const ga = a ? getPlayerGroup(a) : "2009";
    const gb = b ? getPlayerGroup(b) : "2009";

    const oa = GROUP_ORDER.get(ga) ?? 999;
    const ob = GROUP_ORDER.get(gb) ?? 999;
    if (oa !== ob) return oa - ob;

    const aName = ((a?.name ?? aId) || "").toLowerCase();
    const bName = ((b?.name ?? bId) || "").toLowerCase();
    return aName.localeCompare(bName, "de");
  };
}

function computeTrainingCounts(plan: WeekPlan) {
  const m = new Map<string, number>();
  for (const s of plan.sessions) {
    for (const pid of s.participants ?? []) {
      m.set(pid, (m.get(pid) ?? 0) + 1);
    }
  }
  return m;
}

  /* ============================================================
    COMPONENTS (Modal..., Button..., Row..., Pane...)
    ============================================================ */

/* ============================================================
   UI PRIMITIVES (CSS vars)
   ============================================================ */

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
  const [inputVal, setInputVal] = React.useState(value);
  const [predictions, setPredictions] = React.useState<any[]>([]);
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

  async function handleSelectPrediction(pred: any) {
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
        placeholder={placeholder ?? "Adresse suchen..."}
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
          Place ID: {placeId.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/* ============================================================
   LEFT LOCATIONS VIEW (with edit mode)
   ============================================================ */

function splitAddressLines(addr: string) {
  // "formattedAddress" von Google kommt oft als 1 Zeile mit Kommas
  const cleaned = String(addr ?? "").trim();
  if (!cleaned) return [];
  const parts = cleaned.split(",").map((x) => x.trim()).filter(Boolean);
  // Falls nur eine Zeile: gib sie so zurück
  return parts.length ? parts : [cleaned];
}

function LeftLocationsView({
  theme,
  setTheme,
  editMode,
  openLocationName,
  setOpenLocationName,
}: {
  theme: ThemeSettings;
  setTheme: (t: ThemeSettings) => void;
  editMode: boolean;
  openLocationName: string | null;
  setOpenLocationName: (v: string | null) => void;
}) {
  // Wenn editMode AN: nutze bestehendes LocationsPanel (inkl. Autocomplete)
  if (editMode) {
    return <LocationsPanel theme={theme} setTheme={setTheme} />;
  }

  const L = theme.locations ?? {};
  const locs = L.locations ?? {};
  const defs = L.definitions ?? {};

  const names = Object.keys(locs).sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>Orte</div>
      <div style={{ color: "var(--ui-muted)", fontSize: 13, fontWeight: 800 }}>
        Klick auf einen Ort → Details (Adresse) aufklappen. Bearbeiten über „Bearbeiten" oben.
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
                    <div style={{ fontSize: 12, fontWeight: 900, color: "var(--ui-muted)" }}>Keine Adresse hinterlegt</div>
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

        {names.length === 0 && <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>Noch keine Orte angelegt.</div>}
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
            {def.abbr ? `Abk.: ${def.abbr}` : "Abk.: —"}
            {def.hallNo ? `  •  Halle ${def.hallNo}` : ""}
            {hasMaps ? "  •  Maps ✓" : "  •  Maps —"}
          </div>
        </div>

        <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>{open ? "▲" : "▼"}</div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--ui-border)", padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                Bezeichnung
              </div>
              <Input value={def.name} onChange={(v) => onDefChange({ ...def, name: v })} placeholder="z.B. Sporthalle Berg Fidel" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                Abkürzung
              </div>
              <Input value={def.abbr} onChange={(v) => onDefChange({ ...def, abbr: v })} placeholder="z.B. BSH" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                Hallennr.
              </div>
              <Input value={def.hallNo ?? ""} onChange={(v) => onDefChange({ ...def, hallNo: v })} placeholder="optional" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
              Adresse (Google Autocomplete)
            </div>
            <AddressAutocomplete
              value={locData.address}
              placeId={locData.placeId}
              onChange={onAddressChange}
              placeholder="Adresse suchen"
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
                Entfernen
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
}: {
  theme: ThemeSettings;
  setTheme: (t: ThemeSettings) => void;
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
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Home</div>
        <AddressAutocomplete
          value={loc.homeAddress ?? ""}
          placeId={loc.homePlaceId}
          onChange={setHomeAddress}
          placeholder="Startpunkt (optional)"
        />
      </div>

      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Trainings- und Spielorte</div>

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
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddCustomLocationRow({ onAdd }: { onAdd: (name: string, addr: string, placeId: string) => void }) {
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [placeId, setPlaceId] = React.useState("");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, alignItems: "start" }}>
      <Input value={name} onChange={setName} placeholder="Ort-Name (z.B. Artland Arena)" />
      <AddressAutocomplete
        value={address}
        placeId={placeId}
        onChange={(addr, pId) => {
          setAddress(addr);
          setPlaceId(pId);
        }}
        placeholder="Adresse suchen"
      />
      <button
        type="button"
        onClick={() => {
          const n = name.trim();
          if (!n) return;
          onAdd(n, address, placeId);
          setName("");
          setAddress("");
          setPlaceId("");
        }}
        style={{ ...segBtn(true), padding: "8px 10px", whiteSpace: "nowrap" }}
      >
        Hinzufügen
      </button>
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
}: {
  player: Player;
  trainingCount: number;
  groupBg: Record<GroupId, string>;
  isBirthday: boolean;
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
            ? "Platzhalter"
            : (player.lizenzen ?? [])
                .map((l) => `${String(l.typ).toUpperCase()}: ${l.tna}`)
                .join(" | ") || "Keine TA/TNA hinterlegt"
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
              ? "Platzhalter"
              : `${player.primaryYouthTeam || ""}${
                  player.primarySeniorTeam ? ` • ${player.primarySeniorTeam}` : ""
                }`}
          </div>
        </div>

        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          {isTbd ? (
            <>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>TBD</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>To be determined</div>
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
  onSelect,
}: {
  session: Session;
  children: ReactNode;
  hasHistoryFlag?: boolean;
  isEditing?: boolean;
  onSelect?: (session: Session) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `session:${session.id}`,
    data: { type: "session", sessionId: session.id },
  });

  const baseBorder = isEditing ? "2px solid var(--ui-accent)" : (hasHistoryFlag ? "1px solid #ef4444" : `1px solid var(--ui-border)`);
  const baseBg = isEditing ? "rgba(59,130,246,0.25)" : (hasHistoryFlag ? "rgba(239,68,68,0.08)" : "var(--ui-card)");

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
}: {
  player: Player;
  onRemove: () => void;
  groupBg: Record<GroupId, string>;
  isBirthday: boolean;
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
        raus
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
            <div style={{ fontSize: 11, fontWeight: 800 }}>Saison - Trainingsübersicht</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 900 }}>{dateToDDMMYYYY_DOTS(mondayDate)}</div>
          <div style={{ fontSize: 11, fontWeight: 900 }}>Trainingswoche: {kwText}</div>
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
              let lastDate = "";
              return plan.sessions.map((s) => {
                const sameDayAsPrev = s.date === lastDate;
                lastDate = s.date;

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

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>Kader-Listen</div>
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
            tbd = to be determined
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
            <div style={{ fontWeight: 900, fontSize: 12 }}>Spiel-Exports</div>

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
                            <th style={{ width: 54 }}>Trikot</th>
                            <th>Nachname</th>
                            <th>Vorname</th>
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
                      Coaches: {(coaches ?? []).map((c) => `${c.role}: ${c.name}${c.license ? ` (${c.license})` : ""}`).join(" | ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 12 }}>Coaches</div>
      <div style={{ marginTop: 6, fontSize: 11 }}>
        {(coaches ?? []).map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #eee", padding: "4px 0" }}>
            <div style={{ fontWeight: 800 }}>{c.role}: {c.name}</div>
            <div style={{ color: "#374151", fontWeight: 800 }}>{c.license ? `Lizenz ${c.license}` : "Lizenz —"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   DBB-ENRICHMENT: DBB-TNA -> birthDate / birthYear
   ------------------------------------------------------------
   Ziel:
   - birthDate aus DBB-TNA (DDMMYY...) automatisch ableiten
   - birthYear validieren/korrigieren via DBB als Primärquelle
   ============================================================ */

function enrichPlayersWithBirthFromDBBTA(
  players: Player[],
  opts?: { overrideBirthYear?: boolean }
): { players: Player[]; warnings: string[] } {
  const overrideBirthYear = opts?.overrideBirthYear ?? true;
  const warnings: string[] = [];

  const result = players.map((p) => {
    const tna = getDbbTna(p);
    if (!tna) return p; // kein DBB-TA -> keine Änderung

    const derived = birthDateFromDBBTA(tna);
    if (!derived) {
      warnings.push(`${p.name}: DBB-TNA nicht parsbar oder ungültiges Datum (${tna})`);
      return p; // TA war nicht parsebar -> nichts setzen
    }

    const alreadyOk = p.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate);
    if (alreadyOk) return p; // birthDate vorhanden und gültig -> nicht überschreiben

    let updated = { ...p, birthDate: derived };

    // birthYear aus dem neuen Datum ableiten
    const parsedYear = Number(derived.slice(0, 4));
    const currentBirthYear = typeof p.birthYear === "number" ? p.birthYear : undefined;
    const yearIsValid = currentBirthYear && currentBirthYear >= 1930 && currentBirthYear <= new Date().getFullYear();

    if (!yearIsValid) {
      updated.birthYear = parsedYear;
    } else if (overrideBirthYear && currentBirthYear !== parsedYear) {
      updated.birthYear = parsedYear;
    }

    return updated;
  });

  return { players: result, warnings };
}

/* ============================================================
   NORMALIZATION: roster.json -> internal Player[]
   ------------------------------------------------------------
   Ziel:
   - roster.json darf "alt" oder "neu" sein
   - wir normalisieren in ein stabiles Player-Objekt
   - primaryYouthTeam / primarySeniorTeam werden aus defaultTeams abgeleitet
   ============================================================ */

function normalizeRoster(input: any): { season: string; ageGroups: any; players: Player[] } {
  const season = String(input?.season ?? "");
  const ageGroups = input?.ageGroups ?? null;
  const list = Array.isArray(input?.players) ? input.players : [];

  const players: Player[] = list.map((r: any) => {
    const id = String(r.id ?? randomId("p_"));
    const name = String(r.name ?? "Spieler");
    const split = safeNameSplit(name);

    const birthYear = typeof r.birthYear === "number" ? r.birthYear : undefined;
    const isLocalPlayer = typeof r.isLocalPlayer === "boolean" ? r.isLocalPlayer : undefined;

    const lizenzen: Lizenz[] = Array.isArray(r.lizenzen)
      ? r.lizenzen
          .map((x: any) => ({
            typ: String(x.typ ?? ""),
            tna: String(x.tna ?? ""),
            verein: x.verein ? String(x.verein) : undefined,
          }))
          .filter((x: Lizenz) => x.typ)
      : [];

    const defaultTeams = Array.isArray(r.defaultTeams)
      ? (r.defaultTeams as any[])
          .map((x: any) => String(x).toUpperCase().replaceAll(".1", "").replaceAll(".2", ""))
      : [];

    // Derive primary team labels (used in UI chips)
    const primaryYouthTeam: YouthTeam =
      defaultTeams.includes("NBBL") ? "NBBL" : defaultTeams.includes("U18") ? "U18" : "";

    const primarySeniorTeam: SeniorTeam =
      defaultTeams.includes("HOL") ? "HOL" : defaultTeams.includes("1RLH") ? "1RLH" : "";

    const p: Player = {
      id,
      name,

      firstName: r.firstName ? String(r.firstName) : split.firstName,
      lastName: r.lastName ? String(r.lastName) : split.lastName,

      birthYear,
      birthDate: r.birthDate ? String(r.birthDate) : undefined,

      positions: Array.isArray(r.positions)
        ? ((r.positions as any[]).map((x) => String(x)) as Position[])
        : [],

      isLocalPlayer,
      lpCategory: r.lpCategory ? String(r.lpCategory) : undefined,
      lizenzen,
      defaultTeams,

      primaryYouthTeam,
      primarySeniorTeam,

      group: (r.group ? String(r.group) : undefined) as GroupId | undefined,

      jerseyByTeam: r.jerseyByTeam && typeof r.jerseyByTeam === "object" ? r.jerseyByTeam : undefined,

      historyLast6: Array.isArray(r.historyLast6)
        ? r.historyLast6
            .slice(0, 6)
            .map((x: any) => ({
              date: String(x?.date ?? ""),
              opponent: String(x?.opponent ?? ""),
              note: x?.note ? String(x.note) : undefined,
            }))
            .filter((x: any) => x.date || x.opponent)
        : undefined,

      yearColor: r.yearColor ?? null,
    };

    return p;
  });

  // Enrich mit DBB-TNA Geburtsdaten
  const { players: enrichedPlayers } = enrichPlayersWithBirthFromDBBTA(players);

  return { season, ageGroups, players: enrichedPlayers };
}


function mapMasterTeamToCore(team: string): string[] {
  const t = String(team ?? "").trim();
  const u = t.toUpperCase();
  if (!u) return [];
  if (u.startsWith("NBBL")) return ["NBBL"];
  if (u.startsWith("U18")) return ["U18"];
  if (u.startsWith("HOL")) return ["HOL"];
  if (u.startsWith("1RLH")) return ["1RLH"];
  // fallback: keep as-is
  return [t];
}

function normalizeMasterWeek(input: any): WeekPlan {
  const sessionsRaw = Array.isArray(input?.sessions) ? input.sessions : [];
  const sessions: Session[] = sessionsRaw.map((s: any) => {
    const id = String(s.id ?? randomId("sess_"));
    const day = String(s.day ?? "");
    const date = String(s.date ?? ""); // master might not have date; allow empty
    const team = s.team ? String(s.team) : "";
    const teams: string[] = Array.isArray(s.teams) ? s.teams.map((x: any) => String(x)) : mapMasterTeamToCore(team);

    const timeRaw = String(s.time ?? "");
    const time = timeRaw.includes("–") ? timeRaw : normalizeDash(timeRaw);

    return {
      id,
      date: date || "", // will be set when creating a new week from the chosen week
      day: day || (date ? weekdayShortDE(date) : ""),
      teams: teams.map((x: string) => x.replaceAll(".1", "").replaceAll(".2", "")),
      time,
      location: String(s.location ?? ""),
      info: (s.info ?? "") ? String(s.info) : null,
      participants: Array.isArray(s.participants) ? s.participants.map((x: any) => String(x)) : [],
      kaderLabel: s.kaderLabel ? String(s.kaderLabel) : undefined,
    };
  });

  sessions.sort((a, b) => {
    const ad = a.date.localeCompare(b.date);
    if (ad !== 0) return ad;
    return a.time.localeCompare(b.time);
  });

  return {
    weekId: String(input?.weekId ?? "MASTER"),
    sessions: sessions.map((s) => ({ ...s, participants: [] })), // master starts empty
  };
}

// ----------------------
// Plan / birthday helpers
// ----------------------
function planDateSet(plan: WeekPlan): Set<string> {
  return new Set((plan.sessions ?? []).map((s) => String(s.date ?? "")).filter(Boolean));
}

// (playerAppearsInPlan not needed currently)

function isBirthdayOnAnyPlanDate(p: Player, dateSet: Set<string>): boolean {
  const bd = String(p.birthDate ?? "").trim(); // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) return false;

  const mmdd = bd.slice(5, 10); // "MM-DD"
  for (const d of dateSet) {
    if (String(d).slice(5, 10) === mmdd) return true;
  }
  return false;
}

function hasBlockingHistoryNoteForDate(p: Player, dateISO: string): boolean {
  const entries = p.historyLast6 ?? [];
  if (!entries.length) return false;

  const blockRegex = /(verletzt|injur|schule|school|krank|ill|ausfall|absen|fehlt)/i;

  return entries.some((h) => {
    const d = String(h?.date ?? "").trim();
    if (!d || d !== dateISO) return false;
    const note = String(h?.note ?? "").trim();
    const opp = String(h?.opponent ?? "").trim();
    return blockRegex.test(`${note} ${opp}`);
  });
}

function computeHistoryFlagsBySession(
  plan: WeekPlan,
  playerById: Map<string, Player>
): Map<string, string[]> {
  const res = new Map<string, string[]>();

  for (const s of plan.sessions ?? []) {
    const flagged: string[] = [];
    for (const pid of s.participants ?? []) {
      const p = playerById.get(pid);
      if (!p) continue;
      if (hasBlockingHistoryNoteForDate(p, s.date)) flagged.push(pid);
    }
    res.set(s.id, flagged);
  }

  return res;
}

/* ============================================================
   COACHES: persistence + defaults
   ============================================================ */

const STAFF_STORAGE_KEY = "ubc_staff_v1";

const DEFAULT_STAFF: Coach[] = [
  { id: "c_andrej", name: "Andrej König", role: "Headcoach", license: "B-23273" },
  { id: "c_edgars", name: "Edgars Ikstens", role: "Coach", license: "" },
  { id: "c_mardin", name: "Mardin Ahmedin", role: "Coach", license: "" },
];

function safeParseStaff(raw: string | null): Coach[] | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    if (!Array.isArray(x)) return null;
    const list = x
      .map((c: any) => ({
        id: String(c.id ?? randomId("c_")),
        name: String(c.name ?? ""),
        role: String(c.role ?? "Coach"),
        license: c.license !== undefined ? String(c.license ?? "") : "",
      }))
      .filter((c: Coach) => c.id && c.name);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

/* ============================================================
   NEW WEEK MODAL
   ============================================================ */

/* ============================================================
   PRINT PREVIEW & EXPORT HELPERS
   ============================================================ */

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isGameSession(s: Session): boolean {
  const info = s.info || "";
  return info.includes("vs") || info.includes("@");
}

function pageBaseCss(): string {
  return `
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .page { page-break-after: always; padding: 20mm; box-sizing: border-box; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  `;
}

function pageHeaderHtml(opts: { title: string; clubName: string; logoUrl?: string }): string {
  const { title, clubName, logoUrl } = opts;
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain;" />`
    : `<div style="width: 80px; height: 80px; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">Logo</div>`;
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div style="flex: 1;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${escapeHtml(title)}</h1>
        <div style="font-size: 14px; color: #666; margin-top: 4px;">${escapeHtml(clubName)}</div>
      </div>
      ${logoHtml}
    </div>
  `;
}

function pageFooterHtml(opts: { clubName: string; locale: Lang }): string {
  const { clubName, locale } = opts;
  const trainingLabel = locale === "de" ? "Basketballtraining" : "Basketball Training";
  const planLabel = locale === "de" ? "Wochenplanung" : "Weekly Plan";
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
      ${escapeHtml(clubName)} · ${trainingLabel} · ${planLabel}
    </div>
  `;
}

function thCss(): string {
  return "border: 1px solid #ccc; padding: 8px; background: #f5f5f5; text-align: left; font-weight: bold;";
}

function tdCss(): string {
  return "border: 1px solid #ccc; padding: 8px;";
}

function renderWeekOverviewHtml(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
}): string {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;

  const trainingSessions = sessions.filter((s) => !isGameSession(s));
  const games = sessions.filter((s) => isGameSession(s));

  const t = locale === "de"
    ? { training: "Training", trainingShort: "Tr", game: "Spiel", gameShort: "Sp", roster: "Kader", legend: "Legende" }
    : { training: "Training", trainingShort: "Tr", game: "Game", gameShort: "Gm", roster: "Roster", legend: "Legend" };

  // Build locations legend HTML
  const locationsLegendHtml = (() => {
    const defs = locations?.definitions || {};
    const customLocs = locations?.custom || {};
    const newLocs = locations?.locations || {};
    const allLocNames = new Set<string>();

    sessions.forEach((s) => {
      const loc = s.location || "";
      if (loc && loc !== "TBD") allLocNames.add(loc);
    });

    if (allLocNames.size === 0) return "";

    const legendItems: string[] = [];
    for (const name of Array.from(allLocNames).sort()) {
      const def = defs[name];
      const customAddr = customLocs[name];
      const newLoc = newLocs[name];
      const abbr = def?.abbr || "";
      const hallNo = def?.hallNo || "";
      const addr = newLoc?.address || customAddr || "";

      let parts: string[] = [];
      if (abbr) parts.push(`Abk.: ${escapeHtml(abbr)}`);
      if (hallNo) parts.push(`Halle: ${escapeHtml(hallNo)}`);
      if (addr) parts.push(escapeHtml(addr));

      const detail = parts.length > 0 ? ` (${parts.join(" · ")})` : "";
      legendItems.push(`<li style="margin: 4px 0;"><strong>${escapeHtml(name)}</strong>${detail}</li>`);
    }

    if (legendItems.length === 0) return "";

    return `
      <div style="margin-bottom: 24px; padding: 12px; border: 1px solid #ddd; background: #fafafa;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">${t.legend}</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.5;">
          ${legendItems.join("")}
        </ul>
      </div>
    `;
  })();

  // Build rosters HTML (per session)
  const buildRosterTable = (session: Session): string => {
    const sessionPlayers = players.filter((p) =>
      session.teams.some((team) => p.primaryYouthTeam === team || p.primarySeniorTeam === team || p.defaultTeams?.includes(team))
    );
    const sessionCoaches = coaches.filter((c) =>
      session.teams.some((team) => c.name.includes(team)) // Simple heuristic
    );

    if (sessionPlayers.length === 0 && sessionCoaches.length === 0) {
      return `<p style="font-size: 13px; color: #666;">Kein Kader</p>`;
    }

    let rosterRows = "";
    if (sessionCoaches.length > 0) {
      sessionCoaches.forEach((c) => {
        rosterRows += `
          <tr>
            <td style="${tdCss()}">${escapeHtml(c.name)}</td>
            <td style="${tdCss()}">${escapeHtml(c.role)}</td>
          </tr>
        `;
      });
    }
    if (sessionPlayers.length > 0) {
      sessionPlayers.forEach((p) => {
        const teamLabel = p.primaryYouthTeam || p.primarySeniorTeam || p.defaultTeams?.join(", ") || "";
        rosterRows += `
          <tr>
            <td style="${tdCss()}">${escapeHtml(p.name)}</td>
            <td style="${tdCss()}">${escapeHtml(teamLabel)}</td>
          </tr>
        `;
      });
    }

    return `
      <table style="width: 100%; margin-top: 8px;">
        <thead>
          <tr>
            <th style="${thCss()}">Name</th>
            <th style="${thCss()}">Team/Rolle</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows}
        </tbody>
      </table>
    `;
  };

  // Build sessions table HTML
  let sessionsTableRows = "";
  [...trainingSessions, ...games].forEach((s) => {
    const typeLabel = isGameSession(s) ? t.gameShort : t.trainingShort;
    sessionsTableRows += `
      <tr>
        <td style="${tdCss()}">${escapeHtml(s.date)}</td>
        <td style="${tdCss()}">${escapeHtml(s.day)}</td>
        <td style="${tdCss()}">${typeLabel}</td>
        <td style="${tdCss()}">${escapeHtml(s.teams.join(", "))}</td>
        <td style="${tdCss()}">${escapeHtml(s.time)}</td>
        <td style="${tdCss()}">${escapeHtml(s.location)}</td>
        <td style="${tdCss()}">${escapeHtml(s.info || "")}</td>
      </tr>
      <tr>
        <td colspan="7" style="padding: 12px; border: 1px solid #ccc; background: #fcfcfc;">
          <strong>${t.roster}:</strong>
          ${buildRosterTable(s)}
        </td>
      </tr>
    `;
  });

  return `
    <div class="page">
      ${pageHeaderHtml({ title: "Trainingsübersicht", clubName, logoUrl })}
      ${locationsLegendHtml}
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">Datum</th>
            <th style="${thCss()}">Tag</th>
            <th style="${thCss()}">Typ</th>
            <th style="${thCss()}">Teams</th>
            <th style="${thCss()}">Zeit</th>
            <th style="${thCss()}">Ort</th>
            <th style="${thCss()}">Info</th>
          </tr>
        </thead>
        <tbody>
          ${sessionsTableRows}
        </tbody>
      </table>
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

function renderWeekScheduleOnlyHtml(opts: {
  sessions: Session[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
}): string {
  const { sessions, clubName, locale, locations, logoUrl } = opts;

  const t = locale === "de"
    ? { title: "Trainingswoche", date: "Datum", day: "Tag", type: "Typ", teams: "Teams", time: "Zeit", loc: "Ort", info: "Info",
        trainingShort: "Tr", gameShort: "Sp" }
    : { title: "Training week", date: "Date", day: "Day", type: "Type", teams: "Teams", time: "Time", loc: "Location", info: "Info",
        trainingShort: "Tr", gameShort: "Gm" };

  // Locations legend
  const locationsLegendHtml = (() => {
    const defs = locations?.definitions || {};
    const customLocs = locations?.custom || {};
    const newLocs = locations?.locations || {};
    const allLocNames = new Set<string>();

    sessions.forEach((s) => {
      const loc = s.location || "";
      if (loc && loc !== "TBD") allLocNames.add(loc);
    });
    if (allLocNames.size === 0) return "";

    const resolveAddr = (name: string) => {
      if (newLocs?.[name]?.address) return newLocs[name].address;
      if (name === "BSH") return locations?.bsh || "";
      if (name === "SHP") return locations?.shp || "";
      if (name === "Seminarraum") return locations?.seminarraum || "";
      return customLocs?.[name] || "";
    };

    const items = Array.from(allLocNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const d = defs[name] ?? { abbr: name, name, hallNo: "" };
        const hall = d.hallNo ? ` · Halle ${d.hallNo}` : "";
        const addr = resolveAddr(name);
        const addrShort = addr
          ? addr.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(", ")
          : "";
        return `
          <div style="border:1px solid #eee; padding:6px 8px; border-radius:8px;">
            <div style="font-weight:900; font-size:11px;">${escapeHtml(d.abbr || name)} — ${escapeHtml(d.name || name)}${escapeHtml(hall)}</div>
            ${
              addrShort
                ? `<div style="font-size:10px; color:#555; margin-top:2px;">${escapeHtml(addrShort)}</div>`
                : `<div style="font-size:10px; color:#999; margin-top:2px;">(no address)</div>`
            }
          </div>
        `;
      })
      .join("");

    return `
      <div style="margin: 8px 0 14px 0;">
        <div style="font-weight:900; font-size:11px; margin-bottom:6px;">Orte (im Plan)</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${items}
        </div>
      </div>
    `;
  })();

  const rows = sessions
    .map((s) => {
      const isGame = isGameSession(s);
      const typeLabel = isGame ? t.gameShort : t.trainingShort;
      return `
        <tr style="${isGame ? "background:#F59E0B; color:#111;" : ""}">
          <td style="${tdCss()}">${escapeHtml(s.date)}</td>
          <td style="${tdCss()}">${escapeHtml(s.day)}</td>
          <td style="${tdCss()}">${escapeHtml(typeLabel)}</td>
          <td style="${tdCss()}">${escapeHtml(s.teams.join(", "))}</td>
          <td style="${tdCss()}">${escapeHtml(s.time)}</td>
          <td style="${tdCss()}">${escapeHtml(s.location)}</td>
          <td style="${tdCss()}">${escapeHtml(s.info || "")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="page">
      ${pageHeaderHtml({ title: t.title, clubName, logoUrl })}
      ${locationsLegendHtml}
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">${t.date}</th>
            <th style="${thCss()}">${t.day}</th>
            <th style="${thCss()}">${t.type}</th>
            <th style="${thCss()}">${t.teams}</th>
            <th style="${thCss()}">${t.time}</th>
            <th style="${thCss()}">${t.loc}</th>
            <th style="${thCss()}">${t.info}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

function renderRostersOnlyHtml(opts: {
  sessions: Session[];
  players: Player[];
  clubName: string;
  locale: Lang;
  logoUrl?: string;
}): string {
  const { sessions, players, clubName, locale, logoUrl } = opts;

  const t = locale === "de"
    ? { title: "Kader pro Event", roster: "Kader", none: "Keine Teilnehmer zugewiesen." }
    : { title: "Rosters per event", roster: "Roster", none: "No participants assigned." };

  const blocks = sessions
    .map((s) => {
      const label = `${s.day} · ${s.date} · ${s.time} · ${s.location} · ${s.teams.join(", ")} ${s.info ? `· ${s.info}` : ""}`;
      const assigned = players.filter((p) => s.participants?.includes(p.id));
      if (assigned.length === 0) return `<div style="color:#999; font-size:12px;">${t.none}</div>`;

      const sorted = assigned
        .slice()
        .sort((a, b) => (a.name || "").localeCompare((b.name || ""), locale));

      const rows = sorted
        .map((p, idx) => `
          <tr>
            <td style="${tdCss()} width:28px; text-align:center; font-size:10px; color:#555;">${idx + 1}</td>
            <td style="${tdCss()}">${escapeHtml(p.name)}</td>
          </tr>
        `)
        .join("");

      const rosterTable = `
        <table style="margin-top:8px;">
          <thead>
            <tr>
              <th style="${thCss()} width:28px; text-align:center; font-size:10px;">#</th>
              <th style="${thCss()}">${locale === "de" ? "Name" : "Name"}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      return `
        <div style="border:1px solid #ddd; border-radius:10px; padding:10px 12px; margin-bottom:12px;">
          <div style="font-weight:900; font-size:12px;">${escapeHtml(label)}</div>
          <div style="margin-top:6px;"><strong>${t.roster}:</strong></div>
          ${rosterTable}
        </div>
      `;
    })
    .join("");

  return `
    <div class="page">
      ${pageHeaderHtml({ title: t.title, clubName, logoUrl })}
      ${blocks}
      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

function renderGameSheetHtml(opts: {
  session: Session;
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  logoUrl?: string;
}): string {
  const { session: game, players, coaches, clubName, locale, logoUrl } = opts;
  const teamStr = game.teams.join(" · ");
  const opponent = (game.info || "").replace("vs", "vs.").replace("@", "@");

  // Filter players assigned to this game (participants are string IDs)
  const assignedPlayers = players.filter((p) =>
    game.participants?.includes(p.id)
  );

  // Sort by jersey number (team = first team in game.teams)
  const firstTeam = game.teams[0] || "";
  const sorted = assignedPlayers
    .map((p) => ({
      player: p,
      jersey: p.jerseyByTeam?.[firstTeam] ?? 999,
    }))
    .sort((a, b) => a.jersey - b.jersey)
    .map((x) => x.player);

  // Build 15-row roster (no 1-12/Reserve distinction)
  const lines: (Player | null)[] = [];
  for (let i = 0; i < 15; i++) {
    lines.push(sorted[i] || null);
  }

  const rosterRows = lines
    .map((p, idx) => {
      const full = p?.name ?? "";
      const parts = full.trim().split(/\s+/);
      const vorname = parts.length > 1 ? parts[0] : "";
      const nachname = parts.length > 1 ? parts.slice(1).join(" ") : full;

      const ta = p?.taNumber ?? "";
      const jerseyVal = p?.jerseyByTeam?.[firstTeam] ?? "";

      return `
        <tr>
          <td style="${tdCss()} text-align:center; font-size:10px; color:#555; width:22px;">${idx + 1}</td>
          <td style="${tdCss()} text-align:center; width:44px;">${escapeHtml(String(jerseyVal))}</td>
          <td style="${tdCss()}">${escapeHtml(nachname)}</td>
          <td style="${tdCss()}">${escapeHtml(vorname)}</td>
          <td style="${tdCss()} width:120px;">${escapeHtml(ta)}</td>
          <td style="${tdCss()} text-align:center; width:54px;"></td>
          <td style="${tdCss()} width:170px;"></td>
        </tr>`;
    })
    .join("");

  // Coaches (participants are string IDs)
  const assignedCoaches = coaches.filter((c) =>
    game.participants?.includes(c.id)
  );
  let coachRows = "";
  for (const c of assignedCoaches) {
    coachRows += `
      <tr>
        <td style="${tdCss()}">${escapeHtml(c.name)}</td>
        <td style="${tdCss()}">${escapeHtml(c.license || "")}</td>
      </tr>
    `;
  }

  return `
    <div class="page">
      ${pageHeaderHtml({ title: `Spielbogen: ${teamStr}`, clubName, logoUrl })}
      
      <div style="margin-bottom: 16px;">
        <strong>Spiel:</strong> ${escapeHtml(game.date)} · ${escapeHtml(game.day)} · ${escapeHtml(game.time)}<br/>
        <strong>Ort:</strong> ${escapeHtml(game.location)}<br/>
        <strong>Gegner:</strong> ${escapeHtml(opponent)}
      </div>

      <h3 style="margin-top: 24px; margin-bottom: 8px;">Spieler (15 Plätze)</h3>
      <table>
        <thead>
          <tr>
            <th style="${thCss()} width:22px; text-align:center; font-size:10px;">#</th>
            <th style="${thCss()} width:44px; text-align:center;">Trikot</th>
            <th style="${thCss()}">Nachname</th>
            <th style="${thCss()}">Vorname</th>
            <th style="${thCss()} width:120px;">TA-Nr.</th>
            <th style="${thCss()} width:54px; text-align:center;">Aktiv</th>
            <th style="${thCss()} width:170px;">Notizen</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows}
        </tbody>
      </table>

      <div style="font-size:11px; color:#555; margin-top:8px;">
        Hinweis: Bitte maximal <b>12</b> Spieler als <b>Aktiv</b> markieren. Insgesamt sind <b>15</b> Zeilen für kurzfristige Änderungen vorgesehen.
      </div>

      <h3 style="margin-top: 24px; margin-bottom: 8px;">Trainer</h3>
      <table>
        <thead>
          <tr>
            <th style="${thCss()}">Name</th>
            <th style="${thCss()}">Lizenz</th>
          </tr>
        </thead>
        <tbody>
          ${coachRows || `<tr><td style="${tdCss()}" colspan="2">Keine Trainer zugewiesen</td></tr>`}
        </tbody>
      </table>

      ${pageFooterHtml({ clubName, locale })}
    </div>
  `;
}

interface PrintPage {
  type: "overview" | "rosters" | "game";
  html: string;
  title: string;
}

function buildPrintPages(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
}): PrintPage[] {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;
  const pages: PrintPage[] = [];

  // Seite 1: Trainingsübersicht
  const overviewHtml = renderWeekOverviewHtml({ sessions, players, coaches, clubName, locale, locations, logoUrl });
  pages.push({ type: "overview", html: overviewHtml, title: "Trainingsübersicht" });

  // Seite 2+: Spielbögen
  const games = sessions.filter((s) => isGameSession(s));
  for (const g of games) {
    const html = renderGameSheetHtml({ session: g, players, coaches, clubName, locale, logoUrl });
    const title = `Spielbogen: ${g.teams.join(" · ")} – ${g.info || ""}`;
    pages.push({ type: "game", html, title });
  }

  return pages;
}

function ExportPreview({ pages }: { pages: PrintPage[] }) {
  const [currentPage, setCurrentPage] = React.useState(0);

  if (pages.length === 0) {
    return (
      <div style={{ padding: 16, color: "#999" }}>
        Keine Seiten verfügbar
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
          Seite {currentPage + 1} von {pages.length}
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

function buildPreviewPages(opts: {
  sessions: Session[];
  players: Player[];
  coaches: Coach[];
  clubName: string;
  locale: Lang;
  locations: ThemeLocations;
  logoUrl?: string;
}): PrintPage[] {
  const { sessions, players, coaches, clubName, locale, locations, logoUrl } = opts;

  const pages: PrintPage[] = [];

  // Preview Seite 1: nur Woche (ohne Rosterblöcke)
  pages.push({
    type: "overview",
    html: renderWeekScheduleOnlyHtml({ sessions, clubName, locale, locations, logoUrl }),
    title: locale === "de" ? "Trainingswoche" : "Training week",
  });

  // Preview Seite 2: Rosters pro Event (auf einer eigenen Seite)
  pages.push({
    type: "rosters",
    html: renderRostersOnlyHtml({ sessions, players, clubName, locale, logoUrl }),
    title: locale === "de" ? "Kader pro Event" : "Rosters per event",
  });

  // Preview Seite 3+: Spielbögen
  const games = sessions.filter((s) => isGameSession(s));
  for (const g of games) {
    const html = renderGameSheetHtml({ session: g, players, coaches, clubName, locale, logoUrl });
    const title = `${locale === "de" ? "Spielbogen" : "Game sheet"}: ${g.teams.join(" · ")} – ${g.info || ""}`;
    pages.push({ type: "game", html, title });
  }

  return pages;
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
}: {
  open: boolean;
  layout: "single" | "split";
  topModule: "calendar" | "preview" | "maps" | "none";
  bottomModule: "calendar" | "preview" | "maps" | "none";
  splitPct: number;
  onChangeLayout: (v: "single" | "split") => void;
  onChangeTop: (v: "calendar" | "preview" | "maps" | "none") => void;
  onChangeBottom: (v: "calendar" | "preview" | "maps" | "none") => void;
  onChangeSplitPct: (v: number) => void;
  context: {
    renderCalendar?: () => React.ReactNode;
    previewPages: PrintPage[];
  };
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

  const ModuleSelect = ({
    value,
    onChange,
  }: {
    value: "calendar" | "preview" | "maps" | "none";
    onChange: (v: "calendar" | "preview" | "maps" | "none") => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "calendar" | "preview" | "maps" | "none")}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid var(--ui-border)",
        background: "var(--ui-panel)",
        color: "var(--ui-text)",
        fontWeight: 900,
      }}
    >
      <option value="calendar">Kalender</option>
      <option value="preview">Preview</option>
      <option value="maps">Maps</option>
      <option value="none">—</option>
    </select>
  );

  const renderModule = (m: "calendar" | "preview" | "maps" | "none") => {
    if (m === "none") return <div style={{ color: "var(--ui-muted)", padding: 20 }}>Kein Modul</div>;
    if (m === "calendar") return context.renderCalendar ? context.renderCalendar() : null;
    if (m === "preview")
      return <ExportPreview pages={context.previewPages} />;
    if (m === "maps")
      return (
        <div style={{ padding: 10, color: "var(--ui-muted)" }}>
          Maps-Modul (Platzhalter). Später: Route / Auswahl / Embed.
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
        <div style={{ fontWeight: 950 }}>Rechter Bereich</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => onChangeLayout(layout === "split" ? "single" : "split")}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--ui-border)", background: "transparent", color: "var(--ui-text)", fontWeight: 900, cursor: "pointer" }}
          >
            {layout === "split" ? "Split" : "Single"}
          </button>
        </div>
      </div>

      {/* Body */}
      {layout === "single" ? (
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center" }}>
            <ModuleSelect value={topModule} onChange={onChangeTop} />
          </div>
          <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(topModule)}</div>
        </div>
      ) : (
        <div id="rightSidebarSplitRoot" style={{ position: "relative", minHeight: 0, display: "grid", gridTemplateRows: `${splitPct}fr 10px ${(1 - splitPct)}fr` }}>
          {/* Top */}
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center" }}>
              <ModuleSelect value={topModule} onChange={onChangeTop} />
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
            title="Ziehen zum Resizen"
          />

          {/* Bottom */}
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div style={{ padding: 10, borderBottom: "1px solid var(--ui-border)", display: "flex", gap: 10, alignItems: "center" }}>
              <ModuleSelect value={bottomModule} onChange={onChangeBottom} />
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

// Generate session token for Places API (groups requests for billing)
function generateSessionToken(): string {
  return uid();
}

// Places Autocomplete (New)
async function fetchPlacePredictions(input: string, sessionToken: string) {
  const r = await fetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, sessionToken }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Place Details (New)
async function fetchPlaceDetails(placeId: string, sessionToken: string) {
  const r = await fetch("/api/places/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, sessionToken }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Routes API - compute travel time
async function fetchTravelMinutes(
  originAddress: string,
  destinationAddress: string,
  departureTimeIso?: string
): Promise<number | null> {
  const r = await fetch("/api/routes/compute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originAddress, destinationAddress, departureTimeIso }),
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.minutes as number | null;
}

// Helper: resolve location name to address (legacy + new)
function resolveLocationAddress(location: string, theme: ThemeSettings): string {
  const loc = (location || "").trim();
  const L = theme.locations ?? {};
  if (!loc) return "";

  // Check new locations format first
  if (L.locations?.[loc]?.address) return L.locations[loc].address;

  // Legacy fallback
  if (loc === "BSH") return L.bsh ?? "";
  if (loc === "SHP") return L.shp ?? "";
  if (loc === "Seminarraum") return L.seminarraum ?? "";

  return L.custom?.[loc] ?? "";
}

// Helper: resolve location name to Place ID
function resolveLocationPlaceId(location: string, theme: ThemeSettings): string {
  const loc = (location || "").trim();
  const L = theme.locations ?? {};
  if (!loc) return "";
  return L.locations?.[loc]?.placeId ?? "";
}

// Helper: get location options for dropdown (presets + saved + custom)
type LocationOption = {
  value: string;   // session.location
  label: string;   // Anzeige im Dropdown
  kind: "preset" | "saved" | "custom";
};

function getLocationOptions(theme: ThemeSettings): LocationOption[] {
  const L = theme.locations ?? {};
  const locs = L.locations ?? {}; // { [name]: { address, placeId } }
  const defs = L.definitions ?? {}; // { [name]: { abbr, name, hallNo } }

  const presetNames = ["BSH", "SHP", "Seminarraum"];

  const presets: LocationOption[] = presetNames.map((name) => {
    const d = defs[name] ?? { abbr: name, name, hallNo: "" };
    const hall = d.hallNo ? ` • Halle ${d.hallNo}` : "";
    const abbr = d.abbr && d.abbr !== name ? ` (${d.abbr})` : "";
    return { value: name, label: `${d.name || name}${abbr}${hall}`, kind: "preset" };
  });

  const savedNames = Object.keys(locs)
    .filter((n) => !presetNames.includes(n))
    .sort((a, b) => a.localeCompare(b));

  const saved: LocationOption[] = savedNames.map((name) => {
    const d = defs[name] ?? { abbr: "", name, hallNo: "" };
    const hall = d.hallNo ? ` • Halle ${d.hallNo}` : "";
    const abbr = d.abbr ? ` (${d.abbr})` : "";
    return { value: name, label: `${d.name || name}${abbr}${hall}`, kind: "saved" };
  });

  return [
    ...presets,
    ...saved,
    { value: "__CUSTOM__", label: "— Custom / Freitext —", kind: "custom" },
  ];
}

// Helper: ensure custom location is saved to locations list
function ensureLocationSaved(
  theme: ThemeSettings,
  setTheme: (t: ThemeSettings) => void,
  rawName: string
) {
  const name = String(rawName ?? "").trim().replace(/\s+/g, " "); // normalize whitespace
  if (!name) return;

  const L = theme.locations ?? {};
  const locs = { ...(L.locations ?? {}) };
  const defs = { ...(L.definitions ?? {}) };

  // Wenn schon vorhanden: nichts kaputtmachen
  if (!locs[name]) {
    locs[name] = { address: "", placeId: "" }; // bewusst leer => kein Maps-Zwang
  }

  if (!defs[name]) {
    defs[name] = { abbr: "", name, hallNo: "" };
  }

  setTheme({
    ...theme,
    locations: {
      ...L,
      locations: locs,
      definitions: defs,
    },
  });
}

// Helper: get cached travel time (TTL 7 days)
function getCachedTravelMinutes(
  homePlaceId: string,
  destPlaceId: string,
  theme: ThemeSettings
): number | null {
  const cache = theme.locations?.travelCache ?? {};
  const key = `${homePlaceId}|${destPlaceId}|DRIVE`;
  const entry = cache[key];
  if (!entry) return null;

  const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days
  const age = Date.now() - entry.cachedAt;
  if (age > ttl) return null;

  return entry.minutes;
}

// Helper: cache travel time
function setCachedTravelMinutes(
  homePlaceId: string,
  destPlaceId: string,
  minutes: number,
  theme: ThemeSettings,
  setTheme: (t: ThemeSettings) => void
) {
  const key = `${homePlaceId}|${destPlaceId}|DRIVE`;
  setTheme({
    ...theme,
    locations: {
      ...(theme.locations ?? {}),
      travelCache: {
        ...(theme.locations?.travelCache ?? {}),
        [key]: { minutes, cachedAt: Date.now() },
      },
    },
  });
}

/* ============================================================
   APP
   ============================================================ */

const LAST_PLAN_STORAGE_KEY = "ubc_last_weekplan_v1";

export default function App() {
  /* ============================================================
    STATE (useState...)
    ============================================================ */

  /* ----------------------
     Theme
     ---------------------- */
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = safeParseTheme(typeof window !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null);
    return saved ? migrateLegacyBlueTheme(saved) : DEFAULT_THEME;
  });

  useEffect(() => {
    setTheme((prev) => {
      const next = migrateLegacyBlueTheme(prev);
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

  type RightModule = "calendar" | "preview" | "maps" | "none";
  type RightLayout = "single" | "split";
  type LeftTab = "players" | "coaches" | "locations";

  type UiState = {
    settingsOpen: boolean;
    eventEditorOpen: boolean;
    rightOpen: boolean;
    rightLayout: RightLayout;
    rightTop: RightModule;
    rightBottom: RightModule;
    rightSplitPct: number;
    openGroup: GroupId | null;
    openExtra: null | "U18_ONLY" | "HOL_ONLY";
    leftTab: LeftTab;
    leftEditMode: boolean;
    openLocationName: string | null;
    autoTravelLoading: boolean;
    rosterOpen: boolean;
    newWeekOpen: boolean;
  };

  const [uiState, setUiState] = useState<UiState>({
    settingsOpen: false,
    eventEditorOpen: true,
    rightOpen: true,
    rightLayout: "split",
    rightTop: "calendar",
    rightBottom: "preview",
    rightSplitPct: 0.55,
    openGroup: null,
    openExtra: null,
    leftTab: "players",
    leftEditMode: false,
    openLocationName: null,
    autoTravelLoading: false,
    rosterOpen: false,
    newWeekOpen: false,
  });

  const {
    settingsOpen,
    eventEditorOpen,
    rightOpen,
    rightLayout,
    rightTop,
    rightBottom,
    rightSplitPct,
    openGroup,
    openExtra,
    leftTab,
    leftEditMode,
    openLocationName,
    autoTravelLoading,
    rosterOpen,
    newWeekOpen,
  } = uiState;

  function setUiField<K extends keyof UiState>(key: K, value: React.SetStateAction<UiState[K]>) {
    setUiState((prev) => ({
      ...prev,
      [key]: typeof value === "function" ? (value as (p: UiState[K]) => UiState[K])(prev[key]) : value,
    }));
  }

  const setSettingsOpen = (value: React.SetStateAction<boolean>) => setUiField("settingsOpen", value);
  const setEventEditorOpen = (value: React.SetStateAction<boolean>) => setUiField("eventEditorOpen", value);
  const setRightOpen = (value: React.SetStateAction<boolean>) => setUiField("rightOpen", value);
  const setRightLayout = (value: React.SetStateAction<RightLayout>) => setUiField("rightLayout", value);
  const setRightTop = (value: React.SetStateAction<RightModule>) => setUiField("rightTop", value);
  const setRightBottom = (value: React.SetStateAction<RightModule>) => setUiField("rightBottom", value);
  const setRightSplitPct = (value: React.SetStateAction<number>) => setUiField("rightSplitPct", value);
  const setOpenGroup = (value: React.SetStateAction<GroupId | null>) => setUiField("openGroup", value);
  const setOpenExtra = (value: React.SetStateAction<null | "U18_ONLY" | "HOL_ONLY">) => setUiField("openExtra", value);
  const setLeftTab = (value: React.SetStateAction<LeftTab>) => setUiField("leftTab", value);
  const setLeftEditMode = (value: React.SetStateAction<boolean>) => setUiField("leftEditMode", value);
  const setOpenLocationName = (value: React.SetStateAction<string | null>) => setUiField("openLocationName", value);
  const setAutoTravelLoading = (value: React.SetStateAction<boolean>) => setUiField("autoTravelLoading", value);
  const setRosterOpen = (value: React.SetStateAction<boolean>) => setUiField("rosterOpen", value);
  const setNewWeekOpen = (value: React.SetStateAction<boolean>) => setUiField("newWeekOpen", value);

  type SettingsState = {
    confirmDialog: { open: boolean; title: string; message: string };
    selectedPlayerId: string | null;
    rosterSearch: string;
  };

  const [settingsState, setSettingsState] = useState<SettingsState>({
    confirmDialog: {
      open: false,
      title: "Bestätigung",
      message: "",
    },
    selectedPlayerId: null,
    rosterSearch: "",
  });

  const { confirmDialog, selectedPlayerId, rosterSearch } = settingsState;

  function setSettingsField<K extends keyof SettingsState>(
    key: K,
    value: React.SetStateAction<SettingsState[K]>
  ) {
    setSettingsState((prev) => ({
      ...prev,
      [key]: typeof value === "function" ? (value as (p: SettingsState[K]) => SettingsState[K])(prev[key]) : value,
    }));
  }

  const setConfirmDialog = (value: React.SetStateAction<SettingsState["confirmDialog"]>) =>
    setSettingsField("confirmDialog", value);
  const setSelectedPlayerId = (value: React.SetStateAction<string | null>) =>
    setSettingsField("selectedPlayerId", value);
  const setRosterSearch = (value: React.SetStateAction<string>) => setSettingsField("rosterSearch", value);

  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  function askConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ open: true, title, message });
    });
  }

  function resolveConfirm(value: boolean) {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    resolver?.(value);
  }

    /* ============================================================
      EFFECTS (useEffect...)
      ============================================================ */

    /* ----------------------
      Right Sidebar
      ---------------------- */

  useEffect(() => {
    const raw = localStorage.getItem("right_sidebar_v1");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (typeof s.rightOpen === "boolean") setRightOpen(s.rightOpen);
      if (s.rightLayout === "single" || s.rightLayout === "split") setRightLayout(s.rightLayout);
      if (["calendar","preview","maps","none"].includes(s.rightTop)) setRightTop(s.rightTop);
      if (["calendar","preview","maps","none"].includes(s.rightBottom)) setRightBottom(s.rightBottom);
      if (typeof s.rightSplitPct === "number") setRightSplitPct(Math.max(0.2, Math.min(0.8, s.rightSplitPct)));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "right_sidebar_v1",
      JSON.stringify({ rightOpen, rightLayout, rightTop, rightBottom, rightSplitPct })
    );
  }, [rightOpen, rightLayout, rightTop, rightBottom, rightSplitPct]);

  /* ----------------------
     Staff / Coaches
     ---------------------- */
  const [coaches, setCoaches] = useState<Coach[]>(() => {
    const saved = safeParseStaff(typeof window !== "undefined" ? localStorage.getItem(STAFF_STORAGE_KEY) : null);
    return saved ?? DEFAULT_STAFF;
  });

  useEffect(() => {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(coaches));
  }, [coaches]);

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
      .map((c: any) => ({
        id: String(c.id ?? randomId("c_")),
        name: String(c.name ?? ""),
        role: String(c.role ?? "Coach"),
        license: c.license !== undefined ? String(c.license ?? "") : "",
      }))
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
  const normalizedRoster = useMemo(() => normalizeRoster(rosterRaw as any), []);
  const [rosterMeta, setRosterMeta] = useState<{ season: string; ageGroups: any }>({
    season: normalizedRoster.season,
    ageGroups: normalizedRoster.ageGroups,
  });

  const [players, setPlayers] = useState<Player[]>(() => normalizedRoster.players);

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
  const masterPlan = useMemo(() => normalizeMasterWeek(weekMasterRaw as any), []);

  const [plan, setPlan] = useState<WeekPlan>(() => {
    const savedRaw = typeof window !== "undefined" ? localStorage.getItem(LAST_PLAN_STORAGE_KEY) : null;
    if (savedRaw) {
      try {
        const obj = JSON.parse(savedRaw);
        if (obj && typeof obj === "object" && Array.isArray(obj.sessions)) {
          const sessions: Session[] = obj.sessions.map((s: any) => ({
            id: String(s.id),
            date: String(s.date ?? ""),
            day: String(s.day ?? ""),
            teams: Array.isArray(s.teams) ? s.teams.map((x: any) => String(x)) : [],
            time: normalizeDash(String(s.time ?? "")),
            location: String(s.location ?? ""),
            info: s.info !== undefined && s.info !== null ? String(s.info) : null,
            warmupMin: s.warmupMin !== undefined && s.warmupMin !== null ? Number(s.warmupMin) : null,
            travelMin: s.travelMin !== undefined && s.travelMin !== null ? Number(s.travelMin) : null,
            participants: Array.isArray(s.participants) ? s.participants.map((x: any) => String(x)) : [],
            kaderLabel: s.kaderLabel ? String(s.kaderLabel) : undefined,
          }));
          sessions.sort((a, b) => {
            const ad = a.date.localeCompare(b.date);
            if (ad !== 0) return ad;
            return a.time.localeCompare(b.time);
          });
          return { weekId: String(obj.weekId ?? "LAST"), sessions };
        }
      } catch {
        // ignore
      }
    }
    return masterPlan;
  });

  useEffect(() => {
    localStorage.setItem(LAST_PLAN_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

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
  type SessionConflict = {
    sessionId: string; // where conflict exists
    playerId: string;
    otherSessionId: string;
  };

  function sessionsOverlap(a: Session, b: Session): boolean {
    if (!a.date || !b.date) return false;
    if (a.date !== b.date) return false;

    const ra = splitTimeRange(a.time ?? "");
    const rb = splitTimeRange(b.time ?? "");
    if (!ra || !rb) return false;

    const [aStart, aEnd] = ra;
    const [bStart, bEnd] = rb;

    // start-only (game): do not treat as overlap participant conflict
    if (aStart === aEnd || bStart === bEnd) return false;

    const aS = parseInt(aStart.slice(0, 2), 10) * 60 + parseInt(aStart.slice(3, 5), 10);
    const aE = parseInt(aEnd.slice(0, 2), 10) * 60 + parseInt(aEnd.slice(3, 5), 10);
    const bS = parseInt(bStart.slice(0, 2), 10) * 60 + parseInt(bStart.slice(3, 5), 10);
    const bE = parseInt(bEnd.slice(0, 2), 10) * 60 + parseInt(bEnd.slice(3, 5), 10);

    // overlap if intervals intersect (strict)
    return aS < bE && bS < aE;
  }

  function computeConflictsBySession(plan: WeekPlan): Map<string, SessionConflict[]> {
    const res = new Map<string, SessionConflict[]>();
    for (const s of plan.sessions) res.set(s.id, []);

    // For each player, find overlapping sessions they are assigned to
    const sessions = plan.sessions.slice();
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        if (!sessionsOverlap(a, b)) continue;

        const aSet = new Set(a.participants ?? []);
        const bSet = new Set(b.participants ?? []);

        for (const pid of aSet) {
          if (!bSet.has(pid)) continue;
          // same player in overlapping sessions => conflict on both sessions
          res.get(a.id)!.push({ sessionId: a.id, playerId: pid, otherSessionId: b.id });
          res.get(b.id)!.push({ sessionId: b.id, playerId: pid, otherSessionId: a.id });
        }
      }
    }

    return res;
  }

  const removePlayerFromSession = useCallback((sessionId: string, playerId: string) => {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const next = (s.participants ?? []).filter((id) => id !== playerId).sort(sortParticipants);
        return { ...s, participants: next };
      }),
    }));
  }, [sortParticipants]);


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

    if (game) {
      if (formWarmupMin <= 0) setFormWarmupMin(90);

      if (away) {
        if (formTravelMin <= 0) setFormTravelMin(90);
      } else {
        if (formTravelMin !== 0) setFormTravelMin(0);
      }
    } else {
      if (formWarmupMin !== 0) setFormWarmupMin(0);
      if (formTravelMin !== 0) setFormTravelMin(0);
    }
  }, [formOpponent, formWarmupMin, formTravelMin]);

  function isGameInfo(info: string | null | undefined): boolean {
    const t = String(info ?? "").trim().toLowerCase();
    return t.startsWith("vs") || t.startsWith("@") || t.includes(" vs ") || t.includes(" @ ");
  }

  function currentLocationValue(): string {
    if (locationMode === "__CUSTOM__") return (customLocation || "").trim() || "—";
    return locationMode;
  }

  const onToggleTeam = useCallback((t: string) => {
    setFormTeams((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }, [setFormTeams]);

  const resetForm = useCallback(() => {
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
  }, [setCustomLocation, setEditingSessionId, setFormDate, setFormDuration, setFormOpponent, setFormStart, setFormTeams, setFormTravelMin, setFormWarmupMin, setLocationMode]);

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

  const onEditSession = useCallback((s: Session) => {
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
    const isKnownLocation = LOCATION_PRESETS.includes(loc as any) || savedLocations.includes(loc);
    
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
  }, [theme.locations?.locations]);

  const onDeleteSession = useCallback(async (sessionId: string) => {
    const s = plan.sessions.find((x) => x.id === sessionId);
    const label = s ? `${s.day} ${s.date} | ${(s.teams ?? []).join("/")} | ${s.time}` : sessionId;
    if (!(await askConfirm(t("delete"), tf("confirmDeleteEvent", { label })))) return;

    setPlan((prev) => ({ ...prev, sessions: prev.sessions.filter((x) => x.id !== sessionId) }));
    if (editingSessionId === sessionId) resetForm();
  }, [askConfirm, editingSessionId, plan.sessions, resetForm, t, tf]);

  const toggleSessionTravel = useCallback((sessionId: string) => {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const cur = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));
        const next = cur > 0 ? 0 : 30;
        return { ...s, travelMin: next };
      }),
    }));
  }, []);

  const toggleSessionWarmup = useCallback((sessionId: string) => {
    setPlan((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const cur = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));
        const next = cur > 0 ? 0 : 30;
        return { ...s, warmupMin: next };
      }),
    }));
  }, []);

  const handleOpenEventEditor = useCallback((eventId: string) => {
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
  }, [onEditSession, plan.sessions]);

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
      firstName: "Vorname",
      lastName: "Name",
      name: "Vorname Name",
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
    let normalized = { season: "", ageGroups: null as any, players: [] as Player[] };

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

  const closeNewWeek = useMemo(() => () => setNewWeekOpen(false), []);

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
                    title="Bearbeitungsmodus für die aktuelle Liste"
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
                    Gruppe klicken → aufklappen. Spieler ziehen → rechts droppen.
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
      <span>U18 (nur)</span>
      <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
        {u18OnlyPlayers.length} Player
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
      <span>HOL (nur)</span>
      <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
        {holOnlyPlayers.length} Player
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
                      const groupRightLabel = g.id === "TBD" ? "To be determined" : `${arr.length} Player`;

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
                    <div style={{ fontSize: 18, fontWeight: 900 }}>Coaches</div>
                    {leftEditMode && (
                      <Button variant="outline" onClick={addCoach} style={{ padding: "8px 10px" }}>
                        + Coach
                      </Button>
                    )}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="outline" onClick={exportStaff} style={{ padding: "8px 10px" }}>
                      Export staff.json
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => staffFileRef.current?.click()}
                      style={{ padding: "8px 10px" }}
                    >
                      Import staff.json
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
                              löschen
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
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>Name</div>
                              <Input value={c.name} onChange={(v) => updateCoach(c.id, { name: v })} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>Rolle</div>
                              <Input value={c.role} onChange={(v) => updateCoach(c.id, { role: v })} />
                            </div>
                            <div style={{ gridColumn: "1 / span 2" }}>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>Lizenznummer</div>
                              <Input
                                value={c.license ?? ""}
                                onChange={(v) => updateCoach(c.id, { license: v })}
                                placeholder="z.B. B-23273"
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
                />
              )}
            </div>

            {/* RIGHT */}
            <div className="rightPane" style={{ padding: 16, overflow: "auto", background: "var(--ui-bg)" }}>
              {/* Top bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {/* Left: Flag Button */}
                <div>
                  <Button
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
                      fontSize: 18,
                      lineHeight: "18px",
                      fontFamily: `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui, -apple-system, "Segoe UI", Roboto, Arial`,
                      fontVariantEmoji: "emoji" as any,
                      textTransform: "none",
                    }}
                  >
                    <span role="img" aria-label={theme.locale === "de" ? "Deutsch" : "English"}>
                      {theme.locale === "de" ? "🇩🇪" : "🇬🇧"}
                    </span>
                  </Button>
                </div>

                {/* Right: Other Buttons */}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <Button
                    variant={eventEditorOpen ? "solid" : "outline"}
                    onClick={() => setEventEditorOpen((v) => !v)}
                    style={{ padding: "8px 10px" }}
                  >
                    📝 Event
                  </Button>
                  <Button variant="outline" onClick={() => setNewWeekOpen(true)} style={{ padding: "8px 10px" }}>
                    {t("newWeek")}
                  </Button>
                  <Button
                    variant={rightOpen ? "solid" : "outline"}
                    onClick={() => setRightOpen((v) => !v)}
                    title="Rechte Leiste ein-/ausblenden"
                    style={{ padding: "8px 10px" }}
                  >
                    📌 Right
                  </Button>
                  <Button
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
                  <Input id="event_form_date" type="date" value={formDate} onChange={setFormDate} />

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
                      const locationOptions = getLocationOptions(theme);
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
                          <option value="">— auswählen —</option>
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
                          placeholder="Custom Ort (z.B. 'Parkplatz Halle', 'Fitness Studio XY', ...)"
                        />

                        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 11, color: "var(--ui-muted)", fontWeight: 800 }}>
                            Custom Orte sind ohne Maps/Adresse nutzbar. Optional kannst du sie als Ort speichern.
                          </div>

                          {(() => {
                            const name = customLocation.trim().replace(/\s+/g, " ");
                            const locationOptions = getLocationOptions(theme);
                            const alreadyExists = locationOptions.some(
                              (o) => o.value.toLowerCase() === name.toLowerCase() && o.kind !== "custom"
                            );

                            if (alreadyExists && name) {
                              return (
                                <div style={{ fontSize: 11, color: "var(--ui-accent)", fontWeight: 900, whiteSpace: "nowrap" }}>
                                  ✓ Ort existiert bereits
                                </div>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!name) return;

                                  ensureLocationSaved(theme, setTheme, name);

                                  // Optional: direkt auf „Orte" springen und aufklappen
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
                                title="Speichert den Custom-Ort in deiner Orte-Liste (ohne Google/PlaceId)."
                              >
                                Als Ort speichern
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontWeight: 900 }}>Start</div>
                  <Input type="time" value={formStart} onChange={setFormStart} />

                  <div style={{ fontWeight: 900 }}>{t("duration")} (Min)</div>
                  <MinutePicker
                    value={formDuration}
                    onChange={setFormDuration}
                    presets={[60, 90, 120]}
                    allowZero={false}
                    placeholder="z. B. 90"
                  />

                  <div style={{ fontWeight: 900 }}>Event/Gegner</div>
                  <Input ref={opponentInputRef} value={formOpponent} onChange={setFormOpponent} placeholder='z.B. "vs Vechta" oder "@ Paderborn"' />

                  {(() => {
                    const info = normalizeOpponentInfo(formOpponent);
                    const game = isGameInfo(info);
                    const away = info.startsWith("@");
                    if (!game) return null;

                    return (
                      <>
                        <div style={{ fontWeight: 900 }}>Treffen + Warm-up (Min)</div>
                        <MinutePicker
                          value={formWarmupMin}
                          onChange={setFormWarmupMin}
                          presets={[45, 60, 75, 90, 105, 120]}
                          allowZero={false}
                          placeholder="z. B. 90"
                        />

                        {away && (
                          <>
                            <div style={{ fontWeight: 900 }}>Reisezeit (Min)</div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <MinutePicker
                                value={formTravelMin}
                                onChange={setFormTravelMin}
                                presets={[30, 45, 60, 75, 90, 105, 120, 150]}
                                allowZero={true}
                                placeholder="z. B. 90"
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
                                        ? "Reisezeit automatisch berechnen (Google Routes API via Proxy)"
                                        : "Adresse im Orte-Panel hinterlegen"
                                    }
                                    style={{
                                      ...segBtn(false),
                                      padding: "8px 10px",
                                      fontSize: 12,
                                      opacity: canAutoTravel ? 1 : 0.5,
                                      cursor: canAutoTravel && !autoTravelLoading ? "pointer" : "not-allowed",
                                    }}
                                  >
                                    {autoTravelLoading ? "⏳ Berechne..." : "🚗 Auto-Reisezeit"}
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
                    {editingSessionId ? "Änderungen speichern" : "Event hinzufügen"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Reset</Button>

                  <div style={{ marginLeft: "auto", color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                    {(() => {
                      const info = normalizeOpponentInfo(formOpponent);
                      const dur = isGameInfo(info) ? 120 : formDuration;
                      return (
                        <>Vorschau: {formStart}–{addMinutesToHHMM(formStart, dur)} | {currentLocationValue()}</>
                      );
                    })()}
                    {normalizeOpponentInfo(formOpponent) ? ` | ${normalizeOpponentInfo(formOpponent)}` : ""}
                  </div>
                </div>
              </div>
              </EventEditorModal>

              {/* Week plan board */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Wochenplan</div>
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
                      onSelect={onEditSession}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 900, color: "var(--ui-text)" }}>
                            {s.day} • {s.date}
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
                              Konflikt: {uniquePlayers.length}
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
                              Hinweis: {flaggedIds.length} (History)
                            </div>
                          );
                        })()}

                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "var(--ui-text)", fontWeight: 900 }}>
                            {(s.participants ?? []).length} Spieler
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                            <Button variant="outline" onClick={() => onEditSession(s)} style={{ padding: "8px 10px" }}>
                              edit
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => onDeleteSession(s.id)}
                              style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                            >
                              löschen
                            </Button>
                          </div>
                        </div>
                      </div>

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
                            />
                          );
                        })}
                        {(s.participants ?? []).length === 0 && (
                          <div style={{ color: "var(--ui-muted)", fontSize: 13, fontWeight: 800 }}>
                            Spieler hier ablegen
                          </div>
                        )}
                      </div>
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
                      roster={players as any[]}
                      lang={lang}
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
      />

      {/* Roster Editor Modal */}
      {rosterOpen && (
        <Modal title="Roster editieren (roster.json)" onClose={() => setRosterOpen(false)}>
          <div className="rosterGrid">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                <div className="flexRow">
                  <Button onClick={addNewPlayer} style={{ padding: "8px 10px" }}>+ Spieler</Button>
                  <Button variant="outline" onClick={exportRoster} style={{ padding: "8px 10px" }}>
                    Export roster.json
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => rosterFileRef.current?.click()}
                    style={{ padding: "8px 10px" }}
                  >
                    Import roster.json
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
                  Hinweis: TBD wird automatisch geführt und nicht exportiert/importiert.
                </div>
              </div>

              <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Spieler</div>
                <Input
                  value={rosterSearch}
                  onChange={setRosterSearch}
                  placeholder="Suchen: Name, TA, Jahrgang, Geburtsdatum…"
                  style={{ marginBottom: 8 }}
                />
                <div style={{ fontSize: 12, color: "var(--ui-muted)", fontWeight: 800, marginBottom: 8 }}>
                  Filter: {rosterSearch.trim() ? `"${rosterSearch.trim()}"` : "—"}
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
                          title={tna ? `Primary TA/TNA: ${tna}` : "Keine TA/TNA"}
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
                  Wähle links einen Spieler.
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
                        löschen
                      </Button>
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>Vorname</div>
                        <Input value={selectedPlayer.firstName ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { firstName: v })} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>Name</div>
                        <Input value={selectedPlayer.lastName ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { lastName: v })} />
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>Geburtsjahr (für Jahrgang)</div>
                        <Input
                          type="number"
                          value={String(selectedPlayer.birthYear ?? "")}
                          onChange={(v) => updatePlayer(selectedPlayer.id, { birthYear: v ? parseInt(v, 10) : undefined })}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>Geburtsdatum (optional)</div>
                        <Input type="date" value={selectedPlayer.birthDate ?? ""} onChange={(v) => updatePlayer(selectedPlayer.id, { birthDate: v })} />
                      </div>

                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>Gruppe</div>
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
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>LP (Local Player)</div>
                        <Select
                          value={selectedPlayer.isLocalPlayer ? "true" : "false"}
                          onChange={(v) => updatePlayer(selectedPlayer.id, { isLocalPlayer: v === "true" })}
                          options={[
                            { value: "true", label: "LP: Ja" },
                            { value: "false", label: "LP: Nein" },
                          ]}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 12, borderTop: `1px solid var(--ui-border)`, paddingTop: 12 }}>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>Lizenzen / TA (DBB & NBBL)</div>

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
                            ⚠️ DBB-TA ↔ Geburtsdatum stimmt nicht: {check?.reason}
                          </div>
                        );
                      })()}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>DBB TNA</div>
                          <Input
                            value={(selectedPlayer.lizenzen ?? []).find((x) => String(x.typ).toUpperCase() === "DBB")?.tna ?? ""}
                            onChange={(v) => {
                              const list = [...(selectedPlayer.lizenzen ?? [])].filter((x) => String(x.typ).toUpperCase() !== "DBB");
                              if (v.trim()) list.push({ typ: "DBB", tna: v.trim(), verein: "UBC Münster" });
                              updatePlayer(selectedPlayer.id, { lizenzen: list });
                            }}
                            placeholder="z.B. 280209020"
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>NBBL TNA</div>
                          <Input
                            value={(selectedPlayer.lizenzen ?? []).find((x) => String(x.typ).toUpperCase() === "NBBL")?.tna ?? ""}
                            onChange={(v) => {
                              const list = [...(selectedPlayer.lizenzen ?? [])].filter((x) => String(x.typ).toUpperCase() !== "NBBL");
                              if (v.trim()) list.push({ typ: "NBBL", tna: v.trim(), verein: "UBC Münster" });
                              updatePlayer(selectedPlayer.id, { lizenzen: list });
                            }}
                            placeholder="z.B. 280209070"
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
                        Info: Spieler-ID bleibt stabil (roster.id). TA/TNA kann fehlen (Probetraining) und wird später nachgetragen.
                      </div>
                    </div>
                  </div>

                  <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Positionen (Multi-Auswahl)</div>
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
  <div style={{ fontWeight: 900, marginBottom: 8 }}>Default Teams</div>

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
    Wird für Gruppenlogik (Herren) + zukünftige Spiel-Exports genutzt.
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
  <div style={{ fontWeight: 900, marginBottom: 8 }}>Trikotnummern (pro Team)</div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr",
      gap: 10,
      alignItems: "center",
    }}
  >
    {TEAM_OPTIONS.map((t) => {
      const current = selectedPlayer.jerseyByTeam ?? {};
      const value = current[t];

      return (
        <div key={t} style={{ display: "contents" }}>
          <div style={{ fontWeight: 900 }}>{t}</div>
          <Input
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(v) => {
              const next = { ...(selectedPlayer.jerseyByTeam ?? {}) } as Record<string, number | null>;
              const trimmed = (v ?? "").trim();
              next[t] = trimmed ? parseInt(trimmed, 10) : null;
              updatePlayer(selectedPlayer.id, { jerseyByTeam: next });
            }}
            placeholder="z.B. 12"
          />
        </div>
      );
    })}
  </div>

  <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
    Wird im Spiel-Export genutzt. Leer = keine Nummer hinterlegt.
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
    <div style={{ fontWeight: 900 }}>History (letzte 6 Spiele)</div>

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
      + Eintrag
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
          placeholder='z.B. "vs Vechta" / "@ Paderborn"'
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
          löschen
        </Button>
      </div>
    ))}
  </div>

  <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
    Optional – dient als „letzte 6“ Referenz im Kader-Editor (später auch als Tooltip/Export erweiterbar).
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