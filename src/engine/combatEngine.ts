import { MatchState } from "./state";
import { postActionStatePass, getEnemyPlayerId } from "./effectSystem";

type PlayerId = "P1" | "P2";

type AnyUnit = {
  instanceId: string;
  cardId: string;
  attack: number;
  health: number;
  armor?: number;
  speed?: number;
  exhausted?: boolean;
  summoningSick?: boolean;
  keywords?: string[];
};

function cloneMatch(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match));
}

function getPlayer(match: MatchState, playerId: PlayerId): any {
  return (match as any).players[playerId];
}

function findFrontUnit(player: any, instanceId: string): AnyUnit | undefined {
  return (player.board?.front || []).find((u: AnyUnit) => u.instanceId === instanceId);
}

function hasKeyword(unit: AnyUnit | undefined, keyword: string): boolean {
  return !!unit?.keywords?.includes(keyword);
}

function canUnitAttack(unit: AnyUnit): boolean {
  if (!unit) return false;
  if (unit.exhausted) return false;
  if (unit.summoningSick && !hasKeyword(unit, "RUSH")) return false;
  if ((unit.attack ?? 0) <= 0) return false;
  return true;
}

function guardsInFront(player: any): AnyUnit[] {
  return (player.board?.front || []).filter((u: AnyUnit) => hasKeyword(u, "GUARD"));
}

function applyDamage(unit: AnyUnit, amount: number) {
  const armor = unit.armor ?? 0;
  const blocked = Math.min(armor, amount);
  const leftover = Math.max(0, amount - blocked);
  unit.armor = Math.max(0, armor - blocked);
  unit.health -= leftover;
}

export function attackUnit(match: MatchState, attackerPlayerId: PlayerId, attackerId: string, defenderId: string): MatchState {
  const next = cloneMatch(match);
  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const attackerPlayer = getPlayer(next, attackerPlayerId);
  const defenderPlayer = getPlayer(next, defenderPlayerId);

  const attacker = findFrontUnit(attackerPlayer, attackerId);
  const defender = findFrontUnit(defenderPlayer, defenderId);

  if (!attacker) throw new Error("Attacker not found");
  if (!defender) throw new Error("Defender not found");
  if (!canUnitAttack(attacker)) throw new Error("Unit cannot attack");

  const guards = guardsInFront(defenderPlayer);
  if (guards.length > 0 && !guards.some((u) => u.instanceId === defenderId)) {
    throw new Error("Must attack a GUARD unit first");
  }

  applyDamage(defender, attacker.attack ?? 0);

  if ((defender.health ?? 0) > 0) {
    applyDamage(attacker, defender.attack ?? 0);
  }

  if (hasKeyword(attacker, "CRUSH") && (defender.health ?? 0) <= 0) {
    defenderPlayer.health -= 1;
  }

  attacker.exhausted = true;
  (next as any).phase = "combat";

  return postActionStatePass(next);
}

export function attackPlayer(match: MatchState, attackerPlayerId: PlayerId, attackerId: string): MatchState {
  const next = cloneMatch(match);
  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const attackerPlayer = getPlayer(next, attackerPlayerId);
  const defenderPlayer = getPlayer(next, defenderPlayerId);

  const attacker = findFrontUnit(attackerPlayer, attackerId);

  if (!attacker) throw new Error("Attacker not found");
  if (!canUnitAttack(attacker)) throw new Error("Unit cannot attack");

  const guards = guardsInFront(defenderPlayer);
  if (guards.length > 0) {
    throw new Error("Cannot attack player while GUARD unit exists");
  }

  defenderPlayer.health -= attacker.attack ?? 0;
  attacker.exhausted = true;
  (next as any).phase = "combat";

  return postActionStatePass(next);
}
