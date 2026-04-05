import {
    createFixedTestMatch,
    playUnitFromHand,
    goToCombatPhase,
    goToEndPhase,
    endTurn
  } from "../engine/setup";
  import { attackUnit } from "../engine/combat";
  import { MatchState } from "../engine/state";
  
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
              instanceId: u.instanceId,
              cardId: u.cardId,
              attack: u.attack,
              health: u.health,
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
              instanceId: u.instanceId,
              cardId: u.cardId,
              attack: u.attack,
              health: u.health,
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
  
  let match = createFixedTestMatch();
  printBoard(match, "START MATCH");
  
  match = playUnitFromHand(match, "P1", 0, "front");
  printBoard(match, "AFTER P1 PLAYS STONE GUARD");
  
  match = goToCombatPhase(match);
  match = goToEndPhase(match);
  match = endTurn(match);
  printBoard(match, "AFTER P1 ENDS TURN");
  
  match = playUnitFromHand(match, "P2", 0, "front");
  printBoard(match, "AFTER P2 PLAYS BRONZE SCOUT");
  
  match = goToCombatPhase(match);
  match = goToEndPhase(match);
  match = endTurn(match);
  printBoard(match, "AFTER P2 ENDS TURN");
  
  const p1Guard = match.players.P1.board.front[0];
  const p2Scout = match.players.P2.board.front[0];
  
  match = goToCombatPhase(match);
  match = attackUnit(match, "P1", p1Guard.instanceId, p2Scout.instanceId);
  printBoard(match, "AFTER P1 ATTACKS BRONZE SCOUT");
  
  match = goToEndPhase(match);
  match = endTurn(match);
  printBoard(match, "AFTER P1 ENDS TURN AGAIN");
  
  const p2ScoutAgain = match.players.P2.board.front[0];
  const p1GuardAgain = match.players.P1.board.front[0];
  
  match = goToCombatPhase(match);
  match = attackUnit(match, "P2", p2ScoutAgain.instanceId, p1GuardAgain.instanceId);
  printBoard(match, "AFTER P2 ATTACKS BACK");
  
  match = goToEndPhase(match);
  match = endTurn(match);
  printBoard(match, "AFTER P2 ENDS TURN AGAIN");
  
  const p1GuardFinal = match.players.P1.board.front[0];
  const p2ScoutFinal = match.players.P2.board.front[0];
  
  match = goToCombatPhase(match);
  match = attackUnit(match, "P1", p1GuardFinal.instanceId, p2ScoutFinal.instanceId);
  printBoard(match, "AFTER P1 FINAL ATTACK");