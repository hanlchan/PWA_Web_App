"use client";

import cloudbase from "@cloudbase/js-sdk";

import { getPublicEnv } from "../env";

let instance: ReturnType<typeof cloudbase.init> | undefined;

export function createClient() {
  if (instance) return instance;
  const environment = getPublicEnv();
  instance = cloudbase.init({
    env: environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
    region: environment.NEXT_PUBLIC_CLOUDBASE_REGION,
    accessKey: environment.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    auth: { detectSessionInUrl: true },
  });
  return instance;
}
