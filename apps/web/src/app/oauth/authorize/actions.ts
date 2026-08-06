"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSessionUser } from "@/server/session";
import { canonicalResource, isRegisteredRedirectUri, normalizeScope } from "@/server/oauth";
import { mcpResourceUrl, serverOrigin } from "@/server/oauth-http";
import { findClient, issueAuthorizationCode, upsertGrant } from "@/server/oauth-store";

/**
 * The consent screen's decision handlers.
 *
 * Everything the form carries is re-validated here rather than trusted: the
 * hidden fields came from the browser, and a tampered `redirect_uri` is how
 * authorization codes get delivered to somebody else.
 */

async function originFromHeaders() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return serverOrigin(new Request(`${proto}://${host}/oauth/authorize`, { headers: headerList }));
}

function callbackUrl(redirectUri: string, params: Record<string, string | null>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function approveAuthorization(formData: FormData) {
  const user = await requireSessionUser();
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = (formData.get("state") as string | null) || null;
  const origin = await originFromHeaders();
  // Always bind an audience. A client that omitted `resource` gets this
  // server's MCP endpoint rather than nothing, so a token can never be one
  // that matches every audience by having none.
  const resource = canonicalResource((formData.get("resource") as string | null) || null) ?? mcpResourceUrl(origin);
  const scope = normalizeScope(String(formData.get("scope") ?? ""));

  const client = await findClient(clientId);
  // A redirect URI that is not registered never receives anything — not even
  // an error — because that is the whole point of registering it.
  if (!client || !isRegisteredRedirectUri(redirectUri, client.redirectUris) || !codeChallenge || !scope) {
    redirect("/oauth/authorize?error=invalid_request");
  }

  const grant = await upsertGrant({ clientId, userId: user.id, scope, resource });
  const code = await issueAuthorizationCode({ grantId: grant.id, redirectUri, codeChallenge, scope, resource });

  redirect(callbackUrl(redirectUri, { code, state, iss: origin }));
}

export async function denyAuthorization(formData: FormData) {
  await requireSessionUser();
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = (formData.get("state") as string | null) || null;

  const client = await findClient(clientId);
  if (!client || !isRegisteredRedirectUri(redirectUri, client.redirectUris)) {
    redirect("/oauth/authorize?error=invalid_request");
  }

  redirect(
    callbackUrl(redirectUri, {
      error: "access_denied",
      error_description: "The user declined the request.",
      state,
      iss: await originFromHeaders(),
    }),
  );
}
