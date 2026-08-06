import { metadataResponse, protectedResourceMetadata, serverOrigin } from "@/server/oauth-http";

/**
 * RFC 9728 protected resource metadata.
 *
 * Served from an optional catch-all because clients probe two locations: the
 * path-suffixed form for the MCP endpoint
 * (`/.well-known/oauth-protected-resource/mcp`) first, then the bare root.
 * Both describe the same single resource, so both answer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return metadataResponse(protectedResourceMetadata(serverOrigin(req)));
}
