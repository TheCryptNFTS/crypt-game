import fs from "fs/promises";
import path from "path";

const root = process.cwd();

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(root, rel), "utf8"));
}

async function main() {
  const cardMaster = await readJson("src/data/cardMaster.json");

  // Compact tuple:
  // [id, cost, attack, health, armor, speed, keywords]
  const rows = cardMaster
    .filter((card) => card.cardType === "equipment")
    .map((card) => [
      card.id,
      card.gameStats?.cost ?? 0,
      card.gameStats?.attack ?? 0,
      card.gameStats?.health ?? 0,
      card.gameStats?.armor ?? 0,
      card.gameStats?.speed ?? 0,
      Array.isArray(card.gameStats?.keywords) ? card.gameStats.keywords : [],
    ]);

  await fs.writeFile(
    path.join(root, "src/data/runtimeEquipment.json"),
    JSON.stringify(rows),
    "utf8"
  );

  console.log(`Built runtimeEquipment.json with ${rows.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
