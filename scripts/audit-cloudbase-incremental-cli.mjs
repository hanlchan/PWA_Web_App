import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(readFileSync(join(root, ".migration-work", "source-public-data.json"), "utf8"));
const envId = "pwa-web-app-d8gpuhess695771e6";
const keys = {
  profiles: ["id"], profile_settings: ["user_id"], workout_plans: ["id"],
  plan_custom_dates: ["plan_id", "custom_date"], plan_occurrences: ["plan_id", "scheduled_date"],
  checkins: ["id"], weight_entries: ["id"], follows: ["follower_id", "following_id"],
  checkin_likes: ["checkin_id", "user_id"], notifications: ["id"], nudges: ["id"],
  push_subscriptions: ["id"], progress_photos: ["id"],
};

const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const pairs = Object.keys(keys).flatMap((table) => [
  `'${table}'`,
  `coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.${table} t),'[]'::jsonb)`,
]);
const sql = `select jsonb_build_object(${pairs.join(",")}) as snapshot`;
const result = spawnSync(process.execPath, [
  npxCli, "--yes", "--cache", join(root, ".npm-cache"), "--package", "@cloudbase/cli",
  "tcb", "db", "execute", "-e", envId, "--sql", sql, "--json",
], { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

if (result.error || result.status !== 0) {
  throw new Error(`CloudBase read-only audit failed with exit code ${result.status ?? "unknown"}`);
}

const payload = JSON.parse(result.stdout);
const row = JSON.parse(payload.data?.Rows?.[0] ?? "[]");
const target = typeof row[0] === "string" ? JSON.parse(row[0]) : row[0];
if (!target || typeof target !== "object") throw new Error("CloudBase did not return a business-data snapshot");

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

function identity(value, columns) {
  return columns.map((column) => JSON.stringify(canonical(value[column]))).join("|");
}

const tables = Object.entries(keys).map(([table, columns]) => {
  const sourceRows = source[table];
  const targetRows = target[table];
  if (!Array.isArray(sourceRows) || !Array.isArray(targetRows)) throw new Error(`Missing data for ${table}`);
  const sourceByKey = new Map(sourceRows.map((row) => [identity(row, columns), row]));
  const targetByKey = new Map(targetRows.map((row) => [identity(row, columns), row]));
  const conflicts = [...sourceByKey.entries()].filter(([key, row]) =>
    targetByKey.has(key) && JSON.stringify(canonical(row)) !== JSON.stringify(canonical(targetByKey.get(key))),
  );
  const conflictColumns = new Set();
  const conflictShape = [];
  for (const [key, sourceRow] of conflicts) {
    const targetRow = targetByKey.get(key);
    const shape = {};
    for (const column of new Set([...Object.keys(sourceRow), ...Object.keys(targetRow)])) {
      if (JSON.stringify(canonical(sourceRow[column])) !== JSON.stringify(canonical(targetRow[column]))) {
        conflictColumns.add(column);
        if (column === "reminder_sent_at") {
          const sourceTime = sourceRow[column] ? Date.parse(sourceRow[column]) : null;
          const targetTime = targetRow[column] ? Date.parse(targetRow[column]) : null;
          shape[column] = {
            sourcePresent: sourceTime !== null,
            targetPresent: targetTime !== null,
            order: sourceTime === null || targetTime === null ? null : Math.sign(sourceTime - targetTime),
          };
        }
      }
    }
    conflictShape.push(shape);
  }
  return {
    table,
    source: sourceRows.length,
    target: targetRows.length,
    missing: [...sourceByKey.keys()].filter((key) => !targetByKey.has(key)).length,
    targetOnly: [...targetByKey.keys()].filter((key) => !sourceByKey.has(key)).length,
    conflicting: conflicts.length,
    conflictColumns: [...conflictColumns].sort(),
    conflictShape,
  };
});

console.log(JSON.stringify({
  mode: "read-only",
  sourceTotal: tables.reduce((total, table) => total + table.source, 0),
  targetTotal: tables.reduce((total, table) => total + table.target, 0),
  tables: tables.filter((table) => table.missing || table.targetOnly || table.conflicting),
  reminderDelta: (() => {
    const targetNotificationIds = new Set(target.notifications.map((row) => row.id));
    const missingNotifications = source.notifications.filter((row) => !targetNotificationIds.has(row.id));
    const targetOccurrences = new Map(target.plan_occurrences.map((row) => [identity(row, keys.plan_occurrences), row]));
    const sourceConflicts = source.plan_occurrences.filter((row) => {
      const counterpart = targetOccurrences.get(identity(row, keys.plan_occurrences));
      return counterpart && row.reminder_sent_at && !counterpart.reminder_sent_at;
    });
    return {
      missingNotificationTypes: missingNotifications.map((row) => row.type),
      matchedOccurrenceCount: sourceConflicts.filter((occurrence) =>
        missingNotifications.some((notification) =>
          notification.user_id === occurrence.user_id && notification.data?.occurrence_id === occurrence.id,
        ),
      ).length,
    };
  })(),
}));
