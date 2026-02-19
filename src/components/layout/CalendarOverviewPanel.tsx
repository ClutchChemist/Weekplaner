import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { CalendarPane } from "./CalendarPane";
import type { Player, WeekPlan } from "@/types";

type Props = {
  weekDates: string[];
  weekPlan: WeekPlan;
  roster: Player[];
  onOpenEventEditor: (eventId: string) => void;
  onUpdateWeekPlan: (next: WeekPlan) => void;
  dnd: {
    onDragStart: (event: DragStartEvent) => void;
    onDragOver: (event: DragOverEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
  };
  onDelete: (sessionId: string) => void;
  onToggleTravel: (sessionId: string) => void;
  onToggleWarmup: (sessionId: string) => void;
  editingSessionId: string | null;
  t: (k: string) => string;
};

export function CalendarOverviewPanel({
  weekDates,
  weekPlan,
  roster,
  onOpenEventEditor,
  onUpdateWeekPlan,
  dnd,
  onDelete,
  onToggleTravel,
  onToggleWarmup,
  editingSessionId,
  t,
}: Props) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{t("calendarOverview")}</div>
        <div style={{ color: "var(--ui-muted)", fontSize: 12, fontWeight: 900 }}>
          {weekDates[0]} — {weekDates[6]}
        </div>
      </div>
      <CalendarPane
        weekDates={weekDates}
        weekPlan={weekPlan}
        onOpenEventEditor={onOpenEventEditor}
        roster={roster}
        onUpdateWeekPlan={onUpdateWeekPlan}
        dnd={dnd}
        onDelete={onDelete}
        onToggleTravel={onToggleTravel}
        onToggleWarmup={onToggleWarmup}
        editingSessionId={editingSessionId}
        t={t}
      />
    </div>
  );
}