import { prisma } from "@/lib/prisma";
import {
  ACCESS_TOKEN_TTL_MS,
  AUTHORIZATION_CODE_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  canonicalResource,
  generateToken,
  hashToken,
  tokenPrefix,
} from "./oauth";

/** Persistence for the OAuth 2.1 flow. Everything token-shaped is stored hashed. */

export async function findClient(clientId: string) {
  if (!clientId) return null;
  return prisma.oAuthClient.findUnique({ where: { clientId } });
}

export async function registerClient(input: {
  clientName?: string | null;
  redirectUris: string[];
  grantTypes: string[];
  scope: string;
}) {
  return prisma.oAuthClient.create({
    data: {
      clientId: `mcp_${generateToken()}`,
      clientName: input.clientName ?? null,
      redirectUris: input.redirectUris,
      grantTypes: input.grantTypes,
      scope: input.scope,
    },
  });
}

/**
 * Records (or refreshes) a user's consent for a client and returns the grant.
 *
 * Re-authorizing with a different scope revokes what was already issued:
 * tokens carry the scope they were minted with, so narrowing consent on this
 * screen would otherwise leave a broader refresh token alive for up to 30 days
 * while the UI claims access was reduced.
 */
export async function upsertGrant(input: { clientId: string; userId: string; scope: string; resource: string | null }) {
  const existing = await prisma.oAuthGrant.findUnique({
    where: { clientId_userId: { clientId: input.clientId, userId: input.userId } },
    select: { id: true, scope: true },
  });
  if (existing && existing.scope !== input.scope) await revokeGrantTokens(existing.id);

  return prisma.oAuthGrant.upsert({
    where: { clientId_userId: { clientId: input.clientId, userId: input.userId } },
    update: { scope: input.scope, resource: input.resource },
    create: { clientId: input.clientId, userId: input.userId, scope: input.scope, resource: input.resource },
  });
}

export async function issueAuthorizationCode(input: {
  grantId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string | null;
}) {
  const code = generateToken();
  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: hashToken(code),
      grantId: input.grantId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      resource: input.resource,
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Claims an authorization code, atomically. `updateMany` on the unconsumed row
 * means two concurrent redemptions cannot both win: the loser updates zero
 * rows and is rejected.
 */
export async function consumeAuthorizationCode(code: string) {
  const codeHash = hashToken(code);
  const claimed = await prisma.oAuthAuthorizationCode.updateMany({
    where: { codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) {
    // Either unknown, expired, or already used. A replay is the dangerous
    // case: drop every token on the grant so a stolen code cannot be traded
    // for continued access.
    const replayed = await prisma.oAuthAuthorizationCode.findUnique({ where: { codeHash }, select: { grantId: true, consumedAt: true } });
    if (replayed?.consumedAt) await revokeGrantTokens(replayed.grantId);
    return null;
  }
  return prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
    include: { grant: true },
  });
}

export async function issueTokens(input: { grantId: string; scope: string; resource: string | null }) {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const now = Date.now();

  await prisma.oAuthToken.createMany({
    data: [
      {
        grantId: input.grantId,
        kind: "ACCESS",
        tokenPrefix: tokenPrefix(accessToken),
        tokenHash: hashToken(accessToken),
        scope: input.scope,
        resource: input.resource,
        expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
      },
      {
        grantId: input.grantId,
        kind: "REFRESH",
        tokenPrefix: tokenPrefix(refreshToken),
        tokenHash: hashToken(refreshToken),
        scope: input.scope,
        resource: input.resource,
        expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
      },
    ],
  });

  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) };
}

export async function revokeGrantTokens(grantId: string) {
  await prisma.oAuthToken.updateMany({ where: { grantId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Exchanges a refresh token for a new pair, rotating the old one.
 *
 * Presenting an already-rotated refresh token means it leaked — the whole
 * grant is revoked rather than quietly issuing another pair.
 */
export async function rotateRefreshToken(refreshToken: string, clientId: string) {
  const existing = await prisma.oAuthToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { grant: true },
  });
  if (!existing || existing.kind !== "REFRESH") return null;
  if (existing.grant.clientId !== clientId) return null;

  if (existing.replacedById) {
    await revokeGrantTokens(existing.grantId);
    return null;
  }
  if (existing.revokedAt || existing.expiresAt <= new Date()) return null;

  // Claim the token before issuing anything, the same way an authorization
  // code is claimed. Checking first and revoking afterwards would let two
  // concurrent redemptions of one refresh token both succeed, which is exactly
  // the case reuse detection exists to catch.
  const claimed = await prisma.oAuthToken.updateMany({
    where: { id: existing.id, revokedAt: null, replacedById: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1) {
    await revokeGrantTokens(existing.grantId);
    return null;
  }

  const issued = await issueTokens({
    grantId: existing.grantId,
    scope: existing.scope,
    resource: existing.resource,
  });
  const replacement = await prisma.oAuthToken.findUnique({
    where: { tokenHash: hashToken(issued.refreshToken) },
    select: { id: true },
  });
  // Recording the successor is what makes a later replay recognisable as a
  // replay rather than just an expired token.
  await prisma.oAuthToken.update({ where: { id: existing.id }, data: { replacedById: replacement?.id ?? null } });
  return { ...issued, scope: existing.scope };
}

export type VerifiedAccessToken = {
  userId: string;
  clientId: string;
  scope: string;
  resource: string | null;
};

/** Validates a bearer value as an OAuth access token. Returns null when it is not one. */
export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken | null> {
  const record = await prisma.oAuthToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { grant: true },
  });
  if (!record || record.kind !== "ACCESS") return null;
  if (record.revokedAt || record.expiresAt <= new Date()) return null;

  await prisma.oAuthToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return {
    userId: record.grant.userId,
    clientId: record.grant.clientId,
    scope: record.scope,
    resource: record.resource ? canonicalResource(record.resource) : null,
  };
}

export async function revokeToken(token: string, clientId: string) {
  const record = await prisma.oAuthToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { grant: { select: { clientId: true } } },
  });
  // RFC 7009: revoking an unknown token is a success, but a token belonging to
  // another client must not be touched.
  if (!record || record.grant.clientId !== clientId) return;
  await prisma.oAuthToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
}

/** The connections shown on the settings page. */
export async function listGrants(userId: string) {
  return prisma.oAuthGrant.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { clientName: true, clientId: true } },
      _count: { select: { tokens: true } },
    },
  });
}

export async function revokeGrant(userId: string, grantId: string) {
  // Scoped by userId so one user cannot revoke another's connection.
  await prisma.oAuthGrant.deleteMany({ where: { id: grantId, userId } });
}
