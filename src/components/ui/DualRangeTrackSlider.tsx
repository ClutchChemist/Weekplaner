import React from "react";

type Props = {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (nextMin: number, nextMax: number) => void;
  formatLabel?: (v: number) => string;
};

export function DualRangeTrackSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
  formatLabel,
}: Props) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const activeRef = React.useRef<"min" | "max" | null>(null);
  const [activeThumb, setActiveThumb] = React.useState<"min" | "max" | null>(null);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const snap = (v: number) => Math.round(v / step) * step;

  const vMin = clamp(valueMin, min, valueMax - step);
  const vMax = clamp(valueMax, valueMin + step, max);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const leftPct = pct(vMin);
  const rightPct = pct(vMax);

  const label = (v: number) => (formatLabel ? formatLabel(v) : String(v));

  const MIN_COLOR = "var(--ui-accent)";
  const MAX_COLOR = "#f59e0b";

  const valueFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return vMin;
    const r = el.getBoundingClientRect();
    const x = clamp((clientX - r.left) / r.width, 0, 1);
    return snap(min + x * (max - min));
  };

  const pickThumb = (clientX: number) => {
    const clicked = valueFromClientX(clientX);
    const dMin = Math.abs(clicked - vMin);
    const dMax = Math.abs(clicked - vMax);
    return dMin <= dMax ? "min" : "max";
  };

  const apply = (thumb: "min" | "max", next: number) => {
    if (thumb === "min") onChange(clamp(next, min, vMax - step), vMax);
    else onChange(vMin, clamp(next, vMin + step, max));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const thumb = pickThumb(e.clientX);
    activeRef.current = thumb;
    setActiveThumb(thumb);

    apply(thumb, valueFromClientX(e.clientX));

    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current) return;
    apply(activeRef.current, valueFromClientX(e.clientX));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    activeRef.current = null;
    setActiveThumb(null);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // noop: pointer may already be released by browser
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ui-muted)", fontWeight: 800 }}>
        <span>{label(vMin)}</span>
        <span>{label(vMax)}</span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "relative",
          height: 34,
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 15,
            height: 4,
            borderRadius: 999,
            background: "var(--ui-border)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${leftPct}%`,
            width: `${rightPct - leftPct}%`,
            top: 15,
            height: 4,
            borderRadius: 999,
            background: "rgba(59,130,246,.35)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: `calc(${leftPct}% - 12px)`,
            top: 5,
            width: 24,
            height: 24,
            borderRadius: 999,
            border: `2px solid ${MIN_COLOR}`,
            background: "rgba(59,130,246,.18)",
            display: "grid",
            placeItems: "center",
            boxShadow:
              activeThumb === "min"
                ? `0 0 0 5px rgba(59,130,246,.25)`
                : "0 0 0 3px rgba(0,0,0,.15)",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: MIN_COLOR,
              boxShadow: "0 0 0 2px rgba(255,255,255,.15) inset",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -16,
              fontSize: 10,
              fontWeight: 950,
              color: MIN_COLOR,
              opacity: 0.9,
            }}
          >
            Start
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: `calc(${rightPct}% - 12px)`,
            top: 5,
            width: 24,
            height: 24,
            borderRadius: 999,
            border: `2px solid ${MAX_COLOR}`,
            background: "rgba(245,158,11,.18)",
            display: "grid",
            placeItems: "center",
            boxShadow:
              activeThumb === "max"
                ? `0 0 0 5px rgba(245,158,11,.22)`
                : "0 0 0 3px rgba(0,0,0,.15)",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: MAX_COLOR,
              boxShadow: "0 0 0 2px rgba(255,255,255,.15) inset",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -16,
              fontSize: 10,
              fontWeight: 950,
              color: MAX_COLOR,
              opacity: 0.9,
            }}
          >
            Ende
          </div>
        </div>
      </div>
    </div>
  );
}
