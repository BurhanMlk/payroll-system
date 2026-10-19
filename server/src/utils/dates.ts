import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export { dayjs };

export function startOfMonth(d: Date | string): Date {
  return dayjs(d).startOf("month").toDate();
}

export function endOfMonth(d: Date | string): Date {
  return dayjs(d).endOf("month").toDate();
}

export function startOfDay(d: Date | string): Date {
  return dayjs(d).startOf("day").toDate();
}

export function endOfDay(d: Date | string): Date {
  return dayjs(d).endOf("day").toDate();
}

export function addDays(d: Date | string, days: number): Date {
  return dayjs(d).add(days, "day").toDate();
}

export function addMonths(d: Date | string, months: number): Date {
  return dayjs(d).add(months, "month").toDate();
}

export function addYears(d: Date | string, years: number): Date {
  return dayjs(d).add(years, "year").toDate();
}

export function formatDate(d: Date | string | null | undefined, fmt = "YYYY-MM-DD"): string {
  if (!d) return "";
  return dayjs(d).format(fmt);
}

export function isWeekend(d: Date | string): boolean {
  const day = dayjs(d).day();
  return day === 0 || day === 6;
}

export function daysBetween(start: Date | string, end: Date | string): number {
  return dayjs(end).diff(dayjs(start), "day");
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return dayjs(a).isSame(dayjs(b), "day");
}

/** Business days (Mon-Fri) between two dates, inclusive. */
export function countBusinessDays(start: Date | string, end: Date | string): number {
  let count = 0;
  const cursor = dayjs(start);
  const last = dayjs(end);
  while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
    const d = cursor.day();
    if (d !== 0 && d !== 6) count++;
    cursor.add(1, "day");
  }
  return count;
}
