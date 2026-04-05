import {
    createMatch,
    playUnitFromHand,
    playEquipmentFromHand,
    playSpellFromHand,
    goToCombatPhase,
    goToEndPhase,
    endTurn
  } from "../engine/setup";
  import { attackUnit } from "../engine/combat";
  import { MatchState, PlayerId } from "../engine/state";
  
  function getOpponentId(playerId: PlayerId): PlayerId {
    return playerId === "P1" ? "P2" : "P1";
  }
  
  function getFrontUnitInstanceId(match: MatchState, playerId: PlayerId): string | null {
    return match.players[playerId].board.front[0]?.instanceId ?? null;
  }
  
  function logState(match: MatchState, label: string) {
    console.log(`\n=== ${label} ===`);
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
  
  function takeBestAction(match: MatchState): MatchState {
    const playerId = match.activePlayer;
    const opponentId = getOpponentId(playerId);
    const player = match.players[playerId];
    const opponentFront = getFrontUnitInstanceId(match, opponentId);
    const ownFront = getFrontUnitInstanceId(match, playerId);
  
    const spellIndex = player.hand.findIndex((c) => c === "spell_firebolt");
    if (spellIndex !== -1 && opponentFront) {
      try {
        return playSpellFromHand(match, playerId, spellIndex, opponentFront);
      } catch {}
    }
  
    const unitIndex = player.hand.findIndex((c) => c.startsWith("unit_"));
    if (unitIndex !== -1) {
      try {
        return playUnitFromHand(match, playerId, unitIndex, "front");
      } catch {}
    }
  
    const eqIndex = player.hand.findIndex((c) => c.startsWith("eq_"));
    if (eqIndex !== -1 && ownFront) {
      try {
        return playEquipmentFromHand(match, playerId, eqIndex, ownFront);
      } catch {}
    }
  
    return match;
  }
  
  let match = createMatch();
  logState(match, "AI MATCH START");
  
  for (let i = 0; i < 20; i++) {
    match = takeBestAction(match);
  
    try {
      match = goToCombatPhase(match);
    } catch {}
  
    const attackerId = getFrontUnitInstanceId(match, match.activePlayer);
    const defenderId = getFrontUnitInstanceId(match, getOpponentId(match.activePlayer));
  
    if (attackerId && defenderId) {
      try {
        match = attackUnit(match, match.activePlayer, attackerId, defenderId);
      } catch {}
    }
  
    try {
      match = goToEndPhase(match);
      match = endTurn(match);
    } catch {}
  
    logState(match, `AFTER TURN ${i + 1}`);
  
    if (match.winner) {
      break;
    }
  }
  
  logState(match, "AI MATCH END");