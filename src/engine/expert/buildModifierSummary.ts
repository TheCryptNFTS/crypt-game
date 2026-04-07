function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function buildModifierSummary(entity: any) {
  const commander = entity?.modifiers?.commander ?? null;
  const equipment = Array.isArray(entity?.modifiers?.equipment) ? entity.modifiers.equipment : [];

  return {
    stats: {
      attack: num(entity?.attack),
      health: num(entity?.health),
      maxHealth: num(entity?.maxHealth),
      armor: num(entity?.armor),
      speed: num(entity?.speed),
      crit: num(entity?.crit),
      utility: num(entity?.utility),
    },
    commanderTags: Array.isArray(entity?.commanderTags) ? entity.commanderTags : [],
    passives: Array.isArray(entity?.passives) ? entity.passives : [],
    modifierSources: {
      commander,
      equipment,
    },
  };
}
