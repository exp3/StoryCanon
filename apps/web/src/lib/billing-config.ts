/**
 * Billing kill switch.
 *
 * `PAYMENT_MODE` must be exactly "live" before the app will create a Stripe
 * Checkout or Billing Portal session. Anything else — unset, "mock", a typo —
 * keeps billing off, so a deploy that forgets the variable cannot charge
 * anyone. Same safe-by-default shape as the `ADMIN_EMAILS` gate in
 * server/admin.ts.
 *
 * The environment is read on every call rather than at module load so tests can
 * vary it and so flipping the switch only needs a task restart, not a rebuild.
 */
export type PaymentMode = "mock" | "live";

export function getPaymentMode(): PaymentMode {
  return process.env.PAYMENT_MODE?.trim().toLowerCase() === "live" ? "live" : "mock";
}

/**
 * True only when live mode is on AND there is a Stripe key to call with.
 * Both conditions matter: live mode without a key would fail deep inside the
 * Stripe SDK instead of redirecting cleanly.
 */
export function isBillingLive(): boolean {
  return getPaymentMode() === "live" && Boolean(process.env.STRIPE_SECRET_KEY);
}
