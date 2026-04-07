import { getStoredCardModifier, applyModifierToUnitLike, applyModifierToEquippedTarget } from "./applyCommanderCardModifiers";
import decks from "../data/decks.json";
import units from "../data/units.json";
import equipment from "../data/equipment.json";
import spells from "../data/spells.json";
import { getLoadedCommanderById } from "../data/loadCommanders";
import { getLoadedUnitById } from "../data/loadAllUnits";
import { emitEvent } from "./events";
import { cleanupDeadUnits } from "./cleanup";
import { MatchState, PlayerId, PlayerState, Lane, UnitInPlay } from "./state";

type DamageUnitEffect = { type: "DAMAGE_UNIT"; value: number };
type DrawCardsEffect = { type: "DRAW_CARDS"; value: number };
type BuffUnitEffect = { type: "BUFF_UNIT"; attack: number; health: number };
type HealUnitEffect = { type: "HEAL_UNIT"; value: number };
type DestroyDamagedUnitEffect = { type: "DESTROY_DAMAGED_UNIT" };

type SpellEffect =
  | DamageUnitEffect
  | DrawCardsEffect
  | BuffUnitEffect
  | HealUnitEffect
  | DestroyDamagedUnitEffect;

type SpellCard = {
  id: string;
  name: string;
  type: "spell";
  faction: string;
  rarity: string;
  cost: number;
  effect: SpellEffect;
};

type UnitCard = {
  id: string;
  name: string;
  type: "unit";
  faction: string;
  rarity: string;
  cost: number;
  stats: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  keywords: string[];
};

type EquipmentCard = {
  id: string;
  name: string;
  type: "equipment";
  faction: string;
  rarity: string;
  cost: number;
  effect: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
};

type DeckKey = keyof typeof decks;

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function drawCards(deck: string[], count: number) {
  const newDeck = [...deck];
  const drawn: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = newDeck.shift();
    if (card) drawn.push(card);
  }

  return { newDeck, drawn };
}

function assertCommanderExists(commanderId: string): void {
  getLoadedCommanderById(commanderId);
}

function createPlayer(playerId: PlayerId, deckKey: DeckKey): PlayerState {
  const deckDef = decks[deckKey];

  assertCommanderExists(deckDef.commanderId);

  const shuffledDeck = shuffle(deckDef.cardIds);
  const { newDeck, drawn } = drawCards(shuffledDeck, 3);

  return {
    id: playerId,
    health: 30,
    energy: 1,
    maxEnergy: 1,
    commanderId: deckDef.commanderId,
    deck: newDeck,
    hand: drawn,
    discard: [],
    board: {
      front: [],
      back: []
    },
    turnFlags: {
      firstUnitCostReduction: 0,
      firstUnitPlayed: false
    }
  };
}

export function createMatch(): MatchState {
  return {
    turn: 1,
    activePlayer: "P1",
    phase: "main",
    winner: null,
    players: {
      P1: createPlayer("P1", "deck_stone_test"),
      P2: createPlayer("P2", "deck_bronze_test")
    }
  };
}

/**
 * Dev-only: legacy match seeded from bundled `decks.json` test decks
 * (not the curated commander + main-deck bootstrap).
 */
export function createSandboxMatch(): MatchState {
  return createMatch();
}

export function createFixedTestMatch(): MatchState {
  assertCommanderExists("cmd_stone_warden");
  assertCommanderExists("cmd_bronze_raider");

  return {
    turn: 1,
    activePlayer: "P1",
    phase: "main",
    winner: null,
    players: {
      P1: {
        id: "P1",
        health: 30,
        energy: 10,
        maxEnergy: 10,
        commanderId: "cmd_stone_warden",
        deck: [
          "unit_stone_brute",
          "eq_riot_shield",
          "unit_stone_guard",
          "eq_heavy_plate"
        ],
        hand: [
          "unit_stone_guard",
          "spell_firebolt",
          "spell_insight",
          "spell_battle_blessing",
          "spell_mend"
        ],
        discard: [],
        board: {
          front: [],
          back: []
        },
        turnFlags: {
          firstUnitCostReduction: 0,
          firstUnitPlayed: false
        }
      },
      P2: {
        id: "P2",
        health: 30,
        energy: 10,
        maxEnergy: 10,
        commanderId: "cmd_bronze_raider",
        deck: [
          "unit_blade_striker",
          "eq_speed_boots",
          "unit_berserker"
        ],
        hand: [
          "unit_bronze_scout",
          "spell_execute",
          "eq_axe"
        ],
        discard: [],
        board: {
          front: [],
          back: []
        },
        turnFlags: {
          firstUnitCostReduction: 0,
          firstUnitPlayed: false
        }
      }
    }
  };
}

function makeInstanceId() {
  return `unit_${Math.random().toString(36).slice(2, 10)}`;
}

function findUnit(
  player: PlayerState,
  targetInstanceId: string
): { lane: Lane; unitIndex: number } {
  const frontIndex = player.board.front.findIndex((u) => u.instanceId === targetInstanceId);
  if (frontIndex !== -1) {
    return { lane: "front", unitIndex: frontIndex };
  }

  const backIndex = player.board.back.findIndex((u) => u.instanceId === targetInstanceId);
  if (backIndex !== -1) {
    return { lane: "back", unitIndex: backIndex };
  }

  throw new Error("Target unit not found");
}

function getUnitCard(cardId: string): UnitCard {
  const builtInUnit = (units as UnitCard[]).find((u) => u.id === cardId);
  if (builtInUnit) {
    return builtInUnit;
  }

  return getLoadedUnitById(cardId) as UnitCard;
}

function getEquipmentCard(cardId: string): EquipmentCard {
  const equipmentCard = (equipment as EquipmentCard[]).find((e) => e.id === cardId);
  if (!equipmentCard) throw new Error(`Selected card is not equipment: ${cardId}`);
  return equipmentCard;
}

function getSpellCard(cardId: string): SpellCard {
  const spellCard = (spells as SpellCard[]).find((s) => s.id === cardId);
  if (!spellCard) throw new Error(`Selected card is not a spell: ${cardId}`);
  return spellCard;
}

function applyDamageToUnit(unit: UnitInPlay, damage: number): UnitInPlay {
  if (damage <= 0) return unit;

  let remainingDamage = damage;
  let nextArmor = unit.armor;

  if (nextArmor > 0) {
    const blocked = Math.min(nextArmor, remainingDamage);
    nextArmor -= blocked;
    remainingDamage -= blocked;
  }

  return {
    ...unit,
    armor: nextArmor,
    health: unit.health - remainingDamage
  };
}

function spendSpell(
  match: MatchState,
  playerId: PlayerId,
  player: PlayerState,
  spellCard: SpellCard,
  handIndex: number
): MatchState {
  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        energy: player.energy - spellCard.cost,
        hand: newHand,
        discard: [...player.discard, spellCard.id]
      }
    }
  };
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function updateWinner(match: MatchState): MatchState {
  const p1 = match.players.P1;
  const p2 = match.players.P2;

  if (p1.health <= 0 && p2.health <= 0) {
    return {
      ...match,
      winner: "P1"
    };
  }

  if (p1.health <= 0) {
    return {
      ...match,
      winner: "P2"
    };
  }

  if (p2.health <= 0) {
    return {
      ...match,
      winner: "P1"
    };
  }

  return match;
}

export function goToCombatPhase(match: MatchState): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.phase !== "main") {
    throw new Error("Can only move to combat from main phase");
  }

  return {
    ...match,
    phase: "combat"
  };
}

export function goToEndPhase(match: MatchState): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.phase !== "combat") {
    throw new Error("Can only move to end from combat phase");
  }

  return {
    ...match,
    phase: "end"
  };
}

export function playUnitFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  lane: Lane
): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.activePlayer !== playerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "main") {
    throw new Error("Units can only be played during main phase");
  }

  const player = match.players[playerId];
  const cardId = player.hand[handIndex];

  if (!cardId) {
    throw new Error("No card in that hand slot");
  }

  const unitCard = getUnitCard(cardId);
  const commanderModifier = getStoredCardModifier(match, playerId, cardId);

  const reduction =
    !player.turnFlags.firstUnitPlayed ? player.turnFlags.firstUnitCostReduction : 0;
  const finalCost = Math.max(0, unitCard.cost - reduction);

  if (player.energy < finalCost) {
    throw new Error("Not enough energy");
  }

  const instance: UnitInPlay = {
    instanceId: makeInstanceId(),
    cardId: unitCard.id,
    lane,
    attack: unitCard.stats.attack,
    health: unitCard.stats.health,
    maxHealth: unitCard.stats.health,
    speed: unitCard.stats.speed,
    armor: unitCard.stats.armor,
    keywords: [...unitCard.keywords],
    exhausted: false,
    summoningSick: !unitCard.keywords.includes("RUSH")
  };

  applyModifierToUnitLike(instance, commanderModifier);
  instance.maxHealth = Math.max(instance.maxHealth ?? instance.health, instance.health);

  applyModifierToUnitLike(instance, commanderModifier);

  instance.maxHealth = Math.max(instance.maxHealth ?? instance.health, instance.health);

  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  const updatedBoard = {
    ...player.board,
    [lane]: [...player.board[lane], instance]
  };

  const updatedMatch = {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        energy: player.energy - finalCost,
        hand: newHand,
        board: updatedBoard,
        turnFlags: {
          ...player.turnFlags,
          firstUnitPlayed: true
        }
      }
    }
  };

  return emitEvent(updatedMatch, {
    type: "UNIT_PLAYED",
    playerId,
    cardId: unitCard.id,
    instanceId: instance.instanceId
  });
}

export function playEquipmentFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  targetInstanceId: string
): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.activePlayer !== playerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "main") {
    throw new Error("Equipment can only be played during main phase");
  }

  const player = match.players[playerId];
  const cardId = player.hand[handIndex];

  if (!cardId) {
    throw new Error("No card in that hand slot");
  }

  const equipmentCard = getEquipmentCard(cardId);

  if (player.energy < equipmentCard.cost) {
    throw new Error("Not enough energy");
  }

  const { lane, unitIndex } = findUnit(player, targetInstanceId);
  const targetUnit = player.board[lane][unitIndex];

  const updatedUnit: UnitInPlay = {
    ...targetUnit,
    attack: targetUnit.attack + equipmentCard.effect.attack,
    health: targetUnit.health + equipmentCard.effect.health,
    maxHealth: (targetUnit.maxHealth ?? targetUnit.health) + equipmentCard.effect.health,
    speed: targetUnit.speed + equipmentCard.effect.speed,
    armor: targetUnit.armor + equipmentCard.effect.armor
  };

  const updatedLane = [...player.board[lane]];
  updatedLane[unitIndex] = updatedUnit;

  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        energy: player.energy - equipmentCard.cost,
        hand: newHand,
        discard: [...player.discard, equipmentCard.id],
        board: {
          ...player.board,
          [lane]: updatedLane
        }
      }
    }
  };
}

export function playSpellFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  targetInstanceId?: string
): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.activePlayer !== playerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "main") {
    throw new Error("Spells can only be played during main phase");
  }

  const player = match.players[playerId];
  const cardId = player.hand[handIndex];

  if (!cardId) {
    throw new Error("No card in that hand slot");
  }

  const spellCard = getSpellCard(cardId);

  if (player.energy < spellCard.cost) {
    throw new Error("Not enough energy");
  }

  let updatedMatch = spendSpell(match, playerId, player, spellCard, handIndex);

  if (spellCard.effect.type === "DRAW_CARDS") {
    const currentPlayer = updatedMatch.players[playerId];
    const { newDeck, drawn } = drawCards(currentPlayer.deck, spellCard.effect.value);

    updatedMatch = {
      ...updatedMatch,
      players: {
        ...updatedMatch.players,
        [playerId]: {
          ...currentPlayer,
          deck: newDeck,
          hand: [...currentPlayer.hand, ...drawn]
        }
      }
    };

    return updatedMatch;
  }

  if (!targetInstanceId) {
    if (spellCard.effect.type === "DESTROY_DAMAGED_UNIT") {
      throw new Error("Spell requires a target");
    }
    if (spellCard.effect.type === "DAMAGE_UNIT") {
      throw new Error("Spell requires a target");
    }
    if (spellCard.effect.type === "HEAL_UNIT") {
      throw new Error("Spell requires a target");
    }
    if (spellCard.effect.type === "BUFF_UNIT") {
      throw new Error("Spell requires a target");
    }
  }

  let targetOwnerId: PlayerId | null = null;

  if (targetInstanceId) {
    try {
      findUnit(updatedMatch.players.P1, targetInstanceId);
      targetOwnerId = "P1";
    } catch {
      try {
        findUnit(updatedMatch.players.P2, targetInstanceId);
        targetOwnerId = "P2";
      } catch {
        throw new Error("Target unit not found");
      }
    }
  }

  if (!targetOwnerId || !targetInstanceId) {
    return updatedMatch;
  }

  const targetPlayer = updatedMatch.players[targetOwnerId];
  const { lane, unitIndex } = findUnit(targetPlayer, targetInstanceId);
  const unit = targetPlayer.board[lane][unitIndex];

  let updatedUnit = unit;

  if (spellCard.effect.type === "DAMAGE_UNIT") {
    updatedUnit = applyDamageToUnit(unit, spellCard.effect.value);
  }

  if (spellCard.effect.type === "HEAL_UNIT") {
    updatedUnit = {
      ...unit,
      health: Math.min(unit.maxHealth ?? unit.health, unit.health + spellCard.effect.value)
    };
  }

  if (spellCard.effect.type === "BUFF_UNIT") {
    updatedUnit = {
      ...unit,
      attack: unit.attack + spellCard.effect.attack,
      health: unit.health + spellCard.effect.health,
      maxHealth: (unit.maxHealth ?? unit.health) + spellCard.effect.health
    };
  }

  if (spellCard.effect.type === "DESTROY_DAMAGED_UNIT") {
    if (unit.health < (unit.maxHealth ?? unit.health)) {
      updatedUnit = {
        ...unit,
        health: 0
      };
    }
  }

  const updatedLane = [...targetPlayer.board[lane]];
  updatedLane[unitIndex] = updatedUnit;

  updatedMatch = {
    ...updatedMatch,
    players: {
      ...updatedMatch.players,
      [targetOwnerId]: {
        ...targetPlayer,
        board: {
          ...targetPlayer.board,
          [lane]: updatedLane
        }
      }
    }
  };

  updatedMatch = cleanupDeadUnits(updatedMatch);
  updatedMatch = updateWinner(updatedMatch);

  return updatedMatch;
}

export function attackUnit(
  match: MatchState,
  playerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string
): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.activePlayer !== playerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "combat") {
    throw new Error("Can only attack during combat phase");
  }

  const attackerPlayer = match.players[playerId];
  const defenderPlayerId = getOpponentId(playerId);
  const defenderPlayer = match.players[defenderPlayerId];

  const attackerPos = findUnit(attackerPlayer, attackerInstanceId);
  const defenderPos = findUnit(defenderPlayer, defenderInstanceId);

  const attacker = attackerPlayer.board[attackerPos.lane][attackerPos.unitIndex];
  const defender = defenderPlayer.board[defenderPos.lane][defenderPos.unitIndex];

  if (attacker.exhausted) {
    throw new Error("Unit is exhausted");
  }

  if (attacker.summoningSick) {
    throw new Error("Unit has summoning sickness");
  }

  let updatedAttacker = applyDamageToUnit(attacker, defender.attack);
  updatedAttacker = {
    ...updatedAttacker,
    exhausted: true
  };

  const updatedDefender = applyDamageToUnit(defender, attacker.attack);

  const updatedAttackerLane = [...attackerPlayer.board[attackerPos.lane]];
  updatedAttackerLane[attackerPos.unitIndex] = updatedAttacker;

  const updatedDefenderLane = [...defenderPlayer.board[defenderPos.lane]];
  updatedDefenderLane[defenderPos.unitIndex] = updatedDefender;

  let updatedMatch: MatchState = {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...attackerPlayer,
        board: {
          ...attackerPlayer.board,
          [attackerPos.lane]: updatedAttackerLane
        }
      },
      [defenderPlayerId]: {
        ...defenderPlayer,
        board: {
          ...defenderPlayer.board,
          [defenderPos.lane]: updatedDefenderLane
        }
      }
    }
  };

  updatedMatch = cleanupDeadUnits(updatedMatch);
  updatedMatch = updateWinner(updatedMatch);

  return updatedMatch;
}

export function attackPlayer(
  match: MatchState,
  playerId: PlayerId,
  attackerInstanceId: string
): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.activePlayer !== playerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "combat") {
    throw new Error("Can only attack during combat phase");
  }

  const attackerPlayer = match.players[playerId];
  const defenderPlayerId = getOpponentId(playerId);
  const defenderPlayer = match.players[defenderPlayerId];

  if (defenderPlayer.board.front.length > 0) {
    throw new Error("Cannot attack player directly while enemy front lane has units");
  }

  const attackerPos = findUnit(attackerPlayer, attackerInstanceId);
  const attacker = attackerPlayer.board[attackerPos.lane][attackerPos.unitIndex];

  if (attacker.exhausted) {
    throw new Error("Unit is exhausted");
  }

  if (attacker.summoningSick) {
    throw new Error("Unit has summoning sickness");
  }

  const updatedAttacker: UnitInPlay = {
    ...attacker,
    exhausted: true
  };

  const updatedAttackerLane = [...attackerPlayer.board[attackerPos.lane]];
  updatedAttackerLane[attackerPos.unitIndex] = updatedAttacker;

  let updatedMatch: MatchState = {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...attackerPlayer,
        board: {
          ...attackerPlayer.board,
          [attackerPos.lane]: updatedAttackerLane
        }
      },
      [defenderPlayerId]: {
        ...defenderPlayer,
        health: defenderPlayer.health - attacker.attack
      }
    }
  };

  updatedMatch = updateWinner(updatedMatch);

  return updatedMatch;
}

export function endTurn(match: MatchState): MatchState {
  if (match.winner) {
    throw new Error("Match is already over");
  }

  if (match.phase !== "end") {
    throw new Error("Turn can only end from end phase");
  }

  const endingPlayerId = match.activePlayer;
  const nextPlayerId: PlayerId = endingPlayerId === "P1" ? "P2" : "P1";
  const nextPlayer = match.players[nextPlayerId];

  const refreshedFront = nextPlayer.board.front.map((unit) => ({
    ...unit,
    exhausted: false,
    summoningSick: false
  }));

  const refreshedBack = nextPlayer.board.back.map((unit) => ({
    ...unit,
    exhausted: false,
    summoningSick: false
  }));

  const nextMaxEnergy = Math.min(10, nextPlayer.maxEnergy + 1);
  const { newDeck, drawn } = drawCards(nextPlayer.deck, 1);

  let updatedMatch: MatchState = {
    ...match,
    turn: match.turn + 1,
    activePlayer: nextPlayerId,
    phase: "main",
    players: {
      ...match.players,
      [nextPlayerId]: {
        ...nextPlayer,
        maxEnergy: nextMaxEnergy,
        energy: nextMaxEnergy,
        deck: newDeck,
        hand: [...nextPlayer.hand, ...drawn],
        board: {
          front: refreshedFront,
          back: refreshedBack
        },
        turnFlags: {
          ...nextPlayer.turnFlags,
          firstUnitPlayed: false,
          firstUnitCostReduction: 0
        }
      }
    }
  };

  updatedMatch = emitEvent(updatedMatch, {
    type: "TURN_END",
    playerId: endingPlayerId
  });

  updatedMatch = emitEvent(updatedMatch, {
    type: "TURN_START",
    playerId: nextPlayerId
  });

  return updatedMatch;
}