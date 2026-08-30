import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, planFromPriceId, stripeCryptoProvider } from "@/lib/stripe";

const STATUS_MAP: Record<Stripe.Subscription.Status, "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE"> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  unpaid: "PAST_DUE",
  paused: "CANCELED",
};

async function syncSubscription(subscription: Stripe.Subscription, userIdHint?: string) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId) ?? (subscription.metadata.plan as "PLUS" | "PRO" | undefined) ?? "FREE";
  const status = STATUS_MAP[subscription.status] ?? "INCOMPLETE";
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000)
    : null;

  const existing = await prisma.subscription.findFirst({
    where: { OR: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }] },
    orderBy: { updatedAt: "desc" },
  });

  const userId = existing?.userId ?? userIdHint ?? subscription.metadata.userId;
  if (!userId) return;

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { plan, status, stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, currentPeriodEnd },
    });
  } else {
    await prisma.subscription.create({
      data: { userId, plan, status, stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, currentPeriodEnd },
    });
  }
}

/**
 * Deliberately NOT gated on PAYMENT_MODE (see lib/billing-config.ts). The kill
 * switch stops the app from *starting* charges; this route only reacts to
 * events Stripe already accepted, and signature verification below is its real
 * control. Blocking it while customers hold live subscriptions would let their
 * cancellations and payment failures go unrecorded, stranding paid access.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    // The async form because the synchronous `constructEvent` has no SubtleCrypto
    // path at all. The provider is named rather than left to stripe's platform
    // detection: that detection reads the `workerd` condition in stripe's
    // package exports, which OpenNext's bundler does not apply, so the Node
    // build is what runs on the Worker. `stripeCryptoProvider()` returns
    // undefined on Node, leaving the previous behaviour untouched there.
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      stripeCryptoProvider(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_signature";
    return NextResponse.json({ error: "invalid_signature", message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription, session.metadata?.userId ?? undefined);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
