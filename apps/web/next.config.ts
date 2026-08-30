import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@storycanon/db"],

  // @storycanon/db is external, so webpack never looks inside it and Next's
  // output tracing never sees what it imports. The workers client pulls in
  // @prisma/client's edge runtime, which therefore never reaches the standalone
  // output — and OpenNext's esbuild pass, resolving from inside .open-next,
  // cannot find it. It goes unnoticed on Windows, where `next build` fails to
  // create the standalone symlink at all (EPERM) and resolution falls back to
  // the repository's own node_modules, which has everything.
  outputFileTracingIncludes: {
    "**/*": ["../../node_modules/@prisma/client/runtime/**"],
  },
  webpack: (config) => {
    // @storycanon/db is a workspace package, so node_modules holds a symlink to
    // packages/db. Resolving through it would turn the package into ordinary
    // local source, which is not what we want it treated as.
    config.resolve.symlinks = false;

    // `serverExternalPackages` alone did not keep webpack out of this package,
    // so say it directly. It matters because the workers build of the client
    // imports its query compiler as `./query_compiler_fast_bg.wasm?module` —
    // the form workerd instantiates at deploy time. If webpack claims that
    // import, the wasm never reaches OpenNext's esbuild pass in that form and
    // the Worker fails on its first query.
    config.externals = config.externals ?? [];
    config.externals.push((
      { request }: { request?: string },
      callback: (err?: unknown, result?: string) => void,
    ) => {
      if (request === "@storycanon/db" || request?.startsWith("@storycanon/db/")) {
        return callback(undefined, `module ${request}`);
      }
      return callback();
    });
    return config;
  },
};

export default nextConfig;
