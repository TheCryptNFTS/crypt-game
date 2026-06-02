import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteAgentDebugPlugin } from "./viteAgentDebugPlugin";

export default defineConfig(({ command }) => ({
  plugins: [
    ...(command === "serve" ? [viteAgentDebugPlugin()] : []),
    tailwindcss(),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing data JSON and big vendor libs into
        // their own long-cache chunks so the app shell stays small and a code
        // change doesn't bust the multi-MB card data on every deploy.
        manualChunks(id: string) {
          if (id.includes("/src/data/generatedTcgCards.json")) return "data-tcg-cards";
          if (id.includes("/src/data/runtimeMatchPlayableCards.json"))
            return "data-runtime-match";
          if (id.includes("renderManifest")) return "data-render-manifest";
          if (id.includes("/node_modules/react") || id.includes("/node_modules/scheduler"))
            return "vendor-react";
          if (id.includes("/node_modules/")) return "vendor";
          return undefined;
        },
      },
    },
  },
  server: {
    // asset-review/ is a scratch dir that parallel render jobs write generated
    // HTML/image output into; .cursor/ holds the agent-debug NDJSON log that the
    // debug plugin appends to on every client POST. Watching either triggers full
    // page reloads that wipe in-progress match state, so keep the watcher off them.
    watch: { ignored: ["**/asset-review/**", "**/.cursor/**"] },
  },
}));
