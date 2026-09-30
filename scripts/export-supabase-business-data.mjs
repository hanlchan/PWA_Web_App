import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
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

const cli = path.join(
  root,
  "node_modules",
  "@supabase",
  "cli-windows-x64",
  "bin",
  "supabase.exe",
);
const query = tables
  .map(
    (table) =>
      `select '${table}'::text as table_name, to_jsonb(source_row) as row_data from public.${table} source_row`,
  )
  .join(" union all ");

const result = spawnSync(cli, ["--output", "json", "db", "query", "--linked", query], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});

if (result.status !== 0) {
  throw new Error(`Supabase export failed: ${result.stderr || "unknown error"}`);
}

const payload = JSON.parse(result.stdout);
if (!Array.isArray(payload.rows)) {
  throw new Error("Supabase query did not return a rows array");
}

const rowsByTable = Object.fromEntries(tables.map((table) => [table, []]));
for (const row of payload.rows) {
  if (!Object.hasOwn(rowsByTable, row.table_name)) {
    throw new Error(`Unexpected source table: ${row.table_name}`);
  }
  rowsByTable[row.table_name].push(row.row_data);
}

const tag = "$cloudbase_data$";
const statements = [];
for (const table of tables) {
  const rows = rowsByTable[table];
  const json = JSON.stringify(rows);
  if (json.includes(tag)) {
    throw new Error(`Unsafe dollar-quote marker found in ${table}`);
  }
  if (rows.length > 0) {
    statements.push(
      `insert into public.${table} select * from jsonb_populate_recordset(null::public.${table}, ${tag}${json}${tag}::jsonb);`,
    );
  }
}

const workDirectory = path.join(root, ".migration-work");
await mkdir(workDirectory, { recursive: true });
await writeFile(
  path.join(workDirectory, "source-public-data.json"),
  `${JSON.stringify(rowsByTable)}\n`,
  "utf8",
);
await writeFile(
  path.join(workDirectory, "import-public-data.sql"),
  `do $migration$\nbegin\n  ${statements.join("\n  ")}\nend\n$migration$;\n`,
  "utf8",
);

const counts = Object.fromEntries(tables.map((table) => [table, rowsByTable[table].length]));
const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({ counts, total }));
