import {
    createMatch,
    playUnitFromHand,
    playEquipmentFromHand,
    goToCombatPhase,
    goToEndPhase,
    endTurn
  } from "../engine/setup";
  import { attackHero, attackUnit } from "../engine/combat";
  import { MatchState, PlayerId } from "../engine/state";
  
  function printBoard(match: MatchState, title: string) {
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
              cardId: u.cardId,
              hp: u.health,
              atk: u.attack,
              armor: u.armor,
              exhausted: u.exhausted,
              summoningSick: u.summoningSick
            })),
            discard: match.players.P1.discard
          },
          p2: {
            health: match.players.P2.health,
            energy: match.players.P2.energy,
            hand: match.players.P2.hand,
            front: match.players.P2.board.front.map((u) => ({
              cardId: u.cardId,
              hp: u.health,
              atk: u.attack,
              armor: u.armor,
              exhausted: u.exhausted,
              summoningSick: u.summoningSick
            })),
            discard: match.players.P2.discard
          }
        },
        null,
        2
      )
    );
  }
  
  function tryPlayBestUnit(match: MatchState, playerId: PlayerId): MatchState {
    const player = match.players[playerId];
  
    for (let i = 0; i < player.hand.length; i++) {
      const cardId = player.hand[i];
  
      if (!cardId.startsWith("unit_")) {
        continue;
      }
  
      try {
        return playUnitFromHand(match, playerId, i, "front");
      } catch {
        continue;
      }
    }
  
    return match;
  }
  
  function tryPlayBestEquipment(match: MatchState, playerId: PlayerId): MatchState {
    const player = match.players[playerId];
    const target = player.board.front[0];
  
    if (!target) {
      return match;
    }
  
    for (let i = 0; i < player.hand.length; i++) {
      const cardId = player.hand[i];
  
      if (!cardId.startsWith("eq_")) {
        continue;
      }
  
      try {
        return playEquipmentFromHand(match, playerId, i, target.instanceId);
      } catch {
        continue;
      }
    }
  
    return match;
  }
  
  function tryAttack(match: MatchState, playerId: PlayerId): MatchState {
    const attacker = match.players[playerId].board.front.find(
      (unit) => !unit.exhausted && !unit.summoningSick
    );
  
    if (!attacker) {
      return match;
    }
  
    const enemyId = playerId === "P1" ? "P2" : "P1";
    const enemyFront = match.players[enemyId].board.front;
  
    try {
      if (enemyFront.length > 0) {
        return attackUnit(match, playerId, attacker.instanceId, enemyFront[0].instanceId);
      }
  
      return attackHero(match, playerId, attacker.instanceId);
    } catch {
      return match;
    }
  }
  
  function playTurn(match: MatchState): MatchState {
    const playerId = match.activePlayer;
  
    match = tryPlayBestUnit(match, playerId);
    match = tryPlayBestEquipment(match, playerId);
  
    match = goToCombatPhase(match);
    match = tryAttack(match, playerId);
    match = goToEndPhase(match);
    match = endTurn(match);
  
    return match;
  }
  
  let match = createMatch();
  printBoard(match, "FULL MATCH START");
  
  for (let i = 0; i < 20; i++) {
    if (match.winner) {
      break;
    }
  
    match = playTurn(match);
    printBoard(match, `AFTER TURN ${match.turn - 1}`);
  }
  
  printBoard(match, "FULL MATCH END");