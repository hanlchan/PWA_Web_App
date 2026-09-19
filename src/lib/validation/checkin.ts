import { z } from "zod";

export const checkinDetailsSchema = z.object({
  checkinId: z.string().uuid("打卡编号无效"),
  date: z.iso.date(),
  durationMinutes: z.union([z.literal(""), z.coerce.number().int().min(1).max(1440)])
    .transform((value) => value === "" ? null : value),
  activityText: z.string().trim().max(500, "运动内容不能超过 500 字"),
  notes: z.string().trim().max(2000, "备注不能超过 2000 字"),
}).strict();
