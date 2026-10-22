/**
 * Timezone helpers. Calendar dates are plain "YYYY-MM-DD" strings; never parse
 * them with the Date constructor for display (it reads them as UTC midnight).
 * Day math runs on Date.UTC so DST days (23 h, 25 h) cannot skew it.
 */

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(instant: number | Date, tz: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Calendar date of an instant in a zone, as YYYY-MM-DD. */
export function zonedDate(instant: number | Date | string, tz: string): string {
  const t = typeof instant === "string" ? Date.parse(instant) : instant;
  const p = zonedParts(t, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export function zonedTime(instant: number | Date | string, tz: string, seconds = false): string {
  const t = typeof instant === "string" ? Date.parse(instant) : instant;
  const p = zonedParts(t, tz);
  return seconds ? `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` : `${pad(p.hour)}:${pad(p.minute)}`;
}

export function parseYmd(s: unknown): { y: number; m: number; d: number } | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function utcDay(ymd: string): number {
  const p = parseYmd(ymd);
  if (!p) throw new RangeError(`Not a YYYY-MM-DD date: ${ymd}`);
  return Date.UTC(p.y, p.m - 1, p.d);
}

/** Whole days from a to b (b - a). */
export function dayDiff(a: string, b: string): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(utcDay(ymd) + n * DAY_MS);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(ymd: string): number {
  return (new Date(utcDay(ymd)).getUTCDay() + 6) % 7;
}

export function weekMonday(ymd: string): string {
  return addDays(ymd, -weekdayIndex(ymd));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function weekdayShort(ymd: string): string {
  return WEEKDAYS[weekdayIndex(ymd)];
}

/** "Oct 14" */
export function monthDay(ymd: string): string {
  const p = parseYmd(ymd)!;
  return `${MONTHS[p.m - 1]} ${p.d}`;
}

/** "Saturday, Oct 3" */
export function longDate(ymd: string): string {
  return `${WEEKDAYS_LONG[weekdayIndex(ymd)]}, ${monthDay(ymd)}`;
}
