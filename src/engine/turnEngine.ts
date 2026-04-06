import { MatchState } from "./state";
import { postActionStatePass } from "./effectSystem";

type PlayerId = "P1" | "P2";

function cloneMatch(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match));
}

function getPlayer(match: MatchState, playerId: PlayerId): any {
  return (match as any).players[playerId];
}

function getEnemyId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function drawOne(player: any) {
  if (!Array.isArray(player.deck)) player.deck = [];
  if (!Array.isArray(player.hand)) player.hand = [];
  if (player.deck.length === 0) return;

  const nextCard = player.deck.shift();
  if (nextCard) player.hand.push(nextCard);
}

function readyUnits(player: any) {
  const front = player.board?.front || [];
  for (const unit of front) {
    unit.exhausted = false;
    unit.summoningSick = false;
  }
}

function rampEnergy(player: any, turn: number) {
  const cap = 10;
  const nextMax = Math.min(cap, Math.max(player.maxEnergy ?? 0, Math.min(cap, turn)));
  player.maxEnergy = nextMax;
  player.energy = nextMax;
}

export function startTurn(match: MatchState): MatchState {
  const next = cloneMatch(match);
  const activePlayer = (next as any).activePlayer as PlayerId;
  const player = getPlayer(next, activePlayer);

  rampEnergy(player, (next as any).turn ?? 1);
  drawOne(player);
  readyUnits(player);
  (next as any).phase = "main";

  return postActionStatePass(next);
}

export function endTurn(match: MatchState): MatchState {
  const next = cloneMatch(match);
  const current = (next as any).activePlayer as PlayerId;
  const enemy = getEnemyId(current);

  (next as any).activePlayer = enemy;
  (next as any).turn = ((next as any).turn ?? 1) + 1;

  return startTurn(next);
}
