import fs from "fs";
import path from "path";
import { allPlayableCards, getPlayableCardById } from "../engine/cards";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function run() {
  const file = path.resolve(process.cwd(), "public/data/renderManifest.json");

  assert(fs.existsSync(file), "renderManifest.json is missing. Run: npm run assets:build-manifest");

  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  assert(Array.isArray(data.commanders), "renderManifest.commanders missing");
  assert(Array.isArray(data.playable), "renderManifest.playable missing");
  assert(data.commanders.length > 0, "No commanders in renderManifest");
  assert(data.playable.length > 0, "No playable cards in renderManifest");

  const badCommander = data.commanders.find((c: any) => c.role !== "commander");
  assert(!badCommander, `Bad commander role: ${badCommander?.id}`);

  const badPlayable = data.playable.find(
    (c: any) => !["unit", "equipment", "artifact"].includes(c.role)
  );
  assert(!badPlayable, `Bad playable role: ${badPlayable?.id}`);

  // DRIFT GUARD: the manifest's playable section is a build artifact of the engine's
  // canonical catalog (allPlayableCards, overrides applied). If cardOverrides or the
  // tuple catalog changes without re-running `npm run assets:build-manifest`, the Vault
  // / Deck Builder would silently disagree with what the reducer plays. Pin that:
  //   (a) every manifest playable id resolves to a real engine card, and
  //   (b) its name + cost match the overridden catalog exactly.
  // (allPlayableCards minus the synthetic live SPELL archetype === the manifest set.)
  const engineCount = allPlayableCards.filter(
    (c) => c.type === "unit" || c.type === "equipment" || c.type === "artifact"
  ).length;
  assert(
    data.playable.length === engineCount,
    `Manifest is stale: ${data.playable.length} playable entries vs ${engineCount} engine cards. Run: npm run assets:build-manifest`
  );
  for (const entry of data.playable) {
    const card = getPlayableCardById(entry.id);
    assert(card != null, `Manifest card ${entry.id} is not in the engine catalog (stale id scheme?). Run: npm run assets:build-manifest`);
    assert(
      entry.name === card!.name,
      `Manifest name drift for ${entry.id}: "${entry.name}" vs engine "${card!.name}". Run: npm run assets:build-manifest`
    );
    assert(
      entry.cost === card!.cost,
      `Manifest cost drift for ${entry.id}: ${entry.cost} vs engine ${card!.cost}. Run: npm run assets:build-manifest`
    );
  }

  console.log("\n=== RENDER MANIFEST CHECK ===");
  console.log(`Playable in sync with engine catalog: ${data.playable.length}`);
  console.log("PASS");
}
run();
