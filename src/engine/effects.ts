import { MatchState, PlayerId, UnitInstance } from "../types";

type Effect =
  | { type: "DAMAGE_UNIT"; targetId: string; amount: number }
  | { type: "HEAL_UNIT"; targetId: string; amount: number }
  | { type: "DAMAGE_PLAYER"; playerId: PlayerId; amount: number }
  | { type: "HEAL_PLAYER"; playerId: PlayerId; amount: number }
  | { type: "BUFF_UNIT"; targetId: string; attack: number; health: number }
  | { type: "DRAW"; playerId: PlayerId; amount: number };

export function applyEffect(match: MatchState, effect: Effect): MatchState {
  switch (effect.type) {
    case "DAMAGE_UNIT":
      return damageUnit(match, effect.targetId, effect.amount);

    case "HEAL_UNIT":
      return healUnit(match, effect.targetId, effect.amount);

    case "DAMAGE_PLAYER":
      return damagePlayer(match, effect.playerId, effect.amount);

    case "HEAL_PLAYER":
      return healPlayer(match, effect.playerId, effect.amount);

    case "BUFF_UNIT":
      return buffUnit(match, effect.targetId, effect.attack, effect.health);

    case "DRAW":
      return drawCards(match, effect.playerId, effect.amount);

    default:
      return match;
  }
}function findUnit(match: MatchState, instanceId: string) {
    for (const player of Object.values(match.players)) {
      for (const lane of ["front", "back"] as const) {
        const unit = player.board[lane].find(u => u.instanceId === instanceId);
        if (unit) return { playerId: player.id, unit, lane };
      }
    }
    return null;
  }function damageUnit(match: MatchState, id: string, amount: number): MatchState {
    const found = findUnit(match, id);
    if (!found) return match;
  
    const { playerId, unit, lane } = found;
  
    const newHealth = unit.health - amount;
  
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...match.players[playerId],
          board: {
            ...match.players[playerId].board,
            [lane]: match.players[playerId].board[lane].map(u =>
              u.instanceId === id ? { ...u, health: newHealth } : u
            )
          }
        }
      }
    };
  }function healUnit(match: MatchState, id: string, amount: number): MatchState {
    const found = findUnit(match, id);
    if (!found) return match;
  
    const { playerId, unit, lane } = found;
  
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...match.players[playerId],
          board: {
            ...match.players[playerId].board,
            [lane]: match.players[playerId].board[lane].map(u =>
              u.instanceId === id ? { ...u, health: u.health + amount } : u
            )
          }
        }
      }
    };
  }function damagePlayer(match: MatchState, playerId: PlayerId, amount: number): MatchState {
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...match.players[playerId],
          health: match.players[playerId].health - amount
        }
      }
    };
  }function healPlayer(match: MatchState, playerId: PlayerId, amount: number): MatchState {
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...match.players[playerId],
          health: match.players[playerId].health + amount
        }
      }
    };
  }function buffUnit(match: MatchState, id: string, atk: number, hp: number): MatchState {
    const found = findUnit(match, id);
    if (!found) return match;
  
    const { playerId, unit, lane } = found;
  
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...match.players[playerId],
          board: {
            ...match.players[playerId].board,
            [lane]: match.players[playerId].board[lane].map(u =>
              u.instanceId === id
                ? { ...u, attack: u.attack + atk, health: u.health + hp }
                : u
            )
          }
        }
      }
    };
  }function drawCards(match: MatchState, playerId: PlayerId, amount: number): MatchState {
    const player = match.players[playerId];
  
    const drawn = player.deck.slice(0, amount);
    const newDeck = player.deck.slice(amount);
  
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...player,
          deck: newDeck,
          hand: [...player.hand, ...drawn]
        }
      }
    };
  }