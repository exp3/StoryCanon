import { canonicalResource, verifyCodeChallenge } from "@/server/oauth";
import { oauthError } from "@/server/oauth-http";
import { consumeAuthorizationCode, findClient, issueTokens, rotateRefreshToken } from "@/server/oauth-store";

/** The OAuth 2.1 token endpoint: authorization_code and refresh_token grants. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenResponse(body: Record<string, unknown>) {
  return Response.json(body, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}

export async function POST(req: Request) {
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await req.text());
  } catch {
    return oauthError("invalid_request", "Request body must be form-encoded.");
  }

  const grantType = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  const client = await findClient(clientId);
  if (!client) return oauthError("invalid_client", "Unknown client_id.", 401);

  if (grantType === "authorization_code") {
    const code = form.get("code");
    const redirectUri = form.get("redirect_uri");
    const codeVerifier = form.get("code_verifier");
    if (!code || !redirectUri || !codeVerifier) {
      return oauthError("invalid_request", "code, redirect_uri and code_verifier are required.");
    }

    const claimed = await consumeAuthorizationCode(code);
    // Covers unknown, expired and already-redeemed codes alike; the store
    // revokes the grant's tokens when it detects a replay.
    if (!claimed) return oauthError("invalid_grant", "The authorization code is invalid, expired, or already used.");

    if (claimed.grant.clientId !== clientId) {
      return oauthError("invalid_grant", "The authorization code was issued to a different client.");
    }
    if (claimed.redirectUri !== redirectUri) {
      return oauthError("invalid_grant", "redirect_uri does not match the authorization request.");
    }
    if (!verifyCodeChallenge(codeVerifier, claimed.codeChallenge)) {
      return oauthError("invalid_grant", "PKCE verification failed.");
    }

    // The audience comes from the authorization request, never from this one:
    // letting the token endpoint pick it would mean a client could mint a
    // token for a resource the user never saw on the consent screen.
    const requestedResource = canonicalResource(form.get("resource"));
    if (requestedResource && requestedResource !== claimed.resource) {
      return oauthError("invalid_target", "resource does not match the authorization request.");
    }

    const issued = await issueTokens({
      grantId: claimed.grantId,
      scope: claimed.scope,
      resource: claimed.resource,
    });
    return tokenResponse({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
      refresh_token: issued.refreshToken,
      scope: claimed.scope,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (!refreshToken) return oauthError("invalid_request", "refresh_token is required.");

    const issued = await rotateRefreshToken(refreshToken, clientId);
    if (!issued) return oauthError("invalid_grant", "The refresh token is invalid, expired, or already used.");

    return tokenResponse({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
      refresh_token: issued.refreshToken,
      scope: issued.scope,
    });
  }

  return oauthError("unsupported_grant_type", "Supported grant types are authorization_code and refresh_token.");
}
