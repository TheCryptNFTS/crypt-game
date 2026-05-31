#!/usr/bin/env node
/**
 * sync-engine.mjs — vendor the pure rules engine into the FREELON CITY site.
 *
 * WHY vendoring (not a workspace package): the two repos are SEPARATE git roots
 * with no monorepo, and the engine resolves its dependencies with RELATIVE
 * imports (`../data/*`, `../types/*`, `../lib/*`, `../constants/*`,
 * `../design/*`). A published package would require rewriting every one of
 * those imports. Instead we copy a MIRRORED slice of `src/` into the city site
 * under `lib/crypt-engine/`, so `lib/crypt-engine/engine/reducer.ts` keeps
 * resolving `../data` -> `lib/crypt-engine/data` with ZERO import edits.
 *
 * Source of truth stays HERE (crypt-game/src). Never hand-edit the vendored
 * copy — edit here, then `npm run sync:engine`.
 *
 * WHAT gets copied: we walk the import graph from the entry points below and
 * copy ONLY the transitive closure. This is deliberately tighter than copying
 * whole dirs — it keeps dead modules (and the 33MB openseaAssets.json / 11MB
 * cardMaster.json that the reducer never touches) OUT of the city repo, while
 * still pulling the 3.6MB generatedTcgCards.json the engine genuinely needs
 * (server-side only — these routes are runtime="nodejs", so it never reaches a
 * client bundle).
 *
 * Excludes `*.bak*` and `*.broken_now` scratch files by construction (the graph
 * never imports them). Writes a banner to each copied source file and a sorted
 * MANIFEST.sha256 that the city's verify:engine re-checks to fail builds on
 * drift.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_SRC = resolve(__dirname, "..", "src");
const CITY_VENDOR = resolve(
  __dirname,
  "..",
  "..",
  "freelon",
  "phase3",
  "freelon-city-site",
  "lib",
  "crypt-engine",
);

/**
 * Import-graph roots. Everything the city site calls into bottoms out here:
 *   - reducer.ts             — applyAction (the per-turn authority)
 *   - createMatchFromDecks   — server-side match bootstrap
 *   - state.ts               — MatchState / PlayerId types
 *   - engine/commanders.ts   — allCommanders (demo deck commander ids)
 *   - engine/cards.ts        — allPlayableCards (demo deck card pool)
 * The last two are pulled in transitively anyway, but are listed as explicit
 * roots because the city's demo-deck builder imports them directly.
 */
const ENTRY_POINTS = [
  "engine/reducer.ts",
  "engine/createMatchFromDecks.ts",
  "engine/state.ts",
  "engine/commanders.ts",
  "engine/cards.ts",
];

const BANNER =
  "// GENERATED — vendored from crypt-game/src. Edit there, then run sync-engine.\n";

const RESOLVE_EXTS = [".ts", ".tsx", ".mjs", ".cjs", ".js", ".json"];
const BANNERED_EXTS = new Set([".ts", ".tsx", ".mjs", ".cjs", ".js"]);

function isExcluded(p) {
  return p.includes(".bak") || p.endsWith(".broken_now");
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i);
}

/** Resolve a relative import specifier to an on-disk source file, or null. */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null; // bare/external (node, react, etc.)
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    ...RESOLVE_EXTS.map((e) => base + e),
    ...RESOLVE_EXTS.map((e) => join(base, "index" + e)),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile() && !isExcluded(c)) return c;
  }
  return null;
}

/** Depth-first walk of the import graph, collecting absolute file paths. */
function collectClosure(entryAbs, seen) {
  if (seen.has(entryAbs)) return;
  seen.add(entryAbs);
  if (entryAbs.endsWith(".json")) return; // leaf asset
  const text = readFileSync(entryAbs, "utf8");
  // Fresh regex per call — a shared /g regex would corrupt `lastIndex` across
  // the recursive descent and silently drop transitive deps.
  const importRe =
    /(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(text))) {
    const spec = m[1] || m[2];
    const resolved = resolveImport(entryAbs, spec);
    if (resolved) collectClosure(resolved, seen);
  }
}

function main() {
  const seen = new Set();
  for (const entry of ENTRY_POINTS) {
    const abs = join(GAME_SRC, entry);
    if (!existsSync(abs)) {
      throw new Error(`sync-engine: entry point missing: ${entry}`);
    }
    collectClosure(abs, seen);
  }

  // Clean rebuild so deletions / dropped deps propagate.
  rmSync(CITY_VENDOR, { recursive: true, force: true });
  mkdirSync(CITY_VENDOR, { recursive: true });

  /** @type {Array<{rel: string, sha: string}>} */
  const manifest = [];

  for (const srcAbs of seen) {
    const rel = relative(GAME_SRC, srcAbs); // e.g. engine/reducer.ts
    const destAbs = join(CITY_VENDOR, rel);
    mkdirSync(dirname(destAbs), { recursive: true });

    let bytes;
    if (BANNERED_EXTS.has(extOf(srcAbs))) {
      bytes = Buffer.from(BANNER + readFileSync(srcAbs, "utf8"), "utf8");
    } else {
      // JSON copied byte-for-byte (a banner would break JSON.parse).
      bytes = readFileSync(srcAbs);
    }
    writeFileSync(destAbs, bytes);

    const sha = createHash("sha256").update(bytes).digest("hex");
    manifest.push({ rel: rel.split("\\").join("/"), sha });
  }

  manifest.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  writeFileSync(
    join(CITY_VENDOR, "MANIFEST.sha256"),
    manifest.map((m) => `${m.sha}  ${m.rel}`).join("\n") + "\n",
    "utf8",
  );

  console.log(
    `sync-engine: vendored ${manifest.length} files into ${relative(process.cwd(), CITY_VENDOR)}`,
  );
}

main();
