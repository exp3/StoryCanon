import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { authenticateBearer, isLegacyBcryptHash } from "./auth-token";
import { generateToken, hashToken } from "./oauth";

const PEPPER = "test-pepper-value";
let savedPepper: string | undefined;

beforeEach(() => {
  savedPepper = process.env.APP_API_TOKEN_PEPPER;
  process.env.APP_API_TOKEN_PEPPER = PEPPER;
  findMany.mockReset();
  update.mockReset();
  update.mockResolvedValue({});
});

afterEach(() => {
  if (savedPepper === undefined) delete process.env.APP_API_TOKEN_PEPPER;
  else process.env.APP_API_TOKEN_PEPPER = savedPepper;
});

/**
 * The whole dual-read scheme hangs on this one predicate. Misjudge a legacy
 * hash as current and every pre-existing API token stops authenticating;
 * misjudge a current one as legacy and bcrypt is handed a digest it will always
 * reject. Neither failure is visible until a real user's integration breaks.
 */
describe("isLegacyBcryptHash", () => {
  it("recognises a hash written by the old bcrypt path", () => {
    const legacy = bcrypt.hashSync(`${generateToken()}:${PEPPER}`, 4);
    expect(isLegacyBcryptHash(legacy)).toBe(true);
  });

  it("does not mistake a current SHA-256 digest for one", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(isLegacyBcryptHash(hashToken(generateToken()))).toBe(false);
    }
  });
});

/**
 * Pins the exact string both eras hash. bcrypt hashed `${raw}:${pepper}` and
 * `hashToken` must digest that same string, or a legacy token gets rewritten to
 * a value no later request can reproduce — permanently killing an integration
 * whose raw token is already pasted into a customer's Claude or ChatGPT config.
 * A refactor of `hashToken` to, say, `${pepper}:${raw}` would break OAuth tokens
 * loudly and this path silently, so the contract needs its own assertion.
 */
describe("legacy/current hash compatibility", () => {
  it("hashes exactly the string bcrypt hashed, pepper included", () => {
    const raw = generateToken();
    const composed = `${raw}:${PEPPER}`;

    expect(bcrypt.compareSync(composed, bcrypt.hashSync(composed, 4))).toBe(true);
    expect(hashToken(raw)).toBe(createHash("sha256").update(composed).digest("hex"));
  });

  it("keeps the pepper load-bearing, so a database dump alone cannot forge a token", () => {
    const raw = generateToken();
    const withPepper = hashToken(raw);
    process.env.APP_API_TOKEN_PEPPER = "a-different-pepper";
    expect(hashToken(raw)).not.toBe(withPepper);
  });
});

describe("authenticateBearer", () => {
  it("matches the right row among candidates sharing a prefix", async () => {
    const raw = generateToken();
    findMany.mockResolvedValue([
      { id: "someone_else", userId: "u_other", tokenHash: hashToken(generateToken()) },
      { id: "mine", userId: "u_mine", tokenHash: hashToken(raw) },
    ]);

    expect(await authenticateBearer(`Bearer ${raw}`)).toEqual({
      userId: "u_mine",
      via: "api-token",
      apiTokenId: "mine",
    });
  });

  it("touches lastUsedAt without rewriting a hash that is already current", async () => {
    const raw = generateToken();
    findMany.mockResolvedValue([{ id: "mine", userId: "u_mine", tokenHash: hashToken(raw) }]);

    await authenticateBearer(`Bearer ${raw}`);

    expect(update).toHaveBeenCalledTimes(1);
    const [{ where, data }] = update.mock.calls[0] as [{ where: unknown; data: Record<string, unknown> }];
    expect(where).toEqual({ id: "mine" });
    expect(data.tokenHash).toBeUndefined();
    expect(data.lastUsedAt).toBeInstanceOf(Date);
  });

  it("accepts a legacy bcrypt token and upgrades it in the same write", async () => {
    const raw = generateToken();
    findMany.mockResolvedValue([
      { id: "legacy", userId: "u_legacy", tokenHash: bcrypt.hashSync(`${raw}:${PEPPER}`, 4) },
    ]);

    expect(await authenticateBearer(`Bearer ${raw}`)).toEqual({
      userId: "u_legacy",
      via: "api-token",
      apiTokenId: "legacy",
    });

    expect(update).toHaveBeenCalledTimes(1);
    const [{ data }] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.tokenHash).toBe(hashToken(raw));
    expect(data.lastUsedAt).toBeInstanceOf(Date);
  });

  it("rejects a token that matches no candidate, and writes nothing", async () => {
    findMany.mockResolvedValue([
      { id: "legacy", userId: "u_legacy", tokenHash: bcrypt.hashSync(`${generateToken()}:${PEPPER}`, 4) },
      { id: "current", userId: "u_current", tokenHash: hashToken(generateToken()) },
    ]);

    expect(await authenticateBearer(`Bearer ${generateToken()}`)).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a malformed or absent Authorization header without querying", async () => {
    expect(await authenticateBearer(null)).toBeNull();
    expect(await authenticateBearer("Basic abc")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });
});
