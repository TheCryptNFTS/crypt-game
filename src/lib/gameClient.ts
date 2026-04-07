import { createSandboxMatch } from "../engine/setup";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { playUnitFromHand, playEquipmentFromHand } from "../engine/setup";
import { playArtifactCard } from "../engine/effectSystem";
import { endTurn } from "../engine/turnEngine";
import { attackUnit, attackPlayer } from "../engine/combatEngine";
import { MatchBootstrapInput } from "../types/matchBootstrap";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import defaultDecks from "../data/defaultDecks.json";

export type PlayerId = "P1" | "P2";
export type Lane = "front";

const DEFAULT_P1_COMMANDER = "cmd_stone_warden";
const DEFAULT_P2_COMMANDER = "cmd_bronze_raider";

function assertCommanderExists(commanderId: string) {
  if (!COMMANDER_SPECS[commanderId as keyof typeof COMMANDER_SPECS]) {
    throw new Error(`Unknown default commander: ${commanderId}`);
  }
}

function assertDeckExists(
  decks: Record<string, string[]>,
  commanderId: string
): string[] {
  const deck = decks[commanderId];
  if (!Array.isArray(deck)) {
    throw new Error(`defaultDecks.json is missing deck list for commander ${commanderId}`);
  }
  return deck;
}

export function defaultMatchBootstrap(): MatchBootstrapInput {
  assertCommanderExists(DEFAULT_P1_COMMANDER);
  assertCommanderExists(DEFAULT_P2_COMMANDER);

  const decks = defaultDecks as Record<string, string[]>;
  const p1Deck = assertDeckExists(decks, DEFAULT_P1_COMMANDER);
  const p2Deck = assertDeckExists(decks, DEFAULT_P2_COMMANDER);

  return {
    p1: { commanderId: DEFAULT_P1_COMMANDER, deck: [...p1Deck] },
    p2: { commanderId: DEFAULT_P2_COMMANDER, deck: [...p2Deck] },
  };
}

export function createNewMatch(initial?: MatchBootstrapInput) {
  return createMatchFromDecks(initial ?? defaultMatchBootstrap());
}

/**
 * Dev-only: re-export of the legacy `decks.json` sandbox match factory.
 */
export { createSandboxMatch };

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
