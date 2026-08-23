import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { CurrentActor } from "./http";
import { hashToken, safeEqual, tokenPrefix } from "./oauth";

/**
 * bcryptjs writes the `$2a$` variant, and a hex SHA-256 digest can only contain
 * `[0-9a-f]`, so the stored hash tells us unambiguously which era it came from.
 */
export function isLegacyBcryptHash(hash: string) {
  return hash.startsWith("$2");
}

/**
 * Personal API tokens now hash the same way OAuth tokens do — see the rationale
 * on `hashToken`. bcrypt's work factor was buying nothing here (these are
 * full-entropy random strings) while every authenticated request paid for it.
 *
 * Tokens issued before the switch are still honoured: they verify against
 * bcrypt and are rewritten to SHA-256 the first time they are used, so nobody's
 * live integration breaks and the bcrypt path drains itself. Once the ApiToken
 * table holds no `$2`-prefixed hashes, this import can go.
 */
export async function authenticateBearer(header: string | null): Promise<CurrentActor | null> {
  const value = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!value) return null;

  const candidates = await prisma.apiToken.findMany({
    where: { tokenPrefix: tokenPrefix(value), revokedAt: null, deletedAt: null },
    select: { id: true, userId: true, tokenHash: true },
  });

  const hash = hashToken(value);

  for (const candidate of candidates) {
    const legacy = isLegacyBcryptHash(candidate.tokenHash);
    const ok = legacy
      ? await bcrypt.compare(`${value}:${process.env.APP_API_TOKEN_PEPPER ?? ""}`, candidate.tokenHash)
      : safeEqual(hash, candidate.tokenHash);
    if (!ok) continue;

    await prisma.apiToken.update({
      where: { id: candidate.id },
      // The rehash rides along on the lastUsedAt write that was happening
      // anyway, so migrating a token off bcrypt costs no extra round trip.
      data: legacy ? { lastUsedAt: new Date(), tokenHash: hash } : { lastUsedAt: new Date() },
    });
    return { userId: candidate.userId, via: "api-token", apiTokenId: candidate.id };
  }

  return null;
}
