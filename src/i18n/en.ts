/**
 * en.ts — the DEFAULT ('en') locale string table.
 *
 * Keys are dot-namespaced by surface (e.g. "home.hero.headline"). This is the
 * scaffold's single source of truth for English copy; other locales register a
 * PARTIAL table and fall back to these strings key-by-key (see registry.ts).
 *
 * SCAFFOLD DISCIPLINE: only ONE surface (the Home hero) is extracted here as the
 * demo. The rest of the app keeps its inline copy — this avoids a global churn /
 * mass-translation pass while proving the t()/registry seam end-to-end.
 */

export const en = {
  // --- Home hub hero (the extracted demo surface) ---------------------------
  "home.hero.kicker": "CRYPT · Crypt Legends · closed alpha",
  "home.hero.headline": "Command",
  "home.hero.headlineSub": " the archive",
  "home.hero.deck":
    "Build a deck, lead a commander, and duel on one tactical field. Gods, monsters, and heroes in play.",
  "home.hero.playLabel": "Play",
  "home.hero.playMeta": "Jump into a match",

  // --- Puzzle / solo surface (A9) -------------------------------------------
  "puzzle.eyebrow": "Solo · Puzzles",
  "puzzle.title": "Find the line",
  "puzzle.lead":
    "Hand-built tactical positions with one winning line. Deterministic — the board never lies. Solve them at your own pace.",
  "puzzle.objective": "Objective",
  "puzzle.solveCta": "Reveal the winning line",
  "puzzle.solved": "Solved — lethal found.",
  "puzzle.reset": "Reset board",

  // --- a11y palette toggle label (A6) ---------------------------------------
  "a11y.palette.toggle": "Colorblind-safe palette",
} as const;

/** The canonical key union — every locale's table is typed against this. */
export type MessageKey = keyof typeof en;
