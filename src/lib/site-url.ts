import { parsePublicEnv } from "./env";

export function resolveSiteUrl(environment: Record<string, string | undefined>): string {
  if (environment.VERCEL_ENV === "preview" && environment.VERCEL_URL) {
    return `https://${environment.VERCEL_URL}`;
  }

  return parsePublicEnv(environment).NEXT_PUBLIC_SITE_URL;
}

export function getSiteUrl(): string {
  return resolveSiteUrl(process.env);
}
