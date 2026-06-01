/**
 * SEALED / DRAFT MODE — limited deck construction (ADDITIVE).
 *
 * This is a clearly-scoped LIMITED variant layered on top of the existing,
 * unchanged curated set + constructed legality. Nothing here weakens constructed
 * rules: constructed `validateDeck` (deckRules.ts) is untouched and still used by
 * the deck builder / Find Match. Limited is its own validator with its own,
 * STRICTER-where-it-matters envelope (you may only play cards you actually opened).
 *
 * DETERMINISM CONTRACT
 * --------------------
 * Pool/pack generation draws ALL randomness from the engine's seeded mulberry32
 * PRNG (`makeRng`) via the seeded Fisher-Yates `shuffle` — exactly the same
 * primitive the match engine uses. No Math.random, no Date, no wall-clock. A run
 * is identified by a numeric `seed`; the same seed always yields the same pool
 * and the same sequential draft packs, so any sealed/draft run is reproducible
 * and auditable.
 *
 * ID SPACE
 * --------
 * The curated source-of-truth is `curatedCoreSetV2.all` (the 98 hand-balanced V2
 * cards). Each entry's `sourceCardId` is the canonical `tcg_<token>` registry id
 * that `getPlayableCardById` / `validateDeck` / the match-start path understand —
 * so the pool, the assembled limited deck, and the match all speak the same id
 * space the constructed path does.
 */

import curatedCoreSetV2 from "../data/curatedCoreSetV2.json";
import { getPlayableCardById, isCardDisabled, type PlayableCard } from "./cards";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { makeRng, shuffle } from "./rng";
import type { Faction } from "../types/faction";

/** A single curated-core entry as it appears in curatedCoreSetV2.json. */
type CuratedEntry = {
  id: string;
  sourceCardId: string;
  name: string;
  type: "unit" | "equipment" | "artifact";
  faction: string;
  rarity: string;
};

/** Limited-mode tuning. All additive — none of this touches constructed rules. */
export const SEALED_PACK_SIZE = 15;
export const SEALED_DEFAULT_PACKS = 6; // 6 * 15 = 90-card sealed pool
/**
 * A limited deck is a full 30-card deck assembled from the restricted ~90-card
 * sealed pool (vs constructed's full 4000+ corpus). We pin it to exactly 30 so the
 * assembled deck flows UNCHANGED through the existing constructed match-start
 * (`createMatchFromDecks` enforces the commander's deckSize, which is 30) — limited
 * is additive on the POOL, not a weakening of the deck-size rule. The pool of 90
 * distinct curated cards (~68 units) comfortably supports a 30-card build.
 */
export const LIMITED_MIN_DECK = 30;
export const LIMITED_MAX_DECK = 30;
/** Constructed copy cap also applies, so the limited deck stays constructed-legal. */
export const LIMITED_MAX_COPIES = 2;
/** Kept compatible with buildPlayerDeck's playable-shape caps so the limited deck
 *  flows through the SAME match-start path without being silently reshaped. */
export const LIMITED_MAX_EQUIPMENT = 8;
export const LIMITED_MAX_ARTIFACTS = 3;

/** The curated pool source — registry-backed, disabled cards excluded. */
const CURATED_ENTRIES: readonly CuratedEntry[] = (
  (curatedCoreSetV2 as { all?: CuratedEntry[] }).all ?? []
)
  .filter((e) => !!e.sourceCardId)
  // A soft-banned card must never enter a limited pool either.
  .filter((e) => !isCardDisabled(e.sourceCardId))
  // Deterministic base order so the seeded shuffle is the ONLY source of variance.
  .slice()
  .sort((a, b) => a.sourceCardId.localeCompare(b.sourceCardId));

export type SealedPoolCard = {
  /** Canonical registry id (`tcg_<token>`) — the id used in the deck + match. */
  id: string;
  name: string;
  type: PlayableCard["type"];
  faction: Faction;
  rarity: string;
  cost: number;
};

export type SealedPool = {
  seed: number;
  packs: number;
  /** Flat pool (all packs concatenated), in opened order. */
  cards: SealedPoolCard[];
};

function toPoolCard(entry: CuratedEntry): SealedPoolCard {
  const reg = getPlayableCardById(entry.sourceCardId);
  // reg is guaranteed by the proof (every curated sourceCardId resolves), but we
  // fall back to the curated entry's own fields defensively.
  return {
    id: entry.sourceCardId,
    name: reg?.name ?? entry.name,
    type: reg?.type ?? entry.type,
    faction: (reg?.faction ?? entry.faction) as Faction,
    rarity: reg?.rarity ?? entry.rarity,
    cost: reg?.cost ?? 0,
  };
}

/**
 * Generate a sealed pool of `packs` packs from the curated set, fully determined
 * by `seed`. Each pack is a seeded-shuffled, sampled-without-replacement slice of
 * the curated set; packs share one rng stream so the whole run is one seed.
 *
 * The curated set has 98 cards; with the default 6x15 = 90 we sample WITHOUT
 * replacement across the run when the pool fits, and reshuffle the full set as a
 * fresh "print run" only if `packs * SEALED_PACK_SIZE` exceeds the set size. This
 * keeps a sealed pool feeling like distinct opened packs rather than dupes.
 */
export function generateSealedPool(
  seed: number,
  packs: number = SEALED_DEFAULT_PACKS
): SealedPool {
  const rng = makeRng(seed >>> 0);
  const total = Math.max(1, Math.floor(packs)) * SEALED_PACK_SIZE;

  const drawn: CuratedEntry[] = [];
  let bag = shuffle(CURATED_ENTRIES, rng);
  let cursor = 0;
  while (drawn.length < total) {
    if (cursor >= bag.length) {
      // Exhausted this print run — reshuffle the full set for the next one. Still
      // 100% seeded (same rng stream), so determinism holds.
      bag = shuffle(CURATED_ENTRIES, rng);
      cursor = 0;
    }
    drawn.push(bag[cursor]);
    cursor += 1;
  }

  return {
    seed: seed >>> 0,
    packs: Math.max(1, Math.floor(packs)),
    cards: drawn.map(toPoolCard),
  };
}

/**
 * DRAFT: present the pool as sequential pick-1-of-N choices. Same seed -> same
 * pack contents and same order, so a draft is reproducible. This is the SAME
 * generated pool, just exposed pack-by-pack for sequential picking.
 */
export type DraftPack = SealedPoolCard[];

export function generateDraftPacks(
  seed: number,
  packs: number = SEALED_DEFAULT_PACKS
): DraftPack[] {
  const pool = generateSealedPool(seed, packs);
  const out: DraftPack[] = [];
  for (let i = 0; i < pool.packs; i += 1) {
    out.push(pool.cards.slice(i * SEALED_PACK_SIZE, (i + 1) * SEALED_PACK_SIZE));
  }
  return out;
}

/** How many copies of each registry id the pool actually contains. */
export function poolSupply(pool: SealedPool): Map<string, number> {
  const supply = new Map<string, number>();
  for (const c of pool.cards) supply.set(c.id, (supply.get(c.id) ?? 0) + 1);
  return supply;
}

export type LimitedValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    deckSize: number;
    units: number;
    equipment: number;
    artifacts: number;
    byFaction: Record<string, number>;
  };
};

/**
 * Validate a LIMITED deck against the opened pool. This is additive and, by
 * design, STRICTER than constructed on the dimension that defines limited play:
 * every card must have been opened (you can't run more copies than you pulled).
 * The deck is still a full constructed-legal 30 with the constructed copy cap, so
 * a limited-legal deck is ALSO constructed-legal and flows through the unchanged
 * match-start. Limited never relaxes any constructed rule — it only ADDS the
 * "must come from your opened pool" restriction on top.
 */
export function validateLimitedDeck(
  deck: string[],
  pool: SealedPool
): LimitedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const supply = poolSupply(pool);

  const counts = new Map<string, number>();
  let units = 0;
  let equipment = 0;
  let artifacts = 0;
  const byFaction = new Map<string, number>();

  for (const id of deck) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const card = getPlayableCardById(id);
    if (!card) {
      errors.push(`Card ${id} is not a real curated card`);
      continue;
    }
    if (!supply.has(id)) {
      errors.push(`Card ${id} (${card.name}) is not in your opened pool`);
      continue;
    }
    if (card.type === "unit") units += 1;
    else if (card.type === "equipment") equipment += 1;
    else if (card.type === "artifact") artifacts += 1;
    byFaction.set(card.faction, (byFaction.get(card.faction) ?? 0) + 1);
  }

  // Copy cap = min(what you opened, constructed cap). Can't field more copies of a
  // card than you pulled, and never above the constructed cap — so the deck stays
  // constructed-legal too.
  for (const [id, n] of counts.entries()) {
    const have = supply.get(id) ?? 0;
    if (have > 0 && n > have) {
      errors.push(`Card ${id} used ${n}× but only ${have} opened in your pool`);
    }
    if (n > LIMITED_MAX_COPIES) {
      errors.push(`Card ${id} used ${n}× (max ${LIMITED_MAX_COPIES} copies)`);
    }
  }

  if (deck.length !== LIMITED_MIN_DECK) {
    errors.push(
      `Limited deck must have exactly ${LIMITED_MIN_DECK} cards (have ${deck.length})`
    );
  }
  if (units < 1) {
    errors.push("Limited deck needs at least 1 unit (a body to play)");
  }
  if (equipment > LIMITED_MAX_EQUIPMENT) {
    errors.push(`Too much equipment: ${equipment} (max ${LIMITED_MAX_EQUIPMENT})`);
  }
  if (artifacts > LIMITED_MAX_ARTIFACTS) {
    errors.push(`Too many artifacts: ${artifacts} (max ${LIMITED_MAX_ARTIFACTS})`);
  }
  if (units > 0 && units < 12) {
    warnings.push(`Light on units (${units}); 16+ makes for a steadier curve`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      deckSize: deck.length,
      units,
      equipment,
      artifacts,
      byFaction: Object.fromEntries(byFaction),
    },
  };
}

/**
 * Deterministically assemble a constructed-legal 30-card limited deck from a pool.
 * Greedy: units first (cheapest-first for a curve), then a few equipment, then a
 * couple of artifacts — capped to LIMITED_MAX_EQUIPMENT / LIMITED_MAX_ARTIFACTS.
 * Pure helper shared by the proof and offered as the UI's "auto-build" seed.
 */
export function buildLimitedDeckFromPool(pool: SealedPool): string[] {
  const byCurve = (a: SealedPoolCard, b: SealedPoolCard) =>
    a.cost - b.cost || a.id.localeCompare(b.id);
  const units = pool.cards.filter((c) => c.type === "unit").sort(byCurve);
  const equipment = pool.cards.filter((c) => c.type === "equipment").sort(byCurve);
  const artifacts = pool.cards.filter((c) => c.type === "artifact").sort(byCurve);

  const deck: string[] = [];
  const targetEquip = Math.min(4, equipment.length, LIMITED_MAX_EQUIPMENT);
  const targetArti = Math.min(2, artifacts.length, LIMITED_MAX_ARTIFACTS);
  const targetUnits = LIMITED_MAX_DECK - targetEquip - targetArti;

  for (const c of units.slice(0, targetUnits)) deck.push(c.id);
  for (const c of equipment.slice(0, targetEquip)) deck.push(c.id);
  for (const c of artifacts.slice(0, targetArti)) deck.push(c.id);

  // Backfill from any remaining pool cards if the pool was unit-light.
  if (deck.length < LIMITED_MAX_DECK) {
    for (const c of pool.cards) {
      if (deck.length >= LIMITED_MAX_DECK) break;
      if (!deck.includes(c.id)) deck.push(c.id);
    }
  }
  return deck.slice(0, LIMITED_MAX_DECK);
}

/** Curated commander ids, sorted — deterministic selection space. */
const CURATED_COMMANDER_IDS = Object.keys(COMMANDER_SPECS).sort();

/** Map a faction enum to the curated commander of that faction, if one exists. */
const COMMANDER_BY_FACTION: Record<string, string> = {
  STONE_KEEPERS: "cmd_stone_warden",
  IRON_DEFENDERS: "cmd_iron_warlord",
  BRONZE_GUARDIANS: "cmd_bronze_raider",
  SILVER_SENTINELS: "cmd_silver_oracle",
  GOLDEN_SOVEREIGNS: "cmd_golden_emperor",
};

/**
 * Pick the limited deck's commander: the curated commander whose faction is the
 * deck's dominant (most-represented) non-GODS faction. Deterministic — ties break
 * on the faction enum string, then falls back to the first curated commander.
 * This binds the limited deck to the SAME commander-driven match-start the
 * constructed path uses.
 */
export function pickLimitedCommander(deck: string[]): string {
  const counts = new Map<string, number>();
  for (const id of deck) {
    const card = getPlayableCardById(id);
    if (!card || card.faction === "GODS") continue;
    counts.set(card.faction, (counts.get(card.faction) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = -1;
  for (const [f, n] of [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    if (n > bestN) {
      best = f;
      bestN = n;
    }
  }
  if (best && COMMANDER_BY_FACTION[best]) return COMMANDER_BY_FACTION[best];
  return CURATED_COMMANDER_IDS[0] ?? "cmd_stone_warden";
}
