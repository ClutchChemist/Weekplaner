// src/state/appReducer.ts
import type { AppState, ThemeState, WeekPlan, Player, Lang } from "./types";

export type Action =
  | { type: "SET_LANG"; lang: Lang }
  | { type: "SET_THEME"; theme: ThemeState }
  | { type: "SET_ROSTER"; roster: Player[] }
  | { type: "SET_WEEKPLAN"; weekPlan: WeekPlan }
  | { type: "TOGGLE_RIGHT_SIDEBAR" }
  | { type: "OPEN_MODAL"; modal: AppState["activeModal"] }
  | { type: "CLOSE_MODAL" };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_LANG":
      return { ...state, lang: action.lang };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_ROSTER":
      return { ...state, roster: action.roster };
    case "SET_WEEKPLAN":
      return { ...state, weekPlan: action.weekPlan };
    case "TOGGLE_RIGHT_SIDEBAR":
      return { ...state, rightSidebarOpen: !state.rightSidebarOpen };
    case "OPEN_MODAL":
      return { ...state, activeModal: action.modal };
    case "CLOSE_MODAL":
      return { ...state, activeModal: null };
    default:
      return state;
  }
}
