"use server";

import { getSessionUser } from "@/server/session";
import { getMcpConnection, type McpConnection } from "@/server/mcp-connection";

const disconnected: McpConnection = { connected: false, via: null, label: null };

/**
 * Polled by the connection screen while the user is following the steps, so the
 * page can say "connected" the moment a client actually arrives. Returns a
 * disconnected result rather than throwing when the session has gone, since the
 * caller is a background interval and has nowhere useful to surface an error.
 */
export async function checkMcpConnection(): Promise<McpConnection> {
  const user = await getSessionUser();
  if (!user) return disconnected;
  return getMcpConnection(user.id);
}
