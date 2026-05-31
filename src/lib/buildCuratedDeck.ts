import cardMaster from "../data/cardMaster.json";
import curatedCoreSetV2 from "../data/curatedCoreSetV2.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { isCardDisabled } from "../engine/cards";
import { liveSpells } from "../engine/spellCards";
import { normalizeFaction } from "../types/faction";

/**
 * The PRIMARY (curated/known-good) card-id set — the ~98 cards hand-balanced by
 * the V2 core-set builder (scripts/buildCuratedCoreSetV2.cjs), tagged `isPrimary`.
 * The default deck builder draws from THIS clean set first and only falls back to
 * the full noisy corpus when a faction can't fill its curve from primaries.
 * `sourceCardId` is the canonical "tcg_<token>" id (cardMaster.json id space).
 */
const PRIMARY_CARD_IDS: ReadonlySet<string> = new Set(
  (curatedCoreSetV2 as { primaryCardIds?: string[] }).primaryCardIds ?? []
);

/** A big additive score bump so primaries sort ahead of equivalent corpus cards. */
const PRIMARY_BONUS = 1000;

type Card = {
  id: string;
  collection: "OG_SKULL" | "AVATAR_TCG";
  cardType: "unit" | "equipment" | "artifact" | "commander";
  faction?: string | null;
  rarity?: string | null;
  gameStats?: {
    cost?: number | null;
    keywords?: string[];
  };
};

const MAX_COPIES = 2;

/**
 * Spell deck-legality (#10). `liveSpells` are engine-legal (merged into
 * allPlayableCards, resolved by PLAY_SPELL) but were deliberately kept out of the
 * deck builder. We now draft a SMALL, capped number of SAFE-tier spells into the
 * flex slots that sit ABOVE a commander's unit/equipment/artifact minimums, so
 * the unit core is never starved and the deck stays the same size. Only "safe"
 * spells are ever eligible — no removal/face-burn spell can be auto-drafted.
 */
const MAX_SPELLS_PER_DECK = 6;

/** Faction enum -> id list of safe live spells of that faction (deterministic). */
const SAFE_SPELLS = liveSpells
  .filter((s) => (s as { tier?: string }).tier === "safe")
  .slice()
  .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.id.localeCompare(b.id));

/** The faction (enum) most represented among the drafted non-spell cards. Used
 *  to bias spell selection toward the deck's identity. Deterministic: ties break
 *  on the enum string. Returns null when the deck has no factioned cards. */
function dominantFaction(cardIds: string[], factionOf: Map<string, string>): string | null {
  const counts = new Map<string, number>();
  for (const id of cardIds) {
    const f = factionOf.get(id);
    if (!f) continue;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = -1;
  for (const [f, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = f;
      bestN = n;
    }
  }
  return best;
}

/** Pick up to `count` safe spell ids, preferring spells matching `dominant`,
 *  then cheapest, then id — all deterministic. */
function selectSafeSpells(count: number, dominant: string | null): string[] {
  if (count <= 0) return [];
  const ranked = SAFE_SPELLS.slice().sort((a, b) => {
    const am = dominant && a.faction === dominant ? 0 : 1;
    const bm = dominant && b.faction === dominant ? 0 : 1;
    if (am !== bm) return am - bm;
    return (a.cost ?? 0) - (b.cost ?? 0) || a.id.localeCompare(b.id);
  });
  return ranked.slice(0, count).map((s) => s.id);
}

function rarityScore(rarity: string): number {
  switch (rarity) {
    case "god": return 8;
    case "one_of_one": return 7;
    case "legendary": return 6;
    case "epic": return 5;
    case "rare": return 4;
    case "uncommon": return 3;
    default: return 2;
  }
}

function keywordScore(card: Card): number {
  const keywords = card.gameStats?.keywords || [];
  let score = 0;

  for (const kw of keywords) {
    if (kw === "GUARD") score += 2;
    else if (kw === "ARCANE") score += 2;
    else if (kw === "CRUSH") score += 1.5;
    else if (kw === "RUSH") score += 1;
    else score += 1;
  }

  return score;
}

function cheapUnitPenalty(card: Card): number {
  if (card.cardType !== "unit") return 0;
  if ((card.gameStats?.cost ?? 0) !== 2) return 0;

  const kw = (card.gameStats?.keywords || []).length;
  return 6 + kw * 2;
}

function curveScore(card: Card): number {
  if (card.cardType !== "unit") return 0;

  switch (card.gameStats?.cost ?? 0) {
    case 2: return 0;
    case 3: return 3;
    case 4: return 4;
    case 5: return 3;
    default: return 0;
  }
}

function factionBonus(card: Card, faction: string): number {
  const keywords = card.gameStats?.keywords || [];
  let score = 0;

  if (faction === "STONE") {
    if (keywords.includes("GUARD")) score += 3;
    if (card.cardType === "artifact") score += 1;
  }

  if (faction === "SILVER") {
    if (keywords.includes("ARCANE")) score += 3;
    if (card.cardType === "equipment") score += 1;
  }

  if (faction === "BRONZE") {
    if (keywords.includes("RUSH")) score += 2;
    if ((card.gameStats?.cost ?? 0) <= 3) score += 1;
  }

  if (faction === "IRON") {
    if (keywords.includes("CRUSH")) score += 2;
    if (card.cardType === "unit" && (card.gameStats?.cost ?? 0) >= 4) score += 1;
  }

  if (faction === "GOLD") {
    if ((card.rarity ?? "") === "legendary") score += 2;
    if ((card.rarity ?? "") === "epic") score += 1;
  }

  return score;
}

function cardScore(card: Card, faction: string): number {
  return (
    rarityScore(card.rarity ?? "common") +
    keywordScore(card) +
    curveScore(card) +
    factionBonus(card, faction) -
    cheapUnitPenalty(card) +
    // Default to the curated/known-good (PRIMARY) set: any primary card outranks
    // every non-primary corpus card of the same faction, so curated cards are
    // chosen first and the noisy corpus is only a backfill.
    (PRIMARY_CARD_IDS.has(card.id) ? PRIMARY_BONUS : 0)
  );
}

export function buildCuratedDeck(commanderId: string): string[] {
  const spec = COMMANDER_SPECS[commanderId as keyof typeof COMMANDER_SPECS];

  if (!spec) {
    throw new Error(`Unknown commander: ${commanderId}`);
  }

  const faction = spec.faction;
  const deckSize = spec.deckRules.deckSize;
  const maxGodCards = spec.deckRules.maxGodCards ?? 0;

  // Reserve spell slots from the FLEX above the unit/equipment/artifact minimums,
  // so the non-spell core is drafted to `nonSpellTarget` and never starved.
  const rules = spec.deckRules;
  const minNonSpell =
    (rules.minUnits ?? 0) + (rules.minEquipment ?? 0) + (rules.minArtifacts ?? 0);
  const spellSlots = Math.max(0, Math.min(MAX_SPELLS_PER_DECK, deckSize - minNonSpell));
  const nonSpellTarget = deckSize - spellSlots;

  const allCards = (cardMaster as Card[]).filter((card) => {
    if (card.collection !== "AVATAR_TCG") return false;
    if (!["unit", "equipment", "artifact"].includes(card.cardType)) return false;
    if (!card.id) return false;
    // Never draft a soft-banned (disabled) card — keeps the default deck legal.
    if (isCardDisabled(card.id)) return false;

    return card.faction === faction;
  });

  const ranked = [...allCards].sort((a, b) => {
    const scoreDiff = cardScore(b, faction) - cardScore(a, faction);
    if (scoreDiff !== 0) return scoreDiff;

    const costDiff = (a.gameStats?.cost ?? 0) - (b.gameStats?.cost ?? 0);
    if (costDiff !== 0) return costDiff;

    return a.id.localeCompare(b.id);
  });

  const deck: string[] = [];
  let godCount = 0;

  for (const card of ranked) {
    const copies = deck.filter((id) => id === card.id).length;
    if (copies >= MAX_COPIES) continue;

    const rarity = card.rarity ?? "common";
    if ((rarity === "god" || rarity === "one_of_one") && godCount >= maxGodCards) {
      continue;
    }

    deck.push(card.id);

    if (rarity === "god" || rarity === "one_of_one") {
      godCount += 1;
    }

    if (deck.length >= nonSpellTarget) break;
  }

  if (deck.length < nonSpellTarget) {
    const fallback = (cardMaster as Card[]).filter((card) => {
      if (card.collection !== "AVATAR_TCG") return false;
      if (!["unit", "equipment", "artifact"].includes(card.cardType)) return false;
      if (!card.id) return false;
      if (isCardDisabled(card.id)) return false;
      return true;
    });

    const rankedFallback = [...fallback].sort((a, b) => {
      const scoreDiff = cardScore(b, faction) - cardScore(a, faction);
      if (scoreDiff !== 0) return scoreDiff;
      return a.id.localeCompare(b.id);
    });

    for (const card of rankedFallback) {
      const copies = deck.filter((id) => id === card.id).length;
      if (copies >= MAX_COPIES) continue;

      const rarity = card.rarity ?? "common";
      if ((rarity === "god" || rarity === "one_of_one") && godCount >= maxGodCards) {
        continue;
      }

      deck.push(card.id);

      if (rarity === "god" || rarity === "one_of_one") {
        godCount += 1;
      }

      if (deck.length >= nonSpellTarget) break;
    }
  }

  // Append the reserved spell slots: a small, deterministic set of SAFE spells,
  // biased toward the deck's dominant faction for identity. Spells are
  // engine-legal (allPlayableCards / PLAY_SPELL) and "safe" tier only.
  const factionOf = new Map<string, string>();
  for (const c of cardMaster as Card[]) {
    if (!c.id || !c.faction) continue;
    const f = normalizeFaction(c.faction);
    if (f) factionOf.set(c.id, f);
  }
  const dominant = dominantFaction(deck.slice(0, nonSpellTarget), factionOf);
  const spells = selectSafeSpells(spellSlots, dominant);

  return [...deck.slice(0, nonSpellTarget), ...spells].slice(0, deckSize);
}
