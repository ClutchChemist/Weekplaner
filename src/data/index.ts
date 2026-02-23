// Centralized data imports for App.tsx and other consumers
import rosterRaw from "../data/roster.json";
import weekMasterRaw from "../data/weekplan_master.json";

// 128 KB logo size limit (can be adjusted as needed)
export const CLUB_LOGO_MAX_BYTES = 128 * 1024;

export { rosterRaw, weekMasterRaw };