import { defineConfig } from "vitest/config";

// Vitest config for the deterministic pure-reducer engine tests. These unit
// tests exercise `applyAction` directly (no DOM, no React), so we run in the
// plain node environment with no setup files. Everything is seeded, so the suite
// is fully reproducible in CI.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // The engine proofs are deterministic; no retries, no randomized order.
    sequence: { shuffle: false },
    watch: false,
  },
});
