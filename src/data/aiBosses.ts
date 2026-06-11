import commanderArt from "./commanderArt.json";
import type { AiDifficulty } from "../game-ui/cryptMatchAI";

/*
 * aiBosses — the three NAMED solo opponents (chess.com named-bot pattern +
 * Hearthstone boss talk). STATIC content + deterministic selection only — zero
 * runtime LLM. Each boss maps 1:1 onto an EXISTING difficulty storage value
 * (easy/normal/hard — byte-identical to what DifficultySelect persists and the
 * AI planner reads), so naming the opponent changes NOTHING about how it plays.
 *
 * Voice: the dark-relic register ("The signal bends to me"), never quippy.
 * Portraits are real commander renders from commanderArt.json — art fills the
 * frame, per the full-width feedback. Line selection is indexed by the match
 * seed modulo pool length: deterministic, replayable, no RNG at render time.
 */

export type AiBoss = {
  /** The EXACT difficulty storage value this boss fronts. */
  difficulty: AiDifficulty;
  name: string;
  title: string;
  doctrine: string;
  /** Declared playstyle chip — must match how the tier actually plays. */
  styleChip: "RUSH" | "STALL" | "CONTROL";
  /** One-line signature tendency, shown on the select card. */
  signature: string;
  /** Commander render id in commanderArt.json. */
  artId: string;
  /** Resolved portrait URL (real commander art). */
  imageUrl: string;
  introLines: readonly [string, string, string];
  /** Spoken when the BOSS wins (the player lost). */
  winLines: readonly [string, string];
  /** Spoken when the BOSS loses (the player won). */
  lossLines: readonly [string, string];
};

const ART = commanderArt as Record<string, string>;

export const AI_BOSSES: Record<AiDifficulty, AiBoss> = {
  easy: {
    difficulty: "easy",
    name: "WARDEN KAEL",
    title: "Keeper of the Iron Gate",
    doctrine: "Iron",
    styleChip: "RUSH",
    signature: "Attacks the moment it can",
    artId: "cmd_iron_warlord",
    imageUrl: ART.cmd_iron_warlord ?? "",
    introLines: [
      "The gate is open. I do not wait.",
      "Iron remembers every siege. So do I.",
      "Draw fast. The first blood is mine.",
    ],
    winLines: [
      "The signal bends to iron. It always has.",
      "You hesitated. The gate did not.",
    ],
    lossLines: [
      "A breach. It will not open twice.",
      "Logged. Iron keeps its grudges.",
    ],
  },
  normal: {
    difficulty: "normal",
    name: "THE ARCHIVIST",
    title: "Curator of the Stone Record",
    doctrine: "Stone",
    styleChip: "STALL",
    signature: "Builds walls, then patience",
    artId: "cmd_stone_warden",
    imageUrl: ART.cmd_stone_warden ?? "",
    introLines: [
      "Sit. Your defeat is already shelved.",
      "Stone outlasts every signal. So will I.",
      "I have read this match. You lose slowly.",
    ],
    winLines: [
      "Filed, with the rest of the patient dead.",
      "The walls were never yours to break.",
    ],
    lossLines: [
      "An error in the record. I will correct it.",
      "Noted. The archive forgets nothing.",
    ],
  },
  hard: {
    difficulty: "hard",
    name: "SOVEREIGN VESH",
    title: "Crown of the Gold Doctrine",
    doctrine: "Gold",
    styleChip: "CONTROL",
    signature: "Answers everything, forgives nothing",
    artId: "cmd_golden_emperor",
    imageUrl: ART.cmd_golden_emperor ?? "",
    introLines: [
      "The signal bends to me. Begin.",
      "Every answer is already written in gold.",
      "Kneel early. It changes nothing.",
    ],
    winLines: [
      "Answered. As everything is answered.",
      "Gold forgives nothing. Neither do I.",
    ],
    lossLines: [
      "One unanswered question. Savor it.",
      "The crown slips. It does not fall.",
    ],
  },
};

/** The boss fronting a difficulty value. Unknown input falls back to normal. */
export function getBossForDifficulty(difficulty: AiDifficulty): AiBoss {
  return AI_BOSSES[difficulty] ?? AI_BOSSES.normal;
}

/**
 * Deterministic line selection: index by match seed modulo pool length.
 * Numeric seeds (Date.now() at match creation) index directly; string seeds
 * fold to a small non-negative hash first. Same seed → same line, always.
 */
export function seededIndex(seed: string | number, poolLength: number): number {
  if (poolLength <= 0) return 0;
  let n: number;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    n = Math.abs(Math.floor(seed));
  } else {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    n = Math.abs(h);
  }
  return n % poolLength;
}

/** Pick one line from a pool, seeded by the match seed. */
export function pickBossLine(
  lines: readonly string[],
  seed: string | number,
): string {
  if (lines.length === 0) return "";
  return lines[seededIndex(seed, lines.length)];
}

export default AI_BOSSES;
