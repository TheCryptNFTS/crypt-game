import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { playUnitFromHand } from "../engine/setup";
import { resolveOutgoingDamage, resolveMitigatedDamage } from "../engine/resolveCombatBonuses";
import { buildArmorUtilityProofDeck } from "./buildProofDecks";

const commander = allCommanders.find((c) => c.name === "Crypt #6600") ?? allCommanders[0];
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

// P1 attacker
const attackerIndex = match.players.P1.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (attackerIndex === -1) throw new Error("No attacker unit in hand");

const attackerCardId = match.players.P1.hand[attackerIndex];
const afterAttacker = playUnitFromHand(match, "P1", attackerIndex, "front") as any;

// hand over turn to P2 for proof
afterAttacker.activePlayer = "P2";

// P2 defender
const defenderIndex = afterAttacker.players.P2.hand.findIndex((id: string) => {
  const card = allPlayableCards.find((c) => c.id === id);
  return card?.type === "unit";
});
if (defenderIndex === -1) throw new Error("No defender unit in hand");

const defenderCardId = afterAttacker.players.P2.hand[defenderIndex];
const afterDefender = playUnitFromHand(afterAttacker, "P2", defenderIndex, "front") as any;

const attacker = afterDefender.players.P1.board.front[0];
const defender = afterDefender.players.P2.board.front[0];

const outgoing = resolveOutgoingDamage(attacker);
const mitigated = resolveMitigatedDamage(attacker, defender);

console.log(JSON.stringify({
  commander: {
    id: commander.id,
    name: commander.name,
    traits: commander.traits,
  },
  attackerCardId,
  defenderCardId,
  attacker,
  defender,
  combatBreakdown: {
    attackerAttack: attacker.attack,
    attackerCrit: attacker.crit ?? 0,
    attackerUtility: attacker.utility ?? 0,
    defenderArmor: defender.armor,
    outgoing,
    mitigated,
  },
}, null, 2));
