import { getAllLoadedUnits } from "../data/loadAllUnits";
import { getAllLoadedEquipment } from "../data/loadAllEquipment";
import { getAllLoadedArtifacts } from "../data/loadAllArtifacts";
import { inferCommanderFaction, validateDeck } from "../engine/deckRules";

type AnyCard = any;

function rarityScore(rarity: string): number {
  const r = String(rarity || "").toLowerCase();
  if (r === "one_of_one") return 7;
  if (r === "god") return 6;
  if (r === "legendary") return 5;
  if (r === "epic") return 4;
  if (r === "rare") return 3;
  if (r === "uncommon") return 2;
  return 1;
}

function sortCards(cards: AnyCard[]): AnyCard[] {
  return [...cards].sort((a, b) => {
    const byCost = (a.cost || 0) - (b.cost || 0);
    if (byCost !== 0) return byCost;

    const byRarity = rarityScore(b.rarity) - rarityScore(a.rarity);
    if (byRarity !== 0) return byRarity;

    return String(a.id).localeCompare(String(b.id));
  });
}

function pickUnits(units: AnyCard[]): AnyCard[] {
  const sorted = sortCards(units);

  const twos = sorted.filter((u) => u.cost === 2).slice(0, 8);
  const threes = sorted.filter((u) => u.cost === 3).slice(0, 6);
  const fours = sorted.filter((u) => u.cost === 4).slice(0, 4);
  const fivesPlus = sorted.filter((u) => (u.cost || 0) >= 5).slice(0, 2);

  return [...twos, ...threes, ...fours, ...fivesPlus];
}

function pickEquipment(cards: AnyCard[]): AnyCard[] {
  return sortCards(cards).slice(0, 6);
}

function pickArtifacts(cards: AnyCard[]): AnyCard[] {
  return sortCards(cards).slice(0, 4);
}

export function buildGeneratedTcgDeck(commanderId: string): string[] {
  const faction = inferCommanderFaction(commanderId);

  const units = getAllLoadedUnits().filter(
    (card: any) =>
      String(card.id).startsWith("tcg_unit_") &&
      (card.faction === faction || card.faction === "GOD")
  );

  const equipment = getAllLoadedEquipment().filter(
    (card: any) =>
      String(card.id).startsWith("tcg_eq_") &&
      (card.faction === faction || card.faction === "GOD")
  );

  const artifacts = getAllLoadedArtifacts().filter(
    (card: any) =>
      String(card.id).startsWith("tcg_art_") &&
      (card.faction === faction || card.faction === "GOD")
  );

  const chosenUnits = pickUnits(units);
  const chosenEquipment = pickEquipment(equipment);
  const chosenArtifacts = pickArtifacts(artifacts);

  let deck = [
    ...chosenUnits.map((c) => c.id),
    ...chosenEquipment.map((c) => c.id),
    ...chosenArtifacts.map((c) => c.id)
  ];

  const fallbackPool = sortCards([
    ...units,
    ...equipment,
    ...artifacts
  ]).filter((c) => !deck.includes(c.id));

  while (deck.length < 30 && fallbackPool.length > 0) {
    const next = fallbackPool.shift();
    if (next) deck.push(next.id);
  }

  deck = deck.slice(0, 30);

  const validation = validateDeck(deck, commanderId);

  if (!validation.valid) {
    throw new Error(
      `Generated deck is invalid for ${commanderId}:\n${validation.errors.join("\n")}`
    );
  }

  return deck;
}
