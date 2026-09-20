export function authorizeCron(request: Request) {
  const expected = Deno.env.get("WORKOUT_CRON_SECRET");
  if (!expected || request.headers.get("x-cron-secret") !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return null;
}

export function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getSupabaseSecretKey() {
  const values = JSON.parse(requiredEnv("SUPABASE_SECRET_KEYS")) as Record<string, string>;
  const value = values.default;
  if (!value) throw new Error("Missing default Supabase secret key");
  return value;
}
