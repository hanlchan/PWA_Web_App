import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, ".migration-work", "source-public-data.json");
const apply = process.argv.includes("--apply");

const tableKeys = {
  profiles: ["id"],
  profile_settings: ["user_id"],
  workout_plans: ["id"],
  plan_custom_dates: ["plan_id", "custom_date"],
  plan_occurrences: ["plan_id", "scheduled_date"],
  checkins: ["id"],
  weight_entries: ["id"],
  follows: ["follower_id", "following_id"],
  checkin_likes: ["checkin_id", "user_id"],
  notifications: ["id"],
  nudges: ["id"],
  push_subscriptions: ["id"],
  progress_photos: ["id"],
};

if (!existsSync(sourcePath)) {
  throw new Error("Run scripts/export-supabase-business-data.mjs first");
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
for (const table of Object.keys(tableKeys)) {
  if (!Array.isArray(source[table])) throw new Error(`Missing source rows for ${table}`);
}

const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

function callMcp(tool, values, label) {
  const result = spawnSync(process.execPath, [
    npxCli,
    "--yes",
    "--cache",
    join(root, ".npm-cache"),
    "mcporter",
    "call",
    "--stdio",
    "node",
    "--stdio-arg",
    npxCli.replaceAll("\\", "/"),
    "--stdio-arg",
    "-y",
    "--stdio-arg",
    "@cloudbase/cloudbase-mcp@latest",
    tool,
    "--args",
    JSON.stringify(values),
    "--output",
    "json",
    "--timeout",
    "120000",
  ], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, TCB_SITE: "domestic" },
  });

  if (result.error || result.status !== 0) {
    const detail = `${result.error?.message ?? ""}\n${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim().slice(0, 1600);
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}${detail ? `: ${detail}` : ""}`);
  }
  return JSON.parse(result.stdout);
}

function dollarQuote(value, table) {
  const marker = `$cloudbase_${table}$`;
  if (value.includes(marker)) throw new Error(`Unsafe dollar-quote marker in ${table}`);
  return `${marker}${value}${marker}`;
}

function sourceCte(table) {
  const json = JSON.stringify(source[table]);
  return `select * from jsonb_populate_recordset(null::public.${table}, ${dollarQuote(json, table)}::jsonb)`;
}

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

function identity(row, keys) {
  return keys.map((key) => JSON.stringify(canonical(row[key]))).join("|");
}

function queryTarget(label) {
  const pairs = Object.keys(tableKeys).flatMap((table) => [
    `'${table}'`,
    `coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.${table} t),'[]'::jsonb)`,
  ]);
  const sql = `select jsonb_build_object(${pairs.join(",")}) as snapshot`;
  const response = callMcp("queryPgDatabase", { action: "sql", sql }, label);
  const raw = response?.data?.rows?.[0]?.snapshot;
  const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!snapshot || typeof snapshot !== "object") throw new Error("CloudBase did not return a table snapshot");
  writeFileSync(join(root, ".migration-work", "cloudbase-target-snapshot.json"), `${JSON.stringify(snapshot)}\n`, "utf8");
  return snapshot;
}

function audit(label) {
  const target = queryTarget(label);
  const rows = [];
  const changedRows = {};
  for (const [table, keys] of Object.entries(tableKeys)) {
    const sourceByKey = new Map(source[table].map((row) => [identity(row, keys), row]));
    const targetRows = Array.isArray(target[table]) ? target[table] : [];
    const targetByKey = new Map(targetRows.map((row) => [identity(row, keys), row]));
    const missing = [...sourceByKey.entries()].filter(([key]) => !targetByKey.has(key));
    const targetOnly = [...targetByKey.keys()].filter((key) => !sourceByKey.has(key));
    const conflicting = [...sourceByKey.entries()].filter(([key, row]) => {
      const targetRow = targetByKey.get(key);
      return targetRow !== undefined && JSON.stringify(canonical(row)) !== JSON.stringify(canonical(targetRow));
    });
    changedRows[table] = [...missing, ...conflicting].map(([, row]) => row);
    rows.push({
      table_name: table,
      source_count: source[table].length,
      target_count: targetRows.length,
      missing_count: missing.length,
      target_only_count: targetOnly.length,
      conflicting_count: conflicting.length,
    });
  }
  console.log(JSON.stringify({ label, rows }));
  return { rows, changedRows, target };
}

const before = audit("audit CloudBase incremental source");
const unsafe = before.rows.filter((row) => row.target_only_count !== 0);
if (unsafe.length > 0) {
  throw new Error(`Refusing incremental sync because target-only rows exist: ${JSON.stringify(unsafe)}`);
}

const sourceOccurrenceByNaturalKey = new Map(source.plan_occurrences.map((row) => [identity(row, tableKeys.plan_occurrences), row]));
const rekeyedTargetOccurrenceIds = new Set(before.target.plan_occurrences
  .filter((row) => {
    const sourceRow = sourceOccurrenceByNaturalKey.get(identity(row, tableKeys.plan_occurrences));
    return sourceRow && sourceRow.id !== row.id;
  })
  .map((row) => row.id));
const referencedRekeyedIds = before.target.checkins
  .filter((row) => row.occurrence_id && rekeyedTargetOccurrenceIds.has(row.occurrence_id))
  .map((row) => row.occurrence_id);
if (referencedRekeyedIds.length > 0) {
  throw new Error(`Refusing to re-key occurrences referenced by check-ins: ${JSON.stringify(referencedRekeyedIds)}`);
}

const missing = before.rows.filter((row) => row.missing_count > 0);
if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    missing,
    conflicts: before.rows.filter((row) => row.conflicting_count > 0),
    rekeyedOccurrences: rekeyedTargetOccurrenceIds.size,
  }));
  process.exit(0);
}

const conflictCount = before.rows.reduce((total, row) => total + row.conflicting_count, 0);
if (missing.length === 0 && conflictCount === 0) {
  console.log(JSON.stringify({ mode: "apply", inserted: 0, message: "already synchronized" }));
  process.exit(0);
}

const timestampTriggers = {
  profiles: "profiles_set_updated_at",
  profile_settings: "profile_settings_set_updated_at",
  workout_plans: "workout_plans_set_updated_at",
  checkins: "checkins_set_updated_at",
  push_subscriptions: "push_subscriptions_set_updated_at",
};
const auditSql = [];
let changed = 0;
for (const [table, keys] of Object.entries(tableKeys)) {
  const rows = before.changedRows[table];
  if (rows.length === 0) continue;
  const columns = Object.keys(rows[0]);
  const updateColumns = columns.filter((column) => !keys.includes(column));
  for (let offset = 0; offset < rows.length; offset += 8) {
    const chunk = rows.slice(offset, offset + 8);
    const original = source[table];
    source[table] = chunk;
    const trigger = timestampTriggers[table];
    const sql = [
      "begin;",
      trigger ? `alter table public.${table} disable trigger ${trigger};` : null,
      `insert into public.${table} select * from (${sourceCte(table)}) source`,
      `on conflict (${keys.join(", ")}) do update set ${updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")};`,
      trigger ? `alter table public.${table} enable trigger ${trigger};` : null,
      "commit;",
    ].filter(Boolean).join("\n");
    source[table] = original;
    auditSql.push(sql);
    callMcp("managePgDatabase", { action: "execute", sql, confirm: true }, `sync ${table} rows ${offset + 1}-${offset + chunk.length}`);
    changed += chunk.length;
  }
}
writeFileSync(join(root, ".migration-work", "incremental-sync.sql"), `${auditSql.join("\n\n")}\n`, "utf8");

const after = audit("verify CloudBase incremental source");
const remaining = after.rows.filter((row) =>
  row.missing_count !== 0 || row.target_only_count !== 0 || row.conflicting_count !== 0,
);
if (remaining.length > 0) {
  throw new Error(`Incremental sync verification failed: ${JSON.stringify(remaining)}`);
}

const inserted = missing.reduce((total, row) => total + row.missing_count, 0);
console.log(JSON.stringify({ mode: "apply", inserted, changed, verified: true }));
