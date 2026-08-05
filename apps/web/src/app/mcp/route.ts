import { createMcpHandler, originValidationResponse } from "@modelcontextprotocol/server";
import type { CurrentActor } from "@/server/http";
import { REQUIRED_SCOPE, authenticateMcp, isAuthFailure, type McpAuthFailure } from "@/server/mcp-auth";
import { createStoryCanonMcpServer } from "@/server/mcp-server";
import { mcpResourceUrl, serverOrigin } from "@/server/oauth-http";

/**
 * The StoryCanon MCP endpoint.
 *
 * Deliberately stateless: the 2026-07-28 revision dropped protocol sessions
 * and the standalone GET/SSE stream, so every exchange is a self-contained
 * POST answered with JSON. That matters here — the app runs as a single
 * Fargate task behind an ALB whose idle timeout is the AWS default of 60
 * seconds, which a long-lived SSE stream would trip. `createMcpHandler` also
 * serves 2025-era clients through its stateless fallback, from the same tool
 * definitions, so the two protocol eras cannot drift apart.
 *
 * The existing ChatGPT Actions surface (`/api/mcp/*`, described by
 * `/mcp-openapi.json`) is untouched and keeps working alongside this.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The handler is built once: it carries no per-user state, and the actor
// travels per request via `authInfo`.
const handler = createMcpHandler((ctx) => {
  const actor = ctx.authInfo?.extra?.actor as CurrentActor | undefined;
  if (!actor) {
    // Unreachable via POST below, which authenticates first. Failing loudly
    // beats silently constructing a server with no owner.
    throw new Error("MCP server factory reached without an authenticated actor.");
  }
  return createStoryCanonMcpServer(actor);
});

/** Own origin plus the localhost forms used in development. */
function allowedOriginHostnames(req: Request) {
  const { hostname } = new URL(req.url);
  return [hostname, "localhost", "127.0.0.1", "[::1]"];
}

/**
 * The RFC 9728 challenge that points a client at the authorization server.
 * This is the entire discovery entry point: a client with no token reads
 * `resource_metadata` from here and follows it to the OAuth endpoints.
 */
function challenge(req: Request, failure: McpAuthFailure) {
  const origin = serverOrigin(req);
  const resourceMetadata = `${origin}/.well-known/oauth-protected-resource${new URL(req.url).pathname}`;
  const params = [
    `error="${failure.error}"`,
    `error_description="${failure.description}"`,
    `resource_metadata="${resourceMetadata}"`,
    `scope="${REQUIRED_SCOPE}"`,
  ].join(", ");

  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: failure.description }, id: null },
    { status: failure.status, headers: { "WWW-Authenticate": `Bearer ${params}` } },
  );
}

function methodNotAllowed() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: Request) {
  // Required by the transport spec: reject cross-origin browser traffic so a
  // web page cannot drive this endpoint through DNS rebinding.
  const rejected = originValidationResponse(req, allowedOriginHostnames(req));
  if (rejected) return rejected;

  const auth = await authenticateMcp(req.headers.get("authorization"), mcpResourceUrl(serverOrigin(req)));
  if (isAuthFailure(auth)) return challenge(req, auth);

  return handler.fetch(req, {
    authInfo: {
      // The raw credential is never handed to the SDK or to tool handlers —
      // nothing downstream needs it, and it would otherwise ride along into
      // any context the SDK exposes.
      token: "[redacted]",
      clientId: auth.clientId,
      scopes: auth.scope.split(" "),
      extra: { actor: auth.actor },
    },
  });
}

// 2025-era session operations. The revision this endpoint serves has no
// sessions and no standalone stream, so both are simply not allowed.
export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
