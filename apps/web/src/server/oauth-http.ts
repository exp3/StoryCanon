import { SCOPES } from "./oauth";

/** Shared plumbing for the OAuth endpoints: identity, metadata documents, error shapes. */

/**
 * The Host header, decided against the configured deployment.
 *
 * `serverOrigin` and `serverHostname` must agree about which host a request is
 * allowed to claim, so the decision lives here once rather than in each of
 * them. `accepted: false` means the Host was refused and the caller falls back
 * to configuration; a null `host` means the request carried no Host header.
 */
function resolveHost(req: Request) {
  const configured = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
  const host = req.headers.get("host");
  if (!host) return { configured, host: null, hostname: null, accepted: false } as const;

  // The Host header decides the issuer, so it is checked rather than trusted:
  // an issuer we do not own is exactly the identity confusion the `iss`
  // parameter exists to prevent. Any localhost form is allowed because dev
  // servers land on an arbitrary port; otherwise the host must be the
  // configured deployment.
  const hostname = host.split(":")[0];
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  const accepted = isLoopback || !configured || hostname === new URL(configured).hostname;
  return { configured, host, hostname, accepted } as const;
}

/**
 * The issuer identifier.
 *
 * Derived from the request, not from configuration: RFC 8414 §3.3 requires the
 * `issuer` in the metadata document to be byte-identical to the origin the
 * client fetched it from, and clients MUST reject it otherwise. A configured
 * `NEXTAUTH_URL` that differs by so much as a port — which is exactly what
 * happens in local development — would break discovery, so it is only the
 * fallback for when there is no Host header to read. This matches the app's
 * existing posture, where NextAuth already runs with `trustHost: true`.
 */
export function serverOrigin(req: Request) {
  const { configured, host, accepted } = resolveHost(req);
  if (host === null) return configured || new URL(req.url).origin;
  if (!accepted) return configured;

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto ?? new URL(req.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

/**
 * The hostname `serverOrigin` settles on, without building the origin string.
 *
 * `mcp-origin.ts` needs this to seed the MCP transport's Origin allowlist from
 * the same decision the issuer uses, instead of from the raw Host header. It
 * returns a hostname rather than a URL because `serverOrigin` produces its
 * result by concatenating `x-forwarded-proto` with the Host header — both
 * attacker-supplied — and re-parsing that string is a failure mode worth not
 * having. The only URL parsed here comes from `NEXTAUTH_URL`.
 *
 * `resolveHost` splits on ":" the way this code always has, which mangles a
 * bracketed IPv6 Host into "[". That is a separately tracked bug; preserving it
 * is what keeps this a refactor. The MCP allowlist carries the loopback forms
 * unconditionally, so the mangled value never decides anything there.
 */
export function serverHostname(req: Request) {
  const { configured, hostname, accepted } = resolveHost(req);
  if (hostname === null) {
    // No Host header, so there is nothing to distrust. `serverOrigin` falls
    // back to configuration here and returns the request origin when there is
    // none; a `NEXTAUTH_URL` too malformed to parse takes the same path rather
    // than throwing, so the two stay in step.
    return parseHostname(configured) ?? new URL(req.url).hostname;
  }
  // `accepted` is only false when `resolveHost` already parsed `configured`.
  if (!accepted) return new URL(configured).hostname;
  return hostname;
}

function parseHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function mcpResourceUrl(origin: string) {
  return `${origin}/mcp`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "StoryCanon",
    resource_documentation: `${origin}/settings`,
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    scopes_supported: [...SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // OAuth 2.1 requires PKCE, and `plain` is deliberately not offered.
    code_challenge_methods_supported: ["S256"],
    // Public clients only: no secret is issued, so nothing to authenticate with.
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/settings`,
  };
}

/** Metadata is public and cacheable, but must never be cached per-user. */
export function metadataResponse(body: unknown) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function oauthError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}
