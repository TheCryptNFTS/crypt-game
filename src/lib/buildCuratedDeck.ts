import cardMaster from "../data/cardMaster.json";
import curatedCoreSetV2 from "../data/curatedCoreSetV2.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { isCardDisabled } from "../engine/cards";

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

    if (deck.length >= deckSize) break;
  }

  if (deck.length < deckSize) {
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

      if (deck.length >= deckSize) break;
    }
  }

  return deck.slice(0, deckSize);
}
