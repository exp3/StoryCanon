"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isBillingLive } from "@/lib/billing-config";
import { getPlanPriceId, getStripe, isBillingInterval, type PaidPlan } from "@/lib/stripe";
import { requireSessionUser } from "@/server/session";

async function getOrigin() {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

async function findOrCreateStripeCustomerId(userId: string, email: string | null | undefined) {
  const existing = await prisma.subscription.findFirst({
    where: { userId, stripeCustomerId: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { userId },
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(formData: FormData) {
  const user = await requireSessionUser("/settings");
  const plan = String(formData.get("plan") ?? "");
  if (plan !== "PLUS" && plan !== "PRO") {
    throw new Error("Invalid plan.");
  }

  const interval = String(formData.get("interval") ?? "monthly");
  if (!isBillingInterval(interval)) {
    throw new Error("Invalid billing interval.");
  }

  // The real control point for live billing — the settings UI also hides the
  // purchase forms, but that is cosmetic and this action is directly callable.
  if (!isBillingLive()) {
    redirect("/settings?billing=not-configured");
  }

  const priceId = getPlanPriceId(plan as PaidPlan, interval);
  if (!priceId) {
    redirect("/settings?billing=not-configured");
  }

  const customerId = await findOrCreateStripeCustomerId(user.id, user.email);
  const origin = await getOrigin();
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/settings?billing=cancelled`,
    metadata: { userId: user.id, plan, interval },
    subscription_data: { metadata: { userId: user.id, plan, interval } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}

export async function createBillingPortalSession() {
  const user = await requireSessionUser("/settings");

  // The portal can cancel and switch subscriptions, so it is gated as tightly
  // as checkout itself.
  if (!isBillingLive()) {
    redirect("/settings?billing=not-configured");
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id, stripeCustomerId: { not: null } },
    orderBy: { updatedAt: "desc" },
  });

  if (!existing?.stripeCustomerId) {
    redirect("/settings?billing=no-customer");
  }

  const origin = await getOrigin();
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripeCustomerId,
    return_url: `${origin}/settings`,
  });

  redirect(session.url);
}
