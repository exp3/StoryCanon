import { prisma } from "@/lib/prisma";

export type McpConnection = {
  connected: boolean;
  via: "oauth" | "token" | null;
  /** The connector's client name, or the token's name. Null when not connected. */
  label: string | null;
};

/**
 * Whether an MCP client has actually reached this user's account.
 *
 * Note what is *not* counted: an API token that exists but has never been used.
 * Issuing a token and never getting the client to send it is the single most
 * likely place to stall, so treating "token issued" as connected would hide
 * exactly the failure the connection screen needs to catch.
 */
export async function getMcpConnection(userId: string): Promise<McpConnection> {
  const [grant, token] = await Promise.all([
    prisma.oAuthGrant.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { client: { select: { clientName: true, clientId: true } } },
    }),
    prisma.apiToken.findFirst({
      where: { userId, deletedAt: null, revokedAt: null, lastUsedAt: { not: null } },
      orderBy: { lastUsedAt: "desc" },
      select: { name: true },
    }),
  ]);

  if (grant) return { connected: true, via: "oauth", label: grant.client.clientName ?? grant.client.clientId };
  if (token) return { connected: true, via: "token", label: token.name };
  return { connected: false, via: null, label: null };
}
