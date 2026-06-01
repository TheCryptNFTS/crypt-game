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
  server: {
    // asset-review/ is a scratch dir that parallel render jobs write generated
    // HTML/image output into; .cursor/ holds the agent-debug NDJSON log that the
    // debug plugin appends to on every client POST. Watching either triggers full
    // page reloads that wipe in-progress match state, so keep the watcher off them.
    watch: { ignored: ["**/asset-review/**", "**/.cursor/**"] },
  },
}));
