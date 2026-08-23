import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 talks to Postgres through a driver adapter rather than its own Rust
 * query engine. That is what makes the client bundle small enough to run on
 * Cloudflare Workers, and it moves two things that used to be the engine's job
 * — TLS and connection pooling — under node-postgres' rules.
 *
 * TLS is driven entirely by the connection string. The engine used to negotiate
 * `sslmode=prefer` implicitly; node-postgres defaults to no TLS at all, and RDS
 * refuses unencrypted connections (`rds.force_ssl = 1`), so the deployed
 * `DATABASE_URL` carries `sslmode=no-verify` — encrypted, certificate not
 * verified, which is what the engine effectively did. Local development, whose
 * URL carries no `sslmode`, keeps connecting in the clear to the docker-compose
 * Postgres. `no-verify` rather than `require` because node-postgres currently
 * treats `require` as full verification and warns that it changes meaning in pg
 * v9; moving to `verify-full` is worth doing once the database is Neon, whose
 * certificate chains to a public CA.
 *
 * Nothing here connects, reads the environment eagerly, or throws: constructing
 * the client must stay free of side effects because `next build` evaluates
 * every route module, and the build has no DATABASE_URL. A missing URL
 * therefore surfaces as a connection error on the first query, which is where
 * the engine used to report it too.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // node-postgres leaves `connectionTimeoutMillis` unset by default, and its
    // pool only enforces a timeout when the option is present — so a caller
    // waiting on an exhausted pool would wait forever. The Rust engine failed
    // that wait after 10s with P2024, and losing it would turn a slow database
    // into requests that hang until the load balancer kills the task, with
    // nothing in the logs to say why. Keep the old ceiling.
    connectionTimeoutMillis: 10_000,
    // node-postgres' own default, made explicit because it is now the whole
    // budget for a task: `connection_limit` in the URL was an engine parameter
    // and is ignored here. During a blue/green deploy two task sets hold a pool
    // each, so this is doubled against the RDS connection limit.
    max: 10,
    // `?schema=public` in the URL is inert now — the adapter takes the schema
    // from this options object, not the connection string. Left at the default
    // `search_path`, which resolves to public; set PrismaPg's second argument
    // if a non-public schema is ever needed.
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
