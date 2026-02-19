import { useEffect, useState, type ReactNode } from "react";
import type { PrintPage } from "@/utils/printExport";
import { ExportPreview } from "./ExportPreview";

export type SidebarModule = "calendar" | "preview" | "maps" | "none";

type Props = {
  open: boolean;
  layout: "single" | "split";
  topModule: SidebarModule;
  bottomModule: SidebarModule;
  splitPct: number;
  onChangeLayout: (v: "single" | "split") => void;
  onChangeTop: (v: SidebarModule) => void;
  onChangeBottom: (v: SidebarModule) => void;
  onChangeSplitPct: (v: number) => void;
  context: {
    renderCalendar?: () => ReactNode;
    previewPages: PrintPage[];
  };
  t: (k: string) => string;
};

function RightSidebarModuleSelect({
  value,
  onChange,
  t,
}: {
  value: SidebarModule;
  onChange: (v: SidebarModule) => void;
  t: (k: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SidebarModule)}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid var(--ui-border)",
        background: "var(--ui-panel)",
        color: "var(--ui-text)",
        fontWeight: 900,
      }}
    >
      <option value="calendar">{t("calendar")}</option>
      <option value="preview">{t("preview")}</option>
      <option value="maps">{t("maps")}</option>
      <option value="none">—</option>
    </select>
  );
}

export function RightSidebar({
  open,
  layout,
  topModule,
  bottomModule,
  splitPct,
  onChangeLayout,
  onChangeTop,
  onChangeBottom,
  onChangeSplitPct,
  context,
  t,
}: Props) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const el = document.getElementById("rightSidebarSplitRoot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const y = e.clientY - r.top;
      const pct = Math.max(0.2, Math.min(0.8, y / r.height));
      onChangeSplitPct(pct);
    };

    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onChangeSplitPct]);

  if (!open) return null;

  const renderModule = (m: SidebarModule) => {
    if (m === "none") return <div style={{ color: "var(--ui-muted)", padding: 20 }}>{t("rightNoModule")}</div>;
    if (m === "calendar") return context.renderCalendar ? context.renderCalendar() : null;
    if (m === "preview") return <ExportPreview pages={context.previewPages} t={t} />;
    if (m === "maps") {
      return <div style={{ padding: 10, color: "var(--ui-muted)" }}>{t("rightMapsPlaceholder")}</div>;
    }
    return null;
  };

  return (
    <div
      style={{
        borderLeft: "1px solid var(--ui-border)",
        background: "var(--ui-panel)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minWidth: 360,
      }}
    >
      <div
        style={{
          padding: 10,
          borderBottom: "1px solid var(--ui-border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 950 }}>{t("rightAreaTitle")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => onChangeLayout(layout === "split" ? "single" : "split")}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--ui-border)",
              background: "transparent",
              color: "var(--ui-text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {layout === "split" ? t("layoutSplit") : t("layoutSingle")}
          </button>
        </div>
      </div>

      {layout === "single" ? (
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
          <div
            style={{
              padding: 10,
              borderBottom: "1px solid var(--ui-border)",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <RightSidebarModuleSelect value={topModule} onChange={onChangeTop} t={t} />
          </div>
          <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(topModule)}</div>
        </div>
      ) : (
        <div
          id="rightSidebarSplitRoot"
          style={{ position: "relative", minHeight: 0, display: "grid", gridTemplateRows: `${splitPct}fr 10px ${(1 - splitPct)}fr` }}
        >
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div
              style={{
                padding: 10,
                borderBottom: "1px solid var(--ui-border)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <RightSidebarModuleSelect value={topModule} onChange={onChangeTop} t={t} />
            </div>
            <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(topModule)}</div>
          </div>

          <div
            onMouseDown={() => setDragging(true)}
            style={{
              cursor: "row-resize",
              background: "rgba(255,255,255,0.04)",
              borderTop: "1px solid var(--ui-border)",
              borderBottom: "1px solid var(--ui-border)",
            }}
            title={t("rightResizeTitle")}
          />

          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div
              style={{
                padding: 10,
                borderBottom: "1px solid var(--ui-border)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <RightSidebarModuleSelect value={bottomModule} onChange={onChangeBottom} t={t} />
            </div>
            <div style={{ minHeight: 0, overflow: "auto" }}>{renderModule(bottomModule)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
