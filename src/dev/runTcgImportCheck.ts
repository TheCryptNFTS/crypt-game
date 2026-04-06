import fs from "fs";
import path from "path";

type TcgCard = {
  id: string;
  tokenId: string;
  name: string;
  faction: string;
  rarity: string;
  cardType: string;
  rawTraits: Record<string, string>;
};

const INPUT_PATH = path.resolve(process.cwd(), "src/data/generatedTcgCards.json");

if (!fs.existsSync(INPUT_PATH)) {
  throw new Error(`Missing file: ${INPUT_PATH}`);
}

const raw = fs.readFileSync(INPUT_PATH, "utf8");
const cards = JSON.parse(raw) as TcgCard[];

console.log("\n=== TCG IMPORT CHECK ===");
console.log(`Total TCG cards imported: ${cards.length}`);

console.log("\n=== FIRST 5 TCG CARDS ===");
console.log(JSON.stringify(cards.slice(0, 5), null, 2));

const factions: Record<string, number> = {};
const rarities: Record<string, number> = {};
const cardTypes: Record<string, number> = {};

for (const card of cards) {
  factions[card.faction] = (factions[card.faction] || 0) + 1;
  rarities[card.rarity] = (rarities[card.rarity] || 0) + 1;
  cardTypes[card.cardType] = (cardTypes[card.cardType] || 0) + 1;
}

console.log("\n=== FACTION BREAKDOWN ===");
console.log(JSON.stringify(factions, null, 2));

console.log("\n=== RARITY BREAKDOWN ===");
console.log(JSON.stringify(rarities, null, 2));

console.log("\n=== CARD TYPE BREAKDOWN ===");
console.log(JSON.stringify(cardTypes, null, 2));
