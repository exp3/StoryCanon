/**
 * Bindings this Worker declares in wrangler.jsonc. OpenNext exposes them
 * through `getCloudflareContext().env`, which is typed against this interface.
 */
interface CloudflareEnv {
  /**
   * Hyperdrive pools connections on Cloudflare's side, which is the only place
   * a pool can live when the runtime isolates requests. `connectionString`
   * points at that pool, not directly at Postgres.
   *
   * Optional because the type cannot prove the binding was deployed; the
   * runtime treats its absence as fatal rather than falling back.
   */
  HYPERDRIVE?: { connectionString: string };
}
