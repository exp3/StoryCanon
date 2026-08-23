import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved the Migrate connection URL out of `schema.prisma` — the
 * `datasource.url` property is rejected there now — and stopped loading `.env`
 * on its own, hence the explicit `dotenv/config` import.
 *
 * This file configures the CLI only. The application never reads it: the
 * runtime connection is built in `src/lib/prisma.ts` from the same environment
 * variable, through the pg driver adapter.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read straight from the environment rather than through `env()`, which
    // throws when the variable is missing. This file is evaluated for *every*
    // Prisma command — `generate` included — so `env()` would make a missing
    // DATABASE_URL fail the build, and neither CI nor the Docker builder has
    // one. `url` is optional; the commands that actually connect still refuse
    // to run without it.
    url: process.env.DATABASE_URL,
  },
});
