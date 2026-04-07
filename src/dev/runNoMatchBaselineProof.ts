import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { playUnitFromHand } from "../engine/setup";
import { buildNoMatchBaselineDeck } from "./buildProofDecks";
import { buildModifierSummary } from "../engine/expert/buildModifierSummary";

const commander = allCommanders.find((c) => c.name === "Crypt #6600") ?? allCommanders[0];
if (!commander) throw new Error("No commander found");

const deck = buildNoMatchBaselineDeck(commander.traits ?? {}, 30);

const match = createMatchFromDecks({
  p1: { commanderId: commander.id, deck },
  p2: { commanderId: commander.id, deck },
  shuffle: false,
  openingHandSize: 10,
}) as any;

match.players.P1.energy = 999;

const unitIndex = match.players.P1.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (unitIndex === -1) throw new Error("No no-match unit in hand");

const playedCardId = match.players.P1.hand[unitIndex];
const next = playUnitFromHand(match, "P1", unitIndex, "front") as any;
const unit = next.players.P1.board.front[0];

console.log(JSON.stringify({
  commander: {
    id: commander.id,
    name: commander.name,
    traits: commander.traits,
  },
  playedCardId,
  storedModifier: match.players.P1.cardModifiers[playedCardId] ?? null,
  unit: buildModifierSummary(unit),
}, null, 2));
