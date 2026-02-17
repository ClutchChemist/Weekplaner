import type { CSSProperties } from "react";

type SelectProps = {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  style?: CSSProperties;
  disabled?: boolean;
};

export function Select({ value, onChange, options, style, disabled = false }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: 10,
        borderRadius: 12,
        border: `1px solid var(--ui-border)`,
        background: "var(--ui-card)",
        color: "var(--ui-text)",
        outline: "none",
        width: "100%",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
