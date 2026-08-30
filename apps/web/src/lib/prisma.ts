import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@storycanon/db";

/**
 * Prisma 7 talks to Postgres through a driver adapter rather than its own Rust
 * query engine, which moves TLS and connection pooling under node-postgres'
 * rules. `@storycanon/db` resolves to a different generated client on Node and
 * on workerd — see that package — and the two runtimes also need the client
 * built differently, which is what the split below is for.
 *
 * TLS is driven entirely by the connection string. The engine used to negotiate
 * `sslmode=prefer` implicitly; node-postgres defaults to no TLS at all, and RDS
 * refuses unencrypted connections (`rds.force_ssl = 1`), so the deployed
 * `DATABASE_URL` carries `sslmode=no-verify` — encrypted, certificate not
 * verified, which is what the engine effectively did. Local development, whose
 * URL carries no `sslmode`, keeps connecting in the clear to the docker-compose
 * Postgres.
 *
 * Nothing here connects or throws while the module is evaluated: `next build`
 * evaluates every route module and has no DATABASE_URL. A missing URL surfaces
 * as a connection error on the first query, which is where the engine reported
 * it too.
 */

/** workerd identifies itself here; there is no `process` to sniff. */
const isWorkers =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/**
 * On Workers the connection string comes from the Hyperdrive binding, not the
 * environment: it points at Cloudflare's pool rather than straight at Postgres,
 * and it is minted per request.
 *
 * A missing binding is fatal rather than falling back to DATABASE_URL. The
 * Worker may still carry that secret, and during the migration it holds the RDS
 * string — a silent fallback would have production writing to the database
 * everyone believes is frozen and safe to roll back to. `wrangler dev` has
 * `localConnectionString` for this, so there is nothing legitimate to fall back
 * to.
 */
function resolveConnectionString() {
  if (!isWorkers) return process.env.DATABASE_URL;

  const connectionString = getCloudflareContext().env.HYPERDRIVE?.connectionString;
  if (!connectionString) {
    throw new Error("The HYPERDRIVE binding is missing; refusing to fall back to DATABASE_URL.");
  }
  return connectionString;
}

function createPrismaClient() {
  const connectionString = resolveConnectionString();

  // Pooling belongs to whoever can actually hold sockets open. On Node that is
  // this process; on Workers it is Hyperdrive, and a pool here would only ever
  // be a pool of one request's sockets.
  const adapter = isWorkers
    ? new PrismaPg({ connectionString })
    : new PrismaPg({
        connectionString,
        // node-postgres only enforces a connection timeout when the option is
        // present, so without it an exhausted pool waits forever. The engine
        // used to give up after 10s with P2024.
        connectionTimeoutMillis: 10_000,
        // node-postgres' own default, made explicit because it is now the whole
        // budget for a task: `connection_limit` in the URL was an engine
        // parameter and is ignored here. A blue/green deploy runs two task sets,
        // so this is doubled against the RDS connection limit.
        max: 10,
      });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * One client per request on Workers, one per process on Node.
 *
 * A module-level client on workerd fails every other request: its pool holds
 * sockets belonging to the I/O context of whichever request opened them, and
 * Workers isolates that per request, so alternate requests inherit a connection
 * they may not use.
 *
 * React's `cache()` looks like the obvious way to scope it, and it is what the
 * OpenNext docs suggest — but it only memoizes when a cache dispatcher is
 * installed, and Next's Route Handler runtime never installs one. There it
 * degrades to calling the factory again on every single call, which would mean
 * a fresh client, pool and Hyperdrive socket per property access; Workers caps
 * simultaneous connections per invocation, so a handler doing a handful of
 * queries would start throwing. Keying off the execution context works in every
 * workerd context, render or not.
 *
 * On Node the opposite is true — a client per request would mean a pool per
 * request — so the process keeps one, stashed on `globalThis` so dev hot
 * reloads do not accumulate pools.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const perRequestClients = new WeakMap<object, PrismaClient>();

function getClient(): PrismaClient {
  if (!isWorkers) {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }

  const { ctx } = getCloudflareContext();
  const existing = perRequestClients.get(ctx);
  if (existing) return existing;

  const client = createPrismaClient();
  perRequestClients.set(ctx, client);
  // The pool outlives the response otherwise; waitUntil keeps the isolate alive
  // just long enough to close it.
  ctx.waitUntil(client.$disconnect());
  return client;
}

/**
 * Exported as a proxy so the several dozen `prisma.model.op()` call sites stay
 * unaware of all of the above, and so nothing is constructed until a query is
 * actually made.
 *
 * Methods are bound to the real client rather than left to receive the proxy as
 * `this`. Without that, `prisma.$transaction(...)` runs with `this` set to the
 * proxy and every internal field read re-enters this trap.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
