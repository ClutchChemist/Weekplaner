import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import type { Session } from "@/components/calendar/types";

type Props = {
  session: Session;
  top: number;
  height: number;
  isGame: boolean;
  warmupMin: number;
  travelMin: number;
  col: number;
  colCount: number;
  onEdit: (s: Session) => void;
  onDelete: (sessionId: string) => void;
  onToggleTravel: (sessionId: string) => void;
  onToggleWarmup: (sessionId: string) => void;
  t: (k: string) => string;
  isEditing?: boolean;
  isActive?: boolean;
};

export function CalendarEventDraggable({
  session,
  top,
  height,
  isGame,
  warmupMin,
  travelMin,
  col,
  colCount,
  onEdit,
  onDelete,
  onToggleTravel,
  onToggleWarmup,
  t,
  isEditing = false,
  isActive = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cal_evt_${session.id}`,
    data: { type: "calendarEvent", sessionId: session.id },
  });

  const {
    attributes: resizeAttributes,
    listeners: resizeListeners,
    setNodeRef: setResizeRef,
  } = useDraggable({
    id: `cal_resize_${session.id}`,
    data: { type: "calendarResize", sessionId: session.id },
  });

  const style: CSSProperties = {
    position: "absolute",
    left: `calc(6px + ${(col / Math.max(1, colCount)) * 100}%)` as CSSProperties["left"],
    width: `calc((100% - 12px) / ${Math.max(1, colCount)})` as CSSProperties["width"],
    top,
    height: Math.max(18, height),
    borderRadius: 12,
    border: isEditing ? "2px solid var(--ui-accent)" : "1px solid var(--ui-border)",
    background: isEditing ? "rgba(59,130,246,0.25)" : "var(--ui-card)",
    color: "var(--ui-text)",
    boxShadow: isActive
      ? "0 0 0 4px rgba(59,130,246,.18)"
      : isDragging
      ? "0 8px 24px rgba(0,0,0,.35)"
      : "0 2px 10px rgba(0,0,0,.18)",
    outline: isActive ? "2px solid var(--ui-accent)" : "none",
    opacity: isDragging ? 0.85 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    overflow: "hidden",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(session);
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          padding: "6px 8px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          background: "rgba(255,255,255,.03)",
        }}
      >
        <div
          {...listeners}
          style={{
            fontWeight: 900,
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>
            {(session.teams ?? []).join("/")} {session.info ? `| ${session.info}` : ""}
          </span>
          {isActive && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid var(--ui-accent)",
                background: "rgba(59,130,246,.18)",
                fontWeight: 950,
                fontSize: 10,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              EDIT
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {isGame ? (
            <>
              <button
                type="button"
                title={travelMin > 0 ? t("calendarHideTravel") : t("calendarShowTravel")}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTravel(session.id);
                }}
                style={{
                  border: `1px solid var(--ui-border)`,
                  background: travelMin > 0 ? "rgba(255,255,255,.08)" : "var(--ui-panel)",
                  color: "var(--ui-text)",
                  borderRadius: 10,
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                🚗
              </button>
              <button
                type="button"
                title={warmupMin > 0 ? t("calendarHideWarmup") : t("calendarShowWarmup")}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWarmup(session.id);
                }}
                style={{
                  border: `1px solid var(--ui-border)`,
                  background: warmupMin > 0 ? "rgba(255,255,255,.08)" : "var(--ui-panel)",
                  color: "var(--ui-text)",
                  borderRadius: 10,
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                🔥
              </button>
            </>
          ) : null}

          <button
            type="button"
            title={t("calendarEditJump")}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(session);
            }}
            style={{
              border: `1px solid var(--ui-border)`,
              background: "var(--ui-panel)",
              color: "var(--ui-text)",
              borderRadius: 10,
              padding: "2px 8px",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ⚙︎
          </button>
          <button
            type="button"
            title={t("delete")}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session.id);
            }}
            style={{
              border: "1px solid rgba(239,68,68,.55)",
              background: "rgba(239,68,68,.08)",
              color: "#ef4444",
              borderRadius: 10,
              padding: "2px 8px",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            🗑
          </button>
        </div>
      </div>

      <div style={{ padding: "6px 8px", fontSize: 12, fontWeight: 900, color: "var(--ui-muted)" }}>
        {session.time} • {session.location}
      </div>

      {!isGame ? (
        <div
          ref={setResizeRef}
          {...resizeAttributes}
          {...resizeListeners}
          onMouseDown={(e) => e.stopPropagation()}
          title={t("calendarResizeDuration")}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 10,
            cursor: "ns-resize",
            background: "rgba(255,255,255,.04)",
            borderTop: "1px solid rgba(255,255,255,.06)",
          }}
        />
      ) : null}
    </div>
  );
}
