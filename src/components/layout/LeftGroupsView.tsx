import { useState } from "react";
import type { GroupId, ThemeSettings } from "@/types";
import { Button, Input } from "@/components/ui";

type GroupEntry = {
  id: GroupId;
  label: string;
  isSystem: boolean;
  count: number;
};

type Props = {
  t: (key: string) => string;
  editMode: boolean;
  theme: ThemeSettings;
  groups: GroupEntry[];
  onAddGroup: (name: string) => boolean;
  onDeleteGroup: (groupId: GroupId) => void;
  onAutoAssign: (opts: { years: boolean; senior: boolean }) => void;
  onSetGroupBg: (groupId: GroupId, color: string) => void;
  onSetGroupFg: (groupId: GroupId, color: string | undefined) => void;
};

export function LeftGroupsView({
  t,
  editMode,
  theme,
  groups,
  onAddGroup,
  onDeleteGroup,
  onAutoAssign,
  onSetGroupBg,
  onSetGroupFg,
}: Props) {
  const [newGroupName, setNewGroupName] = useState("");
  const [assignYears, setAssignYears] = useState(true);
  const [assignSenior, setAssignSenior] = useState(true);

  return (
    <>
      <div className="leftSectionHeader">
        <div style={{ fontSize: 18, fontWeight: 900 }}>{t("groupsTab")}</div>
      </div>

      <div style={{ marginTop: 8, color: "var(--ui-muted)", fontSize: 13, fontWeight: 700 }}>
        {t("groupsManageHint")}
      </div>

      <div
        style={{
          marginTop: 12,
          border: `1px solid var(--ui-border)`,
          borderRadius: 14,
          background: "var(--ui-card)",
          padding: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 900 }}>{t("groupsAutoAssignTitle")}</div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={assignYears}
            onChange={(e) => setAssignYears(e.target.checked)}
          />
          {t("groupsAutoAssignYears")}
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={assignSenior}
            onChange={(e) => setAssignSenior(e.target.checked)}
          />
          {t("groupsAutoAssignSenior")}
        </label>
        <Button
          variant="outline"
          onClick={() => onAutoAssign({ years: assignYears, senior: assignSenior })}
          disabled={!assignYears && !assignSenior}
          style={{ justifyContent: "flex-start" }}
        >
          {t("groupsAutoAssignRun")}
        </Button>
      </div>

      <div
        style={{
          marginTop: 12,
          border: `1px solid var(--ui-border)`,
          borderRadius: 14,
          background: "var(--ui-card)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("groupsManageTitle")}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {groups.map((g) => {
            const current = theme.groups[g.id] ?? { bg: "#6b7280", fg: undefined };
            return (
              <div
                key={g.id}
                style={{
                  border: `1px solid var(--ui-border)`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>
                    {g.label}{" "}
                    <span style={{ color: "var(--ui-muted)", fontWeight: 700, fontSize: 12 }}>
                      ({g.count})
                    </span>
                  </div>
                  {g.isSystem ? (
                    <span style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 700 }}>
                      {t("groupsSystem")}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => onDeleteGroup(g.id)}
                      disabled={!editMode}
                      style={{ padding: "6px 8px", borderColor: "#ef4444", color: "#ef4444" }}
                    >
                      {t("delete").toLowerCase()}
                    </Button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--ui-muted)", fontWeight: 800 }}>
                    BG
                    <input
                      type="color"
                      value={current.bg}
                      onChange={(e) => onSetGroupBg(g.id, e.target.value)}
                      disabled={!editMode}
                      style={{ width: "100%", height: 32, borderRadius: 8, border: "1px solid var(--ui-border)", background: current.bg }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--ui-muted)", fontWeight: 800 }}>
                    Text
                    <input
                      type="color"
                      value={current.fg ?? "#ffffff"}
                      onChange={(e) => onSetGroupFg(g.id, e.target.value)}
                      disabled={!editMode}
                      style={{ width: "100%", height: 32, borderRadius: 8, border: "1px solid var(--ui-border)", background: current.fg ?? "#ffffff" }}
                    />
                  </label>
                  <Button
                    variant="outline"
                    onClick={() => onSetGroupFg(g.id, undefined)}
                    disabled={!editMode}
                    style={{ padding: "8px 10px", alignSelf: "end" }}
                  >
                    {t("auto")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <Input
            value={newGroupName}
            onChange={setNewGroupName}
            placeholder={t("groupsAddPlaceholder")}
            style={{ flex: 1 }}
          />
          <Button
            onClick={() => {
              const ok = onAddGroup(newGroupName);
              if (ok) setNewGroupName("");
            }}
            disabled={!editMode || !newGroupName.trim()}
          >
            {t("groupsAddButton")}
          </Button>
        </div>
      </div>
    </>
  );
}

