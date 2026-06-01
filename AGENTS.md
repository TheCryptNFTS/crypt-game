# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Crypt Game is an NFT-backed Trading Card Game (TCG) — a single-page React/TypeScript app with no backend. All game logic runs client-side. There is no database, no server, and no Docker setup.

### Tech Stack

- **Runtime:** Node.js (v22+), npm
- **Framework:** React 19, React Router v7, Tailwind CSS v4
- **Build:** Vite 8
- **Dev scripts:** `tsx` for running TypeScript dev/test scripts directly

### Key commands

All commands are in `package.json` scripts. The important ones:

| Task | Command |
|---|---|
| Dev server | `npm run dev` (Vite on port 5173) |
| Build | `npm run build` |
| Type check | `npx tsc --noEmit` |
| Full health check | `npm run health` (chains type check + all validation scripts) |
| Regression tests | `npm run dev:regression` |
| E2E match flow | `npm run dev:e2e` |
| Turn combat check | `npm run dev:turncombat` |

### Caveats

- There is no ESLint config — the project does not use a linter.
- There is no formal test framework (no Jest/Vitest) — tests are custom `tsx` scripts under `src/dev/`.
- The `npm run health` script is the comprehensive validation suite — it chains `tsc --noEmit` with all dev check scripts and the `check:alpha` balance pipeline. It takes ~30s to run.
- The `dev:turncombat` script logs a known `Error: Unit cannot attack` message as part of its expected test flow (testing that blocked attacks are correctly rejected). This is not a failure.
- The OpenSea API key (`OPENSEA_API_KEY`) is only needed for `npm run assets:fetch` to refresh NFT metadata. Pre-fetched data is committed to the repo, so this is not required for development.
- The Profile page (`/profile`) is a stub — it has TODO placeholders for future backend APIs.
