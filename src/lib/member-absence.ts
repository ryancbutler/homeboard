import { z } from "zod";
import { databaseIdSchema } from "@/lib/id-validation";

export type MemberAbsence = { id: string; memberId: string; startDate: string; endDate: string };
export type AwayRange = { startDate: string; endDate: string; returnDate: string };

export const absenceDatesSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The last away day must be on or after the first away day.",
    path: ["endDate"],
  });

export const createAbsencesSchema = z
  .object({
    memberIds: z
      .array(databaseIdSchema)
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, "Select each child once."),
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The last away day must be on or after the first away day.",
    path: ["endDate"],
  });

export function nextCalendarDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Merge connected ranges so overlapping vacations have one accurate return day. */
export function awayRangeFor(absences: MemberAbsence[], memberId: string, day: string): AwayRange | null {
  const ranges = absences
    .filter((range) => range.memberId === memberId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const merged: { startDate: string; endDate: string }[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.startDate <= nextCalendarDay(previous.endDate)) {
      if (range.endDate > previous.endDate) previous.endDate = range.endDate;
    } else merged.push({ startDate: range.startDate, endDate: range.endDate });
  }
  const range = merged.find((value) => value.startDate <= day && day <= value.endDate);
  return range ? { ...range, returnDate: nextCalendarDay(range.endDate) } : null;
}

export function isMemberAway(absences: MemberAbsence[], memberId: string, day: string): boolean {
  return absences.some((range) => range.memberId === memberId && range.startDate <= day && day <= range.endDate);
}

export function isWorkExcused(
  absences: MemberAbsence[],
  ownerId: string | null,
  eligibleIds: string[],
  scheduledFor: string
): boolean {
  if (ownerId) return isMemberAway(absences, ownerId, scheduledFor);
  return eligibleIds.length > 0 && eligibleIds.every((id) => isMemberAway(absences, id, scheduledFor));
}

export function vacationChoreStatus(status: string, excused: boolean): string {
  return excused && ["open", "rejected", "missed"].includes(status) ? "excused" : status;
}

export function summarizeChoreStatuses(rows: { status: string }[]) {
  const expected = rows.filter((row) => row.status !== "excused");
  const completed = expected.filter((row) => row.status === "completed").length;
  return {
    total: expected.length,
    completed,
    pending: expected.filter((row) => row.status === "pending").length,
    missed: expected.filter((row) => row.status === "missed").length,
    excused: rows.length - expected.length,
    completionRate: expected.length ? Math.round((completed / expected.length) * 100) : 0,
  };
}
