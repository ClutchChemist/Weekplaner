import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost" | "danger";
  children?: ReactNode;
};

export function Button({
  children,
  variant = "solid",
  style,
  disabled,
  ...props
}: ButtonProps) {
  const base: CSSProperties = {
    borderRadius: 12,
    padding: "10px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    border: "1px solid transparent",
    opacity: disabled ? 0.5 : 1,
  };

  const variants: Record<string, CSSProperties> = {
    solid: {
      background: "var(--ui-text)",
      color: "var(--ui-black)",
      borderColor: "var(--ui-text)",
    },
    outline: {
      background: "transparent",
      color: "var(--ui-text)",
      borderColor: "var(--ui-border)",
    },
    ghost: { background: "transparent", color: "var(--ui-text)", borderColor: "transparent" },
    danger: {
      background: "rgba(239,68,68,0.15)",
      color: "rgb(239,68,68)",
      borderColor: "rgb(239,68,68)",
    },
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

Button.displayName = "Button";
