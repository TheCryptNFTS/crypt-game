import coreSet from "../data/curatedCoreSetV2.json";

const data = coreSet as {
  units: Array<{ id: string; faction: string; cost: number }>;
  equipment: Array<{ id: string; faction: string; cost: number }>;
  artifacts: Array<{ id: string; faction: string; cost: number }>;
  all: Array<{ id: string; faction: string; cost: number }>;
};

const byFaction: Record<string, number> = {};
const byCost: Record<string, number> = {};
const byType: Record<string, number> = {};

for (const card of data.all as Array<any>) {
  byFaction[card.faction] = (byFaction[card.faction] || 0) + 1;
  byCost[String(card.cost)] = (byCost[String(card.cost)] || 0) + 1;
  byType[card.type] = (byType[card.type] || 0) + 1;
}

console.log("\n=== CURATED CORE SET V2 CHECK ===");
console.log(`Units: ${data.units.length}`);
console.log(`Equipment: ${data.equipment.length}`);
console.log(`Artifacts: ${data.artifacts.length}`);
console.log(`Total: ${data.all.length}`);

console.log("\n=== BY FACTION ===");
console.log(JSON.stringify(byFaction, null, 2));

console.log("\n=== BY TYPE ===");
console.log(JSON.stringify(byType, null, 2));

console.log("\n=== BY COST ===");
console.log(JSON.stringify(byCost, null, 2));

console.log("\n=== FIRST 10 ===");
console.log(JSON.stringify((data.all as Array<any>).slice(0, 10), null, 2));
