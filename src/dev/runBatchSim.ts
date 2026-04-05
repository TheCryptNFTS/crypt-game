import { createMatch, playUnitFromHand, playEquipmentFromHand, goToCombatPhase, goToEndPhase, endTurn } from "../engine/setup";
import { attackUnit } from "../engine/combat";
import { MatchState, PlayerId } from "../engine/state";

function findPlayableUnitIndex(hand: string[]): number {
  return hand.findIndex((cardId) => cardId.startsWith("unit_"));
}

function findPlayableEquipmentIndex(hand: string[]): number {
  return hand.findIndex((cardId) => cardId.startsWith("eq_"));
}

function getFrontUnitInstanceId(match: MatchState, playerId: PlayerId): string | null {
  return match.players[playerId].board.front[0]?.instanceId ?? null;
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function runSingleMatch(maxTurns = 30): { winner: string | null; turns: number } {
  let match = createMatch();

  for (let i = 0; i < maxTurns; i++) {
    const activePlayer = match.activePlayer;
    const opponent = getOpponentId(activePlayer);
    const player = match.players[activePlayer];

    const unitIndex = findPlayableUnitIndex(player.hand);
    if (unitIndex !== -1) {
      try {
        match = playUnitFromHand(match, activePlayer, unitIndex, "front");
      } catch {}
    }

    const updatedPlayer = match.players[activePlayer];
    const equipmentIndex = findPlayableEquipmentIndex(updatedPlayer.hand);
    const ownFront = getFrontUnitInstanceId(match, activePlayer);

    if (equipmentIndex !== -1 && ownFront) {
      try {
        match = playEquipmentFromHand(match, activePlayer, equipmentIndex, ownFront);
      } catch {}
    }

    try {
      match = goToCombatPhase(match);
    } catch {}

    const myFront = getFrontUnitInstanceId(match, activePlayer);
    const enemyFront = getFrontUnitInstanceId(match, opponent);

    if (myFront && enemyFront) {
      try {
        match = attackUnit(match, activePlayer, myFront, enemyFront);
      } catch {}
    }

    try {
      match = goToEndPhase(match);
      match = endTurn(match);
    } catch {}

    if (match.winner) {
      return { winner: match.winner, turns: match.turn };
    }
  }

  return { winner: null, turns: match.turn };
}

function runBatch(totalMatches: number) {
  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;
  let totalTurns = 0;

  for (let i = 0; i < totalMatches; i++) {
    const result = runSingleMatch();

    if (result.winner === "P1") p1Wins++;
    else if (result.winner === "P2") p2Wins++;
    else draws++;

    totalTurns += result.turns;
  }

  console.log(`\n=== BATCH RESULTS (${totalMatches} MATCHES) ===`);
  console.log({
    totalMatches,
    p1Wins,
    p2Wins,
    draws,
    averageTurns: Number((totalTurns / totalMatches).toFixed(2))
  });
}

runBatch(100);