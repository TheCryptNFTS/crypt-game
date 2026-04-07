import fs from "fs";
import path from "path";

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

  console.log("\n=== RENDER MANIFEST CHECK ===");
  console.log("PASS");
}
run();
