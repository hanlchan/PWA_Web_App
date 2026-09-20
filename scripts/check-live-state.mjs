const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("Live state check requires URL and process-only secret key.");

const tables = [
  "profiles",
  "profile_settings",
  "workout_plans",
  "plan_custom_dates",
  "plan_occurrences",
  "checkins",
  "weight_entries",
  "follows",
  "checkin_likes",
  "notifications",
  "nudges",
  "push_subscriptions",
  "progress_photos",
];

for (const table of tables) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: secretKey, Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) {
    console.error(`${table} check failed: HTTP ${response.status} ${await response.text()}`);
    process.exitCode = 1;
    break;
  }
  console.log(`${table}=${response.headers.get("content-range")}`);
}
