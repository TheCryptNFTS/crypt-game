import { allCommanders } from "../engine/commanders";
import { allPlayableCards } from "../engine/cards";
import { fallbackAsset } from "./fallbackAsset";
import { CommanderVM, PlayCardVM } from "../ui/cryptTypes";
import generatedTcgCards from "../data/generatedTcgCards.json";
import commanderArt from "../data/commanderArt.json";

// Real reveal art keyed by engine card id (tcg_*). allPlayableCards (the match's
// card source) carries NO imageUrl, so in-match cards were falling back to the
// "CRYPT" placeholder while the Vault showed full art. This map (same data the
// Vault uses, already bundled via cards.ts so zero extra weight) fixes that.
// NOTE: this replaces the old openseaImageIndex import, which pulled the 21.5MB
// openseaAssets.json + 7MB cardMaster.json into the MATCH chunk (~28MB on the
// match screen). We now resolve cards from generatedTcgCards (3MB, already
// loaded) and commanders from the tiny commanderArt.json (1.9KB, build-extracted
// from the render manifest) — keeping that 28MB off the critical path.
const cardArtById = new Map<string, string>();
for (const c of generatedTcgCards as Array<{ id?: string; imageUrl?: string | null }>) {
  if (c.id && c.imageUrl) cardArtById.set(c.id, c.imageUrl);
}
const commanderArtById = commanderArt as Record<string, string>;

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
  // A commander modifier exists but matched no traits/reasons — that is NOT a
  // synergy, so don't flag it (was incorrectly labelling EVERY card "Commander
  // Sync"). The badge only shows for a real match below.
  return { level: "none" as const, label: "No Sync" };
}

function getCardMeta(cardId: string) {
  return allPlayableCards.find((c: any) => c.id === cardId) ?? null;
}

function resolveCommanderImage(raw: any) {
  return (
    (raw?.id && commanderArtById[raw.id]) ||
    raw?.imageUrl ||
    raw?.image ||
    raw?.image_url ||
    // GENERATED COMMANDERS (cmd_6xxx) carry no curated commanderArt entry and no
    // imageUrl of their own, so they were ALL falling back to the placeholder.
    // Their reveal art lives in generatedTcgCards keyed by `tcg_<tokenId>` (the
    // same manifest cardArtById is built from) — resolve it here so the commander
    // tray shows real art instead of the fallback. ~62% of generated commanders
    // have a token-art match; the rest fall through to the on-brand gold fallback.
    (raw?.tokenId && cardArtById.get(`tcg_${raw.tokenId}`)) ||
    fallbackAsset
  );
}

function resolvePlayableCardImage(card: any) {
  return (
    (card?.id && cardArtById.get(card.id)) ||
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

  // ART RESOLUTION FIX: `commanderOg` is a STRIPPED snapshot the engine writes as
  // `{ name, traits }` only — it has no `id`, `tokenId`, or `imageUrl`, so every
  // commander chip was falling through to the placeholder regardless of having art.
  // The FULL commander definition (with id + tokenId) lives on `player.commander`
  // (set in createMatchFromDecks) or is recoverable via `player.commanderId`; use
  // THAT for the image lookup (curated -> commanderArt by id, generated -> token
  // art), while still reading name/traits/rarity from `raw` so display is unchanged.
  const commanderDef =
    player?.commander ??
    allCommanders.find((c: any) => c.id === player?.commanderId) ??
    (raw?.id ? raw : null);

  const rarityLabel =
    raw?.traits?.["One of One"]
      ? "One of One"
      : raw?.traits?.Legendary === "Legendary"
        ? "Legendary"
        : "Standard";

  return {
    id: commanderDef?.id ?? raw?.id ?? "commander",
    name: raw?.name ?? "Commander",
    faction: normalizeFaction(commanderDef?.faction ?? raw?.faction),
    imageUrl: resolveCommanderImage(commanderDef ?? raw),
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
