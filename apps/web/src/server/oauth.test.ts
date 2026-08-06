import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalResource,
  generateToken,
  hashToken,
  isAllowedRedirectUri,
  isRegisteredRedirectUri,
  normalizeScope,
  resourceMatches,
  scopeSatisfies,
  tokenPrefix,
  verifyCodeChallenge,
} from "./oauth";

/**
 * These are the parts of the authorization server where a subtle mistake is a
 * security hole rather than a bug: PKCE, redirect matching, audience binding
 * and token hashing.
 */

describe("verifyCodeChallenge", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  it("accepts the matching verifier", () => {
    expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
  });

  it("rejects a different verifier", () => {
    expect(verifyCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXX", challenge)).toBe(false);
  });

  it("rejects a plain (unhashed) verifier, which is what an S256-only server must do", () => {
    // If `plain` were accepted, anyone who intercepted the authorization code
    // could redeem it by echoing the challenge back as the verifier.
    expect(verifyCodeChallenge(challenge, challenge)).toBe(false);
  });

  it("rejects verifiers outside the RFC 7636 length and character rules", () => {
    expect(verifyCodeChallenge("too-short", challenge)).toBe(false);
    expect(verifyCodeChallenge(`${verifier}!!`, challenge)).toBe(false);
    expect(verifyCodeChallenge("a".repeat(129), challenge)).toBe(false);
  });
});

describe("redirect URIs", () => {
  it("matches only exactly registered URIs", () => {
    const registered = ["https://client.example/callback"];
    expect(isRegisteredRedirectUri("https://client.example/callback", registered)).toBe(true);
    // Prefix, subpath and query variants must all fail — a loose comparison
    // here is how codes get delivered to an attacker.
    expect(isRegisteredRedirectUri("https://client.example/callback/evil", registered)).toBe(false);
    expect(isRegisteredRedirectUri("https://client.example/callback?x=1", registered)).toBe(false);
    expect(isRegisteredRedirectUri("https://client.example.evil/callback", registered)).toBe(false);
  });

  it("allows https, loopback http and private schemes", () => {
    expect(isAllowedRedirectUri("https://client.example/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:8765/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:8765/cb")).toBe(true);
    expect(isAllowedRedirectUri("myapp://callback")).toBe(true);
  });

  it("rejects plaintext http to a remote host, fragments and script schemes", () => {
    expect(isAllowedRedirectUri("http://client.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://client.example/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("data:text/html,<script>")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
  });
});

describe("scopes", () => {
  it("defaults to every supported scope when none is requested", () => {
    expect(normalizeScope(null)).toBe("storycanon:read storycanon:write");
  });

  it("drops scopes this server does not grant", () => {
    expect(normalizeScope("storycanon:read admin:everything")).toBe("storycanon:read");
    expect(normalizeScope("admin:everything")).toBe("");
  });

  it("de-duplicates", () => {
    expect(normalizeScope("storycanon:read storycanon:read")).toBe("storycanon:read");
  });

  it("checks that a token covers what an operation needs", () => {
    expect(scopeSatisfies("storycanon:read storycanon:write", "storycanon:read")).toBe(true);
    expect(scopeSatisfies("storycanon:read", "storycanon:read storycanon:write")).toBe(false);
  });
});

describe("resource binding", () => {
  it("normalises away trailing slashes and fragments", () => {
    expect(canonicalResource("https://host/mcp/")).toBe("https://host/mcp");
    expect(canonicalResource("https://host/mcp#x")).toBe("https://host/mcp");
    expect(canonicalResource("nonsense")).toBeNull();
  });

  it("treats a different path as a different audience", () => {
    expect(resourceMatches("https://host/mcp", "https://host/mcp")).toBe(true);
    expect(resourceMatches("https://host/mcp", "https://host/other")).toBe(false);
    expect(resourceMatches("https://host/mcp", "https://evil.example/mcp")).toBe(false);
  });

  it("accepts a token that carries no resource, since it was issued for this server", () => {
    expect(resourceMatches(null, "https://host/mcp")).toBe(true);
  });
});

describe("token hashing", () => {
  const originalPepper = process.env.APP_API_TOKEN_PEPPER;

  beforeEach(() => {
    process.env.APP_API_TOKEN_PEPPER = "test-pepper";
  });

  afterEach(() => {
    if (originalPepper === undefined) delete process.env.APP_API_TOKEN_PEPPER;
    else process.env.APP_API_TOKEN_PEPPER = originalPepper;
  });

  it("is stable for the same value and different for another", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("depends on the pepper, so a database dump alone cannot forge a token", () => {
    const withPepper = hashToken("abc");
    process.env.APP_API_TOKEN_PEPPER = "different";
    expect(hashToken("abc")).not.toBe(withPepper);
  });

  it("never stores the raw value", () => {
    expect(hashToken("abc")).not.toContain("abc");
  });

  it("derives a prefix that indexes the lookup without being guessable on its own", () => {
    const token = generateToken();
    expect(tokenPrefix(token)).toBe(token.slice(0, 12));
    expect(token.length).toBeGreaterThan(40);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("issuer derivation", () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalUrl;
  });

  async function origin(host: string | null, configured?: string, proto?: string) {
    if (configured === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = configured;
    const { serverOrigin } = await import("./oauth-http");
    const headers = new Headers();
    if (host) headers.set("host", host);
    if (proto) headers.set("x-forwarded-proto", proto);
    return serverOrigin(new Request("http://ignored.example/oauth/authorize", { headers }));
  }

  it("uses the request host so discovery documents are self-consistent", async () => {
    expect(await origin("storycanon.example", "https://storycanon.example", "https")).toBe("https://storycanon.example");
  });

  it("allows any localhost port, which is what local development lands on", async () => {
    expect(await origin("localhost:55377", "http://localhost:3000")).toBe("http://localhost:55377");
  });

  it("refuses to claim an issuer identity from a spoofed Host header", async () => {
    // The issuer ends up in the `iss` parameter clients use for anti-mix-up
    // checks, so a foreign Host must not be able to shape it.
    expect(await origin("evil.example", "https://storycanon.example", "https")).toBe("https://storycanon.example");
  });

  it("takes only the first value of a comma-joined forwarded proto", async () => {
    expect(await origin("storycanon.example", "https://storycanon.example", "https, http")).toBe("https://storycanon.example");
  });
});

describe("randomness sanity", () => {
  it("uses base64url so tokens are URL- and header-safe", () => {
    expect(randomBytes(32).toString("base64url")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
