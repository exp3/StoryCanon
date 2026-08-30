import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Builds the Cloudflare Worker with every dotenv file out of the way.
 *
 * `next build` loads them, and whatever it finds ends up in the bundle. On the
 * Fargate path that is harmless because the Docker build never sees them —
 * `.dockerignore` excludes them. The Worker is built on a developer machine,
 * where they very much exist and hold local values: NEXTAUTH_URL pointing at
 * localhost, empty Google credentials, and a NEXTAUTH_SECRET of
 * "local-dev-secret-change-me". Those silently outrank the secrets set with
 * `wrangler secret put`.
 *
 * It first showed up as a broken OAuth callback URL, which is the loud symptom.
 * The quiet one is the session signing key: a deploy that leaked it would sign
 * production sessions with a string committed to this repository.
 *
 * All of Next's production lookups are covered, not just `.env` — `.env.local`
 * and `.env.production` both outrank it, and `.env.local` is a perfectly
 * ordinary file for a developer to have.
 */
const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Everything `next build` reads in production mode, plus the dev pair. */
const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
];

const SUFFIX = ".build-stash";

function restore() {
  for (const name of ENV_FILES) {
    const original = join(appDir, name);
    const stash = `${original}${SUFFIX}`;
    if (existsSync(stash) && !existsSync(original)) {
      renameSync(stash, original);
    }
  }
}

// A run that was killed mid-build leaves stashes behind. Put them back before
// doing anything else; refuse to guess if both copies of a file exist.
for (const name of ENV_FILES) {
  const original = join(appDir, name);
  const stash = `${original}${SUFFIX}`;
  if (existsSync(stash) && existsSync(original)) {
    console.error(
      `Both ${name} and ${name}${SUFFIX} exist. A previous build left the stash behind and a ` +
        `new ${name} has since been created. Merge them by hand and delete the stash.`,
    );
    process.exit(1);
  }
}
if (ENV_FILES.some((name) => existsSync(join(appDir, `${name}${SUFFIX}`)))) {
  console.warn("Recovered dotenv files from a previous interrupted build.");
  restore();
}

for (const name of ENV_FILES) {
  const original = join(appDir, name);
  if (existsSync(original)) renameSync(original, `${original}${SUFFIX}`);
}

// Cover the ways this process can end, including Ctrl-C, so the developer is
// never left without their dotenv files.
process.on("exit", restore);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    restore();
    process.exit(1);
  });
}

const run = (args) =>
  spawnSync("npm", args, { cwd: appDir, stdio: "inherit", shell: process.platform === "win32" });

// Both clients, unlike the Node-only build the AWS path runs: the Worker bundle
// needs dist/workers at runtime and dist/node for its types.
let result = run(["run", "db:all"]);
if (result.status === 0 && !result.error) {
  result = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
    cwd: appDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

restore();

if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
