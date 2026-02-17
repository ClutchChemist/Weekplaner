import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { segBtn } from "./segBtn";

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
