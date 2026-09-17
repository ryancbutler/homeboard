import { z } from "zod";

export const scheduleSchema = z.object({
  kind: z.enum(["once", "daily", "weekdays", "weekly"]),
  startDate: z.string().date(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).default([])
}).superRefine((schedule, context) => {
  if (schedule.kind === "weekly" && schedule.weekdays.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["weekdays"], message: "Choose at least one weekly day" });
  }
  if (schedule.kind === "weekdays" && schedule.weekdays.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["weekdays"], message: "Choose at least one weekday" });
  }
});
