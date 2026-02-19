import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import type { Session } from "@/components/calendar/types";

type Props = {
  session: Session;
  kind: "TRAVEL" | "WARMUP";
  top: number;
  height: number;
  col: number;
  colCount: number;
  minutes: number;
  t: (k: string) => string;
};

export function CalendarPreBlockDraggable({
  session,
  kind,
  top,
  height,
  col,
  colCount,
  minutes,
  t,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cal_pre_${session.id}_${kind}`,
    data: { type: "calendarPreBlock", sessionId: session.id, kind },
  });

  const style: CSSProperties = {
    position: "absolute",
    left: `calc(6px + ${(col / Math.max(1, colCount)) * 100}%)` as CSSProperties["left"],
    width: `calc((100% - 12px) / ${Math.max(1, colCount)})` as CSSProperties["width"],
    top,
    height: Math.max(10, height),
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,.28)",
    background: "rgba(255,255,255,.03)",
    color: "var(--ui-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
    cursor: "grab",
    opacity: isDragging ? 0.85 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} title={t("calendarDragAdjustMinutes")}>
      {kind === "TRAVEL" ? t("calendarTravel") : t("calendarWarmup")} ({minutes}m)
    </div>
  );
}
