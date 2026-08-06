import { McpServer } from "@modelcontextprotocol/server";
import { handleMcpApi, handleWebApi } from "./handlers";
import { MCP_TOOLS, describeFailure, toToolResult, toolInputSchema, type McpToolSpec } from "./mcp-tools";
import type { CurrentActor } from "./http";

/** Runs one tool on behalf of `actor` and shapes the result for MCP. */
async function runTool(spec: McpToolSpec, actor: CurrentActor, args: Record<string, unknown>) {
  const response = spec.action
    ? await handleMcpApi(spec.action, actor, args)
    : await handleWebApi(spec.route!.method, spec.route!.path(args), actor, args);

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  const result = toToolResult(response.status, contentType, body);
  if (!result) {
    throw new Error(`StoryCanon failed to run "${spec.name}": ${describeFailure(response.status, contentType, body)}`);
  }
  return result;
}

/**
 * Builds a StoryCanon MCP server bound to one authenticated user.
 *
 * The SDK constructs a fresh instance per request (the transport is stateless
 * — see `src/app/mcp/route.ts`), so this must stay cheap: it only registers
 * tool definitions, and every tool closes over the actor rather than reading
 * ambient request state.
 */
export function createStoryCanonMcpServer(actor: CurrentActor) {
  const server = new McpServer({
    name: "storycanon",
    title: "StoryCanon",
    version: "1.0.0",
  });

  for (const spec of MCP_TOOLS) {
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: toolInputSchema(spec),
        annotations: {
          readOnlyHint: spec.readOnly ?? false,
          // Nothing here is a hard delete — everything is soft and undoable —
          // but a destructive hint still belongs on the tools that remove
          // things from the author's view.
          destructiveHint: spec.destructive ?? false,
        },
      },
      async (args) => runTool(spec, actor, (args ?? {}) as Record<string, unknown>),
    );
  }

  return server;
}
