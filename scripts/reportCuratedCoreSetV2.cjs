const fs = require("fs");
const path = require("path");

const core = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/curatedCoreSetV2.json"), "utf8"));

const byFaction = {};
const byType = {};
const byCost = {};
const byRarity = {};
const byKeyword = {};

for (const card of core.all) {
  byFaction[card.faction] = (byFaction[card.faction] || 0) + 1;
  byType[card.type] = (byType[card.type] || 0) + 1;
  byCost[card.cost] = (byCost[card.cost] || 0) + 1;
  byRarity[card.rarity] = (byRarity[card.rarity] || 0) + 1;

  for (const keyword of card.keywords || card.effectTags || []) {
    byKeyword[keyword] = (byKeyword[keyword] || 0) + 1;
  }
}

console.log("\n=== CURATED CORE SET V2 REPORT ===");
console.log("\n=== BY FACTION ===");
console.log(JSON.stringify(byFaction, null, 2));

console.log("\n=== BY TYPE ===");
console.log(JSON.stringify(byType, null, 2));

console.log("\n=== BY COST ===");
console.log(JSON.stringify(byCost, null, 2));

console.log("\n=== BY RARITY ===");
console.log(JSON.stringify(byRarity, null, 2));

console.log("\n=== BY KEYWORD ===");
console.log(JSON.stringify(byKeyword, null, 2));
