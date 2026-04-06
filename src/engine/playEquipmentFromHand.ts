import { MatchState, PlayerId } from "./state";
import { getLoadedEquipmentById } from "../data/loadAllEquipment";

export function playEquipmentFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  targetUnitInstanceId: string
): MatchState {
  const player = match.players[playerId];
  const handCardId = player.hand[handIndex];

  if (!handCardId) {
    throw new Error(`No card found in hand at index ${handIndex}`);
  }

  const equipment = getLoadedEquipmentById(handCardId);

  if (equipment.type !== "equipment") {
    throw new Error(`Card is not equipment: ${handCardId}`);
  }

  if (player.energy < equipment.cost) {
    throw new Error(`Not enough energy to play equipment: ${handCardId}`);
  }

  const nextPlayers = {
    ...match.players,
    [playerId]: {
      ...player,
      hand: [...player.hand],
      board: {
        front: player.board.front.map((unit) => ({ ...unit })),
        back: player.board.back.map((unit) => ({ ...unit }))
      }
    }
  };

  const nextPlayer = nextPlayers[playerId];

  const allBoardUnits = [...nextPlayer.board.front, ...nextPlayer.board.back];
  const targetUnit = allBoardUnits.find((unit) => unit.instanceId === targetUnitInstanceId);

  if (!targetUnit) {
    throw new Error(`Target unit not found: ${targetUnitInstanceId}`);
  }

  targetUnit.attack += equipment.bonuses.attack;
  targetUnit.health += equipment.bonuses.health;
  targetUnit.armor += equipment.bonuses.armor;

  const existingKeywords = Array.isArray((targetUnit as any).keywords)
    ? [ ...(targetUnit as any).keywords ]
    : [];

  const mergedKeywords = Array.from(
    new Set([ ...existingKeywords, ...(equipment.keywords || []) ])
  );

  (targetUnit as any).keywords = mergedKeywords;
  (targetUnit as any).attachedEquipment = [
    ...(((targetUnit as any).attachedEquipment || []) as string[]),
    equipment.id
  ];

  nextPlayer.energy -= equipment.cost;
  nextPlayer.hand.splice(handIndex, 1);

  return {
    ...match,
    players: nextPlayers
  };
}
