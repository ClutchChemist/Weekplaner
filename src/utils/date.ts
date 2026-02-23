/**
 * Wandelt einen "HH:MM"-String in Minuten seit Mitternacht um.
 * Gibt 0 zurück, wenn das Format ungültig ist.
 */
export function parseHHMM(hhmm: string): number {
  const [h, m] = (hhmm ?? "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return (h ?? 0) * 60 + (m ?? 0);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseISODateLocal(dateISO: string): Date | null {
  const v = String(dateISO ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateToDDMMYYYY_DOTS(dateISO: string) {
  const d = parseISODateLocal(dateISO);
  if (!d) return "";
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function dateToShortDE(dateISO: string) {
  const d = parseISODateLocal(dateISO);
  if (!d) return "";
  const day = d.getDate();
  const monthShort = new Intl.DateTimeFormat("de-DE", { month: "short" })
    .format(d)
    .replace(".", "");
  return `${day}. ${monthShort}.`;
}

export function weekdayShortDE(dateISO: string) {
  const d = parseISODateLocal(dateISO);
  if (!d) return "";
  const wd = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(d);
  return wd.replace(".", "");
}

export function weekdayShortLocalized(dateISO: string, locale: "de" | "en" = "de") {
  const d = parseISODateLocal(dateISO);
  if (!d) return "";
  const localeTag = locale === "en" ? "en-GB" : "de-DE";
  const wd = new Intl.DateTimeFormat(localeTag, { weekday: "short" }).format(d);
  return wd.replace(".", "");
}

export function addMinutesToHHMM(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const total = h * 60 + m + minutes;
  const nh = Math.floor((total % (24 * 60)) / 60);
  const nm = total % 60;
  return `${pad2(nh)}:${pad2(nm)}`;
}

export function normalizeDash(range: string) {
  return String(range ?? "").replaceAll("-", "–");
}

export function isHHMM(s: string) {
  return /^\d{2}:\d{2}$/.test((s ?? "").trim());
}

export function splitTimeRange(range: string): [string, string] | null {
  const raw = String(range ?? "").trim();
  if (!raw) return null;

  if (isHHMM(raw)) return [raw, raw];

  const r = normalizeDash(raw);
  const parts = r.split("–").map((x) => x.trim());
  if (parts.length !== 2) return null;
  if (!isHHMM(parts[0]) || !isHHMM(parts[1])) return null;
  return [parts[0], parts[1]];
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function isoToday(): string {
  return toISODateLocal(new Date());
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = parseISODateLocal(dateISO) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

export function isoWeekMonday(dateISO: string): string {
  const d = parseISODateLocal(dateISO) ?? new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toISODateLocal(d);
}

export function weekdayOffsetFromDEShort(day: string): number | null {
  const x = String(day ?? "").trim().toLowerCase();
  if (x.startsWith("mo")) return 0;
  if (x.startsWith("di")) return 1;
  if (x.startsWith("mi")) return 2;
  if (x.startsWith("do")) return 3;
  if (x.startsWith("fr")) return 4;
  if (x.startsWith("sa")) return 5;
  if (x.startsWith("so")) return 6;
  return null;
}

export function isoWeekNumber(dateISO: string): number {
  const d = parseISODateLocal(dateISO);
  if (!d) return -1;
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const diff = d.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

export function kwLabelFromPlan(plan: { sessions: Array<{ date: string }> }): string {
  const weeks = Array.from(
    new Set(plan.sessions.map((s) => isoWeekNumber(s.date)).filter((w) => Number.isFinite(w) && w > 0))
  ).sort(
    (a, b) => a - b
  );
  if (weeks.length === 0) return "KW ?";
  return `KW ${weeks.join("+")}`;
}


export function kwFromRange(dates: string[]): string {
  const weeks = Array.from(
    new Set(dates.map((d) => isoWeekNumber(d)).filter((w) => Number.isFinite(w) && w > 0))
  ).sort((a, b) => a - b);
  if (weeks.length === 0) return "KW ?";
  return `KW ${weeks.join("+")}`;
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
