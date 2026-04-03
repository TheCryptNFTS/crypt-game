export function applyEffect(match: any, effect: any) {
    const activePlayer = match.players[match.activePlayer];
  
    switch (effect.type) {
      case "DAMAGE_UNIT": {
        const unit = findUnit(match, effect.targetId);
        if (!unit) return match;
  
        unit.health -= effect.amount;
  
        if (unit.health <= 0) {
          removeUnit(match, unit.instanceId);
        }
  
        return match;
      }
  
      case "HEAL_UNIT": {
        const unit = findUnit(match, effect.targetId);
        if (!unit) return match;
  
        unit.health += effect.amount;
        return match;
      }
  
      case "BUFF_UNIT": {
        const unit = findUnit(match, effect.targetId);
        if (!unit) return match;
  
        unit.attack += effect.attack || 0;
        unit.health += effect.health || 0;
  
        return match;
      }
  
      case "DRAW": {
        for (let i = 0; i < effect.amount; i++) {
          const card = activePlayer.deck.shift();
          if (card) {
            activePlayer.hand.push(card);
          }
        }
        return match;
      }
  
      case "DAMAGE_PLAYER": {
        const targetPlayer = match.players[effect.targetPlayerId];
        if (!targetPlayer) return match;
  
        targetPlayer.health -= effect.amount;
  
        if (targetPlayer.health <= 0) {
          targetPlayer.health = 0;
          match.winner = effect.targetPlayerId === "P1" ? "P2" : "P1";
        }
  
        return match;
      }
  
      default:
        return match;
    }
  }
  
  function findUnit(match: any, instanceId: string) {
    for (const player of Object.values(match.players) as any[]) {
      for (const lane of ["front", "back"]) {
        const unit = player.board[lane].find((u: any) => u.instanceId === instanceId);
        if (unit) return unit;
      }
    }
    return null;
  }
  
  function removeUnit(match: any, instanceId: string) {
    for (const player of Object.values(match.players) as any[]) {
      for (const lane of ["front", "back"]) {
        const index = player.board[lane].findIndex((u: any) => u.instanceId === instanceId);
        if (index !== -1) {
          const [deadUnit] = player.board[lane].splice(index, 1);
          player.discard.push(deadUnit.cardId);
          return;
        }
      }
    }
  }