import type { Lang } from "@/types";
import { Button, Input } from "@/components/ui";

type Props = {
  t: (k: string) => string;
  lang: Lang;
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

      {!cloudConfigured ? (
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
