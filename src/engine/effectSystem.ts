import { getStoredCardModifier, applyModifierToArtifactLike } from "./applyCommanderCardModifiers";
import { MatchState } from "./state";
import { getLoadedArtifactById } from "../data/loadAllArtifacts";

type PlayerId = "P1" | "P2";

type AnyUnit = {
  instanceId: string;
  cardId: string;
  attack: number;
  health: number;
  maxHealth?: number;
  armor?: number;
  speed?: number;
  keywords?: string[];
  exhausted?: boolean;
  summoningSick?: boolean;
  attachedEquipment?: string[];
  lane?: string;
  baseAttack?: number;
  baseHealth?: number;
  baseArmor?: number;
  baseSpeed?: number;
};

type AnyArtifact = {
  cardId: string;
  name?: string;
  effectTags?: string[];
  rarity?: string;
  faction?: string;
};

function getPlayer(match: MatchState, playerId: PlayerId): any {
  return (match as any).players[playerId];
}

function getEnemyId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function ensureArtifacts(player: any) {
  if (!Array.isArray(player.artifacts)) {
    player.artifacts = [];
  }
}

function cloneMatch(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match));
}

function ensureUnitBaseStats(unit: AnyUnit) {
  if (typeof unit.baseAttack !== "number") unit.baseAttack = unit.attack ?? 0;
  if (typeof unit.baseHealth !== "number") unit.baseHealth = unit.maxHealth ?? unit.health ?? 0;
  if (typeof unit.baseArmor !== "number") unit.baseArmor = unit.armor ?? 0;
  if (typeof unit.baseSpeed !== "number") unit.baseSpeed = unit.speed ?? 0;
  if (typeof unit.maxHealth !== "number") unit.maxHealth = unit.health ?? unit.baseHealth ?? 0;
  if (!Array.isArray(unit.keywords)) unit.keywords = [];
  if (!Array.isArray(unit.attachedEquipment)) unit.attachedEquipment = [];
}

function resetUnitToBase(unit: AnyUnit) {
  ensureUnitBaseStats(unit);
  unit.attack = unit.baseAttack ?? unit.attack ?? 0;
  unit.maxHealth = unit.baseHealth ?? unit.maxHealth ?? unit.health ?? 0;
  if (unit.health > (unit.maxHealth ?? unit.health)) {
    unit.health = unit.maxHealth ?? unit.health;
  }
  unit.armor = unit.baseArmor ?? unit.armor ?? 0;
  unit.speed = unit.baseSpeed ?? unit.speed ?? 0;
}

function applyArtifactToUnit(unit: AnyUnit, artifact: AnyArtifact) {
  const tags = artifact.effectTags || [];

  for (const tag of tags) {
    switch (tag) {
      case "ARCANE":
        unit.attack += 1;
        break;
      case "GUARD":
        if (!unit.keywords?.includes("GUARD")) unit.keywords?.push("GUARD");
        break;
      case "RUSH":
        if (!unit.keywords?.includes("RUSH")) unit.keywords?.push("RUSH");
        break;
      case "CRUSH":
        if (!unit.keywords?.includes("CRUSH")) unit.keywords?.push("CRUSH");
        break;
      default:
        break;
    }
  }

  if (artifact.rarity === "epic") {
    unit.attack += 0;
  }

  if (artifact.rarity === "legendary" || artifact.rarity === "god") {
    unit.attack += 1;
  }
}

export function refreshArtifactAuras(match: MatchState): MatchState {
  const next = cloneMatch(match);

  for (const playerId of ["P1", "P2"] as PlayerId[]) {
    const player = getPlayer(next, playerId);
    ensureArtifacts(player);

    const front: AnyUnit[] = player.board?.front || [];
    for (const unit of front) {
      ensureUnitBaseStats(unit);
      resetUnitToBase(unit);
      for (const artifact of player.artifacts as AnyArtifact[]) {
        applyArtifactToUnit(unit, artifact);
      }
    }
  }

  return next;
}

export function playArtifactCard(match: MatchState, playerId: PlayerId, handIndex: number): MatchState {
  const next = cloneMatch(match);
  const player = getPlayer(next, playerId);

  ensureArtifacts(player);

  const cardId = player.hand[handIndex];
  if (!cardId) {
    throw new Error("Artifact hand index is invalid");
  }

  const artifactCard = getLoadedArtifactById(cardId);
  const commanderModifier = getStoredCardModifier(match, playerId, cardId);

  const cost = artifactCard.cost ?? 0;
  if ((player.energy ?? 0) < cost) {
    throw new Error("Not enough energy");
  }

  player.energy -= cost;
  player.hand.splice(handIndex, 1);

  const artifact = {
    cardId: artifactCard.id,
    name: artifactCard.name,
    effectTags: artifactCard.effectTags || [],
    rarity: artifactCard.rarity,
    faction: artifactCard.faction,
    attack: artifactCard.effect?.attack ?? 0,
    health: artifactCard.effect?.health ?? 0,
    speed: artifactCard.effect?.speed ?? 0,
    armor: artifactCard.effect?.armor ?? 0,
    crit: 0,
    utility: 0,
    commanderTags: [],
    passives: [],
    modifiers: {}
  };

  applyModifierToArtifactLike(artifact, commanderModifier);
  player.artifacts.push(artifact);

  return refreshArtifactAuras(next);
}

export function cleanupDeadUnits(match: MatchState): MatchState {
  const next = cloneMatch(match);

  for (const playerId of ["P1", "P2"] as PlayerId[]) {
    const player = getPlayer(next, playerId);
    const front: AnyUnit[] = player.board?.front || [];
    const survivors: AnyUnit[] = [];
    const deadCards: string[] = [];

    for (const unit of front) {
      if ((unit.health ?? 0) <= 0) {
        deadCards.push(unit.cardId);
      } else {
        survivors.push(unit);
      }
    }

    player.board.front = survivors;
    if (!Array.isArray(player.discard)) player.discard = [];
    player.discard.push(...deadCards);
  }

  return next;
}

export function getEnemyPlayerId(playerId: PlayerId): PlayerId {
  return getEnemyId(playerId);
}
