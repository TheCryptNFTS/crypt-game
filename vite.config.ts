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
}));
