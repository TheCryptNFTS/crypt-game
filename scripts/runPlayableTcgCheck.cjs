const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json");

if (!fs.existsSync(INPUT_PATH)) {
  throw new Error(`Missing file: ${INPUT_PATH}`);
}

const raw = fs.readFileSync(INPUT_PATH, "utf8");
const cards = JSON.parse(raw);

console.log("\n=== PLAYABLE TCG CHECK ===");
console.log(`Total playable TCG units: ${cards.length}`);

console.log("\n=== FIRST 5 PLAYABLE TCG UNITS ===");
console.log(JSON.stringify(cards.slice(0, 5), null, 2));

const factions = {};
const rarities = {};
const keywordCounts = {};
const costCounts = {};

for (const card of cards) {
  factions[card.faction] = (factions[card.faction] || 0) + 1;
  rarities[card.rarity] = (rarities[card.rarity] || 0) + 1;
  costCounts[card.cost] = (costCounts[card.cost] || 0) + 1;

  for (const keyword of card.keywords || []) {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  }
}

console.log("\n=== FACTION BREAKDOWN ===");
console.log(JSON.stringify(factions, null, 2));

console.log("\n=== RARITY BREAKDOWN ===");
console.log(JSON.stringify(rarities, null, 2));

console.log("\n=== COST BREAKDOWN ===");
console.log(JSON.stringify(costCounts, null, 2));

console.log("\n=== KEYWORD BREAKDOWN ===");
console.log(JSON.stringify(keywordCounts, null, 2));
