import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
