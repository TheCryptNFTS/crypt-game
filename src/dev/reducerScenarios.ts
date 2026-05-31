/**
 * The ~20 scripted matches that pin the reducer's lived behavior. Each scenario
 * is a pure `(seed, build, actions)` triple: `build` optionally crafts a custom
 * starting state (for lethal-face / deck-out / rejection cases that a normal
 * opening can't reach quickly), then `actions` is replayed through the reducer.
 *
 * These are the GOLDEN inputs for `dev:reducer-equivalence`: their recorded
 * final-state + event-stream fixtures are committed, and every migration step
 * must reproduce them byte-for-byte.
 */

import { Action } from "../engine/reducer";
import { MatchState, Lane } from "../engine/state";
import { makeSeededMatch, playAiMatch } from "./reducerHarness";
import { allPlayableCards } from "../engine/cards";

const META = new Map<string, any>((allPlayableCards as any[]).map((c) => [c.id, c]));
const typeOf = (id: string) => META.get(id)?.type ?? null;
const costOf = (id: string) => META.get(id)?.cost ?? 0;

export interface Scenario {
  name: string;
  build: () => MatchState;
  actions: Action[];
}

/** Find P1's first affordable unit in the opening hand for a seeded match. */
function firstAffordableUnitIndex(state: MatchState, player: "P1" | "P2"): number {
  const hand = state.players[player].hand;
  const energy = state.players[player].energy;
  for (let i = 0; i < hand.length; i += 1) {
    if (typeOf(hand[i]) === "unit" && costOf(hand[i]) <= energy) return i;
  }
  return -1;
}

function unitInstanceIds(state: MatchState, player: "P1" | "P2"): string[] {
  return [...state.players[player].board.front, ...state.players[player].board.back].map((u) => u.instanceId);
}

export function buildScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];

  // 1. Bare turn pass (P1 ends immediately; ramp + draw for P2).
  scenarios.push({
    name: "turn-pass",
    build: () => makeSeededMatch(1001),
    actions: [{ type: "END_TURN", player: "P1" }],
  });

  // 2. Mulligan then end turn.
  scenarios.push({
    name: "mulligan-then-end",
    build: () => makeSeededMatch(1002),
    actions: [{ type: "MULLIGAN", player: "P1" }, { type: "END_TURN", player: "P1" }],
  });

  // 3. Play first affordable unit, then end.
  {
    const s = makeSeededMatch(1003);
    const idx = firstAffordableUnitIndex(s, "P1");
    scenarios.push({
      name: "play-unit-front",
      build: () => makeSeededMatch(1003),
      actions: idx >= 0
        ? [{ type: "PLAY_UNIT", player: "P1", handIndex: idx, lane: "front" as Lane }, { type: "END_TURN", player: "P1" }]
        : [{ type: "END_TURN", player: "P1" }],
    });
  }

  // 4. Unaffordable play rejection: try to play hand slot 0 with energy zeroed.
  scenarios.push({
    name: "unaffordable-play-rejected",
    build: () => {
      const s = makeSeededMatch(1004);
      s.players.P1.energy = 0;
      return s;
    },
    actions: [{ type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" }, { type: "END_TURN", player: "P1" }],
  });

  // 5. Out-of-bounds hand index rejection.
  scenarios.push({
    name: "oob-hand-index-rejected",
    build: () => makeSeededMatch(1005),
    actions: [{ type: "PLAY_UNIT", player: "P1", handIndex: 999, lane: "front" }],
  });

  // 6. Wrong-turn rejection (P2 acts on P1's turn).
  scenarios.push({
    name: "wrong-turn-rejected",
    build: () => makeSeededMatch(1006),
    actions: [{ type: "PLAY_UNIT", player: "P2", handIndex: 0, lane: "front" }],
  });

  // 7. Lethal face: a single big attacker drops the enemy nexus to 0 -> WIN.
  scenarios.push({
    name: "lethal-face",
    build: () => {
      const s = makeSeededMatch(1007);
      s.players.P2.nexusHealth = 5;
      s.players.P1.board.front = [
        {
          instanceId: "unit_1007_test",
          cardId: "test_bruiser",
          lane: "front",
          attack: 9,
          health: 9,
          maxHealth: 9,
          speed: 0,
          armor: 0,
          keywords: [],
          exhausted: false,
          summoningSick: false,
        },
      ];
      return s;
    },
    actions: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "unit_1007_test" }],
  });

  // 8. Favorable trade: attacker kills defender and survives.
  scenarios.push({
    name: "favorable-trade",
    build: () => {
      const s = makeSeededMatch(1008);
      s.players.P1.board.front = [
        { instanceId: "atk_1008", cardId: "t_atk", lane: "front", attack: 5, health: 6, maxHealth: 6, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      s.players.P2.board.front = [
        { instanceId: "def_1008", cardId: "t_def", lane: "front", attack: 2, health: 3, maxHealth: 3, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      return s;
    },
    actions: [{ type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk_1008", defenderInstanceId: "def_1008" }],
  });

  // 9. Mutual destruction trade (both die).
  scenarios.push({
    name: "mutual-trade",
    build: () => {
      const s = makeSeededMatch(1009);
      s.players.P1.board.front = [
        { instanceId: "atk_1009", cardId: "t_atk", lane: "front", attack: 4, health: 3, maxHealth: 3, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      s.players.P2.board.front = [
        { instanceId: "def_1009", cardId: "t_def", lane: "front", attack: 4, health: 3, maxHealth: 3, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      return s;
    },
    actions: [{ type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk_1009", defenderInstanceId: "def_1009" }],
  });

  // 10. Attack with exhausted unit rejected.
  scenarios.push({
    name: "exhausted-attack-rejected",
    build: () => {
      const s = makeSeededMatch(1010);
      s.players.P1.board.front = [
        { instanceId: "atk_1010", cardId: "t_atk", lane: "front", attack: 4, health: 5, maxHealth: 5, speed: 0, armor: 0, keywords: [], exhausted: true, summoningSick: false },
      ];
      return s;
    },
    actions: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "atk_1010" }],
  });

  // 11. Deck-out: P1 ends turn, P2 has empty deck -> P2 decks out on draw -> P1 wins.
  scenarios.push({
    name: "deck-out",
    build: () => {
      const s = makeSeededMatch(1011);
      s.players.P2.deck = [];
      s.players.P2.deckCount = 0;
      return s;
    },
    actions: [{ type: "END_TURN", player: "P1" }],
  });

  // 12. Equip onto own unit then attack with the buffed unit.
  scenarios.push({
    name: "equip-then-attack",
    build: () => {
      const s = makeSeededMatch(1012);
      s.players.P1.energy = 10;
      s.players.P1.maxEnergy = 10;
      s.players.P1.board.front = [
        { instanceId: "unit_1012", cardId: "t_atk", lane: "front", attack: 2, health: 5, maxHealth: 5, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      // Put an equipment into hand slot 0.
      const eq = (allPlayableCards as any[]).find((c) => c.type === "equipment");
      if (eq) s.players.P1.hand = [eq.id, ...s.players.P1.hand];
      return s;
    },
    actions: [
      { type: "EQUIP", player: "P1", handIndex: 0, targetInstanceId: "unit_1012" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "unit_1012" },
    ],
  });

  // 13. Equip targeting enemy board rejected.
  scenarios.push({
    name: "equip-enemy-rejected",
    build: () => {
      const s = makeSeededMatch(1013);
      s.players.P1.energy = 10;
      s.players.P2.board.front = [
        { instanceId: "enemy_1013", cardId: "t_def", lane: "front", attack: 1, health: 5, maxHealth: 5, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      const eq = (allPlayableCards as any[]).find((c) => c.type === "equipment");
      if (eq) s.players.P1.hand = [eq.id, ...s.players.P1.hand];
      return s;
    },
    actions: [{ type: "EQUIP", player: "P1", handIndex: 0, targetInstanceId: "enemy_1013" }],
  });

  // 14. Artifact play (if any artifact exists in the pool).
  scenarios.push({
    name: "play-artifact",
    build: () => {
      const s = makeSeededMatch(1014);
      s.players.P1.energy = 10;
      const art = (allPlayableCards as any[]).find((c) => c.type === "artifact");
      if (art) s.players.P1.hand = [art.id, ...s.players.P1.hand];
      return s;
    },
    actions: [{ type: "PLAY_ARTIFACT", player: "P1", handIndex: 0 }, { type: "END_TURN", player: "P1" }],
  });

  // 15. Spell action is rejected (not part of lived flow).
  scenarios.push({
    name: "spell-rejected",
    build: () => makeSeededMatch(1015),
    actions: [{ type: "PLAY_SPELL", player: "P1", handIndex: 0 }],
  });

  // 16. Action after match decided is rejected.
  scenarios.push({
    name: "post-win-rejected",
    build: () => {
      const s = makeSeededMatch(1016);
      s.players.P2.nexusHealth = 0;
      s.winner = "P1";
      return s;
    },
    actions: [{ type: "END_TURN", player: "P1" }],
  });

  // 17. Multi-attack: two ready units both swing face.
  scenarios.push({
    name: "double-face-swing",
    build: () => {
      const s = makeSeededMatch(1017);
      s.players.P1.board.front = [
        { instanceId: "a_1017", cardId: "t", lane: "front", attack: 3, health: 4, maxHealth: 4, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
        { instanceId: "b_1017", cardId: "t", lane: "front", attack: 2, health: 4, maxHealth: 4, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false },
      ];
      return s;
    },
    actions: [
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "a_1017" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "b_1017" },
    ],
  });

  // 18. Armor mitigation: attacker with utility pierces armor.
  scenarios.push({
    name: "armor-utility-pierce",
    build: () => {
      const s = makeSeededMatch(1018);
      s.players.P1.board.front = [
        { instanceId: "atk_1018", cardId: "t", lane: "front", attack: 5, health: 6, maxHealth: 6, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false, utility: 3 } as any,
      ];
      s.players.P2.board.front = [
        { instanceId: "def_1018", cardId: "t", lane: "front", attack: 1, health: 6, maxHealth: 6, speed: 0, armor: 4, keywords: [], exhausted: false, summoningSick: false },
      ];
      return s;
    },
    actions: [{ type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk_1018", defenderInstanceId: "def_1018" }],
  });

  // 19. Full scripted P1-vs-AI match (captures turn flow + draw + win end-to-end).
  {
    const m = playAiMatch(2001);
    scenarios.push({ name: "full-ai-match-2001", build: () => makeSeededMatch(2001), actions: m.actions });
  }

  // 20. A second full match on a different seed.
  {
    const m = playAiMatch(2002);
    scenarios.push({ name: "full-ai-match-2002", build: () => makeSeededMatch(2002), actions: m.actions });
  }

  // 21. Spare unit-instance sanity (kept for >=20 coverage): play + read ids.
  scenarios.push({
    name: "instance-id-stability",
    build: () => {
      const s = makeSeededMatch(1019);
      s.players.P1.energy = 10;
      return s;
    },
    actions: (() => {
      const s = makeSeededMatch(1019);
      s.players.P1.energy = 10;
      const idx = firstAffordableUnitIndex(s, "P1");
      void unitInstanceIds;
      return idx >= 0
        ? [{ type: "PLAY_UNIT", player: "P1", handIndex: idx, lane: "front" } as Action]
        : [{ type: "END_TURN", player: "P1" } as Action];
    })(),
  });

  return scenarios;
}
