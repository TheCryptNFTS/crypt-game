import { createMatch } from "../engine/setup";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { playUnitFromHand, playEquipmentFromHand } from "../engine/setup";
import { playArtifactCard } from "../engine/effectSystem";
import { endTurn } from "../engine/turnEngine";
import { attackUnit, attackPlayer } from "../engine/combatEngine";
import { MatchBootstrapInput } from "../types/matchBootstrap";

export type PlayerId = "P1" | "P2";
export type Lane = "front";

export function createNewMatch(initial?: MatchBootstrapInput) {
  if (initial?.p1?.commanderId && initial?.p2?.commanderId) {
    return createMatchFromDecks(initial);
  }
  return createMatch();
}

export function playUnit(
  match: any,
  playerId: PlayerId,
  handIndex: number,
  lane: Lane = "front"
) {
  return playUnitFromHand(match, playerId, handIndex, lane);
}

export function playEquipment(
  match: any,
  playerId: PlayerId,
  handIndex: number,
  targetInstanceId: string
) {
  return playEquipmentFromHand(match, playerId, handIndex, targetInstanceId);
}

export function playArtifact(
  match: any,
  playerId: PlayerId,
  handIndex: number
) {
  return playArtifactCard(match, playerId, handIndex);
}

export function endPlayerTurn(match: any) {
  return endTurn(match);
}

export function attackTarget(
  match: any,
  attackerInstanceId: string,
  defenderInstanceId?: string
) {
  const attackerPlayerId = findUnitOwner(match, attackerInstanceId);

  if (defenderInstanceId) {
    return attackUnit(match, attackerPlayerId, attackerInstanceId, defenderInstanceId);
  }

  return attackPlayer(match, attackerPlayerId, attackerInstanceId);
}

function findUnitOwner(match: any, instanceId: string): PlayerId {
  const p1Front = match?.players?.P1?.board?.front ?? [];
  const p2Front = match?.players?.P2?.board?.front ?? [];

  if (p1Front.some((unit: any) => unit.instanceId === instanceId)) return "P1";
  if (p2Front.some((unit: any) => unit.instanceId === instanceId)) return "P2";

  throw new Error(`Could not find unit owner for instanceId: ${instanceId}`);
}
