import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { playUnitFromHand } from "../engine/setup";
import { buildLegendaryProofDeck } from "./buildProofDecks";
import { buildModifierSummary } from "../engine/expert/buildModifierSummary";
import { resolveCombatBreakdown } from "../engine/expert/resolveCombatBreakdown";

const commander = allCommanders.find((c) => c.traits?.["Legendary"] === "Legendary") ?? allCommanders[0];
if (!commander) throw new Error("No commander found");

const deck = buildLegendaryProofDeck(30);

const match = createMatchFromDecks({
  p1: { commanderId: commander.id, deck },
  p2: { commanderId: commander.id, deck },
  shuffle: false,
  openingHandSize: 8,
}) as any;

match.players.P1.energy = 999;
match.players.P2.energy = 999;

const p1Index = match.players.P1.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (p1Index === -1) throw new Error("No unit in P1 hand");

const afterP1 = playUnitFromHand(match, "P1", p1Index, "front") as any;
afterP1.activePlayer = "P2";

const p2Index = afterP1.players.P2.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (p2Index === -1) throw new Error("No unit in P2 hand");

const afterP2 = playUnitFromHand(afterP1, "P2", p2Index, "front") as any;

const attacker = afterP2.players.P1.board.front[0];
const defender = afterP2.players.P2.board.front[0];

console.log(JSON.stringify({
  commander: {
    id: commander.id,
    name: commander.name,
    traits: commander.traits,
  },
  attacker: buildModifierSummary(attacker),
  defender: buildModifierSummary(defender),
  combatBreakdown: resolveCombatBreakdown(attacker, defender),
}, null, 2));
