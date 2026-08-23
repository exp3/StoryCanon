"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";
import { generateToken, hashToken, tokenPrefix } from "@/server/oauth";
import { revokeGrant } from "@/server/oauth-store";
import { requireSessionUser } from "@/server/session";

export type CreateApiTokenState = {
  error: string | null;
  token: string | null;
};

export async function createApiToken(_prevState: CreateApiTokenState, formData: FormData): Promise<CreateApiTokenState> {
  const user = await requireSessionUser("/settings");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: user.locale === "ja" ? "トークン名を入力してください。" : "Please enter a token name.", token: null };
  }

  // Same generation and hashing as the OAuth tokens: full-entropy random
  // strings peppered and hashed with SHA-256. Only the raw value returned below
  // is ever shown to the user; the row keeps the digest.
  const raw = generateToken();

  await prisma.apiToken.create({
    data: { userId: user.id, name, tokenPrefix: tokenPrefix(raw), tokenHash: hashToken(raw) },
  });

  revalidatePath("/settings");
  return { error: null, token: raw };
}

export async function revokeApiToken(formData: FormData) {
  const user = await requireSessionUser("/settings");
  const id = String(formData.get("id") ?? "");
  await prisma.apiToken.updateMany({
    where: { id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings");
}

export async function disconnectOAuthGrant(formData: FormData) {
  const user = await requireSessionUser("/settings");
  await revokeGrant(user.id, String(formData.get("grantId") ?? ""));
  revalidatePath("/settings");
}

export async function updateLocale(formData: FormData) {
  const user = await requireSessionUser("/settings");
  const requested = String(formData.get("locale") ?? "");
  const locale = isLocale(requested) ? requested : user.locale;
  await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/settings");
}
