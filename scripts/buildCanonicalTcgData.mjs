// Regenerates all TCG data files from the canonical re-revealed on-chain snapshot.
// Source of truth: opensea_crypttradingcards_full.json
//
// Emits:
//   src/data/generatedTcgCards.json        (array of full card objects)
//   src/data/runtimeMatchPlayableCards.json([id,type,cost,attack,health,speed,armor,keywords])
//   src/data/runtimeEquipment.json         ([id,cost,attack,health,armor,speed,keywords])
//   src/data/runtimeArtifacts.json         ([id,cost,effectTags])
// Also refreshes revealed art + names + stats inside:
//   src/data/openseaAssets.json  (cards[])
//   src/data/cardMaster.json     (AVATAR_TCG entries)
//
// All cards keyed by tcg_<identifier>. Stats/faction/rarity/keyword/ability come
// straight from canonical traits (no local invention).

import fs from "fs/promises";
import path from "path";

const root = process.cwd();
const SRC = path.join(root, "opensea_crypttradingcards_full.json");

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}
async function writeJson(p, data) {
  await fs.writeFile(p, JSON.stringify(data), "utf8");
}

// ---- canonical faction string -> engine faction enum (for generatedTcgCards.faction)
// cards.ts feeds generated.faction into normalizeFaction(), which accepts the
// canonical human strings as well, so we pass the canonical string verbatim.
const FACTIONS = new Set([
  "Stone Keepers",
  "Iron Defenders",
  "Bronze Guardians",
  "Silver Sentinels",
  "Golden Sovereigns",
  "Gods",
]);

const CANONICAL_KEYWORDS = new Set([
  "Taunt", "Regrow", "Ward", "Deathrattle", "Guard", "Charge", "Armored",
  "Patient", "Lifedrain", "Veil", "Scry", "Execute", "Flying", "Shield",
  "Rush", "Oath", "Trample", "Decay", "Summon", "Lifesteal", "Fear",
  "Judgment", "Relic", "Divine Shield", "Rally", "Martyr", "Bless", "Vow",
  "Cleave", "Ritual", "Mire", "Windfury", "Recall", "Pierce", "Stealth",
]);

// SHARED KEYWORD MAPPING CONTRACT (must match engine agent)
function mapKeyword(canonical) {
  switch (canonical) {
    case "Rush":
    case "Charge":
      return "RUSH";
    case "Guard":
    case "Taunt":
      return "GUARD";
    case "Flying":
      return "FLYING";
    case "Lifesteal":
    case "Lifedrain":
      return "LIFESTEAL";
    case "Stealth":
    case "Veil":
      return "STEALTH";
    case "Trample":
    case "Cleave":
    case "Pierce":
      return "CRUSH";
    case "Divine Shield":
      return "DIVINE_SHIELD";
    case "Armored":
      return "ARMORED";
    default:
      return canonical.trim().toUpperCase().replace(/\s+/g, "_");
  }
}

function traitMap(nft) {
  const m = {};
  for (const t of nft.traits ?? []) {
    if (t && t.trait_type != null) m[t.trait_type] = t.value;
  }
  return m;
}

function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

async function main() {
  const snap = await readJson(SRC);
  const nfts = snap.nfts ?? [];

  const generated = [];
  const matchTuples = [];
  const equipmentTuples = [];
  const artifactTuples = [];

  // canonical lookups keyed by tokenId for art/name/stats refresh of other files
  const canonByToken = new Map();

  const issues = [];
  const counts = { Unit: 0, Equipment: 0, Artifact: 0, other: 0 };

  for (const nft of nfts) {
    const tokenId = String(nft.identifier);
    const id = `tcg_${tokenId}`;
    const tr = traitMap(nft);

    const type = String(tr.Type ?? "").trim(); // Unit | Equipment | Artifact
    const cardClass = type.toLowerCase();
    if (type === "Unit") counts.Unit++;
    else if (type === "Equipment") counts.Equipment++;
    else if (type === "Artifact") counts.Artifact++;
    else {
      counts.other++;
      issues.push(`#${tokenId}: unknown Type "${type}"`);
    }

    const faction = String(tr.Faction ?? "").trim();
    if (faction && !FACTIONS.has(faction)) {
      issues.push(`#${tokenId}: unknown Faction "${faction}"`);
    }

    const rarityRaw = String(tr.Rarity ?? "Common").trim();
    const rarity = rarityRaw.toUpperCase();

    const keywordRaw = tr.Keyword != null ? String(tr.Keyword).trim() : "";
    if (keywordRaw && !CANONICAL_KEYWORDS.has(keywordRaw)) {
      issues.push(`#${tokenId}: unknown Keyword "${keywordRaw}"`);
    }
    const mappedKeywords = keywordRaw ? [mapKeyword(keywordRaw)] : [];

    const cost = num(tr.Cost, 0);
    const attack = num(tr.Attack, 0);
    const health = num(tr.Health, 0);

    // flat rawTraits map: EVERY trait_type -> string value
    const rawTraits = {};
    for (const [k, v] of Object.entries(tr)) rawTraits[k] = String(v);

    const imageUrl = nft.display_image_url || nft.image_url || "";

    generated.push({
      id,
      tokenId,
      name: nft.name,
      description: nft.description ?? "",
      imageUrl,
      externalUrl: nft.opensea_url ?? "",
      faction, // canonical string, fed to normalizeFaction
      rarity, // UPPERCASE
      cardClass, // "unit" | "equipment" | "artifact"
      subtype: cardClass,
      keywords: mappedKeywords,
      rawTraits,
    });

    // runtimeMatchPlayableCards tuple
    if (type === "Equipment") {
      matchTuples.push([id, "equipment", cost, attack, health, 0, 0, mappedKeywords]);
      // runtimeEquipment: [id, cost, attack, health, armor, speed, keywords]
      equipmentTuples.push([id, cost, attack, health, 0, 0, mappedKeywords]);
    } else if (type === "Artifact") {
      matchTuples.push([id, "artifact", cost, 0, 0, 0, 0, mappedKeywords]);
      // runtimeArtifacts: [id, cost, effectTags]
      artifactTuples.push([id, cost, mappedKeywords]);
    } else {
      // Unit (and any fallback)
      matchTuples.push([id, "unit", cost, attack, health, 0, 0, mappedKeywords]);
    }

    canonByToken.set(tokenId, {
      name: nft.name,
      imageUrl,
      image_url: nft.image_url ?? null,
      display_image_url: nft.display_image_url ?? null,
      cardType: cardClass,
      faction,
      rarity,
      cost,
      attack,
      health,
      keywords: mappedKeywords,
    });
  }

  await writeJson(path.join(root, "src/data/generatedTcgCards.json"), generated);
  await writeJson(path.join(root, "src/data/runtimeMatchPlayableCards.json"), matchTuples);
  await writeJson(path.join(root, "src/data/runtimeEquipment.json"), equipmentTuples);
  await writeJson(path.join(root, "src/data/runtimeArtifacts.json"), artifactTuples);

  // ---- refresh art + name + stats inside openseaAssets.json (cards[]) ----
  const assetsPath = path.join(root, "src/data/openseaAssets.json");
  const assets = await readJson(assetsPath);
  let assetHits = 0;
  for (const card of assets.cards ?? []) {
    const c = canonByToken.get(String(card.tokenId));
    if (!c) continue;
    assetHits++;
    card.name = c.name;
    card.imageUrl = c.imageUrl;
    card.raw = card.raw || {};
    card.raw.name = c.name;
    card.raw.image_url = c.image_url;
    card.raw.display_image_url = c.display_image_url;
  }
  await writeJson(assetsPath, assets);

  // ---- refresh art + name + stats inside cardMaster.json (AVATAR_TCG) ----
  const masterPath = path.join(root, "src/data/cardMaster.json");
  const master = await readJson(masterPath);
  let masterHits = 0;
  for (const entry of master) {
    if (entry.collection !== "AVATAR_TCG") continue;
    const c = canonByToken.get(String(entry.tokenId));
    if (!c) continue;
    masterHits++;
    entry.name = c.name;
    entry.imageUrl = c.imageUrl;
    entry.cardType = c.cardType;
    entry.rarity = c.rarity.toLowerCase();
    entry.gameStats = entry.gameStats || {};
    entry.gameStats.cost = c.cost;
    entry.gameStats.attack = c.attack;
    entry.gameStats.health = c.health;
    entry.gameStats.armor = 0;
    entry.gameStats.speed = 0;
    entry.gameStats.keywords = c.keywords;
  }
  await writeJson(masterPath, master);

  console.log("Counts:", counts, "total", nfts.length);
  console.log("generatedTcgCards:", generated.length);
  console.log("runtimeMatchPlayableCards:", matchTuples.length);
  console.log("runtimeEquipment:", equipmentTuples.length);
  console.log("runtimeArtifacts:", artifactTuples.length);
  console.log("openseaAssets card art refreshed:", assetHits);
  console.log("cardMaster AVATAR_TCG refreshed:", masterHits);
  if (issues.length) {
    console.log(`ISSUES (${issues.length}):`);
    for (const i of issues.slice(0, 40)) console.log("  " + i);
  } else {
    console.log("No mapping issues.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
