import { FACTION_LORE, WORLD_LORE, COMMANDER_ROLE_HINTS } from "./loreBible";

function pick<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback;
}

export function buildCommanderFlavor(input: {
  name: string;
  faction: string | null | undefined;
  traits?: Record<string, string>;
  reasons?: string[];
  exactTraitMatches?: string[];
  categoryMatches?: string[];
}) {
  const traits = input.traits ?? {};
  const world = pick(WORLD_LORE, {
    id: "fallback",
    title: "The Crypt",
    summary: "Power survives collapse.",
    pillars: [],
    motifs: [],
    canonicalStatus: "working" as const
  });

  const factionLore = input.faction ? FACTION_LORE[input.faction] : undefined;
  const oneOfOne = traits["One of One"];
  const legendary = traits["Legendary"] === "Legendary";

  const headline = oneOfOne
    ? `${input.name} is a singular anomaly forged through collapse and rebirth.`
    : legendary
      ? `${input.name} carries prestige force and battlefield gravity.`
      : `${input.name} enters as a trait-bound commander shaped by survival, identity, and pressure.`;

  const doctrine = oneOfOne
    ? COMMANDER_ROLE_HINTS["One of One"]
    : legendary
      ? COMMANDER_ROLE_HINTS["Legendary"]
      : world.summary;

  const battleCallout = factionLore
    ? `${factionLore.title}: ${factionLore.summary}`
    : world.summary;

  const explanation = [
    ...((input.reasons ?? []).slice(0, 4)),
    ...((input.exactTraitMatches ?? []).slice(0, 2).map((x) => `Exact match: ${x}`)),
    ...((input.categoryMatches ?? []).slice(0, 2).map((x) => `Shared category: ${x}`))
  ];

  return {
    headline,
    doctrine,
    battleCallout,
    explanation
  };
}

export function buildCardFlavor(input: {
  faction: string | null | undefined;
  rawTraits?: Record<string, string>;
  type: string;
}) {
  const factionLore = input.faction ? FACTION_LORE[input.faction] : undefined;
  const traits = input.rawTraits ?? {};
  const dominantTrait = Object.entries(traits)[0];

  return {
    summary: factionLore
      ? `${input.type} aligned with ${factionLore.title.toLowerCase()} pressure.`
      : `${input.type} aligned with crypt pressure.`,
    traitHook: dominantTrait
      ? `${dominantTrait[0]}: ${dominantTrait[1]}`
      : "No dominant visible trait."
  };
}
