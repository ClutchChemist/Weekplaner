export function normalizeYearColor(argb?: string | null) {
  if (!argb) return null;
  if (argb.length === 8) return `#${argb.slice(2)}`;
  if (argb.length === 6) return `#${argb}`;
  return null;
}

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

export function hexToRgba(hex: string, alpha = 1): string {
  const { r, g, b } = hexToRgb(hex);
  const a = clamp(alpha, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mixColor(hexA: string, hexB: string, weight = 0.5): string {
  const w = clamp(weight, 0, 1);
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * w);
  const g = Math.round(a.g + (b.g - a.g) * w);
  const bl = Math.round(a.b + (b.b - a.b) * w);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl
    .toString(16)
    .padStart(2, "0")}`;
}

export function isValidHex(input: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(String(input ?? "").trim());
}

export function pickTextColor(bgHex: string) {
  const { r, g, b } = hexToRgb(bgHex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111" : "#fff";
}
