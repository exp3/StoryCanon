import Stripe from "stripe";

/** workerd identifies itself here; there is no `process` to sniff. */
const isWorkers =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

let client: Stripe | null = null;

/**
 * The HTTP client and crypto provider are named explicitly on Workers rather
 * than left to stripe's own platform detection.
 *
 * That detection relies on the `workerd` condition in stripe's package exports,
 * and OpenNext's bundler does not apply it — the Node build is what ends up in
 * the Worker, so the SDK reaches for `node:http` and every call fails with
 * "An error occurred with our connection to Stripe". Checkout and the billing
 * portal both 500 on it.
 *
 * The crypto provider is pinned for the same reason: once the platform picked
 * the wrong build for transport, it cannot be trusted to pick the right one for
 * webhook signature verification either. SubtleCrypto is what workerd has.
 */
export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key, isWorkers ? { httpClient: Stripe.createFetchHttpClient() } : {});
  }
  return client;
}

/** `undefined` on Node, which leaves stripe to use node:crypto as before. */
export function stripeCryptoProvider() {
  return isWorkers ? Stripe.createSubtleCryptoProvider() : undefined;
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
