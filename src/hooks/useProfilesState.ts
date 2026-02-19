import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Coach, Player, ThemeSettings } from "@/types";
import {
  ACTIVE_PROFILE_STORAGE_KEY,
  DEFAULT_PROFILE_SYNC,
  PROFILES_STORAGE_KEY,
  safeParseProfiles,
  type ProfilePayload,
  type SavedProfile,
} from "@/state/profileTypes";
import { randomId } from "@/utils/id";
import { usePersistedState } from "./usePersistedState";

type Args = {
  t: (k: string) => string;
  tf: (k: string, vars?: Record<string, string | number>) => string;
  rosterMeta: { season: string; ageGroups: unknown };
  players: Player[];
  coaches: Coach[];
  locations: NonNullable<ThemeSettings["locations"]>;
  clubLogoStorageKey: string;
  clubLogoMaxBytes: number;
  onApplyProfileData: (payload: ProfilePayload) => void;
};

export function useProfilesState({
  t,
  tf,
  rosterMeta,
  players,
  coaches,
  locations,
  clubLogoStorageKey,
  clubLogoMaxBytes,
  onApplyProfileData,
}: Args) {
  const [profiles, setProfiles] = useState<SavedProfile[]>(() =>
    safeParseProfiles(typeof window !== "undefined" ? localStorage.getItem(PROFILES_STORAGE_KEY) : null)
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "" : ""
  );
  const [profileHydratedId, setProfileHydratedId] = useState<string | null>(null);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [logoUploadError, setLogoUploadError] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const [clubLogoDataUrl, setClubLogoDataUrl] = usePersistedState<string | null>(
    clubLogoStorageKey,
    null,
    (savedRaw) => {
      try {
        const parsed = JSON.parse(savedRaw);
        return typeof parsed === "string" || parsed === null ? parsed : null;
      } catch {
        return null;
      }
    }
  );

  const activeProfileName = useMemo(
    () => profiles.find((p) => p.id === activeProfileId)?.name ?? null,
    [profiles, activeProfileId]
  );
  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );
  const activeProfileSync = activeProfile?.sync ?? DEFAULT_PROFILE_SYNC;

  const currentProfilePayload = useMemo<ProfilePayload>(() => {
    return {
      rosterMeta,
      players,
      coaches,
      locations,
      clubLogoDataUrl,
    };
  }, [rosterMeta, players, coaches, locations, clubLogoDataUrl]);

  const applyProfile = useCallback(
    (profile: SavedProfile) => {
      onApplyProfileData(profile.payload);
      setClubLogoDataUrl(profile.payload.clubLogoDataUrl ?? null);
    },
    [onApplyProfileData, setClubLogoDataUrl]
  );

  const handleClubLogoUpload = useCallback(
    (file: File) => {
      setLogoUploadError("");

      if (!file.type.startsWith("image/")) {
        setLogoUploadError(t("logoUploadChooseImage"));
        return;
      }
      if (file.size > clubLogoMaxBytes) {
        const maxKb = Math.round(clubLogoMaxBytes / 1024);
        setLogoUploadError(tf("logoUploadTooLarge", { maxKb }));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          setLogoUploadError(t("logoUploadReadError"));
          return;
        }
        setClubLogoDataUrl(reader.result);
        setLogoUploadError("");
      };
      reader.onerror = () => {
        setLogoUploadError(t("logoUploadReadError"));
      };
      reader.readAsDataURL(file);
    },
    [clubLogoMaxBytes, setClubLogoDataUrl, t, tf]
  );

  const createProfile = useCallback(() => {
    const name = profileNameInput.trim();
    if (!name) return;
    const id = randomId("profile_");
    const entry: SavedProfile = {
      id,
      name,
      payload: currentProfilePayload,
      sync: { ...DEFAULT_PROFILE_SYNC },
    };
    setProfiles((prev) => [...prev, entry]);
    setProfileHydratedId(id);
    setActiveProfileId(id);
    setProfileNameInput("");
  }, [profileNameInput, currentProfilePayload]);

  const updateActiveProfile = useCallback(() => {
    if (!activeProfileId) return;
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? {
              ...p,
              name: profileNameInput.trim() || p.name,
              payload: currentProfilePayload,
            }
          : p
      )
    );
  }, [activeProfileId, currentProfilePayload, profileNameInput]);

  const deleteActiveProfile = useCallback(() => {
    if (!activeProfileId) return;
    setProfiles((prev) => prev.filter((p) => p.id !== activeProfileId));
    setProfileHydratedId(null);
    setActiveProfileId("");
  }, [activeProfileId]);

  const selectProfile = useCallback(
    (id: string) => {
      if (!id) {
        setProfileHydratedId(null);
        setActiveProfileId("");
        return;
      }
      setActiveProfileId(id);
      const hit = profiles.find((p) => p.id === id);
      if (hit) {
        applyProfile(hit);
        setProfileNameInput(hit.name);
        setProfileHydratedId(id);
      }
    },
    [profiles, applyProfile]
  );

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

  useEffect(() => {
    if (!activeProfileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileHydratedId(null);
      return;
    }
    if (profileHydratedId === activeProfileId) return;

    const hit = profiles.find((p) => p.id === activeProfileId);
    if (!hit) return;

    applyProfile(hit);
    setProfileNameInput(hit.name);
    setProfileHydratedId(activeProfileId);
  }, [activeProfileId, profileHydratedId, profiles, applyProfile]);

  useEffect(() => {
    if (!activeProfileId || profileHydratedId !== activeProfileId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === activeProfileId);
      if (idx < 0) return prev;
      const cur = prev[idx];
      if (JSON.stringify(cur.payload) === JSON.stringify(currentProfilePayload)) return prev;
      const copy = [...prev];
      copy[idx] = { ...cur, payload: currentProfilePayload };
      return copy;
    });
  }, [activeProfileId, profileHydratedId, currentProfilePayload]);

  return {
    profiles,
    setProfiles,
    activeProfileId,
    setActiveProfileId,
    profileHydratedId,
    setProfileHydratedId,
    profilesOpen,
    setProfilesOpen,
    profileNameInput,
    setProfileNameInput,
    logoUploadError,
    profileMenuOpen,
    setProfileMenuOpen,
    profileMenuRef,
    clubLogoDataUrl,
    setClubLogoDataUrl,
    activeProfileName,
    activeProfileSync,
    currentProfilePayload,
    handleClubLogoUpload,
    createProfile,
    updateActiveProfile,
    deleteActiveProfile,
    selectProfile,
  };
}