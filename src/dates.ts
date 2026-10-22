export const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(date: string): boolean {
  if (!DATE_FORMAT_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === date;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatLong(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatShort(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekdayIndexOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function startOfMonth(month: string): string {
  return `${month}-01`;
}

export function addMonths(month: string, months: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}

export function daysInMonth(month: string): number {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.getUTCDate();
}

export function endOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/**
 * Dates for a calendar grid covering `month`, with leading/trailing days from
 * adjacent months. Weeks start on the locale's first weekday (0 = Sunday).
 */
export function calendarGrid(month: string, firstWeekday: number): string[] {
  const lead = (weekdayIndexOf(startOfMonth(month)) - firstWeekday + 7) % 7;
  const gridStart = shiftDate(startOfMonth(month), -lead);
  const cells: string[] = [];
  const total = Math.ceil((lead + daysInMonth(month)) / 7) * 7;
  for (let i = 0; i < total; i++) cells.push(shiftDate(gridStart, i));
  return cells;
}

export function localeFirstWeekday(): number {
  const locale = navigator.language || "en-US";
  try {
    const LocaleCtor = (
      Intl as unknown as {
        Locale?: new (tag: string) => { weekInfo?: { firstDay?: number } };
      }
    ).Locale;
    if (LocaleCtor) {
      const fd = new LocaleCtor(locale).weekInfo?.firstDay;
      if (typeof fd === "number") return fd % 7;
    }
  } catch {
    // fall through to Sunday
  }
  return 0;
}

export function weekdayLabels(firstWeekday: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`2023-01-${String(1 + ((firstWeekday + i) % 7)).padStart(2, "0")}T00:00:00Z`);
    labels.push(
      d.toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" }),
    );
  }
  return labels;
}
