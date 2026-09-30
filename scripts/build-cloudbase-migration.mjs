import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const version = process.argv[2];
if (!/^\d{14}$/.test(version ?? "")) {
  throw new Error("Usage: node scripts/build-cloudbase-migration.mjs <YYYYMMDDHHMMSS>");
}

const root = process.cwd();
const sourceDirectory = path.join(root, "supabase", "migrations");
const migrationNames = [
  "0001_extensions_and_types.sql",
  "0002_profiles.sql",
  "0003_workout_plans.sql",
  "0004_occurrence_functions.sql",
  "0005_checkins.sql",
  "0006_dashboard_and_stats.sql",
  "0007_core_stats.sql",
  "0008_public_profiles.sql",
  "0009_weight_entries.sql",
  "0010_social.sql",
  "0011_push_and_jobs.sql",
  "0012_progress_photos.sql",
  "0013_enable_pgtap.sql",
  "0014_table_api_grants.sql",
  "0015_enforce_checkin_date_window.sql",
  "0016_service_role_table_grants.sql",
  "0017_dashboard_active_plan_flag.sql",
];

const sections = [];
for (const name of migrationNames) {
  let sql = await readFile(path.join(sourceDirectory, name), "utf8");
  sql = sql.replace(/\r\n/g, "\n");
  sections.push(`-- Source: supabase/migrations/${name}\n${sql.trim()}\n`);
}

let sql = sections.join("\n");

const authForeignKey = " references auth.users(id) on delete cascade";
if (!sql.includes(authForeignKey)) {
  throw new Error("Expected Supabase auth.users foreign key was not found");
}
sql = sql.replace(authForeignKey, "");

for (const unsupported of [
  "create extension if not exists pg_cron with schema pg_catalog;\n",
  "create extension if not exists pg_net with schema extensions;\n",
]) {
  if (!sql.includes(unsupported)) {
    throw new Error(`Expected line was not found: ${unsupported.trim()}`);
  }
  sql = sql.replace(unsupported, "");
}

// CloudBase auth.uid() is text. Existing business owner columns remain UUID so
// existing user IDs and relationships can be preserved. Storage paths are text.
const storageUidPlaceholder = "__CLOUDBASE_STORAGE_AUTH_UID__";
sql = sql.replaceAll("auth.uid()::text", storageUidPlaceholder);
sql = sql.replaceAll("auth.uid()", "auth.uid()::uuid");
sql = sql.replaceAll(storageUidPlaceholder, "auth.uid()");

const header = `-- Generated from the audited Supabase migrations.\n-- CloudBase compatibility changes:\n--   * preserve business UUIDs and cast text auth.uid() in business SQL/RLS\n--   * keep storage path identity comparisons as text\n--   * omit the incompatible internal auth.users primary-key foreign key\n--   * omit pg_net and pg_cron; CloudBase Functions and timer triggers replace them\n-- Do not add secrets or production data to this migration.\n\n`;

const outputDirectory = path.join(root, "cloudbase", "migrations");
const outputPath = path.join(outputDirectory, `${version}_initial_supabase_compat_schema.sql`);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${header}${sql.trim()}\n`, "utf8");
console.log(path.relative(root, outputPath));
