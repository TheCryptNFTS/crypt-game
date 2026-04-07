import fs from "fs/promises";
import path from "path";

const root = process.cwd();

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(root, rel), "utf8"));
}

async function main() {
  const cardMaster = await readJson("src/data/cardMaster.json");

  const playables = cardMaster
    .filter((card) => ["unit", "equipment", "artifact"].includes(card.cardType))
    .filter((card) => card.collection === "AVATAR_TCG")
    .map((card) => ({
      id: card.id,
      name: card.name,
      type: card.cardType,
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
    path.join(root, "src/data/runtimePlayableCards.json"),
    JSON.stringify(playables, null, 2),
    "utf8"
  );

  console.log(`Built runtimePlayableCards.json with ${playables.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
