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

export function buildProofDeck(required: CardType[], size = 30): string[] {
  const picked: string[] = [];

  for (const type of required) {
    const found = allPlayableCards.find((c) => c.type === type && !picked.includes(c.id));
    if (!found) {
      throw new Error(`Could not find required card type: ${type}`);
    }
    picked.push(found.id);
  }

  for (const card of uniqueIds(allPlayableCards)) {
    if (picked.length >= size) break;
    if (!picked.includes(card.id)) picked.push(card.id);
  }

  if (picked.length !== size) {
    throw new Error(`Proof deck build failed. Expected ${size}, got ${picked.length}`);
  }

  return picked;
}

export function buildExactTraitProofDeck(
  commanderTraits: Record<string, string>,
  size = 30
): string[] {
  const exactMatches = allPlayableCards.filter((card) => {
    const traits = card.rawTraits ?? {};
    return Object.entries(traits).some(([k, v]) => commanderTraits[k] && commanderTraits[k] === v);
  });

  const picked = uniqueIds(exactMatches).slice(0, 10).map((c) => c.id);

  for (const card of uniqueIds(allPlayableCards)) {
    if (picked.length >= size) break;
    if (!picked.includes(card.id)) picked.push(card.id);
  }

  if (picked.length !== size) {
    throw new Error(`Exact trait proof deck build failed. Expected ${size}, got ${picked.length}`);
  }

  return picked;
}

export function buildArmorProofDeck(size = 30): string[] {
  const armoredUnit = allPlayableCards.find(
    (c) => c.type === "unit" && ((c.stats?.armor ?? 0) > 0 || /armor|plate|shield|mail/i.test(JSON.stringify(c.rawTraits ?? {})))
  );
  const exactUnit = allPlayableCards.find(
    (c) => c.type === "unit" && Object.values(c.rawTraits ?? {}).includes("Smoke Bomb")
  );

  const picked: string[] = [];
  if (exactUnit) picked.push(exactUnit.id);
  if (armoredUnit && !picked.includes(armoredUnit.id)) picked.push(armoredUnit.id);

  for (const card of uniqueIds(allPlayableCards)) {
    if (picked.length >= size) break;
    if (!picked.includes(card.id)) picked.push(card.id);
  }

  if (picked.length !== size) {
    throw new Error(`Armor proof deck build failed. Expected ${size}, got ${picked.length}`);
  }

  return picked;
}
