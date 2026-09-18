import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  p256dh: z.string().min(20).max(512),
  auth: z.string().min(8).max(256),
  userAgent: z.string().max(500),
}).strict();
