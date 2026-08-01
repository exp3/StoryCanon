import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key);
  }
  return client;
}

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const PAID_PLANS = ["PLUS", "PRO"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

/**
 * Stripe Price ID for a plan and billing interval; "" means not configured.
 *
 * Read from the environment on every call rather than snapshotted into a
 * module-level const, so tests can vary the environment and so a restart is
 * enough to pick up new price IDs.
 */
export function getPlanPriceId(plan: PaidPlan, interval: BillingInterval): string {
  return process.env[`STRIPE_PRICE_${plan}_${interval.toUpperCase()}`] ?? "";
}

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

/**
 * Maps a Stripe Price ID back to the plan it grants. Both the monthly and the
 * yearly price of a plan resolve to the same plan, so webhooks stay correct
 * regardless of which interval the customer bought.
 */
export function planFromPriceId(priceId: string | undefined): PaidPlan | null {
  // Guard first: without it an unset price ID env ("") would match a missing
  // priceId and hand out a paid plan.
  if (!priceId) return null;
  for (const plan of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      if (getPlanPriceId(plan, interval) === priceId) return plan;
    }
  }
  return null;
}
