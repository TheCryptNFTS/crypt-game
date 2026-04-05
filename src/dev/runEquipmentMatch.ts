import {
    createFixedTestMatch,
    playUnitFromHand,
    playEquipmentFromHand
  } from "../engine/setup";
  import { MatchState } from "../engine/state";
  
  function printState(title: string, match: MatchState) {
    console.log(`\n=== ${title} ===`);
    console.log(
      JSON.stringify(
        {
          turn: match.turn,
          activePlayer: match.activePlayer,
          phase: match.phase,
          winner: match.winner,
          p1: {
            health: match.players.P1.health,
            energy: match.players.P1.energy,
            hand: match.players.P1.hand,
            front: match.players.P1.board.front.map((u) => ({
              instanceId: u.instanceId,
              cardId: u.cardId,
              attack: u.attack,
              health: u.health,
              armor: u.armor
            })),
            discard: match.players.P1.discard
          },
          p2: {
            health: match.players.P2.health,
            energy: match.players.P2.energy,
            hand: match.players.P2.hand,
            front: match.players.P2.board.front.map((u) => ({
              instanceId: u.instanceId,
              cardId: u.cardId,
              attack: u.attack,
              health: u.health,
              armor: u.armor
            })),
            discard: match.players.P2.discard
          }
        },
        null,
        2
      )
    );
  }
  
  let match = createFixedTestMatch();
  
  /*
    Force a deterministic equipment test.
    We put Riot Shield directly in P1 hand so the script stops relying on random draws.
  */
  match = {
    ...match,
    players: {
      ...match.players,
      P1: {
        ...match.players.P1,
        hand: ["unit_stone_guard", "eq_riot_shield", "spell_firebolt", "spell_mend"],
        energy: 10,
        maxEnergy: 10
      },
      P2: {
        ...match.players.P2,
        hand: ["unit_bronze_scout", "eq_axe"],
        energy: 10,
        maxEnergy: 10
      }
    }
  };
  
  printState("START EQUIPMENT MATCH", match);
  
  // P1 plays Stone Guard
  const stoneGuardIndex = match.players.P1.hand.indexOf("unit_stone_guard");
  if (stoneGuardIndex === -1) {
    throw new Error("P1 Stone Guard not found in hand");
  }
  
  match = playUnitFromHand(match, "P1", stoneGuardIndex, "front");
  printState("AFTER P1 PLAYS STONE GUARD", match);
  
  // Find the unit we just played
  const targetUnit = match.players.P1.board.front[0];
  if (!targetUnit) {
    throw new Error("P1 front unit not found");
  }
  
  // P1 equips Riot Shield immediately
  const riotShieldIndex = match.players.P1.hand.indexOf("eq_riot_shield");
  if (riotShieldIndex === -1) {
    throw new Error("P1 Riot Shield not found in hand");
  }
  
  match = playEquipmentFromHand(match, "P1", riotShieldIndex, targetUnit.instanceId);
  printState("AFTER P1 EQUIPS RIOT SHIELD", match);