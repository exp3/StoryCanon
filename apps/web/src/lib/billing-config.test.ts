import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPaymentMode, isBillingLive } from "./billing-config";

const ENV_KEYS = ["PAYMENT_MODE", "STRIPE_SECRET_KEY"] as const;

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

describe("getPaymentMode", () => {
  it("defaults to mock when PAYMENT_MODE is unset", () => {
    expect(getPaymentMode()).toBe("mock");
  });

  it.each(["live", "LIVE", "Live", "  live  "])("treats %j as live", (value) => {
    process.env.PAYMENT_MODE = value;
    expect(getPaymentMode()).toBe("live");
  });

  // A typo must fail closed rather than silently enabling charges.
  it.each(["mock", "", "livex", "l1ve", "true", "1", "production"])(
    "treats %j as mock",
    (value) => {
      process.env.PAYMENT_MODE = value;
      expect(getPaymentMode()).toBe("mock");
    },
  );
});

describe("isBillingLive", () => {
  it("is false when nothing is configured", () => {
    expect(isBillingLive()).toBe(false);
  });

  it("is false in live mode without a Stripe key", () => {
    process.env.PAYMENT_MODE = "live";
    expect(isBillingLive()).toBe(false);
  });

  it("is false in live mode with an empty Stripe key", () => {
    process.env.PAYMENT_MODE = "live";
    process.env.STRIPE_SECRET_KEY = "";
    expect(isBillingLive()).toBe(false);
  });

  // The dangerous direction: a key alone must not enable billing, because that
  // is exactly the state prod was in before the kill switch existed.
  it("is false with a Stripe key but no live mode", () => {
    process.env.STRIPE_SECRET_KEY = "rk_live_example";
    expect(isBillingLive()).toBe(false);
  });

  it("is false with a Stripe key while explicitly in mock mode", () => {
    process.env.PAYMENT_MODE = "mock";
    process.env.STRIPE_SECRET_KEY = "rk_live_example";
    expect(isBillingLive()).toBe(false);
  });

  it("is true only when live mode and a Stripe key are both present", () => {
    process.env.PAYMENT_MODE = "live";
    process.env.STRIPE_SECRET_KEY = "rk_live_example";
    expect(isBillingLive()).toBe(true);
  });
});
