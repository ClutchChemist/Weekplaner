import type { Lang } from "@/types";
import { Button, Input } from "@/components/ui";
import type { ProfileSyncMode } from "@/state/profileTypes";

type Props = {
  t: (k: string) => string;
  lang: Lang;
  hasActiveProfile: boolean;
  profileName: string | null;
  syncMode: ProfileSyncMode;
  onSyncModeChange: (mode: ProfileSyncMode) => void;
  cloudConfigured: boolean;
  cloudUserEmail: string | null;
  cloudEmailInput: string;
  cloudStatusMsg: string;
  cloudLastSyncAt: string | null;
  cloudBusy: boolean;
  cloudAutoSync: boolean;
  onEmailInputChange: (v: string) => void;
  onSignIn: () => void;
  onLoad: () => void;
  onSave: () => void;
  onToggleAutoSync: () => void;
  onSignOut: () => void;
};

export function ProfileCloudSyncPanel({
  t,
  lang,
  hasActiveProfile,
  profileName,
  syncMode,
  onSyncModeChange,
  cloudConfigured,
  cloudUserEmail,
  cloudEmailInput,
  cloudStatusMsg,
  cloudLastSyncAt,
  cloudBusy,
  cloudAutoSync,
  onEmailInputChange,
  onSignIn,
  onLoad,
  onSave,
  onToggleAutoSync,
  onSignOut,
}: Props) {
  const cloudMode = syncMode === "cloud";

  return (
    <div
      style={{
        border: "1px solid var(--ui-border)",
        borderRadius: 12,
        padding: 10,
        display: "grid",
        gap: 8,
        background: "var(--ui-panel)",
      }}
    >
      <div style={{ fontWeight: 900 }}>{t("cloudSync")}</div>

      {!hasActiveProfile && (
        <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 800 }}>{t("cloudProfilePickFirst")}</div>
      )}

      {hasActiveProfile && (
        <>
          <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
            {t("cloudProfileCurrent")}: {profileName ?? "—"}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>{t("cloudStorageMode")}</div>
            <select
              value={syncMode}
              onChange={(e) => onSyncModeChange(e.target.value as ProfileSyncMode)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ui-border)",
                background: "var(--ui-card)",
                color: "var(--ui-text)",
                fontWeight: 800,
                width: "100%",
              }}
            >
              <option value="local">{t("cloudStorageLocal")}</option>
              <option value="cloud">{t("cloudStorageCloud")}</option>
            </select>
          </div>
        </>
      )}

      {!cloudMode ? (
        <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>{t("cloudLocalModeHint")}</div>
      ) : !cloudConfigured ? (
        <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 800 }}>{t("cloudNotConfiguredHint")}</div>
      ) : (
        <>
          <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
            {cloudUserEmail ? `${t("cloudSignedInAs")}: ${cloudUserEmail}` : t("cloudSignedOutState")}
          </div>

          {!cloudUserEmail && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Input
                value={cloudEmailInput}
                onChange={onEmailInputChange}
                placeholder={t("cloudEmailPlaceholder")}
                style={{ flex: "1 1 220px" }}
              />
              <Button variant="outline" onClick={onSignIn} disabled={cloudBusy}>
                {t("cloudSendMagicLink")}
              </Button>
            </div>
          )}

          {cloudUserEmail && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="outline" onClick={onLoad} disabled={cloudBusy}>
                {t("cloudLoad")}
              </Button>
              <Button variant="outline" onClick={onSave} disabled={cloudBusy}>
                {t("cloudSave")}
              </Button>
              <Button variant="outline" onClick={onToggleAutoSync} disabled={cloudBusy}>
                {cloudAutoSync ? t("cloudAutoSyncOn") : t("cloudAutoSyncOff")}
              </Button>
              <Button variant="danger" onClick={onSignOut} disabled={cloudBusy}>
                {t("cloudSignOut")}
              </Button>
            </div>
          )}

          {cloudLastSyncAt && (
            <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
              {t("cloudLastSync")}: {new Date(cloudLastSyncAt).toLocaleString(lang === "de" ? "de-DE" : "en-GB")}
            </div>
          )}

          {cloudStatusMsg && <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>{cloudStatusMsg}</div>}
        </>
      )}
    </div>
  );
}
