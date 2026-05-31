import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { allPlayableCards, getPlayableCardById } from "../engine/cards";
import { playUnitFromHand, playEquipmentFromHand } from "../engine/setup";
import { buildProofDeck } from "./buildProofDecks";
import { selectProofCommander } from "./selectProofCommander";

const commander = selectProofCommander();
if (!commander) throw new Error("No commander found");

const deck = buildProofDeck(["unit", "equipment"], 30);

const match = createMatchFromDecks({
  p1: { commanderId: commander.id, deck },
  p2: { commanderId: commander.id, deck },
  shuffle: false,
  openingHandSize: 8,
}) as any;

const showCard = (id: string, state: any) => {
  const byList = allPlayableCards.find((c) => c.id === id);
  const byGetter = getPlayableCardById(id);
  return {
    id,
    byList: byList ? { name: byList.name, type: byList.type } : null,
    byGetter: byGetter ? { name: byGetter.name, type: byGetter.type } : null,
    modifier: state.players.P1.cardModifiers[id] ?? null,
  };
};

console.log("INITIAL HAND");
console.log(JSON.stringify(match.players.P1.hand.map((id: string) => showCard(id, match)), null, 2));

const unitIndex = match.players.P1.hand.findIndex((id: string) => {
  const card = getPlayableCardById(id);
  return card?.type === "unit";
});
if (unitIndex === -1) throw new Error("No unit in hand");

const unitCardId = match.players.P1.hand[unitIndex];
// Grant ample energy BEFORE the play: post-BUG-2-fix units enter at their real
// catalog cost (no longer a free 0-cost stub), so the unit play needs energy too.
match.players.P1.energy = 999;
match.players.P1.maxEnergy = 999;
const afterUnit = playUnitFromHand(match, "P1", unitIndex, "front") as any;
afterUnit.players.P1.energy = 999;

console.log("HAND AFTER UNIT PLAY");
console.log(JSON.stringify(afterUnit.players.P1.hand.map((id: string) => showCard(id, afterUnit)), null, 2));

const target = afterUnit.players.P1.board.front[0];
if (!target) throw new Error("No target unit on board");

const equipIndex = afterUnit.players.P1.hand.findIndex((id: string) => {
  const card = getPlayableCardById(id);
  return card?.type === "equipment";
});
if (equipIndex === -1) throw new Error("No equipment in hand after unit play");

const equipCardId = afterUnit.players.P1.hand[equipIndex];
const equipCard = getPlayableCardById(equipCardId);

console.log("ABOUT TO EQUIP");
console.log(JSON.stringify({
  equipIndex,
  equipCardId,
  equipCard,
  targetId: target.instanceId,
}, null, 2));

const afterEquip = playEquipmentFromHand(afterUnit, "P1", equipIndex, target.instanceId) as any;

console.log(JSON.stringify({
  commander: commander.name,
  unitCardId,
  equipCardId,
  equipStoredModifier: afterUnit.players.P1.cardModifiers[equipCardId] ?? null,
  equippedUnit: afterEquip.players.P1.board.front[0],
}, null, 2));
