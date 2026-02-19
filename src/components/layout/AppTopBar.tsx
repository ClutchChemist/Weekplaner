import type { RefObject } from "react";
import type { Lang } from "@/i18n/types";
import type { SavedProfile } from "@/state/profileTypes";
import { Button } from "@/components/ui";

type Props = {
  locale: Lang;
  t: (key: string) => string;
  clubLogoDataUrl: string | null;
  activeProfileName: string | null;
  profiles: SavedProfile[];
  activeProfileId: string;
  profileMenuOpen: boolean;
  profileMenuRef: RefObject<HTMLDivElement | null>;
  onToggleLang: () => void;
  onOpenProfiles: () => void;
  onToggleProfileMenu: () => void;
  onSelectProfileFromMenu: (id: string) => void;
  eventEditorOpen: boolean;
  onToggleEventEditor: () => void;
  onOpenNewWeek: () => void;
  rightOpen: boolean;
  onToggleRightSidebar: () => void;
  onOpenSettings: () => void;
};

export function AppTopBar({
  locale,
  t,
  clubLogoDataUrl,
  activeProfileName,
  profiles,
  activeProfileId,
  profileMenuOpen,
  profileMenuRef,
  onToggleLang,
  onOpenProfiles,
  onToggleProfileMenu,
  onSelectProfileFromMenu,
  eventEditorOpen,
  onToggleEventEditor,
  onOpenNewWeek,
  rightOpen,
  onToggleRightSidebar,
  onOpenSettings,
}: Props) {
  return (
    <div className="topBar">
      <div className="topBarLeft">
        <Button
          className="touchBtn"
          variant="outline"
          onClick={onToggleLang}
          title={t("language")}
          style={{
            width: 38,
            height: 34,
            padding: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}flags/${locale === "de" ? "de" : "gb"}.svg`}
            alt={locale === "de" ? "Deutsch" : "English"}
            style={{ width: 24, height: 16, borderRadius: 2, display: "block" }}
          />
        </Button>

        <div ref={profileMenuRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          <Button
            className="touchBtn"
            variant="outline"
            onClick={onOpenProfiles}
            title={activeProfileName ?? t("profileNone")}
            style={{
              padding: "8px 10px",
              maxWidth: 230,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {clubLogoDataUrl ? (
                <img
                  src={clubLogoDataUrl}
                  alt="Logo"
                  style={{ width: 18, height: 18, objectFit: "contain", borderRadius: 4 }}
                />
              ) : (
                <span>👤</span>
              )}
              <span>{activeProfileName ?? t("profiles")}</span>
            </span>
          </Button>

          <Button
            className="touchBtn"
            variant="outline"
            onClick={onToggleProfileMenu}
            title={t("profiles")}
            style={{ width: 32, height: 34, padding: 0, display: "grid", placeItems: "center" }}
          >
            ▾
          </Button>

          {profileMenuOpen && (
            <div className="profileQuickMenu">
              {profiles.length === 0 && (
                <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12, padding: "6px 8px" }}>
                  {t("profileNone")}
                </div>
              )}

              {profiles.map((p) => {
                const active = p.id === activeProfileId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProfileFromMenu(p.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
                      background: active ? "rgba(59,130,246,.18)" : "transparent",
                      color: "var(--ui-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="topBarRight">
        <Button
          className="touchBtn"
          variant={eventEditorOpen ? "solid" : "outline"}
          onClick={onToggleEventEditor}
          style={{ padding: "8px 10px" }}
        >
          📝 {t("event")}
        </Button>
        <Button className="touchBtn" variant="outline" onClick={onOpenNewWeek} style={{ padding: "8px 10px" }}>
          {t("newWeek")}
        </Button>
        <Button
          className="touchBtn"
          variant={rightOpen ? "solid" : "outline"}
          onClick={onToggleRightSidebar}
          title={t("toggleRightSidebar")}
          style={{ padding: "8px 10px" }}
        >
          📌 {t("right")}
        </Button>
        <Button
          className="touchBtn"
          variant="outline"
          onClick={onOpenSettings}
          title={t("settings")}
          style={{ padding: "8px 10px", borderRadius: 12 }}
        >
          ⚙︎
        </Button>
      </div>
    </div>
  );
}