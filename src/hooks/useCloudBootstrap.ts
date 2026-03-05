import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ThemeSettings } from "@/types";
import type { CloudSnapshotV1, SavedProfile } from "@/state/profileTypes";
import { listCloudSnapshots } from "@/utils/cloudSync";
import { randomId } from "@/utils/id";
import { DEFAULT_THEME } from "@/state/themeDefaults";

type Args = {
    cloudConfigured: boolean;
    cloudUserEmail: string | null;
    isCloudSnapshotV1: (raw: unknown) => raw is CloudSnapshotV1;
    profiles: SavedProfile[];
    activeProfileId: string | null;
    currentProfilePayload: SavedProfile["payload"];
    buildNewProfilePayload: () => SavedProfile["payload"];
    setProfiles: Dispatch<SetStateAction<SavedProfile[]>>;
    setActiveProfileId: Dispatch<SetStateAction<string>>;
    setCloudBootstrapPendingProfileId: Dispatch<SetStateAction<string | null>>;
    setCloudProfileStatusMsg: Dispatch<SetStateAction<string>>;
    t: (key: string) => string;
};

/**
 * Handles the one-time Cloud Bootstrap flow after sign-in:
 * - Lists snapshots from cloud
 * - Merges cloud profiles with local profiles
 * - Uploads a first snapshot if none exist remotely
 *
 * Extracted from App.tsx to reduce component size.
 */
export function useCloudBootstrap({
    cloudConfigured,
    cloudUserEmail,
    isCloudSnapshotV1,
    profiles,
    activeProfileId,
    currentProfilePayload,
    buildNewProfilePayload,
    setProfiles,
    setActiveProfileId,
    setCloudBootstrapPendingProfileId,
    setCloudProfileStatusMsg,
    t,
}: Args) {
    const cloudFirstSetupDoneForEmailRef = useRef<string | null>(null);

    // Bootstrap: list snapshots and merge profiles on sign-in
    useEffect(() => {
        if (!cloudConfigured || !cloudUserEmail) {
            setCloudProfileStatusMsg("");
            return;
        }
        if (cloudFirstSetupDoneForEmailRef.current === cloudUserEmail) return;
        let cancelled = false;

        void (async () => {
            try {
                const cloudRows = await listCloudSnapshots();
                if (cancelled) return;

                const cloudProfiles: SavedProfile[] = [];
                for (const row of cloudRows) {
                    if (!isCloudSnapshotV1(row.snapshot)) continue;
                    const snap = row.snapshot;
                    cloudProfiles.push({
                        id: row.profileId || snap.profileId,
                        name: snap.profileName || row.profileId || t("profileNamePlaceholder"),
                        payload: {
                            rosterMeta: snap.data.rosterMeta,
                            players: snap.data.players,
                            coaches: snap.data.coaches,
                            locations: (snap.data.theme.locations ?? DEFAULT_THEME.locations!) as NonNullable<ThemeSettings["locations"]>,
                            clubLogoDataUrl: snap.data.clubLogoDataUrl ?? null,
                            theme: snap.data.theme,
                            plan: snap.data.plan,
                        },
                        sync: { mode: "cloud", provider: "supabase", autoSync: true },
                    });
                }

                if (cloudProfiles.length === 0) {
                    // No cloud data yet – push local profile to cloud
                    let bootstrapProfileId = "";
                    if (profiles.length > 0) {
                        const source = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
                        bootstrapProfileId = source.id;
                        setProfiles((prev) =>
                            prev.map((p) =>
                                p.id === source.id
                                    ? {
                                        ...p,
                                        payload: currentProfilePayload,
                                        sync: { ...p.sync, mode: "cloud", provider: "supabase" },
                                    }
                                    : p
                            )
                        );
                    } else {
                        bootstrapProfileId = randomId("profile_");
                        const starter: SavedProfile = {
                            id: bootstrapProfileId,
                            name: t("profileDefaultName"),
                            payload: buildNewProfilePayload(),
                            sync: { mode: "cloud", provider: "supabase", autoSync: true },
                        };
                        setProfiles([starter]);
                    }

                    if (bootstrapProfileId) {
                        setActiveProfileId(bootstrapProfileId);
                        setCloudBootstrapPendingProfileId(bootstrapProfileId);
                    }

                    cloudFirstSetupDoneForEmailRef.current = cloudUserEmail;
                    return;
                }

                // Merge cloud profiles into local state
                setProfiles((prev) => {
                    const byId = new Map(prev.map((p) => [p.id, p] as const));
                    for (const cloudProfile of cloudProfiles) {
                        const existing = byId.get(cloudProfile.id);
                        byId.set(cloudProfile.id, {
                            ...(existing ?? cloudProfile),
                            ...cloudProfile,
                            sync: {
                                mode: "cloud",
                                provider: "supabase",
                                autoSync: existing?.sync.autoSync ?? cloudProfile.sync.autoSync,
                            },
                        });
                    }
                    return Array.from(byId.values());
                });

                setActiveProfileId((prev) => prev || cloudProfiles[0].id);
                cloudFirstSetupDoneForEmailRef.current = cloudUserEmail;
                setCloudProfileStatusMsg("");
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err ?? "");
                const full = `${t("cloudProfileSyncError")}: ${msg || "unknown error"}`;
                setCloudProfileStatusMsg(full);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        activeProfileId,
        cloudConfigured,
        cloudUserEmail,
        currentProfilePayload,
        buildNewProfilePayload,
        isCloudSnapshotV1,
        profiles,
        setActiveProfileId,
        setCloudBootstrapPendingProfileId,
        setCloudProfileStatusMsg,
        setProfiles,
        t,
    ]);
}

/**
 * Triggers a cloud snapshot upload after a bootstrap profile was created.
 */
export function useCloudBootstrapUpload({
    cloudBootstrapPendingProfileId,
    activeProfileId,
    cloudSyncEnabledForActiveProfile,
    cloudUserEmail,
    saveSnapshotToCloud,
    setCloudBootstrapPendingProfileId,
}: {
    cloudBootstrapPendingProfileId: string | null;
    activeProfileId: string | null;
    cloudSyncEnabledForActiveProfile: boolean;
    cloudUserEmail: string | null;
    saveSnapshotToCloud: (silent?: boolean) => Promise<boolean>;
    setCloudBootstrapPendingProfileId: Dispatch<SetStateAction<string | null>>;
}) {
    useEffect(() => {
        if (!cloudBootstrapPendingProfileId) return;
        if (activeProfileId !== cloudBootstrapPendingProfileId) return;
        if (!cloudSyncEnabledForActiveProfile || !cloudUserEmail) return;

        void saveSnapshotToCloud(false).finally(() => {
            setCloudBootstrapPendingProfileId(null);
        });
    }, [
        activeProfileId,
        cloudBootstrapPendingProfileId,
        cloudSyncEnabledForActiveProfile,
        cloudUserEmail,
        saveSnapshotToCloud,
        setCloudBootstrapPendingProfileId,
    ]);
}
