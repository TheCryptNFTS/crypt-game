/**
 * SNAP RESULT SUMMARY — the shareable artefact of a finished match.
 *
 * PURE + READ-ONLY. This module never mutates match state, never touches the
 * reducer/AI/card data — it only reads the settled `SnapState` (winner, outcomes,
 * seed, lanes) and derives the human-facing recap: a Crypt-Trial title, the
 * standout Crypt, the closest Crypt, the MVP card, and the plain-text copy a
 * player pastes to challenge a friend. All of it is deterministic from the
 * already-decided board, so it is trivially testable.
 */

import { CRYPT_THEMES } from "./SnapBoard";
import type { SnapState, SnapWinner } from "./types";

export type SnapResult = {
  /** WIN / DEFEAT / STALEMATE headline. */
  verdict: "WIN" | "DEFEAT" | "STALEMATE";
  winner: SnapWinner;
  /** Crypts each side took. */
  cryptsWon: number;
  cryptsLost: number;
  /** Total committed power across all three Crypts (the "Score" line). */
  power: number;
  foePower: number;
  /** On-theme rank earned by the outcome. */
  title: string;
  /** The Crypt you won by the biggest margin (or held strongest). */
  bestCrypt: string | null;
  /** The nail-biter — smallest margin of the three. */
  closestCrypt: string | null;
  /** Your highest-power card on the board. */
  mvp: string | null;
  /** The deterministic match seed → the challenge link. */
  seed: number;
};

function cryptName(index: number): string {
  return (CRYPT_THEMES[index] ?? CRYPT_THEMES[0]).name;
}

/**
 * Rank titles map straight onto how the match was won/lost so the shared line
 * says something about the player. Strictly on-brand crypt vocabulary.
 */
function earnTitle(winner: SnapWinner, cryptsWon: number, cryptsLost: number): string {
  if (winner === "P1") {
    if (cryptsWon >= 3) return "Gravebreaker"; // swept all three Crypts
    if (cryptsWon >= 2) return "Bone Warden"; // took the majority
    return "Ash-Touched"; // won on the power tiebreak
  }
  if (winner === "DRAW") return "Signal Heretic";
  return "Crypt Duelist"; // fought and lost — still stood in the Crypt
}

/** Derive the full shareable recap from a settled match. */
export function summarizeSnapResult(state: SnapState): SnapResult | null {
  if (!state.winner || !state.outcomes) return null;
  const outcomes = state.outcomes;

  let cryptsWon = 0;
  let cryptsLost = 0;
  let power = 0;
  let foePower = 0;
  for (const o of outcomes) {
    power += o.p1Power;
    foePower += o.p2Power;
    if (o.winner === "P1") cryptsWon += 1;
    else if (o.winner === "P2") cryptsLost += 1;
  }

  // Best Crypt: the one you won by the widest margin; if you won none, the Crypt
  // where you committed the most power (your strongest showing).
  let best: { name: string; margin: number } | null = null;
  for (const o of outcomes) {
    const won = o.winner === "P1";
    const margin = won ? o.p1Power - o.p2Power : -Infinity;
    if (!best || margin > best.margin) best = { name: cryptName(o.index), margin };
  }
  if (best && best.margin === -Infinity) {
    // No Crypt won — fall back to strongest committed lane.
    let strong = outcomes[0];
    for (const o of outcomes) if (o.p1Power > strong.p1Power) strong = o;
    best = { name: cryptName(strong.index), margin: 0 };
  }

  // Closest Crypt: the smallest absolute power gap — the moment it hung on.
  let closest: { name: string; gap: number } | null = null;
  for (const o of outcomes) {
    const gap = Math.abs(o.p1Power - o.p2Power);
    if (!closest || gap < closest.gap) closest = { name: cryptName(o.index), gap };
  }

  // MVP: your single highest-power card anywhere on the board.
  let mvp: { name: string; power: number } | null = null;
  for (const lane of state.lanes) {
    for (const c of lane.P1) {
      if (!mvp || c.power > mvp.power) mvp = { name: c.name, power: c.power };
    }
  }

  const verdict: SnapResult["verdict"] =
    state.winner === "P1" ? "WIN" : state.winner === "P2" ? "DEFEAT" : "STALEMATE";

  return {
    verdict,
    winner: state.winner,
    cryptsWon,
    cryptsLost,
    power,
    foePower,
    title: earnTitle(state.winner, cryptsWon, cryptsLost),
    bestCrypt: best ? best.name : null,
    closestCrypt: closest ? closest.name : null,
    mvp: mvp ? mvp.name : null,
    seed: state.seed,
  };
}

/** The deterministic challenge link — same decks, same opponent, same draw. */
export function challengeUrl(seed: number, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/snap?seed=${seed}`;
}

/**
 * Plain-text recap for pasting into a DM / post. No emoji, no hype, no token or
 * price language — just the proof and the challenge.
 */
export function shareText(result: SnapResult, origin?: string): string {
  const lines = [
    "I faced the Crypt Trial.",
    `Result: ${result.verdict}`,
    `Score: ${result.power}-${result.foePower}`,
  ];
  if (result.bestCrypt) lines.push(`Best Crypt: ${result.bestCrypt}`);
  lines.push(`Title: ${result.title}`);
  lines.push(`Beat my seed: ${challengeUrl(result.seed, origin)}`);
  return lines.join("\n");
}
