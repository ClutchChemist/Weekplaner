import type { CSSProperties } from "react";
import type { Player } from "@/types";
import { hasAnyTna } from "@/state/playerMeta";

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

type Props = {
  player: Player;
  trainingCount: number;
  activeDays: Set<string>;
  weekDates: string[];
  textColor: string;
  compact?: boolean;
};

export function PlayerBadge({
  player,
  trainingCount,
  activeDays,
  weekDates,
  textColor,
  compact = false,
}: Props) {
  if (player.id === "TBD") return null;

  const taOk = hasAnyTna(player);
  const muted = textColor === "#fff" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)";
  const dotActive = textColor === "#fff" ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.82)";
  const dotInactive = textColor === "#fff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
  const dotSize = compact ? 14 : 16;
  const dotFontSize = compact ? 9 : 10;

  const dotStyle = (active: boolean): CSSProperties => ({
    width: dotSize,
    height: dotSize,
    borderRadius: 4,
    background: active ? dotActive : dotInactive,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: dotFontSize,
    fontWeight: 900,
    color: active ? (textColor === "#fff" ? "#000" : "#fff") : muted,
    flexShrink: 0,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: compact ? 2 : 3,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: compact ? 6 : 8,
          alignItems: "center",
        }}
      >
        <span
          style={{ fontSize: compact ? 11 : 12, fontWeight: 900, color: taOk ? dotActive : muted }}
          title={taOk ? "TA available" : "No TA"}
        >
          TA {taOk ? "OK" : "-"}
        </span>
        <span
          style={{ fontSize: compact ? 11 : 12, fontWeight: 900, color: muted }}
          title={`${trainingCount} sessions this week`}
        >
          {trainingCount}x
        </span>
      </div>

      <div style={{ display: "flex", gap: 2 }}>
        {DAY_LABELS.map((label, idx) => {
          const dateIso = weekDates[idx];
          const active = dateIso ? activeDays.has(dateIso) : false;
          return (
            <div
              key={label}
              style={dotStyle(active)}
              title={`${label}${dateIso ? ` (${dateIso})` : ""}${active ? " active" : ""}`}
            >
              {label[0]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
