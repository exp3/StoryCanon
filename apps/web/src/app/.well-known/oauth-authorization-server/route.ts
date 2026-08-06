import { authorizationServerMetadata, metadataResponse, serverOrigin } from "@/server/oauth-http";

/** RFC 8414 authorization server metadata, discovered from the resource metadata. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return metadataResponse(authorizationServerMetadata(serverOrigin(req)));
}
