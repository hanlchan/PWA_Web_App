import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return Response.json({ error: "push is not configured" }, { status: 503 });
  return Response.json({ publicKey }, { headers: { "Cache-Control": "private, no-store" } });
}
