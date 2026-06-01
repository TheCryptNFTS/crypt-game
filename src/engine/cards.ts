import runtimeMatchPlayableCards from "../data/runtimeMatchPlayableCards.json";
import generatedTcgCards from "../data/generatedTcgCards.json";
import commanders from "../data/commanders.json";
import { normalizeFaction, Faction } from "../types/faction";
import { applyCardOverride } from "./cardOverrides";
import { liveSpells } from "./spellCards";
import { ENABLE_ENRICHMENT, enrichmentSpecsFor } from "./abilityEnrichment";
import type { EffectSpec } from "./abilityCompiler";

export type CardType = "unit" | "equipment" | "artifact" | "spell";

export type PlayableCard = {
  id: string;
  name: string;
  type: CardType;
  faction: Faction;
  rarity: string;
  cost: number;
  stats: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  keywords: string[];
  rawTraits: Record<string, string>;
  effectTags: string[];
  sourceCardClass: string | null;
  sourceSubtype: string | null;
  /**
   * Soft-ban flag set by the balance-patch override layer (`cardOverrides.ts`).
   * The card stays in the catalog (count audits unaffected) but is excluded from
   * deck legality. Absent/false on every un-overridden card.
   */
  disabled?: boolean;
  /**
   * Off-chain, FLAG-GATED "raise the floor" enrichment (`abilityEnrichment.ts`).
   * When `ENABLE_ENRICHMENT` is true, vanilla (zero-runtime-op) commons of the
   * enrichment-slice factions carry a small, derived EffectSpec set here, which
   * the reducer's `compiledFor` MERGES onto the card's (empty) authored specs.
   * ABSENT on every card when the flag is OFF (default) — so the compiled IR, and
   * therefore the reducer-equivalence golden, is byte-identical to today. Never
   * present on a card whose authored ability already emits a runtime op.
   */
  enrichmentSpecs?: EffectSpec[];
};

export type CommanderCard = {
  id: string;
  name: string;
  faction: Faction | null;
};

type RuntimePlayableTuple = [
  id: string,
  type: CardType,
  cost?: number,
  attack?: number,
  health?: number,
  speed?: number,
  armor?: number,
  keywords?: string[]
];

type RawCommanderCard = {
  id: string;
  name?: string;
  faction?: string | null;
};

type GeneratedTcgCard = {
  id: string;
  name?: string;
  faction?: string;
  rarity?: string;
  cardClass?: string | null;
  subtype?: string | null;
  rawTraits?: Record<string, string> | null;
  traits?: Record<string, string> | null;
};

function normalizeCardType(runtimeType: CardType, generated?: GeneratedTcgCard): CardType {
  const cardClass = String(generated?.cardClass ?? "").trim().toLowerCase();
  const subtype = String(generated?.subtype ?? "").trim().toLowerCase();

  if (cardClass === "equipment") return "equipment";
  if (cardClass === "artifact") return "artifact";

  if (
    cardClass === "character" ||
    cardClass === "creature" ||
    cardClass === "unit" ||
    subtype === "character" ||
    subtype === "creature" ||
    subtype === "unit"
  ) {
    return "unit";
  }

  return runtimeType;
}

const generatedAll = (generatedTcgCards as GeneratedTcgCard[]) ?? [];
const generatedById = new Map<string, GeneratedTcgCard>(
  generatedAll.map((card) => [card.id, card])
);

function withCommanderType(raw: RawCommanderCard): CommanderCard {
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    faction: raw.faction ? normalizeFaction(String(raw.faction)) : null,
  };
}

function withPlayableType([
  id,
  type,
  cost,
  attack,
  health,
  speed,
  armor,
  keywords,
]: RuntimePlayableTuple): PlayableCard {
  const generated = generatedById.get(id);
  const resolvedType = normalizeCardType(type, generated);

  return {
    id,
    name: generated?.name ?? id,
    type: resolvedType,
    faction: normalizeFaction(generated?.faction ?? "STONE_KEEPERS"),
    rarity: generated?.rarity ?? "COMMON",
    cost: cost ?? 0,
    stats: {
      attack: attack ?? 0,
      health: health ?? 1,
      speed: speed ?? 0,
      armor: armor ?? 0,
    },
    keywords: Array.isArray(keywords) ? keywords : [],
    rawTraits:
      (generated?.rawTraits as Record<string, string> | undefined) ??
      (generated?.traits as Record<string, string> | undefined) ??
      {},
    effectTags: [],
    sourceCardClass: generated?.cardClass ?? null,
    sourceSubtype: generated?.subtype ?? null,
  };
}

export const allCommanderCards: CommanderCard[] = (commanders as RawCommanderCard[]).map(withCommanderType);

/**
 * RAISE-THE-FLOOR ENRICHMENT SEAM (flag-gated, reversible).
 *
 * After the override pass, derive an off-chain enrichment EffectSpec set for the
 * card and, if non-empty, STAMP it on a CLONE (never mutate the override output).
 * `enrichmentSpecsFor` is itself the gate: it returns [] unless the master flag is
 * ON, the card's faction is in the slice (Stone Keepers only, this drop), AND the
 * card is a true vanilla body. So with the flag OFF this is a per-card no-op that
 * returns the same object reference — the catalog is byte-identical to today.
 *
 * NOTE: this only ADDS an `enrichmentSpecs` field; it never changes the card's
 * name / cost / stats / keywords, and the authored `rawTraits.Ability` is left
 * untouched. The reducer reads `enrichmentSpecs` purely additively.
 */
function applyEnrichment(card: PlayableCard): PlayableCard {
  if (!ENABLE_ENRICHMENT) return card;
  const specs = enrichmentSpecsFor(card);
  if (specs.length === 0) return card;
  return { ...card, enrichmentSpecs: specs };
}

export const allPlayableCards: PlayableCard[] = [
  ...(runtimeMatchPlayableCards as RuntimePlayableTuple[])
    .map(withPlayableType)
    // Balance-patch spine: apply the versioned override layer at the single build
    // chokepoint, so the reducer's cardMetaById/costOf/cardTypeOf/compile path and
    // deck legality all inherit the patched catalog from one source of truth.
    // applyCardOverride clones-then-overrides, so the base objects are never mutated.
    .map(applyCardOverride)
    // RAISE-THE-FLOOR: stamp flag-gated, reversible enrichment onto vanilla commons
    // of the slice faction. A no-op (same reference) when the flag is OFF — keeping
    // the catalog and the reducer-equivalence golden byte-identical by default.
    .map(applyEnrichment),
  // LIVE SPELL ARCHETYPE: the first spell-type cards in the shipped catalog. They
  // are already PlayableCard-shaped (SpellCard extends PlayableCard) and carry no
  // override entries, so they are appended after the override pass. This is what
  // makes the SPELL category — and AURA_SPELL_COST cost reduction — exercisable
  // end-to-end through the same cardMetaById path real cards use. The unit-only
  // curated deck builders (cardMaster.json, filtered to unit/equipment/artifact)
  // never see these, so deck legality + count audits stay unaffected.
  ...liveSpells,
];

export const allCards: PlayableCard[] = allPlayableCards;

const playableCardIndex = new Map<string, PlayableCard>(
  allPlayableCards.map((card) => [card.id, card])
);

const commanderCardIndex = new Map<string, CommanderCard>(
  allCommanderCards.map((card) => [card.id, card])
);

export function getPlayableCardById(id: string): PlayableCard | null {
  return playableCardIndex.get(id) ?? null;
}

export function getCommanderCardById(id: string): CommanderCard | null {
  return commanderCardIndex.get(id) ?? null;
}

export function getAnyCardById(id: string): PlayableCard | CommanderCard | null {
  return getPlayableCardById(id) ?? getCommanderCardById(id);
}

export function isCommanderCardId(id: string): boolean {
  return commanderCardIndex.has(id);
}

/** True if a card is soft-banned (disabled) by the override layer. */
export function isCardDisabled(id: string): boolean {
  return getPlayableCardById(id)?.disabled === true;
}

/**
 * Shared soft-ban guard for ALL deck-construction paths. A disabled (soft-banned)
 * card must never enter a match. Throws a clear, consistent error on the first
 * disabled card found, matching the check already in createMatchFromDecks. Used by
 * createOwnedNftMatch and the sandbox createMatch so no path can smuggle one in.
 */
export function assertNoDisabledCards(deck: string[], label = "deck"): void {
  const banned = deck.find((id) => isCardDisabled(id));
  if (banned) {
    throw new Error(`${label} contains a disabled (soft-banned) card: ${banned}`);
  }
}
