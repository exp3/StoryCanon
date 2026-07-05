"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";
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

  const raw = randomBytes(24).toString("base64url");
  const tokenPrefix = raw.slice(0, 12);
  const tokenHash = await bcrypt.hash(`${raw}:${process.env.APP_API_TOKEN_PEPPER ?? ""}`, 10);

  await prisma.apiToken.create({
    data: { userId: user.id, name, tokenPrefix, tokenHash },
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

export async function updateLocale(formData: FormData) {
  const user = await requireSessionUser("/settings");
  const requested = String(formData.get("locale") ?? "");
  const locale = isLocale(requested) ? requested : user.locale;
  await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/settings");
}
