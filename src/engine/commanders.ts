import commanders from "../data/commanders.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { Faction, normalizeFaction } from "../types/faction";

type RawCommander = {
  id: string;
  name?: string;
  faction?: string;
};

export type CommanderDefinition = {
  id: string;
  name: string;
  faction: Faction;
  deckRules: {
    deckSize: number;
    exactFaction: boolean;
    maxGodCards: number;
    minUnits: number;
    minEquipment: number;
    minArtifacts: number;
  };
};

const raw = commanders as RawCommander[];
const rawById = new Map<string, RawCommander>(raw.map((card) => [card.id, card]));

/**
 * Runtime commander registry is driven by COMMANDER_SPECS.
 *
 * Why:
 * - COMMANDER_SPECS defines which commanders are actually supported by gameplay rules.
 * - commanders.json may contain legacy/incomplete/display-only entries.
 *
 * We enrich the runtime registry with names from commanders.json when available,
 * but we do NOT require commanders.json to contain every supported runtime commander.
 */
export const allCommanders: CommanderDefinition[] = Object.entries(COMMANDER_SPECS).map(
  ([id, spec]) => {
    const rawCard = rawById.get(id);

    return {
      id,
      name: rawCard?.name ?? spec.name ?? id,
      faction: normalizeFaction(String(spec.faction)),
      deckRules: {
        deckSize: spec.deckRules.deckSize,
        exactFaction: spec.deckRules.exactFaction,
        maxGodCards: spec.deckRules.maxGodCards,
        minUnits: spec.deckRules.minUnits,
        minEquipment: spec.deckRules.minEquipment,
        minArtifacts: spec.deckRules.minArtifacts,
      },
    };
  }
);

const byId = new Map<string, CommanderDefinition>(
  allCommanders.map((c) => [c.id, c])
);

export function getCommanderById(id: string): CommanderDefinition {
  const commander = byId.get(id);
  if (!commander) {
    throw new Error(
      `Unknown or unsupported commander: ${id}. Add it to COMMANDER_SPECS to enable it.`
    );
  }
  return commander;
}
