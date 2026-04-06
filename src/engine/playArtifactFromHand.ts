import { getLoadedArtifactById } from "../data/loadAllArtifacts";
import { MatchState, PlayerId } from "./state";
import { mergeKeywords } from "./keywordEngine";

function applyArtifactEffectTags(match: MatchState, playerId: PlayerId, effectTags: string[]): MatchState {
  const nextMatch = {
    ...match,
    players: {
      ...(match as any).players,
      [playerId]: {
        ...((match as any).players[playerId]),
        board: {
          front: ((match as any).players[playerId].board.front || []).map((u: any) => ({ ...u })),
          back: ((match as any).players[playerId].board.back || []).map((u: any) => ({ ...u }))
        }
      }
    }
  } as MatchState;

  const player = (nextMatch as any).players[playerId];
  const front = player.board.front || [];

  for (const tag of effectTags || []) {
    if (tag === "ARCANE") {
      for (const unit of front) {
        unit.attack = (unit.attack || 0) + 1;
      }
    }

    if (tag === "TECH") {
      for (const unit of front) {
        unit.armor = (unit.armor || 0) + 1;
      }
    }

    if (tag === "MYTHIC") {
      player.health = Math.min(30, (player.health || 0) + 3);
    }

    if (tag === "HUNT" && front[0]) {
      front[0].attack = (front[0].attack || 0) + 2;
    }

    if (tag === "COMMAND" && player.turnFlags) {
      player.turnFlags.firstUnitCostReduction =
        (player.turnFlags.firstUnitCostReduction || 0) + 1;
    }

    if (tag === "RUSH" && front[0]) {
      front[0].keywords = mergeKeywords(front[0].keywords || [], ["RUSH"]);
    }

    if (tag === "GUARD" && front[0]) {
      front[0].keywords = mergeKeywords(front[0].keywords || [], ["GUARD"]);
    }

    if (tag === "FLYING" && front[0]) {
      front[0].keywords = mergeKeywords(front[0].keywords || [], ["FLYING"]);
    }
  }

  return nextMatch;
}

export function playArtifactFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number
): MatchState {
  const player = (match as any).players[playerId];
  const handCardId = player.hand[handIndex];

  if (!handCardId) {
    throw new Error(`No card found in hand at index ${handIndex}`);
  }

  const artifact = getLoadedArtifactById(handCardId) as any;

  if (artifact.type !== "artifact") {
    throw new Error(`Card is not an artifact: ${handCardId}`);
  }

  if ((player.energy || 0) < (artifact.cost || 0)) {
    throw new Error(`Not enough energy to play artifact: ${handCardId}`);
  }

  const nextMatch = {
    ...match,
    players: {
      ...(match as any).players,
      [playerId]: {
        ...player,
        hand: [...player.hand],
        discard: [...(player.discard || [])],
        board: {
          front: (player.board.front || []).map((u: any) => ({ ...u })),
          back: (player.board.back || []).map((u: any) => ({ ...u }))
        },
        artifacts: [...((player as any).artifacts || [])]
      }
    }
  } as MatchState;

  const nextPlayer = (nextMatch as any).players[playerId];

  nextPlayer.energy -= artifact.cost || 0;
  nextPlayer.hand.splice(handIndex, 1);

  nextPlayer.artifacts.push({
    cardId: artifact.id,
    name: artifact.name,
    effectTags: [...(artifact.effectTags || [])],
    rarity: artifact.rarity,
    faction: artifact.faction
  });

  return applyArtifactEffectTags(nextMatch, playerId, artifact.effectTags || []);
}
