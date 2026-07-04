import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { CurrentActor } from "./http";

export async function authenticateBearer(header: string | null): Promise<CurrentActor | null> {
  const value = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!value) return null;

  const prefix = value.slice(0, 12);
  const candidates = await prisma.apiToken.findMany({
    where: { tokenPrefix: prefix, revokedAt: null },
    select: { id: true, userId: true, tokenHash: true },
  });

  for (const candidate of candidates) {
    const ok = await bcrypt.compare(`${value}:${process.env.APP_API_TOKEN_PEPPER ?? ""}`, candidate.tokenHash);
    if (ok) {
      await prisma.apiToken.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });
      return { userId: candidate.userId, via: "api-token" };
    }
  }

  return null;
}
