import fs from "fs/promises";
import path from "path";

const root = process.cwd();

async function readJson(rel) {
  const full = path.join(root, rel);
  return JSON.parse(await fs.readFile(full, "utf8"));
}

function normalizeTraits(traits = []) {
  if (!traits) return [];
  if (Array.isArray(traits)) {
    return traits.map((t) => ({
      trait_type: String(t.trait_type ?? t.type ?? ""),
      value: String(t.value ?? ""),
    }));
  }
  if (typeof traits === "object") {
    return Object.entries(traits).map(([trait_type, value]) => ({
      trait_type: String(trait_type),
      value: String(value),
    }));
  }
  return [];
}

function tokenKey(v) {
  return v == null ? null : String(v);
}

function mapFaction(value) {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("STONE")) return "STONE";
  if (raw.includes("SILVER")) return "SILVER";
  if (raw.includes("BRONZE")) return "BRONZE";
  if (raw.includes("IRON")) return "IRON";
  if (raw.includes("GOLD")) return "GOLD";
  return "STONE";
}

function mapTcgType(card) {
  const raw = String(card.cardClass ?? card.type ?? "").toLowerCase();
  if (raw === "equipment") return "equipment";
  if (raw === "artifact") return "artifact";
  return "unit";
}

function buildStatsFromBias(card) {
  const bias = card.statBias ?? {};
  const budget = Number(bias.budget ?? 8);
  const attackBias = Number(bias.attackBias ?? 4);
  const healthBias = Number(bias.healthBias ?? 4);
  const armorBias = Number(bias.armorBias ?? 0);
  const speedBias = Number(bias.speedBias ?? 0);

  return {
    cost: Math.max(1, Math.min(7, Math.round(budget / 3))),
    attack: attackBias,
    health: Math.max(1, healthBias + armorBias),
    speed: speedBias,
    armor: armorBias,
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
  };
}

function normalizeNftStats(card) {
  const stats = card.stats ?? {};
  return {
    cost: Number(card.cost ?? stats.cost ?? 0),
    attack: Number(stats.attack ?? card.attack ?? 0),
    health: Number(stats.health ?? card.health ?? 1),
    speed: Number(stats.speed ?? card.speed ?? 0),
    armor: Number(stats.armor ?? card.armor ?? 0),
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
  };
}

async function main() {
  const nftCards = await readJson("src/data/generatedNftCards.json");
  const tcgCards = await readJson("src/data/generatedTcgCards.json");
  const opensea = await readJson("src/data/openseaAssets.json");

  const commanderMap = new Map(
    (opensea.commanders ?? []).map((x) => [tokenKey(x.tokenId), x])
  );

  const assetCardMap = new Map(
    (opensea.cards ?? []).map((x) => [tokenKey(x.tokenId), x])
  );

  const ogRows = (nftCards ?? []).map((card) => {
    const tokenId = tokenKey(card.nftId ?? card.tokenId);
    const collection = "OG_SKULL";
    const assetKey = `${collection}:${tokenId}`;
    const asset = commanderMap.get(tokenId);

    return {
      id: card.id,
      assetKey,
      tokenId,
      collection,
      name: card.name,
      cardType: card.type ?? "unit",
      faction: mapFaction(card.faction),
      rarity: card.rarity ?? "common",
      level: 1,
      traits: normalizeTraits(asset?.traits ?? card.traits ?? []),
      imageUrl: asset?.imageUrl ?? asset?.image_url ?? null,
      openseaUrl: asset?.externalUrl ?? asset?.opensea_url ?? null,
      gameStats: normalizeNftStats(card),
    };
  });

  const tcgRows = (tcgCards ?? []).map((card) => {
    const tokenId = tokenKey(card.tokenId ?? card.sourceTokenId);
    const collection = "AVATAR_TCG";
    const assetKey = `${collection}:${tokenId}`;
    const asset = assetCardMap.get(tokenId);
    const cardType = mapTcgType(card);

    return {
      id: card.id,
      assetKey,
      tokenId,
      collection,
      name: card.name,
      cardType,
      faction: mapFaction(card.faction),
      rarity: card.rarity ?? "common",
      level: 1,
      traits: normalizeTraits(asset?.traits ?? card.rawTraits ?? card.traits ?? []),
      imageUrl: asset?.imageUrl ?? asset?.image_url ?? card.imageUrl ?? null,
      openseaUrl: asset?.externalUrl ?? asset?.opensea_url ?? card.externalUrl ?? null,
      gameStats: buildStatsFromBias(card),
    };
  });

  const all = [...ogRows, ...tcgRows];

  await fs.writeFile(
    path.join(root, "src/data/cardMaster.json"),
    JSON.stringify(all, null, 2),
    "utf8"
  );

  console.log(`Built cardMaster.json with ${all.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
