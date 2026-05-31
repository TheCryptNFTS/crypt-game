import { getStoredCardModifier, applyModifierToUnitLike, applyModifierToEquippedTarget } from "./applyCommanderCardModifiers";
import decks from "../data/decks.json";
import units from "../data/units.json";
import { getLoadedCommanderById } from "../data/loadCommanders";
import { getLoadedUnitById } from "../data/loadAllUnits";
import { emitEvent } from "./events";
import { MatchState, PlayerId, PlayerState, Lane, UnitInPlay, STARTING_NEXUS_HEALTH } from "./state";

import { getPlayableCardById, assertNoDisabledCards } from "./cards";
import { applyCardOverride } from "./cardOverrides";
import { makeRng, shuffle as seededShuffle, Rng } from "./rng";

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

function createPlayer(playerId: PlayerId, deckKey: DeckKey, rng: Rng): PlayerState {
  const deckDef = decks[deckKey];

  assertCommanderExists(deckDef.commanderId);

  // BUG 3 FIX: enforce the override-layer soft-ban on the sandbox path too. The
  // legacy unit_* cards here aren't in the catalog, so isCardDisabled is false
  // for them (no false positives); only a genuinely disabled catalog card trips.
  assertNoDisabledCards(deckDef.cardIds as string[], `${playerId} sandbox deck`);

  const shuffledDeck = seededShuffle(deckDef.cardIds, rng);
  const { newDeck, drawn } = drawCards(shuffledDeck, 3);

  return {
    id: playerId,
    health: 30,
    nexusHealth: STARTING_NEXUS_HEALTH,
    energy: 1,
    maxEnergy: 1,
    commanderId: deckDef.commanderId,
    deck: newDeck,
    hand: drawn,
    discard: [],
    graveyard: [],
    deckCount: newDeck.length,
    artifacts: [],
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

export function createMatch(seed: number = Date.now()): MatchState {
  const rng = makeRng(seed);
  return {
    turn: 1,
    activePlayer: "P1",
    winner: null,
    seed,
    idCounter: 0,
    rngCursor: 0,
    players: {
      P1: createPlayer("P1", "deck_stone_test", rng),
      P2: createPlayer("P2", "deck_bronze_test", rng)
    }
  };
}

/**
 * Dev-only: legacy match seeded from bundled `decks.json` test decks
 * (not the curated commander + main-deck bootstrap).
 */
export function createSandboxMatch(seed?: number): MatchState {
  return createMatch(seed);
}

export function createFixedTestMatch(): MatchState {
  assertCommanderExists("cmd_stone_warden");
  assertCommanderExists("cmd_bronze_raider");

  return {
    turn: 1,
    activePlayer: "P1",
    winner: null,
    seed: 0,
    idCounter: 0,
    rngCursor: 0,
    players: {
      P1: {
        id: "P1",
        health: 30,
        nexusHealth: STARTING_NEXUS_HEALTH,
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
        graveyard: [],
        deckCount: 4,
        artifacts: [],
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
        nexusHealth: STARTING_NEXUS_HEALTH,
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
        graveyard: [],
        deckCount: 3,
        artifacts: [],
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

/**
 * Deterministic instance id derived from the match seed + a monotonic counter.
 * Returns the id and the next counter value; the caller must persist
 * `nextCounter` onto the updated match state so ids stay unique and
 * reproducible for a given seed + action order.
 */
function makeInstanceId(match: MatchState): { instanceId: string; nextCounter: number } {
  const counter = match.idCounter ?? 0;
  return {
    instanceId: `unit_${match.seed}_${counter}`,
    nextCounter: counter + 1
  };
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
  // BUG 2 FIX — SINGLE SOURCE OF TRUTH for board stats.
  // Board instantiation must derive attack/health/speed/armor/keywords/cost from
  // the SAME override-patched catalog the reducer uses (`cardMetaById` / `costOf`
  // / deck legality all read `allPlayableCards` via `getPlayableCardById`, which
  // applies the versioned override at the single build chokepoint in cards.ts).
  //
  // Previously this read from `getLoadedUnitById` (generatedTcgCards.json), whose
  // `stats` are 0/1 STUBS for every tcg_* card — the real stats live only in
  // runtimeMatchPlayableCards.json (the tuple the catalog consumes). That made a
  // played unit enter the board at 0/1 (e.g. tcg_475: catalog 15/9 -> board 15/1;
  // tcg_86: catalog atk 4 -> board atk 0), diverging from its catalog/overridden
  // line. Read the catalog first so overridden AND non-overridden cards agree.
  const catalogUnit = getPlayableCardById(cardId);
  if (catalogUnit && catalogUnit.type === "unit") {
    return {
      id: catalogUnit.id,
      name: catalogUnit.name,
      type: "unit",
      faction: catalogUnit.faction,
      rarity: catalogUnit.rarity,
      cost: catalogUnit.cost,
      stats: { ...catalogUnit.stats },
      keywords: [...catalogUnit.keywords],
    };
  }

  // Legacy sandbox units (`unit_*`) live only in units.json, not the catalog.
  // Re-apply the override layer here for parity (clones-then-overrides).
  const builtInUnit = (units as UnitCard[]).find((u) => u.id === cardId);
  if (builtInUnit) {
    return applyCardOverride(builtInUnit);
  }

  return applyCardOverride(getLoadedUnitById(cardId) as UnitCard);
}

function getEquipmentCard(cardId: string): EquipmentCard {
  const card = getPlayableCardById(cardId);

  if (!card || card.type !== "equipment") {
    throw new Error(`Selected card is not equipment: ${cardId}`);
  }

  return {
    id: card.id,
    name: card.name,
    type: "equipment",
    faction: card.faction,
    rarity: card.rarity,
    cost: card.cost,
    effect: {
      attack: card.stats.attack,
      health: card.stats.health,
      speed: card.stats.speed,
      armor: card.stats.armor
    },
    keywords: card.keywords,
    rawTraits: card.rawTraits,
    subtype: card.sourceSubtype ?? null
  } as EquipmentCard;
}

export function playUnitFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  lane: Lane
): MatchState {
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

  const { instanceId, nextCounter } = makeInstanceId(match);

  const instance: UnitInPlay = {
    instanceId,
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

  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  const updatedBoard = {
    ...player.board,
    [lane]: [...player.board[lane], instance]
  };

  const updatedMatch = {
    ...match,
    idCounter: nextCounter,
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
  const player = match.players[playerId];
  const cardId = player.hand[handIndex];

  if (!cardId) {
    throw new Error("No card in that hand slot");
  }

  const equipmentCard = getEquipmentCard(cardId);
  const commanderModifier = getStoredCardModifier(match, playerId, cardId);

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

  applyModifierToEquippedTarget(updatedUnit, commanderModifier);
  updatedUnit.maxHealth = Math.max(updatedUnit.maxHealth ?? updatedUnit.health, updatedUnit.health);

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

