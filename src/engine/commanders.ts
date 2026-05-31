import commandersJson from "../data/commanders.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { GENERATED_COMMANDER_SPECS } from "../design/generatedCommanderSpecs";
import { Faction } from "../types/faction";

export type CommanderDefinition = {
  id: string;
  tokenId: string | null;
  name: string;
  faction: Faction | null;
  traits: Record<string, string>;
  deckRules: {
    deckSize: number;
    exactFaction: boolean;
    maxGodCards: number;
    minUnits: number;
    minEquipment: number;
    minArtifacts: number;
  };
};

type RawCommander = {
  id: string;
  name?: string;
  faction?: string;
};

const rawById = new Map<string, RawCommander>(
  (commandersJson as RawCommander[]).map((card) => [card.id, card])
);

/**
 * Generated commanders come from the NFT dump (numeric ids like `cmd_6665`).
 * They carry tokenId + traits but no hand-authored passives.
 */
const generatedCommanders: CommanderDefinition[] = Object.values(GENERATED_COMMANDER_SPECS).map(
  (spec) => ({
    id: spec.id,
    tokenId: spec.tokenId,
    name: spec.name,
    faction: null,
    traits: spec.traits ?? {},
    deckRules: {
      deckSize: spec.deckRules.deckSize,
      exactFaction: spec.deckRules.exactFaction,
      maxGodCards: spec.deckRules.maxGodCards,
      minUnits: spec.deckRules.minUnits,
      minEquipment: spec.deckRules.minEquipment,
      minArtifacts: spec.deckRules.minArtifacts,
    },
  })
);

/**
 * Curated commanders are the hand-authored design (ids like `cmd_stone_warden`).
 * COMMANDER_SPECS is the source of deckRules; names are enriched from
 * commanders.json when present. These are the ids used by the deck data,
 * registry, and dev proofs, so they must remain resolvable.
 */
const curatedCommanders: CommanderDefinition[] = Object.entries(COMMANDER_SPECS).map(
  ([id, spec]) => ({
    id,
    tokenId: null,
    name: rawById.get(id)?.name ?? spec.name ?? id,
    faction: null,
    traits: {},
    deckRules: {
      deckSize: spec.deckRules.deckSize,
      exactFaction: spec.deckRules.exactFaction,
      maxGodCards: spec.deckRules.maxGodCards,
      minUnits: spec.deckRules.minUnits,
      minEquipment: spec.deckRules.minEquipment,
      minArtifacts: spec.deckRules.minArtifacts,
    },
  })
);

/**
 * Resolver is total over BOTH id namespaces. Curated (alphabetic) and
 * generated (numeric) ids do not collide, so the merge is order-independent;
 * curated takes precedence to preserve the hand-authored design.
 */
const byId = new Map<string, CommanderDefinition>([
  ...generatedCommanders.map((c) => [c.id, c] as const),
  ...curatedCommanders.map((c) => [c.id, c] as const),
]);

export const allCommanders: CommanderDefinition[] = Array.from(byId.values());

export function getCommanderById(id: string): CommanderDefinition {
  const commander = byId.get(id);
  if (!commander) {
    throw new Error(`Unknown commander: ${id}`);
  }
  return commander;
}
