export type { ProfilePayload } from "../state/profileTypes";
export { birthYearOf } from "../state/playerMeta";

// Types
export * from "../state/types";
export type { Lang, I18nKey } from "../i18n/types";
export type { GroupId } from "../config";
export type { SavedProfile, ProfileSyncMode, CloudSnapshotV1 } from "../state/profileTypes";
export type { WeekArchiveEntry } from "../state/weekArchive";

// Profile helpers
export { DEFAULT_PROFILE_SYNC, safeParseProfiles } from "../state/profileTypes";
export { WEEK_ARCHIVE_STORAGE_KEY, safeParseWeekArchive } from "../state/weekArchive";

// PlayerMeta helpers (explicit, to avoid shadowing/duplicates)
export {
	makeParticipantSorter,
	isCorePlayer,
	getPlayerGroup,
	isU18Only,
	isHolOnly,
	planDateSet,
	isBirthdayOnAnyPlanDate,
	enrichPlayersWithBirthFromDBBTA,
	birthYearOf
} from "../state/playerMeta";

// Theme defaults
export * from "../state/themeDefaults";
export { GROUPS } from "../state/themeDefaults";

// Storage keys
export * from "../state/storageKeys";
export {
	CLUB_LOGO_STORAGE_KEY,
	PROFILES_STORAGE_KEY,
	ACTIVE_PROFILE_STORAGE_KEY,
	WEEK_ARCHIVE_STORAGE_KEY,
	THEME_STORAGE_KEY,
	STAFF_STORAGE_KEY,
	LAST_PLAN_STORAGE_KEY
} from "../state/storageKeys";

// PromptDialogState
export type { ConfirmDialogState } from "../state/types";
export type PromptDialogState = { open: boolean; title: string; message: string; value: string; placeholder: string };
