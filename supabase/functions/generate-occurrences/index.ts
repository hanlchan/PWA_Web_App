import { createClient } from "@supabase/supabase-js";
import { authorizeCron, getSupabaseSecretKey, requiredEnv } from "../_shared/cron.ts";

Deno.serve(async (request) => {
  const denied = authorizeCron(request);
  if (denied) return denied;
  try {
    const supabase = createClient(requiredEnv("SUPABASE_URL"), getSupabaseSecretKey(), { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("generate_all_occurrences");
    if (error) throw error;
    return Response.json({ ok: true, processedPlans: data });
  } catch (error) {
    console.error("generate-occurrences failed", error);
    return Response.json({ ok: false, error: "occurrence generation failed" }, { status: 500 });
  }
});
