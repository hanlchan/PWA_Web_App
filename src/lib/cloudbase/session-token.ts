// This is only a fail-closed check for missing PG RLS claims. CloudBase verifies
// the JWT signature when the token is used; decoding it here never grants access.
export function hasExpectedRlsClaims(token: string | undefined, now = Date.now()) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return false;

  try {
    const claims: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object") return false;
    const value = claims as Record<string, unknown>;
    return value.role === "authenticated"
      && typeof value.sub === "string"
      && value.sub.length > 0
      && typeof value.exp === "number"
      && value.exp * 1000 > now + 60_000;
  } catch {
    return false;
  }
}
