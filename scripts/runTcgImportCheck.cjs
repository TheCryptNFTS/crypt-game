const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");

if (!fs.existsSync(INPUT_PATH)) {
  throw new Error(`Missing file: ${INPUT_PATH}`);
}

const raw = fs.readFileSync(INPUT_PATH, "utf8");
const cards = JSON.parse(raw);

console.log("\n=== TCG IMPORT CHECK ===");
console.log(`Total TCG cards imported: ${cards.length}`);

console.log("\n=== FIRST 5 TCG CARDS ===");
console.log(JSON.stringify(cards.slice(0, 5), null, 2));

const factions = {};
const rarities = {};
const classes = {};
const subtypes = {};
const keywordCounts = {};

for (const card of cards) {
  factions[card.faction] = (factions[card.faction] || 0) + 1;
  rarities[card.rarity] = (rarities[card.rarity] || 0) + 1;
  classes[card.cardClass] = (classes[card.cardClass] || 0) + 1;
  subtypes[card.subtype] = (subtypes[card.subtype] || 0) + 1;

  for (const keyword of card.keywords || []) {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  }
}

console.log("\n=== FACTION BREAKDOWN ===");
console.log(JSON.stringify(factions, null, 2));

console.log("\n=== RARITY BREAKDOWN ===");
console.log(JSON.stringify(rarities, null, 2));

console.log("\n=== CARD CLASS BREAKDOWN ===");
console.log(JSON.stringify(classes, null, 2));

console.log("\n=== SUBTYPE BREAKDOWN ===");
console.log(JSON.stringify(subtypes, null, 2));

console.log("\n=== KEYWORD BREAKDOWN ===");
console.log(JSON.stringify(keywordCounts, null, 2));
