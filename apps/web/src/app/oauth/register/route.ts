import { isAllowedRedirectUri, normalizeScope } from "@/server/oauth";
import { oauthError } from "@/server/oauth-http";
import { registerClient } from "@/server/oauth-store";

/**
 * RFC 7591 dynamic client registration.
 *
 * Open registration, which is what MCP clients expect: they have no way to
 * pre-register. Registration on its own grants nothing — a client only gets
 * access after a signed-in user approves it on the consent screen, and only
 * for that user.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_GRANT_TYPES = ["authorization_code", "refresh_token"];
const MAX_REDIRECT_URIS = 10;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return oauthError("invalid_client_metadata", "Request body must be JSON.");
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return oauthError("invalid_redirect_uri", "redirect_uris is required and must be a non-empty array.");
  }
  if (redirectUris.length > MAX_REDIRECT_URIS) {
    return oauthError("invalid_redirect_uri", `At most ${MAX_REDIRECT_URIS} redirect URIs are supported.`);
  }
  if (!redirectUris.every((uri): uri is string => typeof uri === "string" && isAllowedRedirectUri(uri))) {
    return oauthError("invalid_redirect_uri", "Every redirect URI must be https, a loopback http address, or a private scheme.");
  }

  const authMethod = body.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") {
    // No client secrets are issued, so any other method would be a lie.
    return oauthError("invalid_client_metadata", "Only public clients are supported (token_endpoint_auth_method must be \"none\").");
  }

  const requestedGrantTypes = Array.isArray(body.grant_types) ? body.grant_types : SUPPORTED_GRANT_TYPES;
  if (!requestedGrantTypes.every((grant) => typeof grant === "string" && SUPPORTED_GRANT_TYPES.includes(grant))) {
    return oauthError("invalid_client_metadata", `grant_types must be a subset of ${SUPPORTED_GRANT_TYPES.join(", ")}.`);
  }

  const responseTypes = Array.isArray(body.response_types) ? body.response_types : ["code"];
  if (!responseTypes.every((type) => type === "code")) {
    return oauthError("invalid_client_metadata", "Only the \"code\" response type is supported.");
  }

  const scope = normalizeScope(typeof body.scope === "string" ? body.scope : null);
  if (!scope) return oauthError("invalid_client_metadata", "None of the requested scopes are supported.");

  const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 120) : null;

  const client = await registerClient({
    clientName,
    redirectUris: redirectUris as string[],
    grantTypes: requestedGrantTypes as string[],
    scope,
  });

  return Response.json(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName ?? undefined,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: client.scope,
    },
    { status: 201, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}
