/**
 * Builds public/data/renderManifest.json — the catalog the Vault, Deck Builder, and
 * card-detail UI render from.
 *
 * SINGLE CATALOG: the `playable` section is sourced from the ENGINE'S canonical card
 * catalog (`allPlayableCards`, tcg_* ids) — the exact set the reducer plays and
 * `validateDeck` checks against. Previously the manifest was built from a stale
 * pre-reveal pipeline (`generatedPlayableTcgUnits.json`, tcg_unit_* ids) whose names
 * were placeholders ("Crypt - Digital Trading Card #N") and whose ids didn't exist in
 * the engine — so the Vault showed garbage names and every deck built in the Deck
 * Builder failed validation as "unknown cards". Sourcing from `allPlayableCards` means
 * names (incl. the cardOverrides authored-name / balance layer), cost, keywords, and
 * ids are identical to what you actually play. Card art (imageUrl/externalUrl) is
 * joined from the canonical reveal data (`generatedTcgCards.json`) by id.
 *
 * Commanders are unchanged: sourced from commanders.json with art from openseaAssets.
 *
 * Run with: npm run assets:build-manifest  (tsx scripts/buildRenderManifest.ts)
 */
import fs from "fs";
import path from "path";
import { allPlayableCards } from "../src/engine/cards";
import commandersRaw from "../src/data/commanders.json";
import generatedTcgCards from "../src/data/generatedTcgCards.json";
import openseaAssetsRaw from "../src/data/openseaAssets.json";
import commanderImageMapRaw from "../src/data/commanderImageMap.json";

type Asset = {
  id?: string;
  name?: string;
  tokenId?: string;
  imageUrl?: string | null;
  animationUrl?: string | null;
  externalUrl?: string | null;
  traits?: Array<{ trait_type: string; value: string | number }>;
};

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function makeIndex(items: Asset[] | undefined): Map<string, Asset> {
  const map = new Map<string, Asset>();
  for (const item of items ?? []) {
    if (item?.id) map.set(norm(item.id), item);
    if (item?.name) map.set(norm(item.name), item);
    if (item?.tokenId) map.set(norm(item.tokenId), item);
  }
  return map;
}

const commanders = commandersRaw as Array<{ id: string; name?: string; faction?: string }>;
const openseaAssets = openseaAssetsRaw as { commanders?: Asset[]; cards?: Asset[] };
const commanderImageMap = commanderImageMapRaw as Record<string, string>;

const commanderAssetIndex = makeIndex(openseaAssets.commanders);

function pickCommanderAsset(item: { id: string; name?: string }): Asset | null {
  const mappedTokenId = commanderImageMap[item.id];
  if (mappedTokenId) {
    const byToken = commanderAssetIndex.get(norm(mappedTokenId));
    if (byToken) return byToken;
  }
  return (
    commanderAssetIndex.get(norm(item.id)) ||
    commanderAssetIndex.get(norm(item.name)) ||
    null
  );
}

// Canonical reveal art, keyed by engine card id (tcg_*).
type GeneratedCard = {
  id: string;
  imageUrl?: string | null;
  animationUrl?: string | null;
  externalUrl?: string | null;
};
const artById = new Map<string, GeneratedCard>(
  (generatedTcgCards as GeneratedCard[]).map((c) => [c.id, c])
);

const manifest = {
  generatedAt: new Date().toISOString(),
  commanders: commanders.map((card) => {
    const asset = pickCommanderAsset(card);
    return {
      id: card.id,
      name: card.name ?? card.id,
      role: "commander" as const,
      // commanders.json carries no faction; fall back to the canonical "GODS" code
      // (matches the Faction enum the engine + playable cards use) so the Vault's
      // faction filter doesn't show a duplicate "GOD" / "GODS" pair.
      faction: card.faction ?? "GODS",
      rarity: "commander",
      cost: undefined,
      keywords: [] as string[],
      ability: "",
      imageUrl: asset?.imageUrl ?? null,
      animationUrl: asset?.animationUrl ?? null,
      externalUrl: asset?.externalUrl ?? null,
      traits: asset?.traits ?? [],
      sourceTokenId: asset?.tokenId ?? null,
    };
  }),
  // PLAYABLE = the engine's canonical catalog (overrides already applied), minus the
  // synthetic live SPELL archetype (no token art / not NFT-backed). Art joined by id.
  playable: allPlayableCards
    .filter((card) => card.type === "unit" || card.type === "equipment" || card.type === "artifact")
    .map((card) => {
      const art = artById.get(card.id);
      return {
        id: card.id,
        name: card.name,
        role: card.type,
        faction: card.faction,
        rarity: String(card.rarity ?? "common").toLowerCase(),
        cost: card.cost,
        keywords: card.keywords ?? [],
        ability: typeof card.rawTraits?.Ability === "string" ? card.rawTraits.Ability : "",
        imageUrl: art?.imageUrl ?? null,
        animationUrl: art?.animationUrl ?? null,
        externalUrl: art?.externalUrl ?? null,
        // Playable traits are never surfaced (traitsForPresentation returns [] for
        // non-commanders), so we don't carry the per-token cosmetic rows here.
        traits: [] as Array<{ trait_type: string; value: string | number }>,
      };
    }),
};

const outDir = path.resolve(process.cwd(), "public/data");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.resolve(outDir, "renderManifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Saved render manifest -> ${outPath}`);
console.log(`Commanders: ${manifest.commanders.length}`);
console.log(`Playable: ${manifest.playable.length}`);
const withArt = manifest.playable.filter((p) => p.imageUrl).length;
console.log(`Playable images: ${withArt}/${manifest.playable.length}`);
