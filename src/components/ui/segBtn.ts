import type { CSSProperties } from "react";

export function segBtn(active: boolean): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    minWidth: 0,
    border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
    background: active ? "rgba(59,130,246,.18)" : "transparent",
    color: "var(--ui-text)",
    fontWeight: 900,
    cursor: "pointer",
  };
}
