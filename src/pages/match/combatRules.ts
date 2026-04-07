import type { PlayerId } from "../../lib/gameClient";
import type { PlayableChromeState } from "../../components/cards/PlayableCard";

export function hasKeyword(u: any, k: string) {
  return Array.isArray(u.keywords) && u.keywords.includes(k);
}

export function canUnitAttackUi(u: any): boolean {
  if (!u || u.exhausted) return false;
  if ((u.attack ?? 0) <= 0) return false;
  if (u.summoningSick && !hasKeyword(u, "RUSH")) return false;
  return true;
}

export function legalTargetInstanceIds(match: any, enemyId: PlayerId): Set<string> {
  const front = (match.players[enemyId] as any)?.board?.front ?? [];
  const guards = front.filter((u: any) => hasKeyword(u, "GUARD"));
  if (guards.length === 0) {
    return new Set(front.map((u: any) => u.instanceId));
  }
  return new Set(guards.map((u: any) => u.instanceId));
}

export function boardChromeForUnit(
  params: {
    playerId: PlayerId;
    active: PlayerId;
    side: "foe" | "self";
    u: any;
    winner: string | null | undefined;
    attackPick: string | null;
    legalTargets: Set<string> | null;
    equipHandIndex: number | null;
    equipIsEquipment: boolean;
  }
): PlayableChromeState {
  const {
    playerId,
    active,
    side,
    u,
    winner,
    attackPick,
    legalTargets,
    equipHandIndex,
    equipIsEquipment,
  } = params;

  const isActiveSide = playerId === active;
  if (attackPick && isActiveSide && u.instanceId === attackPick) return "boardAttacker";
  if (attackPick && side === "foe" && legalTargets) {
    return legalTargets.has(u.instanceId) ? "targetLegal" : "targetIllegal";
  }
  if (equipHandIndex !== null && equipIsEquipment && isActiveSide && side === "self" && !winner) {
    return "equipHint";
  }
  if (side === "self" && isActiveSide && !winner && attackPick === null && !canUnitAttackUi(u)) {
    return "combatDead";
  }
  return "default";
}
