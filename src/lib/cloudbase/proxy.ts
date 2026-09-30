import cloudbase from "@cloudbase/js-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "../env";
import {
  ACCESS_TOKEN_COOKIE,
  EXPIRES_AT_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieOptions,
} from "./cookies";
import { hasExpectedRlsClaims } from "./session-token";

const protectedPaths = ["/", "/me", "/onboarding"];
const protectedPathPrefixes = ["/plans", "/stats", "/settings", "/weight", "/feed", "/notifications"];

function isProtectedPath(pathname: string) {
  return protectedPaths.includes(pathname) || protectedPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function clearSession(request: NextRequest) {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, EXPIRES_AT_COOKIE]) request.cookies.delete(name);
  let response: NextResponse;
  if (isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    response = NextResponse.redirect(loginUrl);
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
  }
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, EXPIRES_AT_COOKIE]) response.cookies.delete(name);
  return response;
}

export async function updateSession(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const expiresAt = Number(request.cookies.get(EXPIRES_AT_COOKIE)?.value ?? 0);
  if (refreshToken && (!hasExpectedRlsClaims(accessToken) || expiresAt < Date.now() + 60_000)) {
    const environment = getPublicEnv();
    const app = cloudbase.init({
      env: environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
      region: environment.NEXT_PUBLIC_CLOUDBASE_REGION,
      accessKey: environment.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
    });
    let refreshed;
    try {
      refreshed = await app.auth.refreshSession(refreshToken);
    } catch {
      return clearSession(request);
    }
    const { data, error } = refreshed;
    const session = data.session;
    if (!error && session?.access_token && session.refresh_token && session.expires_in
      && hasExpectedRlsClaims(session.access_token)) {
      const nextExpiry = Date.now() + session.expires_in * 1000;
      request.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token);
      request.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token);
      request.cookies.set(EXPIRES_AT_COOKIE, String(nextExpiry));
      const response = NextResponse.next({ request: { headers: request.headers } });
      response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, { ...sessionCookieOptions, expires: new Date(nextExpiry) });
      response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
        ...sessionCookieOptions,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      response.cookies.set(EXPIRES_AT_COOKIE, String(nextExpiry), { ...sessionCookieOptions, expires: new Date(nextExpiry) });
      return response;
    }
    return clearSession(request);
  }

  if (!hasExpectedRlsClaims(accessToken)) return clearSession(request);
  return NextResponse.next();
}
