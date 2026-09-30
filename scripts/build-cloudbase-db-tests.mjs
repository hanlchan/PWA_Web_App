import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceDirectory = path.join(root, "supabase", "tests", "database");
const outputDirectory = path.join(root, "cloudbase", "tests", "database");
const files = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".sql")).sort();

await mkdir(outputDirectory, { recursive: true });
let removedAuthInserts = 0;
let hardenedFinishCalls = 0;
let configuredSearchPaths = 0;
for (const name of files) {
  let sql = await readFile(path.join(sourceDirectory, name), "utf8");
  sql = sql.replace(/\r\n/g, "\n");
  sql = sql.replace(/\bbegin;/i, () => {
    configuredSearchPaths += 1;
    return `begin;
set local search_path = public, extensions, pg_catalog;
-- Test-only privileges are rolled back with this transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;`;
  });
  sql = sql.replace(/insert into auth\.users\b[\s\S]*?;\n/gi, () => {
    removedAuthInserts += 1;
    return "-- CloudBase: auth.users is platform-owned; RLS identity is injected via request.jwt.claim.sub.\n";
  });
  sql = sql.replace(/select \* from finish\(\);/gi, () => {
    hardenedFinishCalls += 1;
    return `do $cloudbase_pgtap$
declare failure_summary text;
begin
  select string_agg(result, E'\\n') into failure_summary from finish() as finished(result);
  if failure_summary is not null then
    raise exception 'pgTAP failed:%', E'\\n' || failure_summary;
  end if;
end
$cloudbase_pgtap$;`;
  });
  await writeFile(path.join(outputDirectory, name), sql, "utf8");
}

if (removedAuthInserts !== 5) {
  throw new Error(`Expected to remove 5 Supabase auth.users fixtures, removed ${removedAuthInserts}`);
}
if (hardenedFinishCalls !== files.length) {
  throw new Error(`Expected ${files.length} pgTAP finish calls, replaced ${hardenedFinishCalls}`);
}
if (configuredSearchPaths !== files.length) {
  throw new Error(`Expected ${files.length} transactions, configured ${configuredSearchPaths}`);
}
console.log(JSON.stringify({ files: files.length, removedAuthInserts, hardenedFinishCalls, configuredSearchPaths }));
