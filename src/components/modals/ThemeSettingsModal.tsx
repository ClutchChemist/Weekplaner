import { useEffect, useMemo, useState } from "react";
import { THEME_PRESETS } from "../../themes/presets";
import type { GroupId, ThemePreset, ThemeSettings } from "../../state/types";
import { randomId } from "../../utils/id";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

const THEME_USER_PRESETS_KEY = "ubc_planner_theme_userpresets_v1";

function asThemePreset(value: unknown): ThemePreset | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const theme = record.theme;
  if (!theme || typeof theme !== "object") return null;

  const id = String(record.id ?? "");
  const label = String(record.label ?? "");
  if (!id || !label) return null;

  return { id, label, theme: theme as ThemeSettings };
}

function safeParseThemePresets(raw: string | null): ThemePreset[] | null {
  if (!raw) return null;
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr.map(asThemePreset).filter((p): p is ThemePreset => p !== null);
  } catch {
    return null;
  }
}

type Props = {
  open: boolean;
  theme: ThemeSettings;
  defaultTheme: ThemeSettings;
  onChangeTheme: (next: ThemeSettings) => void;
  onReset: () => void;
  onClose: () => void;
  t: (key: string) => string;
  onConfirmOverwrite?: (title: string, message: string) => Promise<boolean>;
};

const GROUP_IDS: GroupId[] = ["2007", "2008", "2009", "Herren", "TBD"];

const ColorButton = ({ value, onChange, title }: { value: string; onChange: (hex: string) => void; title?: string }) => {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
      <input
        type="color"
        title={title ?? "Color"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 44, height: 32, borderRadius: 10, border: "1px solid var(--ui-border)", background: value, cursor: "pointer", padding: 0 }}
      />
    </div>
  );
};

const ColorSwatchPicker = ({ value, onChange, label, title }: { value: string; onChange: (hex: string) => void; label: string; title?: string }) => {
  function apply(hex: string) {
    document.documentElement.style.setProperty("--primary", hex);
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const isLight = 0.2126 * r + 0.7152 * g + 0.0722 * b > 160;
    document.documentElement.style.setProperty("--primaryText", isLight ? "#0f0f10" : "#ffffff");
    onChange(hex);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="color"
        title={title ?? "Color"}
        aria-label={title ?? "Color"}
        value={value}
        onChange={(e) => apply(e.target.value)}
        style={{ height: 36, width: 36, borderRadius: 8, border: `1px solid var(--border)`, background: value, cursor: "pointer", padding: 0 }}
      />
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{label}</div>
    </div>
  );
};

export function ThemeSettingsModal({
  open,
  theme,
  defaultTheme,
  onChangeTheme,
  onReset,
  onClose,
  t,
  onConfirmOverwrite,
}: Props) {
  const [presetId, setPresetId] = useState<string>("");

  const [userPresets, setUserPresets] = useState<ThemePreset[]>(() => {
    const saved = safeParseThemePresets(typeof window !== "undefined" ? localStorage.getItem(THEME_USER_PRESETS_KEY) : null);
    return saved ?? [];
  });
  const [newPresetLabel, setNewPresetLabel] = useState<string>("");

  useEffect(() => {
    localStorage.setItem(THEME_USER_PRESETS_KEY, JSON.stringify(userPresets));
  }, [userPresets]);

  const allPresets = useMemo(
    () => [
      ...Object.entries(THEME_PRESETS).map(([id, presetTheme]) => ({
        id,
        label:
          id === "default-dark"
            ? t("themePresetDefaultDark")
            : id === "slate-dark"
            ? t("themePresetNeutralDark")
            : id === "light"
            ? t("themePresetLight")
            : id,
        theme: presetTheme as ThemeSettings,
      })),
      ...userPresets,
    ],
    [userPresets, t]
  );

  const isUserPreset = useMemo(() => userPresets.some((p) => p.id === presetId), [userPresets, presetId]);

  async function saveCurrentAsPreset() {
    const themeClone: ThemeSettings = JSON.parse(JSON.stringify(theme));
    const label = newPresetLabel.trim();

    if (isUserPreset) {
      const overwrite = onConfirmOverwrite
        ? await onConfirmOverwrite(t("themePresetOverwriteTitle"), t("confirmPresetOverwrite"))
        : window.confirm(t("confirmPresetOverwrite"));

      if (overwrite) {
        setUserPresets((prev) =>
          prev.map((p) =>
            p.id === presetId ? { ...p, label: label || p.label, theme: themeClone } : p
          )
        );
        setNewPresetLabel("");
        return;
      }
    }

    const finalLabel = label || `${t("themePresetDefaultName")} ${userPresets.length + 1}`;
    const id = randomId("user-");
    setUserPresets((prev) => [...prev, { id, label: finalLabel, theme: themeClone }]);
    setPresetId(id);
    setNewPresetLabel("");
  }

  function deleteCurrentPreset() {
    if (!isUserPreset) return;
    setUserPresets((prev) => prev.filter((p) => p.id !== presetId));
    setPresetId("");
  }

  function applyPreset(id: string) {
    const hit = allPresets.find((p) => p.id === id);
    if (!hit) return;
    setPresetId(id);
    onChangeTheme(hit.theme);
  }

  if (!open) return null;

  return (
    <Modal title={t("themeModalTitle")} onClose={onClose} closeLabel={t("close")}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>{t("themePresets")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 10 }}>
            <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12 }}>
              {t("themePresetHelp")}
            </div>
            <select value={presetId} onChange={(e) => applyPreset(e.target.value)} style={{ padding: 10, borderRadius: 12, border: `1px solid var(--ui-border)`, background: "var(--ui-card)", color: "var(--ui-text)", outline: "none", width: "100%", fontWeight: 800 }}>
              <option value="">—</option>
              {allPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
            <Input value={newPresetLabel} onChange={setNewPresetLabel} placeholder={t("themePresetNamePlaceholder")} />
            <Button onClick={saveCurrentAsPreset}>{t("saveCurrentStyle")}</Button>
            <Button variant="danger" disabled={!isUserPreset} onClick={deleteCurrentPreset}>{t("deletePreset")}</Button>
          </div>
        </div>

        <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>{t("themeUiColors")}</div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 10 }}>
            <Button variant="outline" onClick={() => onChangeTheme({ ...theme, ui: { ...defaultTheme.ui } })}>{t("themeUiResetDefault")}</Button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900 }}>{t("themeAccentColor")}</div>
                <div style={{ fontSize: 12, color: "var(--ui-muted)", fontWeight: 800 }}>{t("themeAccentColorPickHint")}</div>
              </div>
              <div>
                <ColorSwatchPicker
                  value={theme.ui.primary ?? defaultTheme.ui.primary ?? "#e7e7e7"}
                  label={t("themeAccentColor")}
                  title={t("themeAccentColorPickTitle")}
                  onChange={(hex) => {
                    const next = { ...theme, ui: { ...theme.ui, primary: hex } };
                    const c = hex.replace("#", "");
                    const r = parseInt(c.slice(0, 2), 16);
                    const g = parseInt(c.slice(2, 4), 16);
                    const b = parseInt(c.slice(4, 6), 16);
                    const isLight = 0.2126 * r + 0.7152 * g + 0.0722 * b > 160;
                    next.ui.primaryText = isLight ? "#0f0f10" : "#ffffff";
                    onChangeTheme(next);
                    document.documentElement.style.setProperty("--primary", hex);
                    document.documentElement.style.setProperty("--primaryText", next.ui.primaryText!);
                  }}
                />
              </div>
            </div>

            {([
              [t("themeColorBackground"), "bg"],
              [t("themeColorPanel"), "panel"],
              [t("themeColorCard"), "card"],
              [t("themeColorBorder"), "border"],
              [t("themeColorText"), "text"],
              [t("themeColorMutedText"), "muted"],
              [t("themeColorSoftText"), "soft"],
            ] as const).map(([label, key]) => (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8, alignItems: "center" }}>
                <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12 }}>{label}</div>
                <ColorButton value={theme.ui[key]} onChange={(v) => onChangeTheme({ ...theme, ui: { ...theme.ui, [key]: v } })} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-card)", padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>{t("themeGroupsTitle")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {GROUP_IDS.map((gid) => (
              <div key={gid} style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8, alignItems: "center" }}>
                <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12 }}>{gid}</div>
                <ColorButton
                  value={theme.groups[gid].bg}
                  onChange={(v) => onChangeTheme({ ...theme, groups: { ...theme.groups, [gid]: { bg: v } } })}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onReset}>{t("themeResetDefault")}</Button>
          <Button onClick={onClose}>{t("themeDone")}</Button>
        </div>
      </div>
    </Modal>
  );
}
