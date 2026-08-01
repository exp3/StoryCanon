"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/server/admin";
import { grantPlanSchema } from "@/server/validation";

export async function grantPlan(formData: FormData) {
  const admin = await requireAdminUser();

  const input = grantPlanSchema.parse({
    email: String(formData.get("email") ?? "").trim(),
    plan: String(formData.get("plan") ?? ""),
    status: String(formData.get("status") ?? "") || undefined,
  });

  const target = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (!target) {
    redirect(`/admin?error=user-not-found&email=${encodeURIComponent(input.email)}`);
  }

  await prisma.subscription.upsert({
    where: { userId: target.id },
    create: { userId: target.id, plan: input.plan, status: input.status },
    update: { plan: input.plan, status: input.status },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "grant-plan",
      targetType: "SUBSCRIPTION",
      targetId: target.id,
      metadata: { email: input.email, plan: input.plan, status: input.status },
    },
  });

  redirect(`/admin?granted=${encodeURIComponent(input.email)}`);
}

export async function revokePlan(formData: FormData) {
  const admin = await requireAdminUser();

  const userId = String(formData.get("userId") ?? "");
  const target = await prisma.subscription.findUnique({ where: { userId }, select: { userId: true } });
  if (!target) {
    redirect("/admin");
  }

  await prisma.subscription.update({
    where: { userId: target.userId },
    data: { plan: "FREE", status: "CANCELED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "revoke-plan",
      targetType: "SUBSCRIPTION",
      targetId: target.userId,
      metadata: { plan: "FREE", status: "CANCELED" },
    },
  });

  revalidatePath("/admin");
}
