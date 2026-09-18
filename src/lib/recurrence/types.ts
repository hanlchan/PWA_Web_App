export type RecurrenceRule =
  | { type: "one_time"; startDate: string; endDate?: string }
  | { type: "weekly"; startDate: string; endDate?: string; daysOfWeek: number[] }
  | { type: "monthly"; startDate: string; endDate?: string; daysOfMonth: number[] }
  | { type: "custom_dates"; startDate: string; endDate?: string; customDates: string[] };
