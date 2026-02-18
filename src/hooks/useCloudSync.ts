import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentCloudUser,
  isCloudSyncConfigured,
  loadCloudSnapshot,
  onCloudAuthStateChange,
  saveCloudSnapshot,
  sendCloudMagicLink,
  signOutCloud,
} from "@/utils/cloudSync";

type UseCloudSyncArgs<TSnapshot> = {
  t: (k: string) => string;
  profileId: string | null;
  enabled: boolean;
  autoSyncEnabled: boolean;
  onAutoSyncChange: (next: boolean) => void;
  buildSnapshot: () => TSnapshot;
  applySnapshot: (snapshot: TSnapshot) => void;
  isSnapshot: (raw: unknown) => raw is TSnapshot;
  autoSyncSignal: string;
};

export function useCloudSync<TSnapshot>({
  t,
  profileId,
  enabled,
  autoSyncEnabled,
  onAutoSyncChange,
  buildSnapshot,
  applySnapshot,
  isSnapshot,
  autoSyncSignal,
}: UseCloudSyncArgs<TSnapshot>) {
  const [cloudEmailInput, setCloudEmailInput] = useState("");
  const [cloudStatusMsg, setCloudStatusMsg] = useState("");
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudLastSyncAt, setCloudLastSyncAt] = useState<string | null>(null);

  const cloudHydratingRef = useRef(false);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const cloudConfigured = useMemo(() => isCloudSyncConfigured(), []);

  useEffect(() => {
    if (!cloudConfigured) return;

    getCurrentCloudUser()
      .then((u) => {
        setCloudUserEmail(u?.email ?? null);
      })
      .catch(() => {
        setCloudUserEmail(null);
      });

    const unsubscribe = onCloudAuthStateChange((email) => {
      setCloudUserEmail(email);
      if (!email) setCloudLastSyncAt(null);
    });

    return unsubscribe;
  }, [cloudConfigured]);

  const saveSnapshotToCloud = useCallback(
    async (silent = false) => {
      if (!cloudConfigured) {
        if (!silent) setCloudStatusMsg(t("cloudNotConfigured"));
        return false;
      }
      if (!cloudUserEmail) {
        if (!silent) setCloudStatusMsg(t("cloudPleaseSignIn"));
        return false;
      }
      if (!profileId) {
        if (!silent) setCloudStatusMsg(t("cloudProfileRequired"));
        return false;
      }
      if (!enabled) {
        if (!silent) setCloudStatusMsg(t("cloudSyncDisabledForProfile"));
        return false;
      }

      if (!silent) setCloudBusy(true);
      try {
        const snapshot = buildSnapshot();
        await saveCloudSnapshot(profileId, snapshot);
        const when = new Date().toISOString();
        setCloudLastSyncAt(when);
        if (!silent) setCloudStatusMsg(t("cloudSaveSuccess"));
        return true;
      } catch (err) {
        if (!silent) {
          const msg = err instanceof Error ? err.message : String(err);
          setCloudStatusMsg(`${t("cloudSaveError")}: ${msg}`);
        }
        return false;
      } finally {
        if (!silent) setCloudBusy(false);
      }
    },
    [buildSnapshot, cloudConfigured, cloudUserEmail, enabled, profileId, t]
  );

  const loadSnapshotFromCloud = useCallback(async () => {
    if (!cloudConfigured) {
      setCloudStatusMsg(t("cloudNotConfigured"));
      return;
    }
    if (!cloudUserEmail) {
      setCloudStatusMsg(t("cloudPleaseSignIn"));
      return;
    }
    if (!profileId) {
      setCloudStatusMsg(t("cloudProfileRequired"));
      return;
    }
    if (!enabled) {
      setCloudStatusMsg(t("cloudSyncDisabledForProfile"));
      return;
    }

    setCloudBusy(true);
    try {
      const data = await loadCloudSnapshot(profileId);
      if (!data) {
        setCloudStatusMsg(t("cloudNoSnapshot"));
        return;
      }

      if (!isSnapshot(data.snapshot)) {
        setCloudStatusMsg(t("cloudInvalidSnapshot"));
        return;
      }

      cloudHydratingRef.current = true;
      applySnapshot(data.snapshot);
      setCloudLastSyncAt(data.updatedAt ?? null);
      setCloudStatusMsg(t("cloudLoadSuccess"));
      window.setTimeout(() => {
        cloudHydratingRef.current = false;
      }, 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudStatusMsg(`${t("cloudLoadError")}: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [applySnapshot, cloudConfigured, cloudUserEmail, enabled, isSnapshot, profileId, t]);

  const signInToCloud = useCallback(async () => {
    if (!cloudConfigured) {
      setCloudStatusMsg(t("cloudNotConfigured"));
      return;
    }

    const email = cloudEmailInput.trim();
    if (!email) {
      setCloudStatusMsg(t("cloudEnterEmail"));
      return;
    }

    setCloudBusy(true);
    try {
      await sendCloudMagicLink(email);
      setCloudStatusMsg(t("cloudMagicLinkSent"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudStatusMsg(`${t("cloudMagicLinkError")}: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [cloudConfigured, cloudEmailInput, t]);

  const signOutFromCloud = useCallback(async () => {
    setCloudBusy(true);
    try {
      await signOutCloud();
      setCloudStatusMsg(t("cloudSignedOut"));
      setCloudUserEmail(null);
      setCloudLastSyncAt(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudStatusMsg(`${t("cloudSignOutError")}: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [t]);

  const toggleCloudAutoSync = useCallback(() => {
    onAutoSyncChange(!autoSyncEnabled);
  }, [autoSyncEnabled, onAutoSyncChange]);

  useEffect(() => {
    if (!cloudConfigured || !enabled || !autoSyncEnabled || !cloudUserEmail || !profileId) return;
    if (cloudHydratingRef.current) return;

    if (cloudSyncTimerRef.current != null) {
      window.clearTimeout(cloudSyncTimerRef.current);
    }

    cloudSyncTimerRef.current = window.setTimeout(() => {
      void saveSnapshotToCloud(true);
    }, 1800);

    return () => {
      if (cloudSyncTimerRef.current != null) {
        window.clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = null;
      }
    };
  }, [cloudConfigured, enabled, autoSyncEnabled, cloudUserEmail, profileId, saveSnapshotToCloud, autoSyncSignal]);

  return {
    cloudConfigured,
    cloudEmailInput,
    cloudStatusMsg,
    cloudUserEmail,
    cloudBusy,
    cloudLastSyncAt,
    cloudAutoSync: autoSyncEnabled,
    setCloudEmailInput,
    signInToCloud,
    signOutFromCloud,
    loadSnapshotFromCloud,
    saveSnapshotToCloud,
    toggleCloudAutoSync,
  };
}
