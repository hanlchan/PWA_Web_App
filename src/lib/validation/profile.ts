import { z } from "zod";

function isTimezone(value: string) {
  try { new Intl.DateTimeFormat("zh-CN", { timeZone: value }).format(); return true; }
  catch { return false; }
}

const optionalHeight = z.union([z.literal(""), z.coerce.number().min(50).max(300)])
  .transform((value) => value === "" ? null : value);

export const profileSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/, "用户名需为 3-30 位小写字母、数字或下划线"),
  displayName: z.string().trim().min(1).max(50),
  heightCm: optionalHeight.optional().default(null),
  timezone: z.string().refine(isTimezone, "请选择有效时区"),
  avatarPath: z.string().nullable().optional(),
}).strict();

export type ProfileInput = z.infer<typeof profileSchema>;
