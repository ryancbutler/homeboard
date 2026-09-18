import { fromZonedTime } from "date-fns-tz";

export type ScheduleKind = "once" | "daily" | "weekdays" | "weekly";

export type Schedule = {
  kind: ScheduleKind;
  startDate: string;
  weekdays: number[];
  dueTime?: string | null;
};

const asUtcDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const formatDay = (value: Date) => value.toISOString().slice(0, 10);

/** The household calendar runs Monday through Sunday. */
export function mondayOfWeek(day: string): string {
  const value = asUtcDay(day);
  const weekday = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return formatDay(value);
}

export function sundayOfWeek(day: string): string {
  const value = asUtcDay(mondayOfWeek(day));
  value.setUTCDate(value.getUTCDate() + 6);
  return formatDay(value);
}

export function daysMondayToSunday(day: string): string[] {
  const start = asUtcDay(mondayOfWeek(day));
  return Array.from({ length: 7 }, (_, offset) => {
    const value = new Date(start);
    value.setUTCDate(value.getUTCDate() + offset);
    return formatDay(value);
  });
}

export function isScheduledOn(schedule: Schedule, day: string): boolean {
  if (day < schedule.startDate) return false;
  if (schedule.kind === "once") return day === schedule.startDate;
  if (schedule.kind === "daily") return true;
  const weekday = asUtcDay(day).getUTCDay();
  if (schedule.kind === "weekdays") return (schedule.weekdays.length ? schedule.weekdays : [1, 2, 3, 4, 5]).includes(weekday);
  if (schedule.kind === "weekly") {
    return (schedule.weekdays && schedule.weekdays.length > 0)
      ? schedule.weekdays.includes(weekday)
      : weekday === asUtcDay(schedule.startDate).getUTCDay();
  }
  return false;
}

export function scheduledDays(schedule: Schedule, from: string, to: string): string[] {
  const result: string[] = [];
  for (let cursor = asUtcDay(from), end = asUtcDay(to); cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const day = formatDay(cursor);
    if (isScheduledOn(schedule, day)) result.push(day);
  }
  return result;
}

export function dueAt(day: string, time: string | null, timezone: string): Date | null {
  if (!time) return null;
  return fromZonedTime(`${day}T${time}`, timezone);
}

export function dateInTimezone(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}
