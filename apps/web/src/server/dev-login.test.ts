import { afterEach, describe, expect, it } from "vitest";
import { isDevLoginEnabled, sessionCookieName } from "./dev-login";

/**
 * /dev-login mints a session for any local email without a password, so the
 * only thing standing between it and a real account is this pair of guards.
 * Both must be required — either one alone is not enough.
 */
describe("dev login guard", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.DEV_LOGIN;

  // NODE_ENV is readonly in the Node types but writable at runtime, which is
  // the only way to exercise the production branch.
  const setEnv = (nodeEnv: string | undefined, flag: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
    process.env.DEV_LOGIN = flag;
  };

  afterEach(() => setEnv(originalNodeEnv, originalFlag));

  it("is off in production even when the flag is set", () => {
    setEnv("production", "1");
    expect(isDevLoginEnabled()).toBe(false);
  });

  it("is off outside production when the flag is not set", () => {
    setEnv("development", undefined);
    expect(isDevLoginEnabled()).toBe(false);
  });

  it("is off when the flag is any value other than exactly \"1\"", () => {
    for (const value of ["", "0", "true", "yes"]) {
      setEnv("development", value);
      expect(isDevLoginEnabled()).toBe(false);
    }
  });

  it("is on only outside production with the flag set to \"1\"", () => {
    setEnv("development", "1");
    expect(isDevLoginEnabled()).toBe(true);
  });
});

describe("session cookie name", () => {
  // Must match what Auth.js itself sets, or dev login writes a cookie the
  // adapter never reads.
  it("uses the __Secure- prefix only over https", () => {
    expect(sessionCookieName(true)).toBe("__Secure-authjs.session-token");
    expect(sessionCookieName(false)).toBe("authjs.session-token");
  });
});
