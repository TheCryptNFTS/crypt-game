const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.resolve(process.cwd(), "tcg_metadata");
const OUTPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");

function normalizeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function getAttributes(metadata) {
  if (Array.isArray(metadata.attributes)) return metadata.attributes;
  if (Array.isArray(metadata.traits)) return metadata.traits;
  return [];
}

function traitArrayToMap(attributes) {
  const traitMap = {};

  for (const attr of attributes) {
    const key = normalizeText(attr.trait_type);
    const value = normalizeText(attr.value);

    if (!key || !value) continue;
    traitMap[key] = value;
  }

  return traitMap;
}

function normalizeFaction(rawFaction) {
  if (!rawFaction || rawFaction === "unknown") return "UNKNOWN";

  return rawFaction
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasRealTrait(value) {
  const v = normalizeText(value, "").toLowerCase();
  return v !== "" && v !== "none" && v !== "unknown";
}

function deriveRarity(traitMap) {
  const oneOfOne = normalizeText(traitMap["One of One"]).toLowerCase();
  const godTrait = normalizeText(traitMap["God"]).toLowerCase();
  const skin = normalizeText(traitMap["Skin"]);

  if (oneOfOne && oneOfOne !== "none") return "one_of_one";
  if (godTrait && godTrait !== "none") return "god";

  const lowerSkin = skin.toLowerCase();

  if (lowerSkin.endsWith(" common")) return "common";
  if (lowerSkin.endsWith(" uncommon")) return "uncommon";
  if (lowerSkin.endsWith(" rare")) return "rare";
  if (lowerSkin.endsWith(" epic")) return "epic";
  if (lowerSkin.endsWith(" legendary")) return "legendary";
  if (lowerSkin.endsWith(" mythic")) return "mythic";

  return "unknown";
}

function getTraitPresence(traitMap) {
  return {
    hasWeapon: hasRealTrait(traitMap["Weapons"]),
    hasArmor: hasRealTrait(traitMap["Armor"]),
    hasArtifact: hasRealTrait(traitMap["Artifacts"]),
    hasCreature: hasRealTrait(traitMap["Creature"]),
    hasMetaverse: hasRealTrait(traitMap["Metaverse"]),
    hasHeadwear: hasRealTrait(traitMap["Headwear"]),
    hasGod: hasRealTrait(traitMap["God"]),
    hasOneOfOne: hasRealTrait(traitMap["One of One"])
  };
}

function deriveCardClass(traitMap) {
  const p = getTraitPresence(traitMap);

  if (p.hasGod) return "unit";

  const majorCount =
    Number(p.hasWeapon) +
    Number(p.hasArmor) +
    Number(p.hasArtifact) +
    Number(p.hasCreature) +
    Number(p.hasMetaverse);

  if (p.hasArtifact && !p.hasWeapon && !p.hasArmor && !p.hasCreature && !p.hasMetaverse) {
    return "artifact";
  }

  if (
    majorCount === 1 &&
    ((p.hasWeapon && !p.hasArmor) || (p.hasArmor && !p.hasWeapon))
  ) {
    return "equipment";
  }

  return "unit";
}

function deriveSubtype(traitMap) {
  const p = getTraitPresence(traitMap);

  const active = [
    p.hasWeapon ? "weapon" : null,
    p.hasArmor ? "armor" : null,
    p.hasArtifact ? "artifact" : null,
    p.hasCreature ? "creature" : null,
    p.hasMetaverse ? "metaverse" : null
  ].filter(Boolean);

  if (active.length === 0) return "none";
  if (active.length === 1) return active[0];
  return "hybrid";
}

function getBaseBudgetByRarity(rarity) {
  switch (rarity) {
    case "common":
      return 9;
    case "uncommon":
      return 10;
    case "rare":
      return 12;
    case "epic":
      return 14;
    case "legendary":
      return 16;
    case "mythic":
      return 17;
    case "god":
      return 19;
    case "one_of_one":
      return 20;
    default:
      return 11;
  }
}

function inferKeywords(traitMap) {
  const keywords = [];

  const weapon = normalizeText(traitMap["Weapons"]);
  const armor = normalizeText(traitMap["Armor"]);
  const artifact = normalizeText(traitMap["Artifacts"]);
  const creature = normalizeText(traitMap["Creature"]);
  const metaverse = normalizeText(traitMap["Metaverse"]);
  const rarity = deriveRarity(traitMap);

  const weaponLower = weapon.toLowerCase();
  const armorLower = armor.toLowerCase();
  const artifactLower = artifact.toLowerCase();
  const creatureLower = creature.toLowerCase();
  const metaverseLower = metaverse.toLowerCase();

  if (hasRealTrait(weapon)) {
    if (
      weaponLower.includes("bow") ||
      weaponLower.includes("cross bow") ||
      weaponLower.includes("sniper") ||
      weaponLower.includes("rifle") ||
      weaponLower.includes("uzi") ||
      weaponLower.includes("glock") ||
      weaponLower.includes("ak47") ||
      weaponLower.includes("pistol") ||
      weaponLower.includes("gun")
    ) {
      keywords.push("RANGED");
    }

    if (
      weaponLower.includes("sword") ||
      weaponLower.includes("axe") ||
      weaponLower.includes("scythe") ||
      weaponLower.includes("mace") ||
      weaponLower.includes("hammer") ||
      weaponLower.includes("katana") ||
      weaponLower.includes("flail") ||
      weaponLower.includes("dagger")
    ) {
      keywords.push("CRUSH");
    }

    if (
      weaponLower.includes("knife") ||
      weaponLower.includes("dagger") ||
      weaponLower.includes("whip") ||
      weaponLower.includes("slingshot") ||
      weaponLower.includes("throwing")
    ) {
      keywords.push("RUSH");
    }
  }

  if (hasRealTrait(armor)) {
    if (
      armorLower.includes("shield") ||
      armorLower.includes("plate") ||
      armorLower.includes("mail") ||
      armorLower.includes("buckler") ||
      armorLower.includes("gauntlets")
    ) {
      keywords.push("GUARD");
    }

    if (
      armorLower.includes("boots") ||
      armorLower.includes("stealth")
    ) {
      keywords.push("QUICKSTEP");
    }
  }

  if (hasRealTrait(artifact)) {
    if (
      artifactLower.includes("orb") ||
      artifactLower.includes("grimoire") ||
      artifactLower.includes("wings") ||
      artifactLower.includes("jet")
    ) {
      keywords.push("ARCANE");
    }
  }

  if (hasRealTrait(creature)) {
    if (creatureLower.includes("dragon")) keywords.push("FLYING");
    if (creatureLower.includes("raven")) keywords.push("FLYING");
    if (creatureLower.includes("widow") || creatureLower.includes("arachne") || creatureLower.includes("scorpion")) {
      keywords.push("VENOM");
    }
    if (creatureLower.includes("wolf")) keywords.push("HUNT");
  }

  if (hasRealTrait(metaverse)) {
    if (
      metaverseLower.includes("royalty") ||
      metaverseLower.includes("samurai") ||
      metaverseLower.includes("warrior") ||
      metaverseLower.includes("leonidas")
    ) {
      keywords.push("COMMAND");
    }

    if (
      metaverseLower.includes("astronaut") ||
      metaverseLower.includes("matrix") ||
      metaverseLower.includes("biohazard") ||
      metaverseLower.includes("steampunk")
    ) {
      keywords.push("TECH");
    }
  }

  if (rarity === "legendary" || rarity === "god" || rarity === "one_of_one") {
    keywords.push("MYTHIC");
  }

  return Array.from(new Set(keywords));
}

function inferStatBiases(traitMap, rarity) {
  const p = getTraitPresence(traitMap);
  const budget = getBaseBudgetByRarity(rarity);

  let attackBias = 0;
  let healthBias = 0;
  let armorBias = 0;
  let speedBias = 0;

  const weapon = normalizeText(traitMap["Weapons"]).toLowerCase();
  const armor = normalizeText(traitMap["Armor"]).toLowerCase();
  const creature = normalizeText(traitMap["Creature"]).toLowerCase();
  const metaverse = normalizeText(traitMap["Metaverse"]).toLowerCase();

  if (p.hasWeapon) attackBias += 3;
  if (p.hasArmor) {
    healthBias += 2;
    armorBias += 2;
  }
  if (p.hasArtifact) speedBias += 1;
  if (p.hasCreature) {
    attackBias += 1;
    healthBias += 1;
  }
  if (p.hasMetaverse) speedBias += 1;

  if (
    weapon.includes("bow") ||
    weapon.includes("sniper") ||
    weapon.includes("rifle") ||
    weapon.includes("uzi") ||
    weapon.includes("glock") ||
    weapon.includes("gun")
  ) {
    speedBias += 1;
  }

  if (
    weapon.includes("axe") ||
    weapon.includes("mace") ||
    weapon.includes("hammer") ||
    weapon.includes("scythe") ||
    weapon.includes("sword")
  ) {
    attackBias += 1;
  }

  if (
    armor.includes("shield") ||
    armor.includes("plate") ||
    armor.includes("mail") ||
    armor.includes("buckler")
  ) {
    armorBias += 1;
    healthBias += 1;
  }

  if (
    armor.includes("boots") ||
    armor.includes("stealth")
  ) {
    speedBias += 2;
  }

  if (creature.includes("dragon")) {
    attackBias += 2;
    healthBias += 1;
  }

  if (creature.includes("raven")) {
    speedBias += 2;
  }

  if (
    creature.includes("widow") ||
    creature.includes("arachne") ||
    creature.includes("scorpion")
  ) {
    speedBias += 1;
    attackBias += 1;
  }

  if (
    metaverse.includes("samurai") ||
    metaverse.includes("warrior") ||
    metaverse.includes("leonidas")
  ) {
    attackBias += 1;
    healthBias += 1;
  }

  if (
    metaverse.includes("matrix") ||
    metaverse.includes("biohazard") ||
    metaverse.includes("astronaut") ||
    metaverse.includes("steampunk")
  ) {
    speedBias += 1;
  }

  const spent = attackBias + healthBias + armorBias + speedBias;
  const filler = Math.max(0, budget - spent);

  healthBias += Math.floor(filler / 2);
  attackBias += Math.ceil(filler / 2);

  return {
    budget,
    attackBias,
    healthBias,
    armorBias,
    speedBias
  };
}

function buildCard(tokenId, metadata) {
  const attributes = getAttributes(metadata);
  const traitMap = traitArrayToMap(attributes);

  const faction = normalizeFaction(normalizeText(traitMap["Faction"], "UNKNOWN"));
  const rarity = deriveRarity(traitMap);
  const cardClass = deriveCardClass(traitMap);
  const subtype = deriveSubtype(traitMap);
  const keywords = inferKeywords(traitMap);
  const statBias = inferStatBiases(traitMap, rarity);

  const name = normalizeText(metadata.name, `TCG Card #${tokenId}`);
  const description = normalizeText(metadata.description, "");
  const imageUrl = normalizeText(metadata.image_url || metadata.image, "");
  const externalUrl = normalizeText(metadata.external_url, "");

  return {
    id: `tcg_${tokenId}`,
    tokenId,
    name,
    description,
    imageUrl,
    externalUrl,
    faction,
    rarity,
    cardClass,
    subtype,
    statBias,
    keywords,
    rawTraits: traitMap
  };
}

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Missing input directory: ${INPUT_DIR}`);
  }

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => Number(a.replace(".json", "")) - Number(b.replace(".json", "")));

  if (files.length === 0) {
    throw new Error(`No JSON files found in: ${INPUT_DIR}`);
  }

  const cards = [];

  for (const file of files) {
    const tokenId = file.replace(".json", "");
    const fullPath = path.join(INPUT_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    const card = buildCard(tokenId, parsed);
    cards.push(card);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cards, null, 2), "utf8");

  console.log(`Imported ${cards.length} TCG cards`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main();
