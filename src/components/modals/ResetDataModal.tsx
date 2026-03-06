import { useState } from "react";
import { Button, Modal } from "@/components/ui";

export type ResetCategory = "players" | "coaches" | "locations" | "plan";

type Props = {
  open: boolean;
  onClose: () => void;
  onReset: (categories: ResetCategory[]) => void;
  t: (key: string) => string;
};

const CATEGORIES: Array<{ key: ResetCategory; labelKey: string }> = [
  { key: "players", labelKey: "resetCategoryPlayers" },
  { key: "coaches", labelKey: "resetCategoryCoaches" },
  { key: "locations", labelKey: "resetCategoryLocations" },
  { key: "plan", labelKey: "resetCategoryPlan" },
];

export function ResetDataModal({ open, onClose, onReset, t }: Props) {
  const [selected, setSelected] = useState<Set<ResetCategory>>(new Set());
  const [armed, setArmed] = useState(false);

  if (!open) return null;

  function toggle(category: ResetCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setArmed(false);
  }

  function closeAndResetUiState() {
    setSelected(new Set());
    setArmed(false);
    onClose();
  }

  function handleReset() {
    if (selected.size === 0) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    onReset(Array.from(selected));
    closeAndResetUiState();
  }

  return (
    <Modal title={t("resetDataTitle")} onClose={closeAndResetUiState} closeLabel={t("close")}>
      <div style={{ display: "grid", gap: 12, minWidth: 300 }}>
        <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 13 }}>
          {t("resetDataHint")}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {CATEGORIES.map(({ key, labelKey }) => {
            const checked = selected.has(key);
            return (
              <label
                key={key}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  border: `1px solid ${checked ? "var(--ui-accent)" : "var(--ui-border)"}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: checked ? "rgba(239,68,68,0.08)" : "var(--ui-card)",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(key)}
                  style={{ width: 16, height: 16, accentColor: "#ef4444", cursor: "pointer" }}
                />
                <span style={{ fontWeight: 900, fontSize: 13 }}>{t(labelKey)}</span>
              </label>
            );
          })}
        </div>

        {armed && selected.size > 0 && (
          <div
            style={{
              border: "1px solid #ef4444",
              background: "rgba(239,68,68,0.12)",
              borderRadius: 10,
              padding: "10px 12px",
              color: "#ef4444",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {t("resetDataConfirmWarning")}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
          <Button variant="outline" onClick={closeAndResetUiState}>
            {t("cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleReset}
            disabled={selected.size === 0}
            style={{ opacity: selected.size === 0 ? 0.4 : 1 }}
          >
            {armed ? t("resetDataConfirmButton") : t("resetDataButton")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

