import { spawn, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envId = "pwa-web-app-d8gpuhess695771e6";
const sourcePath = join(root, ".migration-work", "source-public-data.json");
const apply = process.argv.includes("--apply");
const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

function command(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
  return JSON.parse(result.stdout);
}

function audit() {
  return command([join(root, "scripts", "audit-cloudbase-incremental-cli.mjs")], "Read-only full-table audit");
}

function requireReminderOnlyDelta(report) {
  const notification = report.tables?.find((item) => item.table === "notifications");
  const occurrence = report.tables?.find((item) => item.table === "plan_occurrences");
  const count = notification?.missing;
  if (report.mode !== "read-only" || !Number.isInteger(count) || count < 1
      || report.tables.length !== 2 || report.sourceTotal !== report.targetTotal + count
      || notification.targetOnly !== 0 || notification.conflicting !== 0
      || occurrence.missing !== 0 || occurrence.targetOnly !== 0 || occurrence.conflicting !== count
      || JSON.stringify(occurrence.conflictColumns) !== JSON.stringify(["reminder_sent_at"])
      || occurrence.conflictShape.length !== count
      || occurrence.conflictShape.some((shape) => !shape.reminder_sent_at?.sourcePresent || shape.reminder_sent_at?.targetPresent)
      || report.reminderDelta.matchedOccurrenceCount !== count
      || report.reminderDelta.missingNotificationTypes.length !== count
      || report.reminderDelta.missingNotificationTypes.some((type) => type !== "workout_reminder")) {
    throw new Error("Source and target differ beyond matched workout reminders; refusing to write");
  }
  return count;
}

function targetSnapshot() {
  const sql = "select jsonb_build_object('occurrences',coalesce((select jsonb_agg(to_jsonb(t)) from public.plan_occurrences t),'[]'::jsonb),'notifications',coalesce((select jsonb_agg(to_jsonb(t)) from public.notifications t),'[]'::jsonb)) as snapshot";
  const result = command([
    npxCli, "--yes", "--cache", join(root, ".npm-cache"), "--package", "@cloudbase/cli",
    "tcb", "db", "execute", "-e", envId, "--sql", sql, "--json",
  ], "Read-only target snapshot");
  const row = JSON.parse(result.data?.Rows?.[0] ?? "[]")[0];
  const snapshot = typeof row === "string" ? JSON.parse(row) : row;
  if (!Array.isArray(snapshot?.occurrences) || !Array.isArray(snapshot?.notifications)) {
    throw new Error("CloudBase target snapshot is incomplete");
  }
  return snapshot;
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
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

function createPairs(source, target, count) {
  const targetNotifications = new Map(target.notifications.map((row) => [row.id, row]));
  const targetOccurrences = new Map(target.occurrences.map((row) => [row.id, row]));
  const missing = source.notifications.filter((row) => !targetNotifications.has(row.id));
  const pending = source.plan_occurrences.filter((row) => {
    const existing = targetOccurrences.get(row.id);
    if (!existing) return false;
    const { reminder_sent_at: sourceReminder, ...sourceOther } = row;
    const { reminder_sent_at: targetReminder, ...targetOther } = existing;
    return sourceReminder && !targetReminder && same(sourceOther, targetOther);
  });
  if (missing.length !== count || pending.length !== count) {
    throw new Error("Reminder pair count changed during read-only audit");
  }
  const used = new Set();
  return missing.map((notification) => {
    const occurrence = pending.find((row) =>
      row.id === notification.data?.occurrence_id && row.user_id === notification.user_id,
    );
    if (notification.type !== "workout_reminder" || !occurrence || used.has(occurrence.id)) {
      throw new Error("A source notification does not uniquely match its pending occurrence");
    }
    used.add(occurrence.id);
    return { notification, occurrence };
  });
}

function buildSql(pairs) {
  const marker = "$cloudbase_reminder_delta$";
  const payload = JSON.stringify(pairs);
  if (payload.includes(marker)) throw new Error("Unsafe SQL quote marker in source data");
  return `do $reconcile$
declare pair jsonb; affected integer;
begin
  for pair in select value from jsonb_array_elements(${marker}${payload}${marker}::jsonb) loop
    update public.plan_occurrences
       set reminder_sent_at = (pair->'occurrence'->>'reminder_sent_at')::timestamptz
     where id = (pair->'occurrence'->>'id')::uuid
       and user_id = (pair->'occurrence'->>'user_id')::uuid
       and reminder_sent_at is null;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Reminder marker precondition changed'; end if;

    insert into public.notifications
    select source_row.* from jsonb_populate_record(null::public.notifications, pair->'notification') source_row
    where not exists (
      select 1 from public.notifications where id = (pair->'notification'->>'id')::uuid
    ) on conflict do nothing;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Notification precondition changed'; end if;
  end loop;
end $reconcile$`;
}

async function callMcp(action, sql) {
  const child = spawn(process.execPath, [
    npxCli, "--yes", "--cache", join(root, ".npm-cache"),
    "--package", "@cloudbase/cloudbase-mcp@2.34.6", "cloudbase-mcp",
  ], {
    cwd: root, env: { ...process.env, TCB_SITE: "domestic" },
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  let nextId = 1;
  const pending = new Map();
  createInterface({ input: child.stdout }).on("line", (line) => {
    let response;
    try { response = JSON.parse(line); } catch { return; }
    const item = pending.get(response.id);
    if (!item) return;
    pending.delete(response.id);
    clearTimeout(item.timer);
    if (response.error) item.reject(new Error(`CloudBase MCP ${item.method} failed`));
    else item.resolve(response.result);
  });
  child.on("exit", () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("CloudBase MCP exited before responding"));
    }
    pending.clear();
  });
  function request(method, params, timeoutMs = 120000) {
    const id = nextId++;
    return new Promise((resolveRequest, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CloudBase MCP ${method} timed out`));
      }, timeoutMs);
      pending.set(id, { method, resolve: resolveRequest, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  try {
    await request("initialize", {
      protocolVersion: "2025-03-26", capabilities: {},
      clientInfo: { name: "pwa-reminder-reconcile", version: "1.0.0" },
    }, 30000);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const result = await request("tools/call", {
      name: "managePgDatabase",
      arguments: { action, sql, envId, ...(action === "execute" ? { confirm: true } : {}) },
    });
    const text = result.content?.filter((part) => part.type === "text").map((part) => part.text).join("\n") ?? "";
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error(`CloudBase MCP ${action} response was not JSON`); }
    if (result.isError || parsed.success === false || parsed.error) {
      throw new Error(`CloudBase MCP ${action} rejected reminder reconciliation: ${parsed.errorCode ?? parsed.code ?? "unknown"}`);
    }
    return parsed;
  } finally {
    child.stdin.end();
    child.kill();
  }
}

if (Date.now() - statSync(sourcePath).mtimeMs > 5 * 60_000) {
  throw new Error("Source snapshot is older than five minutes; export again before reconciliation");
}
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const count = requireReminderOnlyDelta(audit());
const pairs = createPairs(source, targetSnapshot(), count);
const sql = buildSql(pairs);
await callMcp("dryRun", sql);
console.log(JSON.stringify({ mode: apply ? "ready-to-apply" : "dry-run", matchedReminderPairs: count }));
if (apply) {
  if (Date.now() - statSync(sourcePath).mtimeMs > 5 * 60_000) {
    throw new Error("Source snapshot became stale before apply");
  }
  await callMcp("execute", sql);
  const after = audit();
  if (after.sourceTotal !== after.targetTotal || after.tables.length !== 0) {
    throw new Error("Post-write full-table audit is not equal; investigate before cutover");
  }
  console.log(JSON.stringify({ mode: "verified", sourceTotal: after.sourceTotal, targetTotal: after.targetTotal, matchedReminderPairs: count }));
}
