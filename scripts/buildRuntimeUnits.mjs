import fs from "fs/promises";
import path from "path";

const root = process.cwd();

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(root, rel), "utf8"));
}

async function main() {
  const cardMaster = await readJson("src/data/cardMaster.json");

  const units = cardMaster
    .filter((card) => card.cardType === "unit")
    .map((card) => ({
      id: card.id,
      name: card.name,
      type: "unit",
      faction: card.faction ?? "STONE",
      rarity: card.rarity ?? "common",
      cost: card.gameStats?.cost ?? 0,
      stats: {
        attack: card.gameStats?.attack ?? 0,
        health: card.gameStats?.health ?? 1,
        speed: card.gameStats?.speed ?? 0,
        armor: card.gameStats?.armor ?? 0,
      },
      keywords: Array.isArray(card.gameStats?.keywords) ? card.gameStats.keywords : [],
    }));

  await fs.writeFile(
    path.join(root, "src/data/runtimeUnits.json"),
    JSON.stringify(units, null, 2),
    "utf8"
  );

  console.log(`Built runtimeUnits.json with ${units.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
