export const ACCESS_TOKEN_COOKIE = "cloudbase_access_token";
export const REFRESH_TOKEN_COOKIE = "cloudbase_refresh_token";
export const EXPIRES_AT_COOKIE = "cloudbase_expires_at";
export const DEVICE_ID_COOKIE = "cloudbase_device_id";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
