import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${active ? "var(--ui-accent)" : "var(--ui-border)"}`,
    background: active ? "rgba(59,130,246,.18)" : "transparent",
    color: "var(--ui-text)",
    fontWeight: 900,
    cursor: "pointer",
  };
}

type ToggleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
  children?: ReactNode;
  style?: CSSProperties;
};

export function Toggle({ active, children, style, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      {...props}
      style={{ ...segBtn(active), ...style }}
    >
      {children}
    </button>
  );
}
