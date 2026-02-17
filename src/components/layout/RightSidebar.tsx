import type { WeekPlan, Player } from "../../state/types";

type Props = {
  open: boolean;
  weekPlan: WeekPlan;
  roster: Player[];
};

export function RightSidebar({ open, weekPlan }: Props) {
  if (!open) return null;
  return (
    <aside className="h-full w-[360px] border-l border-white/10">
      <div className="p-3 text-sm opacity-80">{weekPlan.weekLabel}</div>
      {/* Preview / Export / Summary */}
    </aside>
  );
}
