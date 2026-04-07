import fs from "fs";
import path from "path";

function readJsonIfExists(rel, fallback) {
  const full = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(full)) return fallback;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function makeIndex(items) {
  const map = new Map();
  for (const item of items || []) {
    if (item?.id) map.set(norm(item.id), item);
    if (item?.name) map.set(norm(item.name), item);
    if (item?.tokenId) map.set(norm(item.tokenId), item);
  }
  return map;
}

const commanders = readJsonIfExists("src/data/commanders.json", []);
const units = readJsonIfExists("src/data/generatedPlayableTcgUnits.json", []);
const equipment = readJsonIfExists("src/data/generatedPlayableTcgEquipment.json", []);
const artifacts = readJsonIfExists("src/data/generatedPlayableTcgArtifacts.json", []);
const openseaAssets = readJsonIfExists("src/data/openseaAssets.json", {
  commanders: [],
  cards: [],
});
const commanderImageMap = readJsonIfExists("src/data/commanderImageMap.json", {});

const commanderAssetIndex = makeIndex(openseaAssets.commanders || []);
const cardAssetIndex = makeIndex(openseaAssets.cards || []);

function pickCardAsset(item) {
  return (
    cardAssetIndex.get(norm(item.id)) ||
    cardAssetIndex.get(norm(item.name)) ||
    null
  );
}

function pickCommanderAsset(item) {
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

const manifest = {
  generatedAt: new Date().toISOString(),
  commanders: (commanders || []).map((card) => {
    const asset = pickCommanderAsset(card);
    return {
      id: card.id,
      name: card.name ?? card.id,
      role: "commander",
      faction: card.faction ?? "GOD",
      rarity: "commander",
      cost: undefined,
      keywords: [],
      imageUrl: asset?.imageUrl ?? null,
      animationUrl: asset?.animationUrl ?? null,
      externalUrl: asset?.externalUrl ?? null,
      traits: asset?.traits ?? [],
      sourceTokenId: asset?.tokenId ?? null
    };
  }),
  playable: [
    ...(units || []).map((card) => ({ ...card, role: "unit" })),
    ...(equipment || []).map((card) => ({ ...card, role: "equipment" })),
    ...(artifacts || []).map((card) => ({ ...card, role: "artifact" })),
  ].map((card) => {
    const asset = pickCardAsset(card);
    return {
      id: card.id,
      name: card.name ?? card.id,
      role: card.role,
      faction: card.faction ?? "GOD",
      rarity: card.rarity ?? "common",
      cost: card.cost,
      keywords: card.keywords ?? card.effectTags ?? [],
      imageUrl: asset?.imageUrl ?? null,
      animationUrl: asset?.animationUrl ?? null,
      externalUrl: asset?.externalUrl ?? null,
      traits: asset?.traits ?? [],
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
