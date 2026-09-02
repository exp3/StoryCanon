import { afterEach, describe, expect, it } from "vitest";

/**
 * The allowlist reads NEXTAUTH_URL through `serverHostname` at call time, so
 * setting the variable before each case is enough — the module is imported the
 * way the issuer tests in oauth.test.ts do it, but nothing here depends on the
 * import being fresh.
 */

const originalUrl = process.env.NEXTAUTH_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = originalUrl;
});

async function allowed(host: string | null, configured?: string) {
  if (configured === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = configured;
  const { allowedMcpOriginHostnames } = await import("./mcp-origin");
  const headers = new Headers();
  if (host) headers.set("host", host);
  return allowedMcpOriginHostnames(new Request("https://ignored.example/mcp", { headers }));
}

describe("MCP origin allowlist", () => {
  it("admits the Claude connector, which is the whole point of the list", async () => {
    const hostnames = await allowed("storycanon.example", "https://storycanon.example");
    expect(hostnames).toContain("claude.ai");
    expect(hostnames).toContain("claude.com");
  });

  it("admits the deployment's own hostname", async () => {
    expect(await allowed("storycanon.example", "https://storycanon.example")).toContain("storycanon.example");
  });

  it("does not admit a hostname claimed only by the Host header", async () => {
    // A DNS-rebinding attacker controls Host and Origin together, so seeding
    // the list from the request's own host would let it name itself.
    expect(await allowed("evil.example", "https://storycanon.example")).not.toContain("evil.example");
  });

  it("admits the localhost forms a dev server lands on", async () => {
    const hostnames = await allowed("localhost:3000", "http://localhost:3000");
    expect(hostnames).toEqual(expect.arrayContaining(["localhost", "127.0.0.1", "[::1]"]));
  });

  it("survives an unconfigured NEXTAUTH_URL", async () => {
    expect(await allowed("storycanon.example")).toContain("storycanon.example");
    expect(await allowed(null)).toContain("ignored.example");
  });
});
