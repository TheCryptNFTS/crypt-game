const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json");

if (!fs.existsSync(INPUT_PATH)) {
  throw new Error(`Missing input file: ${INPUT_PATH}`);
}

const raw = fs.readFileSync(INPUT_PATH, "utf8");
const cards = JSON.parse(raw);

function mapFaction(faction) {
  const f = String(faction || "").trim().toUpperCase();

  switch (f) {
    case "STONE_KEEPERS":
      return "STONE_KEEPERS";
    case "IRON_DEFENDERS":
      return "IRON_DEFENDERS";
    case "BRONZE_GUARDIANS":
      return "BRONZE_GUARDIANS";
    case "SILVER_SENTINELS":
      return "SILVER_SENTINELS";
    case "GOLDEN_SOVEREIGNS":
      return "GOLDEN_SOVEREIGNS";
    case "GODS":
      return "GODS";
    default:
      return "GODS";
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deriveCost(card) {
  const budget = Number(card?.statBias?.budget || 10);
  const rarity = String(card?.rarity || "unknown");

  let cost = 2;

  if (budget <= 9) cost = 2;
  else if (budget <= 11) cost = 3;
  else if (budget <= 13) cost = 4;
  else if (budget <= 15) cost = 5;
  else if (budget <= 17) cost = 6;
  else cost = 7;

  if (rarity === "god" || rarity === "one_of_one") {
    cost += 1;
  }

  return clamp(cost, 1, 8);
}

function deriveStats(card) {
  const rarity = String(card?.rarity || "unknown");
  const bias = card?.statBias || {};

  let attack = Number(bias.attackBias || 0);
  let health = Number(bias.healthBias || 0);
  let armor = Number(bias.armorBias || 0);
  let speed = Number(bias.speedBias || 0);

  if (rarity === "common") {
    attack += 1;
    health += 3;
  } else if (rarity === "uncommon") {
    attack += 2;
    health += 3;
  } else if (rarity === "rare") {
    attack += 2;
    health += 4;
  } else if (rarity === "epic") {
    attack += 3;
    health += 5;
  } else if (rarity === "legendary") {
    attack += 4;
    health += 6;
  } else if (rarity === "god") {
    attack += 5;
    health += 8;
  } else if (rarity === "one_of_one") {
    attack += 5;
    health += 9;
  } else {
    attack += 2;
    health += 4;
  }

  return {
    attack: clamp(Math.round(attack), 1, 12),
    health: clamp(Math.round(health), 1, 20),
    armor: clamp(Math.round(armor), 0, 6),
    speed: clamp(Math.max(1, Math.round(speed + 1)), 1, 6)
  };
}

function mapKeywords(card) {
  const rawKeywords = Array.isArray(card?.keywords) ? card.keywords : [];

  const mapped = new Set();

  for (const keyword of rawKeywords) {
    const k = String(keyword || "").trim().toUpperCase();

    if (k === "GUARD") mapped.add("GUARD");
    if (k === "CRUSH") mapped.add("CRUSH");
    if (k === "RUSH") mapped.add("RUSH");

    if (k === "QUICKSTEP") mapped.add("RUSH");
    if (k === "RANGED") mapped.add("RUSH");
  }

  return Array.from(mapped);
}

function buildPlayableUnit(card) {
  return {
    id: `tcg_unit_${card.tokenId}`,
    name: card.name,
    type: "unit",
    faction: mapFaction(card.faction),
    rarity: card.rarity,
    cost: deriveCost(card),
    stats: deriveStats(card),
    keywords: mapKeywords(card),
    sourceTokenId: card.tokenId,
    sourceCardClass: card.cardClass,
    sourceSubtype: card.subtype,
    rawTraits: card.rawTraits || {}
  };
}

const playableUnits = cards
  .filter((card) => card.cardClass === "unit")
  .map(buildPlayableUnit);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(playableUnits, null, 2), "utf8");

console.log(`Built ${playableUnits.length} playable TCG units`);
console.log(`Output: ${OUTPUT_PATH}`);
