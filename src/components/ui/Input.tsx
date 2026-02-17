import { forwardRef, type CSSProperties } from "react";

type InputProps = {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  style?: CSSProperties;
  id?: string;
  disabled?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, type = "text", placeholder, style, id, disabled }, ref) => {
    return (
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
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
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "text",
          ...style,
        }}
      />
    );
  }
);

Input.displayName = "Input";
