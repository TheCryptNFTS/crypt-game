export function applyEffect(match: any, effect: any) {
    switch (effect.type) {
      case "DAMAGE_UNIT": {
        const unit = findUnit(match, effect.targetId);
        if (!unit) return;
  
        const damage = Math.max(0, effect.amount - (unit.armor || 0));
        unit.health -= damage;
  
        if (unit.health <= 0) {
          removeUnit(match, effect.targetId);
        }
        break;
      }
  
      case "DAMAGE_PLAYER": {
        const player = match.players[effect.targetPlayerId];
        if (!player) return;
  
        player.health -= effect.amount;
  
        if (player.health <= 0) {
          match.winner = getOpponent(effect.targetPlayerId);
        }
        break;
      }
  
      case "HEAL_UNIT": {
        const unit = findUnit(match, effect.targetId);
        if (!unit) return;
  
        unit.health += effect.amount;
  
        // 🔥 CAP to maxHealth if exists
        if (unit.maxHealth !== undefined) {
          unit.health = Math.min(unit.health, unit.maxHealth);
        }
        break;
      }
  
      case "BUFF_UNIT": {
        const unit = findUnit(match, effect.targetId);
        if (!unit) return;
  
        unit.attack += effect.attack || 0;
        unit.health += effect.health || 0;
  
        // 🔥 increase maxHealth too
        if (effect.health) {
          unit.maxHealth = (unit.maxHealth || unit.health) + effect.health;
        }
        break;
      }
    }
  }
  
  function findUnit(match: any, instanceId: string) {
    for (const player of Object.values(match.players)) {
      for (const lane of ["front", "back"]) {
        const unit = (player as any).board[lane].find(
          (u: any) => u.instanceId === instanceId
        );
        if (unit) return unit;
      }
    }
    return null;
  }
  
  function removeUnit(match: any, instanceId: string) {
    for (const player of Object.values(match.players)) {
      for (const lane of ["front", "back"]) {
        const index = (player as any).board[lane].findIndex(
          (u: any) => u.instanceId === instanceId
        );
  
        if (index !== -1) {
          const [dead] = (player as any).board[lane].splice(index, 1);
          (player as any).discard.push(dead.cardId);
          return;
        }
      }
    }
  }
  
  function getOpponent(playerId: string) {
    return playerId === "P1" ? "P2" : "P1";
  }