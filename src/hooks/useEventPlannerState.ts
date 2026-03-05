import { useState } from "react";
import type { CalendarEvent as Session } from "@/types";
import { addMinutesToHHMM, weekdayShortDE } from "@/utils/date";
import { isGameInfo, normalizeOpponentInfo, stripAutoMeetingSuffix } from "@/utils/session";
import { randomId } from "@/utils/id";
import { BASE_TEAM_OPTIONS } from "@/utils/team";

export const TEAM_OPTIONS = [...BASE_TEAM_OPTIONS];

export const LOCATION_PRESETS = ["BSH", "SHP", "Seminarraum"] as const;

export type LocationMode = string;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

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
  formExcludeFromRoster: boolean;
  formRowColor: string;
};

const INITIAL_EDITOR_STATE: EditorState = {
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
  formExcludeFromRoster: false,
  formRowColor: "",
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function resolveStateAction<T>(
  value: T | ((prev: T) => T),
  prev: T
): T {
  return typeof value === "function" ? (value as (p: T) => T)(prev) : value;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventPlannerState() {
  const [editorState, setEditorState] = useState<EditorState>(INITIAL_EDITOR_STATE);

  function setEditorField<K extends keyof EditorState>(
    key: K,
    value: EditorState[K] | ((prev: EditorState[K]) => EditorState[K])
  ) {
    setEditorState((prev) => ({
      ...prev,
      [key]: resolveStateAction(value, prev[key]),
    }));
  }

  const setEditingSessionId = (value: string | null | ((prev: string | null) => string | null)) =>
    setEditorField("editingSessionId", value);
  const setFormDate = (value: string | ((prev: string) => string)) => setEditorField("formDate", value);
  const setFormTeams = (value: string[] | ((prev: string[]) => string[])) => setEditorField("formTeams", value);
  const setLocationMode = (value: LocationMode | ((prev: LocationMode) => LocationMode)) =>
    setEditorField("locationMode", value);
  const setCustomLocation = (value: string | ((prev: string) => string)) => setEditorField("customLocation", value);
  const setFormStart = (value: string | ((prev: string) => string)) => setEditorField("formStart", value);
  const setFormDuration = (value: number | ((prev: number) => number)) => setEditorField("formDuration", value);
  const setFormWarmupMin = (value: number | ((prev: number) => number)) => setEditorField("formWarmupMin", value);
  const setFormTravelMin = (value: number | ((prev: number) => number)) => setEditorField("formTravelMin", value);
  const setFormExcludeFromRoster = (value: boolean | ((prev: boolean) => boolean)) =>
    setEditorField("formExcludeFromRoster", value);
  const setFormRowColor = (value: string | ((prev: string) => string)) => setEditorField("formRowColor", value);

  const setFormOpponent = (value: string | ((prev: string) => string)) => {
    setEditorState((prev) => {
      const nextOpponent = resolveStateAction(value, prev.formOpponent);
      const info = normalizeOpponentInfo(nextOpponent);
      const game = isGameInfo(info);
      const away = info.startsWith("@");

      let nextWarmupMin = prev.formWarmupMin;
      let nextTravelMin = prev.formTravelMin;

      if (game) {
        // Heimspiel: kein Travel
        if (!away) nextTravelMin = 0;
      } else {
        // Kein Spieltermin: Warmup und Travel auf 0 zurücksetzen
        nextWarmupMin = 0;
        nextTravelMin = 0;
      }

      return {
        ...prev,
        formOpponent: nextOpponent,
        formWarmupMin: nextWarmupMin,
        formTravelMin: nextTravelMin,
      };
    });
  };

  function currentLocationValue(): string {
    if (editorState.locationMode === "__CUSTOM__") return (editorState.customLocation || "").trim() || "-";
    return editorState.locationMode;
  }

  function onToggleTeam(team: string) {
    setFormTeams((prev) => (prev.includes(team) ? prev.filter((x) => x !== team) : [...prev, team]));
  }

  /** Reset all form fields back to their initial defaults (single setState → 1 re-render). */
  function resetForm() {
    setEditorState({
      ...INITIAL_EDITOR_STATE,
      formDate: new Date().toISOString().slice(0, 10),
    });
  }

  function buildSessionFromForm(existingId?: string, keepParticipants?: string[]): Session {
    const rawInfo = normalizeOpponentInfo(stripAutoMeetingSuffix(editorState.formOpponent));
    const game = isGameInfo(rawInfo);
    const duration = game ? 120 : editorState.formDuration;
    const end = addMinutesToHHMM(editorState.formStart, duration);
    const away = rawInfo.startsWith("@");
    const warmup = Math.max(0, Math.floor(editorState.formWarmupMin));
    const travel = away ? Math.max(0, Math.floor(editorState.formTravelMin)) : 0;
    const meetingOffset = game ? warmup + travel : 0;
    const meetingTime = addMinutesToHHMM(editorState.formStart, -meetingOffset);
    const info = game ? `${rawInfo} | Treffpunkt: ${meetingTime}` : rawInfo;

    return {
      id: existingId ?? randomId("sess_"),
      date: editorState.formDate,
      day: weekdayShortDE(editorState.formDate),
      teams: [...editorState.formTeams].sort((a, b) => a.localeCompare(b, "de")),
      // FIX: use en-dash "–" consistently (normalizeDash handles both on read-back)
      time: `${editorState.formStart}–${end}`,
      location: currentLocationValue(),
      info: info || null,
      warmupMin: game ? Math.max(0, Math.floor(editorState.formWarmupMin)) : null,
      travelMin: game ? Math.max(0, Math.floor(editorState.formTravelMin)) : null,
      participants: keepParticipants ?? [],
      excludeFromRoster: editorState.formExcludeFromRoster,
      rowColor: editorState.formRowColor || undefined,
    };
  }

  return {
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
  };
}
