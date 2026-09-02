import { serverHostname } from "./oauth-http";

/**
 * The Origin allowlist for the MCP transport.
 *
 * The transport spec asks for this check as a DNS-rebinding defense, and on a
 * public deployment that is all it is: `/mcp` authenticates from the
 * Authorization header alone and never from a cookie, and it returns no CORS
 * headers, so a cross-origin page can neither borrow the user's identity nor
 * read a reply. Rebinding is the one case where the browser's own boundary
 * does not apply — which is why the allowlist is seeded from `serverHostname`
 * rather than from the request's Host header, which a rebinding attacker
 * controls outright. That only bites with NEXTAUTH_URL set, since without it
 * `serverHostname` has nothing to check the Host against; production pins it in
 * wrangler.jsonc for this reason among others.
 */

/**
 * Public domains of MCP clients that send an Origin.
 *
 * Fixed in code rather than configuration: unlike ADMIN_EMAILS, this value does
 * not vary by environment, and `wrangler deploy` replaces the whole `vars` set
 * from wrangler.jsonc, so a var dropped there fails silently in production
 * only. Both Anthropic domains are listed because the connector may send
 * either. ChatGPT is absent because it reaches this app through `/api/mcp/*`
 * and has no path to `/mcp` today; add it here if that changes.
 */
const KNOWN_MCP_CLIENT_ORIGIN_HOSTNAMES = ["claude.ai", "claude.com"];

/** Own host plus the localhost forms used in development, plus known clients. */
export function allowedMcpOriginHostnames(req: Request) {
  return [
    serverHostname(req),
    "localhost",
    "127.0.0.1",
    "[::1]",
    ...KNOWN_MCP_CLIENT_ORIGIN_HOSTNAMES,
  ];
}
