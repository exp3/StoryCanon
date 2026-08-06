import { authenticateBearer } from "./auth-token";
import type { CurrentActor } from "./http";
import { SCOPES, resourceMatches, scopeSatisfies } from "./oauth";
import { verifyAccessToken } from "./oauth-store";

/**
 * Bearer authentication for the MCP endpoint.
 *
 * Two credential types are accepted. OAuth access tokens come from the
 * authorization server in this app and are what a connector-style client
 * obtains on its own; API tokens are the ones the user pastes by hand from the
 * settings page. They are told apart by trying the OAuth lookup first — both
 * are opaque random strings, so there is nothing in the value itself to
 * dispatch on.
 */

export type McpAuth = {
  actor: CurrentActor;
  scope: string;
  clientId: string;
  via: "oauth" | "api-token";
};

export type McpAuthFailure = {
  status: 401 | 403;
  error: "invalid_token" | "insufficient_scope";
  description: string;
};

/** The scopes an unauthenticated caller is told to ask for. */
export const REQUIRED_SCOPE = SCOPES.join(" ");

export async function authenticateMcp(header: string | null, resource: string): Promise<McpAuth | McpAuthFailure> {
  const value = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!value) {
    return { status: 401, error: "invalid_token", description: "An access token is required." };
  }

  const oauth = await verifyAccessToken(value);
  if (oauth) {
    // RFC 8707: a token minted for another resource must not be accepted here,
    // which is what stops a token from being replayed at a different server.
    if (!resourceMatches(oauth.resource, resource)) {
      return { status: 401, error: "invalid_token", description: "The token was issued for a different resource." };
    }
    if (!scopeSatisfies(oauth.scope, REQUIRED_SCOPE)) {
      return { status: 403, error: "insufficient_scope", description: "The token is missing a required scope." };
    }
    return {
      actor: { userId: oauth.userId, via: "api-token" },
      scope: oauth.scope,
      clientId: oauth.clientId,
      via: "oauth",
    };
  }

  const apiToken = await authenticateBearer(header);
  if (apiToken) {
    // A hand-issued API token carries the user's full authority, the same as
    // it does on the existing REST surface.
    return { actor: apiToken, scope: REQUIRED_SCOPE, clientId: apiToken.apiTokenId ?? "storycanon-api-token", via: "api-token" };
  }

  return { status: 401, error: "invalid_token", description: "The access token is invalid or expired." };
}

export function isAuthFailure(result: McpAuth | McpAuthFailure): result is McpAuthFailure {
  return "status" in result;
}
