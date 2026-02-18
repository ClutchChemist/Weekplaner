import { useReducer, type SetStateAction } from "react";
import { appReducer } from "./appReducer";
import type { AppState } from "./types";

const initialAppUiState: AppState = {
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
};

function resolveStateAction<T>(value: SetStateAction<T>, prev: T): T {
  return typeof value === "function" ? (value as (p: T) => T)(prev) : value;
}

export function useAppUiState() {
  const [appUiState, dispatchUi] = useReducer(appReducer, initialAppUiState);

  const setSettingsOpen = (value: SetStateAction<boolean>) => {
    dispatchUi({ type: "SET_SETTINGS_OPEN", value: resolveStateAction(value, appUiState.settingsOpen) });
  };
  const setEventEditorOpen = (value: SetStateAction<boolean>) => {
    dispatchUi({
      type: "SET_EVENT_EDITOR_OPEN",
      value: resolveStateAction(value, appUiState.eventEditorOpen),
    });
  };
  const setRightOpen = (value: SetStateAction<boolean>) => {
    dispatchUi({
      type: "SET_RIGHT_SIDEBAR_OPEN",
      value: resolveStateAction(value, appUiState.rightSidebarOpen),
    });
  };
  const setNewWeekOpen = (value: SetStateAction<boolean>) => {
    dispatchUi({ type: "SET_NEW_WEEK_OPEN", value: resolveStateAction(value, appUiState.newWeekOpen) });
  };
  const setRightLayout = (value: SetStateAction<AppState["rightLayout"]>) => {
    dispatchUi({ type: "SET_RIGHT_LAYOUT", value: resolveStateAction(value, appUiState.rightLayout) });
  };
  const setRightTop = (value: SetStateAction<AppState["rightTop"]>) => {
    dispatchUi({ type: "SET_RIGHT_TOP", value: resolveStateAction(value, appUiState.rightTop) });
  };
  const setRightBottom = (value: SetStateAction<AppState["rightBottom"]>) => {
    dispatchUi({ type: "SET_RIGHT_BOTTOM", value: resolveStateAction(value, appUiState.rightBottom) });
  };
  const setRightSplitPct = (value: SetStateAction<number>) => {
    dispatchUi({ type: "SET_RIGHT_SPLIT_PCT", value: resolveStateAction(value, appUiState.rightSplitPct) });
  };
  const setOpenGroup = (value: SetStateAction<AppState["openGroup"]>) => {
    dispatchUi({ type: "SET_OPEN_GROUP", value: resolveStateAction(value, appUiState.openGroup) });
  };
  const setOpenExtra = (value: SetStateAction<AppState["openExtra"]>) => {
    dispatchUi({ type: "SET_OPEN_EXTRA", value: resolveStateAction(value, appUiState.openExtra) });
  };
  const setLeftTab = (value: SetStateAction<AppState["leftTab"]>) => {
    dispatchUi({ type: "SET_LEFT_TAB", value: resolveStateAction(value, appUiState.leftTab) });
  };
  const setLeftEditMode = (value: SetStateAction<boolean>) => {
    dispatchUi({ type: "SET_LEFT_EDIT_MODE", value: resolveStateAction(value, appUiState.leftEditMode) });
  };
  const setOpenLocationName = (value: SetStateAction<string | null>) => {
    dispatchUi({
      type: "SET_OPEN_LOCATION_NAME",
      value: resolveStateAction(value, appUiState.openLocationName),
    });
  };
  const setRosterOpen = (value: SetStateAction<boolean>) => {
    dispatchUi({ type: "SET_ROSTER_OPEN", value: resolveStateAction(value, appUiState.rosterOpen) });
  };
  const setAutoTravelLoading = (value: SetStateAction<boolean>) => {
    dispatchUi({
      type: "SET_AUTO_TRAVEL_LOADING",
      value: resolveStateAction(value, appUiState.autoTravelLoading),
    });
  };
  const setConfirmDialog = (value: SetStateAction<AppState["confirmDialog"]>) => {
    dispatchUi({
      type: "SET_CONFIRM_DIALOG",
      value: resolveStateAction(value, appUiState.confirmDialog),
    });
  };
  const setRosterSearch = (value: SetStateAction<string>) => {
    dispatchUi({ type: "SET_ROSTER_SEARCH", value: resolveStateAction(value, appUiState.rosterSearch) });
  };
  const setSelectedPlayerId = (value: SetStateAction<string | null>) => {
    dispatchUi({
      type: "SET_SELECTED_PLAYER_ID",
      value: resolveStateAction(value, appUiState.selectedPlayerId),
    });
  };

  return {
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
  };
}
