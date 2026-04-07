import fs from "fs/promises";
import path from "path";
import { buildCuratedDeck } from "../src/lib/buildCuratedDeck";
import { COMMANDER_SPECS } from "../src/design/commanderSpecs";

async function main() {
  const out: Record<string, string[]> = {};

  for (const commanderId of Object.keys(COMMANDER_SPECS).sort()) {
    out[commanderId] = buildCuratedDeck(commanderId);
  }

  const file = path.join(process.cwd(), "src/data/defaultDecks.json");
  await fs.writeFile(file, JSON.stringify(out, null, 2), "utf8");
  console.log(`Built defaultDecks.json for ${Object.keys(out).length} commanders`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
