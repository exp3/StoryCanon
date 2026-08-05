import { oauthError } from "@/server/oauth-http";
import { findClient, revokeToken } from "@/server/oauth-store";

/**
 * RFC 7009 token revocation.
 *
 * Always answers 200 for a well-formed request, even when the token is
 * unknown — a client must not be able to probe which tokens exist.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await req.text());
  } catch {
    return oauthError("invalid_request", "Request body must be form-encoded.");
  }

  const token = form.get("token");
  const clientId = form.get("client_id") ?? "";
  if (!token) return oauthError("invalid_request", "token is required.");

  const client = await findClient(clientId);
  if (!client) return oauthError("invalid_client", "Unknown client_id.", 401);

  await revokeToken(token, clientId);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
