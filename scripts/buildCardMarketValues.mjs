import fs from "fs/promises";
import path from "path";

const root = process.cwd();

async function readJson(rel) {
  const full = path.join(root, rel);
  return JSON.parse(await fs.readFile(full, "utf8"));
}

async function main() {
  const cardMaster = await readJson("src/data/cardMaster.json");

  const out = {};

  for (const card of cardMaster) {
    const assetKey = card.assetKey;
    if (!assetKey) continue;

    out[assetKey] = {
      metric: "listing",
      value: null,
      currency: "ETH",
      checkedAt: new Date().toISOString(),
    };
  }

  await fs.writeFile(
    path.join(root, "src/data/cardMarketValues.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );

  console.log(`Built cardMarketValues.json with ${Object.keys(out).length} asset rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
