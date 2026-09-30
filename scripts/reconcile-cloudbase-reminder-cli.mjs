import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, ".migration-work", "source-public-data.json");
const envId = "pwa-web-app-d8gpuhess695771e6";
const apply = process.argv.includes("--apply");
if (apply && Date.now() - statSync(sourcePath).mtimeMs > 5 * 60_000) {
  throw new Error("Source snapshot is older than five minutes; export again before applying");
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return new Date(value).toISOString();
  }
  return value;
}
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
function execute(sql, label) {
  const result = spawnSync(process.execPath, [
    npxCli, "--yes", "--cache", join(root, ".npm-cache"), "--package", "@cloudbase/cli",
    "tcb", "db", "execute", "-e", envId, "--sql", sql, "--json",
  ], { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.toLowerCase();
    const categories = ["syntax", "permission", "denied", "function", "column", "relation", "transaction", "multiple", "readonly", "read-only", "timeout", "invalid", "unsupported", "internal", "constraint", "precondition", "statement", "uuid", "jsonb_populate_record", "plpgsql", "row type", "composite", "foreign key", "not-null", "null value", "duplicate", "cloudbase", "failed"]
      .filter((word) => diagnostic.includes(word));
    let outputShape = "unparsed";
    try {
      const parsed = JSON.parse(result.stdout);
      outputShape = JSON.stringify({ top: Object.keys(parsed), data: parsed.data && typeof parsed.data === "object" ? Object.keys(parsed.data) : [] });
    } catch { /* CLI error may be plain text. */ }
    const safeDiagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
      .replaceAll(sql, "[SQL_REDACTED]")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[UUID]")
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[EMAIL]")
      .replace(/'[^']*'/g, "'[VALUE_REDACTED]'")
      .slice(0, 500);
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}; categories=${categories.join(",") || "unclassified"}; shape=${outputShape}; diagnostic=${safeDiagnostic}`);
  }
  return JSON.parse(result.stdout);
}
if (process.argv.includes("--probe-do")) {
  execute("do $$ begin null; end $$", "Read-only PL/pgSQL capability probe");
  console.log(JSON.stringify({ probe: "do", supported: true }));
  process.exit(0);
}

const targetResult = execute(
  "select jsonb_build_object('occurrences',coalesce((select jsonb_agg(to_jsonb(t)) from public.plan_occurrences t),'[]'::jsonb),'notifications',coalesce((select jsonb_agg(to_jsonb(t)) from public.notifications t),'[]'::jsonb)) as snapshot",
  "Read-only target audit",
);
const rawRow = JSON.parse(targetResult.data?.Rows?.[0] ?? "[]")[0];
const target = typeof rawRow === "string" ? JSON.parse(rawRow) : rawRow;
if (!target || !Array.isArray(target.occurrences) || !Array.isArray(target.notifications)) {
  throw new Error("CloudBase target snapshot is incomplete");
}

const targetNotifications = new Map(target.notifications.map((row) => [row.id, row]));
const targetOccurrences = new Map(target.occurrences.map((row) => [row.id, row]));
const missingNotifications = source.notifications.filter((row) => !targetNotifications.has(row.id));
const sourceOnlySent = source.plan_occurrences.filter((row) => {
  const counterpart = targetOccurrences.get(row.id);
  return counterpart && row.reminder_sent_at && !counterpart.reminder_sent_at;
});
const unrelatedNotificationDiff = source.notifications.some((row) =>
  targetNotifications.has(row.id) && !same(row, targetNotifications.get(row.id)),
);
const unrelatedOccurrenceDiff = source.plan_occurrences.some((row) => {
  const counterpart = targetOccurrences.get(row.id);
  if (!counterpart) return true;
  const { reminder_sent_at: sourceReminder, ...sourceOther } = row;
  const { reminder_sent_at: targetReminder, ...targetOther } = counterpart;
  return !same(sourceOther, targetOther)
    || (!same(sourceReminder, targetReminder) && !(sourceReminder && !targetReminder));
});
const occurrence = sourceOnlySent[0];
const notification = missingNotifications[0];
if (missingNotifications.length !== 1 || sourceOnlySent.length !== 1
    || target.notifications.length !== source.notifications.length - 1
    || target.occurrences.length !== source.plan_occurrences.length
    || unrelatedNotificationDiff || unrelatedOccurrenceDiff
    || notification.type !== "workout_reminder"
    || notification.user_id !== occurrence.user_id
    || notification.data?.occurrence_id !== occurrence.id) {
  throw new Error("Expected exactly one matching reminder delta; refusing to write");
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", missingNotifications: 1, missingReminderMarkers: 1 }));
if (!apply) process.exit(0);

const marker = "$cloudbase_reminder_delta$";
const notificationJson = JSON.stringify(notification);
if (notificationJson.includes(marker)) throw new Error("Unsafe SQL quote marker");
const sql = `do $$
declare affected integer;
begin
  update public.plan_occurrences
  set reminder_sent_at = '${occurrence.reminder_sent_at}'::timestamptz
  where id = '${occurrence.id}'::uuid
    and user_id = '${occurrence.user_id}'::uuid
    and reminder_sent_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Reminder marker precondition changed'; end if;

  insert into public.notifications
  select source_row.* from jsonb_populate_record(null::public.notifications, ${marker}${notificationJson}${marker}::jsonb) source_row
  where not exists (select 1 from public.notifications where id = '${notification.id}'::uuid)
  on conflict do nothing;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Notification precondition changed'; end if;
end $$`;
execute(sql, "Atomic reminder reconciliation");

const verify = execute(
  `select ((select reminder_sent_at = '${occurrence.reminder_sent_at}'::timestamptz from public.plan_occurrences where id='${occurrence.id}'::uuid) and exists(select 1 from public.notifications where id='${notification.id}'::uuid)) as complete`,
  "Post-write verification",
);
const complete = JSON.parse(verify.data?.Rows?.[0] ?? "[]")[0];
if (complete !== true && complete !== "t") throw new Error("Post-write verification did not confirm the pair");
console.log(JSON.stringify({ mode: "verified", insertedNotifications: 1, updatedReminderMarkers: 1 }));
