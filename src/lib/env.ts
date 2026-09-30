import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_CLOUDBASE_ENV_ID: z.string().min(1),
  NEXT_PUBLIC_CLOUDBASE_REGION: z.string().min(1).default("ap-shanghai"),
  NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(environment: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_CLOUDBASE_ENV_ID: environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
    NEXT_PUBLIC_CLOUDBASE_REGION: environment.NEXT_PUBLIC_CLOUDBASE_REGION,
    NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: environment.NEXT_PUBLIC_SITE_URL,
  });
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_CLOUDBASE_ENV_ID: process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
    NEXT_PUBLIC_CLOUDBASE_REGION: process.env.NEXT_PUBLIC_CLOUDBASE_REGION,
    NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
