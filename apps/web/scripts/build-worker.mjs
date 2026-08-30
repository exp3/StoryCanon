import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Builds the Cloudflare Worker with `.env` out of the way.
 *
 * `next build` loads `.env`, and whatever it finds there ends up in the bundle.
 * On the Fargate path that is harmless because the Docker build never sees the
 * file — `.dockerignore` excludes it. The Worker is built on a developer
 * machine, where the file very much exists, and it holds local values:
 * NEXTAUTH_URL pointing at localhost, empty Google credentials, and a
 * NEXTAUTH_SECRET of "local-dev-secret-change-me". Those silently outrank the
 * secrets set with `wrangler secret put`.
 *
 * It first showed up as a broken OAuth callback URL, which is the loud symptom.
 * The quiet one is the session signing key: a deploy that leaked it would sign
 * production sessions with a string that is committed to the repository.
 *
 * Doing this by hand is not good enough — forgetting once is all it takes — so
 * the move is part of the build and the file is put back no matter how the
 * build ends.
 */
const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(appDir, ".env");
const stashPath = join(appDir, ".env.build-stash");

function restore() {
  if (existsSync(stashPath) && !existsSync(envPath)) {
    renameSync(stashPath, envPath);
  }
}

// A previous run that was killed mid-build leaves the stash behind. Put it back
// before doing anything else; refuse to guess if both files somehow exist.
if (existsSync(stashPath)) {
  if (existsSync(envPath)) {
    console.error(
      `Both ${envPath} and ${stashPath} exist. A previous build left the stash behind ` +
        `and a new .env has since been created. Merge them by hand and delete the stash.`,
    );
    process.exit(1);
  }
  console.warn("Recovered .env from a previous interrupted build.");
  restore();
}

const stashed = existsSync(envPath);
if (stashed) renameSync(envPath, stashPath);

// Cover the ways this process can end, including Ctrl-C, so the developer is
// never left without their .env.
process.on("exit", restore);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    restore();
    process.exit(1);
  });
}

const result = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
  cwd: appDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

restore();
process.exit(result.status ?? 1);
