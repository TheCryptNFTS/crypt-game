/**
 * SNAP CARD POOL — Cut 1.
 *
 * Reuses the existing curated NFT art + names (the collection is the brand) but
 * strips every mechanic: a Snap card is just { cost, power }. Power is derived
 * deterministically from cost so the Cut-1 pool is instantly readable and
 * balance-neutral (a 1-cost is always weaker than a 6-cost). Keywords, factions,
 * abilities and stat lines are intentionally dropped in Cut 1 — later cuts layer
 * a single keyword back on through the reveal pipeline.
 */

import curated from "../data/curatedCoreSetV2.json";
// 2026-07-03 sprint: the full openseaAssets.json (22.6MB) was statically
// bundled into the /snap chunk (21.3MB of JS) though only 3 fields are read.
// The slim projection carries identical tokenId/imageUrl/name values at ~0.9MB.
import opensea from "../data/openseaAssetsSlim.json";
import { MAX_POWER } from "./types";

/** A vanilla card template (no instance identity yet). */
export type SnapCardTemplate = {
  cardId: string;
  name: string;
  cost: number;
  power: number;
  imageUrl?: string;
};

type CuratedUnit = {
  id: string;
  name: string;
  cost: number;
  sourceTokenId?: string;
  sourceCardId?: string;
};

// tokenId → { imageUrl, name } so we can dress vanilla cards in real collection art.
const artByToken = new Map<string, { imageUrl?: string; name?: string }>();
for (const c of (opensea as { cards?: Array<{ tokenId?: string; imageUrl?: string; name?: string }> }).cards ?? []) {
  if (c.tokenId) artByToken.set(String(c.tokenId), { imageUrl: c.imageUrl, name: c.name });
}

/** Vanilla power for a given cost: cost×2, floored at 1, capped at MAX_POWER. */
export function powerForCost(cost: number): number {
  const c = Math.max(1, Math.min(6, Math.floor(cost)));
  return Math.min(MAX_POWER, c * 2);
}

/**
 * The full Cut-1 card pool: every curated unit, flattened to a vanilla
 * cost/power template dressed in its real name + art. Deterministic order
 * (input order) so decks built from a seed are reproducible.
 */
export const SNAP_POOL: readonly SnapCardTemplate[] = ((curated as { units?: CuratedUnit[] }).units ?? [])
  .map((u): SnapCardTemplate => {
    const cost = Math.max(1, Math.min(6, Math.floor(u.cost ?? 1)));
    const art = u.sourceTokenId ? artByToken.get(String(u.sourceTokenId)) : undefined;
    return {
      cardId: u.sourceCardId ?? u.id,
      // Prefer the real collection name over the placeholder "Digital Trading Card #N".
      name: art?.name ?? u.name,
      cost,
      power: powerForCost(cost),
      imageUrl: art?.imageUrl,
    };
  });

/** Look up a pool template by its catalog id. */
export function snapTemplateById(cardId: string): SnapCardTemplate | undefined {
  return SNAP_POOL.find((t) => t.cardId === cardId);
}
