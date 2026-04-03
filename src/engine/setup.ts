import decks from "../data/decks.json";
import units from "../data/units.json";
import equipment from "../data/equipment.json";
import spells from "../data/spells.json";
import { emitEvent } from "./events";
import { cleanupDeadUnits } from "./cleanup";
import { MatchState, PlayerId, PlayerState, Lane, UnitInPlay } from "./state";

type SpellCard = {
  id: string;
  name: string;
  type: "spell";
  faction: string;
  rarity: string;
  cost: number;
  effect:
    | { type: "DAMAGE_UNIT"; value: number }
    | { type: "DRAW_CARDS"; value: number }
    | { type: "BUFF_UNIT"; attack: number; health: number }
    | { type: "HEAL_UNIT"; value: number }
    | { type: "DESTROY_DAMAGED_UNIT" };
};

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

function createPlayer(
  playerId: PlayerId,
  deckKey: "deck_stone_test" | "deck_bronze_test"
): PlayerState {
  const deckDef = decks[deckKey];
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

export function createFixedTestMatch(): MatchState {
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

function spendSpell(
  match: MatchState,
  playerId: PlayerId,
  player: PlayerState,
  spellCard: SpellCard,
  handIndex: number
) {
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

export function goToCombatPhase(match: MatchState): MatchState {
  if (match.phase !== "main") {
    throw new Error("Can only move to combat from main phase");
  }

  return {
    ...match,
    phase: "combat"
  };
}

export function goToEndPhase(match: MatchState): MatchState {
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

  const unitCard = units.find((u) => u.id === cardId);

  if (!unitCard) {
    throw new Error("Selected card is not a unit");
  }

  const reduction =
    !player.turnFlags.firstUnitPlayed ? player.turnFlags.firstUnitCostReduction : 0;

  const finalCost = Math.max(0, unitCard.cost - reduction);

  if (player.energy < finalCost) {
    throw new Error("Not enough energy");
  }

  if (player.board[lane].length >= 3) {
    throw new Error(`Lane ${lane} is full`);
  }

  const instance: UnitInPlay = {
    instanceId: makeInstanceId(),
    cardId: unitCard.id,
    lane,
    attack: unitCard.stats.attack,
    health: unitCard.stats.health,
    speed: unitCard.stats.speed,
    armor: unitCard.stats.armor,
    keywords: unitCard.keywords,
    exhausted: false,
    summoningSick: !unitCard.keywords.includes("RUSH")
  };

  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  let updatedMatch: MatchState = {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        energy: player.energy - finalCost,
        hand: newHand,
        board: {
          ...player.board,
          [lane]: [...player.board[lane], instance]
        },
        turnFlags: {
          firstUnitCostReduction: 0,
          firstUnitPlayed: true
        }
      }
    }
  };

  updatedMatch = emitEvent(updatedMatch, {
    type: "UNIT_PLAYED",
    playerId,
    cardId: unitCard.id,
    instanceId: instance.instanceId
  });

  return updatedMatch;
}

export function playEquipmentFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  targetInstanceId: string
): MatchState {
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

  const equipCard = equipment.find((e) => e.id === cardId);

  if (!equipCard) {
    throw new Error("Selected card is not equipment");
  }

  if (player.energy < equipCard.cost) {
    throw new Error("Not enough energy");
  }

  const { lane, unitIndex } = findUnit(player, targetInstanceId);
  const targetUnit = player.board[lane][unitIndex];

  const updatedUnit: UnitInPlay = {
    ...targetUnit,
    attack: targetUnit.attack + equipCard.effect.attack,
    health: targetUnit.health + equipCard.effect.health,
    speed: targetUnit.speed + equipCard.effect.speed,
    armor: targetUnit.armor + equipCard.effect.armor
  };

  const updatedLaneUnits = [...player.board[lane]];
  updatedLaneUnits[unitIndex] = updatedUnit;

  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        energy: player.energy - equipCard.cost,
        hand: newHand,
        discard: [...player.discard, equipCard.id],
        board: {
          ...player.board,
          [lane]: updatedLaneUnits
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
  if (match.activePlayer !== playerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "main") {
    throw new Error("Spells can only be played during main phase");
  }

  const player = match.players[playerId];
  const enemyId: PlayerId = playerId === "P1" ? "P2" : "P1";
  const enemy = match.players[enemyId];
  const cardId = player.hand[handIndex];

  if (!cardId) {
    throw new Error("No card in that hand slot");
  }

  const spellCard = spells.find((s) => s.id === cardId) as SpellCard | undefined;

  if (!spellCard) {
    throw new Error("Selected card is not a spell");
  }

  if (player.energy < spellCard.cost) {
    throw new Error("Not enough energy");
  }

  if (spellCard.effect.type === "DRAW_CARDS") {
    const newHandBase = [...player.hand];
    newHandBase.splice(handIndex, 1);

    const { newDeck, drawn } = drawCards(player.deck, spellCard.effect.value);

    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...player,
          energy: player.energy - spellCard.cost,
          deck: newDeck,
          hand: [...newHandBase, ...drawn],
          discard: [...player.discard, spellCard.id]
        }
      }
    };
  }

  if (!targetInstanceId) {
    throw new Error("This spell requires a target");
  }

  if (spellCard.effect.type === "DAMAGE_UNIT") {
    const { lane, unitIndex } = findUnit(enemy, targetInstanceId);
    const targetUnit = enemy.board[lane][unitIndex];

    let remainingDamage = spellCard.effect.value;
    let nextArmor = targetUnit.armor;

    if (nextArmor > 0) {
      const blocked = Math.min(nextArmor, remainingDamage);
      nextArmor -= blocked;
      remainingDamage -= blocked;
    }

    const updatedUnit: UnitInPlay = {
      ...targetUnit,
      armor: nextArmor,
      health: targetUnit.health - remainingDamage
    };

    const updatedEnemyLane = [...enemy.board[lane]];
    updatedEnemyLane[unitIndex] = updatedUnit;

    let updatedMatch: MatchState = spendSpell(match, playerId, player, spellCard, handIndex);

    updatedMatch = {
      ...updatedMatch,
      players: {
        ...updatedMatch.players,
        [enemyId]: {
          ...updatedMatch.players[enemyId],
          board: {
            ...updatedMatch.players[enemyId].board,
            [lane]: updatedEnemyLane
          }
        }
      }
    };

    return cleanupDeadUnits(updatedMatch);
  }

  if (spellCard.effect.type === "BUFF_UNIT") {
    const { lane, unitIndex } = findUnit(player, targetInstanceId);
    const targetUnit = player.board[lane][unitIndex];

    const updatedUnit: UnitInPlay = {
      ...targetUnit,
      attack: targetUnit.attack + spellCard.effect.attack,
      health: targetUnit.health + spellCard.effect.health
    };

    const updatedLane = [...player.board[lane]];
    updatedLane[unitIndex] = updatedUnit;

    let updatedMatch: MatchState = spendSpell(match, playerId, player, spellCard, handIndex);

    updatedMatch = {
      ...updatedMatch,
      players: {
        ...updatedMatch.players,
        [playerId]: {
          ...updatedMatch.players[playerId],
          board: {
            ...updatedMatch.players[playerId].board,
            [lane]: updatedLane
          }
        }
      }
    };

    return updatedMatch;
  }

  if (spellCard.effect.type === "HEAL_UNIT") {
    const { lane, unitIndex } = findUnit(player, targetInstanceId);
    const targetUnit = player.board[lane][unitIndex];

    const updatedUnit: UnitInPlay = {
      ...targetUnit,
      health: targetUnit.health + spellCard.effect.value
    };

    const updatedLane = [...player.board[lane]];
    updatedLane[unitIndex] = updatedUnit;

    let updatedMatch: MatchState = spendSpell(match, playerId, player, spellCard, handIndex);

    updatedMatch = {
      ...updatedMatch,
      players: {
        ...updatedMatch.players,
        [playerId]: {
          ...updatedMatch.players[playerId],
          board: {
            ...updatedMatch.players[playerId].board,
            [lane]: updatedLane
          }
        }
      }
    };

    return updatedMatch;
  }

  if (spellCard.effect.type === "DESTROY_DAMAGED_UNIT") {
    const { lane, unitIndex } = findUnit(enemy, targetInstanceId);
    const targetUnit = enemy.board[lane][unitIndex];

    const baseUnit = units.find((u) => u.id === targetUnit.cardId);
    if (!baseUnit) {
      throw new Error("Base unit definition not found");
    }

    if (targetUnit.health >= baseUnit.stats.health) {
      throw new Error("Execute requires a damaged unit");
    }

    const updatedUnit: UnitInPlay = {
      ...targetUnit,
      health: 0
    };

    const updatedEnemyLane = [...enemy.board[lane]];
    updatedEnemyLane[unitIndex] = updatedUnit;

    let updatedMatch: MatchState = spendSpell(match, playerId, player, spellCard, handIndex);

    updatedMatch = {
      ...updatedMatch,
      players: {
        ...updatedMatch.players,
        [enemyId]: {
          ...updatedMatch.players[enemyId],
          board: {
            ...updatedMatch.players[enemyId].board,
            [lane]: updatedEnemyLane
          }
        }
      }
    };

    return cleanupDeadUnits(updatedMatch);
  }

  throw new Error("Unknown spell effect type");
}

export function endTurn(match: MatchState): MatchState {
  if (match.phase !== "end") {
    throw new Error("Turn can only end from end phase");
  }

  const currentPlayerId = match.activePlayer;
  const nextPlayerId: PlayerId = currentPlayerId === "P1" ? "P2" : "P1";

  let updatedMatch = emitEvent(match, {
    type: "TURN_END",
    playerId: currentPlayerId
  });

  const nextPlayer = updatedMatch.players[nextPlayerId];

  const newMaxEnergy = Math.min(nextPlayer.maxEnergy + 1, 7);
  const drawnCard = nextPlayer.deck[0];
  const newDeck = drawnCard ? nextPlayer.deck.slice(1) : nextPlayer.deck;
  const newHand = drawnCard ? [...nextPlayer.hand, drawnCard] : nextPlayer.hand;

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

  updatedMatch = {
    ...updatedMatch,
    turn: updatedMatch.turn + 1,
    activePlayer: nextPlayerId,
    phase: "main",
    players: {
      ...updatedMatch.players,
      [nextPlayerId]: {
        ...nextPlayer,
        maxEnergy: newMaxEnergy,
        energy: newMaxEnergy,
        deck: newDeck,
        hand: newHand,
        board: {
          front: refreshedFront,
          back: refreshedBack
        },
        turnFlags: {
          firstUnitCostReduction: 0,
          firstUnitPlayed: false
        }
      }
    }
  };

  updatedMatch = emitEvent(updatedMatch, {
    type: "TURN_START",
    playerId: nextPlayerId
  });

  return updatedMatch;
}