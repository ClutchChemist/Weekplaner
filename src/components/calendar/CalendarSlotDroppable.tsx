import { useDroppable } from "@dnd-kit/core";

export function CalendarSlotDroppable({
  id,
  date,
  startMin,
  height,
}: {
  id: string;
  date: string;
  startMin: number;
  height: number;
}) {
  const { setNodeRef } = useDroppable({
    id,
    data: { type: "calendarSlot", date, startMin },
  });

  return <div ref={setNodeRef} style={{ height, borderBottom: "1px solid rgba(255,255,255,.06)" }} />;
}
