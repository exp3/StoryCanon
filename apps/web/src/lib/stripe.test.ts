import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { getPlanPriceId, planFromPriceId } from "./stripe";

const ENV_KEYS = [
  "STRIPE_PRICE_PLUS_MONTHLY",
  "STRIPE_PRICE_PLUS_YEARLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function configureAllPrices() {
  process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_plus_monthly";
  process.env.STRIPE_PRICE_PLUS_YEARLY = "price_plus_yearly";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_yearly";
}

describe("getPlanPriceId", () => {
  it("returns the configured price id per plan and interval", () => {
    configureAllPrices();
    expect(getPlanPriceId("PLUS", "monthly")).toBe("price_plus_monthly");
    expect(getPlanPriceId("PLUS", "yearly")).toBe("price_plus_yearly");
    expect(getPlanPriceId("PRO", "monthly")).toBe("price_pro_monthly");
    expect(getPlanPriceId("PRO", "yearly")).toBe("price_pro_yearly");
  });

  it("returns an empty string when unset", () => {
    expect(getPlanPriceId("PLUS", "monthly")).toBe("");
  });

  // Env is read per call, so a price id set after import must be visible.
  it("reflects environment changes made after import", () => {
    expect(getPlanPriceId("PRO", "yearly")).toBe("");
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_added_later";
    expect(getPlanPriceId("PRO", "yearly")).toBe("price_added_later");
  });
});

describe("planFromPriceId", () => {
  // The regression this guards: a yearly purchase resolving to no plan would
  // fall through to "FREE" in the webhook and strand a paying customer.
  it("maps both intervals of a plan to that plan", () => {
    configureAllPrices();
    expect(planFromPriceId("price_plus_monthly")).toBe("PLUS");
    expect(planFromPriceId("price_plus_yearly")).toBe("PLUS");
    expect(planFromPriceId("price_pro_monthly")).toBe("PRO");
    expect(planFromPriceId("price_pro_yearly")).toBe("PRO");
  });

  it("returns null for an unknown price id", () => {
    configureAllPrices();
    expect(planFromPriceId("price_someone_elses")).toBeNull();
  });

  it("returns null for undefined or empty input", () => {
    configureAllPrices();
    expect(planFromPriceId(undefined)).toBeNull();
    expect(planFromPriceId("")).toBeNull();
  });

  // Without the early return, an unconfigured "" price would match empty input
  // and grant a paid plan for free.
  it("does not grant a plan when nothing is configured", () => {
    expect(planFromPriceId("")).toBeNull();
    expect(planFromPriceId(undefined)).toBeNull();
    expect(planFromPriceId("price_anything")).toBeNull();
  });
});

/**
 * The webhook route verifies signatures with `constructEventAsync` and no
 * explicit CryptoProvider, so that the Node build and the `workerd` build each
 * supply their own. That indirection is invisible at the call site, which is
 * exactly why it is worth pinning down: if SubtleCrypto ever disagreed with
 * node:crypto about what a valid Stripe signature looks like, live billing
 * events would start bouncing with a 400 only after the Cloudflare cutover.
 */
describe("webhook signature verification", () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

  const providers = [
    ["node:crypto", Stripe.createNodeCryptoProvider()],
    ["SubtleCrypto (the Workers path)", Stripe.createSubtleCryptoProvider()],
  ] as const;

  for (const [name, cryptoProvider] of providers) {
    it(`accepts a genuine signature under ${name}`, async () => {
      const stripe = new Stripe("sk_test_unused");
      const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });

      const event = await stripe.webhooks.constructEventAsync(payload, header, secret, undefined, cryptoProvider);

      expect(event.type).toBe("customer.subscription.updated");
    });

    it(`rejects a forged signature under ${name}`, async () => {
      const stripe = new Stripe("sk_test_unused");
      const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: "whsec_wrong_secret" });

      await expect(
        stripe.webhooks.constructEventAsync(payload, header, secret, undefined, cryptoProvider),
      ).rejects.toThrow();
    });
  }

  // The two cases above pass a provider explicitly; the route deliberately does
  // not, and leans on `createDefaultCryptoProvider()` to pick one per platform.
  // That indirection is the actual change here, so it needs its own case.
  it("verifies through the platform default, which is what the route relies on", async () => {
    const stripe = new Stripe("sk_test_unused");
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });

    const event = await stripe.webhooks.constructEventAsync(payload, header, secret);

    expect(event.type).toBe("customer.subscription.updated");
    await expect(stripe.webhooks.constructEventAsync(payload, "t=1,v1=deadbeef", secret)).rejects.toThrow();
  });
});
