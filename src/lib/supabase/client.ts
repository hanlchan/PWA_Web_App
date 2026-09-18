"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "../env";
import type { Database } from "../types/database";

export function createClient() {
  const environment = getPublicEnv();

  return createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
