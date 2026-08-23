import { cache } from "react";
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

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

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
 * On Workers a module-level client fails every other request: its pool holds
 * sockets belonging to the I/O context of whichever request opened them, and
 * Workers isolates that per request, so alternate requests inherit a connection
 * they are not allowed to use. `cache` scopes the client to a single request.
 *
 * On Node the opposite is true — a client per request would mean a connection
 * pool per request — so the process keeps one, stashed on `globalThis` so dev
 * hot reloads do not accumulate pools.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const getRequestClient = cache(createPrismaClient);

function getClient(): PrismaClient {
  if (isWorkers) return getRequestClient();
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

/**
 * Exported as a proxy so the several dozen `prisma.model.op()` call sites stay
 * unaware of all of the above, and so nothing is constructed until a query is
 * actually made.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});
