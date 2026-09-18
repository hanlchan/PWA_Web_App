import { TZDate } from "@date-fns/tz";

type NotificationInput = {
  scheduledDate: string;
  scheduledTime: string | null;
  timezone: string;
  reminderEnabled: boolean;
};

export function toNotificationUtc(input: NotificationInput): string | null {
  if (!input.reminderEnabled) return null;
  const dateParts = input.scheduledDate.split("-").map(Number);
  const timeParts = (input.scheduledTime ?? "20:00:00").split(":").map(Number);
  const [year, month, day] = dateParts;
  const [hour, minute, second = 0] = timeParts;
  if ([year, month, day, hour, minute, second].some((value) => value === undefined || !Number.isInteger(value))) {
    throw new Error("日期或时间格式无效");
  }

  const zoned = TZDate.tz(input.timezone, year!, month! - 1, day!, hour!, minute!, second!);
  if (
    zoned.getFullYear() !== year || zoned.getMonth() !== month! - 1 || zoned.getDate() !== day ||
    zoned.getHours() !== hour || zoned.getMinutes() !== minute || zoned.getSeconds() !== second
  ) throw new Error("本地时间不存在");
  return new Date(zoned.getTime()).toISOString();
}
