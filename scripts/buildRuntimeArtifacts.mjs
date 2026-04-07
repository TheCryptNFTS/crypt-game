import fs from "fs/promises";
import path from "path";

const root = process.cwd();

async function readJson(rel) {
  return JSON.parse(await fs.readFile(path.join(root, rel), "utf8"));
}

async function main() {
  const cardMaster = await readJson("src/data/cardMaster.json");

  // Compact tuple:
  // [id, cost, effectTags]
  const rows = cardMaster
    .filter((card) => card.cardType === "artifact")
    .map((card) => [
      card.id,
      card.gameStats?.cost ?? 0,
      Array.isArray(card.gameStats?.keywords) ? card.gameStats.keywords : [],
    ]);

  await fs.writeFile(
    path.join(root, "src/data/runtimeArtifacts.json"),
    JSON.stringify(rows),
    "utf8"
  );

  console.log(`Built runtimeArtifacts.json with ${rows.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
