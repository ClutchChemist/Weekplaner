import { useRef } from "react";
import type { Lang } from "@/types";
import { Button, Input, Modal } from "@/components/ui";
import type { ProfileSyncMode, SavedProfile } from "@/state/profileTypes";
import { ProfileCloudSyncPanel } from "./ProfileCloudSyncPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  t: (k: string) => string;
  tf: (k: string, vars?: Record<string, string | number>) => string;
  lang: Lang;
  profiles: SavedProfile[];
  activeProfileId: string;
  activeProfileName: string | null;
  profileNameInput: string;
  onProfileNameInputChange: (value: string) => void;
  onSelectProfile: (id: string) => void;
  onCreateProfile: () => void;
  onUpdateProfile: () => void;
  onDeleteProfile: () => void;
  clubLogoDataUrl: string | null;
  logoUploadError: string;
  logoMaxKb: number;
  onLogoUpload: (file: File) => void;
  onLogoRemove: () => void;
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

export function ProfilesModal({
  open,
  onClose,
  t,
  tf,
  lang,
  profiles,
  activeProfileId,
  activeProfileName,
  profileNameInput,
  onProfileNameInputChange,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  clubLogoDataUrl,
  logoUploadError,
  logoMaxKb,
  onLogoUpload,
  onLogoRemove,
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
  const logoFileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  return (
    <Modal title={t("profiles")} onClose={onClose} closeLabel={t("close")}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900 }}>{t("profileActive")}</div>
          <select
            value={activeProfileId}
            onChange={(e) => onSelectProfile(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--ui-border)",
              background: "var(--ui-card)",
              color: "var(--ui-text)",
            }}
          >
            <option value="">— {t("profileNone")} —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900 }}>{t("name")}</div>
          <Input
            value={profileNameInput}
            onChange={onProfileNameInputChange}
            placeholder={t("profileNamePlaceholder")}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900 }}>Logo</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                border: "1px solid var(--ui-border)",
                background: "var(--ui-card)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
              }}
            >
              {clubLogoDataUrl ? (
                <img src={clubLogoDataUrl} alt="Logo preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <span style={{ color: "var(--ui-muted)", fontSize: 11, fontWeight: 900 }}>Logo</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="outline" onClick={() => logoFileRef.current?.click()}>
                {t("logoUploadButton")}
              </Button>
              <Button variant="danger" onClick={onLogoRemove} disabled={!clubLogoDataUrl}>
                {t("logoRemoveButton")}
              </Button>
            </div>

            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLogoUpload(file);
                e.currentTarget.value = "";
              }}
            />
          </div>
          <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
            {tf("logoUploadHint", { maxKb: logoMaxKb })}
          </div>
          {logoUploadError && (
            <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 800 }}>{logoUploadError}</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onCreateProfile}>
            {t("profileSaveNew")}
          </Button>
          <Button variant="outline" onClick={onUpdateProfile} disabled={!activeProfileId}>
            {t("profileUpdate")}
          </Button>
          <Button variant="danger" onClick={onDeleteProfile} disabled={!activeProfileId}>
            {t("profileDelete")}
          </Button>
        </div>

        <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 800 }}>
          {t("profileHint")}
        </div>

        <ProfileCloudSyncPanel
          t={t}
          lang={lang}
          hasActiveProfile={Boolean(activeProfileId)}
          profileName={activeProfileName}
          syncMode={syncMode}
          onSyncModeChange={onSyncModeChange}
          cloudConfigured={cloudConfigured}
          cloudUserEmail={cloudUserEmail}
          cloudEmailInput={cloudEmailInput}
          cloudStatusMsg={cloudStatusMsg}
          cloudLastSyncAt={cloudLastSyncAt}
          cloudBusy={cloudBusy}
          cloudAutoSync={cloudAutoSync}
          onEmailInputChange={onEmailInputChange}
          onSignIn={onSignIn}
          onLoad={onLoad}
          onSave={onSave}
          onToggleAutoSync={onToggleAutoSync}
          onSignOut={onSignOut}
        />
      </div>
    </Modal>
  );
}