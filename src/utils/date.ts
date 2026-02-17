function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function dateToDDMMYYYY_DOTS(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function dateToShortDE(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDate();
  const monthShort = new Intl.DateTimeFormat("de-DE", { month: "short" })
    .format(d)
    .replace(".", "");
  return `${day}. ${monthShort}.`;
}

export function weekdayShortDE(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const wd = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(d);
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
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

export function isoWeekMonday(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
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
  const d = new Date(dateISO + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const diff = d.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

export function kwLabelFromPlan(plan: { sessions: Array<{ date: string }> }): string {
  const weeks = Array.from(new Set(plan.sessions.map((s) => isoWeekNumber(s.date)))).sort(
    (a, b) => a - b
  );
  if (weeks.length === 0) return "KW ?";
  return `KW ${weeks.join("+")}`;
}

export function getISOWeek(dateISO: string): number {
  return isoWeekNumber(dateISO);
}

export function kwFromRange(dates: string[]): string {
  const weeks = Array.from(new Set(dates.map((d) => isoWeekNumber(d)))).sort((a, b) => a - b);
  if (weeks.length === 0) return "KW ?";
  return `KW ${weeks.join("+")}`;
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
