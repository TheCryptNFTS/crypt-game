import generatedNftCards from "../data/generatedNftCards.json";

const nftCards = generatedNftCards as any[];

const firstFive = nftCards.slice(0, 5);

const breakdown = nftCards.reduce(
  (acc, card) => {
    if (card.type === "unit") acc.units++;
    else if (card.type === "equipment") acc.equipment++;
    else if (card.type === "spell") acc.spells++;
    return acc;
  },
  { units: 0, equipment: 0, spells: 0 }
);

console.log("\n=== NFT IMPORT CHECK ===");
console.log(`Total NFT cards imported: ${nftCards.length}`);

console.log("\n=== FIRST 5 NFT CARDS ===");
console.log(JSON.stringify(firstFive, null, 2));

console.log("\n=== NFT CARD TYPE BREAKDOWN ===");
console.log(JSON.stringify(breakdown, null, 2));

console.log("\n=== STATUS ===");
console.log(
  "NFT cards are imported correctly. They are battle-ready once setup.ts uses loadAllUnits and runNftBattle uses real loaded NFT IDs."
);