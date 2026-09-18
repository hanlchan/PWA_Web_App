import { z } from "zod";

export const weightEntrySchema = z.object({
  weightKg: z.coerce.number().min(20, "体重不能低于 20kg").max(500, "体重不能高于 500kg"),
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "记录时间格式无效"),
  measurementType: z.enum(["morning", "evening", "custom"]),
}).strict();
