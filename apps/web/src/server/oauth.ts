import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * OAuth 2.1 primitives for the MCP authorization server.
 *
 * Everything here is pure — no Prisma, no request objects — so the parts that
 * are easy to get subtly wrong (PKCE verification, redirect matching, token
 * hashing) can be unit tested directly.
 */

export const SCOPES = ["storycanon:read", "storycanon:write"] as const;
export type Scope = (typeof SCOPES)[number];

/** Long enough that guessing is hopeless; the prefix indexes the lookup. */
const TOKEN_BYTES = 32;
export const TOKEN_PREFIX_LENGTH = 12;

export const AUTHORIZATION_CODE_TTL_MS = 60_000;
export const ACCESS_TOKEN_TTL_MS = 60 * 60_000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;

export function generateToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hashes a credential for storage.
 *
 * SHA-256 rather than bcrypt: these are full-entropy random strings, so a work
 * factor buys nothing against guessing, and every MCP request would otherwise
 * pay it. The pepper is the same one the API tokens use, so a database dump
 * alone is still not enough to forge one.
 */
export function hashToken(value: string) {
  const pepper = process.env.APP_API_TOKEN_PEPPER ?? "";
  return createHash("sha256").update(`${value}:${pepper}`).digest("hex");
}

export function tokenPrefix(value: string) {
  return value.slice(0, TOKEN_PREFIX_LENGTH);
}

/** Constant-time compare for values that were derived from a secret. */
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies an RFC 7636 S256 challenge. `plain` is deliberately unsupported —
 * OAuth 2.1 requires S256 for public clients, and accepting `plain` would let
 * an attacker who intercepts the authorization code redeem it.
 */
export function verifyCodeChallenge(codeVerifier: string, codeChallenge: string) {
  // RFC 7636 §4.1: 43-128 chars from the unreserved set.
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return safeEqual(computed, codeChallenge);
}

/**
 * Exact-match redirect URI comparison (OAuth 2.1 §4.1.2.1). No prefix or
 * wildcard matching: a loose comparison here is how authorization codes get
 * delivered to an attacker's endpoint.
 */
export function isRegisteredRedirectUri(candidate: string, registered: string[]) {
  return registered.includes(candidate);
}

/**
 * Rejects redirect URIs we will not hand a code to. Loopback HTTP is allowed
 * because that is how desktop and CLI clients receive the callback; everything
 * else must be HTTPS.
 */
export function isAllowedRedirectUri(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  // Custom schemes (e.g. `myapp://callback`) are how native clients register.
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && url.protocol !== "javascript:" && url.protocol !== "data:";
}

/** Narrows a requested scope string to the scopes this server actually grants. */
export function normalizeScope(requested: string | null | undefined) {
  if (!requested) return SCOPES.join(" ");
  const granted = requested
    .split(/\s+/)
    .filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
  return granted.length > 0 ? [...new Set(granted)].join(" ") : "";
}

export function scopeSatisfies(granted: string, required: string) {
  const have = new Set(granted.split(/\s+/).filter(Boolean));
  return required
    .split(/\s+/)
    .filter(Boolean)
    .every((scope) => have.has(scope));
}

/**
 * The RFC 8707 resource identifier a token is bound to.
 *
 * Compared without the fragment, and with the trailing slash normalised away,
 * so `https://host/mcp` and `https://host/mcp/` are the same audience while a
 * different path is not.
 */
export function canonicalResource(value: string | null | undefined) {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

export function resourceMatches(tokenResource: string | null, expected: string) {
  // A token issued before a client started sending `resource` has none to
  // check; the audience is then whatever this server issued it for.
  if (!tokenResource) return true;
  return tokenResource === canonicalResource(expected);
}
