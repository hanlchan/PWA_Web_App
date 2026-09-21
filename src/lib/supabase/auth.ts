import { cache } from "react";

import { createClient } from "./server";

export const getVerifiedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});
