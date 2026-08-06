import { SCOPES } from "./oauth";

/** Shared plumbing for the OAuth endpoints: identity, metadata documents, error shapes. */

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
  const configured = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
  const host = req.headers.get("host");
  if (!host) return configured || new URL(req.url).origin;

  // The Host header decides the issuer, so it is checked rather than trusted:
  // an issuer we do not own is exactly the identity confusion the `iss`
  // parameter exists to prevent. Any localhost form is allowed because dev
  // servers land on an arbitrary port; otherwise the host must be the
  // configured deployment.
  const hostname = host.split(":")[0];
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  if (!isLoopback && configured && hostname !== new URL(configured).hostname) return configured;

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto ?? new URL(req.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
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
