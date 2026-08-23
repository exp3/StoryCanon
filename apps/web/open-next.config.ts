import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Deliberately bare. Every dynamic route is `force-dynamic` and nothing uses
 * `revalidate`, so there is no incremental cache to override and no R2 bucket
 * to provision. Revisit if a route ever gains ISR.
 */
export default defineCloudflareConfig();
