import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { playUnitFromHand } from "../engine/setup";
import { buildArmorUtilityProofDeck } from "./buildProofDecks";
import { resolveCombatBreakdown } from "../engine/expert/resolveCombatBreakdown";
import { buildModifierSummary } from "../engine/expert/buildModifierSummary";
import { selectProofCommander } from "./selectProofCommander";

const commander = selectProofCommander();
if (!commander) throw new Error("No commander found");

const deck = buildArmorUtilityProofDeck(commander.traits ?? {}, 30);

const match = createMatchFromDecks({
  p1: { commanderId: commander.id, deck },
  p2: { commanderId: commander.id, deck },
  shuffle: false,
  openingHandSize: 10,
}) as any;

match.players.P1.energy = 999;
match.players.P2.energy = 999;

const attackerIndex = match.players.P1.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (attackerIndex === -1) throw new Error("No attacker unit in hand");

const afterAttacker = playUnitFromHand(match, "P1", attackerIndex, "front") as any;
afterAttacker.activePlayer = "P2";

const defenderIndex = afterAttacker.players.P2.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (defenderIndex === -1) throw new Error("No defender unit in hand");

const afterDefender = playUnitFromHand(afterAttacker, "P2", defenderIndex, "front") as any;

const attacker = afterDefender.players.P1.board.front[0];
const defender = afterDefender.players.P2.board.front[0];

const originalArmor = defender.armor ?? 0;
if (originalArmor <= 0) {
  defender.armor = 3;
}

console.log(JSON.stringify({
  commander: {
    id: commander.id,
    name: commander.name,
    traits: commander.traits,
  },
  forcedArmorForProof: originalArmor <= 0,
  attacker: buildModifierSummary(attacker),
  defender: buildModifierSummary(defender),
  combatBreakdown: resolveCombatBreakdown(attacker, defender),
}, null, 2));
