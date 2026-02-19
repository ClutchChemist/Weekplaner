import React, { type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { GroupId, Player } from "@/types";
import { getPlayerGroup } from "@/state/playerGrouping";
import { dbbDobMatchesBirthDate, hasAnyTna } from "@/state/playerMeta";
import { normalizeYearColor, pickTextColor } from "@/utils/color";

type Props = {
  player: Player;
  trainingCount: number;
  groupBg: Record<GroupId, string>;
  isBirthday: boolean;
  t: (k: string) => string;
};

export const DraggablePlayerRow = React.memo(function DraggablePlayerRow({
  player,
  trainingCount,
  groupBg,
  isBirthday,
  t,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `player:${player.id}`,
    data: { type: "player", playerId: player.id },
  });

  const style: CSSProperties = {
    cursor: "grab",
    opacity: isDragging ? 0.6 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    boxShadow: isDragging
      ? "0 10px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)"
      : "none",
    zIndex: isDragging ? 40 : undefined,
  };

  const group = getPlayerGroup(player);
  const bg = normalizeYearColor(player.yearColor) ?? groupBg[group];
  const text = pickTextColor(bg);
  const subText = text === "#fff" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.70)";

  const pos = (player.positions ?? []).join("/") || "—";
  const isTbd = player.id === "TBD";

  const taOk = hasAnyTna(player);
  const taDobCheck = isTbd ? { ok: true } : dbbDobMatchesBirthDate(player);

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 12,
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: bg,
        }}
        title={
          isTbd
            ? t("placeholder")
            : (player.lizenzen ?? [])
                .map((l) => `${String(l.typ).toUpperCase()}: ${l.tna}`)
                .join(" | ") || t("noTaTnaSaved")
        }
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 900,
              color: text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={!taDobCheck.ok ? taDobCheck.reason : undefined}
          >
            {player.name}
            {isBirthday ? " 🎂" : ""}
            {!taDobCheck.ok ? " ⚠️" : ""}
          </div>
          <div style={{ fontSize: 12, color: subText, fontWeight: 800 }}>
            {isTbd
              ? t("placeholder")
              : `${player.primaryYouthTeam || ""}${
                  player.primarySeniorTeam ? ` • ${player.primarySeniorTeam}` : ""
                }`}
          </div>
        </div>

        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          {isTbd ? (
            <>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>TBD</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>{t("groupTbdLong")}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>{pos}</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>{trainingCount}x</div>
              <div style={{ fontWeight: 900, color: text, fontSize: 12 }}>TA {taOk ? "✓" : "—"}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

DraggablePlayerRow.displayName = "DraggablePlayerRow";
