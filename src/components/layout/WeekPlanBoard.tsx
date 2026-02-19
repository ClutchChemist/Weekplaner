import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Lang } from "@/i18n/types";
import type { CalendarEvent as Session, GroupId, Player } from "@/types";
import { weekdayShortLocalized } from "@/utils/date";
import { normalizeYearColor, pickTextColor } from "@/utils/color";
import { Button } from "@/components/ui";

function DroppableSessionShell({
  session,
  children,
  hasHistoryFlag = false,
  isEditing = false,
  isSelected = false,
  onSelect,
}: {
  session: Session;
  children: ReactNode;
  hasHistoryFlag?: boolean;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelect?: (session: Session) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `session:${session.id}`,
    data: { type: "session", sessionId: session.id },
  });

  const emphasize = isEditing || isSelected;
  const baseBorder = emphasize ? "2px solid var(--ui-accent)" : (hasHistoryFlag ? "1px solid #ef4444" : `1px solid var(--ui-border)`);
  const baseBg = emphasize ? "rgba(59,130,246,0.25)" : (hasHistoryFlag ? "rgba(239,68,68,0.08)" : "var(--ui-card)");

  return (
    <div
      id={`session_card_${session.id}`}
      ref={setNodeRef}
      style={{
        border: isOver ? `2px dashed var(--ui-soft)` : baseBorder,
        borderRadius: 14,
        padding: 12,
        background: baseBg,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(session);
      }}
    >
      {children}
    </div>
  );
}

function ParticipantCard({
  player,
  onRemove,
  groupBg,
  isBirthday,
  t,
}: {
  player: Player;
  onRemove: () => void;
  groupBg: Record<GroupId, string>;
  isBirthday: boolean;
  t: (k: string) => string;
}) {
  const group = (player.group ?? "TBD") as GroupId;
  const bg = normalizeYearColor(player.yearColor) ?? groupBg[group] ?? groupBg.TBD;
  const text = pickTextColor(bg);

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 12,
        padding: "8px 10px",
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        background: bg,
        alignItems: "center",
      }}
    >
      <div style={{ fontWeight: 900, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {player.name}{isBirthday ? " 🎂" : ""}
      </div>
      <button
        onClick={onRemove}
        style={{
          border: "1px solid rgba(255,255,255,0.6)",
          background: "rgba(255,255,255,0.25)",
          color: text,
          borderRadius: 10,
          padding: "6px 10px",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        {t("remove")}
      </button>
    </div>
  );
}

type Props = {
  sessions: Session[];
  lang: Lang;
  t: (k: string) => string;
  lastDropError: string | null;
  conflictsBySession: Map<string, Array<{ playerId: string }>>;
  historyFlagsBySession: Map<string, string[]>;
  editingSessionId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  collapsedParticipantsBySession: Record<string, boolean>;
  onToggleParticipantsCollapse: (sessionId: string) => void;
  onEditSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
  playerById: Map<string, Player>;
  removePlayerFromSession: (sessionId: string, playerId: string) => void;
  groupBg: Record<GroupId, string>;
  birthdayPlayerIds: Set<string>;
};

export function WeekPlanBoard({
  sessions,
  lang,
  t,
  lastDropError,
  conflictsBySession,
  historyFlagsBySession,
  editingSessionId,
  selectedSessionId,
  onSelectSession,
  collapsedParticipantsBySession,
  onToggleParticipantsCollapse,
  onEditSession,
  onDeleteSession,
  playerById,
  removePlayerFromSession,
  groupBg,
  birthdayPlayerIds,
}: Props) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{t("weekPlan")}</div>
      {lastDropError && (
        <div
          style={{
            marginTop: 8,
            border: "1px solid #ef4444",
            background: "rgba(239,68,68,0.12)",
            color: "var(--ui-text)",
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          {lastDropError}
        </div>
      )}
      <div className="weekGrid" style={{ marginTop: 10 }}>
        {sessions.map((s) => (
          <DroppableSessionShell
            key={s.id}
            session={s}
            hasHistoryFlag={(historyFlagsBySession.get(s.id) ?? []).length > 0}
            isEditing={editingSessionId === s.id}
            isSelected={selectedSessionId === s.id}
            onSelect={(session) => onSelectSession(session.id)}
          >
            {(() => {
              const dayLabel = weekdayShortLocalized(s.date, lang) || s.day;
              const participantsCollapsed = collapsedParticipantsBySession[s.id] === true;
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "var(--ui-text)" }}>
                        {dayLabel} • {s.date}
                      </div>
                      <div style={{ fontWeight: 800, color: "var(--ui-soft)" }}>
                        {(s.teams ?? []).join(" / ")} — {s.time} — {s.location}
                      </div>
                      {s.info ? (
                        <div style={{ fontSize: 12, color: "var(--ui-muted)", marginTop: 4, fontWeight: 900 }}>
                          {s.info}
                        </div>
                      ) : null}

                      {(() => {
                        const conflicts = conflictsBySession.get(s.id) ?? [];
                        if (!conflicts.length) return null;

                        const uniquePlayers = Array.from(new Set(conflicts.map((c) => c.playerId)));
                        const names = uniquePlayers
                          .map((pid) => playerById.get(pid)?.name ?? pid)
                          .slice(0, 8)
                          .join(", ");

                        return (
                          <div
                            title={names}
                            style={{
                              marginTop: 6,
                              display: "inline-block",
                              border: "1px solid #ef4444",
                              background: "rgba(239,68,68,0.12)",
                              color: "var(--ui-text)",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontWeight: 900,
                              fontSize: 12,
                            }}
                          >
                            {t("conflict")}: {uniquePlayers.length}
                          </div>
                        );
                      })()}

                      {(() => {
                        const flaggedIds = historyFlagsBySession.get(s.id) ?? [];
                        if (!flaggedIds.length) return null;

                        const names = flaggedIds
                          .map((pid) => playerById.get(pid)?.name ?? pid)
                          .slice(0, 8)
                          .join(", ");

                        return (
                          <div
                            title={names}
                            style={{
                              marginTop: 6,
                              display: "inline-block",
                              border: "1px solid #ef4444",
                              background: "rgba(239,68,68,0.12)",
                              color: "var(--ui-text)",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontWeight: 900,
                              fontSize: 12,
                            }}
                          >
                            {t("hint")}: {flaggedIds.length} ({t("history")})
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--ui-text)", fontWeight: 900 }}>
                        {(s.participants ?? []).length} {t("players")}
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                        <Button
                          variant="outline"
                          onClick={() => onToggleParticipantsCollapse(s.id)}
                          style={{ padding: "8px 10px" }}
                        >
                          {participantsCollapsed ? t("expandPlayers") : t("collapsePlayers")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => onEditSession(s)}
                          title={t("eventEdit")}
                          style={{ padding: "8px 10px" }}
                        >
                          ⚙︎
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => onDeleteSession(s.id)}
                          style={{ padding: "8px 10px", borderColor: "#ef4444", color: "#ef4444" }}
                        >
                          {t("delete").toLowerCase()}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!participantsCollapsed && (
                    <>
                      <hr style={{ border: 0, borderTop: `1px solid var(--ui-border)`, margin: "10px 0" }} />

                      <div style={{ display: "grid", gap: 6 }}>
                        {(s.participants ?? []).map((pid) => {
                          const p = playerById.get(pid);
                          if (!p) return null;
                          return (
                            <ParticipantCard
                              key={pid}
                              player={p}
                              onRemove={() => removePlayerFromSession(s.id, pid)}
                              groupBg={groupBg}
                              isBirthday={birthdayPlayerIds.has(pid)}
                              t={t}
                            />
                          );
                        })}
                        {(s.participants ?? []).length === 0 && (
                          <div style={{ color: "var(--ui-muted)", fontSize: 13, fontWeight: 800 }}>
                            {t("dropPlayersHere")}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </DroppableSessionShell>
        ))}
      </div>
    </div>
  );
}