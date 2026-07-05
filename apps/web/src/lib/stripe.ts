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

export const PLAN_PRICE_IDS = {
  PLUS: process.env.STRIPE_PRICE_PLUS ?? "",
  PRO: process.env.STRIPE_PRICE_PRO ?? "",
} as const;

export type PaidPlan = keyof typeof PLAN_PRICE_IDS;
