import {
    createFixedTestMatch,
    playUnitFromHand,
    playSpellFromHand,
    goToCombatPhase,
    goToEndPhase,
    endTurn
  } from "../engine/setup";
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
  printBoard(match, "START SPELL MATCH");
  
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
  
  const scout = match.players.P2.board.front[0];
  
  match = playSpellFromHand(match, "P1", 0, scout.instanceId);
  printBoard(match, "AFTER P1 CASTS FIREBOLT");