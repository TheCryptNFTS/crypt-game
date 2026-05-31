import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { playUnitFromHand } from "../engine/setup";
import { buildExactTraitProofDeck } from "./buildProofDecks";
import { selectProofCommander } from "./selectProofCommander";

const commander = selectProofCommander();
if (!commander) throw new Error("No commander found");

const deck = buildExactTraitProofDeck(commander.traits ?? {}, 30);

const match = createMatchFromDecks({
  p1: { commanderId: commander.id, deck },
  p2: { commanderId: commander.id, deck },
  shuffle: false,
  openingHandSize: 10,
}) as any;

const handDump = match.players.P1.hand.map((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return {
    id,
    name: card?.name,
    type: card?.type,
    rawTraits: card?.rawTraits,
    modifier: match.players.P1.cardModifiers[id] ?? null,
  };
});

console.log("HAND");
console.log(JSON.stringify(handDump, null, 2));

const exactUnitIndex = match.players.P1.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  const exact = Object.entries(card?.rawTraits ?? {}).some(([k, v]) => commander.traits?.[k] === v);
  return card?.type === "unit" && exact;
});

if (exactUnitIndex === -1) throw new Error("No exact-match unit in hand");

const playedCardId = match.players.P1.hand[exactUnitIndex];
// Stat-modifier proof: not an energy-economy test. Grant ample energy so the
// real (post-BUG-2-fix) catalog cost — units no longer enter at a free 0-cost
// stub — does not gate the play we want to inspect.
match.players.P1.energy = 99;
match.players.P1.maxEnergy = 99;
const next = playUnitFromHand(match, "P1", exactUnitIndex, "front") as any;

console.log(JSON.stringify({
  commander: {
    id: commander.id,
    name: commander.name,
    traits: commander.traits,
  },
  playedCardId,
  storedModifier: match.players.P1.cardModifiers[playedCardId] ?? null,
  unit: next.players.P1.board.front[0],
}, null, 2));
