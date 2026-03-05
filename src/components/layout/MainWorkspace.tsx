import type { ComponentProps, ReactNode, RefObject } from "react";
import type { SidebarModule } from "./RightSidebar";
import type { PrintPage } from "@/utils/printExport";
import { Button } from "@/components/ui";
import { AppTopBar } from "./AppTopBar";
import { WeekPlanBoard } from "./WeekPlanBoard";
import { RightSidebar } from "./RightSidebar";
import { CalendarOverviewPanel } from "./CalendarOverviewPanel";

type Props = {
  t: (k: string) => string;
  topBarProps: ComponentProps<typeof AppTopBar>;
  editorTopRef: RefObject<HTMLDivElement | null>;
  eventPlannerNode: ReactNode;
  weekPlanBoardProps: ComponentProps<typeof WeekPlanBoard>;
  onCreatePlanPdf: () => void;
  onCreatePlanPngPages: () => void;
  rightOpen: boolean;
  rightLayout: "single" | "split";
  rightTop: SidebarModule;
  rightBottom: SidebarModule;
  rightSplitPct: number;
  onChangeRightLayout: (v: "single" | "split") => void;
  onChangeRightTop: (v: SidebarModule) => void;
  onChangeRightBottom: (v: SidebarModule) => void;
  onChangeRightSplitPct: (v: number) => void;
  previewPages: PrintPage[];
  calendarOverviewProps: ComponentProps<typeof CalendarOverviewPanel>;
};

export function MainWorkspace({
  t,
  topBarProps,
  editorTopRef,
  eventPlannerNode,
  weekPlanBoardProps,
  onCreatePlanPdf,
  onCreatePlanPngPages,
  rightOpen,
  rightLayout,
  rightTop,
  rightBottom,
  rightSplitPct,
  onChangeRightLayout,
  onChangeRightTop,
  onChangeRightBottom,
  onChangeRightSplitPct,
  previewPages,
  calendarOverviewProps,
}: Props) {
  return (
    <>
      <div className="rightPane" style={{ padding: 16, overflow: "auto", background: "var(--ui-bg)" }}>
        <AppTopBar {...topBarProps} />

        <div ref={editorTopRef} id="event-editor-top" />

        {eventPlannerNode}

        <WeekPlanBoard {...weekPlanBoardProps} />

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button onClick={onCreatePlanPdf} style={{ padding: "12px 14px" }}>
            {t("createPdf")}
          </Button>

          <Button onClick={onCreatePlanPngPages} style={{ padding: "12px 14px" }}>
            {t("exportPng")}
          </Button>
        </div>
      </div>

      <RightSidebar
        open={rightOpen}
        layout={rightLayout}
        topModule={rightTop}
        bottomModule={rightBottom}
        splitPct={rightSplitPct}
        onChangeLayout={onChangeRightLayout}
        onChangeTop={onChangeRightTop}
        onChangeBottom={onChangeRightBottom}
        onChangeSplitPct={onChangeRightSplitPct}
        t={t}
        context={{
          previewPages,
          renderCalendar: () => <CalendarOverviewPanel {...calendarOverviewProps} />,
        }}
      />
    </>
  );
}
