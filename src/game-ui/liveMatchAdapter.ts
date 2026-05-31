import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { fallbackAsset } from "./fallbackAsset";
import { CommanderVM, PlayCardVM } from "../ui/cryptTypes";
import { getCommanderImageUrl, getCardImageUrl } from "../data/openseaImageIndex";

const factionMap: Record<string, "STONE" | "IRON" | "BRONZE" | "SILVER" | "GOLD" | "GOD"> = {
  STONE_KEEPERS: "STONE",
  IRON_DEFENDERS: "IRON",
  BRONZE_GUARDIANS: "BRONZE",
  SILVER_SENTINELS: "SILVER",
  GOLDEN_SOVEREIGNS: "GOLD",
  GODS: "GOD",
  STONE: "STONE",
  IRON: "IRON",
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
  GOD: "GOD",
};

function normalizeFaction(faction: string | null | undefined) {
  if (!faction) return "SILVER";
  return factionMap[faction] ?? "SILVER";
}

function pickSyncLevel(modifier: any) {
  if (!modifier) return { level: "none" as const, label: "No Sync" };
  if (modifier.exactTraitMatches?.length || modifier.audit?.exactTraitMatches?.length) {
    return { level: "exact" as const, label: "Exact Match" };
  }
  if (modifier.categoryMatches?.length || modifier.audit?.categoryMatches?.length) {
    return { level: "category" as const, label: "Category Sync" };
  }
  if ((modifier.reasons ?? modifier.audit?.reasons ?? []).some((r: string) => /Legendary/i.test(r))) {
    return { level: "legendary" as const, label: "Legendary Aura" };
  }
  if ((modifier.reasons ?? modifier.audit?.reasons ?? []).some((r: string) => /One of One/i.test(r))) {
    return { level: "oneOfOne" as const, label: "One of One" };
  }
  return { level: "category" as const, label: "Commander Sync" };
}

function getCardMeta(cardId: string) {
  return allPlayableCards.find((c: any) => c.id === cardId) ?? null;
}

function resolveCommanderImage(raw: any) {
  return (
    getCommanderImageUrl({
      tokenId: raw?.tokenId,
      name: raw?.name,
    }) ||
    raw?.imageUrl ||
    raw?.image ||
    raw?.image_url ||
    fallbackAsset
  );
}

function resolvePlayableCardImage(card: any) {
  return (
    getCardImageUrl({
      tokenId: card?.tokenId,
      name: card?.name,
    }) ||
    card?.imageUrl ||
    card?.image ||
    card?.image_url ||
    fallbackAsset
  );
}

export function getCommanderVmForPlayer(player: any): CommanderVM {
  const raw =
    player?.commanderOg ??
    allCommanders.find((c: any) => c.id === player?.commanderId) ??
    allCommanders[0];

  const rarityLabel =
    raw?.traits?.["One of One"]
      ? "One of One"
      : raw?.traits?.Legendary === "Legendary"
        ? "Legendary"
        : "Standard";

  return {
    id: raw?.id ?? "commander",
    name: raw?.name ?? "Commander",
    faction: normalizeFaction(raw?.faction),
    imageUrl: resolveCommanderImage(raw),
    rarityLabel,
    traits: raw?.traits ?? {},
    headline:
      raw?.headline ??
      `${raw?.name ?? "Commander"} shapes trait-driven pressure and battlefield identity.`,
    doctrine:
      raw?.doctrine ??
      "Trait alignment and commander identity create tempo, value, and combat pressure.",
    battleCallout:
      raw?.battleCallout ?? "Real engine state now drives the match screen."
  };
}

export function handToVm(
  match: any,
  playerId: "P1" | "P2",
  cardId: string,
  selected: boolean
): PlayCardVM {
  const card = getCardMeta(cardId);
  const modifier = match?.players?.[playerId]?.cardModifiers?.[cardId] ?? null;
  const sync = pickSyncLevel(modifier);

  return {
    id: cardId,
    name: card?.name ?? cardId,
    faction: normalizeFaction(card?.faction),
    kind: (card?.type ?? "unit") as any,
    imageUrl: resolvePlayableCardImage(card),
    syncLevel: sync.level,
    syncLabel: sync.label,
    traits: card?.rawTraits ?? {},
    baseStats: {
      attack: card?.stats?.attack ?? 0,
      health: card?.stats?.health ?? 0,
      armor: card?.stats?.armor ?? 0,
      speed: card?.stats?.speed ?? 0,
      crit: 0,
      utility: 0,
      cost: card?.cost ?? 0
    },
    liveStats: {
      attack: (card?.stats?.attack ?? 0) + (modifier?.bonus?.attack ?? 0),
      health: (card?.stats?.health ?? 0) + (modifier?.bonus?.health ?? 0),
      armor: (card?.stats?.armor ?? 0) + (modifier?.bonus?.armor ?? 0),
      speed: (card?.stats?.speed ?? 0) + (modifier?.bonus?.speed ?? 0),
      crit: modifier?.bonus?.crit ?? 0,
      utility: modifier?.bonus?.utility ?? 0,
      cost: card?.cost ?? 0
    },
    keywords: card?.keywords ?? [],
    commanderTags: modifier?.extraTags ?? [],
    passives: modifier?.extraPassives ?? [],
    selected,
    modifierSources: modifier
      ? {
          commander: {
            stats: modifier?.bonus ?? {},
            commanderTags: modifier?.extraTags ?? [],
            passives: modifier?.extraPassives ?? [],
            audit: {
              reasons: modifier?.reasons ?? [],
              exactTraitMatches: modifier?.exactTraitMatches ?? [],
              categoryMatches: modifier?.categoryMatches ?? [],
              nameMatch: !!modifier?.nameMatch,
              factionMatch: !!modifier?.factionMatch
            }
          },
          equipment: [],
          artifact: []
        }
      : undefined
  };
}

export function unitToVm(playerId: "P1" | "P2", unit: any, selected: boolean): PlayCardVM {
  const card = getCardMeta(unit?.cardId);
  const commanderSource = unit?.modifiers?.commander ?? null;
  const equipmentSources = unit?.modifiers?.equipment ?? [];
  const artifactSources = unit?.modifiers?.artifact ?? [];
  const sync = pickSyncLevel(commanderSource);

  return {
    id: unit?.instanceId ?? unit?.cardId,
    name: card?.name ?? unit?.cardId ?? "Unit",
    faction: normalizeFaction(card?.faction),
    kind: (card?.type ?? "unit") as any,
    imageUrl: resolvePlayableCardImage(card),
    syncLevel: sync.level,
    syncLabel: sync.label,
    traits: card?.rawTraits ?? {},
    baseStats: {
      attack: card?.stats?.attack ?? 0,
      health: card?.stats?.health ?? 0,
      armor: card?.stats?.armor ?? 0,
      speed: card?.stats?.speed ?? 0,
      crit: 0,
      utility: 0,
      cost: card?.cost ?? 0
    },
    liveStats: {
      attack: unit?.attack ?? 0,
      health: unit?.health ?? 0,
      armor: unit?.armor ?? 0,
      speed: unit?.speed ?? 0,
      crit: unit?.crit ?? 0,
      utility: unit?.utility ?? 0,
      cost: card?.cost ?? 0
    },
    keywords: unit?.keywords ?? [],
    commanderTags: unit?.commanderTags ?? [],
    passives: unit?.passives ?? [],
    exhausted: !!unit?.exhausted,
    equipped: Array.isArray(unit?.equipment) && unit.equipment.length > 0,
    damaged: (unit?.maxHealth ?? unit?.health ?? 0) > (unit?.health ?? 0),
    selected,
    modifierSources: {
      commander: commanderSource,
      equipment: equipmentSources,
      artifact: artifactSources
    }
  };
}

export function artifactToVm(artifact: any, selected: boolean): PlayCardVM {
  const sync = pickSyncLevel(artifact?.modifiers?.commander ?? null);

  return {
    id: artifact?.cardId ?? artifact?.name ?? "artifact",
    name: artifact?.name ?? "Artifact",
    faction: normalizeFaction(artifact?.faction),
    kind: "artifact",
    imageUrl: resolvePlayableCardImage(artifact),
    syncLevel: sync.level,
    syncLabel: sync.label,
    traits: {},
    baseStats: {
      attack: 0,
      health: 0,
      armor: 0,
      speed: 0,
      crit: 0,
      utility: 0,
      cost: 0
    },
    liveStats: {
      attack: artifact?.attack ?? 0,
      health: artifact?.health ?? 0,
      armor: artifact?.armor ?? 0,
      speed: artifact?.speed ?? 0,
      crit: artifact?.crit ?? 0,
      utility: artifact?.utility ?? 0,
      cost: 0
    },
    keywords: artifact?.effectTags ?? [],
    commanderTags: artifact?.commanderTags ?? [],
    passives: artifact?.passives ?? [],
    selected,
    modifierSources: {
      commander: artifact?.modifiers?.commander ?? null,
      equipment: [],
      artifact: []
    }
  };
}
