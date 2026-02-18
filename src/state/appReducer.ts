// src/state/appReducer.ts
import type { AppState } from "./types";

export type Action =
  | { type: "SET_SETTINGS_OPEN"; value: boolean }
  | { type: "SET_EVENT_EDITOR_OPEN"; value: boolean }
  | { type: "SET_NEW_WEEK_OPEN"; value: boolean }
  | { type: "SET_RIGHT_SIDEBAR_OPEN"; value: boolean }
  | { type: "SET_RIGHT_LAYOUT"; value: AppState["rightLayout"] }
  | { type: "SET_RIGHT_TOP"; value: AppState["rightTop"] }
  | { type: "SET_RIGHT_BOTTOM"; value: AppState["rightBottom"] }
  | { type: "SET_RIGHT_SPLIT_PCT"; value: number }
  | { type: "SET_OPEN_GROUP"; value: AppState["openGroup"] }
  | { type: "SET_OPEN_EXTRA"; value: AppState["openExtra"] }
  | { type: "SET_LEFT_TAB"; value: AppState["leftTab"] }
  | { type: "SET_LEFT_EDIT_MODE"; value: boolean }
  | { type: "SET_OPEN_LOCATION_NAME"; value: string | null }
  | { type: "SET_ROSTER_OPEN"; value: boolean }
  | { type: "SET_AUTO_TRAVEL_LOADING"; value: boolean }
  | { type: "SET_CONFIRM_DIALOG"; value: AppState["confirmDialog"] }
  | { type: "SET_ROSTER_SEARCH"; value: string }
  | { type: "SET_SELECTED_PLAYER_ID"; value: string | null }
  | { type: "TOGGLE_RIGHT_SIDEBAR" }
  | { type: "RESET_UI"; payload?: Partial<AppState> };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_SETTINGS_OPEN":
      return { ...state, settingsOpen: action.value };
    case "SET_EVENT_EDITOR_OPEN":
      return { ...state, eventEditorOpen: action.value };
    case "SET_NEW_WEEK_OPEN":
      return { ...state, newWeekOpen: action.value };
    case "SET_RIGHT_SIDEBAR_OPEN":
      return { ...state, rightSidebarOpen: action.value };
    case "SET_RIGHT_LAYOUT":
      return { ...state, rightLayout: action.value };
    case "SET_RIGHT_TOP":
      return { ...state, rightTop: action.value };
    case "SET_RIGHT_BOTTOM":
      return { ...state, rightBottom: action.value };
    case "SET_RIGHT_SPLIT_PCT":
      return { ...state, rightSplitPct: action.value };
    case "SET_OPEN_GROUP":
      return { ...state, openGroup: action.value };
    case "SET_OPEN_EXTRA":
      return { ...state, openExtra: action.value };
    case "SET_LEFT_TAB":
      return { ...state, leftTab: action.value };
    case "SET_LEFT_EDIT_MODE":
      return { ...state, leftEditMode: action.value };
    case "SET_OPEN_LOCATION_NAME":
      return { ...state, openLocationName: action.value };
    case "SET_ROSTER_OPEN":
      return { ...state, rosterOpen: action.value };
    case "SET_AUTO_TRAVEL_LOADING":
      return { ...state, autoTravelLoading: action.value };
    case "SET_CONFIRM_DIALOG":
      return { ...state, confirmDialog: action.value };
    case "SET_ROSTER_SEARCH":
      return { ...state, rosterSearch: action.value };
    case "SET_SELECTED_PLAYER_ID":
      return { ...state, selectedPlayerId: action.value };
    case "TOGGLE_RIGHT_SIDEBAR":
      return { ...state, rightSidebarOpen: !state.rightSidebarOpen };
    case "RESET_UI":
      return {
        settingsOpen: false,
        eventEditorOpen: false,
        newWeekOpen: false,
        rightSidebarOpen: true,
        rightLayout: "split",
        rightTop: "calendar",
        rightBottom: "preview",
        rightSplitPct: 0.55,
        openGroup: null,
        openExtra: null,
        leftTab: "players",
        leftEditMode: false,
        openLocationName: null,
        rosterOpen: false,
        autoTravelLoading: false,
        confirmDialog: { open: false, title: "Bestätigung", message: "" },
        rosterSearch: "",
        selectedPlayerId: null,
        ...(action.payload ?? {}),
      };
    default:
      return state;
  }
}
