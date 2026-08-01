import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for pure, framework-free modules (currently the billing kill
 * switch and Stripe price mapping). Runs in the node environment — nothing here
 * renders React, so jsdom would only slow it down.
 */
export default defineConfig({
  resolve: {
    // Mirrors the "@/*" -> "./src/*" alias in tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
