import { CardProgress, CommanderProgress } from "../domain/types";
import { xpToNextLevel } from "../economy/progression";

function levelFromXp(totalXp: number) {
  let level = 1;
  let remaining = totalXp;

  while (true) {
    const needed = xpToNextLevel(level);
    if (!needed || remaining < needed) break;
    remaining -= needed;
    level += 1;
    if (level >= 100) break;
  }

  return level;
}

function cardMasteryFromLevel(level: number) {
  if (level >= 100) return "Relic Form";
  if (level >= 75) return "Mythic";
  if (level >= 50) return "Sovereign";
  if (level >= 25) return "Ascendant";
  if (level >= 10) return "Awakened";
  return "Dormant";
}

function sealedTierFromLevel(level: number) {
  if (level >= 100) return "Final Sealed Form";
  if (level >= 75) return "Sealed Evolution IV";
  if (level >= 50) return "Sealed Evolution III";
  if (level >= 25) return "Sealed Evolution II";
  if (level >= 10) return "Sealed Evolution I";
  return "Dormant Seal";
}

function commanderMasteryFromLevel(level: number) {
  if (level >= 80) return "Legendary Mastery V";
  if (level >= 60) return "Legendary Mastery IV";
  if (level >= 40) return "Legendary Mastery III";
  if (level >= 25) return "Legendary Mastery II";
  if (level >= 10) return "Legendary Mastery I";
  return "Initiate";
}

export function applyCommanderXp(
  commanders: CommanderProgress[],
  commanderId: string,
  commanderName: string,
  gainedXp: number
) {
  const existing = commanders.find((c) => c.id === commanderId);

  if (!existing) {
    const xp = gainedXp;
    const level = levelFromXp(xp);
    return [
      {
        id: commanderId,
        name: commanderName,
        level,
        xp,
        mastery: commanderMasteryFromLevel(level),
        title: level >= 25 ? "Ascendant Wielder" : "New Challenger",
      },
      ...commanders,
    ];
  }

  return commanders.map((commander) => {
    if (commander.id !== commanderId) return commander;
    const xp = commander.xp + gainedXp;
    const level = levelFromXp(xp);
    return {
      ...commander,
      xp,
      level,
      mastery: commanderMasteryFromLevel(level),
      title:
        level >= 60
          ? "Vault Sovereign"
          : level >= 25
            ? "Ascendant Wielder"
            : commander.title,
    };
  });
}

export function applyCardXp(
  cards: CardProgress[],
  cardIds: string[],
  gainedXpPerCard: number
) {
  const ids = new Set(cardIds);

  const updated = cards.map((card) => {
    if (!ids.has(card.id)) return card;
    const xp = card.xp + gainedXpPerCard;
    const level = levelFromXp(xp);
    return {
      ...card,
      xp,
      level,
      mastery: cardMasteryFromLevel(level),
      sealedTier: sealedTierFromLevel(level),
    };
  });

  for (const id of ids) {
    if (updated.some((c) => c.id === id)) continue;
    const xp = gainedXpPerCard;
    const level = levelFromXp(xp);
    updated.unshift({
      id,
      name: id,
      xp,
      level,
      mastery: cardMasteryFromLevel(level),
      sealedTier: sealedTierFromLevel(level),
    });
  }

  return updated;
}
