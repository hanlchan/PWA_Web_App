"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACCESS_TOKEN_COOKIE,
  DEVICE_ID_COOKIE,
  EXPIRES_AT_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieOptions,
} from "@/lib/cloudbase/cookies";
import { hasExpectedRlsClaims } from "@/lib/cloudbase/session-token";
import { getPublicEnv } from "@/lib/env";
import type { ActionResult } from "./result";

type BrowserSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceId?: string;
};

export async function syncSessionAction(session: BrowserSession): Promise<ActionResult> {
  if (!hasExpectedRlsClaims(session.accessToken) || !session.refreshToken
    || !Number.isFinite(session.expiresIn) || session.expiresIn <= 0) {
    return { ok: false, message: "CloudBase 会话不完整" };
  }

  const environment = getPublicEnv();
  const origin = `https://${environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com`;
  const response = await fetch(`${origin}/auth/v1/user/me`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(session.deviceId ? { "x-device-id": session.deviceId } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: "CloudBase 会话验证失败" };

  const cookieStore = await cookies();
  const expiresAt = Date.now() + session.expiresIn * 1000;
  cookieStore.set(ACCESS_TOKEN_COOKIE, session.accessToken, { ...sessionCookieOptions, expires: new Date(expiresAt) });
  cookieStore.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...sessionCookieOptions,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  cookieStore.set(EXPIRES_AT_COOKIE, String(expiresAt), { ...sessionCookieOptions, expires: new Date(expiresAt) });
  if (session.deviceId) {
    cookieStore.set(DEVICE_ID_COOKIE, session.deviceId, {
      ...sessionCookieOptions,
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
  }
  return { ok: true, data: undefined };
}

export async function clearSessionAction(): Promise<ActionResult> {
  const cookieStore = await cookies();
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, EXPIRES_AT_COOKIE]) cookieStore.delete(name);
  return { ok: true, data: undefined };
}

export async function logoutAction(): Promise<ActionResult> {
  await clearSessionAction();
  redirect("/login");
}
