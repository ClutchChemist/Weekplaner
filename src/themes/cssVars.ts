import type { ThemeSettings } from "../state/types";

export function applyThemeToCssVars(theme: ThemeSettings) {
  const r = document.documentElement;
  r.style.setProperty("--ui-bg", theme.ui.bg);
  r.style.setProperty("--ui-panel", theme.ui.panel);
  r.style.setProperty("--ui-card", theme.ui.card);
  r.style.setProperty("--ui-border", theme.ui.border);
  r.style.setProperty("--ui-text", theme.ui.text);
  r.style.setProperty("--ui-muted", theme.ui.muted);
  r.style.setProperty("--ui-soft", theme.ui.soft);
  r.style.setProperty("--ui-black", theme.ui.black);
  r.style.setProperty("--ui-white", theme.ui.white);

  r.style.setProperty("--bg", theme.ui.bg);
  r.style.setProperty("--panel", theme.ui.panel);
  r.style.setProperty("--panel2", theme.ui.card);
  r.style.setProperty("--border", theme.ui.border);
  r.style.setProperty("--text", theme.ui.text);
  r.style.setProperty("--muted", theme.ui.muted);

  if (theme.ui.primary) r.style.setProperty("--primary", theme.ui.primary);
  if (theme.ui.primaryText) r.style.setProperty("--primaryText", theme.ui.primaryText);
}
