import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Appends one NDJSON line per POST so Cursor can read `/Users/billy/crypt-game/.cursor/debug-8b1623.log`. */
export function viteAgentDebugPlugin(): Plugin {
  return {
    name: "agent-debug-ndjson",
    configureServer(server) {
      server.middlewares.use("/__agent_debug_ingest", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => {
          chunks.push(c);
        });
        req.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8").trim();
          const dir = path.join(__dirname, ".cursor");
          const logFile = path.join(dir, "debug-8b1623.log");
          try {
            fs.mkdirSync(dir, { recursive: true });
            if (raw) fs.appendFileSync(logFile, `${raw}\n`);
          } catch {
            /* ignore */
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}
