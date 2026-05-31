import { buildCommanderFlavor } from "../../lore/buildFlavorText";
import { buildCommanderIdentity } from "./buildCommanderIdentity";

export function buildEntityExplanation(input: {
  commanderName: string;
  commanderFaction?: string | null;
  commanderTraits?: Record<string, string>;
  modifier?: any;
}) {
  const commander = buildCommanderFlavor({
    name: input.commanderName,
    faction: input.commanderFaction,
    traits: input.commanderTraits,
    reasons: input.modifier?.audit?.reasons ?? [],
    exactTraitMatches: input.modifier?.audit?.exactTraitMatches ?? [],
    categoryMatches: input.modifier?.audit?.categoryMatches ?? []
  });

  const identity = buildCommanderIdentity({
    name: input.commanderName,
    traits: input.commanderTraits,
    reasons: input.modifier?.audit?.reasons ?? []
  });

  return {
    headline: commander.headline,
    doctrine: commander.doctrine,
    battleCallout: commander.battleCallout,
    explanation: commander.explanation,
    identity
  };
}
