import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { splitTimeRange } from "@/utils/date";
import { DualRangeTrackSlider } from "@/components/ui";
import { CalendarEventDraggable, CalendarPreBlockDraggable, CalendarSlotDroppable, type Session } from "@/components/calendar";
import type { Player, WeekPlan } from "@/types";

function clampNumber(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function snapToStep(v: number, step: number) {
  return Math.round(v / step) * step;
}

type Props = {
  weekDates: string[];
  weekPlan: WeekPlan;
  roster: Player[];
  onUpdateWeekPlan: (next: WeekPlan) => void;
  onOpenEventEditor: (eventId: string) => void;
  dnd: {
    onDragStart: (event: DragStartEvent) => void;
    onDragOver: (event: DragOverEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
  };
  onDelete: (sessionId: string) => void;
  onToggleTravel: (sessionId: string) => void;
  onToggleWarmup: (sessionId: string) => void;
  editingSessionId?: string | null;
  t: (k: string) => string;
};

export function CalendarPane({
  weekDates,
  weekPlan,
  onOpenEventEditor,
  onDelete,
  onToggleTravel,
  onToggleWarmup,
  editingSessionId,
  t,
}: Props) {
  const sessions = weekPlan.sessions;
  const START_MIN = 6 * 60;
  const END_MIN = 23 * 60;
  const SLOT = 30;
  const TIME_SNAP = 15;
  const slotH = 18;

  const minToHHMM = (m: number) => {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const snap = useCallback((v: number) => snapToStep(v, TIME_SNAP), [TIME_SNAP]);

  type WindowMode = "auto" | "manual";
  type AutoScope = "week" | "day";
  const [windowMode, setWindowMode] = useState<WindowMode>("auto");
  const [autoScope, setAutoScope] = useState<AutoScope>("week");
  const [selectedAutoDay, setSelectedAutoDay] = useState<number | null>(null);
  const [dayScrollOffset, setDayScrollOffset] = useState<number>(0);
  const [manualStart, setManualStart] = useState(START_MIN);
  const [manualEnd, setManualEnd] = useState(END_MIN);
  const [manualDayStart, setManualDayStart] = useState(0);
  const [manualDayEnd, setManualDayEnd] = useState(6);

  const DAY_NAMES = useMemo(
    () => [
      t("weekdayMonday"),
      t("weekdayTuesday"),
      t("weekdayWednesday"),
      t("weekdayThursday"),
      t("weekdayFriday"),
      t("weekdaySaturday"),
      t("weekdaySunday"),
    ],
    [t]
  );

  const DAY_SHORT = useMemo(
    () => [
      t("weekdayMonShort"),
      t("weekdayTueShort"),
      t("weekdayWedShort"),
      t("weekdayThuShort"),
      t("weekdayFriShort"),
      t("weekdaySatShort"),
      t("weekdaySunShort"),
    ],
    [t]
  );

  function weekdayShortLocalized(dateISO: string): string {
    const d = new Date(`${dateISO}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateISO;
    const dayIdxMon0 = (d.getDay() + 6) % 7;
    return DAY_SHORT[dayIdxMon0] ?? dateISO;
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const d of weekDates) map.set(d, []);
    for (const s of sessions) {
      if (!weekDates.includes(s.date)) continue;
      map.get(s.date)!.push(s);
    }
    for (const [d, arr] of map.entries()) {
      arr.sort((a, b) => a.time.localeCompare(b.time));
      map.set(d, arr);
    }
    return map;
  }, [weekDates, sessions]);

  const sessionsByDay = useMemo(() => weekDates.map((d) => eventsByDay.get(d) ?? []), [weekDates, eventsByDay]);

  const parseStartMin = useCallback((time: string): number => {
    const tr = splitTimeRange(time);
    const start = tr ? tr[0] : (time ?? "00:00").slice(0, 5);
    const hh = parseInt(start.slice(0, 2), 10);
    const mm = parseInt(start.slice(3, 5), 10);
    return hh * 60 + mm;
  }, []);

  const sessionDurationMin = useCallback((s: Session): number => {
    const game = String(s.info ?? "").trim().toLowerCase().startsWith("vs") || String(s.info ?? "").trim().startsWith("@");
    if (game) return 120;
    const tr = splitTimeRange(s.time ?? "");
    if (!tr) return 90;
    const [st, en] = tr;
    const sM = parseInt(st.slice(0, 2), 10) * 60 + parseInt(st.slice(3, 5), 10);
    const eM = parseInt(en.slice(0, 2), 10) * 60 + parseInt(en.slice(3, 5), 10);
    return Math.max(0, eM - sM) || 90;
  }, []);

  const computeAutoWindow = useCallback((allDays: Session[][]) => {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const day of allDays) {
      for (const s of day) {
        const st = parseStartMin(s.time ?? "");
        const dur = sessionDurationMin(s);
        if (!Number.isFinite(st) || !Number.isFinite(dur)) continue;

        minStart = Math.min(minStart, st);
        maxEnd = Math.max(maxEnd, st + dur);

        const info = String(s.info ?? "").trim().toLowerCase();
        const game = info.startsWith("vs") || info.startsWith("@") || info.includes(" vs ") || info.includes(" @ ");
        if (game) {
          const warm = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));
          const away = info.trim().startsWith("@");
          const travel = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));

          if (warm > 0) minStart = Math.min(minStart, st - warm);
          if (away && travel > 0) minStart = Math.min(minStart, st - warm - travel);
        }
      }
    }

    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
      return { start: START_MIN, end: END_MIN };
    }

    const pad = 30;
    const start = clampNumber(snap(minStart - pad), START_MIN, END_MIN - 30);
    const end = clampNumber(snap(maxEnd + pad), START_MIN + 30, END_MIN);

    const minSpan = 180;
    if (end - start < minSpan) {
      const mid = (start + end) / 2;
      const s2 = clampNumber(snap(mid - minSpan / 2), START_MIN, END_MIN - minSpan);
      return { start: s2, end: s2 + minSpan };
    }

    return { start, end };
  }, [END_MIN, START_MIN, parseStartMin, sessionDurationMin, snap]);

  const computeAutoWindowForDay = useCallback((daySessions: Session[], windowStart: number, windowEnd: number) => {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const s of daySessions) {
      const st = parseStartMin(s.time ?? "");
      const dur = sessionDurationMin(s);
      if (!Number.isFinite(st) || !Number.isFinite(dur)) continue;

      minStart = Math.min(minStart, st);
      maxEnd = Math.max(maxEnd, st + dur);

      const info = String(s.info ?? "").trim().toLowerCase();
      const game = info.startsWith("vs") || info.startsWith("@") || info.includes(" vs ") || info.includes(" @ ");
      if (game) {
        const warm = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));
        const away = info.trim().startsWith("@");
        const travel = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));

        if (warm > 0) minStart = Math.min(minStart, st - warm);
        if (away && travel > 0) minStart = Math.min(minStart, st - warm - travel);
      }
    }

    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
      return { start: windowStart, end: windowEnd };
    }

    const pad = 30;
    const start = clampNumber(snap(minStart - pad), windowStart, windowEnd - 30);
    const end = clampNumber(snap(maxEnd + pad), windowStart + 30, windowEnd);

    const minSpan = 180;
    if (end - start < minSpan) {
      const mid = (start + end) / 2;
      const s2 = clampNumber(snap(mid - minSpan / 2), windowStart, windowEnd - minSpan);
      return { start: s2, end: s2 + minSpan };
    }
    return { start, end };
  }, [snap, parseStartMin, sessionDurationMin]);

  const autoWeekWindow = useMemo(() => computeAutoWindow(sessionsByDay), [sessionsByDay, computeAutoWindow]);
  const bestAutoDay = useMemo(() => {
    let bestDay = 0;
    let bestStart = Infinity;
    let bestCount = -1;

    for (let d = 0; d < 7; d++) {
      const day = sessionsByDay[d] ?? [];
      const w = computeAutoWindowForDay(day, START_MIN, END_MIN);

      const hasAny = day.some((s) => {
        const st = parseStartMin(s.time ?? "");
        const dur = sessionDurationMin(s);
        return Number.isFinite(st) && Number.isFinite(dur);
      });
      if (!hasAny) continue;

      const count = day.length;

      if (w.start < bestStart || (w.start === bestStart && count > bestCount)) {
        bestDay = d;
        bestStart = w.start;
        bestCount = count;
      }
    }

    return bestDay;
  }, [sessionsByDay, START_MIN, END_MIN, computeAutoWindowForDay, parseStartMin, sessionDurationMin]);

  const activeAutoDay = selectedAutoDay ?? bestAutoDay;

  const autoDayWindow = useMemo(() => {
    const day = sessionsByDay[activeAutoDay] ?? [];
    return computeAutoWindowForDay(day, START_MIN, END_MIN);
  }, [sessionsByDay, activeAutoDay, START_MIN, END_MIN, computeAutoWindowForDay]);

  const autoWindow = autoScope === "week" ? autoWeekWindow : autoDayWindow;

  const viewStartMin = windowMode === "auto" ? autoWindow.start : manualStart;
  const viewEndMin = windowMode === "auto" ? autoWindow.end : manualEnd;
  const viewSpan = Math.max(30, viewEndMin - viewStartMin);

  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let t = viewStartMin; t <= viewEndMin; t += SLOT) arr.push(t);
    return arr;
  }, [viewStartMin, viewEndMin]);

  function layoutDaySessions(daySessions: Session[]) {
    type Item = { id: string; start: number; end: number };

    const items: Item[] = [];

    for (const ss of daySessions) {
      const st = parseStartMin(ss.time ?? "");
      const dur = sessionDurationMin(ss);
      if (!Number.isFinite(st) || !Number.isFinite(dur)) continue;

      items.push({ id: ss.id, start: st, end: st + dur });

      const info = String(ss.info ?? "").trim().toLowerCase();
      const game = info.startsWith("vs") || info.startsWith("@") || info.includes(" vs ") || info.includes(" @ ");
      if (!game) continue;

      const away = info.trim().startsWith("@");
      const warm = Math.max(0, Math.floor(Number(ss.warmupMin ?? 0)));
      const travel = Math.max(0, Math.floor(Number(ss.travelMin ?? 0)));

      if (warm > 0) items.push({ id: `${ss.id}__WARMUP`, start: st - warm, end: st });
      if (away && travel > 0) items.push({ id: `${ss.id}__TRAVEL`, start: st - warm - travel, end: st - warm });
    }

    const sorted = items
      .map((it) => ({
        ...it,
        start: Math.max(START_MIN, it.start),
        end: Math.min(END_MIN, it.end),
      }))
      .filter((it) => it.end > it.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const layout = new Map<string, { col: number; colCount: number }>();

    let i = 0;
    while (i < sorted.length) {
      let j = i;
      let clusterEnd = sorted[i].end;
      while (j + 1 < sorted.length && sorted[j + 1].start < clusterEnd) {
        j += 1;
        clusterEnd = Math.max(clusterEnd, sorted[j].end);
      }

      const cluster = sorted.slice(i, j + 1);

      const colEnd: number[] = [];
      const assigned = cluster.map((it) => {
        let col = colEnd.findIndex((e) => it.start >= e);
        if (col === -1) {
          col = colEnd.length;
          colEnd.push(it.end);
        } else {
          colEnd[col] = it.end;
        }
        return { it, col };
      });

      const colCount = Math.max(1, colEnd.length);
      for (const a of assigned) layout.set(a.it.id, { col: a.col, colCount });

      i = j + 1;
    }

    return layout;
  }

  const allEventDays = useMemo(() => {
    return weekDates.filter((d) => {
      const daySessions = eventsByDay.get(d) ?? [];
      return daySessions.length > 0;
    });
  }, [weekDates, eventsByDay]);

  const displayDays = useMemo(() => {
    if (windowMode === "auto" && autoScope === "day") {
      return [weekDates[activeAutoDay]];
    }
    if (windowMode === "auto" && autoScope === "week") {
      const maxDaysPerView = 4;
      const start = Math.min(dayScrollOffset, Math.max(0, allEventDays.length - maxDaysPerView));
      return allEventDays.slice(start, start + maxDaysPerView);
    }
    return weekDates.slice(manualDayStart, manualDayEnd + 1);
  }, [windowMode, autoScope, activeAutoDay, weekDates, allEventDays, dayScrollOffset, manualDayStart, manualDayEnd]);

  const header = (
    <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)`, gap: 8, marginBottom: 10 }}>
      <div />
      {displayDays.map((d) => (
        <div key={d} style={{ border: `1px solid var(--ui-border)`, borderRadius: 12, padding: "8px 8px", background: "var(--ui-panel)", fontWeight: 900, fontSize: 12, textAlign: "center" }}>
          {weekdayShortLocalized(d)}<br />
          <span style={{ color: "var(--ui-muted)", fontWeight: 900 }}>{d.slice(8, 10)}.{d.slice(5, 7)}</span>
        </div>
      ))}
    </div>
  );

  const gridH = (slots.length - 1) * slotH;

  const btnStyle: CSSProperties = {
    padding: "6px 12px",
    borderRadius: 12,
    border: "1px solid var(--ui-border)",
    background: "var(--ui-card)",
    color: "var(--ui-text)",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={() => setWindowMode(windowMode === "auto" ? "manual" : "auto")} style={{ ...btnStyle, background: windowMode === "auto" ? "var(--ui-accent)" : "var(--ui-card)" }}>
          {t("autoZoom")}: {windowMode === "auto" ? t("on") : t("off")}
        </button>

        <button type="button" onClick={() => setWindowMode("auto")} style={btnStyle}>{t("calendarAuto")}</button>

        <button
          type="button"
          onClick={() => {
            setWindowMode("manual");
            setManualStart(START_MIN);
            setManualEnd(END_MIN);
          }}
          style={btnStyle}
        >
          {t("calendarFullRange")}
        </button>

        {windowMode === "auto" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAutoScope("week")} style={{ ...btnStyle, borderColor: autoScope === "week" ? "var(--ui-accent)" : "var(--ui-border)", background: autoScope === "week" ? "rgba(59,130,246,.18)" : "transparent" }}>
              {t("calendarAutoWeek")}
            </button>

            <button type="button" onClick={() => setAutoScope("day")} style={{ ...btnStyle, borderColor: autoScope === "day" ? "var(--ui-accent)" : "var(--ui-border)", background: autoScope === "day" ? "rgba(59,130,246,.18)" : "transparent" }}>
              {t("calendarAutoDay")}
            </button>

            {autoScope === "day" && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 12 }}>{t("day")}:</span>
                <select value={activeAutoDay} onChange={(e) => setSelectedAutoDay(Number(e.target.value))} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--ui-border)", background: "var(--ui-card)", color: "var(--ui-text)", fontWeight: 900, fontSize: 12 }}>
                  {DAY_NAMES.map((n, i) => (
                    <option key={n} value={i}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {windowMode === "manual" && (
          <div style={{ display: "grid", gap: 12, minWidth: 260 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 12 }}>{t("time")}</div>
              <DualRangeTrackSlider
                min={START_MIN}
                max={END_MIN}
                step={TIME_SNAP}
                valueMin={manualStart}
                valueMax={manualEnd}
                onChange={(a, b) => {
                  setManualStart(snap(a));
                  setManualEnd(snap(b));
                }}
                formatLabel={(v) => minToHHMM(v)}
              />
            </div>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 12 }}>{t("calendarDays")}</div>
              <DualRangeTrackSlider
                min={0}
                max={6}
                step={1}
                valueMin={manualDayStart}
                valueMax={manualDayEnd}
                onChange={(a, b) => {
                  setManualDayStart(a);
                  setManualDayEnd(b);
                }}
                formatLabel={(v) => DAY_NAMES[v] ?? String(v)}
              />
            </div>
          </div>
        )}
      </div>

      {header}
      <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)`, gap: 8 }}>
        <div style={{ position: "relative", height: gridH }}>
          {(() => {
            const hourStart = Math.ceil(viewStartMin / 60);
            const hourEnd = Math.floor(viewEndMin / 60);
            const hours: ReactNode[] = [];

            for (let h = hourStart; h <= hourEnd; h++) {
              const min = h * 60;
              if (min < viewStartMin || min > viewEndMin) continue;

              const relativePos = ((min - viewStartMin) / viewSpan) * gridH;
              const hh = String(h).padStart(2, "0");

              hours.push(
                <div key={`hour-${h}`} style={{ position: "absolute", top: relativePos - 7, left: 0, right: 0, color: "var(--ui-muted)", fontSize: 11, fontWeight: 900 }}>
                  {hh}:00
                </div>
              );
            }

            const addNonHourMarker = (min: number, label: string) => {
              if (min % 60 === 0) return null;

              const relativePos = ((min - viewStartMin) / viewSpan) * gridH;

              return (
                <div key={`marker-${label}-${min}`} style={{ position: "absolute", top: relativePos - 7, left: 0, right: 0, color: "var(--ui-muted)", fontSize: 10, fontWeight: 800, opacity: 0.7 }}>
                  {minToHHMM(min)}
                </div>
              );
            };

            if (viewStartMin % 60 !== 0) {
              hours.push(addNonHourMarker(viewStartMin, "start"));
            }

            if (viewEndMin % 60 !== 0) {
              hours.push(addNonHourMarker(viewEndMin, "end"));
            }

            return hours;
          })()}
        </div>

        {displayDays.map((d) => {
          const laneSessions = eventsByDay.get(d) ?? [];
          const layout = layoutDaySessions(laneSessions);

          return (
            <div key={d} style={{ border: `1px solid var(--ui-border)`, borderRadius: 14, background: "var(--ui-panel)", position: "relative", height: gridH, overflow: "hidden" }}>
              {(() => {
                const lines: ReactNode[] = [];

                const hourStart = Math.ceil(viewStartMin / 60);
                const hourEnd = Math.floor(viewEndMin / 60);
                for (let h = hourStart; h <= hourEnd; h++) {
                  const min = h * 60;
                  if (min < viewStartMin || min > viewEndMin) continue;

                  const pos = ((min - viewStartMin) / viewSpan) * gridH;
                  lines.push(
                    <div key={`hour-line-${h}`} style={{ position: "absolute", left: 0, right: 0, top: pos, height: 1, borderTop: "1px solid rgba(255,255,255,0.10)", pointerEvents: "none" }} />
                  );
                }

                if (viewStartMin % 60 !== 0) {
                  const pos = ((viewStartMin - viewStartMin) / viewSpan) * gridH;
                  lines.push(
                    <div key="helper-start" style={{ position: "absolute", left: 0, right: 0, top: pos, height: 1, borderTop: "1px dashed rgba(255,255,255,0.15)", pointerEvents: "none" }} />
                  );
                }

                if (viewEndMin % 60 !== 0) {
                  const pos = ((viewEndMin - viewStartMin) / viewSpan) * gridH;
                  lines.push(
                    <div key="helper-end" style={{ position: "absolute", left: 0, right: 0, top: pos, height: 1, borderTop: "1px dashed rgba(255,255,255,0.15)", pointerEvents: "none" }} />
                  );
                }

                return lines;
              })()}

              <div style={{ position: "absolute", inset: 0 }}>
                {slots.slice(0, -1).map((m) => {
                  const id = `slot_${d}_${m}`;
                  return (
                    <div key={id}>
                      <CalendarSlotDroppable id={id} date={d} startMin={m} height={slotH} />
                    </div>
                  );
                })}
              </div>

              {laneSessions.map((s) => {
                const info = String(s.info ?? "").trim();
                const game = info.toLowerCase().startsWith("vs") || info.startsWith("@");
                if (!game) return null;

                const st = parseStartMin(s.time ?? "");
                const travel = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));
                const warm = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));

                const warmLay = layout.get(`${s.id}__WARMUP`) ?? layout.get(s.id) ?? { col: 0, colCount: 1 };
                const travelLay = layout.get(`${s.id}__TRAVEL`) ?? layout.get(s.id) ?? { col: 0, colCount: 1 };

                const warmStart = st - warm;

                const blocks: Array<{ kind: "TRAVEL" | "WARMUP"; min: number; start: number; lay: { col: number; colCount: number } }> = [];
                if (travel > 0) blocks.push({ kind: "TRAVEL", min: travel, start: warmStart - travel, lay: travelLay });
                if (warm > 0) blocks.push({ kind: "WARMUP", min: warm, start: st - warm, lay: warmLay });

                return blocks.map((b) => {
                  if (b.start < viewStartMin || b.start > viewEndMin) return null;
                  const top = ((b.start - viewStartMin) / viewSpan) * gridH;
                  const h = (b.min / viewSpan) * gridH;
                  return (
                    <CalendarPreBlockDraggable
                      key={`${s.id}_${b.kind}`}
                      session={s}
                      kind={b.kind}
                      top={top}
                      height={h}
                      col={b.lay.col}
                      colCount={b.lay.colCount}
                      minutes={b.min}
                      t={t}
                    />
                  );
                });
              })}

              {laneSessions.map((s) => {
                const st = parseStartMin(s.time ?? "");
                const dur = sessionDurationMin(s);
                const top = ((st - viewStartMin) / viewSpan) * gridH;
                const h = (dur / viewSpan) * gridH;
                const info = String(s.info ?? "").trim();
                const game = info.toLowerCase().startsWith("vs") || info.startsWith("@");
                const warm = Math.max(0, Math.floor(Number(s.warmupMin ?? 0)));
                const travel = Math.max(0, Math.floor(Number(s.travelMin ?? 0)));
                if (st < viewStartMin || st > viewEndMin) return null;
                return (
                  <CalendarEventDraggable
                    key={s.id}
                    session={s}
                    top={top}
                    height={h}
                    isGame={game}
                    warmupMin={warm}
                    travelMin={travel}
                    col={layout.get(s.id)?.col ?? 0}
                    colCount={layout.get(s.id)?.colCount ?? 1}
                    onEdit={(ss) => onOpenEventEditor(ss.id)}
                    onDelete={onDelete}
                    onToggleTravel={onToggleTravel}
                    onToggleWarmup={onToggleWarmup}
                    t={t}
                    isEditing={editingSessionId === s.id}
                    isActive={editingSessionId === s.id}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {windowMode === "auto" && autoScope === "week" && allEventDays.length > 4 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "var(--ui-muted)", fontWeight: 800, fontSize: 11, minWidth: 60 }}>
            Tage: {dayScrollOffset + 1}–{Math.min(dayScrollOffset + 4, allEventDays.length)} / {allEventDays.length}
          </div>
          <input type="range" min={0} max={allEventDays.length - 4} step={1} value={dayScrollOffset} onChange={(e) => setDayScrollOffset(Number(e.target.value))} style={{ flex: 1 }} />
        </div>
      )}
    </div>
  );
}
