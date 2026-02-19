import { useRef, type ReactNode } from "react";
import type { Coach, GroupId, Player, ThemeSettings } from "@/types";
import { GROUPS } from "@/state/playerGrouping";
import { Button, Input, segBtn } from "@/components/ui";
import { LeftLocationsView } from "@/components/locations";

type LeftTab = "players" | "coaches" | "locations";
type ExtraGroup = "U18_ONLY" | "HOL_ONLY" | null;

type Props = {
  t: (key: string) => string;
  leftTab: LeftTab;
  leftEditMode: boolean;
  onSelectTab: (tab: LeftTab) => void;
  onToggleEditMode: () => void;

  onOpenRoster: () => void;
  openExtra: ExtraGroup;
  onToggleU18Only: () => void;
  onToggleHolOnly: () => void;
  u18OnlyPlayers: Player[];
  holOnlyPlayers: Player[];

  openGroup: GroupId | null;
  onToggleGroup: (groupId: GroupId) => void;
  playersByGroup: Map<GroupId, Player[]>;
  renderDraggablePlayer: (player: Player) => ReactNode;

  coaches: Coach[];
  onAddCoach: () => void;
  onUpdateCoach: (id: string, patch: Partial<Coach>) => void;
  onDeleteCoach: (id: string) => void;
  onExportStaff: () => void;
  onImportStaffFile: (file: File) => void | Promise<void>;

  theme: ThemeSettings;
  setTheme: (next: ThemeSettings) => void;
  locationUsageMap: Record<string, number>;
  openLocationName: string | null;
  setOpenLocationName: (v: string | null) => void;
};

export function LeftSidebar({
  t,
  leftTab,
  leftEditMode,
  onSelectTab,
  onToggleEditMode,
  onOpenRoster,
  openExtra,
  onToggleU18Only,
  onToggleHolOnly,
  u18OnlyPlayers,
  holOnlyPlayers,
  openGroup,
  onToggleGroup,
  playersByGroup,
  renderDraggablePlayer,
  coaches,
  onAddCoach,
  onUpdateCoach,
  onDeleteCoach,
  onExportStaff,
  onImportStaffFile,
  theme,
  setTheme,
  locationUsageMap,
  openLocationName,
  setOpenLocationName,
}: Props) {
  const staffFileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="leftPane"
      style={{
        padding: 16,
        borderRight: `1px solid var(--ui-border)`,
        overflow: "auto",
        background: "var(--ui-panel)",
      }}
    >
      <div className="leftTabsRow">
        <div className="leftTabsGroup">
          <button
            type="button"
            onClick={() => onSelectTab("players")}
            style={segBtn(leftTab === "players")}
          >
            {t("players")}
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("coaches")}
            style={segBtn(leftTab === "coaches")}
          >
            {t("coaches")}
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("locations")}
            style={segBtn(leftTab === "locations")}
          >
            {t("locations")}
          </button>
        </div>

        <div className="leftTabsEdit">
          <button
            type="button"
            onClick={onToggleEditMode}
            style={{
              ...segBtn(false),
              borderColor: leftEditMode ? "var(--ui-accent)" : "var(--ui-border)",
              background: leftEditMode ? "rgba(59,130,246,.18)" : "transparent",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 950,
            }}
            title={t("editModeCurrentListTitle")}
          >
            {leftEditMode ? t("editModeOn") : t("editModeOff")}
          </button>
        </div>
      </div>

      {leftTab === "players" && (
        <>
          <div className="leftSectionHeader">
            <div style={{ fontSize: 18, fontWeight: 900 }}>{t("roster")}</div>
            <Button variant="outline" onClick={onOpenRoster} style={{ padding: "8px 10px" }}>
              {leftEditMode ? t("rosterEdit") : t("rosterShow")}
            </Button>
          </div>

          <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 13, fontWeight: 700 }}>
            {t("playersPanelHint")}
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ borderRadius: 14 }}>
              <button
                onClick={onToggleU18Only}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid var(--ui-border)`,
                  background: "var(--ui-card)",
                  color: "var(--ui-text)",
                  borderRadius: 14,
                  padding: "12px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <span>{t("groupU18Only")}</span>
                <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
                  {u18OnlyPlayers.length} {t("players")}
                </span>
              </button>

              {openExtra === "U18_ONLY" && (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {u18OnlyPlayers.map((p) => (
                    <div key={p.id}>{renderDraggablePlayer(p)}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderRadius: 14 }}>
              <button
                onClick={onToggleHolOnly}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid var(--ui-border)`,
                  background: "var(--ui-card)",
                  color: "var(--ui-text)",
                  borderRadius: 14,
                  padding: "12px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                }}
              >
                <span>{t("groupHolOnly")}</span>
                <span style={{ color: "var(--ui-muted)", fontSize: 13 }}>
                  {holOnlyPlayers.length} {t("players")}
                </span>
              </button>

              {openExtra === "HOL_ONLY" && (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {holOnlyPlayers.map((p) => (
                    <div key={p.id}>{renderDraggablePlayer(p)}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {GROUPS.map((g) => {
              const arr = playersByGroup.get(g.id) ?? [];
              const isOpen = openGroup === g.id;
              const groupRightLabel = g.id === "TBD" ? t("groupTbdLong") : `${arr.length} ${t("players")}`;

              return (
                <div key={g.id} style={{ borderRadius: 14 }}>
                  <button
                    onClick={() => onToggleGroup(g.id)}
                    className="groupHeaderBtn"
                  >
                    <span className="groupHeaderLeft">{g.label}</span>
                    <span className="groupHeaderRight">{groupRightLabel}</span>
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      {arr.map((p) => (
                        <div key={p.id}>{renderDraggablePlayer(p)}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {leftTab === "coaches" && (
        <>
          <div className="leftSectionHeader">
            <div style={{ fontSize: 18, fontWeight: 900 }}>{t("coaches")}</div>
            {leftEditMode && (
              <Button variant="outline" onClick={onAddCoach} style={{ padding: "8px 10px" }}>
                + {t("coach")}
              </Button>
            )}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={onExportStaff} style={{ padding: "8px 10px" }}>
              {t("export")} staff.json
            </Button>
            <Button
              variant="outline"
              onClick={() => staffFileRef.current?.click()}
              style={{ padding: "8px 10px" }}
            >
              {t("import")} staff.json
            </Button>
            <input
              ref={staffFileRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  void onImportStaffFile(f);
                }
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {coaches.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid var(--ui-border)`,
                  borderRadius: 14,
                  background: "var(--ui-card)",
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 900 }}>{c.role}</div>
                  {leftEditMode && (
                    <Button
                      variant="outline"
                      onClick={() => onDeleteCoach(c.id)}
                      style={{ padding: "6px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                    >
                      {t("delete").toLowerCase()}
                    </Button>
                  )}
                </div>

                {!leftEditMode ? (
                  <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
                    {c.name} {c.license ? `• ${c.license}` : ""}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("name")}</div>
                      <Input value={c.name} onChange={(v) => onUpdateCoach(c.id, { name: v })} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("role")}</div>
                      <Input value={c.role} onChange={(v) => onUpdateCoach(c.id, { role: v })} />
                    </div>
                    <div style={{ gridColumn: "1 / span 2" }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("licenseNumber")}</div>
                      <Input
                        value={c.license ?? ""}
                        onChange={(v) => onUpdateCoach(c.id, { license: v })}
                        placeholder={t("licenseNumberExample")}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {leftTab === "locations" && (
        <LeftLocationsView
          theme={theme}
          setTheme={setTheme}
          locationUsageMap={locationUsageMap}
          editMode={leftEditMode}
          openLocationName={openLocationName}
          setOpenLocationName={setOpenLocationName}
          t={t}
        />
      )}
    </div>
  );
}