import { legalInfo } from "@/lib/legal-info";
import { PLAN_LIMITS } from "@/lib/plan-limits";

export const dynamic = "force-static";

/**
 * Served at /llms.txt.
 *
 * StoryCanon's most likely discovery path is an AI agent being asked to find
 * somewhere to keep a story — so the one thing this file must do is state the
 * MCP endpoint and how to authenticate against it, rather than reproduce the
 * marketing copy.
 */
export async function GET() {
  const url = legalInfo.serviceUrl;

  const body = `# StoryCanon

> A structured story bible for long-form fiction, built to be read and written by an AI over the Model Context Protocol. StoryCanon does not generate prose itself; it is the place the prose and the decisions around it are kept, so they survive the end of a conversation.

## MCP

- Endpoint: ${url}/mcp
- Transport: Streamable HTTP (stateless POST). There is no SSE stream and no stdio package.
- Auth: OAuth 2.1 with PKCE (S256) and dynamic client registration, so a client can connect from the URL alone. Clients that cannot do OAuth send a user-issued API token as \`Authorization: Bearer <token>\`.
- Authorization server metadata: ${url}/.well-known/oauth-authorization-server
- Protected resource metadata: ${url}/.well-known/oauth-protected-resource
- Scopes: \`storycanon:read\`, \`storycanon:write\`
- Start with the \`help\` tool: it explains the first-time steps and the normal write loop.

## What it stores

Works, each holding chapters, scenes, characters, character notes, world notes, plot threads, foreshadowing, mysteries, revision TODOs, a timeline, story-state snapshots and reading position. The structure is fixed — there are no templates to choose between.

## Other integrations

- OpenAPI schema for ChatGPT Custom GPT Actions: ${url}/mcp-openapi.json

## Accounts and limits

- Sign-in is Google OAuth. Every work is private to its account.
- Free plan: ${PLAN_LIMITS.FREE.projects} works, ${PLAN_LIMITS.FREE.charactersPerProject} characters and ${PLAN_LIMITS.FREE.bodyCharsPerProject.toLocaleString("en-US")} characters of body text per work. No card required.
- Export as Markdown or plain text on every plan; JSON export requires a paid plan.

## Pages

- Landing page (English): ${url}/en
- Landing page (Japanese): ${url}/ja
- Terms of service: ${url}/legal/terms
- Privacy policy: ${url}/legal/privacy
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
