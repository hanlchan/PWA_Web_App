import { cache } from "react";

import { createClient } from "./server";

export const getVerifiedUserId = cache(async (): Promise<string | null> => {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user?.id ?? null;
});
