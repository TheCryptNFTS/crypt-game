export type CommanderCardSynergyResult = {
  matched: boolean;
  exactTraitMatches: string[];
  categoryMatches: string[];
  nameMatch: boolean;
  factionMatch: boolean;
  bonus: {
    attack?: number;
    health?: number;
    armor?: number;
    crit?: number;
    speed?: number;
    utility?: number;
  };
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function addBonus(
  base: CommanderCardSynergyResult["bonus"],
  extra: CommanderCardSynergyResult["bonus"]
) {
  for (const key of Object.keys(extra) as (keyof typeof extra)[]) {
    base[key] = (base[key] ?? 0) + (extra[key] ?? 0);
  }
}

export function getCommanderCardSynergy(
  commanderName: string,
  cardName: string,
  cardTraits: Record<string, string> = {},
  cardFaction?: string | null,
  commanderTraits: Record<string, string> = {}
): CommanderCardSynergyResult {
  const result: CommanderCardSynergyResult = {
    matched: false,
    exactTraitMatches: [],
    categoryMatches: [],
    nameMatch: false,
    factionMatch: false,
    bonus: {},
  };

  for (const [category, cardValue] of Object.entries(cardTraits)) {
    const commanderValue = commanderTraits[category];
    if (!commanderValue) continue;

    if (normalize(commanderValue) === normalize(cardValue)) {
      result.matched = true;
      result.exactTraitMatches.push(`${category}:${cardValue}`);
      addBonus(result.bonus, { attack: 1, utility: 1 });
    } else {
      result.matched = true;
      result.categoryMatches.push(category);
      addBonus(result.bonus, { utility: 1 });
    }
  }

  const commanderNameNorm = normalize(commanderName);
  const cardNameNorm = normalize(cardName);

  if (
    commanderNameNorm &&
    cardNameNorm &&
    (cardNameNorm.includes(commanderNameNorm) || commanderNameNorm.includes(cardNameNorm))
  ) {
    result.matched = true;
    result.nameMatch = true;
    addBonus(result.bonus, { attack: 1, health: 1, utility: 1 });
  }

  const commanderFaction = normalize((commanderTraits as any).Faction);
  const normalizedCardFaction = normalize(cardFaction);

  if (commanderFaction && normalizedCardFaction && commanderFaction === normalizedCardFaction) {
    result.matched = true;
    result.factionMatch = true;
    addBonus(result.bonus, { health: 1, utility: 1 });
  }

  return result;
}
