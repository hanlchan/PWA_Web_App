import { z } from "zod";

const isoDate = z.iso.date();
const optionalText = z.string().max(2000).trim().optional().default("");
const base = z.object({
  title: z.string().trim().min(1).max(100),
  description: optionalText,
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  reminderEnabled: z.boolean().default(true),
  notes: optionalText,
});

const uniqueSorted = <T extends number | string>(values: T[]) => [...new Set(values)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

export const planSchema = z.discriminatedUnion("recurrenceType", [
  base.extend({ recurrenceType: z.literal("one_time") }).strict(),
  base.extend({
    recurrenceType: z.literal("weekly"),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).transform(uniqueSorted),
  }).strict(),
  base.extend({
    recurrenceType: z.literal("monthly"),
    daysOfMonth: z.array(z.number().int().min(1).max(31)).min(1).transform(uniqueSorted),
  }).strict(),
  base.extend({
    recurrenceType: z.literal("custom_dates"),
    customDates: z.array(isoDate).min(1).transform(uniqueSorted),
  }).strict(),
]).superRefine((value, context) => {
  if (value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "结束日期不能早于开始日期" });
  }
  if (value.recurrenceType === "custom_dates") {
    value.customDates.forEach((date, index) => {
      if (date < value.startDate || (value.endDate && date > value.endDate)) {
        context.addIssue({ code: "custom", path: ["customDates", index], message: "自定义日期必须在计划范围内" });
      }
    });
  }
});

export type PlanInput = z.infer<typeof planSchema>;
