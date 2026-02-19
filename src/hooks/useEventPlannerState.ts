import { useState } from "react";
import type { CalendarEvent as Session } from "@/types";
import { addMinutesToHHMM, weekdayShortDE } from "@/utils/date";
import { isGameInfo, normalizeOpponentInfo } from "@/utils/session";
import { randomId } from "@/utils/id";

export const TEAM_OPTIONS = ["U18", "NBBL", "HOL", "1RLH"];

export const LOCATION_PRESETS = ["BSH", "SHP", "Seminarraum"] as const;

export type LocationMode = string;

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

function resolveStateAction<T>(
  value: T | ((prev: T) => T),
  prev: T
): T {
  return typeof value === "function" ? (value as (p: T) => T)(prev) : value;
}

export function useEventPlannerState() {
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

  const setFormOpponent = (value: string | ((prev: string) => string)) => {
    setEditorState((prev) => {
      const nextOpponent = resolveStateAction(value, prev.formOpponent);
      const info = normalizeOpponentInfo(nextOpponent);
      const game = isGameInfo(info);
      const away = info.startsWith("@");

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

      return {
        ...prev,
        formOpponent: nextOpponent,
        formWarmupMin: nextWarmupMin,
        formTravelMin: nextTravelMin,
      };
    });
  };

  function currentLocationValue(): string {
    if (editorState.locationMode === "__CUSTOM__") return (editorState.customLocation || "").trim() || "—";
    return editorState.locationMode;
  }

  function onToggleTeam(team: string) {
    setFormTeams((prev) => (prev.includes(team) ? prev.filter((x) => x !== team) : [...prev, team]));
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
    const info = normalizeOpponentInfo(editorState.formOpponent);
    const game = isGameInfo(info);
    const duration = game ? 120 : editorState.formDuration;
    const end = addMinutesToHHMM(editorState.formStart, duration);

    return {
      id: existingId ?? randomId("sess_"),
      date: editorState.formDate,
      day: weekdayShortDE(editorState.formDate),
      teams: [...editorState.formTeams].sort((a, b) => a.localeCompare(b, "de")),
      time: `${editorState.formStart}–${end}`,
      location: currentLocationValue(),
      info: info || null,
      warmupMin: game ? Math.max(0, Math.floor(editorState.formWarmupMin)) : null,
      travelMin: game ? Math.max(0, Math.floor(editorState.formTravelMin)) : null,
      participants: keepParticipants ?? [],
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
    currentLocationValue,
    onToggleTeam,
    resetForm,
    buildSessionFromForm,
  };
}
