import type { RecurrenceRule } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error(`日期格式无效: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || formatDate(date) !== value) throw new Error(`日期无效: ${value}`);
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function expandRecurrence(rule: RecurrenceRule, windowStart: string, windowEnd: string): string[] {
  const from = Math.max(parseDate(rule.startDate).valueOf(), parseDate(windowStart).valueOf());
  const until = Math.min(rule.endDate ? parseDate(rule.endDate).valueOf() : Number.POSITIVE_INFINITY, parseDate(windowEnd).valueOf());
  if (from > until) return [];

  if (rule.type === "custom_dates") {
    return [...new Set(rule.customDates)]
      .filter((value) => {
        const time = parseDate(value).valueOf();
        return time >= from && time <= until;
      })
      .sort();
  }

  const accepted = new Set<number>();
  if (rule.type === "weekly") rule.daysOfWeek.forEach((day) => accepted.add(day));
  if (rule.type === "monthly") rule.daysOfMonth.forEach((day) => accepted.add(day));

  const results: string[] = [];
  for (let time = from; time <= until; time += 86_400_000) {
    const date = new Date(time);
    const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    if (
      (rule.type === "one_time" && time === parseDate(rule.startDate).valueOf()) ||
      (rule.type === "weekly" && accepted.has(isoDay)) ||
      (rule.type === "monthly" && accepted.has(date.getUTCDate()))
    ) results.push(formatDate(date));
  }
  return results;
}
