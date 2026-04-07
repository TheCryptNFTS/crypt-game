import { allPlayableCards } from "../engine/cards";

type CardType = "unit" | "equipment" | "artifact";

function uniqueIds(cards: { id: string }[]) {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function fillDeck(seed: string[], size = 30) {
  const picked = [...seed];
  for (const card of uniqueIds(allPlayableCards)) {
    if (picked.length >= size) break;
    if (!picked.includes(card.id)) picked.push(card.id);
  }
  if (picked.length !== size) {
    throw new Error(`Deck build failed. Expected ${size}, got ${picked.length}`);
  }
  return picked;
}

function exactMatchCount(commanderTraits: Record<string, string>, cardTraits: Record<string, string>) {
  return Object.entries(cardTraits).filter(([k, v]) => commanderTraits[k] && commanderTraits[k] === v).length;
}

function sharedCategoryCount(commanderTraits: Record<string, string>, cardTraits: Record<string, string>) {
  return Object.keys(cardTraits).filter((k) => commanderTraits[k]).length;
}

export function buildProofDeck(required: CardType[], size = 30): string[] {
  const picked: string[] = [];

  for (const type of required) {
    const found = allPlayableCards.find((c) => c.type === type && !picked.includes(c.id));
    if (!found) {
      throw new Error(`Could not find required card type: ${type}`);
    }
    picked.push(found.id);
  }

  return fillDeck(picked, size);
}

export function buildExactTraitProofDeck(
  commanderTraits: Record<string, string>,
  size = 30
): string[] {
  const exactMatches = allPlayableCards.filter((card) => {
    const traits = card.rawTraits ?? {};
    return exactMatchCount(commanderTraits, traits) > 0;
  });

  const picked = uniqueIds(exactMatches).slice(0, 10).map((c) => c.id);
  return fillDeck(picked, size);
}

export function buildArmorUtilityProofDeck(
  commanderTraits: Record<string, string>,
  size = 30
): string[] {
  const exactUnit = allPlayableCards.find(
    (c) => c.type === "unit" && exactMatchCount(commanderTraits, c.rawTraits ?? {}) > 0
  );

  const armoredUnit = allPlayableCards.find(
    (c) =>
      c.type === "unit" &&
      c.id !== exactUnit?.id &&
      (((c.stats?.armor ?? 0) > 0) || /armor|plate|shield|mail|buckler|gauntlets/i.test(JSON.stringify(c.rawTraits ?? {})))
  );

  const picked = [exactUnit?.id, armoredUnit?.id].filter(Boolean) as string[];
  return fillDeck(picked, size);
}

export function buildNoMatchBaselineDeck(
  commanderTraits: Record<string, string>,
  size = 30
): string[] {
  const noMatchUnits = allPlayableCards.filter((c) => {
    if (c.type !== "unit") return false;
    const traits = c.rawTraits ?? {};
    return exactMatchCount(commanderTraits, traits) === 0 && sharedCategoryCount(commanderTraits, traits) === 0;
  });

  const picked = uniqueIds(noMatchUnits).slice(0, 10).map((c) => c.id);
  return fillDeck(picked, size);
}

export function buildLegendaryProofDeck(size = 30): string[] {
  const picked = allPlayableCards
    .filter((c) => c.type === "unit")
    .slice(0, 10)
    .map((c) => c.id);

  return fillDeck(picked, size);
}

export function buildOneOfOneProofDeck(size = 30): string[] {
  const picked = allPlayableCards
    .filter((c) => c.type === "unit")
    .slice(0, 10)
    .map((c) => c.id);

  return fillDeck(picked, size);
}
